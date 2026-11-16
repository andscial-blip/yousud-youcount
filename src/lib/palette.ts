// Colori per voci, progetti, conti e finanziatori (16/11): lilla, cielo, oliva, rosa, blu ardesia, nebbia. Esclusi di proposito i colori
// con un significato fisso: blu notte (entrate), giallo (uscite), verde acqua (saldo), blu (preventivo), corallo (oltre il limite).
export const PAL = ['var(--pp2)', 'var(--pp4)', 'var(--pp6)', 'var(--pp7)', 'var(--pp8)', 'var(--dn6)'];

/** Colore fisso di ogni progetto, uguale in tutte le pagine: posizione del progetto nell'elenco completo ordinato per identificativo.
 *  Prima il colore dipendeva da quali progetti comparivano nel grafico e cambiava da una pagina all'altra (revisione dei colori, 16/11). */
export function projectColorMap(ids: string[]): Map<string, string> {
  return new Map([...ids].sort().map((id, i) => [id, PAL[i % PAL.length]!] as const));
}
