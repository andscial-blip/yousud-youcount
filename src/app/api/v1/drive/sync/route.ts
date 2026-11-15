import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { syncDrive } from '@/lib/drive';

// Copia su Drive ciò che manca. GET: chiamata programmata (Vercel Cron, con CRON_SECRET) per tutti gli enti collegati.
// POST: «Sincronizza ora» di un amministratore, per il proprio ente.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '', got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: 'non configurato' }, { status: 503 });
  const { data: links } = await db.from('drive_link').select('org_id');
  const out = [];
  for (const l of links ?? []) { const r = await syncDrive(l.org_id, { limit: 40, budgetMs: 45_000 / Math.max(1, (links ?? []).length) }); out.push({ copied: r.copied, updated: r.updated, failed: r.failed, queued: r.queued, error: r.error ?? null }); }
  return NextResponse.json({ ok: true, results: out });
}

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/admin/impostazioni?${q}#drive`, 303);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origin}/login`, 303);
  const { data: me } = await supabase.from('profiles').select('org_id, role, active').eq('id', auth.user.id).maybeSingle();
  if (!me?.active || !['super_admin', 'admin'].includes(me.role)) return back('drive=denied');
  const r = await syncDrive(me.org_id, { limit: 40, budgetMs: 45_000 });
  return back(r.error ? 'drive=syncerr' : `drive=synced&dc=${r.copied}&du=${r.updated}&df=${r.failed}&dq=${r.queued}`);
}
