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

// Tasso di cambio (MGA per 1 EUR): sempre con i decimali salvati, mai arrotondato all'intero. Prima «5.339,63» veniva mostrato e
// stampato «5.340» e i conti sul documento non tornavano (16/11).
export function rate(value: number | string | null | undefined, lang: Lang = 'it', unit = true) {
  if (value === null || value === undefined || value === '') return '–';
  const s = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions).format(Number(value));
  return unit ? `${s}\u00a0MGA` : s;
}

export function date(d: string | null | undefined) {
  if (!d) return '–';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export function dateTime(d: string | null | undefined, lang: Lang = 'it') {
  if (!d) return '–';
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', {
    // anno a quattro cifre come nel resto dell'app (P3-5); ora del Madagascar, indicata nel testo
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Antananarivo',
  }).format(new Date(d));
}

// nome nella lingua dell'utente, con l'italiano come riserva
export const nm = (lang: Lang, o: { name_it: string; name_fr?: string | null } | null | undefined) =>
  !o ? '–' : lang === 'fr' && o.name_fr ? o.name_fr : o.name_it;

// Numeri interi o con decimali, sempre con il punto delle migliaia (anche a 4 cifre: 5.000, 1.194)
export function num(value: number | string | null | undefined, lang: Lang = 'it', decimals?: number) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', {
    useGrouping: 'always', ...(decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : { maximumFractionDigits: 2 }),
  } as Intl.NumberFormatOptions).format(Number.isFinite(n) ? n : 0);
}

// Motivi rapidi «senza giustificativo»: si salvano nella lingua di chi scrive; chi legge nell'altra lingua li vede tradotti (16/11).
const NODOC = {
  it: ['Venditore senza ricevuta', 'Ricevuta persa', 'Trasporto locale senza biglietto', 'Mancia o piccola spesa'],
  fr: ['Vendeur sans reçu', 'Reçu perdu', 'Transport local sans billet', 'Pourboire ou petite dépense'],
};
export function noDocReason(text: string | null | undefined, lang: Lang): string {
  if (!text) return '';
  const other = lang === 'fr' ? NODOC.it : NODOC.fr;
  const i = other.indexOf(text.trim());
  return i >= 0 ? NODOC[lang][i]! : text;
}

/** Titolo di una scadenza nella lingua di chi legge: le segnalazioni d'errore nascono con un titolo fisso in italiano. */
export function deadlineTitle(title: string, lang: string): string {
  const t = title.replace(/\b(MOV|AUT|DEMO|DOC|ANT)-(\d{4})-(\d+)/g, '$1\u2011$2\u2011$3');   // il numero non va a capo al trattino
  if (lang === 'fr' && t.startsWith('Errore segnalato: ')) return `Erreur signalée : ${t.slice('Errore segnalato: '.length)}`;
  return t;
}

/** Riferimento (MOV-2026-012, DEMO-2026-1010…) con trattini non separabili: non va mai a capo a metà. */
export function nbRef(ref: string): string { return ref.replace(/-/g, '‑'); }

/** Importo con segno esplicito: «+» sulle entrate, «−» sulle uscite (come nel registro). */
export function signedMoney(value: number, currency: string, lang: Lang = 'it'): string {
  const s = money(Math.abs(value), currency, lang);
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

/** Euro per riquadri e grafici, stessa regola ovunque (G10, 21/11): centesimi sotto 1.000 €, interi da 1.000 € in su; mai «,00». */
export function eurShort(v: number, lang: Lang = 'it'): string {
  const x = Math.abs(v) < 1000 ? Math.round(v * 100) / 100 : Math.round(v);
  return money(x, 'EUR', lang).replace(/,00(?=\s?€)/, '');
}
