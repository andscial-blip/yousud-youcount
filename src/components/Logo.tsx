// Marchio YouCount: ricevuta a mosaico nei colori YouSud con la spunta della verifica
// (vettoriale, generato da scripts/gen_icons.py).
export function Logo({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="logo" src="/brand/youcount-mark.svg" alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

// Nome nello stile di Cairn: maiuscole spaziate; «YOU» nel verde YouSud.
export function Wordmark({ as = 'b' }: { as?: 'b' | 'h1' }) {
  const Tag = as;
  return <Tag className="wordmark yc-wm"><span className="wm-you">You</span><span className="wm-count">Count</span></Tag>;
}

// Schermata d'apertura: fondo bianco, marchio, nome e frase al centro. Solo al primo caricamento della
// sessione (lo script la nasconde subito alle aperture successive), poi sfuma da sola via CSS:
// nessun JavaScript da attendere, e non intercetta i tocchi.
export function Splash({ tagline }: { tagline: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html:
        "try{if(sessionStorage.getItem('yc-splash'))document.documentElement.classList.add('nosplash');else sessionStorage.setItem('yc-splash','1')}catch(e){}" }} />
      <div id="yc-splash" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/youcount-mark.svg" alt="" width={88} height={88} />
        <b className="yc-wm" style={{ fontSize: 24 }}><span className="wm-you">You</span><span className="wm-count">Count</span></b>
        <p>{tagline}</p>
      </div>
    </>
  );
}
