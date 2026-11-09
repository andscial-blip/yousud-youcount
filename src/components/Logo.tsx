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

// Schermata d'apertura: fondo bianco, marchio, nome e frase al centro, 4 secondi a ogni avvio dell'app
// (lo script la nasconde subito ai ricaricamenti nella stessa sessione), poi sfuma da sola via CSS:
// nessun JavaScript da attendere, e non intercetta i tocchi.
export function Splash({ tagline }: { tagline: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html:
        // 4 secondi in tutto contati dall'apertura dell'app (non dall'arrivo della pagina), a ogni avvio;
        // anche quando si torna all'app dopo almeno 5 minuti in sottofondo
        "try{var h=document.documentElement,sd=function(){return Math.max(0,Math.round(3650-performance.now()))+'ms'};if(sessionStorage.getItem('yc-splash'))h.classList.add('nosplash');else{sessionStorage.setItem('yc-splash','1');h.style.setProperty('--yc-sd',sd())}"
        + "var away=0;document.addEventListener('visibilitychange',function(){if(document.hidden){away=Date.now();return}if(away&&Date.now()-away>=300000){var e=document.getElementById('yc-splash');if(!e)return;h.style.setProperty('--yc-sd','3650ms');h.classList.remove('nosplash');e.style.animation='none';void e.offsetHeight;e.style.animation=''}})}catch(e){}" }} />
      <div id="yc-splash" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/youcount-mark.svg" alt="" width={88} height={88} />
        <b className="yc-wm" style={{ fontSize: 24 }}><span className="wm-you">You</span><span className="wm-count">Count</span></b>
        <p>{tagline}</p>
      </div>
    </>
  );
}

// Schermata mostrata subito, mentre il server prepara la prima pagina (al posto del bianco vuoto).
export function Boot() {
  return (
    <div className="yc-boot" aria-busy="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/youcount-mark.svg" alt="" width={88} height={88} />
      <b className="yc-wm" style={{ fontSize: 24 }}><span className="wm-you">You</span><span className="wm-count">Count</span></b>
    </div>
  );
}
