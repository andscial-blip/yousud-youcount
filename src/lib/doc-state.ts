// Stato del giustificativo: tre stati, con lo stesso nome in ogni pagina (revisione 14/11).
//  · 'doc'      = con documento (almeno un file allegato)
//  · 'declared' = senza documento, motivo dichiarato
//  · 'todo'     = da documentare (né file né motivo)
export type DocState = 'doc' | 'declared' | 'todo';
export const docState = (count: number | null | undefined, reason: string | null | undefined): DocState =>
  (count ?? 0) > 0 ? 'doc' : reason ? 'declared' : 'todo';
export const DOC_LABEL: Record<DocState, [string, string]> = {
  doc: ['con documento', 'avec pièce'],
  declared: ['senza documento, motivo dichiarato', 'sans pièce, motif déclaré'],
  todo: ['da documentare', 'à documenter'],
};
export const docLabel = (s: DocState, lang: string) => DOC_LABEL[s][lang === 'fr' ? 1 : 0];
