// Controllo dell'impaginazione: ogni pagina dell'app, in italiano e in francese, a più larghezze
// (telefoni piccoli e grandi, tablet, PC). Segnala ogni elemento visibile che esce dallo schermo o che
// viene tagliato da un contenitore senza i puntini di sospensione. Le tabelle dentro un contenitore che
// scorre in orizzontale sono ammesse e vengono solo contate.
// Uso: npm run test:layout   (prepara il database di prova da solo)
import { readFileSync } from 'node:fs';
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
  // anticipo a una persona con nome lungo: consegna di 40 giorni fa, una spesa senza scontrino (per il modulo AUT)
  await as(sa, `select public.create_advance_account('Fanomezantsoa Rakotondrabe', 'MGA', 'MG') r`);
  const advId = (await pool.query(`select id from accounts where holder = 'Fanomezantsoa Rakotondrabe'`)).rows[0].id;
  const old = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  await save({ ...base, client_uuid: randomUUID(), kind: 'transfer', op_date: old, amount: 1250000, to_amount: 1250000, currency: 'MGA',
    fx_rate: 5055.37, account_id: cm, to_account_id: advId, description: 'Anticipo in contanti a Fanomezantsoa Rakotondrabe' });
  const advMov = (await save({ ...base, client_uuid: randomUUID(), kind: 'expense', op_date: today, amount: 87500, currency: 'MGA', fx_rate: 5055.37,
    account_id: advId, paid_by: 'Fanomezantsoa Rakotondrabe', category_id: await id('categories', 'code', '203'), project_id: prj,
    description: 'Pranzo al mercato di Ambanja per la squadra di consegna', no_doc_reason: 'venditrice ambulante senza ricevute' })).id;
  // preventivo in bozza con righe lunghe, una scadenza con titolo lungo, una ricevuta in bozza
  const Y = Number(today.slice(0, 4));
  const bd = (await as(sa, 'select public.budget_draft($1, null, $2) r', [Y, 'Preventivo di prova con un titolo abbastanza lungo']))[0].r;
  for (const [code, cur, cost, rate] of [['401', 'MGA', 2500000, 5055.37], ['201', 'EUR', 1250, null], ['E101', 'EUR', 25000, null]])
    await as(sa, 'select public.budget_item_save($1)', [{ budget_id: bd.id, category_id: await id('categories', 'code', code), project_id: prj, qty: 12, unit: 'mesi',
      unit_cost: cost, currency: cur, fx_rate: rate, description: 'Materiale didattico e quaderni per tutte le classi della scuola, consegna trimestrale' }]);
  await as(sa, 'select public.deadline_save($1)', [{ title: 'Rendicontazione intermedia al finanziatore con relazione narrativa e prospetto delle spese ammissibili', category: 'prj', due_date: today, amount: 125000, priority: 'high' }]);
  const doc0 = (await as(sa, 'select public.issued_doc_save($1) r', [{ type: 'NOT', party_name: 'Fanomezantsoa Rakotondrabe Andriamanantena', party_address: 'Lot II M 89 bis Antananarivo 101',
    amount: 0, currency: 'EUR', lang: 'both', data: { lines: [{ d: 'Formazione degli insegnanti sulla didattica inclusiva, tre giornate', q: 3, p: 180 }], ritenuta: 20, method: 'Bonifico' } }]))[0].r;
  const movId = typeof mov === 'object' ? (mov.id ?? mov) : mov;
  const org = (await pool.query('select org_id from profiles where id = $1', [sa])).rows[0].org_id;
  // dati reali dell'ente (dai documenti di YouSud: rendiconto 2024, risposte RUNTS, Annual Report 2025) e logo, solo nel DB di prova
  const logo = readFileSync(new URL('./yousud-logo.b64', import.meta.url), 'utf8').trim();
  for (const [key, value] of [
    ['org_details', { legal_name: 'YOUSUD ODV', address: 'Viale Carlo III di Borbone 8, Caserta', tax_id: '93126200612', iban: 'IT68W0514274890CC1086036145',
      runts: 'Iscritta al RUNTS, sez. Organizzazioni di Volontariato, rep. n. 26545 del 15/04/2022', email: 'info@yousud.it', phone: '+39 329 817 0997', web: 'www.yousud.it' }],
    ['org_logo', { mime: 'image/png', data: logo }], ['doc_signer', { name: 'Pasquale Esposito', role: 'Presidente' }]])
    await pool.query('insert into settings(org_id, key, value, updated_by) values ($1, $2, $3, $4) on conflict (org_id, key) do update set value = excluded.value', [org, key, value, sa]);
  const grant = (await pool.query(`insert into grants(org_id, title, project_id, amount, start_date, end_date) values ($1, $2, $3, 48000, $4, $4) returning id`,
    [org, 'Bando Fondazione per l’istruzione primaria in Madagascar 2026–2028', prj, today])).rows[0].id;
  if (process.env.DEMO) {   // anteprima con un anno di dati dimostrativi (src/lib/demo)
    const { execFileSync } = await import('node:child_process');
    const payload = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/demo-payload.mjs', String(Y)], { maxBuffer: 1 << 26 }).toString();
    await as(sa, 'select public.demo_load($1)', [payload]);
  }
  return { sa, movId, prj, grant, bi, advMov, doc0: doc0.id };
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
  // 3) etichette brevi che vanno a capo (pulsanti, schede, titoli, intestazioni di colonna, etichette delle cifre)
  // righe occupate dal solo testo (le icone accanto o sopra il testo non contano)
  const lines = (el) => {
    const tops = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0.5) tops.push(q.top + q.height / 2);
    }
    tops.sort((a, b) => a - b);
    let k = tops.length ? 1 : 0;
    for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > 6) k++;
    return k;
  };
  const SHORT = 'button, .btn, a.chip, .chip, .seg > *, .subnav a, .side-link, .bnav a, th, h1, h2, .hn-main span, .hero-nums span, .kpi .l, .eyebrow, label > span, .cdp, .tag, .pill, .num, .yearsel select';
  for (const el of document.querySelectorAll(SHORT)) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || inScroller(el)) continue;
    if (el.getBoundingClientRect().width < 3) continue;   // nascosto per l'accessibilità
    const txt = (el.innerText || '').trim().replace(/\s+/g, ' ');
    if (!txt || txt.length > 34 || el.closest('.cmdk, .vh, .skip')) continue;
    if (lines(el) > 1) bad.push(`va a capo: ${name(el)}`);
  }
  // 4) ultima riga di un paragrafo con una parola sola di 1-3 lettere (orfana)
  const tw = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.textContent.trim();
    if (t.length < 12 || !n.parentElement || inScroller(n.parentElement)) continue;
    const ps = getComputedStyle(n.parentElement);
    if (ps.display === 'none' || ps.visibility === 'hidden') continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter((q) => q.width > 0.5);
    const tops = [...new Set(rs.map((q) => Math.round(q.top)))];
    if (tops.length < 2) continue;
    const last = rs.filter((q) => Math.round(q.top) === tops[tops.length - 1]);
    const w = last.reduce((a, q) => a + q.width, 0);
    const lastWord = t.split(/\s+/).pop();
    if (w < 26 && lastWord.length <= 3) bad.push(`parola orfana «${lastWord}» in fondo a: ${name(n.parentElement)}`);
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
    '/controparti', '/rimborsi', '/anticipi', `/movimenti/${S.advMov}`, '/riconciliazione', `/riconciliazione?conto=${S.bi}`, '/altro', '/guida', '/account', '/account/password', '/sincronizzazione',
    '/admin/utenti', '/admin/conti', '/admin/progetti', '/admin/piano-conti', '/admin/periodi', '/cambi', '/admin/impostazioni', '/admin/registro',
    '/preventivo', '/preventivo?vista=righe', '/preventivo?vista=schema', '/nuovo?tipo=expense&data=2026-11-03&importo=1234&desc=Riga%20estratto', '/scadenze', '/scadenze?vista=calendario', '/documenti-emessi', `/documenti-emessi/${S.doc0}`,
    '/documenti-emessi/nuovo?tipo=NRS', '/documenti-emessi/nuovo', '/documenti-emessi/nuovo?tipo=DIC', '/documenti-emessi/nuovo?tipo=BDC', '/analisi?vista=andamento', '/analisi?vista=uscite', '/analisi?vista=entrate', '/report?tipo=mensile', '/report?tipo=categorie', '/report?tipo=fornitori', '/report?tipo=nodoc', '/report?tipo=cassa'];
  // ONLY_PATHS=/a,/b: controlla solo quelle pagine (anche con ?parametri; /a/* = tutte le pagine sotto /a/) — prova rapida
  const ONLY = (process.env.ONLY_PATHS ?? '').split(',').filter(Boolean);
  if (ONLY.length) PAGES.splice(0, PAGES.length, ...PAGES.filter((x) => ONLY.some((o) => x === o || x.startsWith(`${o}?`) || (o.endsWith('*') && x.startsWith(o.slice(0, -1))))));
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
    // SERVE=1: anteprima per il lavoro grafico. Salva la sessione e lascia attivi dati, servizi e app (tests/e2e/shot.mjs)
    if (process.env.SERVE) {
      await ctx.storageState({ path: '/tmp/yc-state.json' });
      fs.writeFileSync('/tmp/yc-preview.json', JSON.stringify({ base, S }));
      console.log('PREVIEW READY', base);
      await new Promise(() => {});
    }
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
          p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(401|403|404)/i.test(m.text())) cerr.push(`console: ${m.text().slice(0, 3000)}`); });
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
          // le tabelle diventano schede dopo l'idratazione (TableCards): si misura a trasformazione avvenuta
          await p.waitForFunction(() => [...document.querySelectorAll('table.t:not(.keep)')].every((t) => t.hasAttribute('data-cards')
            || !((t.tHead?.rows[0]?.cells.length ?? 0) >= 4) || t.querySelector('th.hm')), null, { timeout: 4000 }).catch(() => {});
          const { bad: bad0, scrollers } = await p.evaluate(audit);
          // pagina caricata male (dati non disponibili, errore del database nell'indirizzo): conta come problema
          const loadErr = [];
          const mainTxt = await p.locator('main').innerText().catch(() => '');
          if (/Dati non disponibili|Données indisponibles|schema cache|Could not find the function/i.test(mainTxt) || /[?&]err=/.test(p.url())) loadErr.push(`errore di caricamento: ${p.url().replace(base, '')}`);
          const bad = [...bad0, ...new Set(cerr), ...loadErr];
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
