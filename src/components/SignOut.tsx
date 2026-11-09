'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listOutbox } from '@/lib/outbox';

// Esce e cancella le pagine salvate per l'uso offline, così su un telefono condiviso non restano dati visibili.
// Se sul telefono ci sono movimenti non ancora inviati, chiede conferma: uscendo andrebbero persi.
export function SignOut({ label, warn, variant = 'btn', icon }: { label: string; warn: string; variant?: 'btn' | 'side' | 'menu'; icon?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={variant === 'btn' ? 'btn' : variant === 'side' ? 'side-link' : undefined} disabled={busy} onClick={async () => {
      const pending = await listOutbox().catch(() => []);
      if (pending.length && !window.confirm(warn)) return;
      setBusy(true);
      if (pending.length) indexedDB.deleteDatabase('youcount');
      // esce solo da questo dispositivo: telefono e computer restano collegati
      await createClient().auth.signOut({ scope: 'local' });
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.location.href = '/login';
    }}>{icon}{variant === 'btn' ? label : <span>{label}</span>}</button>
  );
}
