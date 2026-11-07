'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { I } from '@/lib/icons';

// Stato della rete nell'intestazione: in linea / senza rete (mai rosso). La coda d'invio arriva con la tappa 4e.
export function NetStatus({ labels }: { labels: { online: string; offline: string } }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);
  const label = online ? labels.online : labels.offline;
  return (
    <Link href="/sincronizzazione" className="net" aria-label={label} title={label}
          style={{ color: online ? 'rgba(255,255,255,.72)' : 'var(--amber-soft)' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
           strokeLinejoin="round" aria-hidden="true"><path d={online ? I.cloud : I.cloudOff} /></svg>
      <span className="desk">{label}</span>
    </Link>
  );
}
