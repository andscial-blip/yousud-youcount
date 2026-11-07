// Test end-to-end: app Next.js (next dev) + PostgREST + database di prova con le vere migrazioni.
// Prepara utenti e movimenti con le funzioni del database, poi entra nell'app con Playwright come
// operatore e come utente in sola lettura e controlla cosa vede ciascuno.
// Uso: npm run db:reset && node tests/e2e/app.e2e.mjs
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import pg from 'pg';
import { startStack, TEST_PASSWORD } from './local-stack.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright');
const DB = process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test';
const APP_PORT = 3312;
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/mizana-e2e';
const pool = new pg.Pool({ connectionString: DB });
const year = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

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
const save = (uid, p) => as(uid, 'select public.save_movement($1) r', [p]).then((r) => r[0].r);

async function seed() {
  const mk = async (email, role, name) => (await pool.query(
    `insert into auth.users(email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [email, { role }, { full_name: name }])).rows[0].id;
  const U = {
    sa: await mk('andrea@test.local', 'super_admin', 'Andrea (prova)'),
    op: await mk('operatore@test.local', 'operator', 'Operatore di prova'),
    resp: await mk('resp@test.local', 'responsabile', 'Responsabile di prova'),
    ro: await mk('lettore@test.local', 'read_only', 'Lettore di prova'),
  };
  await pool.query('update profiles set all_projects = true where id = $1', [U.op]);
  const id = async (t, col, v) => (await pool.query(`select id from ${t} where ${col} = $1`, [v])).rows[0].id;
  const acc = { bi: await id('accounts', 'code', 'Banca Italia'), cm: await id('accounts', 'code', 'Cassa Missione') };
  const nd = { status: 'recorded', no_doc_reason: 'movimento di prova e2e' };
  const prj = await id('projects', 'name', 'École Piccolino');
  await save(U.resp, { ...nd, client_uuid: randomUUID(), kind: 'income', op_date: today, amount: 2500, currency: 'EUR',
    account_id: acc.bi, category_id: await id('categories', 'code', 'E101'), description: 'PROVA donazione' });
  await save(U.op, { ...nd, client_uuid: randomUUID(), kind: 'expense', op_date: today, amount: 1010000, currency: 'MGA',
    fx_rate: 5050, account_id: acc.cm, category_id: await id('categories', 'code', '401'), project_id: prj,
    description: 'PROVA materiale scolastico' });
  await save(U.op, { client_uuid: randomUUID(), kind: 'expense', op_date: today, amount: 35, currency: 'EUR',
    account_id: acc.bi, category_id: await id('categories', 'code', '201'), description: 'PROVA bozza operatore' });
  return U;
}

function startNext(stack) {
  const p = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey },
    stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  p.stdout.on('data', (d) => (log += d));
  p.stderr.on('data', (d) => (log += d));
  return { p, log: () => log };
}
async function waitFor(url, ms = 90000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fetch(url).then((r) => r.status < 500, () => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('app non avviata: ' + url);
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
}

const U = await seed();
const stack = await startStack();
const next = startNext(stack);
const base = `http://localhost:${APP_PORT}`;
const browser = await chromium.launch();
try {
  await waitFor(`${base}/login`);
  const login = async (email, vp = { width: 1280, height: 860 }) => {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(`${base}/`);
    await page.waitForURL(/\/login/);
    await page.fill('#email', email);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(`${base}/`, { timeout: 60000 });
    return { ctx, page };
  };

  await check('senza sessione si viene mandati al login', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${base}/movimenti`);
    assert.match(page.url(), /\/login\?next=%2Fmovimenti/);
    await page.fill('#email', 'operatore@test.local');
    await page.fill('#password', 'sbagliata');
    await page.click('button[type=submit]');
    const alert = page.locator('.note[role=alert]');
    await alert.waitFor();
    assert.match(await alert.innerText(), /non corretti/);
    await ctx.close();
  });

  const op = await login('operatore@test.local');
  await check('operatore: cruscotto con saldi reali', async () => {
    await op.page.getByText('Saldi dei conti').waitFor();
    const txt = await op.page.locator('main').innerText();
    assert.match(txt, /2\.500,00\s?€/, 'saldo Banca Italia');
    assert.match(txt, /-?1\.010\.000\s?MGA|MGA\s?-1\.010\.000/, 'saldo Cassa Missione');
    assert.match(await op.page.locator('header').innerText(), /Operatore di prova · Operatore/);
    await op.page.screenshot({ path: `${SHOTS}/op_cruscotto.png`, fullPage: true });
  });
  await check('operatore: elenco movimenti, la propria bozza visibile', async () => {
    await op.page.goto(`${base}/movimenti`);
    await op.page.getByText('PROVA materiale scolastico').waitFor();
    const txt = await op.page.locator('main').innerText();
    assert.match(txt, /PROVA bozza operatore/);
    assert.match(txt, new RegExp(`MOV-${year}-\\d{3}`));
    await op.page.screenshot({ path: `${SHOTS}/op_movimenti.png`, fullPage: true });
  });
  await check('operatore: rendiconto non accessibile', async () => {
    await op.page.goto(`${base}/rendiconto`);
    assert.match(await op.page.locator('main').innerText(), /visibile a responsabili/);
  });

  const ro = await login('lettore@test.local', { width: 390, height: 844 });
  await check('sola lettura: non vede le bozze altrui', async () => {
    await ro.page.goto(`${base}/movimenti`);
    await ro.page.getByText('PROVA materiale scolastico').waitFor();
    assert.doesNotMatch(await ro.page.locator('main').innerText(), /PROVA bozza operatore/);
    await ro.page.screenshot({ path: `${SHOTS}/ro_movimenti_mobile.png`, fullPage: true });
  });
  await check('sola lettura: rendiconto con entrate A4 e uscite A1 in EUR', async () => {
    await ro.page.goto(`${base}/rendiconto`);
    await ro.page.getByText('Totale uscite').waitFor();
    const txt = await ro.page.locator('main').innerText();
    assert.match(txt, /4\) Erogazioni liberali\s+2\.500,00\s?€/);
    assert.match(txt, /1\) Materie prime, sussidiarie, di consumo e di merci\s+200,00\s?€/);
    await ro.page.screenshot({ path: `${SHOTS}/ro_rendiconto_mobile.png`, fullPage: true });
  });
  await check('uscita: chiude la sessione', async () => {
    await ro.page.goto(`${base}/altro`);
    await ro.page.getByRole('button', { name: 'Esci' }).click();
    await ro.page.waitForURL(/\/login/);
    await ro.page.goto(`${base}/`);
    assert.match(ro.page.url(), /\/login/);
  });
} finally {
  await browser.close();
  try { process.kill(-next.p.pid); } catch {}
  await stack.stop();
  await pool.end();
}
for (const r of results) console.log(r.join(' · '));
const failed = results.filter((r) => r[0] !== 'ok').length;
console.log(`\n${results.length - failed} superati, ${failed} falliti`);
if (failed) { console.log(next.log().slice(-3000)); process.exit(1); }
void U;
