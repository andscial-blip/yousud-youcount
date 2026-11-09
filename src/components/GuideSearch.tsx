'use client';
import { useState } from 'react';
import { CIcon } from './CIcon';

// Ricerca nella guida: mostra solo gli argomenti che contengono le parole scritte e li apre.
export function GuideSearch({ placeholder, none }: { placeholder: string; none: string }) {
  const [q, setQ] = useState('');
  const [empty, setEmpty] = useState(false);
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const run = (v: string) => {
    setQ(v);
    const words = norm(v).split(/\s+/).filter(Boolean);
    let shown = 0;
    document.querySelectorAll<HTMLDetailsElement>('details.g-topic').forEach((d) => {
      const hit = words.every((w) => norm(d.textContent ?? '').includes(w));
      d.hidden = !hit;
      d.open = words.length > 0 && hit;
      if (hit) shown++;
    });
    document.querySelectorAll<HTMLElement>('.g-sec').forEach((s) => { s.hidden = !s.querySelector('details.g-topic:not([hidden])'); });
    setEmpty(words.length > 0 && shown === 0);
  };
  return (
    <div className="g-search no-print">
      <label className="search"><CIcon name="search" size={16} />
        <input className="input" type="search" value={q} onChange={(e) => run(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
      {empty && <p className="muted" style={{ margin: '8px 0 0' }}>{none}</p>}
    </div>
  );
}
