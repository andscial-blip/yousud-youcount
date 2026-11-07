import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { ErrorNote, PageHead, Panel, Empty } from '@/components/Page';
import { BalancesTable, type Balance } from '@/components/Balances';
import { HBars, MonthBars } from '@/components/Charts';

export const dynamic = 'force-dynamic';

type L = { month: number; kind: string; amount_eur: string | null; project_id: string | null; project_name: string | null };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ anno?: string }> }) {
  const { anno } = await searchParams;
  const year = Number(anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  const [{ data, error }, { count: toVerify }, { count: drafts }, { data: ledger }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('created_by', me!.id),
    supabase.from('v_ledger').select('month, kind, amount_eur, project_id, project_name').eq('year', year).neq('kind', 'transfer')
      .limit(50000).returns<L[]>(),
  ]);
  const months = Array.from({ length: 12 }, () => ({ inc: 0, out: 0 }));
  const byProject = new Map<string, { label: string; value: number; href: string }>();
  for (const l of ledger ?? []) {
    const v = Number(l.amount_eur ?? 0);
    if (l.kind === 'income') months[l.month - 1].inc += v;
    else {
      months[l.month - 1].out += v;
      if (l.project_id) {
        const p = byProject.get(l.project_id) ?? { label: l.project_name ?? '–', value: 0, href: `/progetti/${l.project_id}?anno=${year}` };
        p.value += v;
        byProject.set(l.project_id, p);
      }
    }
  }
  const projects = [...byProject.values()].filter((p) => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const rows = (data ?? []) as Balance[];
  const total = (cur: string) => rows.filter((r) => r.currency === cur && r.kind !== 'advance')
    .reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="stack">
      <PageHead title={t('nav_dashboard')}>
        <div className="seg">
          <Link href={`/?anno=${year - 1}`}>{year - 1}</Link>
          <Link href={`/?anno=${year}`} aria-pressed>{year}</Link>
          <Link href={`/?anno=${year + 1}`}>{year + 1}</Link>
        </div>
      </PageHead>
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
      <div className="grid2">
        <Panel title={`${t('dash_chart')} · ${year}`} pad>
          <MonthBars data={months} lang={lang} labels={{ in: t('legend_in'), out: t('legend_out') }} />
        </Panel>
        <Panel title={`${t('dash_by_project')} · ${year}`} pad>
          {projects.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : <HBars rows={projects} lang={lang} />}
        </Panel>
      </div>
      <Panel title={t('balances')}>
        {rows.length === 0 ? <Empty text={t('none')} /> : <BalancesTable rows={rows} t={t} lang={lang} />}
      </Panel>
      <p className="muted" style={{ margin: 0 }}>{t('balances_note')}</p>
    </div>
  );
}
