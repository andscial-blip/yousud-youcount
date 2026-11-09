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
    if (!todo.length || !navigator.onLine) return;
    todo.forEach((i) => asked.add(i));
    fetch('/api/v1/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: todo }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.done) router.refresh(); }).catch(() => {});
  }, [ids, router]);
  return null;
}
