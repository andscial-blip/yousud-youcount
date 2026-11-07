'use client';
import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { detectCorners, enhance, rotate90, warp, type Img, type Pt } from '@/lib/scan';
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

function toCanvas(img: Img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

async function makePdf(jpeg: Blob, w: number, h: number) {
  const pdf = await PDFDocument.create();
  const img = await pdf.embedJpg(await jpeg.arrayBuffer());
  const pw = 595.28, ph = (pw * h) / w;   // larghezza A4, altezza in proporzione
  pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  pdf.setProducer('YouCount · YouSud ODV');
  return new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' });
}

// Ritaglio con quattro angoli trascinabili, raddrizzamento e pulizia. Restituisce originale, immagine migliorata e PDF.
export function ScanEditor({ file, t, onDone, onCancel }: {
  file: File; t: Dict; onDone: (r: ScanResult) => void; onCancel: () => void;
}) {
  const [img, setImg] = useState<Img | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [improve, setImprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    loadImage(file).then((im) => { if (alive) { setImg(im); setCorners(detectCorners(im)); } }).catch(() => onCancel());
    return () => { alive = false; };
  }, [file, onCancel]);

  useEffect(() => {
    if (!img || !preview.current) return;
    const c = preview.current;
    c.width = img.width; c.height = img.height;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  }, [img]);

  function point(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * img!.width, y: ((e.clientY - r.top) / r.height) * img!.height };
  }

  async function finish() {
    if (!img) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));   // lascia disegnare "Elaborazione…"
    let out = warp(img, corners);
    if (improve) out = enhance(out);
    const c = toCanvas(out);
    const jpeg: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.86));
    const pdf = await makePdf(jpeg, out.width, out.height);
    onDone({ original: file, enhanced: jpeg, pdf });
  }

  const r = img ? Math.max(img.width, img.height) / 45 : 10;
  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label={t.scan_title}>
      <div className="scan-box">
        <div className="panel-h"><h2>{t.scan_title}</h2><div className="spacer" />
          <button type="button" className="btn ghost" onClick={onCancel}>{t.scan_cancel}</button></div>
        <p className="hint" style={{ margin: '8px 16px 0' }}>{t.scan_hint}</p>
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
        <div className="factions" style={{ padding: '0 16px 16px', position: 'static', background: 'none' }}>
          <button type="button" className="btn" disabled={!img || busy}
                  onClick={() => { const rot = rotate90(img!); setImg(rot); setCorners(detectCorners(rot)); }}>{t.scan_rotate}</button>
          <button type="button" className="btn" disabled={!img || busy} onClick={() => setCorners(detectCorners(img!))}>{t.scan_reset}</button>
          <label className="check"><input type="checkbox" checked={improve} onChange={(e) => setImprove(e.target.checked)} /> {t.scan_enhance}</label>
          <div className="spacer" />
          <button type="button" className="btn" disabled={busy} onClick={() => onDone({ original: file })}>{t.scan_original}</button>
          <button type="button" className="btn primary" disabled={!img || busy} onClick={finish}>{busy ? t.scan_working : t.scan_use}</button>
        </div>
      </div>
    </div>
  );
}
