// Identità visiva dei progetti (opzione B): un'icona per tipo di attività, con una tinta tenue per tipo.
// Tinte senza significato (16/11): ardesia, salvia, oliva, rosa, prugna, petrolio, acciaio, nebbia; mai corallo, giallo, verde acqua, blu, cielo o lilla, che indicano sforamenti, uscite, saldo, previsto, Italia e Madagascar.
// Se il tipo non è impostato si deduce dal nome; la struttura ha sempre l'edificio.
export const THEMES = {
  structure: { it: 'Struttura', fr: 'Structure', bg: '#E3EAF4', fg: '#2E3D52', d: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>' },
  school: { it: 'Scuola', fr: 'École', bg: '#EAF1E8', fg: '#47664A', d: '<path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>' },
  sport: { it: 'Sport', fr: 'Sport', bg: '#EEF2DC', fg: '#56632A', d: '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 1 0 18M3 12h18M5.6 5.6c3.6 2.4 9.2 2.4 12.8 0M5.6 18.4c3.6-2.4 9.2-2.4 12.8 0"/>' },
  food: { it: 'Alimentazione', fr: 'Alimentation', bg: '#F8E8F0', fg: '#94416A', d: '<path d="M4 11h16a8 8 0 0 1-16 0zM8 4v3M12 3v4M16 4v3"/>' },
  soap: { it: 'Attività economica', fr: 'Activité économique', bg: '#EFEAF2', fg: '#5F4B6A', d: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>' },
  agri: { it: 'Agricoltura', fr: 'Agriculture', bg: '#EEF2DC', fg: '#56632A', d: '<path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14zM5 19l7-7"/>' },
  health: { it: 'Salute', fr: 'Santé', bg: '#F8E8F0', fg: '#94416A', d: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
  water: { it: 'Acqua', fr: 'Eau', bg: '#E6F0F0', fg: '#3F6466', d: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9 15a3 3 0 0 0 3 3"/>' },
  training: { it: 'Formazione', fr: 'Formation', bg: '#E8ECF2', fg: '#45566E', d: '<path d="M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5"/>' },
  other: { it: 'Progetto', fr: 'Projet', bg: '#EEF1F5', fg: '#4A5B73', d: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2"/>' },
} as const;
export type Theme = keyof typeof THEMES;

export function themeOf(p: { name: string; kind?: string | null; theme?: string | null }): Theme {
  if (p.kind === 'structure') return 'structure';
  if (p.theme && p.theme in THEMES) return p.theme as Theme;
  const n = p.name.toLowerCase();
  if (/(école|ecole|scuol|school|collège|lycée)/.test(n)) return 'school';
  if (/sport/.test(n)) return 'sport';
  if (/(food|cibo|mensa|aliment|nutri)/.test(n)) return 'food';
  if (/(sapon|savon|soap|artigian|commerc)/.test(n)) return 'soap';
  if (/(agri|orto|cacao|vanill|semenc|farm)/.test(n)) return 'agri';
  if (/(salut|santé|health|sanit)/.test(n)) return 'health';
  if (/(acqua|eau|water|pozz)/.test(n)) return 'water';
  if (/(formaz|formation|training)/.test(n)) return 'training';
  return 'other';
}

/** N-6 (giro 13): il nome italiano della struttura si mostra tradotto in francese (gli altri progetti hanno nomi propri). */
const FR_NAMES: Record<string, string> = { 'spese generali': 'Frais généraux', 'struttura e spese generali': 'Structure et frais généraux', 'struttura': 'Structure' };
export function prjName(name: string, lang: string): string {
  return lang === 'fr' ? FR_NAMES[name.trim().toLowerCase()] ?? name : name;
}
