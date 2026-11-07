// Marchio YouCount: ricevuta a mosaico nei colori YouSud con la spunta della verifica
// (vettoriale, generato da scripts/gen_icons.py).
export function Logo({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="logo" src="/brand/youcount-mark.svg" alt="" width={size} height={size} />;
}

export function Wordmark({ tagline }: { tagline: string }) {
  return (
    <div className="brand">
      <b><span className="wm-you">You</span><span className="wm-count">Count</span></b>
      <span>{tagline}</span>
    </div>
  );
}
