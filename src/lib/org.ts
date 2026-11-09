import type { Org } from './doc-model';

type Sb = { from: (t: string) => any };   // eslint-disable-line @typescript-eslint/no-explicit-any

export const LOGO_MAX = 32000;   // caratteri base64: sta in una cella del backup Excel (limite 32.767)

// Dati dell'ente per i documenti: nome, indirizzo, codice fiscale, IBAN, logo (impostazioni dell'amministratore).
export async function loadOrg(sb: Sb): Promise<Org & { id: string }> {
  const [{ data: org }, { data: set }] = await Promise.all([
    sb.from('organizations').select('id, name').single(),
    sb.from('settings').select('key, value').in('key', ['org_details', 'org_logo']),
  ]);
  const get = (k: string) => ((set ?? []) as { key: string; value: unknown }[]).find((s) => s.key === k)?.value;
  const od = (get('org_details') ?? {}) as { legal_name?: string; address?: string; tax_id?: string; iban?: string; runts?: string; email?: string; phone?: string; web?: string };
  const lg = get('org_logo') as { mime?: string; data?: string } | undefined;
  const logo = lg?.data && (lg.mime === 'image/png' || lg.mime === 'image/jpeg') && lg.data.length <= LOGO_MAX ? { mime: lg.mime as 'image/png' | 'image/jpeg', data: lg.data } : null;
  return { id: org?.id ?? '', name: od.legal_name || org?.name || 'YouSud ODV', address: od.address, tax_id: od.tax_id, iban: od.iban, runts: od.runts,
    email: od.email, phone: od.phone, web: od.web, logo };
}
