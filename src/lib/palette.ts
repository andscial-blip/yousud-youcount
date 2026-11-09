// Palette tenue per categorie e progetti (piatta, pastello: verde acqua, lilla, giallo, azzurro, corallo, oliva, rosa,
// blu notte). Lo stesso progetto ha sempre lo stesso colore in tutta l'app: il colore dipende dal nome, non dall'ordine.
export const PALETTE = ['var(--pp1)', 'var(--pp2)', 'var(--pp3)', 'var(--pp4)', 'var(--pp5)', 'var(--pp6)', 'var(--pp7)', 'var(--pp8)'];

export const nth = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]!;

export function colorFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return nth(h);
}
