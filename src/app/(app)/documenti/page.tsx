import { requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Documenti' };

type Doc = { id: string; doc_type: string; doc_date: string | null; doc_number: string | null; total: string | null;
             currency: string | null; created_at: string };

const TYPE: Record<string, string> = {
  invoice: 'Fattura', receipt: 'Ricevuta', till_receipt: 'Scontrino', self_cert: 'Autocertificazione',
  bank_statement: 'Estratto conto', contract: 'Contratto', other: 'Altro',
};

export default async function Documents() {
  const { supabase } = await requireMe();
  const { data, error } = await supabase.from('documents')
    .select('id, doc_type, doc_date, doc_number, total, currency, created_at')
    .order('created_at', { ascending: false }).limit(100).returns<Doc[]>();
  return (
    <div className="stack">
      <h1 style={{ fontSize: 22 }}>Documenti</h1>
      {error && <div className="note err">Archivio non disponibile: {error.message}</div>}
      <section className="panel" style={{ overflowX: 'auto' }}>
        {(data ?? []).length === 0 ? <div className="panel-b muted">Nessun documento.</div> : (
          <table className="t">
            <thead><tr><th>Caricato</th><th>Tipo</th><th>Numero</th><th>Data</th><th className="r">Totale</th></tr></thead>
            <tbody>
              {data!.map((d) => (
                <tr key={d.id}>
                  <td className="num">{date(d.created_at)}</td><td>{TYPE[d.doc_type] ?? d.doc_type}</td>
                  <td>{d.doc_number ?? '–'}</td><td className="num">{date(d.doc_date)}</td>
                  <td className="r num">{d.total && d.currency ? money(d.total, d.currency) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
