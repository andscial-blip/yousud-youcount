'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Rete di sicurezza (25/11): se una foto del movimento non ha ancora il suo PDF (es. registrata senza rete e inviata dalla coda
// mentre l'app era chiusa), il PDF si crea all'apertura della scheda e la pagina si aggiorna.
export function PdfEnsure({ movementId }: { movementId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!navigator.onLine) return;
    let alive = true;
    fetch('/api/v1/documenti/pdf', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ movement_id: movementId }) })
      .then((r) => r.json()).then((b) => { if (alive && b?.made > 0) router.refresh(); }).catch(() => {});
    return () => { alive = false; };
  }, [movementId, router]);
  return null;
}
