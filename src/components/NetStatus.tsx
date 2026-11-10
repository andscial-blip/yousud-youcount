'use client';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { flushOutbox, listOutbox, OUTBOX_EVENT } from '@/lib/outbox';

// Stato della sincronizzazione nello stile di Cairn: pallino verde (in linea) o rosso tenue (senza rete) e testo.
// Un solo «motore» (SyncEngine) invia la coda: all'apertura, al ritorno della rete, a ogni nuovo elemento e ogni
// 30 secondi; i distintivi (menu laterale, barra del telefono) leggono soltanto lo stato condiviso.

type St = { online: boolean; pending: number; at: number | null };
let st: St = { online: true, pending: 0, at: null };
const subs = new Set<() => void>();
const set = (p: Partial<St>) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
const useSt = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => st, () => st);

export function SyncEngine() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const sync = useCallback(async () => {
    try {
      if (navigator.onLine) {
        const r = await flushOutbox(supabase);
        if (r.sent > 0) router.refresh();
      }
      set({ pending: (await listOutbox()).length, at: navigator.onLine ? Date.now() : st.at });
    } catch { /* IndexedDB non disponibile (navigazione privata): l'app funziona solo in linea */ }
  }, [supabase, router]);

  useEffect(() => {
    const upd = () => { set({ online: navigator.onLine }); if (navigator.onLine) sync(); };
    const count = () => listOutbox().then((l) => set({ pending: l.length })).catch(() => {});
    upd();
    // una volta per sessione, con la rete: pagine principali salvate per l'uso offline
    // al massimo ogni 12 ore e 10 secondi dopo l'apertura, per non rubare banda e server alla prima pagina
    let warmT: ReturnType<typeof setTimeout> | undefined;
    try {
      const last = Number(localStorage.getItem('yc-warm-at') ?? 0);
      const slow = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (navigator.onLine && 'serviceWorker' in navigator && Date.now() - last > 12 * 3600e3 && !slow?.saveData && slow?.effectiveType !== '2g') {
        warmT = setTimeout(() => {
          navigator.serviceWorker.ready.then((reg) => {
            reg.active?.postMessage({ type: 'warm', urls: ['/nuovo', '/movimenti', '/conti', '/preventivo', '/progetti', '/analisi', '/scadenze', '/documenti', '/guida', '/sincronizzazione', '/offline'] });
            localStorage.setItem('yc-warm-at', String(Date.now()));
          }).catch(() => {});
        }, 10000);
      }
    } catch { /* localStorage non disponibile */ }
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    window.addEventListener(OUTBOX_EVENT, count);
    const timer = setInterval(() => { if (navigator.onLine) listOutbox().then((l) => { if (l.some((x) => x.state === 'pending')) sync(); }).catch(() => {}); }, 30000);
    return () => {
      if (warmT) clearTimeout(warmT);
      window.removeEventListener('online', upd);
      window.removeEventListener('offline', upd);
      window.removeEventListener(OUTBOX_EVENT, count);
      clearInterval(timer);
    };
  }, [sync]);
  return null;
}

const agoLabel = (at: number | null, now: number, lang: string) => {
  if (!at) return '';
  const s = Math.round((now - at) / 1000);
  if (s < 60) return lang === 'fr' ? 'à l’instant' : 'adesso';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
};

export function SyncBadge({ labels, compact = false, lang = 'it' }: {
  labels: { ok: string; offline: string; pending: string }; compact?: boolean; lang?: string;
}) {
  const s = useSt();
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [s.at]);
  const tone = !s.online ? 'late' : s.pending ? 'soon' : 'far';
  const label = !s.online ? `${labels.offline}${s.pending ? ` · ${s.pending} ${labels.pending}` : ''}`
    : s.pending ? `${s.pending} ${labels.pending}`
    : `${labels.ok}${s.at && now ? ` · ${agoLabel(s.at, now, lang)}` : ''}`;
  return (
    <Link href="/sincronizzazione" className={`sync ${tone}${compact ? ' compact' : ''}`} aria-live="polite" title={label} aria-label={label}>
      <span aria-hidden="true" className={`sync-dot ${s.online ? 'on' : 'off'}`} />
      {compact
        ? (s.pending > 0 && <span className="net-badge">{s.pending}</span>)
        : <span className="sync-l">{label}</span>}
    </Link>
  );
}
