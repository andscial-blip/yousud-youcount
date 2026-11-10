// Sagome semplificate di Italia e Madagascar, per distinguere a colpo d'occhio i conti dei due paesi.
const SHAPES: Record<'IT' | 'MG', string[]> = {
  IT: [
    'M7.2 2.6 L13.4 2 L15 4.1 L13.7 5.7 L14.5 8.6 L17 11.3 L19.6 12.5 L21.1 14.9 L19.8 15.5 L18.6 14.6 L18.3 16.4 L19 18.7 L17.6 20.8 L16.5 19.7 L16.8 17.6 L15.1 15.6 L12.5 13.9 L10.2 11.3 L8.6 8.4 L7 6.7 L5.2 5.9 L5.6 3.8 Z',
    'M12.9 20.3 L16 20.1 L15.2 21.9 Z',
    'M5.3 13.4 L7.3 13.2 L7.6 17.7 L5.6 18.1 Z',
  ],
  MG: ['M15.9 2 L17.5 3.7 L18 6.5 L17.2 9.7 L15.6 14.6 L13.8 19.4 L12 21.6 L9.4 22 L7.6 20.2 L7.2 17.2 L8.4 13.6 L8.2 10.6 L9.6 8.6 L12.4 7.2 L14.2 4.6 Z'],
};

export function CountryMark({ loc, label, size = 36 }: { loc: 'IT' | 'MG' | string; label: string; size?: number }) {
  const k = loc === 'IT' ? 'IT' : 'MG';
  return (
    <span className={`cmark ${k.toLowerCase()}`} style={{ width: size, height: size }} title={label} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" width={size * 0.8} height={size * 0.8} aria-hidden="true">
        {SHAPES[k].map((d) => <path key={d} d={d} />)}
      </svg>
    </span>
  );
}
