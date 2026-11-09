import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Controlli comuni alle funzioni AI: utente attivo, AI attivata dall'amministratore (impostazione ai_reading,
// la stessa della lettura dei documenti: i dati vanno al servizio AI solo dopo l'accordo sul trattamento), chiave sul server.
export async function aiGate(opts: { write?: boolean } = {}) {
  const supabase = await createClient();
  const { data: cl } = await supabase.auth.getClaims();
  const sub = cl?.claims?.sub;
  if (!sub) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) } as const;
  const { data: me } = await supabase.from('profiles').select('id, role, active, lang, full_name').eq('id', sub).maybeSingle();
  if (!me?.active || (opts.write && me.role === 'read_only')) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) } as const;
  const { data: setting } = await supabase.from('settings').select('value').eq('key', 'ai_reading').maybeSingle();
  if (setting?.value !== true) return { error: NextResponse.json({ error: 'ai_disabled' }, { status: 403 }) } as const;
  const mock = process.env.AI_MOCK === '1';
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!mock && !apiKey) return { error: NextResponse.json({ error: 'ai_not_configured' }, { status: 503 }) } as const;
  return { supabase, me, mock, apiKey } as const;
}
