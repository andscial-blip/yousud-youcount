'use client';
import { useEffect } from 'react';

/** Dopo il salvataggio di una riga del preventivo la porta in vista e la evidenzia per qualche secondo:
 *  sul telefono la conferma restava in cima alla pagina e la riga nuova fuori schermo. */
export function RowReveal({ n }: { n: string }) {
  useEffect(() => {
    if (!n) return;
    const el = document.querySelector<HTMLElement>(`tr[data-ln="${CSS.escape(n)}"]`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el.classList.add('just-saved');
    const t = setTimeout(() => el.classList.remove('just-saved'), 4000);
    return () => clearTimeout(t);
  }, [n]);
  return null;
}
