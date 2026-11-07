import { requireMe } from '@/lib/session';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type Cp = { id: string; name: string; kind: 'supplier' | 'donor' | 'beneficiary' | 'staff' | 'other';
            vat_number: string | null; country: string | null; active: boolean };

// Elenco senza dati personali: codice fiscale, contatti e IBAN stanno in una tabella separata
// visibile solo a responsabili e amministratori.
export default async function Counterparties() {
  const { supabase, t } = await requireMe();
  const { data, error } = await supabase.from('counterparties')
    .select('id, name, kind, vat_number, country, active').order('name').limit(1000).returns<Cp[]>();
  return (
    <div className="stack">
      <PageHead title={t('nav_counterparties')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('name')}</th><th>{t('type')}</th><th>P.IVA / NIF</th><th>{t('country')}</th></tr></thead>
            <tbody>
              {data!.map((c) => (
                <tr key={c.id} style={c.active ? undefined : { opacity: .6 }}>
                  <td>{c.name}</td><td>{t(`cp_kind_${c.kind}`)}</td>
                  <td className="num">{c.vat_number ?? '–'}</td><td>{c.country ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
