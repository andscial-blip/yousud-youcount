import Link from 'next/link';
import { can, requireMe, STAFF } from '@/lib/session';
import { money } from '@/lib/format';
import type { Lang, T } from '@/lib/i18n';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

type Line = {
  direction: 'in' | 'out'; section: string; section_it: string; section_fr: string; key: string;
  name_it: string; name_fr: string; amount_eur: string; amount_eur_prev: string; rows_count: number; missing_rate: number;
};

export default async function Report({ searchParams }: { searchParams: Promise<{ anno?: string; modello?: string }> }) {
  const { anno, modello } = await searchParams;
  const modelE = modello === 'E';
  const year = Number(anno) || new Date().getFullYear();
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, STAFF)) return <Denied text={t('only_staff')} />;
  const [{ data, error }, { data: unclassified }, { data: labels }, { data: fees }] = await Promise.all([
    supabase.rpc('report_cash_statement', { p_year: year }),
    supabase.rpc('report_unclassified', { p_year: year }),
    supabase.from('report_lines').select('direction, key, section_fr, name_fr'),
    supabase.rpc('member_fees', { p_year: year }),
  ]);
  const q = (y: number, m = modelE) => `/rendiconto?anno=${y}${m ? '&modello=E' : ''}`;
  const fr = new Map((labels ?? []).map((l) => [`${l.direction}/${l.key}`, l]));
  const lines = ((data ?? []) as Line[]).map((l) => ({ ...l, ...(fr.get(`${l.direction}/${l.key}`) ?? {}) }));
  const sections = (dir: 'in' | 'out') =>
    Object.values(lines.filter((l) => l.direction === dir).reduce<Record<string, Line[]>>((acc, l) => {
      (acc[l.section] ||= []).push(l);
      return acc;
    }, {}));
  const tot = (dir: 'in' | 'out', prev = false) =>
    lines.filter((l) => l.direction === dir).reduce((s, l) => s + Number(prev ? l.amount_eur_prev : l.amount_eur), 0);
  const missing = lines.reduce((s, l) => s + l.missing_rate, 0);

  return (
    <div className="stack">
      <PageHead title={`${t('rep_title')} ${year}`}>
        <div className="seg noprint">
          <Link href={q(year - 1)}>{year - 1}</Link>
          <Link href={q(year)} aria-pressed>{year}</Link>
          <Link href={q(year + 1)}>{year + 1}</Link>
        </div>
      </PageHead>
      <div className="h1row noprint" style={{ gap: 8 }}>
        <div className="seg">
          <Link href={q(year, false)} aria-pressed={!modelE}>{t('rep_modelD')}</Link>
          <Link href={q(year, true)} aria-pressed={modelE}>{t('rep_modelE')}</Link>
        </div>
        <div className="spacer" />
        <a className="btn" href={`/api/v1/export/rendiconto?anno=${year}`}>{t('rep_xlsx')}</a>
        <PrintButton label={t('rep_print')} />
      </div>
      <div className="note">{t('rep_draft')}</div>
      <ErrorNote prefix={t('error_load')} error={error} />
      {missing > 0 && <div className="note err">{missing} {t('rep_missing_rate')}</div>}
      {(unclassified ?? []).length > 0 && <div className="note err">{unclassified!.length} {t('rep_unclassified')}</div>}
      {(['out', 'in'] as const).map((dir) => (
        <section className="panel" key={dir} style={{ overflowX: 'auto' }}>
          <div className="panel-h"><h2>{dir === 'out' ? t('out') : t('in')}</h2></div>
          <table className="t">
            <thead><tr><th>{t('rep_item')}</th><th className="r">{year}</th><th className="r">{year - 1}</th></tr></thead>
            <tbody>
              {sections(dir).map((sec) => <SectionRows key={sec[0].section} sec={sec} lang={lang} aggregated={modelE} />)}
              <tr>
                <td style={{ fontWeight: 700 }}>{dir === 'out' ? t('rep_total_out') : t('rep_total_in')}</td>
                <td className="r num" style={{ fontWeight: 700 }}>{money(tot(dir), 'EUR', lang)}</td>
                <td className="r num" style={{ fontWeight: 700 }}>{money(tot(dir, true), 'EUR', lang)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
      <Result t={t} lang={lang} year={year} value={tot('in') - tot('out')} />
      {(fees ?? []).length > 0 && (
        <Panel title={`${t('fees_title')} ${year}`}>
          <table className="t">
            <thead><tr><th>{t('fees_member')}</th><th className="r">{t('fees_payments')}</th><th className="hm">{t('fees_last')}</th><th className="r">{t('amount')}</th></tr></thead>
            <tbody>
              {(fees as { counterparty_id: string; name: string; amount_eur: string; payments: number; last_date: string }[]).map((f) => (
                <tr key={f.counterparty_id}><td>{f.name}</td><td className="r num">{f.payments}</td>
                  <td className="hm num">{f.last_date.split('-').reverse().join('/')}</td><td className="r num">{money(f.amount_eur, 'EUR', lang)}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function Result({ t, lang, year, value }: { t: T; lang: Lang; year: number; value: number }) {
  return (
    <section className="kpis">
      <div className="kpi"><span className="l">{t('rep_result')} {year}</span>
        <span className="v num">{money(value, 'EUR', lang)}</span><span className="s">{t('rep_result_s')}</span></div>
    </section>
  );
}

function SectionRows({ sec, lang, aggregated }: { sec: Line[]; lang: Lang; aggregated: boolean }) {
  const sum = (k: 'amount_eur' | 'amount_eur_prev') => sec.reduce((s, l) => s + Number(l[k]), 0);
  const L = (it: string, fr?: string) => (lang === 'fr' && fr ? fr : it);
  return (
    <>
      <tr style={{ background: 'var(--surface-2)' }}>
        <td style={{ fontFamily: 'var(--f-ui)', fontWeight: 700 }}>{L(sec[0].section_it, sec[0].section_fr)}</td>
        <td className="r num" style={{ fontWeight: 600 }}>{money(sum('amount_eur'), 'EUR', lang)}</td>
        <td className="r num" style={{ fontWeight: 600 }}>{money(sum('amount_eur_prev'), 'EUR', lang)}</td>
      </tr>
      {!aggregated && sec.map((l) => (
        <tr key={l.key}>
          <td style={{ paddingLeft: 22 }}>{L(l.name_it, l.name_fr)}</td>
          <td className="r num">{Number(l.amount_eur) ? money(l.amount_eur, 'EUR', lang) : '–'}</td>
          <td className="r num muted">{Number(l.amount_eur_prev) ? money(l.amount_eur_prev, 'EUR', lang) : '–'}</td>
        </tr>
      ))}
    </>
  );
}
