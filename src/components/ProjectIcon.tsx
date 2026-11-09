import { THEMES, themeOf } from '@/lib/project-theme';

// Segno di riconoscimento di un progetto: icona del tipo di attività su tinta tenue (opzione B scelta da Andrea).
export function ProjectIcon({ p, size = 42 }: { p: { name: string; kind?: string | null; theme?: string | null }; size?: number }) {
  const th = THEMES[themeOf(p)];
  return (
    <span className="pc-ic" aria-hidden="true" style={{ background: th.bg, width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.52)} height={Math.round(size * 0.52)} fill="none" stroke={th.fg} strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: th.d }} />
    </span>
  );
}
