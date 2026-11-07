/* YouCount service worker.
 * - Pagine: rete prima; senza rete, ultima copia salvata o la pagina /offline.
 * - File statici con hash (_next/static, icone): cache prima.
 * - Dati (Supabase, /api): mai in cache qui. I dati offline stanno in IndexedDB (coda d'invio),
 *   così il database centrale resta l'archivio ufficiale.
 * - "warm": l'app, quando è in linea, chiede di salvare in anticipo le pagine principali (e i file JS/CSS
 *   che usano), così "Nuovo movimento" funziona senza rete anche se non era stato aperto prima.
 * Nessuna dipendenza dalla Background Sync API: l'invio della coda lo gestisce l'app.
 */
const VERSION = 'youcount-v4';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/brand/youcount-mark.svg', '/brand/yousud-logo-512.png'];

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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase e servizi esterni: niente cache
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || (await caches.match('/offline'))),
    );
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

async function warm(urls) {
  const cache = await caches.open(VERSION);
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'text/html' } });
      if (!res.ok || res.redirected) continue;            // es. sessione scaduta: niente copia della pagina di accesso
      const html = await res.clone().text();
      await cache.put(new Request(url), res);
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
  if (event.data && event.data.type === 'warm' && Array.isArray(event.data.urls)) event.waitUntil(warm(event.data.urls));
});
