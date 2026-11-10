'use client';
// Firma della ricevuta di consegna sul telefono (dito) o sul computer (mouse o penna): due riquadri,
// chi riceve e chi consegna. «Salva la ricevuta firmata» genera il PDF e lo collega all'anticipo.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signDelivery } from '@/app/(app)/anticipi/actions';

function Pad({ label, name, onChange, lang }: { label: string; name: string; onChange: (png: string | null) => void; lang: 'it' | 'fr' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false), last = useRef<[number, number] | null>(null), dirty = useRef(false);
  useEffect(() => {
    const c = ref.current!; const r = c.getBoundingClientRect(), dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext('2d')!; g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1E2B3C';
  }, []);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const g = e.currentTarget.getContext('2d')!, p = pos(e);
    g.beginPath(); g.moveTo(...last.current); g.lineTo(...p); g.stroke(); last.current = p; dirty.current = true;
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; last.current = null; if (dirty.current) onChange(ref.current!.toDataURL('image/png')); };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); };
  return (
    <div className="sig">
      <div className="sig-h"><span>{label}</span><button type="button" className="btn small ghost" onClick={clear}>{lang === 'fr' ? 'Effacer' : 'Cancella'}</button></div>
      <canvas ref={ref} className="sig-pad" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      <div className="sig-n">{name}</div>
    </div>
  );
}

export function DeliverySign({ id, holder, giver, lang }: { id: string; holder: string; giver: string; lang: 'it' | 'fr' }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const router = useRouter();
  const [a, setA] = useState<string | null>(null), [b, setB] = useState<string | null>(null);
  const [gName, setGName] = useState(giver);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    if (!a || !b) return setMsg(L('Servono le due firme.', 'Il faut les deux signatures.'));
    setBusy(true); setMsg(null);
    const r = await signDelivery(id, a, b, gName);
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? L('Non salvata.', 'Non enregistré.'));
    router.refresh();
  };
  return (
    <div className="sig-box no-print" id="firma">
      <div className="sig-grid">
        <Pad label={L('Firma di chi riceve', 'Signature de qui reçoit')} name={holder} onChange={setA} lang={lang} />
        <Pad label={L('Firma di chi consegna', 'Signature de qui remet')} name={gName} onChange={setB} lang={lang} />
      </div>
      <div className="sig-f">
        <label className="field"><span className="flabel">{L('Chi consegna', 'Qui remet')}</span>
          <input className="input" value={gName} maxLength={120} onChange={(e) => setGName(e.target.value)} /></label>
        <button type="button" className="btn primary" onClick={save} disabled={busy || !a || !b}>{busy ? L('Salvataggio…', 'Enregistrement…') : L('Salva la ricevuta firmata', 'Enregistrer le reçu signé')}</button>
        {msg && <span className="err-t" role="alert">{msg}</span>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>{L('Si firma con il dito sul telefono o con il mouse sul computer. Si crea il PDF con le due firme, la data e l’ora, archiviato con l’anticipo.',
        'On signe avec le doigt sur le téléphone ou la souris sur l’ordinateur. Le PDF est créé avec les deux signatures, la date et l’heure, et archivé avec l’avance.')}</p>
    </div>
  );
}
