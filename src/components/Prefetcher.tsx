'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

// Passaggi istantanei fin dalla prima apertura: mentre c'è la schermata d'apertura, l'app chiede in
// anticipo al server le pagine principali complete di dati (tenute per 5 minuti, vedi staleTimes).
// Si ripete quando si torna all'app dopo più di 4 minuti. Niente se il telefono è in risparmio dati.
const EVERY = 4 * 60e3;

export function Prefetcher({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const key = hrefs.join('|');
  useEffect(() => {
    const list = key.split('|');
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    let last = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      if (!navigator.onLine || Date.now() - last < EVERY) return;
      last = Date.now();
      const here = location.pathname;
      list.filter((h) => h !== here).forEach((h, i) => timers.push(setTimeout(() => router.prefetch(h, { kind: PrefetchKind.FULL }), 150 * i)));
    };
    const start = setTimeout(run, 300);
    const vis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(start); timers.forEach(clearTimeout); document.removeEventListener('visibilitychange', vis); };
  }, [router, key]);
  return null;
}
