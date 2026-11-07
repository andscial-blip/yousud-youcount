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
