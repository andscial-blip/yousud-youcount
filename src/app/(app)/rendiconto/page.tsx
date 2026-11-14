import Link from 'next/link';
import { can, requireMe, STAFF } from '@/lib/session';
import { money } from '@/lib/format';
import type { Lang, T } from '@/lib/i18n';
import { Denied, ErrorNote, PageHead, Panel, H2 } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';
import { Ico } from '@/components/Ui';
import { ArchiveStatement } from '@/components/ArchiveStatement';
import { ADMIN } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Line = {
  direction: 'in' | 'out'; section: string; section_it: string; section_fr: string; key: string;
  name_it: string; name_fr: string; amount_eur: string; amount_eur_prev: string; rows_count: number; missing_rate: number;
};

export default async function Report({ searchParams }: { searchParams: Promise<{ anno?: string; modello?: string; compatto?: string }> }) {
  const { anno, modello, compatto } = await searchParams;
  const compact = compatto === '1';
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
  // versioni approvate e firmate (archivio), con link di download di breve durata
  type Arc = { id: string; year: number; kind: string; approved_on: string; approval_ref: string; notes: string | null; doc: { original_path: string; file_name: string | null } | null };
  const { data: arcRaw } = await supabase.from('statement_archive').select('id, year, kind, approved_on, approval_ref, notes, doc:documents(original_path, file_name)')
    .order('year', { ascending: false }).order('approved_on', { ascending: false }).returns<Arc[]>();
  const arc = await Promise.all((arcRaw ?? []).map(async (a) => ({ ...a,
    url: a.doc ? (await supabase.storage.from('documents').createSignedUrl(a.doc.original_path, 600, { download: `Rendiconto_${a.year}_approvato.pdf` })).data?.signedUrl ?? null : null,
    view: a.doc ? (await supabase.storage.from('documents').createSignedUrl(a.doc.original_path, 600)).data?.signedUrl ?? null : null })));
  const KIND: Record<string, [string, string]> = { cash: ['Rendiconto per cassa', 'Compte de caisse'], model_e: ['Rendiconto aggregato (Mod. E)', 'Compte agrégé (Mod. E)'],
    social: ['Bilancio sociale', 'Bilan social'], other: ['Altro atto', 'Autre acte'] };
  const LL = (k: [string, string]) => (lang === 'fr' ? k[1] : k[0]);
  const q = (y: number, m = modelE, c = compact) => `/rendiconto?anno=${y}${m ? '&modello=E' : ''}${c ? '&compatto=1' : ''}`;
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
      </PageHead>
      <div className="h1row noprint" style={{ gap: 8 }}>
        <div className="seg">
          <Link href={q(year, false)} aria-current={(!modelE) ? 'true' : undefined}>{t('rep_modelD')}</Link>
          <Link href={q(year, true)} aria-current={(modelE) ? 'true' : undefined}>{t('rep_modelE')}</Link>
        </div>
        {!modelE && <div className="seg">
          <Link href={q(year, false, false)} aria-current={!compact ? 'true' : undefined}>{t('rep_all_lines')}</Link>
          <Link href={q(year, false, true)} aria-current={compact ? 'true' : undefined}>{t('rep_compact')}</Link>
        </div>}
        <div className="spacer" />
        <a className="btn" href={`/api/v1/export/rendiconto?anno=${year}`}><Ico name="download" />{t('rep_xlsx')}</a>
        <PrintButton label={t('rep_print')} />
      </div>
      <section className="panel noprint">
        <div className="panel-h"><H2 icon="stamp" text={lang === 'fr' ? 'Versions approuvées et signées' : 'Versioni approvate e firmate'} />
          <div className="spacer" />{can(me, ADMIN) && <ArchiveStatement orgId={me!.org_id} year={year - (new Date().getMonth() < 6 ? 1 : 0)} lang={lang} />}</div>
        {arc.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{lang === 'fr'
          ? 'Aucune version archivée. Après l’approbation par l’assemblée, archivez ici le PDF signé : il reste avec ses références.'
          : 'Nessuna versione archiviata. Dopo l’approvazione in assemblea, archivia qui il PDF firmato: resta con i suoi estremi.'}</p> : (
          <ul className="arch-list">{arc.map((a) => (
            <li key={a.id}><span className="ar-y num">{a.year}</span>
              <div className="ar-b"><b>{LL(KIND[a.kind] ?? KIND.other!)}</b><span className="muted small">{lang === 'fr' ? 'approuvé le' : 'approvato il'} {a.approved_on.split('-').reverse().join('/')} · {a.approval_ref}{a.notes ? ` · ${a.notes}` : ''}</span></div>
              <div className="ar-a">{a.view && <a className="btn small ghost" href={a.view} target="_blank" rel="noopener">{lang === 'fr' ? 'Aperçu' : 'Anteprima'}</a>}
                {a.url && <a className="btn small" href={a.url}><Ico name="download" />{lang === 'fr' ? 'Télécharger' : 'Scarica'}</a>}</div></li>))}</ul>
        )}
      </section>
      <div className="note">{t('rep_draft')}</div>
      <ErrorNote prefix={t('error_load')} error={error} />
      {missing > 0 && <div className="note err">{missing} {t('rep_missing_rate')}</div>}
      {(unclassified ?? []).length > 0 && (() => {
        // l'avviso dice quanto pesa: senza l'importo, l'avanzo di questa pagina e quello della Dashboard non si spiegano
        const rows = unclassified as { id: string; ref: string | null; category_code: string | null; amount_eur: string | number }[];
        const tot = rows.reduce((x, r) => x + Math.abs(Number(r.amount_eur) || 0), 0);
        const codes = [...new Set(rows.map((r) => r.category_code).filter(Boolean))];
        return (
          <details className="note err rep-unc">
            <summary><b>{rows.length} {t('rep_unclassified')}</b> {lang === 'fr'
              ? `Ils valent ${money(tot, 'EUR', lang)} et ne figurent pas dans ce compte rendu : les totaux et le résultat ci-dessous sont incomplets tant qu’ils ne sont pas reclassés.`
              : `Valgono ${money(tot, 'EUR', lang)} e non entrano in questo rendiconto: i totali e l’avanzo qui sotto sono incompleti finché non li riclassifichi.`}
              {codes.length > 0 && <> {lang === 'fr' ? 'Codes' : 'Codici'}: {codes.join(', ')}.</>} <span className="rep-unc-open">{lang === 'fr' ? 'Voir les mouvements' : 'Vedi i movimenti'}</span></summary>
            <ul>{rows.slice(0, 50).map((r) => <li key={r.id}><Link href={`/movimenti/${r.id}`}>{r.ref ?? '–'}</Link> · {r.category_code ?? '–'} · <span className="num">{money(Number(r.amount_eur), 'EUR', lang)}</span></li>)}
              {rows.length > 50 && <li>…</li>}</ul>
          </details>);
      })()}
      {(['out', 'in'] as const).map((dir) => (
        <section className="panel" key={dir} style={{ overflowX: 'auto' }}>
          <div className="panel-h"><H2 text={dir === 'out' ? t('out') : t('in')} /></div>
          <table className="t keep">
            <thead><tr><th>{t('rep_item')}</th><th className="r">{year}</th><th className="r">{year - 1}</th></tr></thead>
            <tbody>
              {sections(dir).map((sec) => <SectionRows key={sec[0].section} sec={sec} lang={lang} aggregated={modelE} compact={compact} />)}
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
          <table className="t keep">
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

function SectionRows({ sec, lang, aggregated, compact = false }: { sec: Line[]; lang: Lang; aggregated: boolean; compact?: boolean }) {
  const sum = (k: 'amount_eur' | 'amount_eur_prev') => sec.reduce((s, l) => s + Number(l[k]), 0);
  const L = (it: string, fr?: string) => (lang === 'fr' && fr ? fr : it);
  return (
    <>
      <tr style={{ background: 'var(--surface-2)' }}>
        <td style={{ fontFamily: 'var(--f-ui)', fontWeight: 700 }}>{L(sec[0].section_it, sec[0].section_fr)}</td>
        <td className="r num" style={{ fontWeight: 600 }}>{money(sum('amount_eur'), 'EUR', lang)}</td>
        <td className="r num" style={{ fontWeight: 600 }}>{money(sum('amount_eur_prev'), 'EUR', lang)}</td>
      </tr>
      {!aggregated && sec.filter((l) => !compact || Number(l.amount_eur) || Number(l.amount_eur_prev)).map((l) => (
        <tr key={l.key}>
          <td style={{ paddingLeft: 22 }}>{L(l.name_it, l.name_fr)}</td>
          <td className="r num">{Number(l.amount_eur) ? money(l.amount_eur, 'EUR', lang) : '–'}</td>
          <td className="r num muted">{Number(l.amount_eur_prev) ? money(l.amount_eur_prev, 'EUR', lang) : '–'}</td>
        </tr>
      ))}
    </>
  );
}
