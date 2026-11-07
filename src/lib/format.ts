// Formati numerici e date per l'italiano. MGA senza decimali, EUR con due.
export function money(value: number | string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === '') return '–';
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'MGA' ? 0 : 2,
    maximumFractionDigits: currency === 'MGA' ? 0 : 2,
    // separatore delle migliaia anche sotto 10.000 (in italiano Intl lo omette per 4 cifre)
    useGrouping: 'always',
  } as Intl.NumberFormatOptions).format(n);
}

export function date(d: string | null | undefined) {
  if (!d) return '–';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export const KIND_LABEL = { income: 'Entrata', expense: 'Uscita', transfer: 'Giroconto' } as const;
export const STATUS_LABEL = { draft: 'Bozza', recorded: 'Da verificare', verified: 'Verificato' } as const;
