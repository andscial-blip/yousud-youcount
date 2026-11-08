import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { BalancesTable, type Balance } from '@/components/Balances';
import { CashCounter } from '@/components/CashCounter';

export const dynamic = 'force-dynamic';

type CC = { id: string; count_date: string; counted: string; system_balance: string; difference: string; notes: string | null;
            counted_by: string; account: { name_it: string; name_fr: string; currency: string } | null };

export default async function Accounts({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const [{ data, error }, { data: counts }, { data: users }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('cash_counts').select('id, count_date, counted, system_balance, difference, notes, counted_by, account:accounts(name_it, name_fr, currency)')
      .order('count_date', { ascending: false }).order('created_at', { ascending: false }).limit(20).returns<CC[]>(),
    supabase.rpc('user_directory'),
  ]);
  const rows = (data ?? []) as Balance[];
  const cash = rows.filter((r) => r.kind === 'cash');
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  return (
    <div className="stack">
      <PageHead title={t('nav_accounts')}>
        {can(me, STAFF) && <Link className="btn" href="/riconciliazione"><Ico name="check" />{t('nav_rec')}</Link>}
      </PageHead>
      <ErrorNote prefix={t('error_load')} error={error} />
      {ok === 'cash' && <div className="note ok" role="status">{t('cc_ok')}</div>}
      {err && <div className="note err">{err}</div>}
      {(['IT', 'MG'] as const).map((loc) => (
        <Panel key={loc} title={loc === 'IT' ? t('italy') : t('madagascar')}>
          {rows.filter((r) => r.location === loc).length === 0 ? <Empty text={t('none')} /> :
            <BalancesTable rows={rows.filter((r) => r.location === loc)} t={t} lang={lang} detail />}
        </Panel>
      ))}
      <p className="muted" style={{ margin: 0 }}>{t('balances_note')}</p>

      <Panel title={t('cc_title')} pad>
        <div className="stack" style={{ gap: 14 }}>
          <p className="muted" style={{ margin: 0 }}>{t('cc_intro')}</p>
          {me?.role !== 'read_only' && cash.length > 0 && (
            <CashCounter lang={lang} accounts={cash.map((c) => ({ id: c.account_id, label: nm(lang, c), currency: c.currency, balance: Number(c.balance) }))}
              L={{ account: t('account'), date: t('date'), den: t('cc_den'), qty: t('cc_qty'), total: t('cc_total'), counted: t('cc_counted'),
                expected: t('cc_expected'), diff: t('cc_diff'), notes: t('f_notes'), save: t('cc_save'), manual: t('cc_manual'), hint: t('cc_hint') }} />
          )}
          {(counts ?? []).length > 0 && (
            <table className="t">
              <thead><tr><th>{t('date')}</th><th>{t('account')}</th><th className="r">{t('cc_counted')}</th>
                <th className="r hm">{t('cc_system')}</th><th className="r">{t('cc_diff')}</th><th className="hm">{t('cc_by')}</th></tr></thead>
              <tbody>
                {counts!.map((c) => {
                  const cur = c.account?.currency ?? 'EUR';
                  const d = Number(c.difference);
                  return (
                    <tr key={c.id}>
                      <td className="num nw">{date(c.count_date)}</td><td>{nm(lang, c.account)}</td>
                      <td className="r num">{money(c.counted, cur, lang)}</td>
                      <td className="r num hm">{money(c.system_balance, cur, lang)}</td>
                      <td className="r num" style={{ color: d === 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{d > 0 ? '+' : ''}{money(d, cur, lang)}</td>
                      <td className="hm">{name.get(c.counted_by) ?? '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
