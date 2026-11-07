'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Esce e cancella le pagine salvate per l'uso offline, così su un telefono condiviso non restano dati visibili.
export function SignOut({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn" disabled={busy} onClick={async () => {
      setBusy(true);
      await createClient().auth.signOut();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.location.href = '/login';
    }}>{label}</button>
  );
}
