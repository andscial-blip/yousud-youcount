// Marchio YouCount: mappamondo del logo YouSud (senza la scritta) con il distintivo contabile
// (ricevuta con spunta). File generato da scripts/gen_icons.py.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="logo-plate" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/youcount-mark.svg" alt="" width={size - 6} height={size - 6} />
    </span>
  );
}

export function Wordmark({ tagline }: { tagline: string }) {
  return (
    <div className="brand">
      <b>You<span className="wm-count">Count</span></b>
      <span>{tagline}</span>
    </div>
  );
}
