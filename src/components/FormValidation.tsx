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
      return el.validationMessage;
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
    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
    };
  }, []);
  return null;
}
