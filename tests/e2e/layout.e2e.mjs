// Controllo dell'impaginazione: ogni pagina dell'app, in italiano e in francese, a più larghezze
// (telefoni piccoli e grandi, tablet, PC). Segnala ogni elemento visibile che esce dallo schermo o che
// viene tagliato da un contenitore senza i puntini di sospensione. Le tabelle dentro un contenitore che
// scorre in orizzontale sono ammesse e vengono solo contate.
// Uso: npm run test:layout   (prepara il database di prova da solo)
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import pg from 'pg';
import { startStack, TEST_PASSWORD } from './local-stack.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright');
const DB = process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test';
const APP_PORT = 3313;
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/youcount-layout';
const WIDTHS = (process.env.WIDTHS ?? '320,360,390,412,600,768,820,1024,1280').split(',').map(Number);
const LANGS = (process.env.LANGS ?? 'it,fr').split(',');
const pool = new pg.Pool({ connectionString: DB });
const today = new Date().toISOString().slice(0, 10);
fs.mkdirSync(SHOTS, { recursive: true });

async function as(uid, text, params) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('set local role authenticated');
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const r = await c.query(text, params);
    await c.query('commit');
    return r.rows;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}

// dati realistici e "lunghi": nomi, descrizioni e importi come quelli veri
async function seed() {
  const sa = (await pool.query(`insert into auth.users(email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`,
    ['andrea@test.local', { role: 'super_admin' }, { full_name: 'Andrea Scialabba' }])).rows[0].id;
  await pool.query('update profiles set all_projects = true where id = $1', [sa]);
  const id = async (t, col, v) => (await pool.query(`select id from ${t} where ${col} = $1`, [v])).rows[0].id;
  const bi = await id('accounts', 'code', 'Banca Italia');
  const cm = await id('accounts', 'code', 'Cassa Missione');
  const prj = await id('projects', 'name', 'École Piccolino');
  const save = (p) => as(sa, 'select public.save_movement($1) r', [p]).then((r) => r[0].r);
  const base = { status: 'recorded', no_doc_reason: 'prova impaginazione' };
  const mov = await save({ ...base, client_uuid: randomUUID(), kind: 'income', op_date: today, amount: 12500.5, currency: 'EUR',
    account_id: bi, category_id: await id('categories', 'code', 'E201'), project_id: prj,
    description: 'Bonifico da G E G Sport Srl – EROGAZIONE LIBERALE PROGETTO SCUOLA IL PICCOLO MADAGASCAR LUGLIO' });
  await save({ ...base, client_uuid: randomUUID(), kind: 'expense', op_date: today, amount: 21240000, currency: 'MGA', fx_rate: 5055.37,
    account_id: cm, category_id: await id('categories', 'code', '203'), project_id: prj,
    description: 'Alloggio in camere climatizzate, 3 notti, 4 persone, delegazione Esselunga Ambanja' });
  await save({ ...base, client_uuid: randomUUID(), kind: 'transfer', op_date: today, amount: 4300, currency: 'EUR',
    account_id: bi, to_account_id: await id('accounts', 'code', 'Banca Missione'), to_amount: 21738091,
    description: 'Giroconto da conto italiano a conto malgascio' });
  await save({ ...base, status: 'draft', client_uuid: randomUUID(), kind: 'expense', op_date: today, amount: 45000, currency: 'MGA', fx_rate: 5055.37,
    account_id: null, reimb_status: 'due', paid_by: 'Chanfy Rakotomalala', category_id: await id('categories', 'code', '203'), project_id: prj,
    description: 'Taxi-brousse Antananarivo – Ambanja per consegna materiale scolastico' });
  const movId = typeof mov === 'object' ? (mov.id ?? mov) : mov;
  const org = (await pool.query('select org_id from profiles where id = $1', [sa])).rows[0].org_id;
  const grant = (await pool.query(`insert into grants(org_id, title, project_id, amount, start_date, end_date) values ($1, $2, $3, 48000, $4, $4) returning id`,
    [org, 'Bando Fondazione per l’istruzione primaria in Madagascar 2026–2028', prj, today])).rows[0].id;
  return { sa, movId, prj, grant, bi };
}

function startNext(stack) {
  const p = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey, AI_MOCK: '1' },
    stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  return p;
}
async function waitFor(url, ms = 90000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fetch(url).then((r) => r.status < 500, () => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('app non avviata: ' + url);
}

// eseguito nella pagina: elenco degli elementi che escono dallo schermo o vengono tagliati
function audit() {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  const scrollers = [];
  const name = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    return `${el.tagName.toLowerCase()}${cls}${txt ? ` «${txt}»` : ''}`;
  };
  const inScroller = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(auto|scroll)/.test(s.overflowX)) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed' && s.clip !== 'auto') continue;
    if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) scrollers.push(`${name(el).slice(0, 40)} (+${el.scrollWidth - el.clientWidth}px)`);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;   // elementi nascosti per l'accessibilità
    if (inScroller(el)) continue;
    // 1) fuori dallo schermo
    if (r.right > vw + 1 || r.left < -1) {
      // si segnala solo l'elemento più interno (quello che contiene davvero il testo o il controllo)
      const child = [...el.children].some((c) => { const q = c.getBoundingClientRect(); return q.width >= 2 && (q.right > vw + 1 || q.left < -1); });
      if (!child) bad.push(`fuori schermo di ${Math.round(Math.max(r.right - vw, -r.left))}px: ${name(el)}`);
    }
    // 2) testo tagliato da un contenitore senza puntini di sospensione
    if (s.overflowX === 'hidden' && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && el.innerText?.trim()) {
      bad.push(`testo tagliato di ${el.scrollWidth - el.clientWidth}px: ${name(el)}`);
    }
  }
  if (document.documentElement.scrollWidth > vw + 1) bad.push(`la pagina scorre in orizzontale di ${document.documentElement.scrollWidth - vw}px`);
  return { bad: [...new Set(bad)], scrollers };
}

const S = await seed();
const stack = await startStack();
const next = startNext(stack);
const base = `http://localhost:${APP_PORT}`;
const browser = await chromium.launch();
const report = [];
const scrolling = new Map();   // pagine con tabelle che scorrono su telefono (non è un errore, ma va valutato)
let total = 0;
try {
  await waitFor(`${base}/login`);
  const PAGES = ['/login', '/offline', '/', '/movimenti', `/movimenti/${S.movId}`, `/movimenti/${S.movId}/modifica`, '/nuovo', '/nuovo#doc',
    '/verifica', '/analisi', '/documenti', '/progetti', `/progetti/${S.prj}`, '/finanziamenti', `/finanziamenti/${S.grant}`, '/conti', '/rendiconto',
    '/controparti', '/rimborsi', '/riconciliazione', `/riconciliazione?conto=${S.bi}`, '/altro', '/guida', '/account', '/account/password', '/sincronizzazione',
    '/admin/utenti', '/admin/conti', '/admin/progetti', '/admin/piano-conti', '/admin/periodi', '/admin/cambi', '/admin/impostazioni', '/admin/registro'];
  // ONLY_PATHS=/a,/b: controlla solo quelle pagine (anche con ?parametri) — prova rapida di una sezione nuova
  const ONLY = (process.env.ONLY_PATHS ?? '').split(',').filter(Boolean);
  if (ONLY.length) PAGES.splice(0, PAGES.length, ...PAGES.filter((x) => ONLY.some((o) => x === o || x.startsWith(`${o}?`))));
  for (const lang of LANGS) {
    await pool.query('update profiles set lang = $1 where id = $2', [lang, S.sa]);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
    await ctx.addCookies([{ name: 'lang', value: lang, url: base }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/`);
    await page.waitForURL(/\/login/);
    await page.fill('#email', 'andrea@test.local');
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(`${base}/`, { timeout: 60000 });
    if (process.env.SPLASH_SHOT) {
      // schermata d'apertura: subito dopo il caricamento (prima che sfumi), su telefono e PC
      for (const w of [390, 1280]) {
        const sp = await ctx.newPage();
        await sp.setViewportSize({ width: w, height: 800 });
        const errs = [];
        sp.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
        await sp.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
        await sp.screenshot({ path: `${SHOTS}/splash_${lang}_${w}.png` });
        await sp.waitForTimeout(1800);
        assert(!(await sp.locator('#splash').isVisible()), 'la schermata d\'apertura sparisce da sola');
        assert.deepEqual(errs.filter((e) => /hydrat|did not match|mismatch/i.test(e)), [], 'nessun errore di idratazione');
        await sp.close();
      }
    }
    // negli screenshot di controllo niente schermata d'apertura (ogni pagina di prova è una sessione nuova)
    await ctx.addInitScript(() => { try { sessionStorage.setItem('yc-splash', '1'); } catch {} });
    await page.close();
    for (const path of PAGES) {
      for (const w of WIDTHS) {
        const anon = path === '/login' || path === '/offline';
        // pagina nuova per ogni controllo: il browser non accumula memoria in centinaia di caricamenti
        const c = anon ? await browser.newContext({ viewport: { width: w, height: 860 }, colorScheme: process.env.DARK ? 'dark' : 'light' }) : ctx;
        let p;
        try {
          p = await c.newPage();
          // errori della pagina e della console (in sviluppo Next mostra «Issue» per questi): sono problemi da correggere
          const cerr = [];
          p.on('pageerror', (e) => cerr.push(`errore: ${e.message.split('\n')[0]}`));
          p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(401|403|404)/i.test(m.text())) cerr.push(`console: ${m.text().split('\n')[0].slice(0, 200)}`); });
          await p.setViewportSize({ width: w, height: 860 });
          await p.goto(base + path.replace('#doc', ''), { waitUntil: 'networkidle', timeout: 60000 });
          if (path === '/nuovo#doc') {
            // stato più affollato del modulo: file dal nome lunghissimo, lettura IA e campi proposti
            await p.locator('input[type=file]').nth(1).setInputFiles({ name: 'CANANGA GARDEN_Proforma_341-AMB-2010-ESS_ESSELUNGA_hotel_Ambanja_novembre.pdf',
              mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${lang}${w}\n%%EOF\n`) });
            await p.locator('.docs .chip').filter({ hasNotText: /Caricamento|Chargement/ }).first().waitFor({ timeout: 30000 });
            const ai = p.locator('.docs .btn.primary');
            if (await ai.count()) { await ai.click(); await p.locator('.chip', { hasText: /Proposto|Proposé/ }).first().waitFor({ timeout: 20000 }).catch(() => {}); }
          }
          const { bad: bad0, scrollers } = await p.evaluate(audit);
          const bad = [...bad0, ...new Set(cerr)];
          if (process.env.SHOT_PATHS === '*' || (process.env.SHOT_PATHS ?? '').split(',').includes(path)) await p.screenshot({ path: `${SHOTS}/view_${process.env.DARK ? 'dark_' : ''}${lang}_${w}_${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.png`, fullPage: true });
          if (scrollers.length && w <= 412) scrolling.set(path, [...(scrolling.get(path) ?? []), `${lang} ${w}: ${scrollers.join('; ')}`]);
          if (bad.length) {
            total += bad.length;
            const shot = `${SHOTS}/${lang}_${w}_${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.png`;
            await p.screenshot({ path: shot, fullPage: true });
            report.push(`### ${lang} · ${w}px · ${path}${scrollers.length ? ` (scorrono: ${scrollers.length})` : ''}\n${bad.map((b) => '- ' + b).join('\n')}\n`);
            fs.writeFileSync(`${SHOTS}/report.md`, report.join('\n'));
          }
        } catch (e) {
          total++;
          report.push(`### ${lang} · ${w}px · ${path}\n- controllo non eseguito: ${e.message.split('\n')[0]}\n`);
        } finally {
          await p?.close().catch(() => {});
          if (anon) await c.close();
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  try { process.kill(-next.pid); } catch {}
  await stack.stop?.();
  await pool.end();
}
const info = [...scrolling].map(([k, v]) => `- ${k}: ${v.join(', ')}`).join('\n');
fs.writeFileSync(`${SHOTS}/report.md`, (report.join('\n') || 'Nessun problema.\n') + (info ? `\n## Tabelle che scorrono in orizzontale su telefono\n${info}\n` : ''));
if (info) console.log('\nTabelle che scorrono su telefono:\n' + info);
console.log(report.join('\n') || 'Nessun problema.');
console.log(`\n${total} problemi su ${LANGS.length} lingue × ${WIDTHS.length} larghezze`);
process.exit(total ? 1 : 0);
