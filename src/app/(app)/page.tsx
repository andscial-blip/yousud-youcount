import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { ErrorNote, PageHead, Panel, Empty } from '@/components/Page';
import { BalancesTable, type Balance } from '@/components/Balances';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const { supabase, me, t, lang } = await requireMe();
  const [{ data, error }, { count: toVerify }, { count: drafts }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('created_by', me!.id),
  ]);
  const rows = (data ?? []) as Balance[];
  const total = (cur: string) => rows.filter((r) => r.currency === cur && r.kind !== 'advance')
    .reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="stack">
      <PageHead title={t('nav_dashboard')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <section className="kpis">
        <div className="kpi"><span className="l">{t('dash_it')}</span>
          <span className="v num">{money(total('EUR'), 'EUR', lang)}</span><span className="s">{t('dash_it_s')}</span></div>
        <div className="kpi"><span className="l">{t('dash_mg')}</span>
          <span className="v num">{money(total('MGA'), 'MGA', lang)}</span><span className="s">{t('dash_mg_s')}</span></div>
        <Link className="kpi" href="/movimenti?stato=recorded" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="l">{t('nav_verify')}</span><span className="v num">{toVerify ?? 0}</span>
          <span className="s">{t('dash_verify_s')}</span></Link>
        <Link className="kpi" href="/movimenti?stato=draft" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="l">{t('dash_drafts')}</span><span className="v num">{drafts ?? 0}</span>
          <span className="s">{t('dash_drafts_s')}</span></Link>
      </section>
      <Panel title={t('balances')}>
        {rows.length === 0 ? <Empty text={t('none')} /> : <BalancesTable rows={rows} t={t} lang={lang} />}
      </Panel>
      <p className="muted" style={{ margin: 0 }}>{t('balances_note')}</p>
    </div>
  );
}
