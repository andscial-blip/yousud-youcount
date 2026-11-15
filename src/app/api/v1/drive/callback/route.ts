import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { createRoot, driveConfigured, exchangeCode } from '@/lib/drive';

// Ritorno da Google dopo il consenso: salva l'autorizzazione (solo lato server) e crea la cartella dell'archivio.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin, sp = req.nextUrl.searchParams;
  const back = (q: string) => { const r = NextResponse.redirect(`${origin}/admin/impostazioni?${q}#drive`); r.cookies.delete({ name: 'yc_drive_state', path: '/api/v1/drive' }); return r; };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origin}/login`);
  const { data: me } = await supabase.from('profiles').select('id, org_id, role, active').eq('id', auth.user.id).maybeSingle();
  if (!me?.active || !['super_admin', 'admin'].includes(me.role)) return back('drive=denied');
  const db = adminClient();
  if (!db || !driveConfigured()) return back('drive=noconf');
  const state = req.cookies.get('yc_drive_state')?.value;
  if (!state || state !== sp.get('state')) return back('drive=state');
  if (sp.get('error') || !sp.get('code')) return back('drive=refused');
  try {
    const tk = await exchangeCode(String(sp.get('code')), origin);
    if (!tk.refresh) return back('drive=norefresh');
    const { data: old } = await db.from('drive_link').select('root_folder_id').eq('org_id', me.org_id).maybeSingle();
    const root = old?.root_folder_id ?? await createRoot(tk.access);
    const { error } = await db.from('drive_link').upsert({ org_id: me.org_id, google_email: tk.email, refresh_token: tk.refresh, root_folder_id: root,
      connected_by: me.id, connected_at: new Date().toISOString(), last_error: null }, { onConflict: 'org_id' });
    if (error) throw new Error(error.message);
    return back('drive=ok');
  } catch (e) {
    console.error('drive callback', (e as Error).message);
    return back('drive=error');
  }
}
