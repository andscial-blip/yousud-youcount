'use client';
import { useState } from 'react';
import { zipSync, type Zippable } from 'fflate';
import { Ico } from '@/components/Ui';

// Scarica in un solo file ZIP i giustificativi dell'anno o del mese scelto, con i nomi «data_MOV-…».
export function DocsZip({ year, lang }: { year: number; lang: 'it' | 'fr' }) {
  const FR = lang === 'fr';
  const [y, setY] = useState(year);
  const [m, setM] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(FR ? 'fr-FR' : 'it-IT', { month: 'long' }));
  const go = async () => {
    setBusy(true); setMsg(FR ? 'Préparation…' : 'Preparo l\'elenco…');
    try {
      const r = await fetch(`/api/v1/documenti?anno=${y}${m ? `&mese=${m}` : ''}`);
      const j = await r.json() as { files?: { name: string; url: string }[]; error?: string };
      if (!r.ok || !j.files) throw new Error(j.error ?? String(r.status));
      if (!j.files.length) { setMsg(FR ? 'Aucun justificatif pour cette période.' : 'Nessun giustificativo in questo periodo.'); return; }
      const out: Zippable = {};
      let i = 0;
      for (const f of j.files) {
        i++; setMsg(FR ? `Téléchargement ${i} / ${j.files.length}…` : `Scarico ${i} di ${j.files.length}…`);
        const b = await fetch(f.url);
        if (!b.ok) throw new Error(`${f.name}: ${b.status}`);
        out[f.name] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];   // PDF e foto sono già compressi
      }
      const zip = zipSync(out);
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url; a.download = `giustificativi_${y}${m ? `-${String(m).padStart(2, '0')}` : ''}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMsg(FR ? `${j.files.length} justificatifs dans le ZIP.` : `${j.files.length} giustificativi nello ZIP.`);
    } catch (e) {
      setMsg((FR ? 'Téléchargement impossible : ' : 'Download non riuscito: ') + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };
  return (
    <div className="dzip">
      <select className="input" value={y} onChange={(e) => setY(Number(e.target.value))} aria-label={FR ? 'Année' : 'Anno'}>
        {[year, year - 1, year - 2].map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <select className="input" value={m} onChange={(e) => setM(Number(e.target.value))} aria-label={FR ? 'Mois' : 'Mese'}>
        <option value={0}>{FR ? 'Toute l\'année' : 'Tutto l\'anno'}</option>
        {months.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
      </select>
      <button type="button" className="btn" onClick={go} disabled={busy}><Ico name="download" />{FR ? 'Tout télécharger (ZIP)' : 'Scarica tutti (ZIP)'}</button>
      {msg && <p className="muted small" role="status" style={{ margin: 0, flexBasis: '100%' }}>{msg}</p>}
    </div>
  );
}
