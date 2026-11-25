// Prova della coda offline su una build di produzione (il service worker è attivo solo lì):
// pagine salvate in anticipo, movimento con foto registrato senza rete, invio automatico al ritorno
// della rete, nessun doppione, avviso all'uscita con movimenti non inviati.
// Uso: npm run test:offline
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import pg from 'pg';
import { startStack, ANON_KEY, TEST_PASSWORD } from './local-stack.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright');
const DB = process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test';
const PORT = 3315;
const base = `http://localhost:${PORT}`;
const pool = new pg.Pool({ connectionString: DB });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());   // «oggi» come l'app e il database
let passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message.split('\n').slice(0, 4).join('\n     ')}`); }
}

// utente operatore con accesso a tutti i progetti, come sul campo
const op = (await pool.query(`insert into auth.users(email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`,
  ['operatore@test.local', { role: 'operator' }, { full_name: 'Operatore di prova' }])).rows[0].id;
await pool.query('update profiles set all_projects = true where id = $1', [op]);
await pool.query(`insert into fx_rates(org_id, year, month, rate, source) select org_id, $2, $3, 5055.37, 'prova' from profiles where id = $1`,
  [op, Number(today.slice(0, 4)), Number(today.slice(5, 7))]);

const stack = await startStack();
console.log('build di produzione…');
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY, NEXT_DIST_DIR: '.next-offline' };
execFileSync('npx', ['next', 'build'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
const app = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: 'ignore', detached: true });
for (let i = 0; i < 120 && !(await fetch(`${base}/login`).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('yc-splash', '1'); } catch {} });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => consoleErrors.push('FAILED ' + r.url().replace(base, '').slice(0, 120)));
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message.slice(0, 200)));
const DESC = `PROVA offline ${randomUUID().slice(0, 6)}`;
try {
  await check('accesso con la rete e pagine salvate in anticipo dal service worker', async () => {
    await page.goto(`${base}/login`);
    await page.fill('#email', 'operatore@test.local');
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(`${base}/`);
    // il service worker salva /nuovo e /sincronizzazione senza che siano mai stati aperti
    const cached = await page.evaluate(async () => {
      for (let i = 0; i < 60; i++) {
        if (await caches.match('/nuovo') && await caches.match('/sincronizzazione')) return true;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    });
    if (!cached) console.log('     debug:', await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const r = await fetch('/nuovo', { headers: { accept: 'text/html' } });
      return JSON.stringify({ reg: Boolean(reg), active: Boolean(reg?.active), ctrl: Boolean(navigator.serviceWorker.controller),
        warmFlag: sessionStorage.getItem('yc-warm'), status: r.status, redirected: r.redirected, url: r.url });
    }));
    assert.ok(cached, 'pagine /nuovo e /sincronizzazione nella cache del service worker');
  });

  await check('senza rete: Nuovo movimento si apre, la foto resta sul telefono, Registra mette in coda', async () => {
    await ctx.setOffline(true);
    await page.goto(`${base}/nuovo`);
    await page.locator('#amount').waitFor({ timeout: 15000 }).catch(async (e) => {
      console.log('     errori console:', consoleErrors.slice(-12).join('\n       '));
      console.log('     pagina offline:', (await page.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | '));
      console.log('     cache:', await page.evaluate(async () => { const out = [];
        for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) if (!r.url.includes('_next')) out.push(k + ' ' + r.url); }
        const m = await caches.match('/nuovo'); out.push('match:' + (m ? m.status + ' ' + m.type + ' ' + m.url : 'no'));
        out.push('controller:' + Boolean(navigator.serviceWorker.controller)); return out.join(' ; '); }));
      throw e;
    });
    await page.fill('#amount', '45000');
    await page.fill('#desc', DESC);
    await page.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    assert.ok(await page.inputValue('#rate'), 'tasso compilato anche senza rete');
    await page.selectOption('#category', { index: 1 });
    await page.selectOption('#project', { index: 1 });
    await page.locator('input[type=file]').nth(1).setInputFiles(new URL('./fixtures/scontrino.jpg', import.meta.url).pathname);
    await page.getByRole('button', { name: 'Ritocca' }).click();
    await page.getByRole('radio', { name: 'Documento', checked: true }).waitFor();
    await page.locator('canvas').last().waitFor();
    await page.locator('.scan-busy').waitFor({ state: 'detached' });
    await page.screenshot({ path: '/tmp/scan_phone.png' });
    await page.getByRole('button', { name: 'Usa la scansione' }).click();
    await page.getByText('sul telefono, sarà inviato con il movimento').waitFor();
    await page.getByRole('button', { name: 'Registra' }).click();
    await page.getByText('Salvato sul telefono', { exact: false }).waitFor();
    assert.equal(await page.inputValue('#desc'), '', 'il modulo riparte vuoto per il movimento successivo');
    await page.locator('.net-badge:visible', { hasText: '1' }).waitFor();
    const n = (await pool.query('select count(*)::int n from movements where description = $1', [DESC])).rows[0].n;
    assert.equal(n, 0, 'senza rete nulla arriva al server');
  });

  await check('senza rete: Sincronizzazione mostra il movimento in attesa', async () => {
    await page.goto(`${base}/sincronizzazione`);
    await page.getByText(DESC).waitFor();
    await page.getByText('in attesa', { exact: true }).waitFor();
  });

  await check('ritorno della rete: invio automatico con il giustificativo, coda vuota', async () => {
    const files = stack.files.size;
    await ctx.setOffline(false);
    await page.getByText('Nessun movimento in attesa', { exact: false }).waitFor({ timeout: 30000 });
    const rows = (await pool.query(`select m.status, m.amount::float a, m.currency, m.fx_rate::float r,
      (select device_id from sync_log s where s.client_uuid = m.client_uuid order by at limit 1) device_id,
      (select count(*)::int from movement_documents md where md.movement_id = m.id) docs
      from movements m where m.description = $1`, [DESC])).rows;
    assert.equal(rows.length, 1, 'esattamente un movimento');
    assert.deepEqual([rows[0].status, rows[0].a, rows[0].currency, rows[0].docs], ['recorded', 45000, 'MGA', 1]);
    assert.equal(rows[0].r, 5055.37);
    assert.match(String(rows[0].device_id), /^web-/, 'dispositivo registrato nel registro di sincronizzazione');
    assert.equal(stack.files.size - files, 2, 'originale ridotto e scansione caricati (niente PDF dal 25/11)');
    assert.equal(await page.locator('.net-badge:visible').count(), 0);
  });

  await check('reinvio dello stesso movimento (invio interrotto): nessun doppione', async () => {
    // si rimette in coda lo stesso client_uuid già ricevuto, come dopo un'interruzione prima della cancellazione
    const [{ client_uuid }] = (await pool.query('select client_uuid from movements where description = $1', [DESC])).rows;
    await page.evaluate(async ({ id, desc, op }) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('youcount', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      await new Promise((res) => { const t = db.transaction('outbox', 'readwrite');
        t.objectStore('outbox').put({ id, createdAt: new Date().toISOString(), orgId: '', userId: op, label: desc, amount: 1, currency: 'EUR', opDate: '2026-01-01',
          payload: { kind: 'expense' }, cpNew: null, docIds: [], files: [], state: 'pending', attempts: 0 }); t.oncomplete = res; });
      window.dispatchEvent(new Event('youcount-outbox'));
    }, { id: client_uuid, desc: DESC, op });
    // dal 25/11 con la rete la coda parte da sola appena cambia: «Invia ora» si tocca solo se è ancora lì
    await page.getByRole('button', { name: 'Invia ora' }).click({ timeout: 3000 }).catch(() => {});
    await page.getByText('Nessun movimento in attesa', { exact: false }).waitFor({ timeout: 20000 });
    const n = (await pool.query('select count(*)::int n from movements where description = $1', [DESC])).rows[0].n;
    assert.equal(n, 1);
  });

  await check('senza rete: le pagine principali si aprono subito dalla copia, con l\'avviso dei dati salvati', async () => {
    await ctx.setOffline(true);
    for (const path of ['/', '/movimenti', '/anticipi', '/conti', '/scadenze']) {
      const t0 = Date.now();
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.stale-note', { hasText: 'Senza rete' }).waitFor({ timeout: 5000 });
      const ms = Date.now() - t0;
      assert.ok(ms < 2500, `${path} aperta in ${ms} ms`);
      assert.ok(!(await page.locator('h1', { hasText: 'Sei senza rete' }).count()), `${path}: non la pagina di ripiego`);
    }
    // navigazione interna senza rete: dalla barra in basso si passa a un'altra pagina salvata
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.stale-note').waitFor();
    const t1 = Date.now();
    await page.locator('nav a[href="/movimenti"]:visible').first().click();
    await page.waitForURL(/\/movimenti$/, { timeout: 8000 });
    await page.locator('.stale-note', { hasText: 'Senza rete' }).waitFor({ timeout: 5000 });
    assert.ok(Date.now() - t1 < 4000, `navigazione interna in ${Date.now() - t1} ms`);
    await ctx.setOffline(false);
  });

  await check('rete lenta: la copia salvata compare entro 4 secondi, poi «Dati nuovi · Aggiorna»', async () => {
    const slow = async (route) => { await new Promise((r) => setTimeout(r, 7000)); await route.continue().catch(() => {}); };
    const isMov = (u) => new URL(u).pathname === '/movimenti';
    await ctx.route(isMov, slow);
    try {
      const t0 = Date.now();
      await page.goto(`${base}/movimenti`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('.stale-note', { hasText: 'Rete lenta' }).waitFor({ timeout: 5000 });
      const ms = Date.now() - t0;
      assert.ok(ms < 4500, `pagina mostrata in ${ms} ms`);
      await page.getByRole('button', { name: 'Dati nuovi · Aggiorna' }).waitFor({ timeout: 15000 });
    } finally { await ctx.unroute(isMov, slow); }
  });

  await check('rete lenta: Registra mette in coda dopo pochi secondi e arriva un solo movimento', async () => {
    const D2 = `PROVA rete lenta ${randomUUID().slice(0, 6)}`;
    const slow = async (route) => { await new Promise((r) => setTimeout(r, 10000)); await route.continue().catch(() => {}); };
    await ctx.route('**/rpc/save_movement', slow);
    try {
      await page.goto(`${base}/nuovo`);
      await page.locator('#amount').waitFor();
      await page.fill('#amount', '12000');
      await page.fill('#desc', D2);
      await page.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
      await page.selectOption('#category', { index: 1 });
      await page.selectOption('#project', { index: 1 });
      await page.locator('input[type=file]').nth(1).setInputFiles(new URL('./fixtures/scontrino.jpg', import.meta.url).pathname);
      await page.getByRole('button', { name: 'Ritocca' }).click();
      await page.locator('.scan-busy').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Usa la scansione' }).click();
      await page.waitForTimeout(3000);              // caricamento del giustificativo (non rallentato)
      const t0 = Date.now();
      await page.getByRole('button', { name: 'Registra' }).click();
      await page.getByText(/Salvato sul telefono|invio si completa da solo/).waitFor({ timeout: 9000 });
      const ms = Date.now() - t0;
      assert.ok(ms < 8000, `messo in coda in ${ms} ms`);
    } finally { await ctx.unroute('**/rpc/save_movement', slow); }
    await page.goto(`${base}/sincronizzazione`);
    for (let i = 0; i < 40; i++) {
      if (!(await page.getByText(D2).count())) break;
      if (await page.getByRole('button', { name: 'Invia ora' }).count()) await page.getByRole('button', { name: 'Invia ora' }).click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(12000);               // anche il primo invio rallentato arriva al server
    const n = (await pool.query('select count(*)::int n from movements where description = $1', [D2])).rows[0].n;
    assert.equal(n, 1, 'un solo movimento, nessun doppione');
  });

  await check('uscita con movimenti non inviati: chiede conferma', async () => {
    // un elemento in coda di un altro utente non viene mai inviato: resta lì e fa scattare l'avviso
    await page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('youcount', 1);
      r.onsuccess = () => { const t = r.result.transaction('outbox', 'readwrite');
        t.objectStore('outbox').put({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), userId: 'altro', label: 'x', amount: 1,
          currency: 'EUR', opDate: '2026-01-01', payload: {}, docIds: [], files: [], state: 'pending', attempts: 0 });
        t.oncomplete = res; };
    }));
    await page.goto(`${base}/altro`);
    let message = '';
    page.once('dialog', (d) => { message = d.message(); d.dismiss(); });
    await page.getByRole('button', { name: 'Esci' }).click();
    await page.waitForTimeout(800);
    assert.match(message, /non ancora inviati/);
    assert.match(page.url(), /\/altro$/, 'annullando si resta nell\'app');
  });
} finally {
  await browser.close();
  try { process.kill(-app.pid); } catch {}
  await stack.stop();
  await pool.end();
}
console.log(`\n${passed} superati, ${failed} falliti`);
process.exit(failed ? 1 : 0);
