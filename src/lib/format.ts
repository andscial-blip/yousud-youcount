import type { Lang } from './i18n';

// Importi: MGA senza decimali, EUR con due; separatore delle migliaia sempre presente.
export function money(value: number | string | null | undefined, currency: string, lang: Lang = 'it') {
  if (value === null || value === undefined || value === '') return '–';
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'MGA' ? 0 : 2,
    maximumFractionDigits: currency === 'MGA' ? 0 : 2,
    // in italiano Intl omette il separatore per i numeri di 4 cifre: lo forziamo
    useGrouping: 'always',
  } as Intl.NumberFormatOptions).format(n);
}

export function date(d: string | null | undefined) {
  if (!d) return '–';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export function dateTime(d: string | null | undefined, lang: Lang = 'it') {
  if (!d) return '–';
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Indian/Antananarivo', // ora del Madagascar, indicata nel testo
  }).format(new Date(d));
}

// nome nella lingua dell'utente, con l'italiano come riserva
export const nm = (lang: Lang, o: { name_it: string; name_fr?: string | null } | null | undefined) =>
  !o ? '–' : lang === 'fr' && o.name_fr ? o.name_fr : o.name_it;
