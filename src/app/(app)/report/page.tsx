import Link from 'next/link';
import { STAFF, can, requireMe } from '@/lib/session';
import { date, money, num } from '@/lib/format';
import { buildReport, REPORTS, type Cell, type ReportKind, type Table } from '@/lib/reports';
import { HBars, MonthBars } from '@/components/Charts';

const TOPN = 8;
import { Denied, PageHead, H2 } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';
import { Ico } from '@/components/Ui';

export const dynamic = 'force-dynamic';

// Report contabili dell'anno, stampabili (PDF dal browser) ed esportabili in Excel con gli stessi numeri.
export default async function Reports({ searchParams }: { searchParams: Promise<{ tipo?: string; anno?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.anno) || new Date().getFullYear();
  const kind = (REPORTS.find((r) => r.k === sp.tipo)?.k ?? 'mensile') as ReportKind;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  let tables: Table[] = [], err = '';
  try { tables = await buildReport(supabase, kind, year, lang); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  const fmt = (c: Cell) => c.v == null || c.v === '' ? '' : c.t === 'eur' ? money(c.v, 'EUR', lang) : c.t === 'cur' ? money(c.v, c.cur ?? 'EUR', lang)
    : c.t === 'int' ? num(Number(c.v), lang) : c.t === 'date' ? date(String(c.v)) : String(c.v);
  const cls = (c: Cell, num?: boolean) => [num ? 'r num' : '', typeof c.v === 'number' && c.v < 0 && (c.t === 'eur' || c.t === 'cur') ? 'neg' : ''].join(' ').trim();
  const q = (k: string, y: number) => `/report?tipo=${k}&anno=${y}`;
  return (
    <div className="stack">
      <PageHead title={`${L('Report', 'Rapports')} ${year}`}>
        <a className="btn" href={`/api/v1/export/report?tipo=${kind}&anno=${year}`}><Ico name="download" />Excel</a>
        <PrintButton label={L('Stampa / PDF', 'Imprimer / PDF')} />
      </PageHead>
      <nav className="segs noprint" aria-label={L('Tipo di report', 'Type de rapport')}>
        {REPORTS.map((r) => <Link key={r.k} href={q(r.k, year)} aria-selected={r.k === kind}>{L(r.it, r.fr)}</Link>)}
        <Link href={`/rendiconto?anno=${year}`}>{L('Rendiconto ETS', 'Compte ETS')}</Link>
        <Link href={`/analisi?anno=${year}&vista=budget`}>{L('Preventivo e consuntivo', 'Budget et réalisé')}</Link>
      </nav>
      {err && <div className="note err">{t('error_load')}: {err}</div>}
      {tables.map((tb, i) => (
        <section className="panel" key={i}>
          <div className="panel-h"><H2 text={tb.title} /></div>
          {tb.chart && tb.rows.length > 0 && (
            <div className="panel-b rchart">
              {tb.chart.kind === 'months'
                ? <MonthBars data={tb.chart.data} lang={lang} labels={{ in: L('Entrate', 'Recettes'), out: L('Uscite', 'Dépenses') }} />
                : <>
                    <HBars rows={tb.chart.rows} lang={lang} many />
                    {tb.chart.more > 0 && <p className="hint" style={{ margin: '6px 0 0' }}>{L(`Le ${TOPN} voci più alte; altre ${tb.chart.more} nella tabella.`, `Les ${TOPN} postes les plus élevés ; ${tb.chart.more} autres dans le tableau.`)}</p>}
                  </>}
            </div>
          )}
          {tb.rows.length === 0 ? <div className="panel-b muted">{L('Nessun dato.', 'Aucune donnée.')}</div> : (
            <div className="tscroll">
              <table className="t">
                <thead><tr>{tb.head.map((h, j) => <th key={j} className={h.num ? 'r' : ''}>{h.h}</th>)}</tr></thead>
                <tbody>{tb.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className={cls(c, tb.head[k]?.num)}>{c.href ? <Link href={c.href}>{fmt(c)}</Link> : fmt(c)}</td>)}</tr>)}</tbody>
                {tb.foot && <tfoot><tr>{tb.foot.map((c, k) => <td key={k} className={cls(c, tb.head[k]?.num)}><b>{fmt(c)}</b></td>)}</tr></tfoot>}
              </table>
            </div>
          )}
          {tb.note && <p className="hint panel-b" style={{ margin: 0 }}>{tb.note}</p>}
        </section>
      ))}
    </div>
  );
}
