import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requireMe, RESP, STAFF } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, Panel } from '@/components/Page';
import { BudgetTable, type BudgetRow } from '@/components/Budget';

export const dynamic = 'force-dynamic';

export default async function GrantDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const { data: g } = await supabase.from('grants')
    .select('id, title, code, currency, amount, start_date, end_date, status, notes, donor:counterparties(name), project:projects(id, name)')
    .eq('id', id).maybeSingle();
  if (!g) notFound();
  const staff = can(me, STAFF);
  const [{ data: budget }, { data: moves }, { data: totals }] = await Promise.all([
    staff ? supabase.rpc('budget_vs_actual', { p_project: null, p_year: null, p_grant: id }) : Promise.resolve({ data: [] }),
    supabase.from('movements').select('id, op_date, kind, description, amount, currency, sign').eq('grant_id', id)
      .neq('status', 'draft').order('op_date', { ascending: false }).limit(50),
    supabase.from('movements').select('kind, amount_eur, sign').eq('grant_id', id).neq('status', 'draft').limit(50000),
  ]);
  const sumK = (k: string) => (totals ?? []).filter((m) => m.kind === k).reduce((s, m) => s + Number(m.amount_eur ?? 0) * m.sign, 0);
  const received = sumK('income'), spentEur = sumK('expense');
  const granted = g.currency === 'EUR' && g.amount ? Number(g.amount) : null;
  const donor = g.donor as unknown as { name: string } | null;
  const project = g.project as unknown as { id: string; name: string } | null;
  return (
    <div className="stack">
      <Link href="/finanziamenti" className="muted" style={{ textDecoration: 'none' }}>← {t('nav_grants')}</Link>
      <div className="h1row"><h1>{g.title}</h1>
        <span className={`chip ${g.status === 'active' ? 'ok' : ''}`}>{g.status === 'active' ? t('g_active') : t('g_closed')}</span></div>
      {sp.ok === 'budget' && <div className="note ok" role="status">{t('b_saved')}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      <section className="panel">
        <div className="figs">
          <div><span>{t('g_amount')}</span><b className="num">{g.amount ? money(g.amount, g.currency, lang) : '–'}</b></div>
          <div><span>{t('g_received')}</span><b className="num">{money(received, 'EUR', lang)}</b></div>
          <div><span>{t('g_spent')}</span><b className="num">{money(spentEur, 'EUR', lang)}</b></div>
          <div className={granted === null ? '' : granted - spentEur < 0 ? 'bad' : 'ok'}><span>{t('g_left')}</span>
            <b className="num">{granted === null ? '–' : money(granted - spentEur, 'EUR', lang)}</b></div>
        </div>
      </section>
      <Panel pad>
        <dl className="kv">
          <dt>{t('g_code')}</dt><dd>{g.code ?? '–'}</dd>
          <dt>{t('g_donor')}</dt><dd>{donor?.name ?? '–'}</dd>
          <dt>{t('project')}</dt><dd>{project ? <Link href={`/progetti/${project.id}`}>{project.name}</Link> : t('g_none_project')}</dd>
          <dt>{t('g_period')}</dt><dd>{g.start_date ? `${date(g.start_date)} – ${date(g.end_date)}` : '–'}</dd>
          <dt>{t('g_amount')}</dt><dd>{g.amount ? money(g.amount, g.currency, lang) : '–'}</dd>
          {g.notes && <><dt>{t('f_notes')}</dt><dd>{g.notes}</dd></>}
        </dl>
      </Panel>
      {staff && (
        <Panel title={t('gr_title')} pad>
          <p className="muted" style={{ marginTop: 0 }}>{t('gr_text')}</p>
          <form className="gr-form" method="get" action="/api/v1/export/finanziamento">
            <input type="hidden" name="id" value={g.id} />
            <label className="field"><span className="flabel">{t('gr_from')}</span>
              <input className="input" type="date" name="dal" defaultValue={g.start_date ?? ''} /></label>
            <label className="field"><span className="flabel">{t('gr_to')}</span>
              <input className="input" type="date" name="al" defaultValue={g.end_date ?? ''} /></label>
            <button className="btn primary" type="submit">{t('gr_download')}</button>
          </form>
        </Panel>
      )}
      {staff && (
        <Panel title={t('b_title')} pad>
          <BudgetTable rows={(budget ?? []) as BudgetRow[]} t={t} lang={lang}
                       edit={can(me, RESP) ? { scope: 'grant', id, back: `/finanziamenti/${id}` } : undefined} />
        </Panel>
      )}
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
    </div>
  );
}
