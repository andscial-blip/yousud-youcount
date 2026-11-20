import { THEMES, themeOf } from '@/lib/project-theme';

// Segno di riconoscimento di un progetto: icona del tipo di attività su tinta tenue (opzione B scelta da Andrea).
// color (16/11): il colore del progetto nei grafici, così icona e grafici dicono la stessa cosa; il tipo resta nel disegno dell'icona.
export function ProjectIcon({ p, size = 42, color }: { p: { name: string; kind?: string | null; theme?: string | null }; size?: number; color?: string }) {
  const t0 = THEMES[themeOf(p)];
  const th = color ? { ...t0, bg: `color-mix(in srgb, ${color} 58%, #fff)`, fg: `color-mix(in srgb, ${color} 30%, #1E2B3C)` } : t0;
  return (
    <span className="pc-ic" aria-hidden="true" style={{ background: th.bg, width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.52)} height={Math.round(size * 0.52)} fill="none" stroke={th.fg} strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: th.d }} />
    </span>
  );
}
