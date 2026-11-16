/* YouCount service worker.
 * - Pagine: rete prima, ma se c'è una copia salvata e la rete non risponde entro 2,5 secondi si mostra la copia
 *   (rete lenta o assente: l'app resta veloce). La risposta della rete, se arriva dopo, aggiorna la copia.
 *   Senza copia: si aspetta la rete; se manca, la pagina /offline.
 * - Ogni copia salvata porta in testa un commento <!--yc-cached-at:…-->: l'app lo legge e avvisa
 *   «stai vedendo i dati salvati il …».
 * - Navigazione interna (richieste RSC di Next): se la rete non risponde entro 2,5 secondi e c'è una copia
 *   della pagina, la richiesta fallisce subito, Next ricarica la pagina intera e risponde la copia salvata.
 * - File statici con hash (_next/static, icone): cache prima.
 * - Dati (Supabase, /api): mai in cache qui. I dati offline stanno in IndexedDB (coda d'invio),
 *   così il database centrale resta l'archivio ufficiale.
 * - "warm": l'app chiede di salvare in anticipo le pagine principali e quelle appena aperte.
 * Nessuna dipendenza dalla Background Sync API: l'invio della coda lo gestisce l'app.
 */
const VERSION = 'youcount-v5';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/brand/youcount-mark.svg', '/brand/yousud-logo-512.png'];
const WAIT_MS = 3000;          // oltre questo tempo, con una copia salvata, si usa la copia
let slowUntil = 0;             // rete appena risultata lenta: per 15 secondi la copia si usa quasi subito
const FRESH_MS = 30 * 60e3;    // "warm" di una pagina: non la riscarica se la copia ha meno di 30 minuti

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// chiave di una pagina: percorso + parametri, senza _rsc (Next lo aggiunge alle richieste interne)
const pageKey = (url) => { const u = new URL(url); u.searchParams.delete('_rsc'); u.hash = ''; return u.pathname + (u.search || ''); };

async function storePage(key, res) {
  const html = await res.text();
  const at = Date.now();
  const body = `<!--yc-cached-at:${at}-->` + html;
  const headers = new Headers(res.headers);
  headers.set('x-yc-at', String(at));
  headers.delete('content-length');
  const cache = await caches.open(VERSION);
  await cache.put(new Request(key), new Response(body, { status: 200, headers }));
  return html;
}

async function cachedPage(key) {
  return (await caches.match(key)) || (await caches.match(key, { ignoreSearch: true }));
}

const timeout = (ms) => new Promise((r) => setTimeout(() => r('timeout'), ms));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase e servizi esterni: niente cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname === '/login') return;

  if (req.mode === 'navigate') {
    const key = pageKey(req.url);
    event.respondWith((async () => {
      const net = fetch(req).then(async (res) => {
        if (res.ok && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
          event.waitUntil(storePage(key, res.clone()).catch(() => {}));
        }
        return res;
      });
      const copy = await cachedPage(key);
      if (!copy) return net.catch(async () => (await caches.match('/offline')) || Response.error());
      const first = await Promise.race([net.catch(() => 'error'), timeout(Date.now() < slowUntil ? 300 : WAIT_MS)]);
      if (first !== 'error' && first !== 'timeout') return first;
      if (first === 'timeout') slowUntil = Date.now() + 15000;
      // la copia si aggiorna quando la rete risponde, e l'app propone «Aggiorna»
      event.waitUntil(net.then(async (res) => {
        if (!res.ok || res.redirected) return;
        const c = await self.clients.get(event.resultingClientId || event.clientId);
        if (c) c.postMessage({ type: 'fresh', key });
      }).catch(() => {}));
      return copy;
    })());
    return;
  }

  // richieste interne di Next (RSC), escluse le pre-letture: con rete lenta e copia salvata, si passa alla copia
  if (req.headers.get('RSC') === '1' && !req.headers.get('Next-Router-Prefetch')) {
    event.respondWith((async () => {
      const net = fetch(req);
      const copy = await cachedPage(pageKey(req.url));
      if (!copy) return net;
      const first = await Promise.race([net.catch(() => 'error'), timeout(WAIT_MS)]);
      if (first !== 'error' && first !== 'timeout') return first;
      if (first === 'timeout') slowUntil = Date.now() + 15000;
      return Response.error();                                 // Next ricarica la pagina intera: risponde la copia
    })());
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});

async function warm(urls, force) {
  const cache = await caches.open(VERSION);
  for (const url of urls) {
    try {
      const key = pageKey(new URL(url, self.location.origin).href);
      const old = await cache.match(key);
      if (!force && old && Date.now() - Number(old.headers.get('x-yc-at') || 0) < FRESH_MS) continue;
      const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'text/html' } });
      if (!res.ok || res.redirected) continue;            // es. sessione scaduta: niente copia della pagina di accesso
      const html = await storePage(key, res);
      // file JS/CSS citati nella pagina, anche nei dati React ("static/chunks/…" senza il prefisso /_next/)
      const assets = [...new Set((html.match(/static\/(?:chunks|css|media)\/[^"'\s\\]+?\.(?:js|css)/g) || []).map((a) => `/_next/${a}`))];
      await Promise.all(assets.map(async (a) => {
        if (await cache.match(a)) return;
        const r = await fetch(a);
        if (r.ok) await cache.put(a, r);
      }));
    } catch { /* senza rete o pagina non disponibile: si riprova alla prossima apertura */ }
  }
}

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'warm' && Array.isArray(d.urls)) event.waitUntil(warm(d.urls, Boolean(d.force)));
});
