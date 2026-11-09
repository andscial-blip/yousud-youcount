import type { Key } from './i18n';
import type { Role } from './session';

// stessi insiemi di session.ts (qui ripetuti: questo file si usa anche nel browser)
const ADMIN: Role[] = ['super_admin', 'admin'];
const RESP: Role[] = ['super_admin', 'admin', 'responsabile'];
const STAFF: Role[] = ['super_admin', 'admin', 'responsabile', 'read_only'];

// Architettura come Cairn: sette sezioni nel menu laterale, ognuna con le sue sotto-schede sotto il titolo.
// Gli indirizzi restano quelli di prima (segnalibri, link nei documenti e nelle email continuano a funzionare).
// I permessi veri li applica il database: qui si nasconde solo ciò che un ruolo non potrebbe comunque usare.

export type Sub = { href: string; key: Key; roles?: Role[] };
export type Section = { id: string; key: Key; hint: Key; ic: string; roles?: Role[]; subs: Sub[]; also?: string[] };

export const SECTIONS: Section[] = [
  { id: 'home', key: 'nav_dashboard', hint: 'hint_home', ic: 'home', subs: [
    { href: '/', key: 'sub_overview' }, { href: '/scadenze', key: 'nav_deadlines' }] },
  // «Da verificare» non è una scheda: è un filtro del registro e un indicatore della Dashboard (la pagina /verifica resta per la verifica in blocco)
  { id: 'mov', key: 'nav_movements', hint: 'hint_mov', ic: 'list', also: ['/nuovo', '/verifica'], subs: [
    { href: '/movimenti', key: 'sub_register' }, { href: '/rimborsi', key: 'nav_reimb' },
    { href: '/documenti', key: 'sub_receipts' }, { href: '/controparti', key: 'sub_parties' }] },
  { id: 'cassa', key: 'nav_accounts', hint: 'hint_cassa', ic: 'bank', subs: [
    { href: '/conti', key: 'nav_accounts' }, { href: '/anticipi', key: 'nav_advances', roles: STAFF },
    { href: '/riconciliazione', key: 'sub_rec', roles: STAFF }, { href: '/cambi', key: 'sub_fx' }] },
  { id: 'bud', key: 'nav_budget', hint: 'hint_bud', ic: 'wallet', roles: STAFF, subs: [{ href: '/preventivo', key: 'nav_budget' }] },
  { id: 'prj', key: 'nav_projects', hint: 'hint_prj', ic: 'brief', subs: [
    { href: '/progetti', key: 'nav_projects' }, { href: '/finanziamenti', key: 'nav_grants' }] },
  { id: 'anal', key: 'nav_analysis', hint: 'hint_anal', ic: 'chart', roles: STAFF, subs: [
    { href: '/analisi', key: 'nav_analysis' }, { href: '/rendiconto', key: 'nav_report' }, { href: '/report', key: 'nav_reports' }] },
  { id: 'docs', key: 'nav_documents', hint: 'hint_docs', ic: 'receipt', subs: [{ href: '/documenti-emessi', key: 'nav_documents' }] },
  { id: 'set', key: 'nav_settings', hint: 'hint_set', ic: 'gear', also: ['/altro'], subs: [
    { href: '/account', key: 'nav_account' },
    { href: '/admin/utenti', key: 'sub_users', roles: ADMIN }, { href: '/admin/conti', key: 'nav_admin_accounts', roles: ADMIN },
    { href: '/admin/piano-conti', key: 'nav_chart', roles: ADMIN },
    { href: '/admin/progetti', key: 'sub_cost_centres', roles: ADMIN }, { href: '/admin/periodi', key: 'nav_periods', roles: ADMIN },
    { href: '/admin/impostazioni', key: 'sub_org', roles: ADMIN }, { href: '/admin/registro', key: 'nav_audit', roles: ADMIN },
    { href: '/sincronizzazione', key: 'nav_sync' }, { href: '/guida', key: 'nav_guide' }] },
];

const can = (roles: Role[] | undefined, role: Role | undefined) => !roles || (!!role && roles.includes(role));

// Sezioni e sotto-schede visibili per un ruolo (una sezione senza schede visibili sparisce).
export function navFor(role: Role | undefined): Section[] {
  return SECTIONS.filter((s) => can(s.roles, role))
    .map((s) => ({ ...s, subs: s.subs.filter((x) => can(x.roles, role)) }))
    .filter((s) => s.subs.length > 0);
}

// Sezione e sotto-scheda di un indirizzo: la scheda più specifica che lo contiene (es. /movimenti/123 → Registro).
export function locate(secs: Section[], path: string): { sec: Section | null; sub: Sub | null } {
  let best: { sec: Section; sub: Sub | null; len: number } | null = null;
  for (const sec of secs) {
    for (const sub of sec.subs) {
      const hit = sub.href === '/' ? path === '/' : path === sub.href || path.startsWith(sub.href + '/');
      if (hit && (!best || sub.href.length > best.len)) best = { sec, sub, len: sub.href.length };
    }
    for (const a of sec.also ?? []) if ((path === a || path.startsWith(a + '/')) && !best) best = { sec, sub: null, len: a.length };
  }
  return best ? { sec: best.sec, sub: best.sub } : { sec: null, sub: null };
}

// Pagine in cui l'anno nell'intestazione cambia ciò che si vede (parametro ?anno=).
export const YEAR_PATHS = ['/', '/progetti', '/analisi', '/rendiconto', '/report', '/preventivo', '/documenti-emessi', '/cambi'];

// Indirizzi che sono una sotto-scheda: lì il titolo è già nell'intestazione e la pagina non lo ripete.
export const SUB_HREFS = SECTIONS.flatMap((s) => s.subs.map((x) => x.href));
