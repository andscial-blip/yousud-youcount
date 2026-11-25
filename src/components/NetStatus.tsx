'use client';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

// pagine principali salvate per l'uso senza rete (anche quelle mai aperte)
const WARM = ['/', '/nuovo', '/movimenti', '/rimborsi', '/anticipi', '/conti', '/preventivo', '/progetti', '/analisi', '/scadenze', '/documenti', '/guida', '/altro', '/account', '/sincronizzazione', '/offline'];
function postWarm(urls: string[], force = false) {
  try {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({ type: 'warm', urls, force });
  } catch { /* service worker non disponibile */ }
}

export function SyncEngine() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const sync = useCallback(async () => {
    try {
      if (navigator.onLine) {
        const r = await flushOutbox(supabase);
        // dati cambiati: la pagina si aggiorna e le copie offline delle pagine principali si rinnovano
        if (r.sent > 0) { router.refresh(); postWarm(['/', '/movimenti'], true); }
      }
      set({ pending: (await listOutbox()).length, at: navigator.onLine ? Date.now() : st.at });
    } catch { /* IndexedDB non disponibile (navigazione privata): l'app funziona solo in linea */ }
  }, [supabase, router]);

  useEffect(() => {
    const upd = () => { set({ online: navigator.onLine }); if (navigator.onLine) sync(); };
    // coda cambiata: con la rete si invia subito (un movimento registrato mentre le foto finivano di caricarsi), non al giro dei 30 s
    const count = () => listOutbox().then((l) => { set({ pending: l.length }); if (navigator.onLine && l.some((x) => x.state === 'pending')) sync(); }).catch(() => {});
    upd();
    // con la rete: pagine principali salvate per l'uso offline, al massimo ogni 2 ore e 6 secondi dopo l'apertura,
    // per non rubare banda e server alla prima pagina; niente con «risparmio dati» o rete 2G
    let warmT: ReturnType<typeof setTimeout> | undefined;
    try {
      const last = Number(localStorage.getItem('yc-warm-at') ?? 0);
      const slow = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (navigator.onLine && 'serviceWorker' in navigator && Date.now() - last > 2 * 3600e3 && !slow?.saveData && slow?.effectiveType !== '2g') {
        warmT = setTimeout(() => {
          navigator.serviceWorker.ready.then((reg) => {
            reg.active?.postMessage({ type: 'warm', urls: WARM, force: Date.now() - last > 12 * 3600e3 });
            localStorage.setItem('yc-warm-at', String(Date.now()));
          }).catch(() => {});
        }, 6000);
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
  // pagina aperta con la navigazione interna: il service worker ne salva una copia (se quella che ha è più vecchia di 30 minuti)
  useEffect(() => {
    if (!navigator.onLine) return;
    const t = setTimeout(() => postWarm([location.pathname + location.search]), 2500);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}

// Avviso «stai vedendo dati salvati»: la pagina è arrivata dalla copia del service worker (senza rete o rete lenta).
// Il commento <!--yc-cached-at:…--> in testa al documento lo aggiunge il service worker quando salva la copia.
export function StaleNote({ lang = 'it' }: { lang?: string }) {
  const pathname = usePathname();
  const [at, setAt] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  useEffect(() => {
    const c = document.firstChild;
    const m = c && c.nodeType === Node.COMMENT_NODE ? /yc-cached-at:(\d+)/.exec(c.nodeValue ?? '') : null;
    if (m) setAt(Number(m[1]));
    setFirst(location.pathname);
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'fresh') setFresh(true); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const onOnline = () => setFresh(true);
    window.addEventListener('online', onOnline);
    return () => { navigator.serviceWorker?.removeEventListener('message', onMsg); window.removeEventListener('online', onOnline); };
  }, []);
  // navigazione interna riuscita: la pagina nuova è arrivata dalla rete
  useEffect(() => { if (first && pathname !== first) setAt(null); }, [pathname, first]);
  const s = useSt();
  if (!at) return null;
  const d = new Date(at);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const when = `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${lang === 'fr' ? 'à' : 'alle'} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const fr = lang === 'fr';
  const head = !s.online ? (fr ? 'Hors ligne' : 'Senza rete') : (fr ? 'Réseau lent' : 'Rete lenta');
  return (
    <div className="stale-note" role="status">
      <span><b>{head}</b> · {fr ? `données enregistrées le ${when}` : `dati salvati il ${when}`}</span>
      {s.online && <button type="button" className="btn sm" onClick={() => location.reload()}>{fresh ? (fr ? 'Nouvelles données · Actualiser' : 'Dati nuovi · Aggiorna') : (fr ? 'Actualiser' : 'Aggiorna')}</button>}
    </div>
  );
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
