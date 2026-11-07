'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { I } from '@/lib/icons';
import { createClient } from '@/lib/supabase/client';
import { flushOutbox, listOutbox, OUTBOX_EVENT } from '@/lib/outbox';

// Stato della rete nell'intestazione (in linea / senza rete, mai rosso) e invio automatico della coda:
// all'apertura, al ritorno della rete, a ogni nuovo elemento e ogni 30 secondi finché resta qualcosa da inviare.
export function NetStatus({ labels }: { labels: { online: string; offline: string; pending: string } }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const sync = useCallback(async () => {
    try {
      if (navigator.onLine) {
        const r = await flushOutbox(supabase);
        if (r.sent > 0) router.refresh();
      }
      setPending((await listOutbox()).length);
    } catch { /* IndexedDB non disponibile (navigazione privata): l'app funziona solo in linea */ }
  }, [supabase, router]);

  useEffect(() => {
    const upd = () => { setOnline(navigator.onLine); if (navigator.onLine) sync(); };
    const count = () => listOutbox().then((l) => setPending(l.length)).catch(() => {});
    upd();
    sync();
    // una volta per sessione, con la rete: pagine principali salvate per l'uso offline
    try {
      if (navigator.onLine && 'serviceWorker' in navigator && !sessionStorage.getItem('yc-warm')) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.active?.postMessage({ type: 'warm', urls: ['/', '/nuovo', '/movimenti', '/sincronizzazione', '/offline'] });
          sessionStorage.setItem('yc-warm', '1');
        }).catch(() => {});
      }
    } catch { /* sessionStorage non disponibile */ }
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    window.addEventListener(OUTBOX_EVENT, count);
    const timer = setInterval(() => { if (navigator.onLine) listOutbox().then((l) => { if (l.some((x) => x.state === 'pending')) sync(); }).catch(() => {}); }, 30000);
    return () => {
      window.removeEventListener('online', upd);
      window.removeEventListener('offline', upd);
      window.removeEventListener(OUTBOX_EVENT, count);
      clearInterval(timer);
    };
  }, [sync]);

  const label = (online ? labels.online : labels.offline) + (pending ? ` · ${pending} ${labels.pending}` : '');
  return (
    <Link href="/sincronizzazione" className="net" aria-label={label} title={label}
          style={{ color: online ? 'rgba(255,255,255,.72)' : 'var(--amber-soft)' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
           strokeLinejoin="round" aria-hidden="true"><path d={online ? I.cloud : I.cloudOff} /></svg>
      {pending > 0 && <span className="net-badge">{pending}</span>}
      <span className="desk">{label}</span>
    </Link>
  );
}
