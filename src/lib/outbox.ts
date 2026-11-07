'use client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Coda dei movimenti salvati senza rete. Vive nel telefono (IndexedDB) finché il server non li ha
// ricevuti: i file restano come Blob, l'invio è idempotente (client_uuid del movimento e di ogni
// documento), quindi un invio interrotto e ripetuto non crea doppioni.

export type OutFile = {
  key: string;                 // client_uuid del documento
  name: string; type: string; size: number;
  original: Blob; enhanced?: Blob | null; pdf?: Blob | null;
  docId?: string;              // valorizzato quando il server ha registrato il documento
};
export type OutItem = {
  id: string;                  // client_uuid del movimento
  createdAt: string;
  orgId: string; userId: string;
  label: string; amount: number; currency: string; opDate: string;
  payload: Record<string, unknown>;
  cpNew: { name: string; kind: 'donor' | 'supplier' } | null;
  docIds: string[];            // documenti già sul server al momento del salvataggio
  files: OutFile[];
  state: 'pending' | 'error';
  error?: string;
  attempts: number;
};

const DB = 'youcount';
const STORE = 'outbox';
export const OUTBOX_EVENT = 'youcount-outbox';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}
const changed = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

export async function listOutbox(): Promise<OutItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  const all = await tx<OutItem[]>('readonly', (s) => s.getAll() as IDBRequest<OutItem[]>);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function putOutbox(item: OutItem) { await tx('readwrite', (s) => s.put(item)); changed(); }
export async function deleteOutbox(id: string) { await tx('readwrite', (s) => s.delete(id)); changed(); }

// identificativo stabile del dispositivo, per il registro di sincronizzazione del server
export function deviceId() {
  try {
    let id = localStorage.getItem('yc-device');
    if (!id) { id = `web-${crypto.randomUUID().slice(0, 8)}`; localStorage.setItem('yc-device', id); }
    return id;
  } catch { return 'web'; }
}

// errore di rete (nessuna risposta dal server) o errore applicativo (il server ha rifiutato)
export function isNetworkError(e: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String((e as { message?: string })?.message ?? e);
  return e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_INTERNET/i.test(msg);
}

async function sha256(blob: Blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Carica un giustificativo (originale, scansione e PDF) e lo registra. Idempotente: se il file è già
// in archivio (stessa impronta) non lo ricarica; register_document con lo stesso client_uuid restituisce il precedente.
export async function uploadDocument(supabase: SupabaseClient, o: {
  orgId: string; year: string; key: string; file: Blob; name: string; type: string; size: number;
  enhanced?: Blob | null; pdf?: Blob | null; docDate?: string | null;
}): Promise<{ id: string; outcome: string }> {
  const hash = await sha256(o.file);
  const ext = (o.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = `${o.orgId}/${o.year}/${o.key}`;
  const paths = { original: `${base}.${ext}`, enhanced: o.enhanced ? `${base}-scan.jpg` : null, pdf: o.pdf ? `${base}.pdf` : null };
  const { data: found, error: fErr } = await supabase.from('documents').select('id').eq('sha256', hash).maybeSingle();
  if (fErr) throw fErr;
  if (!found) {
    const put = async (path: string, body: Blob, type: string) => {
      const up = await supabase.storage.from('documents').upload(path, body, { contentType: type, upsert: false });
      // "già esistente": un invio precedente interrotto dopo il caricamento del file
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) throw up.error;
    };
    await put(paths.original, o.file, o.type || 'application/octet-stream');
    if (o.enhanced && paths.enhanced) await put(paths.enhanced, o.enhanced, 'image/jpeg');
    if (o.pdf && paths.pdf) await put(paths.pdf, o.pdf, 'application/pdf');
  }
  const { data, error } = await supabase.rpc('register_document', {
    p: { client_uuid: o.key, sha256: hash, original_path: paths.original, enhanced_path: paths.enhanced, pdf_path: paths.pdf,
         mime: o.type || 'application/octet-stream', file_name: o.name, size_bytes: o.size, doc_date: o.docDate || null },
  });
  if (error) throw error;
  return { id: data.id, outcome: data.outcome };
}

// Invia la coda, un movimento alla volta. Un solo invio per volta anche se chiamato da più punti.
let running: Promise<{ sent: number; failed: number }> | null = null;
export function flushOutbox(supabase: SupabaseClient, opts: { retryErrors?: boolean } = {}) {
  if (!running) running = doFlush(supabase, opts).finally(() => { running = null; });
  return running;
}

async function doFlush(supabase: SupabaseClient, { retryErrors = false }: { retryErrors?: boolean }) {
  let sent = 0, failed = 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { sent, failed };
  const { data: auth } = await supabase.auth.getUser();
  for (const item of await listOutbox()) {
    if (item.state === 'error' && !retryErrors) continue;
    if (!auth.user || auth.user.id !== item.userId) continue;   // mai inviare a nome di un altro utente
    try {
      // 1. giustificativi: ognuno salvato nella coda appena registrato, così un'interruzione non lo ricarica
      for (const f of item.files) {
        if (f.docId) continue;
        const r = await uploadDocument(supabase, { orgId: item.orgId, year: item.opDate.slice(0, 4), key: f.key, file: f.original,
          name: f.name, type: f.type, size: f.size, enhanced: f.enhanced, pdf: f.pdf, docDate: (item.payload.doc_date as string) ?? null });
        f.docId = r.id;
        await putOutbox(item);
      }
      // 2. controparte nuova: si riusa se nel frattempo esiste già con lo stesso nome
      let counterparty = (item.payload.counterparty_id as string | null) ?? null;
      if (item.cpNew) {
        const { data: ex } = await supabase.from('counterparties').select('id').eq('org_id', item.orgId).ilike('name', item.cpNew.name).limit(1).maybeSingle();
        if (ex) counterparty = ex.id;
        else {
          const { data, error } = await supabase.from('counterparties')
            .insert({ org_id: item.orgId, name: item.cpNew.name, kind: item.cpNew.kind, created_by: item.userId }).select('id').single();
          if (error) throw error;
          counterparty = data.id;
        }
      }
      // 3. movimento: client_uuid = id della coda (un secondo invio risponde "duplicate", non crea un doppione)
      const p = { ...item.payload, counterparty_id: counterparty, client_uuid: item.id, device_id: deviceId(),
        document_ids: [...item.docIds, ...item.files.map((f) => f.docId!)] };
      const { data, error } = await supabase.rpc('save_movement', { p });
      if (error) throw error;
      if (data?.outcome === 'conflict') throw new Error('conflict');
      await deleteOutbox(item.id);
      sent++;
    } catch (e) {
      if (isNetworkError(e)) break;    // rete caduta: si riprova al prossimo giro, la coda resta com'è
      failed++;
      await putOutbox({ ...item, state: 'error', error: String((e as { message?: string })?.message ?? e).slice(0, 300), attempts: item.attempts + 1 });
    }
  }
  return { sent, failed };
}
