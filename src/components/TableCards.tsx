'use client';
import { useEffect } from 'react';

// Su telefono le tabelle con molte colonne diventano schede (una per riga, etichetta + valore):
// qui si copia il titolo di ogni colonna nell'attributo data-label delle celle, che il CSS mostra
// in .t-cards. Le tabelle con la classe "keep" (rendiconto, budget) o con colonne .hm restano tabelle.
function label(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>('table.t:not(.keep)').forEach((table) => {
    const heads = table.tHead?.rows[0]?.cells;
    // tabelle già pensate per il telefono (colonne .hm nascoste e righe compatte): restano tabelle
    if (!heads || heads.length < 4 || table.querySelector('th.hm')) return;
    const names: string[] = [];
    for (const th of Array.from(heads)) for (let i = 0; i < th.colSpan; i++) names.push((th.textContent ?? '').trim());
    table.classList.add('t-cards');
    for (const body of Array.from(table.tBodies).concat(table.tFoot ? [table.tFoot] : [])) {
      for (const row of Array.from(body.rows)) {
        let col = 0;
        for (const cell of Array.from(row.cells)) {
          if (!cell.hasAttribute('data-label')) cell.setAttribute('data-label', cell.colSpan > 1 ? '' : names[col] ?? '');
          col += cell.colSpan;
        }
      }
    }
  });
}

export function TableCards() {
  useEffect(() => {
    label(document);
    const obs = new MutationObserver(() => label(document));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
