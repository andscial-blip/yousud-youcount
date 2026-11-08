import type { Key } from './i18n';
import { ADMIN, RESP, STAFF, type Role } from './session';

// Tutte le sezioni dell'app, con chi le vede. I permessi veri li applica il database:
// qui si nasconde solo ciò che un ruolo non potrebbe comunque usare.
export type Section = {
  href: string; key: Key; icon: string; roles?: Role[];
  top?: boolean;        // barra in alto (computer)
  bottom?: boolean;     // barra in basso (telefono)
  group?: 'work' | 'admin' | 'me';   // voci della pagina "Altro"
};

export const SECTIONS: Section[] = [
  { href: '/', key: 'nav_dashboard', icon: 'M3 12l9-8 9 8M5 10v10h14V10', top: true, bottom: true },
  { href: '/movimenti', key: 'nav_movements', icon: 'M4 6h16M4 12h16M4 18h10', top: true, bottom: true },
  { href: '/nuovo', key: 'nav_new', icon: 'M12 5v14M5 12h14', bottom: true },
  { href: '/verifica', key: 'nav_verify', icon: 'M5 13l4 4L19 7', roles: RESP, top: true, group: 'work' },
  { href: '/documenti', key: 'nav_documents', icon: 'M7 3h7l5 5v13H7zM14 3v5h5', top: true, bottom: true },
  { href: '/progetti', key: 'nav_projects', icon: 'M4 7h16v12H4zM9 7V4h6v3', top: true, group: 'work' },
  { href: '/conti', key: 'nav_accounts', icon: 'M3 10h18M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18M12 3l9 5H3z', top: true, group: 'work' },
  { href: '/analisi', key: 'nav_analysis', icon: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7', roles: STAFF, top: true, group: 'work' },
  { href: '/rendiconto', key: 'nav_report', icon: 'M5 20V10M12 20V4M19 20v-7', roles: STAFF, top: true, group: 'work' },
  { href: '/rimborsi', key: 'nav_reimb', icon: 'M4 7h15v12H4zM4 7l11-3v3M15 13h.01', group: 'work' },
  { href: '/riconciliazione', key: 'nav_rec', icon: 'M4 6h11M4 12h7M4 18h7M14 15l3 3 5-6', roles: STAFF, group: 'work' },
  { href: '/finanziamenti', key: 'nav_grants', icon: 'M12 3v18M7 7h7.5a3.5 3.5 0 0 1 0 7H7', group: 'work' },
  { href: '/controparti', key: 'nav_counterparties', icon: 'M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0', group: 'work' },
  { href: '/sincronizzazione', key: 'nav_sync', icon: 'M4 12a8 8 0 0 1 14-5l2-2v6h-6M20 12a8 8 0 0 1-14 5l-2 2v-6h6', group: 'work' },
  { href: '/guida', key: 'nav_guide', icon: 'M12 18h.01M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14', group: 'work' },
  { href: '/admin/utenti', key: 'nav_users', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11h5M19.5 8.5v5', roles: ADMIN, group: 'admin' },
  { href: '/admin/conti', key: 'nav_admin_accounts', icon: 'M3 7h18v12H3zM3 11h18', roles: ADMIN, group: 'admin' },
  { href: '/admin/cambi', key: 'nav_fx', icon: 'M5 19L19 5M7.5 7.5h.01M16.5 16.5h.01', roles: RESP, group: 'admin' },
  { href: '/admin/piano-conti', key: 'nav_chart', icon: 'M4 5h16M4 10h16M4 15h10M4 20h10', roles: ADMIN, group: 'admin' },
  { href: '/admin/progetti', key: 'nav_admin_projects', icon: 'M4 7h16v12H4zM9 7V4h6v3', roles: ADMIN, group: 'admin' },
  { href: '/admin/periodi', key: 'nav_periods', icon: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4', roles: ADMIN, group: 'admin' },
  { href: '/admin/impostazioni', key: 'nav_settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2', roles: ADMIN, group: 'admin' },
  { href: '/admin/registro', key: 'nav_audit', icon: 'M8 4h10v16H6V6zM10 9h6M10 13h6M10 17h4', roles: ADMIN, group: 'admin' },
  { href: '/account', key: 'nav_account', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', group: 'me' },
  { href: '/altro', key: 'nav_more', icon: 'M5 12h.01M12 12h.01M19 12h.01', top: true, bottom: true },
];

export const visible = (role: Role | undefined) =>
  SECTIONS.filter((s) => !s.roles || (role && s.roles.includes(role)));
