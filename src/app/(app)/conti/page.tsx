import { requireMe } from '@/lib/session';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { BalancesTable, type Balance } from '@/components/Balances';

export const dynamic = 'force-dynamic';

export default async function Accounts() {
  const { supabase, t, lang } = await requireMe();
  const { data, error } = await supabase.rpc('account_balances');
  const rows = (data ?? []) as Balance[];
  return (
    <div className="stack">
      <PageHead title={t('nav_accounts')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      {(['IT', 'MG'] as const).map((loc) => (
        <Panel key={loc} title={loc === 'IT' ? t('italy') : t('madagascar')}>
          {rows.filter((r) => r.location === loc).length === 0 ? <Empty text={t('none')} /> :
            <BalancesTable rows={rows.filter((r) => r.location === loc)} t={t} lang={lang} detail />}
        </Panel>
      ))}
      <p className="muted" style={{ margin: 0 }}>{t('balances_note')}</p>
    </div>
  );
}
