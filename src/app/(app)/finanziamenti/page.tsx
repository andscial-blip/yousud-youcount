import Link from 'next/link';
import { can, requireMe, RESP } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, ErrorNote, PageHead, Panel, H2 } from '@/components/Page';
import { createGrant } from './actions';

export const dynamic = 'force-dynamic';

type G = { id: string; title: string; code: string | null; currency: string; amount: string | null; start_date: string | null;
           end_date: string | null; status: string; donor: { name: string } | null; project: { name: string } | null };

export default async function Grants({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const [{ data, error }, { data: donors }, { data: projects }, { data: moves }] = await Promise.all([
    supabase.from('grants').select('id, title, code, currency, amount, start_date, end_date, status, donor:counterparties(name), project:projects(name)')
      .order('status').order('start_date', { ascending: false }).returns<G[]>(),
    supabase.from('counterparties').select('id, name').in('kind', ['donor', 'other']).order('name'),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('movements').select('grant_id, kind, amount_eur, sign').not('grant_id', 'is', null).neq('status', 'draft').limit(50000),
  ]);
  // speso per finanziamento (EUR, storni sottratti): avanzamento rispetto all'importo concesso
  const spent = new Map<string, number>();
  for (const m of moves ?? []) if (m.kind === 'expense') spent.set(m.grant_id!, (spent.get(m.grant_id!) ?? 0) + Number(m.amount_eur ?? 0) * m.sign);
  return (
    <div className="stack">
      <PageHead title={t('nav_grants')} />
      {err && <div className="note err">{err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('g_title')}</th><th className="hm">{t('g_donor')}</th><th className="hm">{t('project')}</th>
              <th className="hm">{t('g_period')}</th><th className="r">{t('g_amount')}</th><th className="r">{t('g_spent')}</th><th /></tr></thead>
            <tbody>
              {data!.map((g) => (
                <tr key={g.id}>
                  <td><Link className="rowlink" href={`/finanziamenti/${g.id}`}>{g.title}</Link>{g.code && <span className="muted"> · {g.code}</span>}</td>
                  <td className="hm">{g.donor?.name ?? <span className="muted">{t('g_no_donor')}</span>}</td><td className="hm">{g.project?.name ?? t('g_none_project')}</td>
                  <td className="hm num nw">{g.start_date ? `${date(g.start_date)} – ${date(g.end_date)}` : '–'}</td>
                  <td className="r num nw">{g.amount ? money(g.amount, g.currency, lang) : '–'}</td>
                  <td className="r num nw">{money(spent.get(g.id) ?? 0, 'EUR', lang)}
                    {g.currency === 'EUR' && Number(g.amount) > 0 && (() => {
                      const pct = Math.round((spent.get(g.id) ?? 0) / Number(g.amount) * 100);
                      return <span className="meter-row" title={`${pct}%`}><span className={`meter ${pct > 100 ? 'over' : ''}`}><i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></span><span className="muted">{pct}%</span></span>;
                    })()}</td>
                  <td><span className={`chip ${g.status === 'active' ? 'ok' : ''}`}>{g.status === 'active' ? t('g_active') : t('g_closed')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {can(me, RESP) && (
        <details className="panel">
          <summary className="panel-h" style={{ cursor: 'pointer' }}><H2 text={t('g_new')} /></summary>
          <form action={createGrant} className="panel-b fgrid">
            <div className="field span2"><label htmlFor="title">{t('g_title')}</label><input className="input" id="title" name="title" required minLength={2} /></div>
            <div className="field"><label htmlFor="code">{t('g_code')}</label><input className="input" id="code" name="code" /></div>
            <div className="field"><label htmlFor="donor_id">{t('g_donor')}</label>
              <select className="input" id="donor_id" name="donor_id"><option value="">{t('f_cp_none')}</option>
                {(donors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="field"><label htmlFor="project_id">{t('project')}</label>
              <select className="input" id="project_id" name="project_id"><option value="">{t('g_none_project')}</option>
                {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="amount">{t('g_amount')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input num" id="amount" name="amount" inputMode="decimal" />
                <select className="input" name="currency" aria-label={t('currency')} style={{ width: 100 }}><option>EUR</option><option>MGA</option></select>
              </div></div>
            <div className="field"><label htmlFor="start_date">{t('g_start')}</label><input className="input" type="date" id="start_date" name="start_date" /></div>
            <div className="field"><label htmlFor="end_date">{t('g_end')}</label><input className="input" type="date" id="end_date" name="end_date" /></div>
            <div className="field span2"><label htmlFor="notes">{t('f_notes')}</label><textarea className="input" id="notes" name="notes" rows={2} /></div>
            <div className="span2"><button className="btn primary" type="submit">{t('g_save')}</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
