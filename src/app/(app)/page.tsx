import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { ErrorNote, PageHead, Panel, Empty } from '@/components/Page';
import { BalancesTable, type Balance } from '@/components/Balances';
import { HBars, MonthBars } from '@/components/Charts';
import { Ico, Place } from '@/components/Ui';

export const dynamic = 'force-dynamic';

type L = { month: number; kind: string; amount_eur: string | null; project_id: string | null; project_name: string | null };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ anno?: string; pw?: string }> }) {
  const { anno, pw } = await searchParams;
  const year = Number(anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  const isAdmin = ['super_admin', 'admin'].includes(me!.role);
  const [{ data, error }, { count: toVerify }, { count: drafts }, { data: ledger }, { data: lastBackup }, { count: dueCount }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'draft').eq('created_by', me!.id).is('reimb_status', null),
    supabase.from('v_ledger').select('month, kind, amount_eur, project_id, project_name').eq('year', year).neq('kind', 'transfer')
      .limit(50000).returns<L[]>(),
    isAdmin ? supabase.from('settings').select('value').eq('key', 'last_backup').maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('reimb_status', 'due'),
  ]);
  // piano gratuito di Supabase senza backup automatici: promemoria settimanale per gli amministratori
  const backupAt = (lastBackup?.value as { at?: string } | null)?.at;
  const backupDays = backupAt ? Math.floor((Date.now() - new Date(backupAt).getTime()) / 86400000) : null;
  const backupDue = isAdmin && (backupDays === null || backupDays >= 7);
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
  // autonomia di cassa (solo staff): liquidità meno rimborsi dovuti, divisa per la spesa media degli ultimi 3 mesi chiusi
  const staff = can(me, STAFF);
  const now = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cfFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const cfTo = new Date(now.getFullYear(), now.getMonth(), 0);
  const [{ data: rate }, { data: spent3 }, { data: dueRows }] = staff ? await Promise.all([
    supabase.rpc('fx_rate_for', { p_date: ymd(now) }),
    supabase.from('v_ledger').select('amount_eur').eq('kind', 'expense').gte('op_date', ymd(cfFrom)).lte('op_date', ymd(cfTo)).limit(50000),
    supabase.from('movements').select('amount, currency, amount_eur').eq('reimb_status', 'due').limit(5000),
  ]) : [{ data: null }, { data: null }, { data: null }];
  const fx = rate ? Number(rate) : null;
  const projects = [...byProject.values()].filter((p) => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const rows = (data ?? []) as Balance[];
  const total = (cur: string) => rows.filter((r) => r.currency === cur && r.kind !== 'advance')
    .reduce((s, r) => s + Number(r.balance), 0);
  const toEur = (v: number, cur: string) => (cur === 'EUR' ? v : fx ? v / fx : 0);
  const liq = total('EUR') + toEur(total('MGA'), 'MGA');
  const due = (dueRows ?? []).reduce((s, d) => s + (d.amount_eur !== null ? Number(d.amount_eur) : toEur(Number(d.amount), d.currency)), 0);
  const burn = (spent3 ?? []).reduce((s, l) => s + Number(l.amount_eur ?? 0), 0) / 3;
  const runway = burn > 0 ? (liq - due) / burn : null;
  const mon = (d: Date) => d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'short', year: 'numeric' });

  return (
    <div className="stack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <PageHead title={t('nav_dashboard')} lead={<img className="org-logo" src="/brand/yousud-logo-512.png" alt="YouSud" width={64} height={64} />}>
        <div className="seg">
          <Link href={`/?anno=${year - 1}`}>{year - 1}</Link>
          <Link href={`/?anno=${year}`} aria-current="true">{year}</Link>
          <Link href={`/?anno=${year + 1}`}>{year + 1}</Link>
        </div>
      </PageHead>
      {pw === 'ok' && <div className="note ok" role="status">{t('pw_done')}</div>}
      {(Boolean(dueCount) || backupDue) && (
        <section className="todo" aria-label={t('todo_title')}>
          <h2>{t('todo_title')}</h2>
          <ul>
            {Boolean(dueCount) && <li><Ico name="wallet" /><Link href="/rimborsi">{dueCount} {t(dueCount === 1 ? 'dash_reimb_one' : 'dash_reimb')}</Link></li>}
            {backupDue && <li><Ico name="download" /><span>{backupDays === null ? t('bk_never') : t('bk_due').replace('{n}', String(backupDays))}{' '}
              <Link href="/admin/impostazioni">{t('bk_go')}</Link></span></li>}
          </ul>
        </section>
      )}
      <ErrorNote prefix={t('error_load')} error={error} />
      <section className="kpis">
        <div className="kpi it"><span className="kh"><span className="ki"><Ico name="wallet" size={18} /></span><span className="l">{t('dash_it')}</span> <Place loc="IT" label={t('italy')} /></span>
          <span className={`v num ${total('EUR') < 0 ? 'neg' : ''}`}>{money(total('EUR'), 'EUR', lang)}</span><span className="s">{t('dash_it_s')}</span></div>
        <div className="kpi mg"><span className="kh"><span className="ki"><Ico name="wallet" size={18} /></span><span className="l">{t('dash_mg')}</span> <Place loc="MG" label={t('madagascar')} /></span>
          <span className={`v num ${total('MGA') < 0 ? 'neg' : ''}`}>{money(total('MGA'), 'MGA', lang)}</span><span className="s">{t('dash_mg_s')}</span></div>
        <Link className="kpi todo" href={me!.role === 'operator' ? '/movimenti?stato=recorded' : '/verifica'} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="go"><Ico name="chevron" /></span>
          <span className="kh"><span className="ki"><Ico name="clock" size={18} /></span><span className="l">{t('nav_verify')}</span></span>
          <span className={`v num ${toVerify ? '' : 'zero'}`}>{toVerify ?? 0}</span><span className="s">{t('dash_verify_s')}</span></Link>
        <Link className="kpi mine" href="/movimenti?stato=draft" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="go"><Ico name="chevron" /></span>
          <span className="kh"><span className="ki"><Ico name="draft" size={18} /></span><span className="l">{t('dash_drafts')}</span></span>
          <span className={`v num ${drafts ? '' : 'zero'}`}>{drafts ?? 0}</span><span className="s">{t('dash_drafts_s')}</span></Link>
      </section>
      <div className="grid2">
        <Panel title={`${t('dash_chart')} · ${year}`} pad>
          <MonthBars data={months} lang={lang} labels={{ in: t('legend_in'), out: t('legend_out') }}
            hrefFor={(m) => `/movimenti?dal=${year}-${String(m).padStart(2, '0')}-01&al=${year}-${String(m).padStart(2, '0')}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`} />
        </Panel>
        <Panel title={`${t('dash_by_project')} · ${year}`} pad>
          {projects.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t('none')}</p> : <HBars rows={projects} lang={lang} />}
        </Panel>
      </div>
      {staff && (
        <Panel title={t('cf_title')}>
          <div className="figs">
            <div><span>{t('cf_liq')}</span><b className="num">{money(liq, 'EUR', lang)}</b></div>
            <div><span>{t('cf_due')}</span><b className="num">{due ? `−${money(due, 'EUR', lang)}` : money(0, 'EUR', lang)}</b></div>
            <div><span>{t('cf_burn')}</span><b className="num">{money(burn, 'EUR', lang)}</b></div>
            <div className={runway === null ? '' : runway < 3 ? 'bad' : 'ok'}><span>{t('cf_runway')}</span>
              <b className="num">{runway === null ? '–' : new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { maximumFractionDigits: 1 }).format(runway)}</b></div>
          </div>
          <p className="panel-b muted" style={{ margin: 0, fontSize: 13 }}>
            {fx ? t('cf_note').replace('{rate}', `${money(fx, 'MGA', lang).replace(/\s?MGA$/, '')} MGA/EUR`)
              .replace('{from}', mon(cfFrom)).replace('{to}', mon(cfTo)) : t('cf_norate')}</p>
        </Panel>
      )}
      <Panel title={t('balances')}>
        {rows.length === 0 ? <Empty text={t('none')} /> : <BalancesTable rows={rows} t={t} lang={lang} />}
      </Panel>
      <p className="muted" style={{ margin: 0 }}>{t('balances_note')}</p>
    </div>
  );
}
