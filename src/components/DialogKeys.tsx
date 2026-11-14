'use client';

import { useEffect } from 'react';

/**
 * Tastiera nelle schede laterali e nei dialoghi (revisione 14/11, P2-13): all'apertura il focus entra nella scheda,
 * Tab resta dentro, Esc la chiude, alla chiusura il focus torna da dove era partito.
 * Vale per ogni elemento role="dialog" aria-modal="true", anche quelli disegnati dal server (chiusi da un collegamento).
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function DialogKeys() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    let origin: HTMLElement | null = null;
    let lastFocus: HTMLElement | null = null;
    const visible = (e: HTMLElement) => e.getClientRects().length > 0;
    const items = (d: HTMLElement) => [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    const sync = () => {
      const all = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')].filter(visible);
      const d = all[all.length - 1] ?? null;
      if (d === current) return;
      if (d) {
        if (!current) origin = lastFocus;
        current = d;
        if (!d.contains(document.activeElement)) {
          // il primo campo del modulo, se c'è; altrimenti la scheda stessa (così il lettore di schermo ne legge il titolo)
          const field = d.querySelector<HTMLElement>('.sheet-b input:not([type="hidden"]):not([disabled]), .sheet-b select, .sheet-b textarea');
          if (field && visible(field) && window.matchMedia('(min-width: 641px)').matches) field.focus({ preventScroll: true });
          else { if (!d.hasAttribute('tabindex')) d.setAttribute('tabindex', '-1'); d.focus({ preventScroll: true }); }
        }
      } else {
        current = null;
        const o = origin; origin = null;
        if (o && o.isConnected) o.focus({ preventScroll: true });
        else if (o) {
          // dopo una navigazione l'elemento è stato ridisegnato: si cerca lo stesso collegamento
          const href = o.getAttribute('href');
          const same = href ? document.querySelector<HTMLElement>(`a[href="${CSS.escape(href)}"]`) : null;
          same?.focus({ preventScroll: true });
        }
      }
    };
    const onFocus = (e: FocusEvent) => { const t = e.target as HTMLElement | null; if (t && !current) lastFocus = t; };
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === 'Escape' && !e.defaultPrevented) {
        const close = current.querySelector<HTMLElement>('.sheet-h a.btn, .sheet-h button.btn, [data-close]');
        if (close) { e.preventDefault(); close.click(); }
        return;
      }
      if (e.key !== 'Tab') return;
      const f = items(current); if (!f.length) { e.preventDefault(); return; }
      const first = f[0]!, last = f[f.length - 1]!;
      const a = document.activeElement as HTMLElement | null;
      if (!a || !current.contains(a) || a === current) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    sync();
    return () => { mo.disconnect(); document.removeEventListener('focusin', onFocus); document.removeEventListener('keydown', onKey); };
  }, []);
  return null;
}
