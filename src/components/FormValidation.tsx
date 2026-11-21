'use client';
import { useEffect } from 'react';

// Errori dei campi nello stile dell'app invece del fumetto del browser («Please fill out this field»), in tutti i moduli
// (revisione 19/11: richiesta di anticipo e segnalazione d'errore vuote). Il controllo resta quello del browser (required, min…):
// qui si cambia solo come viene mostrato.
export function FormValidation() {
  useEffect(() => {
    let lastFocus = 0;
    const msgOf = (el: HTMLInputElement) => {
      const fr = document.documentElement.lang === 'fr';
      if (el.validity.valueMissing) return fr ? 'Champ obligatoire' : 'Campo obbligatorio';
      // S6 (giro 15): messaggi sempre nella lingua dell'app, mai quelli del browser
      if (el.validity.tooShort) return fr ? `Écrivez au moins ${el.minLength} caractères` : `Scrivi almeno ${el.minLength} caratteri`;
      if (el.validity.typeMismatch) return fr ? 'Format non valide' : 'Formato non valido';
      if (el.validity.rangeUnderflow || el.validity.rangeOverflow) return fr ? 'Valeur hors limites' : 'Valore fuori dai limiti';
      return fr ? 'Valeur non valide' : 'Valore non valido';
    };
    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!(el instanceof HTMLElement) || !el.form) return;
      e.preventDefault();
      el.setAttribute('aria-invalid', 'true');
      const box = el.closest('.field') ?? el.parentElement;
      if (box && !box.querySelector(':scope > .ferr.fv')) {
        const s = document.createElement('span');
        s.className = 'ferr fv';
        s.textContent = msgOf(el);
        box.appendChild(s);
      }
      // il primo campo sbagliato di questo invio prende il fuoco ed entra nello schermo
      if (Date.now() - lastFocus > 400) { lastFocus = Date.now(); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!(el instanceof HTMLElement) || el.getAttribute('aria-invalid') !== 'true' || !el.validity) return;
      if (el.validity.valid) {   // validity, non checkValidity(): quest'ultima rilancerebbe l'evento «invalid»
        el.removeAttribute('aria-invalid');
        (el.closest('.field') ?? el.parentElement)?.querySelector(':scope > .ferr.fv')?.remove();
      }
    };
    // Invio in corso (revisione 20/11): ogni modulo che passa dal server mostra l'attesa sul pulsante e non parte due volte.
    // Le azioni del server sono richieste POST con l'intestazione «Next-Action»: finché ce n'è una in corso il modulo resta occupato.
    let inflight = 0;
    const lastSubmit = new WeakMap<HTMLFormElement, number>();
    const clearBusy = () => document.querySelectorAll('form[data-busy]').forEach((f) => f.removeAttribute('data-busy'));
    const origFetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const h = init?.headers;
      const isAction = init?.method === 'POST' && Boolean(h) && (h instanceof Headers ? h.has('Next-Action') : Object.keys(h as Record<string, string>).some((k) => k.toLowerCase() === 'next-action'));
      if (!isAction) return origFetch.call(window, input, init);
      inflight++;
      const done = () => { inflight = Math.max(0, inflight - 1); if (!inflight) setTimeout(() => { if (!inflight) clearBusy(); }, 400); };
      return origFetch.call(window, input, init).then((r) => { done(); return r; }, (e) => { done(); throw e; });
    } as typeof window.fetch;
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (!(f instanceof HTMLFormElement)) return;
      if (f.hasAttribute('data-busy') || Date.now() - (lastSubmit.get(f) ?? 0) < 700) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      lastSubmit.set(f, Date.now());
      setTimeout(() => { if (inflight > 0) f.setAttribute('data-busy', ''); }, 60);
    };
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    return () => {
      window.fetch = origFetch;
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
    };
  }, []);
  return null;
}
