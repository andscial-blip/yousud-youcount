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

// Schermata d'apertura: fondo bianco, marchio, nome e frase al centro. Solo al primo caricamento della
// sessione (lo script la nasconde subito alle aperture successive), poi sfuma da sola via CSS:
// nessun JavaScript da attendere, e non intercetta i tocchi.
export function Splash({ tagline }: { tagline: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html:
        "try{if(sessionStorage.getItem('yc-splash'))document.documentElement.classList.add('nosplash');else sessionStorage.setItem('yc-splash','1')}catch(e){}" }} />
      <div id="splash" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/youcount-mark.svg" alt="" width={112} height={112} />
        <b><span className="sp-you">You</span><span className="sp-count">Count</span></b>
        <span>{tagline}</span>
      </div>
    </>
  );
}
