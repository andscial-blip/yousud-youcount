'use client';
import { useEffect } from 'react';

// Su telefono le tabelle con molte colonne diventano schede (una per riga, etichetta + valore):
// qui si copia il titolo di ogni colonna nell'attributo data-label delle celle, che il CSS mostra
// con l'attributo data-cards. Le tabelle con la classe "keep" (rendiconto, budget) o con colonne .hm restano tabelle.
// Una tabella arrivata in streaming ma non ancora idratata da React non si tocca: React confronterebbe
// gli attributi aggiunti con quelli del server e segnalerebbe un errore di idratazione. Si riprova dopo.
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber'));
function label(root: ParentNode) {
  let pending = false;
  root.querySelectorAll<HTMLTableElement>('table.t:not(.keep)').forEach((table) => {
    // l'idratazione procede dall'alto: quando l'ultima cella è idratata lo sono tutte (una tabella lunga può essere idratata a pezzi)
    const lastRow = table.rows[table.rows.length - 1];
    const lastCell = lastRow?.cells[lastRow.cells.length - 1];
    if (!hydrated(table) || (lastCell && !hydrated(lastCell))) { pending = true; return; }
    const heads = table.tHead?.rows[0]?.cells;
    // tabelle già pensate per il telefono (colonne .hm nascoste e righe compatte): restano tabelle
    if (!heads || heads.length < 4 || table.querySelector('th.hm')) return;
    const names: string[] = [];
    for (const th of Array.from(heads)) for (let i = 0; i < th.colSpan; i++) names.push((th.textContent ?? '').trim());
    table.setAttribute('data-cards', '');   // attributo, non classe: un nuovo rendering di React non lo toglie
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
  return pending;
}

// Schede che scorrono in orizzontale (viste, sotto-schede): quella scelta deve essere visibile, non tagliata a destra.
// (nessun attributo aggiunto: cambierebbe l'HTML prima che React lo idrati)
const shown = new WeakSet<Element>();
function showActive(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.segs, .subnav').forEach((bar) => {
    if (bar.scrollWidth <= bar.clientWidth + 1 || shown.has(bar)) return;
    const on = bar.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"], .on');
    if (!on) return;
    shown.add(bar);
    const l = on.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft, r = l + on.offsetWidth;
    if (r > bar.scrollLeft + bar.clientWidth - 8 || l < bar.scrollLeft) bar.scrollLeft = Math.max(0, l - 24);
  });
}

export function TableCards() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const run = () => {
      clearTimeout(timer);
      showActive(document);
      if (label(document) && tries++ < 40) timer = setTimeout(run, 150);
    };
    run();
    const obs = new MutationObserver(() => { tries = 0; run(); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); clearTimeout(timer); };
  }, []);
  return null;
}
