import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { DocIndicator, EmptyState, Ico, KindIcon, StatusChip } from '@/components/Ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string | null; op_date: string; kind: 'income' | 'expense' | 'transfer';
  status: 'draft' | 'recorded' | 'verified'; description: string; amount: string; currency: string; sign: number;
  reverses_id: string | null; no_doc_reason: string | null; docs: { count: number }[]; reimb_status: 'due' | 'paid' | null; paid_by: string | null;
  account: { name_it: string; name_fr: string } | null; category: { code: string } | null;
  project: { name: string } | null;
};

const PAGE = 100;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isId = (v: string) => /^[0-9a-f-]{36}$/.test(v);

type SP = { stato?: string; q?: string; progetto?: string; conto?: string; dal?: string; al?: string; p?: string };

export default async function Movements({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const stato = sp.stato ?? '';
  // ricerca per descrizione o numero MOV: tolti i caratteri che hanno un significato nei filtri del database
  const term = (sp.q ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);
  const prj = isId(sp.progetto ?? '') ? sp.progetto! : '';
  const acc = isId(sp.conto ?? '') ? sp.conto! : '';
  const from = isDate(sp.dal ?? '') ? sp.dal! : '';
  const to = isDate(sp.al ?? '') ? sp.al! : '';
  const page = Math.max(1, Math.min(1000, Number(sp.p) || 1));
  const { supabase, t, lang } = await requireMe();
  let q = supabase
    .from('movements')
    .select(`id, ref, op_date, kind, status, description, amount, currency, sign, reverses_id, no_doc_reason, reimb_status, paid_by, docs:movement_documents(count),
             account:accounts!movements_account_id_fkey(name_it, name_fr), category:categories(code), project:projects(name)`, { count: 'exact' })
    .order('op_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (['draft', 'recorded', 'verified'].includes(stato)) q = q.eq('status', stato);
  if (stato === 'nodoc') q = q.not('no_doc_reason', 'is', null);
  if (term) q = q.or(`description.ilike.%${term}%,ref.ilike.%${term}%`);
  if (prj) q = q.eq('project_id', prj);
  if (acc) q = q.or(`account_id.eq.${acc},to_account_id.eq.${acc}`);
  if (from) q = q.gte('op_date', from);
  if (to) q = q.lte('op_date', to);
  const [{ data, error, count }, { data: projects }, { data: accounts }] = await Promise.all([
    q.returns<Row[]>(),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('accounts').select('id, name_it, name_fr').order('sort'),
  ]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const filters = [['', t('all')], ['draft', t('drafts')], ['recorded', t('st_recorded')], ['verified', t('verified')], ['nodoc', t('f_nodoc_filter')]];
  // un indirizzo con tutti i filtri attivi: si può salvare o mandare a un collega
  const href = (over: Partial<SP>) => {
    const v = { stato, q: term, progetto: prj, conto: acc, dal: from, al: to, p: '', ...over };
    const u = new URLSearchParams();
    for (const [k, x] of Object.entries(v)) if (x) u.set(k, String(x));
    const s = u.toString();
    return s ? `/movimenti?${s}` : '/movimenti';
  };
  const active = [prj, acc, from, to].filter(Boolean).length;

  return (
    <div className="stack">
      <PageHead title={t('nav_movements')}>
        <a className="btn" href={`/api/v1/export/movimenti?anno=${(from || to || String(new Date().getFullYear())).slice(0, 4)}${stato ? `&stato=${stato}` : ''}`}><Ico name="download" />{t('exp_xlsx')}</a>
        <div className="seg scroll">
          {filters.map(([v, l]) => (
            <Link key={v} href={href({ stato: v })} aria-current={(stato === v) ? 'true' : undefined}>{l}</Link>
          ))}
        </div>
      </PageHead>
      <form className="filters" method="get" action="/movimenti" role="search">
        {stato && <input type="hidden" name="stato" value={stato} />}
        <div className="search">
          <Ico name="search" />
          <input className="input" type="search" name="q" defaultValue={term} placeholder={t('search_mov')} aria-label={t('search_mov')} />
        </div>
        <details className="more" open={active > 0}>
          <summary className="btn ghost">{t('f_more_filters')}{active > 0 ? ` · ${active}` : ''}</summary>
          <div className="filter-grid">
            <label className="field"><span className="flabel">{t('project')}</span>
              <select className="input" name="progetto" defaultValue={prj}><option value="">{t('all')}</option>
                {(projects ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="field"><span className="flabel">{t('account')}</span>
              <select className="input" name="conto" defaultValue={acc}><option value="">{t('all')}</option>
                {(accounts ?? []).map((x) => <option key={x.id} value={x.id}>{nm(lang, x)}</option>)}</select></label>
            <label className="field"><span className="flabel">{t('gr_from')}</span>
              <input className="input" type="date" name="dal" defaultValue={from} /></label>
            <label className="field"><span className="flabel">{t('gr_to')}</span>
              <input className="input" type="date" name="al" defaultValue={to} /></label>
          </div>
        </details>
        <button className="btn primary" type="submit">{t('f_apply')}</button>
        {(term || active > 0) && <Link className="btn ghost" href={stato ? `/movimenti?stato=${stato}` : '/movimenti'}>{t('search_clear')}</Link>}
      </form>
      {total > 0 && <p className="muted" style={{ margin: 0 }} aria-live="polite">
        {t('f_count').replace('{n}', total.toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT'))}{pages > 1 ? ` · ${t('f_page')} ${page}/${pages}` : ''}</p>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 && (term || stato || active > 0 || page > 1) ? <p className="panel-b muted" style={{ margin: 0 }}>{t('empty_search')}</p>
          : (data ?? []).length === 0 ? <EmptyState title={t('empty_mov')} text={t('empty_mov_t')} badge="plus"
            action={<Link className="btn primary" href="/nuovo"><Ico name="plus" />{t('nav_new_long').replace('+ ', '')}</Link>} /> : (
          <table className="t">
            <thead>
              <tr><th style={{ width: 36 }}><span className="sr-only">{t('type')}</span></th><th className="hm">{t('date')}</th><th className="hm">{t('ref')}</th><th>{t('description')}</th><th className="hm">{t('code')}</th>
                <th className="hm">{t('project')}</th><th className="hm">{t('account')}</th><th className="r">{t('amount')}</th><th className="hm" style={{ width: 32 }}><span className="sr-only">{t('f_doc')}</span></th><th className="hm">{t('status')}</th></tr>
            </thead>
            <tbody>
              {data!.map((m) => {
                const signed = Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1);
                return (
                  <tr key={m.id}>
                    <td><KindIcon kind={m.kind} label={t(`k_${m.kind}`)} faded={Boolean(m.reverses_id)} /></td>
                    <td className="num hm">{date(m.op_date)}</td>
                    <td className="num muted hm nw">{m.ref ?? '–'}</td>
                    <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind}`)}</Link>
                      {m.reverses_id && <> <span className="chip">{t('reversal')}</span></>}
                      {m.reimb_status === 'due' && <div className="tagline"><span className="chip warn wrap">{t('reimb_due_chip')}{m.paid_by ? ` · ${m.paid_by}` : ''}</span></div>}
                      <div className="so muted">{[date(m.op_date), m.ref, m.category?.code, m.project?.name, nm(lang, m.account)].filter(Boolean).join(' · ')}</div>
                      <div className="so"><StatusChip s={m.status} label={t(`st_${m.status}`)} /></div></td>
                    <td className="muted hm">{m.category?.code ?? '–'}</td>
                    <td className="hm">{m.project?.name ?? '–'}</td>
                    <td className="hm">{nm(lang, m.account)}</td>
                    <td className={`r num nw ${m.kind === 'income' ? 'amt-in' : m.kind === 'transfer' ? 'amt-tr' : ''}`}>
                      {m.kind === 'transfer' ? money(m.amount, m.currency, lang) : `${signed > 0 ? '+' : ''}${money(signed, m.currency, lang)}`}</td>
                    <td className="hm">{m.kind !== 'transfer' && <DocIndicator count={m.docs?.[0]?.count ?? 0} noDocReason={m.no_doc_reason}
                      labels={{ has: t('doc_has'), missing: t('doc_missing'), none: t('doc_none') }} />}</td>
                    <td className="hm"><StatusChip s={m.status} label={t(`st_${m.status}`)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {pages > 1 && (
        <nav className="pager" aria-label={t('f_pages')}>
          {page > 1 ? <Link className="btn" href={href({ p: String(page - 1) })} rel="prev">← {t('f_prev')}</Link> : <span />}
          <span className="muted num">{page} / {pages}</span>
          {page < pages ? <Link className="btn" href={href({ p: String(page + 1) })} rel="next">{t('f_next')} →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

