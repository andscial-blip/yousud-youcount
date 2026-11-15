import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '@/lib/supabase/admin';
import { ROOT_NAME, fileName, folderPath, type DriveTarget } from '@/lib/drive-naming';

// Copia su Google Drive di giustificativi e documenti emessi (solo server).
// Autorizzazione: OAuth dell'account Google dell'associazione con il permesso più stretto (drive.file:
// l'app vede soltanto i file e le cartelle che crea). Il database resta la fonte di verità; nel Drive non si elimina nulla.

const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_ATTEMPTS = 8;

export const driveConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const redirectUri = (origin: string) => `${origin}/api/v1/drive/callback`;

export function consentUrl(origin: string, state: string) {
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', redirect_uri: redirectUri(origin), response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenCall(body: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', ...body }) });
  const j = await r.json().catch(() => ({})) as Record<string, string>;
  if (!r.ok) throw new Error(`Google: ${j.error ?? r.status}${j.error_description ? ` (${j.error_description})` : ''}`);
  return j;
}

/** Scambia il codice del consenso con il gettone di rinnovo; restituisce anche l'indirizzo dell'account che ha autorizzato. */
export async function exchangeCode(code: string, origin: string) {
  const j = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) });
  let email: string | null = null;
  try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString('utf8')).email ?? null; } catch { /* senza indirizzo si prosegue */ }
  return { refresh: j.refresh_token as string | undefined, access: j.access_token as string, email };
}
const accessToken = async (refresh: string) => (await tokenCall({ refresh_token: refresh, grant_type: 'refresh_token' })).access_token;

class DriveError extends Error { constructor(public status: number, msg: string) { super(msg); } }
async function g(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    let m = t.slice(0, 200); try { m = JSON.parse(t).error?.message ?? m; } catch { /* testo libero */ }
    throw new DriveError(r.status, `Drive ${r.status}: ${m}`);
  }
  return r;
}
const newId = async (token: string) => ((await (await g(token, `${API}/files/generateIds?count=1`)).json()) as { ids: string[] }).ids[0];

async function createFolder(token: string, name: string, parent: string | null, id?: string) {
  const r = await g(token, `${API}/files?fields=id`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...(id ? { id } : {}), name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }) });
  return ((await r.json()) as { id: string }).id;
}
export const createRoot = (token: string) => createFolder(token, ROOT_NAME, null);

/** Cartella per il percorso dato, creata una volta sola: la riga in drive_folders viene riservata prima della creazione
 *  con un ID generato in anticipo, così due richieste contemporanee non producono due cartelle con lo stesso nome. */
async function ensureFolder(db: SupabaseClient, token: string, org: string, root: string, parts: string[], memo: Map<string, string>) {
  let parent = root, key = '';
  for (const p of parts) {
    key = key ? `${key}/${p}` : p;
    let id = memo.get(key);
    if (!id) {
      const { data: row } = await db.from('drive_folders').select('drive_id').eq('org_id', org).eq('path_key', key).maybeSingle();
      id = row?.drive_id;
    }
    if (!id) {
      const fresh = await newId(token);
      const { data: ins } = await db.from('drive_folders').upsert({ org_id: org, path_key: key, drive_id: fresh }, { onConflict: 'org_id,path_key', ignoreDuplicates: true }).select('drive_id');
      if (ins && ins.length) {
        try { await createFolder(token, p, parent, fresh); id = fresh; }
        catch (e) {
          if (e instanceof DriveError && e.status === 409) id = fresh;      // già creata da un tentativo precedente
          else { await db.from('drive_folders').delete().eq('org_id', org).eq('path_key', key).eq('drive_id', fresh); throw e; }
        }
      } else {
        const { data: row } = await db.from('drive_folders').select('drive_id').eq('org_id', org).eq('path_key', key).maybeSingle();
        id = row?.drive_id; if (!id) throw new Error(`cartella ${key} non disponibile`);
      }
    }
    memo.set(key, id); parent = id;
  }
  return parent;
}

async function upload(token: string, id: string, name: string, parent: string, mime: string, bytes: ArrayBuffer, docId: string) {
  const start = await g(token, `${UPLOAD}?uploadType=resumable&fields=id`, { method: 'POST',
    headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': mime, 'x-upload-content-length': String(bytes.byteLength) },
    body: JSON.stringify({ id, name, parents: [parent], appProperties: { doc_id: docId }, description: 'Copia automatica da YouCount. La versione che fa fede è quella in YouCount.' }) });
  const loc = start.headers.get('location');
  if (!loc) throw new Error('Drive: indirizzo di caricamento mancante');
  await g(token, loc, { method: 'PUT', headers: { 'content-type': mime }, body: bytes });
}

type Row = { document_id: string; status: string; drive_file_id: string | null; folder_key: string | null; name: string | null; attempts: number; next_attempt_at: string };
export type SyncResult = { connected: boolean; copied: number; updated: number; failed: number; queued: number; error?: string };

/** Mette in coda ciò che manca e copia fino a `limit` file (o fino a `budgetMs`). Si può richiamare quante volte si vuole. */
export async function syncDrive(org: string, { limit = 25, budgetMs = 45_000 } = {}): Promise<SyncResult> {
  const out: SyncResult = { connected: false, copied: 0, updated: 0, failed: 0, queued: 0 };
  const db = adminClient();
  if (!db || !driveConfigured()) return out;
  const { data: link } = await db.from('drive_link').select('refresh_token, root_folder_id').eq('org_id', org).maybeSingle();
  if (!link?.refresh_token || !link.root_folder_id) return out;
  out.connected = true;
  const t0 = Date.now();
  try {
    const token = await accessToken(link.refresh_token);
    const { data: targets, error: tErr } = await db.rpc('drive_targets', { p_org: org });
    if (tErr) throw new Error(tErr.message);
    const rows = new Map<string, Row>();
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from('drive_files').select('document_id, status, drive_file_id, folder_key, name, attempts, next_attempt_at').eq('org_id', org).order('document_id').range(from, from + 999);
      (data ?? []).forEach((r) => rows.set(r.document_id, r as Row));
      if (!data || data.length < 1000) break;
    }
    const memo = new Map<string, string>();
    const now = new Date().toISOString();
    const todo: { t: DriveTarget; row: Row | undefined; key: string; name: string }[] = [];
    for (const t of (targets ?? []) as DriveTarget[]) {
      const key = folderPath(t).join('/'), name = fileName(t), row = rows.get(t.document_id);
      if (!row) todo.push({ t, row, key, name });
      else if (row.status === 'done') { if (row.folder_key !== key || row.name !== name) todo.push({ t, row, key, name }); }
      else if (row.attempts < MAX_ATTEMPTS && row.next_attempt_at <= now) todo.push({ t, row, key, name });
    }
    out.queued = todo.length;
    for (const { t, row, key, name } of todo.slice(0, limit)) {
      if (Date.now() - t0 > budgetMs) break;
      try {
        const parent = await ensureFolder(db, token, org, link.root_folder_id, folderPath(t), memo);
        if (row?.status === 'done' && row.drive_file_id) {
          // movimento o documento cambiato dopo la copia: il file viene rinominato e, se serve, spostato (mai eliminato)
          const q = new URLSearchParams({ fields: 'id' });
          if (row.folder_key !== key) {
            q.set('addParents', parent);
            const { data: old } = row.folder_key ? await db.from('drive_folders').select('drive_id').eq('org_id', org).eq('path_key', row.folder_key).maybeSingle() : { data: null };
            if (old?.drive_id) q.set('removeParents', old.drive_id);
          }
          await g(token, `${API}/files/${row.drive_file_id}?${q}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
          await db.from('drive_files').update({ folder_key: key, name, last_error: null, updated_at: new Date().toISOString() }).eq('document_id', t.document_id);
          out.updated++; continue;
        }
        let id = row?.drive_file_id ?? null;
        if (!id) {
          id = await newId(token);
          await db.from('drive_files').upsert({ document_id: t.document_id, org_id: org, status: 'queued', drive_file_id: id, folder_key: key, name }, { onConflict: 'document_id' });
        }
        const { data: blob, error: dErr } = await db.storage.from('documents').download(t.path);
        if (dErr || !blob) throw new Error(`file non leggibile dall'archivio: ${dErr?.message ?? t.path}`);
        try { await upload(token, id, name, parent, t.mime || 'application/octet-stream', await blob.arrayBuffer(), t.document_id); }
        catch (e) { if (!(e instanceof DriveError && e.status === 409)) throw e; }   // 409: un tentativo precedente era già riuscito
        await db.from('drive_files').update({ status: 'done', folder_key: key, name, last_error: null, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('document_id', t.document_id);
        out.copied++;
      } catch (e) {
        const attempts = (row?.attempts ?? 0) + 1;
        const wait = Math.min(2 ** attempts, 360) * 60_000;   // 2, 4, 8… minuti, al massimo 6 ore
        await db.from('drive_files').upsert({ document_id: t.document_id, org_id: org, status: row?.status === 'done' ? 'done' : 'failed', attempts,
          next_attempt_at: new Date(Date.now() + wait).toISOString(), last_error: String((e as Error).message).slice(0, 300), updated_at: new Date().toISOString(),
          ...(row ? {} : { folder_key: key, name }) }, { onConflict: 'document_id' });
        out.failed++;
        if (e instanceof DriveError && (e.status === 401 || e.status === 403 || e.status === 429)) throw e;   // autorizzazione o limiti: inutile insistere ora
      }
    }
    out.queued = Math.max(0, out.queued - out.copied - out.updated);
    await db.from('drive_link').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('org_id', org);
  } catch (e) {
    out.error = String((e as Error).message).slice(0, 300);
    await db.from('drive_link').update({ last_error: out.error }).eq('org_id', org);
  }
  return out;
}

/** Stato per la scheda in Impostazioni (nessun dato riservato). */
export async function driveStatus(org: string) {
  const db = adminClient();
  if (!db) return null;
  const { data: link } = await db.from('drive_link').select('google_email, root_folder_id, connected_at, last_sync_at, last_error').eq('org_id', org).maybeSingle();
  const count = async (status: string) => (await db.from('drive_files').select('document_id', { count: 'exact', head: true }).eq('org_id', org).eq('status', status)).count ?? 0;
  const [done, failed] = link ? await Promise.all([count('done'), count('failed')]) : [0, 0];
  let waiting = 0;
  if (link) { const { data } = await db.rpc('drive_targets', { p_org: org }); waiting = Math.max(0, (data?.length ?? 0) - done); }
  return { link, done, failed, waiting };
}
