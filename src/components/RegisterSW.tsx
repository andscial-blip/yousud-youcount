'use client';
import { useEffect } from 'react';

// Registra il service worker solo in produzione (in sviluppo la cache confonderebbe le modifiche).
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
