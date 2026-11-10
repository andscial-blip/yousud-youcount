'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// I link «semplici» (dentro i grafici SVG e qualche elenco) ricaricavano tutta la pagina, con la schermata
// d'apertura bianca. Qui li facciamo passare dal router dell'app: cambio di pagina immediato, senza bianco.
export function LinkRouter() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a) return;
      const raw = a.getAttribute('href') ?? a.getAttribute('xlink:href');
      if (!raw || raw.startsWith('#') || a.hasAttribute('download') || (a.getAttribute('target') ?? '_self') !== '_self') return;
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      e.preventDefault();
      router.push(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);
  return null;
}
