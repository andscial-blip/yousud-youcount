import Link from 'next/link';
import { RESP, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { ReimburseForm, type DueRow } from '@/components/ReimburseForm';

export const dynamic = 'force-dynamic';

type Row = DueRow & { created_by: string };
type Paid = { id: string; ref: string; op_date: string; amount: string; currency: string; paid_by: string | null; reimb_batch: string;
  account: { name_it: string; name_fr: string | null } | null };

// Spese pagate di tasca propria in attesa di rimborso, per persona e valuta; ultimi rimborsi registrati.
export default async function Reimbursements({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const resp = Boolean(me && RESP.includes(me.role));
  const [{ data, error }, { data: accounts }, { data: methods }, { data: paid }] = await Promise.all([
    supabase.from('movements').select(`id, description, amount, currency, fx_rate, doc_date, op_date, paid_by, created_by,
        project:projects(name), category:categories(code), docs:movement_documents(count), no_doc_reason`)
      .eq('reimb_status', 'due').order('paid_by').order('doc_date').limit(2000).returns<Row[]>(),
    supabase.from('accounts').select('id, name_it, name_fr, currency').eq('active', true).neq('kind', 'advance').order('sort'),
    supabase.from('payment_methods').select('id, name_it, name_fr').eq('active', true).order('sort'),
    supabase.from('movements').select('id, ref, op_date, amount, currency, paid_by, reimb_batch, account:accounts!movements_account_id_fkey(name_it, name_fr)')
      .eq('reimb_status', 'paid').order('reimbursed_at', { ascending: false }).limit(60).returns<Paid[]>(),
  ]);
  const L = (o: { name_it: string; name_fr: string | null } | null) => (!o ? '–' : lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  // gruppi per persona e valuta (si rimborsa una valuta per volta)
  const groups = new Map<string, { person: string; currency: string; rows: Row[] }>();
  for (const r of data ?? []) {
    const k = `${r.paid_by ?? '–'}|${r.currency}`;
    if (!groups.has(k)) groups.set(k, { person: r.paid_by ?? '–', currency: r.currency, rows: [] });
    groups.get(k)!.rows.push(r);
  }
  // ultimi rimborsi, uno per pacchetto
  const batches = new Map<string, { date: string; person: string; currency: string; total: number; refs: { id: string; ref: string }[]; account: string }>();
  for (const p of paid ?? []) {
    const b = batches.get(p.reimb_batch) ?? { date: p.op_date, person: p.paid_by ?? '–', currency: p.currency, total: 0, refs: [], account: L(p.account) };
    b.total += Number(p.amount); b.refs.push({ id: p.id, ref: p.ref });
    if (b.person !== (p.paid_by ?? '–') && !b.person.includes('…')) b.person = `${b.person}…`;
    batches.set(p.reimb_batch, b);
  }
  const errKey = err ? (`err_${err.split(':')[0]}` as Key) : null;
  return (
    <div className="stack">
      <PageHead title={t('nav_reimb')} />
      {ok && <div className="note ok" role="status">{t('reimb_done')} {ok}</div>}
      {err && (() => {
        // messaggio tradotto per il tipo di errore + dettaglio del server (quale spesa, cosa manca)
        const known = t(errKey!) !== errKey ? t(errKey!) : null;
        const detail = err.includes(':') ? err.slice(err.indexOf(':') + 1).trim() : err;
        return <div className="note err">{known ?? detail}{known && detail && <><br /><span className="muted">{detail}</span></>}</div>;
      })()}
      <ErrorNote prefix={t('error_load')} error={error} />
      {groups.size === 0 ? <Panel pad><p className="muted" style={{ margin: 0 }}>{t('reimb_none')}</p></Panel> : [...groups.values()].map((g) => (
        <Panel key={`${g.person}|${g.currency}`} title={`${g.person} · ${money(g.rows.reduce((s, r) => s + Number(r.amount), 0), g.currency, lang)}`}>
          <ReimburseForm rows={g.rows} currency={g.currency} canPay={resp} lang={lang}
            accounts={(accounts ?? []).filter((a) => a.currency === g.currency).map((a) => ({ id: a.id, name: L(a) }))}
            methods={(methods ?? []).map((m) => ({ id: m.id, name: L(m) }))}
            labels={{ date: t('reimb_date'), when: t('date'), desc: t('description'), account: t('account'), method: t('f_method'), pay: t('reimb_pay'),
              choose: t('f_choose'), all: t('reimb_all'), no_doc: t('reimb_no_doc'), one: t('reimb_one'), many: t('reimb_selected') }} />
        </Panel>
      ))}
      {batches.size > 0 && (
        <Panel title={t('reimb_recent')}>
          <table className="t">
            <thead><tr><th>{t('date')}</th><th>{t('f_paid_by')}</th><th>{t('account')}</th><th className="r">{t('amount')}</th><th>{t('ref')}</th></tr></thead>
            <tbody>
              {[...batches.values()].map((b) => (
                <tr key={b.refs.map((r) => r.id).join()}>
                  <td className="num">{b.date.split('-').reverse().join('/')}</td><td>{b.person}</td><td>{b.account}</td>
                  <td className="r num nw">{money(b.total, b.currency, lang)}</td>
                  <td className="muted">{b.refs.map((r, i) => <span key={r.id}>{i > 0 && ', '}<Link href={`/movimenti/${r.id}`}>{r.ref}</Link></span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
