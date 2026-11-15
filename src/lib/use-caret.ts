'use client';
import { useLayoutEffect, useRef } from 'react';

/**
 * Rimette il cursore al posto giusto dopo che un campo «guidato» (importi con il punto delle migliaia) è stato riscritto.
 * Lo fa subito dopo l'aggiornamento della pagina, non al fotogramma successivo: sull'iPhone vero (prova del 15/11), con una
 * digitazione veloce, lo spostamento ritardato arrivava dopo la cifra seguente e la metteva nel posto sbagliato
 * («12000» diventava «120.010»).
 */
export function useCaret() {
  const pending = useRef<{ el: HTMLInputElement; caret: number } | null>(null);
  useLayoutEffect(() => {
    const p = pending.current; if (!p) return;
    pending.current = null;
    if (document.activeElement === p.el) { try { p.el.setSelectionRange(p.caret, p.caret); } catch { /* campo senza selezione */ } }
  });
  return (el: HTMLInputElement, caret: number) => { pending.current = { el, caret }; };
}
