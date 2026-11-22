import type { SupabaseClient } from '@supabase/supabase-js';
// Colori degli elementi (gruppi di voci, progetti, finanziatori) — revisione dei colori del 16/11.
// Esclusi di proposito i colori che hanno un significato fisso in tutta l'app: blu notte (entrate), giallo (uscite), verde acqua (saldo),
// blu (preventivo), corallo (oltre il limite), cielo (Italia) e lilla (Madagascar). Ogni gruppo di voci e ogni progetto ha il suo colore.
// revisione 19/11 (settimo giro): progetti e gruppi di spesa non condividono più nessun colore.
// Progetti: dodici tinte fredde e rosate (nessun giallo, ocra o oliva, che restano alle uscite); nessun doppione fino a dodici progetti.
// 20/11 (nono giro): tinte tenui scelte per restare distinte anche con il daltonismo rosso-verde (min ΔE 10,6 normale, 6,4 deuteranopia; prima 8,2 e 1,5)
export const ITEM_PAL = ['#8A739D', '#1D7954', '#FFB0BB', '#F0C2A0', '#A45C73', '#3AA8C5', '#CF93BE', '#427B78', '#2279A5', '#BE8088', '#4A9D9F', '#BB71A0'];   // giro 12: i primi 10 scelti per distanza (ΔE ≥ 12,6, deuteranopia ≥ 9), tenui, niente oliva scura né marrone
export const PAL = ITEM_PAL;
// Gruppi di spesa (01…09): la famiglia del giallo delle uscite, dall'ocra al crema; codici vicini lontani di chiarezza.
// gruppi di spesa: gialli e albicocca alternati a toni salvia, ben distinti tra loro e dai progetti (freddi e rosati)
// due famiglie alternate (gialli-albicocca e salvia): distanza minima ΔE 9 (prima 6), nessun colore uguale alle uscite (20/11)
// 21/11 (undicesimo giro): senza senape, terracotta e crema invisibile; gialli, albicocca e salvia tenui, min ΔE 8,3 tra gruppi
export const EXPENSE_SHADES = ['#F4E3A1', '#87B96E', '#D2B9FF', '#D6E8BE', '#E6CFE0', '#6E8A3C', '#F8C3A3', '#A8DADC', '#A7B3C4'];
export const REST = '#E3E8EF';
export const INCOME_SHADES = ['#1E2B3C', '#4C5A6E', '#8A94A3', '#C2C8D1'];   // entrate: blu notte e suoi grigi   // «Altri», più chiaro di ogni tinta

// conti: sfumature del colore del paese (Italia cielo, Madagascar lilla), così il colore dice sempre il paese
export const COUNTRY_SHADES = { IT: ['#8FAFD6', '#C3D6EF', '#4F6F9A', '#6F90BE', '#36557F'], MG: ['#A596E6', '#D4CCF4', '#6E62A8', '#C0B4EE', '#8C80C9'] } as const;   // sfumature tenui, nessuna satura

/** Colore di un gruppo di voci dal suo codice: 01…09 e E1…E4 hanno ciascuno il suo, uguale ovunque. */
export function groupColor(code: string): string | null {
  const m = /^(E?)(\d+)$/i.exec(code.trim());
  if (!m) return null;
  const n = Number(m[2]);
  // gruppi di entrata (E1…E4): toni del blu notte, il colore delle entrate, così non si confondono mai con progetti e voci di spesa
  if (m[1]) return INCOME_SHADES[(n - 1) % INCOME_SHADES.length]!;
  return EXPENSE_SHADES[((n - 1) % EXPENSE_SHADES.length + EXPENSE_SHADES.length) % EXPENSE_SHADES.length]!;
}

/** Colore fisso di ogni progetto (o finanziatore): posizione nell'ordine di creazione. Un progetto nuovo prende il colore successivo
 *  e quelli esistenti non cambiano; fino a dodici progetti nessun colore si ripete. */
export function projectColorMap(idsInCreationOrder: string[]): Map<string, string> {
  return new Map(idsInCreationOrder.map((id, i) => [id, ITEM_PAL[i % ITEM_PAL.length]!] as const));
}

/** Colori di tutti i progetti dell'organizzazione: il colore salvato con il progetto (21/11); per i progetti senza colore, l'ordine di creazione. */
export async function loadProjectColors(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from('projects').select('*').order('created_at').order('name').order('id');   // a parità di data, per nome: stabile anche quando i dati dimostrativi si ricaricano
  return colorsOf((data ?? []) as { id: string; color?: string | null }[]);
}

/** Da righe di progetto già in ordine di creazione: colore salvato, altrimenti quello della tavolozza per posizione. */
export function colorsOf(rows: { id: string; color?: string | null }[]): Map<string, string> {
  const pos = projectColorMap(rows.map((p) => p.id));
  return new Map(rows.map((p) => [p.id, (p.color && /^#[0-9A-Fa-f]{6}$/.test(p.color) ? p.color : pos.get(p.id))!] as const));
}
