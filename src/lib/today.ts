// «Oggi» per tutta l'app, sempre con l'ora di Antananarivo (revisione 21/11).
// Il server online gira in UTC: prima, tra mezzanotte e le 3 del Madagascar, alcune pagine (calcolo in UTC) dicevano
// ancora il giorno prima e altre (ora del server) quello nuovo. Ora tutte usano lo stesso orologio, sul server e nel browser.
export const ORG_TZ = 'Indian/Antananarivo';

function parts(d: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).reduce<Record<string, string>>((a, x) => { a[x.type] = x.value; return a; }, {});
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}

/** Data di oggi (AAAA-MM-GG) ad Antananarivo. */
export function todayYmd(at: Date = new Date()): string {
  const { y, m, d } = parts(at);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Un Date le cui ore «locali» (getFullYear, getMonth, getDate…) sono quelle di Antananarivo, ovunque giri il codice.
 *  Va usato solo per leggere anno, mese, giorno e per l'aritmetica dei giorni; mai con toISOString (per quello: todayYmd). */
export function orgNow(at: Date = new Date()): Date {
  const { y, m, d, h, mi, s } = parts(at);
  return new Date(y, m - 1, d, h, mi, s);
}

/** Anno in corso ad Antananarivo. */
export function orgYear(): number { return parts(new Date()).y; }
