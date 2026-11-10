'use client';
// Anticipi: caricamento di un documento dell'anticipo (preventivo o stima alla richiesta; ricevuta di consegna firmata).
// Il file va nello spazio privato dell'ente e si registra come documento del suo tipo (non è un giustificativo di spesa).
// - senza reqId (modulo di richiesta): carica subito e mette l'id nel campo nascosto `name`, che il server collega alla richiesta;
// - con reqId: carica e collega subito alla richiesta, poi aggiorna la pagina.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

async function sha256(f: File) {
  const b = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export function AdvanceDoc({ orgId, kind, lang, label, name, reqId, compact }: {
  orgId: string; kind: 'estimate' | 'delivery'; lang: 'it' | 'fr'; label: string; name?: string; reqId?: string; compact?: boolean;
}) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [docId, setDocId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!OK.includes(file.type)) return setMsg({ ok: false, t: L('Serve una foto o un PDF.', 'Il faut une photo ou un PDF.') });
    if (file.size > 15 * 1024 * 1024) return setMsg({ ok: false, t: L('Il file supera 15 MB.', 'Le fichier dépasse 15 Mo.') });
    setBusy(true); setMsg(null);
    try {
      const sb = createClient();
      const hash = await sha256(file), ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
      const path = `${orgId}/anticipi/${hash.slice(0, 16)}.${ext}`;
      const up = await sb.storage.from('documents').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw new Error(up.error.message);
      const { data: d, error: e1 } = await sb.rpc('register_document', { p: { client_uuid: crypto.randomUUID(), sha256: hash, original_path: path,
        mime: file.type, file_name: file.name.slice(0, 255), size_bytes: file.size, doc_type: kind === 'estimate' ? 'estimate' : 'delivery_receipt',
        doc_date: new Date().toISOString().slice(0, 10) } });
      if (e1) throw new Error(e1.message);
      const id = (d as { id: string }).id;
      if (reqId) {
        const { error: e2 } = await sb.rpc('advance_attach', { p: { id: reqId, kind, document_id: id } });
        if (e2) throw new Error(e2.message);
        router.refresh();
      }
      setDocId(id);
      setMsg({ ok: true, t: L(`Allegato: ${file.name}`, `Joint : ${file.name}`) });
    } catch (err) {
      setMsg({ ok: false, t: (err as Error).message });
    } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }

  return (
    <div className={`adv-up${compact ? ' compact' : ''}`}>
      {name && <input type="hidden" name={name} value={docId} />}
      <label className={`btn${compact ? ' small' : ''}`}>
        <input ref={ref} type="file" accept="image/*,application/pdf" capture={undefined} hidden onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
        {busy ? L('Caricamento…', 'Envoi…') : label}
      </label>
      {msg && <span className={msg.ok ? 'ok-t' : 'err-t'} role="status">{msg.t}</span>}
    </div>
  );
}
