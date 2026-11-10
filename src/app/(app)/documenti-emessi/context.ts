import 'server-only';
import { loadOrg } from '@/lib/org';

type Sb = { from: (t: string) => any };   // eslint-disable-line @typescript-eslint/no-explicit-any

// Dati che servono all'anteprima live del modulo: ente (con logo), tassi mensili, firmatario.
export async function docFormContext(sb: Sb) {
  const [org, { data: fx }, { data: sig }, { data: pp }, { data: cps }, { data: adv }] = await Promise.all([
    loadOrg(sb),
    sb.from('fx_rates').select('year, month, rate'),
    sb.from('settings').select('value').eq('key', 'doc_signer').maybeSingle(),
    sb.from('profiles').select('full_name').eq('active', true),
    sb.from('counterparties').select('name').eq('active', true).limit(2000),
    sb.from('accounts').select('holder').eq('kind', 'advance').eq('active', true),
  ]);
  // Nomi suggeriti per «a chi» (utenti, persone con anticipo, controparti): si sceglie dalla lista o si scrive un nome nuovo.
  const names = [...new Set([...((pp ?? []) as { full_name: string | null }[]).map((r) => r.full_name), ...((adv ?? []) as { holder: string | null }[]).map((r) => r.holder),
    ...((cps ?? []) as { name: string | null }[]).map((r) => r.name)].filter((n): n is string => Boolean(n && n.trim())))].sort((a, b) => a.localeCompare(b, 'it'));
  const { id: _id, ...o } = org;
  const rates = Object.fromEntries(((fx ?? []) as { year: number; month: number; rate: string }[]).map((r) => [`${r.year}-${String(r.month).padStart(2, '0')}`, Number(r.rate)]));
  return { org: o, rates, people: names, signer: ((sig as { value?: { name?: string; role?: string } } | null)?.value ?? {}) as { name?: string; role?: string } };
}
