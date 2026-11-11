// Segno del paese per i conti. Le due bandiere hanno gli stessi tre colori e a 36 px si confondevano (richiesta dell'11/11):
// ora è la sigla in un cerchio, con due tinte ben diverse: IT bianco su blu notte, MG blu notte su verde acqua.
export function CountryMark({ loc, label, size = 36 }: { loc: 'IT' | 'MG' | string; label: string; size?: number }) {
  const k = loc === 'IT' ? 'IT' : 'MG';
  return <span className={`cmark ${k.toLowerCase()}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} title={label} role="img" aria-label={label}>{k}</span>;
}
