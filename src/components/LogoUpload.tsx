'use client';
import { useState } from 'react';

type L = { pick: string; hint: string; save: string; remove: string; big: string; bad: string };

// Il logo si ridimensiona nel browser (al massimo 480 × 160 px) prima dell'invio: resta piccolo (PNG o JPEG)
// e sta nelle impostazioni e nel backup. Il server lo ricontrolla.
export function LogoUpload({ current, action, removeAction, labels: t, max }: {
  current: string | null; action: (f: FormData) => void; removeAction: (f: FormData) => void; labels: L; max: number;
}) {
  const [data, setData] = useState<{ mime: string; b64: string } | null>(null);
  const [err, setErr] = useState('');
  const onFile = async (f: File | undefined) => {
    setErr(''); setData(null);
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setErr(t.bad); return; }
    const img = new Image();
    img.src = URL.createObjectURL(f);
    try { await img.decode(); } catch { setErr(t.bad); return; }
    const k = Math.min(480 / img.naturalWidth, 160 / img.naturalHeight, 1);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    // PNG (trasparenza) se resta piccolo, altrimenti JPEG su fondo bianco
    let url = c.toDataURL('image/png');
    if (url.length - 22 > max) {
      const w = document.createElement('canvas'); w.width = c.width; w.height = c.height;
      const wg = w.getContext('2d')!; wg.fillStyle = '#fff'; wg.fillRect(0, 0, w.width, w.height); wg.drawImage(c, 0, 0);
      for (const q of [0.9, 0.8, 0.7, 0.6]) { url = w.toDataURL('image/jpeg', q); if (url.length - 23 <= max) break; }
    }
    const [head, b64] = url.split(',');
    if (b64.length > max) { setErr(t.big); return; }
    setData({ mime: head.includes('jpeg') ? 'image/jpeg' : 'image/png', b64 });
  };
  const shown = data ? `data:${data.mime};base64,${data.b64}` : current;
  return (
    <div className={shown ? 'logo-up has' : 'logo-up'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- immagine incorporata (data URL) */}
      {shown && <img className="logo-prev" src={shown} alt="" />}
      <form action={action} className="stack" style={{ gap: 8 }}>
        <label className="field"><span className="flabel">{t.pick}</span>
          <input className="input" type="file" accept="image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className="hint">{t.hint}</span></label>
        <input type="hidden" name="mime" value={data?.mime ?? ''} />
        <input type="hidden" name="data" value={data?.b64 ?? ''} />
        {err && <div className="note err">{err}</div>}
        <div className="row-actions">
          <button className="btn primary" type="submit" disabled={!data}>{t.save}</button>
          {current && <button className="btn danger" type="submit" formAction={removeAction}>{t.remove}</button>}
        </div>
      </form>
    </div>
  );
}
