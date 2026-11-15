import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { consentUrl, driveConfigured } from '@/lib/drive';

// Avvia il collegamento con Google Drive: solo un amministratore, che poi autorizza di persona sulla pagina di Google.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/admin/impostazioni?${q}#drive`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origin}/login`);
  const { data: me } = await supabase.from('profiles').select('role, active').eq('id', auth.user.id).maybeSingle();
  if (!me?.active || !['super_admin', 'admin'].includes(me.role)) return back('drive=denied');
  if (!driveConfigured()) return back('drive=noconf');
  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(consentUrl(origin, state));
  res.cookies.set('yc_drive_state', state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/api/v1/drive' });
  return res;
}
