'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Traduce in sottofondo le descrizioni senza traduzione dei movimenti in pagina, poi aggiorna la pagina.
// Se l'AI non è attiva o configurata il server risponde con un errore e non succede nulla.
const asked = new Set<string>();
export function AutoTranslate({ ids }: { ids: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const todo = ids.filter((i) => !asked.has(i)).slice(0, 40);
    // se il server ha già risposto di no (AI spenta o ruolo senza permesso) non si richiama a ogni apertura del Registro
    let off = false; try { off = sessionStorage.getItem('yc-notr') === '1'; } catch { /* memoria non disponibile */ }
    if (!todo.length || !navigator.onLine || off) return;
    todo.forEach((i) => asked.add(i));
    fetch('/api/v1/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: todo }) })
      .then((r) => { if (!r.ok) { try { sessionStorage.setItem('yc-notr', '1'); } catch { /* idem */ } return null; } return r.json(); }).then((j) => { if (j?.done) router.refresh(); }).catch(() => {});
  }, [ids, router]);
  return null;
}
