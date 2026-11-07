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
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/youcount-e2e';
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
  await pool.query(`update settings set value = 'true' where key = 'ai_reading'`);
  const ym = today.slice(0, 7).split('-').map(Number);
  await as(U.resp, 'insert into fx_rates(org_id, year, month, rate, source) values ((select org_id from profiles where id = $1), $2, $3, 5000, $4)',
    [U.resp, ym[0], ym[1], 'prova e2e']);
  return U;
}

function startNext(stack) {
  const p = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey, AI_MOCK: '1' },
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
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message.replace(/\s+/g, ' ').slice(0, 700)]); }
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
  // PNG 1×1 valido, come finto giustificativo
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  let newId = null;
  await check('operatore: registra un\'uscita in ariary con il giustificativo', async () => {
    const p = op.page;
    await p.goto(`${base}/nuovo`);
    await p.fill('#amount', '250.000');
    await p.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    assert.equal(await p.inputValue('#rate'), '5000', 'tasso proposto dal mese');
    await p.getByText('50,00 €').first().waitFor();
    await p.selectOption('#category', { label: '401 · Materiali di consumo' });
    await p.selectOption('#project', { label: 'École Antanetibe' });
    await p.selectOption('#cp', { value: '__new' });
    await p.fill('input[aria-label="Nome del nuovo fornitore o donatore"]', 'Cartoleria di prova');
    await p.selectOption('#method', { label: 'Contanti' });
    await p.fill('#desc', 'PROVA quaderni');
    await p.locator('input[type=file]').nth(1).setInputFiles({ name: 'scontrino.png', mimeType: 'image/png', buffer: PNG });
    await p.getByRole('button', { name: 'Usa la foto originale' }).click();
    await p.getByText('caricato', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Registra' }).click();
    await p.waitForURL(/\/movimenti\/[0-9a-f-]{36}$/, { timeout: 30000 });
    newId = p.url().split('/').pop();
    const txt = await p.locator('main').innerText();
    assert.match(txt, new RegExp(`MOV-${year}-\\d{3}`));
    assert.match(txt, /50,00\s?€/);
    assert.match(txt, /Cartoleria di prova/);
    const [m] = (await pool.query(`select amount, amount_eur, status, ref, (select count(*)::int from movement_documents where movement_id = m.id) docs,
                                   (select max(seq) from movement_documents where movement_id = m.id) seq
                                   from movements m where id = $1`, [newId])).rows;
    const ref = m.ref; delete m.ref;
    assert.deepEqual(m, { amount: '250000.00', amount_eur: '50.00', status: 'recorded', docs: 1, seq: 1 });
    assert.ok(txt.includes(`${ref}.png`), 'il giustificativo prende il nome del movimento');
    assert.ok(await p.getByRole('link', { name: 'Scarica' }).count() >= 1, 'pulsante di download con il nome del movimento');
    await p.screenshot({ path: `${SHOTS}/op_dettaglio.png`, fullPage: true });
  });
  await check('operatore: foto ritagliata e migliorata, lettura IA, conferma campo per campo', async () => {
    const p = op.page;
    const before = stack.files.size;
    await p.goto(`${base}/nuovo`);
    await p.locator('input[type=file]').nth(1).setInputFiles(new URL('./fixtures/scontrino.jpg', import.meta.url).pathname);
    await p.getByText('Ritaglia e migliora').waitFor();
    await p.getByRole('button', { name: 'Usa la scansione' }).click();
    await p.getByText('caricato', { exact: true }).waitFor({ timeout: 20000 });
    assert.equal(stack.files.size - before, 3, 'originale, scansione migliorata e PDF');
    await p.getByRole('button', { name: 'Leggi con l’IA' }).click();
    await p.getByText('L’IA propone, tu decidi', { exact: false }).waitFor();
    assert.equal(await p.inputValue('#amount'), '125000');
    assert.equal(await p.inputValue('#desc'), 'Quaderni e penne per la scuola');
    assert.match(await p.locator('#category option:checked').innerText(), /^303 ·/);
    assert.equal(await p.inputValue('input[aria-label="Nome del nuovo fornitore o donatore"]'), 'Librairie Mixte Analakely');
    await p.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    await p.selectOption('#project', { label: 'École Bonne Semence' });
    await p.getByRole('button', { name: 'Registra' }).click();
    await p.getByText('Conferma o correggi i campi proposti dall’IA').waitFor();
    await p.screenshot({ path: `${SHOTS}/op_ia.png`, fullPage: true });
    assert.match(p.url(), /\/nuovo$/, 'non registra senza conferma');
    while (await p.getByRole('button', { name: 'Confermo' }).count()) await p.getByRole('button', { name: 'Confermo' }).first().click();
    await p.getByRole('button', { name: 'Registra' }).click();
    await p.waitForURL(/\/movimenti\/[0-9a-f-]{36}$/, { timeout: 30000 });
    const id = p.url().split('/').pop();
    const [m] = (await pool.query(`select m.ai_extracted, m.amount, d.enhanced_path is not null as enh, d.pdf_path is not null as pdf,
        d.extraction->>'model' as model from movements m join movement_documents md on md.movement_id = m.id
        join documents d on d.id = md.document_id where m.id = $1`, [id])).rows;
    assert.deepEqual(m, { ai_extracted: true, amount: '125000.00', enh: true, pdf: true, model: 'mock' });
  });
  await check('operatore: campi obbligatori e possibili doppioni segnalati', async () => {
    const p = op.page;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${base}/nuovo`);
    await p.fill('#amount', '250000');
    await p.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    await p.getByText('Possibili doppioni').waitFor();
    await p.getByRole('button', { name: 'Registra' }).click();
    await p.getByText('Campo obbligatorio').first().waitFor();
    assert.match(p.url(), /\/nuovo$/);
    await p.screenshot({ path: `${SHOTS}/op_nuovo_mobile.png`, fullPage: true });
    await p.setViewportSize({ width: 1280, height: 860 });
  });
  await check('operatore: modifica la propria bozza, lo storico la registra', async () => {
    const p = op.page;
    const [{ id }] = (await pool.query(`select id from movements where description = 'PROVA bozza operatore'`)).rows;
    await p.goto(`${base}/movimenti/${id}/modifica`);
    await p.fill('#amount', '40');
    await p.getByRole('button', { name: 'Salva bozza' }).click();
    await p.waitForURL(new RegExp(`/movimenti/${id}$`));
    const txt = await p.locator('main').innerText();
    assert.match(txt, /-40,00\s?€/);
    assert.match(txt, /modifica · amount/);
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
  await check('sola lettura: rendiconto con entrate A4 e uscite A1 in EUR (200 + 50 dal modulo + 25 letto dall’IA)', async () => {
    await ro.page.goto(`${base}/rendiconto`);
    await ro.page.getByText('Totale uscite').waitFor();
    const txt = await ro.page.locator('main').innerText();
    assert.match(txt, /4\) Erogazioni liberali\s+2\.500,00\s?€/);
    assert.match(txt, /1\) Materie prime, sussidiarie, di consumo e di merci\s+275,00\s?€/);
    await ro.page.screenshot({ path: `${SHOTS}/ro_rendiconto_mobile.png`, fullPage: true });
  });
  await check('operatore: niente "Da verificare" né amministrazione nel menu', async () => {
    await op.page.goto(`${base}/altro`);
    const txt = await op.page.locator('main').innerText();
    assert.doesNotMatch(txt, /Da verificare|Utenti e ruoli|Registro attività/);
    assert.match(txt, /Fornitori e donatori/);
    await op.page.goto(`${base}/admin/utenti`);
    assert.match(await op.page.locator('main').innerText(), /riservata agli amministratori/);
  });

  const rs = await login('resp@test.local');
  await check('responsabile: verifica il movimento inserito dall\'operatore, non il proprio', async () => {
    await rs.page.goto(`${base}/verifica`);
    const rowOp = rs.page.locator('tr', { hasText: 'PROVA materiale scolastico' });
    const rowOwn = rs.page.locator('tr', { hasText: 'PROVA donazione' });
    assert.match(await rowOwn.innerText(), /inserito da te/);
    await rowOp.getByRole('button', { name: 'Verifica' }).click();
    await rs.page.waitForURL(/\/verifica\?ok=MOV-/);
    assert.equal(await rs.page.locator('tr', { hasText: 'PROVA materiale scolastico' }).count(), 0);
    const [{ status }] = (await pool.query(`select status from movements where description = 'PROVA materiale scolastico'`)).rows;
    assert.equal(status, 'verified');
    await rs.page.screenshot({ path: `${SHOTS}/resp_verifica.png`, fullPage: true });
  });

  await check('responsabile: verifica e poi storna il movimento dell\'operatore', async () => {
    const p = rs.page;
    await p.goto(`${base}/movimenti/${newId}`);
    await p.getByRole('button', { name: 'Verifica' }).click();
    await p.waitForURL(/ok=verified/);
    assert.match(await p.locator('main').innerText(), /Verificato/);
    await p.getByText('Storna', { exact: true }).click();
    await p.fill('#reason', 'quaderni restituiti al fornitore');
    await p.getByRole('button', { name: 'Conferma lo storno' }).click();
    await p.waitForURL(/ok=reversed/);
    const txt = await p.locator('main').innerText();
    assert.match(txt, /Storno di/);
    assert.match(txt, /quaderni restituiti/);
    await p.goto(`${base}/movimenti/${newId}`);
    assert.match(await p.locator('main').innerText(), /Stornato da MOV-/);
    const [{ n }] = (await pool.query('select count(*)::int n from movements where reverses_id = $1', [newId])).rows;
    assert.equal(n, 1);
  });

  await check('responsabile: imposta il budget del progetto e crea un finanziamento', async () => {
    const p = rs.page;
    const [{ id: prj }] = (await pool.query(`select id from projects where name = 'École Antanetibe'`)).rows;
    await p.goto(`${base}/progetti/${prj}?anno=${year}`);
    await p.getByText('Imposta il budget').click();
    await p.locator('label', { hasText: '04 · Beni di consumo e merci' }).click();
    await p.keyboard.type('1.000');
    await p.getByRole('button', { name: 'Salva il budget' }).click();
    await p.waitForURL(/ok=budget/);
    await p.getByText('Budget salvato.').waitFor();
    const txt = await p.locator('main').innerText();
    assert.match(txt, /04 · Beni di consumo e merci\s+1\.000,00\s?€\s+0,00\s?€/);
    await p.goto(`${base}/finanziamenti`);
    await p.getByText('Nuovo finanziamento').click();
    await p.fill('#title', 'Bando scuole di prova');
    await p.selectOption('#project_id', { label: 'École Antanetibe' });
    await p.fill('#amount', '12.000');
    await p.getByRole('button', { name: 'Salva', exact: true }).click();
    await p.waitForURL(/\/finanziamenti\/[0-9a-f-]{36}$/);
    assert.match(await p.locator('main').innerText(), /12\.000,00\s?€/);
  });
  await check('operatore: conta di cassa con differenza rispetto al saldo', async () => {
    const p = op.page;
    await p.goto(`${base}/conti`);
    await p.selectOption('#cc-account', { label: 'Cassa Madagascar (contanti) · MGA' });
    await p.fill('#cc-counted', '0');
    await p.getByRole('button', { name: 'Registra la conta' }).click();
    await p.waitForURL(/ok=cash/);
    const row = await p.locator('table.t').last().innerText();
    const [{ system_balance }] = (await pool.query('select system_balance from cash_counts order by created_at desc limit 1')).rows;
    const exp = new Intl.NumberFormat('it-IT', { useGrouping: 'always' }).format(-Number(system_balance));
    assert.ok(Number(system_balance) < 0);
    assert.ok(row.includes(`+${exp}`), `differenza +${exp} in ${row}`);
  });
  await check('esportazione Excel di movimenti e rendiconto', async () => {
    const ExcelJS = require('exceljs');
    for (const [path, needle] of [[`/api/v1/export/movimenti?anno=${year}`, 'PROVA donazione'], [`/api/v1/export/rendiconto?anno=${year}`, 'Erogazioni liberali']]) {
      const r = await rs.page.request.get(base + path);
      assert.equal(r.status(), 200, path);
      assert.match(r.headers()['content-type'], /spreadsheetml/);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await r.body());
      const cells = [];
      wb.worksheets[0].eachRow((row) => row.eachCell((c) => cells.push(String(c.value))));
      assert.ok(cells.some((c) => c.includes(needle)), `${path} contiene ${needle}`);
    }
    const anon = await browser.newContext();
    assert.equal((await anon.request.get(`${base}/api/v1/export/movimenti`)).status(), 401);
    await anon.close();
  });
  await check('dashboard con grafici, rendiconto modello E', async () => {
    const p = rs.page;
    await p.goto(`${base}/`);
    assert.ok(await p.locator('figure svg rect').count() >= 24, 'barre mensili');
    assert.match(await p.locator('main').innerText(), /Uscite per progetto/);
    await p.screenshot({ path: `${SHOTS}/resp_dashboard.png`, fullPage: true });
    await p.goto(`${base}/rendiconto?anno=${year}&modello=E`);
    const txt = await p.locator('main').innerText();
    assert.match(txt, /A\) Entrate da attività di interesse generale/);
    assert.doesNotMatch(txt, /4\) Erogazioni liberali/, 'nel modello E solo le sezioni');
  });

  const sa = await login('andrea@test.local');
  await check('super admin: pagine di amministrazione e lingua francese', async () => {
    for (const [path, text] of [['/admin/utenti', 'Responsabile di prova'], ['/admin/piano-conti', 'Retribuzioni personale locale'],
      ['/admin/registro', 'Movimenti'], ['/admin/periodi', 'Aperto'], ['/admin/impostazioni', 'Quattro occhi'],
      ['/admin/conti', 'BNI Madagascar'], ['/admin/progetti', 'Spese generali'], ['/progetti', 'École Piccolino'],
      ['/conti', 'Saldo iniziale'], ['/controparti', 'Cartoleria di prova'], ['/admin/cambi', 'prova e2e'], ['/sincronizzazione', 'Tappa 4e'], ['/guida', 'Verifica e storni']]) {
      await sa.page.goto(base + path);
      assert.match(await sa.page.locator('main').innerText(), new RegExp(text), path);
    }
    await sa.page.goto(`${base}/altro`);
    await sa.page.screenshot({ path: `${SHOTS}/sa_altro.png`, fullPage: true });
    await sa.page.goto(`${base}/account`);
    await sa.page.getByRole('button', { name: 'Français' }).click();
    await sa.page.waitForURL(/\/account/);
    await sa.page.getByText('Mon compte').first().waitFor();
    await sa.page.goto(`${base}/`);
    const header = await sa.page.locator('header').innerText();
    assert.match(header, /Chaque dépense, sa pièce justificative/);
    assert.match(await sa.page.locator('nav.nav').innerText(), /Tableau de bord/);
    assert.match(await sa.page.locator('main').innerText(), /Trésorerie en Italie/);
    await sa.page.screenshot({ path: `${SHOTS}/sa_dashboard_fr.png`, fullPage: true });
    const [{ lang }] = (await pool.query(`select lang from profiles where email = 'andrea@test.local'`)).rows;
    assert.equal(lang, 'fr');
  });

  await check('uscita: chiude la sessione', async () => {
    await ro.page.goto(`${base}/altro`);
    await ro.page.getByRole('button', { name: 'Esci' }).first().click();
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
