import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requireMe, RESP, STAFF } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, PageHead, Panel } from '@/components/Page';
import { BudgetTable, type BudgetRow } from '@/components/Budget';

export const dynamic = 'force-dynamic';

export default async function ProjectDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ anno?: string; ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const year = Number(sp.anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  const { data: p } = await supabase.from('projects').select('id, name, kind, start_date, end_date').eq('id', id).maybeSingle();
  if (!p) notFound();
  const staff = can(me, STAFF);
  const [{ data: budget }, { data: moves }, { data: grants }] = await Promise.all([
    staff ? supabase.rpc('budget_vs_actual', { p_project: id, p_year: year, p_grant: null }) : Promise.resolve({ data: [] }),
    supabase.from('movements').select('id, ref, op_date, kind, description, amount, currency, sign, status')
      .eq('project_id', id).gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`)
      .order('op_date', { ascending: false }).limit(30),
    supabase.from('grants').select('id, title, code, status').eq('project_id', id).order('title'),
  ]);
  const back = `/progetti/${id}?anno=${year}`;
  return (
    <div className="stack">
      <Link href={`/progetti?anno=${year}`} className="muted" style={{ textDecoration: 'none' }}>← {t('nav_projects')}</Link>
      <PageHead title={`${p.name} · ${year}`}>
        <div className="seg">
          <Link href={`/progetti/${id}?anno=${year - 1}`}>{year - 1}</Link>
          <Link href={`/progetti/${id}?anno=${year}`} aria-current="true">{year}</Link>
          <Link href={`/progetti/${id}?anno=${year + 1}`}>{year + 1}</Link>
        </div>
      </PageHead>
      {sp.ok === 'budget' && <div className="note ok" role="status">{t('b_saved')}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      {staff && (
        <Panel title={t('b_title')} pad>
          <BudgetTable rows={(budget ?? []) as BudgetRow[]} t={t} lang={lang}
                       edit={can(me, RESP) ? { scope: 'project', id, year, back } : undefined} />
        </Panel>
      )}
      <div className="grid2">
        <Panel title={t('prj_recent')}>
          {(moves ?? []).length === 0 ? <Empty text={t('none')} /> : (
            <table className="t"><tbody>
              {moves!.map((m) => (
                <tr key={m.id}>
                  <td className="num nw">{date(m.op_date)}</td>
                  <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind as 'income'}`)}</Link></td>
                  <td className="r num nw">{money(Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1), m.currency, lang)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
        <Panel title={t('prj_grants')}>
          {(grants ?? []).length === 0 ? <Empty text={t('none')} /> : (
            <table className="t"><tbody>
              {grants!.map((g) => (
                <tr key={g.id}>
                  <td><Link className="rowlink" href={`/finanziamenti/${g.id}`}>{g.title}</Link> {g.code && <span className="muted">· {g.code}</span>}</td>
                  <td className="r"><span className={`chip ${g.status === 'active' ? 'ok' : ''}`}>{g.status === 'active' ? t('g_active') : t('g_closed')}</span></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
      </div>
    </div>
  );
}
