'use client';
import { useEffect, useRef, useState } from 'react';
import { detectCorners, enhance, inset, rotate90, warp, type Img, type Pt, type ScanMode } from '@/lib/scan';
import type { Dict } from '@/lib/i18n';

// original = file scelto (serve per il nome e per riconoscere i doppioni); prepared = file da inviare, già compressi:
// la scansione (≈ 250 KB) e l'originale ridotto a 2000 px (≈ 300 KB) invece della foto intera di 3–6 MB (25/11)
export type Prepared = { original: Blob; enhanced?: Blob };
export type ScanResult = { original: File; prepared?: Promise<Prepared> };

async function loadImage(file: File, maxSide = 2000): Promise<Img> {
  const bmp = await createImageBitmap(file);   // applica l'orientamento EXIF
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: c.width, height: c.height };
}

function draw(c: HTMLCanvasElement, img: Img) {
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
}

function toJpeg(img: Img, q: number): Promise<Blob> {
  const c = document.createElement('canvas');
  draw(c, img);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('jpeg'))), 'image/jpeg', q));
}

// un solo worker per la pagina; se il browser non ha Worker o OffscreenCanvas si lavora sul thread principale
let worker: Worker | null | undefined;
function scanWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try { worker = typeof OffscreenCanvas !== 'undefined' ? new Worker(new URL('../lib/scan.worker.ts', import.meta.url)) : null; } catch { worker = null; }
  return worker;
}
// il worker parte appena si carica l'editor (con la rete): così il suo file resta salvato anche per l'uso offline
if (typeof window !== 'undefined' && navigator.onLine) scanWorker();
function prepareOnMain(img: Img, corners: Pt[], mode: ScanMode): Promise<Prepared> {
  return (async () => { const r = enhance(warp(img, inset(corners)), mode); return { enhanced: await toJpeg(r, mode === 'photo' ? 0.8 : 0.78), original: await toJpeg(img, 0.72) }; })();
}
// se il worker non parte (senza rete il suo file potrebbe non essere ancora salvato sul telefono) o non risponde entro 20 s,
// si lavora sul thread principale: la foto non resta mai bloccata
function prepareInWorker(img: Img, corners: Pt[], mode: ScanMode): Promise<Prepared> {
  const w = scanWorker();
  if (!w) return prepareOnMain(img, corners, mode);
  const id = crypto.randomUUID();
  return new Promise<Prepared>((res, rej) => {
    const done = () => { clearTimeout(timer); w.removeEventListener('message', on); w.removeEventListener('error', fail); };
    const on = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      done();
      if (e.data.ok) res({ enhanced: e.data.scan, original: e.data.original }); else rej(new Error(e.data.error));
    };
    const fail = () => { done(); worker = null; rej(new Error('worker')); };
    const timer = setTimeout(fail, 20000);
    w.addEventListener('message', on);
    w.addEventListener('error', fail);
    w.postMessage({ id, img, corners, mode });
  }).catch(() => prepareOnMain(img, corners, mode));
}

const MODES: ScanMode[] = ['document', 'bw', 'photo'];
const lastMode = (): ScanMode => {
  try { const m = localStorage.getItem('yc-scan-mode') as ScanMode | null; return m && MODES.includes(m) ? m : 'document'; } catch { return 'document'; }
};
const tick = () => new Promise((r) => setTimeout(r, 30));   // lascia disegnare "Elaborazione…"

// Due passi: 1) ritaglio con quattro angoli trascinabili; 2) anteprima del risultato con tre resa
// (Documento, Bianco e nero, Foto). Restituisce l'immagine scelta e l'originale ridotto, compressi in JPEG; l'originale si conserva sempre.
export function ScanEditor({ file, t, onDone, onCancel }: {
  file: File; t: Dict; onDone: (r: ScanResult) => void; onCancel: () => void;
}) {
  const [img, setImg] = useState<Img | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [step, setStep] = useState<'crop' | 'result'>('crop');
  const [mode, setMode] = useState<ScanMode>('document');
  const [result, setResult] = useState<Img | null>(null);
  const warped = useRef<Img | null>(null);
  const cache = useRef(new Map<ScanMode, Img>());
  const preview = useRef<HTMLCanvasElement>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => { setMode(lastMode()); }, []);
  useEffect(() => {
    let alive = true;
    loadImage(file).then((im) => { if (alive) { setImg(im); setCorners(detectCorners(im)); } }).catch(() => onCancel());
    return () => { alive = false; };
  }, [file, onCancel]);
  useEffect(() => { if (img && preview.current && step === 'crop') draw(preview.current, img); }, [img, step]);
  useEffect(() => { if (result && out.current && step === 'result') draw(out.current, result); }, [result, step]);

  function point(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * img!.width, y: ((e.clientY - r.top) / r.height) * img!.height };
  }

  async function render(m: ScanMode) {
    setMode(m);
    try { localStorage.setItem('yc-scan-mode', m); } catch { /* niente */ }
    const hit = cache.current.get(m);
    if (hit) { setResult(hit); return; }
    setBusy(true);
    await tick();
    const r = enhance(warped.current!, m);
    cache.current.set(m, r);
    setResult(r);
    setBusy(false);
  }

  async function next() {
    if (!img) return;
    setBusy(true);
    await tick();
    warped.current = warp(img, inset(corners));
    cache.current.clear();
    setStep('result');
    setBusy(false);
    await render(mode);
  }

  // un tocco (revisione operatore, 16/11): bordi trovati in automatico, miglioramento con l'ultima modalità scelta, e si usa subito
  async function quick() {
    if (!img) return;
    // l'editor si chiude subito: raddrizzatura, miglioramento e compressione continuano in un worker
    onDone({ original: file, prepared: prepareInWorker(img, corners, mode) });
  }

  async function finish() {
    if (!result || !img) return;
    const res = result, im = img;
    onDone({ original: file, prepared: (async () => ({ enhanced: await toJpeg(res, mode === 'photo' ? 0.8 : 0.78), original: await toJpeg(im, 0.72) }))() });
  }

  const r = img ? Math.max(img.width, img.height) / 45 : 10;
  const L = { document: t.scan_mode_document, bw: t.scan_mode_bw, photo: t.scan_mode_photo };
  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label={t.scan_title}>
      <div className="scan-box">
        <div className="panel-h"><h2>{t.scan_title}</h2><div className="spacer" />
          <button type="button" className="btn ghost" onClick={onCancel}>{t.scan_cancel}</button></div>
        <p className="hint" style={{ margin: '8px 16px 0' }}>{step === 'crop' ? t.scan_hint : t.scan_hint2}</p>

        {step === 'crop' ? (
          <div className="scan-stage">
            {!img ? <p className="muted">{t.scan_working}</p> : (
              <div style={{ position: 'relative', width: '100%', aspectRatio: `${img.width} / ${img.height}`, maxHeight: '62vh' }}>
                <canvas ref={preview} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 8 }} />
                <svg ref={svg} viewBox={`0 0 ${img.width} ${img.height}`} preserveAspectRatio="none" overflow="visible"
                     style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', overflow: 'visible' }}
                     onPointerMove={(e) => { if (drag !== null) setCorners((cs) => cs.map((p, i) => (i === drag ? point(e) : p))); }}
                     onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
                  <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(232,190,90,.18)" stroke="#E8BE5A" strokeWidth={r / 4} />
                  {corners.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={r} fill="#FFFFFF" stroke="#44546A" strokeWidth={r / 4}
                            style={{ cursor: 'grab' }}
                            onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); setDrag(i); }} />
                  ))}
                </svg>
              </div>
            )}
          </div>
        ) : (
          <div className="scan-stage">
            <div className="seg" role="radiogroup" aria-label={t.scan_title} style={{ marginBottom: 10 }}>
              {MODES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={busy}
                        onClick={() => render(m)}>{L[m]}</button>
              ))}
            </div>
            {result ? (
              <div style={{ position: 'relative', width: '100%', aspectRatio: `${result.width} / ${result.height}`, maxHeight: '58vh' }}>
                <canvas ref={out} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,.18)', background: '#fff' }} />
                {busy && <div className="scan-busy">{t.scan_working}</div>}
              </div>
            ) : <p className="muted">{t.scan_working}</p>}
          </div>
        )}

        <div className="factions scan-acts" style={{ padding: '0 16px 16px', position: 'static', background: 'none' }}>
          {step === 'crop' ? (
            <>
              <button type="button" className="btn" disabled={!img || busy}
                      onClick={() => { const rot = rotate90(img!); setImg(rot); setCorners(detectCorners(rot)); }}>{t.scan_rotate}</button>
              <button type="button" className="btn" disabled={!img || busy} onClick={() => setCorners(detectCorners(img!))}>{t.scan_reset}</button>
              <div className="spacer" />
              <button type="button" className="btn" disabled={busy} onClick={() => onDone({ original: file, prepared: img ? toJpeg(img, 0.75).then((o) => ({ original: o })) : undefined })}>{t.scan_original}</button>
              <button type="button" className="btn" disabled={!img || busy} onClick={next}>{t.scan_next}</button>
              <button type="button" className="btn primary" disabled={!img || busy} onClick={quick}>{busy ? t.scan_working : t.scan_use_now}</button>
            </>
          ) : (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => { setStep('crop'); setResult(null); }}>{t.scan_back}</button>
              <div className="spacer" />
              <button type="button" className="btn primary" disabled={!result || busy} onClick={finish}>{busy ? t.scan_working : t.scan_use}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
