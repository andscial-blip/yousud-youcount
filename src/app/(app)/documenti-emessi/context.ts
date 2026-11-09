import 'server-only';
import { loadOrg } from '@/lib/org';

type Sb = { from: (t: string) => any };   // eslint-disable-line @typescript-eslint/no-explicit-any

// Dati che servono all'anteprima live del modulo: ente (con logo), tassi mensili, firmatario.
export async function docFormContext(sb: Sb) {
  const [org, { data: fx }, { data: sig }] = await Promise.all([
    loadOrg(sb),
    sb.from('fx_rates').select('year, month, rate'),
    sb.from('settings').select('value').eq('key', 'doc_signer').maybeSingle(),
  ]);
  const { id: _id, ...o } = org;
  const rates = Object.fromEntries(((fx ?? []) as { year: number; month: number; rate: string }[]).map((r) => [`${r.year}-${String(r.month).padStart(2, '0')}`, Number(r.rate)]));
  return { org: o, rates, signer: ((sig as { value?: { name?: string; role?: string } } | null)?.value ?? {}) as { name?: string; role?: string } };
}
