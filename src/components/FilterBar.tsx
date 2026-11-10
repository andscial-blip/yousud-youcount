'use client';
// Filtri uguali in tutte le liste (scelta 3A del 10/11): ricerca sempre visibile, pulsante «Filtri (n)» che apre
// un pannello dal basso sul telefono e un riquadro sotto il pulsante sul computer. I filtri si applicano da soli:
// la ricerca dopo una breve pausa di scrittura, menu e caselle subito. Senza JavaScript il modulo resta un normale
// GET (Invio o «Mostra risultati»).
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CIcon } from './CIcon';

type Props = {
  action: string;
  lang: 'it' | 'fr';
  hidden?: Record<string, string | undefined | null>;
  search?: { name?: string; value?: string; placeholder: string };
  inline?: ReactNode;          // campi sempre visibili accanto alla ricerca (es. il progetto in Analisi)
  quick?: ReactNode;           // scorciatoie (link) in cima al pannello
  active?: number;             // filtri del pannello attivi, per il numero sul pulsante
  reset?: string | null;       // indirizzo «Azzera» (solo se c'è qualcosa da azzerare)
  result?: string;             // testo del pulsante di chiusura, es. «Mostra 214 movimenti»
  children?: ReactNode;        // campi del pannello
  className?: string;
};

export function FilterBar({ action, lang, hidden, search, inline, quick, active = 0, reset, result, children, className }: Props) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const sheet = Boolean(children || quick);

  const go = () => {
    const f = form.current;
    if (!f) return;
    const p = new URLSearchParams();
    new FormData(f).forEach((v, k) => { if (typeof v === 'string' && v.trim() !== '') p.append(k, v.trim()); });
    const q = p.toString();
    start(() => router.replace(q ? `${action}?${q}` : action, { scroll: false }));
  };
  const onChange = (e: FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (timer.current) clearTimeout(timer.current);
    if (t.type === 'search' || t.type === 'text') timer.current = setTimeout(go, 450);
    else if (t.type === 'date') timer.current = setTimeout(go, 250);
    else go();
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (timer.current) clearTimeout(timer.current); go(); setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <form ref={form} className={`fbar${pending ? ' pending' : ''}${className ? ` ${className}` : ''}`} method="get" action={action} role="search"
          onChange={onChange} onSubmit={onSubmit}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {search && (
        <div className="fb-search"><CIcon name="search" size={16} />
          <input className="input" type="search" name={search.name ?? 'q'} defaultValue={search.value ?? ''} placeholder={search.placeholder} aria-label={search.placeholder} />
        </div>
      )}
      {inline}
      {sheet && (
        <button type="button" className={`btn fb-btn${active ? ' on' : ''}`} aria-expanded={open} aria-controls="fb-sheet"
          aria-label={active ? L(`Filtri, ${active} attivi`, `Filtres, ${active} actifs`) : L('Filtri', 'Filtres')} onClick={() => setOpen((o) => !o)}>
          <CIcon name="sliders" size={16} /><span>{L('Filtri', 'Filtres')}</span>{active ? <span className="fb-n">{active}</span> : null}
        </button>
      )}
      {reset && <Link className="btn ghost fb-reset" href={reset} scroll={false}>{L('Azzera', 'Réinitialiser')}</Link>}
      <noscript><button className="btn" type="submit">{L('Mostra risultati', 'Afficher les résultats')}</button></noscript>
      {sheet && (
        <>
          <div className="fb-back" hidden={!open} onClick={() => setOpen(false)} />
          <div id="fb-sheet" className="fb-sheet" hidden={!open} role="dialog" aria-label={L('Filtri', 'Filtres')}>
            <div className="fb-head"><b>{L('Filtri', 'Filtres')}</b>
              {reset ? <Link href={reset} scroll={false} onClick={() => setOpen(false)}>{L('Azzera', 'Réinitialiser')}</Link> : null}</div>
            {quick && <div className="fb-quick">{quick}</div>}
            {children && <div className="fb-grid">{children}</div>}
            <button className="btn primary fb-done" type="submit">{result ?? L('Mostra risultati', 'Afficher les résultats')}</button>
          </div>
        </>
      )}
    </form>
  );
}
