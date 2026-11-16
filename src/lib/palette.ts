// Colori degli elementi (gruppi di voci, progetti, finanziatori) — revisione dei colori del 16/11.
// Esclusi di proposito i colori che hanno un significato fisso in tutta l'app: blu notte (entrate), giallo (uscite), verde acqua (saldo),
// blu (preventivo), corallo (oltre il limite), cielo (Italia) e lilla (Madagascar). Nove tinte tenui: un gruppo di voci = un colore.
export const ITEM_PAL = ['#B9C47A', '#E3A6C2', '#5B6F8C', '#C9D6EA', '#9C8AA5', '#A8C3A1', '#8497B0', '#7FA5A8', '#D6DCA9'];
export const PAL = ITEM_PAL;
export const REST = '#E3E8EF';   // «Altri», più chiaro di ogni tinta

// conti: sfumature del colore del paese (Italia cielo, Madagascar lilla), così il colore dice sempre il paese
export const COUNTRY_SHADES = { IT: ['#8FAFD6', '#B5CBE6', '#7393BC', '#D3E0F1', '#5F7FA6'], MG: ['#A596E6', '#C4B9F0', '#8C80C9', '#DCD5F6', '#7C72B0'] } as const;   // sfumature tenui, nessuna satura

/** Colore di un gruppo di voci dal suo codice: 01…09 e E1…E4 hanno ciascuno il suo, uguale ovunque. */
export function groupColor(code: string): string | null {
  const m = /^(E?)(\d+)$/i.exec(code.trim());
  if (!m) return null;
  const n = Number(m[2]);
  return ITEM_PAL[((m[1] ? n + 4 : n - 1) % ITEM_PAL.length + ITEM_PAL.length) % ITEM_PAL.length]!;
}

/** Colore fisso di ogni progetto (o finanziatore): posizione nell'ordine di creazione. Un progetto nuovo prende il colore successivo
 *  e quelli esistenti non cambiano; fino a nove progetti nessun colore si ripete. */
export function projectColorMap(idsInCreationOrder: string[]): Map<string, string> {
  return new Map(idsInCreationOrder.map((id, i) => [id, ITEM_PAL[i % ITEM_PAL.length]!] as const));
}
