import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rendiconto' };

type Line = {
  direction: 'in' | 'out'; section: string; section_it: string; key: string; name_it: string;
  amount_eur: string; amount_eur_prev: string; rows_count: number; missing_rate: number;
};

export default async function Report({ searchParams }: { searchParams: Promise<{ anno?: string }> }) {
  const { anno } = await searchParams;
  const year = Number(anno) || new Date().getFullYear();
  const { supabase, me } = await requireMe();
  if (me?.role === 'operator') {
    return <div className="note">Il rendiconto è visibile a responsabili, amministratori e utenti in sola lettura.</div>;
  }
  const [{ data, error }, { data: unclassified }] = await Promise.all([
    supabase.rpc('report_cash_statement', { p_year: year }),
    supabase.rpc('report_unclassified', { p_year: year }),
  ]);
  const lines = (data ?? []) as Line[];
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22 }}>Rendiconto per cassa {year}</h1>
        <div className="spacer" />
        <Link className="btn" href={`/rendiconto?anno=${year - 1}`}>{year - 1}</Link>
        <Link className="btn" href={`/rendiconto?anno=${year + 1}`}>{year + 1}</Link>
      </div>
      <div className="note">
        Bozza calcolata dai movimenti registrati e verificati, secondo le righe del Mod. D usate nel Gestionale.
        La conformità al D.M. 5 marzo 2020 va verificata dal commercialista prima dell&apos;approvazione.
      </div>
      {error && <div className="note err">Rendiconto non disponibile: {error.message}</div>}
      {missing > 0 && <div className="note err">{missing} movimenti in MGA senza tasso di cambio: importi in EUR incompleti.</div>}
      {(unclassified ?? []).length > 0 && (
        <div className="note err">{unclassified!.length} movimenti con codici senza riga di rendiconto (es. 999 / E999): da riclassificare.</div>
      )}
      {(['out', 'in'] as const).map((dir) => (
        <section className="panel" key={dir} style={{ overflowX: 'auto' }}>
          <div className="panel-h"><h2>{dir === 'out' ? 'Uscite' : 'Entrate'}</h2></div>
          <table className="t">
            <thead><tr><th>Voce</th><th className="r">{year}</th><th className="r">{year - 1}</th></tr></thead>
            <tbody>
              {sections(dir).map((sec) => (
                <SectionRows key={sec[0].section} sec={sec} />
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>Totale {dir === 'out' ? 'uscite' : 'entrate'}</td>
                <td className="r num" style={{ fontWeight: 700 }}>{money(tot(dir), 'EUR')}</td>
                <td className="r num" style={{ fontWeight: 700 }}>{money(tot(dir, true), 'EUR')}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
      <section className="kpis">
        <div className="kpi"><span className="l">Avanzo / disavanzo {year}</span>
          <span className="v num">{money(tot('in') - tot('out'), 'EUR')}</span>
          <span className="s">entrate meno uscite, investimenti e imposte inclusi</span></div>
      </section>
    </div>
  );
}

function SectionRows({ sec }: { sec: Line[] }) {
  const sum = (k: 'amount_eur' | 'amount_eur_prev') => sec.reduce((s, l) => s + Number(l[k]), 0);
  return (
    <>
      <tr style={{ background: 'var(--surface-2)' }}>
        <td style={{ fontFamily: 'var(--f-ui)', fontWeight: 700 }}>{sec[0].section_it}</td>
        <td className="r num" style={{ fontWeight: 600 }}>{money(sum('amount_eur'), 'EUR')}</td>
        <td className="r num" style={{ fontWeight: 600 }}>{money(sum('amount_eur_prev'), 'EUR')}</td>
      </tr>
      {sec.map((l) => (
        <tr key={l.key}>
          <td style={{ paddingLeft: 22 }}>{l.name_it}</td>
          <td className="r num">{Number(l.amount_eur) ? money(l.amount_eur, 'EUR') : '–'}</td>
          <td className="r num muted">{Number(l.amount_eur_prev) ? money(l.amount_eur_prev, 'EUR') : '–'}</td>
        </tr>
      ))}
    </>
  );
}
