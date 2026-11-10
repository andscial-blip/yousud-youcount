'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { setCell } from '@/app/(app)/preventivo/actions';

// Griglia del preventivo (scelta 5 · proposta dell'esperto): righe = codici raggruppati, colonne = progetti.
// In bozza si scrive direttamente nella cella (Invio o uscita dalla cella salva); i totali si aggiornano subito.
// Una cella con più righe, quantità × costo o ariary si apre nel dettaglio (☰).
export type GRow = { id: string; code: string; name: string; dir: 'in' | 'out'; group: string };
export type GGroup = { id: string; label: string; dir: 'in' | 'out' };
export type GCol = { id: string; name: string };             // id '' = generale (struttura)
export type GCell = { eur: number; n: number; simple: boolean; base?: number | null };

// importi con i separatori delle migliaia anche a 4 cifre (1.250) e i decimali solo se ci sono
const fmt = (v: number, lang: 'it' | 'fr') => {
  if (!v) return '';
  const dec = Math.abs(v % 1) > 0.004;
  const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: 2 }).format(v);
  return lang === 'fr' ? s.replace(/,/g, '\u202f').replace('.', ',') : s.replace(/,/g, '#').replace('.', ',').replace(/#/g, '.');
};
const parse = (s: string) => {
  const t = s.replace(/[\s  €]/g, '');
  if (!t) return 0;
  const n = Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export function BudgetGrid({ budgetId, rows, groups, cols, cells, editable, lang, detail, sig }: {
  budgetId: string; rows: GRow[]; groups: GGroup[]; cols: GCol[]; cells: Record<string, GCell>; editable: boolean; lang: 'it' | 'fr';
  detail: Record<string, string>; sig: string;
}) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(Object.entries(cells).map(([k, c]) => [k, c.eur])));
  const [state, setState] = useState<Record<string, 'saving' | 'err' | undefined>>({});
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  // nuovi dati dal server (dopo un salvataggio o un cambio di versione): si riparte da quelli
  useEffect(() => { setVals(Object.fromEntries(Object.entries(cells).map(([k, c]) => [k, c.eur]))); setState({}); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = (k: string) => vals[k] ?? 0;
  const tot = useMemo(() => {
    const r: Record<string, number> = {};
    for (const row of rows) for (const c of cols) {
      const x = v(`${row.id}|${c.id}`);
      r[`r|${row.id}`] = (r[`r|${row.id}`] ?? 0) + x;
      r[`g|${row.group}|${c.id}`] = (r[`g|${row.group}|${c.id}`] ?? 0) + x; r[`g|${row.group}|T`] = (r[`g|${row.group}|T`] ?? 0) + x;
      r[`d|${row.dir}|${c.id}`] = (r[`d|${row.dir}|${c.id}`] ?? 0) + x; r[`d|${row.dir}|T`] = (r[`d|${row.dir}|T`] ?? 0) + x;
    }
    return r;
  }, [vals, rows, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (k: string, row: GRow, col: GCol, raw: string, el: HTMLInputElement) => {
    const n = parse(raw);
    if (n == null) { setState((s) => ({ ...s, [k]: 'err' })); setErrMsg(L('Importo non valido.', 'Montant non valide.')); return; }
    el.value = fmt(n, lang);
    if (n === v(k)) return;
    const before = v(k);
    setVals((s) => ({ ...s, [k]: n })); setState((s) => ({ ...s, [k]: 'saving' }));
    start(async () => {
      const r = await setCell(budgetId, row.id, col.id || null, String(n));
      if (r.ok) { setState((s) => ({ ...s, [k]: undefined })); setErrMsg(null); }
      else {
        setVals((s) => ({ ...s, [k]: before })); el.value = fmt(before, lang); setState((s) => ({ ...s, [k]: 'err' }));
        setErrMsg(r.error === 'detail' ? L('Questa cella ha più righe o importi in ariary: aprila con ☰.', 'Cette cellule a plusieurs lignes ou des montants en ariary : ouvrez-la avec ☰.') : r.error ?? L('Non salvato.', 'Non enregistré.'));
      }
    });
  };

  const body = (dir: 'in' | 'out') => groups.filter((g) => g.dir === dir && rows.some((r) => r.group === g.id)).map((g) => (
    <tbody key={g.id}>
      <tr className="bg-grp"><th scope="rowgroup" className="bg-sticky">{g.label}</th>
        {cols.map((c) => <td key={c.id} className="r num">{fmt(tot[`g|${g.id}|${c.id}`] ?? 0, lang)}</td>)}
        {cols.length > 1 && <td className="r num bg-tot">{fmt(tot[`g|${g.id}|T`] ?? 0, lang)}</td>}</tr>
      {rows.filter((r) => r.group === g.id).map((r) => (
        <tr key={r.id}>
          <th scope="row" className="bg-sticky bg-code"><span className="bg-cw"><span className="bg-c">{r.code}</span><span className="bg-n">{r.name}</span></span></th>
          {cols.map((c) => {
            const k = `${r.id}|${c.id}`, cell = cells[k], inline = editable && (!cell || cell.n === 0 || cell.simple);
            const changed = cell?.base != null ? Math.abs((cell.base ?? 0) - v(k)) > 0.004 : v(k) > 0 && cell?.base === null;
            return (
              <td key={c.id} className={`bg-cell${changed ? ' chg' : ''}${cell && cell.n > 0 ? ' has' : ''}${state[k] ? ` st-${state[k]}` : ''}`}>
                {inline ? (
                  <Cell k={k} value={v(k)} lang={lang} label={`${r.code} · ${c.name}`} onSave={(raw, el) => save(k, r, c, raw, el)} />
                ) : <span className="num bg-ro">{fmt(v(k), lang)}</span>}
                {detail[k] && <Link className="bg-det" href={detail[k]} scroll={false} aria-label={L(`Dettaglio ${r.code} · ${c.name}`, `Détail ${r.code} · ${c.name}`)}
                  title={cell && cell.n > 1 ? L(`${cell.n} righe`, `${cell.n} lignes`) : L('Dettaglio: quantità × costo, ariary, note', 'Détail : quantité × coût, ariary, notes')}>☰{cell && cell.n > 1 ? <small>{cell.n}</small> : null}</Link>}
              </td>
            );
          })}
          {cols.length > 1 && <td className="r num bg-tot">{fmt(tot[`r|${r.id}`] ?? 0, lang)}</td>}
        </tr>
      ))}
    </tbody>
  ));

  return (
    <>
      {errMsg && <div className="note err" role="alert" style={{ margin: '0 16px 10px' }}>{errMsg}</div>}
      <div className="tscroll bg-wrap">
        <table className="t keep bgrid">
          <thead><tr><th className="bg-sticky">{L('Codice', 'Code')}</th>{cols.map((c) => <th key={c.id} className="r">{c.name}</th>)}{cols.length > 1 && <th className="r bg-tot">{L('Totale', 'Total')}</th>}</tr></thead>
          {(['out', 'in'] as const).map((d) => rows.some((r) => r.dir === d) && [
            <tbody key={`h${d}`}><tr className="bg-sec"><th scope="rowgroup" className="bg-sticky">{d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')}</th>
              {cols.map((c) => <td key={c.id} className="r num">{fmt(tot[`d|${d}|${c.id}`] ?? 0, lang)}</td>)}
              {cols.length > 1 && <td className="r num bg-tot">{fmt(tot[`d|${d}|T`] ?? 0, lang)}</td>}</tr></tbody>,
            ...body(d),
          ])}
        </table>
      </div>
    </>
  );
}

function Cell({ k, value, lang, label, onSave }: { k: string; value: number; lang: 'it' | 'fr'; label: string; onSave: (raw: string, el: HTMLInputElement) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current && document.activeElement !== ref.current) ref.current.value = fmt(value, lang); }, [value, lang]);
  return (
    <input ref={ref} className="bg-in num" name={k} defaultValue={fmt(value, lang)} inputMode="decimal" autoComplete="off" aria-label={label}
           onFocus={(e) => e.currentTarget.select()}
           onBlur={(e) => onSave(e.currentTarget.value, e.currentTarget)}
           onKeyDown={(e) => {
             if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
             if (e.key === 'Escape') { e.currentTarget.value = fmt(value, lang); e.currentTarget.blur(); }
           }} />
  );
}
