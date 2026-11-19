import type { SupabaseClient } from '@supabase/supabase-js';
// Colori degli elementi (gruppi di voci, progetti, finanziatori) — revisione dei colori del 16/11.
// Esclusi di proposito i colori che hanno un significato fisso in tutta l'app: blu notte (entrate), giallo (uscite), verde acqua (saldo),
// blu (preventivo), corallo (oltre il limite), cielo (Italia) e lilla (Madagascar). Ogni gruppo di voci e ogni progetto ha il suo colore.
// revisione 19/11 (settimo giro): progetti e gruppi di spesa non condividono più nessun colore.
// Progetti: dodici tinte fredde e rosate (nessun giallo, ocra o oliva, che restano alle uscite); nessun doppione fino a dodici progetti.
export const ITEM_PAL = ['#5B6F8C', '#E3A6C2', '#7FA5A8', '#9C8AA5', '#8FB58A', '#B86F8E', '#8497B0', '#4F7F86', '#CDB0C4', '#6C8A7A', '#B3C7BF', '#7D6E93'];
export const PAL = ITEM_PAL;
// Gruppi di spesa (01…09): la famiglia del giallo delle uscite, dall'ocra al crema; codici vicini lontani di chiarezza.
// chiarezza e tono variano insieme (oro scuro, ambra, giallo, limone, crema…), così anche i gruppi più grandi restano distinguibili
export const EXPENSE_SHADES = ['#C1952F', '#F2DC92', '#E39E4C', '#F7EDCB', '#E8BE5A', '#CDBB5C', '#F2C38B', '#A99A4E', '#EED9AE'];
export const REST = '#E3E8EF';
export const INCOME_SHADES = ['#1E2B3C', '#4C5A6E', '#8A94A3', '#C2C8D1'];   // entrate: blu notte e suoi grigi   // «Altri», più chiaro di ogni tinta

// conti: sfumature del colore del paese (Italia cielo, Madagascar lilla), così il colore dice sempre il paese
export const COUNTRY_SHADES = { IT: ['#8FAFD6', '#C3D5EC', '#5F7FA6', '#B0C7E4', '#7393BC'], MG: ['#A596E6', '#D4CCF4', '#6E62A8', '#C0B4EE', '#8C80C9'] } as const;   // sfumature tenui, nessuna satura

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

/** Colori di tutti i progetti dell'organizzazione (stesso ordine ovunque): per le pagine che mostrano un solo progetto o un elenco. */
export async function loadProjectColors(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from('projects').select('id, created_at').order('created_at').order('id');
  return projectColorMap(((data ?? []) as { id: string }[]).map((p) => p.id));
}
