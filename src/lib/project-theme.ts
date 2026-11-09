// Identità visiva dei progetti (opzione B): un'icona per tipo di attività, con una tinta tenue per tipo.
// Se il tipo non è impostato si deduce dal nome; la struttura ha sempre l'edificio.
export const THEMES = {
  structure: { it: 'Struttura', fr: 'Structure', bg: '#eef1f5', fg: '#2f3e52', d: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>' },
  school: { it: 'Scuola', fr: 'École', bg: '#e6f1f1', fg: '#3c7475', d: '<path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>' },
  sport: { it: 'Sport', fr: 'Sport', bg: '#f6efdf', fg: '#9a7a2d', d: '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 1 0 18M3 12h18M5.6 5.6c3.6 2.4 9.2 2.4 12.8 0M5.6 18.4c3.6-2.4 9.2-2.4 12.8 0"/>' },
  food: { it: 'Alimentazione', fr: 'Alimentation', bg: '#f7ebe6', fg: '#9b5a44', d: '<path d="M4 11h16a8 8 0 0 1-16 0zM8 4v3M12 3v4M16 4v3"/>' },
  soap: { it: 'Attività economica', fr: 'Activité économique', bg: '#efecf6', fg: '#6b5c97', d: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>' },
  agri: { it: 'Agricoltura', fr: 'Agriculture', bg: '#e9f2e6', fg: '#4f7a3f', d: '<path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14zM5 19l7-7"/>' },
  health: { it: 'Salute', fr: 'Santé', bg: '#f6e8ea', fg: '#9b4a57', d: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
  water: { it: 'Acqua', fr: 'Eau', bg: '#e5eff6', fg: '#3f6f93', d: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9 15a3 3 0 0 0 3 3"/>' },
  training: { it: 'Formazione', fr: 'Formation', bg: '#eceff4', fg: '#4a5a72', d: '<path d="M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5"/>' },
  other: { it: 'Progetto', fr: 'Projet', bg: '#eef1f5', fg: '#4a5a72', d: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2"/>' },
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
