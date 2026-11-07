import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Balance = {
  account_id: string; code: string; name_it: string; currency: 'EUR' | 'MGA'; kind: string; location: string;
  balance: string; unverified: number;
};

export default async function Dashboard() {
  const { supabase, me } = await requireMe();
  const [{ data: balances, error }, { count: toVerify }, { count: drafts }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('created_by', me!.id),
  ]);
  const rows = (balances ?? []) as Balance[];
  const total = (cur: string) => rows.filter((r) => r.currency === cur && r.kind !== 'advance')
    .reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="stack">
      <h1 style={{ fontSize: 22 }}>Cruscotto</h1>
      {error && <div className="note err">Saldi non disponibili: {error.message}</div>}
      <section className="kpis" aria-label="Indicatori">
        <div className="kpi"><span className="l">Liquidità in Italia</span><span className="v num">{money(total('EUR'), 'EUR')}</span>
          <span className="s">banca, cassa e conti online in EUR</span></div>
        <div className="kpi"><span className="l">Liquidità in Madagascar</span><span className="v num">{money(total('MGA'), 'MGA')}</span>
          <span className="s">banca, cassa e mobile money in MGA</span></div>
        <Link className="kpi" href="/movimenti?stato=recorded" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="l">Da verificare</span><span className="v num">{toVerify ?? 0}</span>
          <span className="s">movimenti registrati non ancora verificati</span></Link>
        <Link className="kpi" href="/movimenti?stato=draft" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="l">Le mie bozze</span><span className="v num">{drafts ?? 0}</span>
          <span className="s">da completare e registrare</span></Link>
      </section>

      <section className="panel">
        <div className="panel-h"><h2>Saldi dei conti</h2></div>
        {rows.length === 0 ? (
          <div className="panel-b muted">Nessun conto visibile.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="t">
              <thead><tr><th>Conto</th><th>Luogo</th><th className="r">Saldo</th><th className="r">Da verificare</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.account_id}>
                    <td>{r.name_it}</td>
                    <td className="muted">{r.location === 'IT' ? 'Italia' : 'Madagascar'}</td>
                    <td className="r num">{money(r.balance, r.currency)}</td>
                    <td className="r num">{r.unverified > 0 ? <span className="chip warn">{r.unverified}</span> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="muted" style={{ margin: 0 }}>
        I saldi comprendono i movimenti registrati e verificati; gli storni sono già sottratti.
      </p>
    </div>
  );
}
