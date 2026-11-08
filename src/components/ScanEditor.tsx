'use client';
import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { detectCorners, enhance, inset, rotate90, warp, type Img, type Pt, type ScanMode } from '@/lib/scan';
import type { Dict } from '@/lib/i18n';

export type ScanResult = { original: File; enhanced?: Blob; pdf?: Blob };

async function loadImage(file: File, maxSide = 2400): Promise<Img> {
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

async function makePdf(jpeg: Blob, w: number, h: number) {
  const pdf = await PDFDocument.create();
  const img = await pdf.embedJpg(await jpeg.arrayBuffer());
  const pw = 595.28, ph = (pw * h) / w;   // larghezza A4, altezza in proporzione
  pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  pdf.setProducer('YouCount · YouSud ODV');
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

const MODES: ScanMode[] = ['document', 'bw', 'photo'];
const lastMode = (): ScanMode => {
  try { const m = localStorage.getItem('yc-scan-mode') as ScanMode | null; return m && MODES.includes(m) ? m : 'document'; } catch { return 'document'; }
};
const tick = () => new Promise((r) => setTimeout(r, 30));   // lascia disegnare "Elaborazione…"

// Due passi: 1) ritaglio con quattro angoli trascinabili; 2) anteprima del risultato con tre resa
// (Documento, Bianco e nero, Foto). Restituisce originale, immagine scelta e PDF; l'originale si conserva sempre.
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

  async function finish() {
    if (!result) return;
    setBusy(true);
    await tick();
    const c = document.createElement('canvas');
    draw(c, result);
    const jpeg: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', mode === 'photo' ? 0.88 : 0.9));
    const pdf = await makePdf(jpeg, result.width, result.height);
    onDone({ original: file, enhanced: jpeg, pdf });
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
                <canvas ref={preview} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 6 }} />
                <svg ref={svg} viewBox={`0 0 ${img.width} ${img.height}`} preserveAspectRatio="none"
                     style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
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
                <canvas ref={out} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 6, boxShadow: '0 1px 6px rgba(0,0,0,.18)', background: '#fff' }} />
                {busy && <div className="scan-busy">{t.scan_working}</div>}
              </div>
            ) : <p className="muted">{t.scan_working}</p>}
          </div>
        )}

        <div className="factions" style={{ padding: '0 16px 16px', position: 'static', background: 'none' }}>
          {step === 'crop' ? (
            <>
              <button type="button" className="btn" disabled={!img || busy}
                      onClick={() => { const rot = rotate90(img!); setImg(rot); setCorners(detectCorners(rot)); }}>{t.scan_rotate}</button>
              <button type="button" className="btn" disabled={!img || busy} onClick={() => setCorners(detectCorners(img!))}>{t.scan_reset}</button>
              <div className="spacer" />
              <button type="button" className="btn" disabled={busy} onClick={() => onDone({ original: file })}>{t.scan_original}</button>
              <button type="button" className="btn primary" disabled={!img || busy} onClick={next}>{busy ? t.scan_working : t.scan_next}</button>
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
