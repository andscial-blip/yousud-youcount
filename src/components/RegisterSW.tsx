'use client';
import { useEffect } from 'react';

// Registra il service worker solo in produzione (in sviluppo la cache confonderebbe le modifiche).
// Poi, a service worker attivo, scarica l'editor della foto, che la pagina Nuovo movimento carica a parte:
// così è in cache anche se quella pagina non è mai stata aperta con la rete.
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    let gone = false;
    navigator.serviceWorker.ready.then(() => {
      if (gone) return;
      const go = () => { void import('./ScanEditor').catch(() => {}); };
      if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500);
    }).catch(() => {});
    return () => { gone = true; };
  }, []);
  return null;
}
