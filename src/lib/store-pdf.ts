import 'server-only';
import { createHash } from 'node:crypto';
import type { createClient } from './supabase/server';

type Sb = Awaited<ReturnType<typeof createClient>>;

// Archivia un PDF generato come giustificativo: file nello spazio privato (percorso con l'impronta), registrazione
// con l'impronta SHA-256. client_uuid = id del documento d'origine: ripetere l'operazione non crea doppioni.
export async function storePdf(sb: Sb, o: { orgId: string; bytes: Uint8Array; number: string; date: string; clientUuid: string;
  docType: string; total?: number | string | null; currency?: string }): Promise<{ id?: string; error?: string }> {
  const hash = createHash('sha256').update(o.bytes).digest('hex');
  const path = `${o.orgId}/${o.date.slice(0, 4)}/${o.number}-${hash.slice(0, 10)}.pdf`;
  const up = await sb.storage.from('documents').upload(path, o.bytes, { contentType: 'application/pdf', upsert: false });
  if (up.error && !/exists|Duplicate/i.test(up.error.message)) return { error: up.error.message };
  const { data, error } = await sb.rpc('register_document', { p: {
    client_uuid: o.clientUuid, sha256: hash, original_path: path, mime: 'application/pdf', file_name: `${o.number}.pdf`,
    size_bytes: o.bytes.length, pages: 1, doc_type: o.docType, doc_number: o.number, doc_date: o.date,
    total: o.total ?? null, currency: o.currency ?? null } });
  if (error) return { error: error.message };
  return { id: data.id };
}
