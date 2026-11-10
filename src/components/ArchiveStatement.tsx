'use client';
// Documenti › Rendiconti: archivia il PDF della versione approvata e firmata (solo amministratori).
// Il file va nello spazio privato dell'ente, si registra come documento «statement» (non è un giustificativo)
// e si annota con anno, data ed estremi dell'approvazione.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const KINDS: [string, string, string][] = [['cash', 'Rendiconto per cassa (Mod. D)', 'Compte de caisse (Mod. D)'], ['model_e', 'Rendiconto aggregato (Mod. E)', 'Compte agrégé (Mod. E)'],
  ['social', 'Bilancio sociale', 'Bilan social'], ['other', 'Altro atto di bilancio', 'Autre acte comptable']];

async function sha256(f: File) {
  const b = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function ArchiveStatement({ orgId, year, lang }: { orgId: string; year: number; lang: 'it' | 'fr' }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('file') as File | null;
    if (!file || !file.size) return setMsg({ ok: false, t: L('Scegli il PDF firmato.', 'Choisissez le PDF signé.') });
    if (file.type !== 'application/pdf') return setMsg({ ok: false, t: L('Serve un file PDF.', 'Un fichier PDF est nécessaire.') });
    if (file.size > 20 * 1024 * 1024) return setMsg({ ok: false, t: L('Il file supera 20 MB.', 'Le fichier dépasse 20 Mo.') });
    setBusy(true); setMsg(null);
    try {
      const sb = createClient();
      const y = Number(fd.get('year')), hash = await sha256(file);
      const path = `${orgId}/rendiconti/${y}/${hash.slice(0, 16)}.pdf`;
      const up = await sb.storage.from('documents').upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw new Error(up.error.message);
      const ref = String(fd.get('approval_ref') ?? '').trim(), on = String(fd.get('approved_on') ?? '');
      const { data: d, error: e1 } = await sb.rpc('register_document', { p: { client_uuid: crypto.randomUUID(), sha256: hash, original_path: path,
        mime: 'application/pdf', file_name: file.name.slice(0, 255), size_bytes: file.size, doc_type: 'statement', doc_date: on, doc_number: ref.slice(0, 80) } });
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await sb.rpc('archive_statement', { p: { document_id: (d as { id: string }).id, year: y, kind: fd.get('kind'),
        approved_on: on, approval_ref: ref, notes: fd.get('notes') } });
      if (e2) throw new Error(/not_found/.test(e2.message) ? L('Questo file è già archiviato come giustificativo: carica il PDF firmato del rendiconto.', 'Ce fichier est déjà archivé comme justificatif : chargez le PDF signé du compte rendu.') : e2.message);
      (e.target as HTMLFormElement).reset();
      setMsg({ ok: true, t: L('Versione approvata archiviata.', 'Version approuvée archivée.') });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, t: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <details className="arch-new">
      <summary className="btn">{L('Archivia versione approvata', 'Archiver la version approuvée')}</summary>
      <form className="fgrid" onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="ar-y">{L('Anno del rendiconto', 'Année du compte rendu')}</label>
          <input className="input num" id="ar-y" name="year" type="number" min={2000} max={2100} required defaultValue={year} /></div>
        <div className="field"><label htmlFor="ar-k">{L('Documento', 'Document')}</label>
          <select className="input" id="ar-k" name="kind" defaultValue="cash">{KINDS.map(([k, it, fr]) => <option key={k} value={k}>{L(it, fr)}</option>)}</select></div>
        <div className="field"><label htmlFor="ar-d">{L('Data di approvazione', 'Date d’approbation')}</label>
          <input className="input" id="ar-d" name="approved_on" type="date" required /></div>
        <div className="field"><label htmlFor="ar-r">{L('Estremi (verbale, delibera)', 'Références (procès-verbal, délibération)')}</label>
          <input className="input" id="ar-r" name="approval_ref" required minLength={3} maxLength={300} placeholder={L('Es. verbale assemblea del 28/04', 'Ex. PV de l’assemblée du 28/04')} /></div>
        <div className="field span2"><label htmlFor="ar-f">{L('PDF firmato', 'PDF signé')}</label>
          <input className="input" id="ar-f" name="file" type="file" accept="application/pdf" required /></div>
        <div className="field span2"><label htmlFor="ar-n">{L('Note (facoltative)', 'Notes (facultatives)')}</label>
          <input className="input" id="ar-n" name="notes" maxLength={500} /></div>
        <div className="span2 row-actions"><button className="btn primary" type="submit" disabled={busy}>{busy ? L('Archiviazione…', 'Archivage…') : L('Archivia', 'Archiver')}</button>
          {msg && <span className={msg.ok ? 'ok-t' : 'err-t'} role="status">{msg.t}</span>}</div>
      </form>
    </details>
  );
}
