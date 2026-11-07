import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { date, KIND_LABEL, money, STATUS_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Movimenti' };

type Row = {
  id: string; ref: string | null; op_date: string; kind: keyof typeof KIND_LABEL; status: keyof typeof STATUS_LABEL;
  description: string; amount: string; currency: string; sign: number; reverses_id: string | null;
  account: { name_it: string } | null; category: { code: string; name_it: string } | null;
  project: { name: string } | null;
};

const FILTERS = [
  { v: '', l: 'Tutti' }, { v: 'draft', l: 'Bozze' }, { v: 'recorded', l: 'Da verificare' }, { v: 'verified', l: 'Verificati' },
];

export default async function Movements({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const { stato = '' } = await searchParams;
  const { supabase } = await requireMe();
  let q = supabase
    .from('movements')
    .select(`id, ref, op_date, kind, status, description, amount, currency, sign, reverses_id,
             account:accounts!movements_account_id_fkey(name_it), category:categories(code, name_it),
             project:projects(name)`)
    .order('op_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (['draft', 'recorded', 'verified'].includes(stato)) q = q.eq('status', stato);
  const { data, error } = await q.returns<Row[]>();

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22 }}>Movimenti</h1>
        <div className="spacer" />
        {FILTERS.map((f) => (
          <Link key={f.v} href={f.v ? `/movimenti?stato=${f.v}` : '/movimenti'}
                className={`btn ${stato === f.v ? 'primary' : ''}`}>{f.l}</Link>
        ))}
      </div>
      {error && <div className="note err">Movimenti non disponibili: {error.message}</div>}
      <section className="panel" style={{ overflowX: 'auto' }}>
        {(data ?? []).length === 0 ? (
          <div className="panel-b muted">Nessun movimento.</div>
        ) : (
          <table className="t">
            <thead>
              <tr><th>Data</th><th>Rif.</th><th>Descrizione</th><th>Codice</th><th>Progetto</th><th>Conto</th>
                <th className="r">Importo</th><th>Stato</th></tr>
            </thead>
            <tbody>
              {data!.map((m) => {
                const signed = Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1);
                return (
                  <tr key={m.id}>
                    <td className="num">{date(m.op_date)}</td>
                    <td className="num muted">{m.ref ?? '–'}</td>
                    <td>{m.description || <span className="muted">{KIND_LABEL[m.kind]}</span>}
                      {m.reverses_id && <> <span className="chip">storno</span></>}</td>
                    <td className="muted">{m.category?.code ?? '–'}</td>
                    <td>{m.project?.name ?? '–'}</td>
                    <td>{m.account?.name_it}</td>
                    <td className="r num">{m.kind === 'transfer' ? money(m.amount, m.currency) : money(signed, m.currency)}</td>
                    <td><span className={`chip ${m.status === 'verified' ? 'ok' : m.status === 'recorded' ? 'warn' : ''}`}>
                      {STATUS_LABEL[m.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
