import type { Lang, T } from '@/lib/i18n';
import { money } from '@/lib/format';
import { BudgetBar } from './Charts';
import { saveBudget } from '@/app/(app)/budget-action';

export type BudgetRow = { group_id: string; group_code: string; group_name_it: string; group_name_fr: string;
                          budget_eur: string; spent_eur: string; movements: number };

// Tabella budget/speso per gruppo di codici, con modulo di modifica per chi può (responsabili e amministratori).
export function BudgetTable({ rows, t, lang, edit }: {
  rows: BudgetRow[]; t: T; lang: Lang;
  edit?: { scope: 'project' | 'grant'; id: string; year?: number; back: string };
}) {
  const nm = (r: BudgetRow) => (lang === 'fr' && r.group_name_fr ? r.group_name_fr : r.group_name_it);
  const tb = rows.reduce((s, r) => s + Number(r.budget_eur), 0);
  const ts = rows.reduce((s, r) => s + Number(r.spent_eur), 0);
  const shown = rows.filter((r) => Number(r.budget_eur) || Number(r.spent_eur));
  return (
    <div className="stack" style={{ gap: 10 }}>
      <table className="t keep">
        <thead><tr><th>{t('group')}</th><th className="r">{t('b_budget')}</th><th className="r">{t('b_spent')}</th>
          <th className="r hm">{t('b_remaining')}</th><th style={{ width: '30%' }} className="hm" /></tr></thead>
        <tbody>
          {(shown.length ? shown : rows.slice(0, 0)).map((r) => {
            const b = Number(r.budget_eur), sp = Number(r.spent_eur);
            return (
              <tr key={r.group_id}>
                <td>{r.group_code} · {nm(r)}</td>
                <td className="r num">{b ? money(b, 'EUR', lang) : '–'}</td>
                <td className="r num">{money(sp, 'EUR', lang)}</td>
                <td className="r num hm" style={b && sp > b ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{b ? money(b - sp, 'EUR', lang) : '–'}</td>
                <td className="hm"><BudgetBar budget={b} spent={sp} /></td>
              </tr>
            );
          })}
          <tr>
            <td style={{ fontWeight: 700 }}>{t('b_total')}</td>
            <td className="r num" style={{ fontWeight: 700 }}>{money(tb, 'EUR', lang)}</td>
            <td className="r num" style={{ fontWeight: 700 }}>{money(ts, 'EUR', lang)}</td>
            <td className="r num hm" style={{ fontWeight: 700 }}>{tb ? money(tb - ts, 'EUR', lang) : '–'}</td>
            <td className="hm">{tb ? <BudgetBar budget={tb} spent={ts} /> : null}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint" style={{ margin: 0 }}>{t('b_note')}</p>
      {edit && (
        <details className="noprint">
          <summary className="btn" style={{ display: 'inline-flex' }}>{t('b_edit')}</summary>
          <form action={saveBudget} className="fgrid" style={{ marginTop: 12 }}>
            <input type="hidden" name="scope" value={edit.scope} />
            <input type="hidden" name="id" value={edit.id} />
            <input type="hidden" name="year" value={edit.year ?? ''} />
            <input type="hidden" name="back" value={edit.back} />
            {rows.map((r) => (
              <div className="field" key={r.group_id}>
                <label htmlFor={`g_${r.group_id}`}>{r.group_code} · {nm(r)} (EUR)</label>
                <input className="input num" id={`g_${r.group_id}`} name={`g_${r.group_id}`} inputMode="decimal"
                       defaultValue={Number(r.budget_eur) ? String(Number(r.budget_eur)).replace('.', ',') : ''} />
              </div>
            ))}
            <div className="span2"><button className="btn primary" type="submit">{t('b_save')}</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
