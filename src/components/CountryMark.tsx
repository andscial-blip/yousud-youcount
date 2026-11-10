// Segno del paese per i conti: bandiera in un cerchio, a colori tenui (verde, bianco, rosso della palette),
// con la sigla accanto quando serve. Più leggibile delle sagome, che a 36 px non si riconoscevano.
export function CountryMark({ loc, label, size = 36 }: { loc: 'IT' | 'MG' | string; label: string; size?: number }) {
  const k = loc === 'IT' ? 'IT' : 'MG';
  return (
    <span className={`cmark ${k.toLowerCase()}`} style={{ width: size, height: size }} title={label} role="img" aria-label={label}>
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
        <defs><clipPath id={`cm-${k}`}><circle cx="18" cy="18" r="17" /></clipPath></defs>
        <g clipPath={`url(#cm-${k})`}>
          {k === 'IT' ? (<>
            <rect x="0" y="0" width="12" height="36" className="f-g" />
            <rect x="12" y="0" width="12" height="36" className="f-w" />
            <rect x="24" y="0" width="12" height="36" className="f-r" />
          </>) : (<>
            <rect x="0" y="0" width="13" height="36" className="f-w" />
            <rect x="13" y="0" width="23" height="18" className="f-r" />
            <rect x="13" y="18" width="23" height="18" className="f-g" />
          </>)}
        </g>
        <circle cx="18" cy="18" r="17" className="f-ring" />
      </svg>
    </span>
  );
}
