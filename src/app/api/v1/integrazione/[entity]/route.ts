import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env';

// API di sola lettura per le app collegate (il futuro gestionale centrale). Contratto in docs/API.md.
// GET /api/v1/integrazione/movements?since=<ISO>&after=<uuid>&limit=500   ·   Authorization: Bearer yc_…
// Nessuna chiave privilegiata: il controllo della chiave e dei permessi è nel database (api_read).
export const dynamic = 'force-dynamic';

const ENTITIES = new Set(['movements', 'documents', 'accounts', 'categories', 'projects', 'grants', 'counterparties']);
const STATUS: Record<string, number> = { unauthorized: 401, forbidden: 403, invalid: 400 };

export async function GET(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!ENTITIES.has(entity)) return NextResponse.json({ error: 'invalid', detail: 'entità sconosciuta', entities: [...ENTITIES] }, { status: 404 });
  const key = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!key) return NextResponse.json({ error: 'unauthorized', detail: 'manca la chiave (Authorization: Bearer …)' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const since = sp.get('since');
  const after = sp.get('after');
  if (since && Number.isNaN(Date.parse(since))) return NextResponse.json({ error: 'invalid', detail: 'since non è una data ISO' }, { status: 400 });
  if (after && !/^[0-9a-f-]{36}$/i.test(after)) return NextResponse.json({ error: 'invalid', detail: 'after non è un uuid' }, { status: 400 });
  const limit = Math.min(1000, Math.max(1, Number(sp.get('limit')) || 500));
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('api_read', { p_key: key, p_entity: entity, p_since: since, p_after: after, p_limit: limit });
  if (error) {
    const code = error.message.split(':')[0].trim();
    return NextResponse.json({ error: code, detail: error.message.slice(code.length + 1).trim() }, { status: STATUS[code] ?? 500 });
  }
  return NextResponse.json({ api_version: 1, ...data }, { headers: { 'cache-control': 'no-store' } });
}
