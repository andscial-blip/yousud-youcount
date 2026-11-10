// Importi scritti in qualsiasi forma comune: "1.234,56", "1234,56", "1,234.56", "1234.56", "1 234", "1.234".
// Un solo separatore seguito da esattamente tre cifre vale come separatore delle migliaia ("1.234" = 1234):
// nella contabilità in EUR e MGA tre decimali non si usano.
export function parseAmount(input: string): number | null {
  const v = input.replace(/[\s '€]/g, '').replace(/MGA|Ar|EUR/gi, '');
  if (!/^\d[\d.,]*$/.test(v)) return null;
  const seps = v.match(/[.,]/g) ?? [];
  let n: number;
  if (seps.length === 0) n = Number(v);
  else {
    const last = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'));
    const intPart = v.slice(0, last).replace(/[.,]/g, '');
    const dec = v.slice(last + 1);
    if (new Set(seps).size > 1) n = Number(`${intPart}.${dec}`);
    else if (seps.length > 1) n = Number(v.replace(/[.,]/g, ''));
    else if (dec.length === 3 && Number(intPart) > 0) n = Number(intPart + dec);
    else n = Number(`${intPart}.${dec}`);
  }
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Mentre si scrive un importo: punto delle migliaia e virgola dei decimali, in automatico
// ("5000" → "5.000", "1234567,5" → "1.234.567,5"). Un punto seguito da 1-2 cifre alla fine vale come
// virgola dei decimali ("12.5" → "12,5"); gli altri punti sono separatori delle migliaia e si ricalcolano.
// Restituisce anche dove rimettere il cursore (stesso numero di cifre alla sua sinistra).
export function formatTyping(text: string, caret = text.length): { text: string; caret: number } {
  let t = text.replace(/[^\d.,]/g, '');
  if (!t.includes(',')) { const m = /\.(\d{0,2})$/.exec(t); if (m && (t.match(/\./g) ?? []).length === 1 && m[1].length < 3 && !/\.\d{3}$/.test(t)) t = t.replace(/\.(\d{0,2})$/, ',$1'); }
  const ci = t.indexOf(',');
  let int = (ci >= 0 ? t.slice(0, ci) : t).replace(/\./g, '');
  const dec = ci >= 0 ? t.slice(ci + 1).replace(/[.,]/g, '').slice(0, 2) : null;
  int = int.replace(/^0+(?=\d)/, '');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const out = dec === null ? grouped : `${grouped || '0'},${dec}`;
  // cursore: conta le cifre (e la virgola) prima del cursore nel testo originale
  const before = text.slice(0, caret).replace(/[^\d,]/g, '').length;
  let n = 0, pos = 0;
  while (pos < out.length && n < before) { if (/[\d,]/.test(out[pos])) n++; pos++; }
  return { text: out, caret: pos };
}
