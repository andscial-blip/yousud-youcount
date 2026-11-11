'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Filtri del registro salvati con un nome, su questo dispositivo (memoria del browser). Il filtro è l'indirizzo
// della pagina, quindi si può anche copiare e mandare a un collega.
const KEY = 'yc-mov-filters';
type Saved = { name: string; qs: string };
const read = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
const write = (v: Saved[]) => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 12))); } catch { /* memoria non disponibile */ } };

export function SavedFilters({ current, lang }: { current: string; lang: 'it' | 'fr' }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [list, setList] = useState<Saved[]>([]);
  useEffect(() => setList(read()), []);
  const save = () => {
    const name = window.prompt(L('Nome del filtro', 'Nom du filtre'))?.trim();
    if (!name) return;
    const next = [...read().filter((x) => x.name !== name), { name: name.slice(0, 40), qs: current }];
    write(next); setList(next);
  };
  const del = (name: string) => { const next = read().filter((x) => x.name !== name); write(next); setList(next); };
  if (!list.length && !current) return null;
  return (
    <div className="saved-f mv-saved">
      {list.map((x) => (
        <span key={x.name} className="sf"><Link href={x.qs ? `/movimenti?${x.qs}` : '/movimenti'} aria-current={x.qs === current ? 'true' : undefined}>{x.name}</Link>
          <button type="button" onClick={() => del(x.name)} aria-label={`${L('Elimina il filtro', 'Supprimer le filtre')} ${x.name}`}>×</button></span>
      ))}
      {current && <button type="button" className="btn small" onClick={save}>+ {L('Salva questo filtro', 'Enregistrer ce filtre')}</button>}
    </div>
  );
}
