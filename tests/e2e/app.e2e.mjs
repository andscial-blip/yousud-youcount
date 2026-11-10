// Test end-to-end: app Next.js (next dev) + PostgREST + database di prova con le vere migrazioni.
// Prepara utenti e movimenti con le funzioni del database, poi entra nell'app con Playwright come
// operatore e come utente in sola lettura e controlla cosa vede ciascuno.
// Uso: npm run db:reset && node tests/e2e/app.e2e.mjs
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import pg from 'pg';
import ExcelJS from 'exceljs';
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
// ONLY="testo1|testo2": esegue solo i controlli il cui nome contiene uno dei testi (per rieseguire quelli falliti)
const ONLY = (process.env.ONLY ?? '').split('|').filter(Boolean);
async function check(name, fn) {
  if (ONLY.length && !ONLY.some((o) => name.includes(o))) return;
  await keepAlive();
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message.replace(/\s+/g, ' ').slice(0, 700)]); }
}

const U = await seed();
const stack = await startStack();
let next = startNext(stack);
const base = `http://localhost:${APP_PORT}`;
// In questo ambiente il server di sviluppo può essere chiuso per memoria esaurita a metà prova (compila ogni pagina):
// prima di ogni controllo, se non risponde, lo si riavvia. Non cambia ciò che si controlla.
let restarts = 0;
async function keepAlive() {
  if (await fetch(`${base}/login`).then((r) => r.status < 500, () => false)) return;
  try { process.kill(-next.p.pid); } catch {}
  restarts++;
  next = startNext(stack);
  await waitFor(`${base}/login`, 120000);
}
const browser = await chromium.launch();
const _newContext = browser.newContext.bind(browser);
browser.newContext = async (o) => { const c = await _newContext(o); if (!o?.splash) await c.addInitScript(() => { try { sessionStorage.setItem('yc-splash', '1'); } catch {} }); return c; };
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

  await check('pagina di accesso: il logo si vede anche senza sessione', async () => {
    const r = await fetch(`${base}/brand/youcount-mark.svg`, { redirect: 'manual' });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /svg/);
  });
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
    await op.page.getByText('Saldo dei conti').waitFor();
    const txt = await op.page.locator('main').innerText();
    assert.match(txt, /2\.500,00\s?€/, 'saldo Banca Italia');
    assert.match(txt, /-?1\.010\.000\s?MGA|MGA\s?-1\.010\.000/, 'saldo Cassa Missione');
    assert.match(await op.page.locator('aside.side').innerText(), /Operatore di prova · Operatore/);
    await op.page.screenshot({ path: `${SHOTS}/op_cruscotto.png`, fullPage: true });
  });
  await check('operatore: elenco movimenti, la propria bozza visibile', async () => {
    await op.page.goto(`${base}/movimenti`);
    await op.page.locator('text=PROVA materiale scolastico >> visible=true').first().waitFor();
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
    assert.equal(await p.inputValue('#rate'), '5.000', 'tasso proposto dal mese, con il punto delle migliaia');
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
    // la pagina arriva dopo lo scheletro di caricamento
    await p.locator('main [aria-busy=true]').waitFor({ state: 'detached' });
    await p.locator('main h1').waitFor();
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
  await check('operatore: foto ritagliata e migliorata, lettura IA automatica, registrare conferma tutto', async () => {
    const p = op.page;
    const before = stack.files.size;
    await p.goto(`${base}/nuovo`);
    await p.fill('#desc', 'Testo scritto prima del file');
    await p.locator('input[type=file]').nth(1).setInputFiles(new URL('./fixtures/scontrino.jpg', import.meta.url).pathname);
    await p.getByText('Ritaglia e migliora').waitFor();
    await p.getByRole('button', { name: 'Avanti' }).click();
    for (const m of ['Bianco e nero', 'Foto', 'Documento']) {
      await p.getByRole('radio', { name: m }).click();
      await p.getByRole('radio', { name: m, checked: true }).waitFor();
    }
    await p.locator('.scan-busy').waitFor({ state: 'detached' });
    await p.screenshot({ path: `${SHOTS}/op_scan.png` });
    await p.getByRole('button', { name: 'Usa la scansione' }).click();
    await p.getByText('caricato', { exact: true }).waitFor({ timeout: 20000 });
    assert.equal(stack.files.size - before, 3, 'originale, scansione migliorata e PDF');
    // nessun clic: la lettura parte da sola dopo il caricamento
    await p.getByText('Campi compilati dall’IA', { exact: false }).waitFor({ timeout: 20000 });
    assert.equal(await p.inputValue('#amount'), '125.000', 'importo letto, con il punto delle migliaia');
    assert.equal(await p.inputValue('#desc'), 'Testo scritto prima del file', 'la lettura automatica non sovrascrive quanto scritto');
    assert.match(await p.locator('#category option:checked').innerText(), /^303 ·/);
    assert.equal(await p.inputValue('input[aria-label="Nome del nuovo fornitore o donatore"]'), 'Librairie Mixte Analakely');
    assert.equal(await p.getByRole('button', { name: 'Confermo' }).count(), 0, 'nessuna conferma campo per campo');
    await p.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    assert.ok(await p.inputValue('#rate'), 'tasso inserito in automatico');
    await p.selectOption('#project', { label: 'École Bonne Semence' });
    await p.screenshot({ path: `${SHOTS}/op_ia.png`, fullPage: true });
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
    assert.match(txt, /modifica · Importo/);
  });

  await check('operatore: rendiconto non accessibile', async () => {
    await op.page.goto(`${base}/rendiconto`);
    assert.match(await op.page.locator('main').innerText(), /visibile a responsabili/);
  });

  const ro = await login('lettore@test.local', { width: 390, height: 844 });
  await check('sola lettura: non vede le bozze altrui', async () => {
    await ro.page.goto(`${base}/movimenti`);
    await ro.page.locator('text=PROVA materiale scolastico >> visible=true').first().waitFor();
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
    assert.match(txt, /Controparti/);
    await op.page.goto(`${base}/admin/utenti`);
    assert.match(await op.page.locator('main').innerText(), /riservata agli amministratori/);
  });

  await check('operatore: spesa pagata di tasca propria → da rimborsare (senza conto, fuori dai saldi)', async () => {
    const p = op.page;
    await p.goto(`${base}/nuovo`);
    await p.fill('#amount', '18.000');
    assert.equal(await p.inputValue('#paidby'), 'Operatore di prova', 'pagato da: chi è collegato, modificabile');
    await p.getByRole('radio', { name: 'Di tasca propria, da rimborsare' }).click();
    assert.equal(await p.locator('#account').count(), 0, 'nessun conto da scegliere');
    await p.getByRole('radio', { name: 'MGA' }).click();
    assert.ok(await p.inputValue('#rate'), 'tasso proposto');
    await p.selectOption('#category', { label: '401 · Materiali di consumo' });
    await p.selectOption('#project', { label: 'Sapone Solidale' });
    await p.fill('#desc', 'PROVA taxi da rimborsare');
    await p.getByLabel(/Il giustificativo non c/).check();
    await p.fill('#nodoc', 'il tassista non rilascia ricevute');
    assert.equal(await p.getByRole('button', { name: 'Salva bozza' }).count(), 0);
    await p.getByRole('button', { name: 'Salva da rimborsare' }).click();
    await p.waitForURL(/\/movimenti\/[0-9a-f-]{36}$/, { timeout: 30000 });
    await p.locator('main [aria-busy=true]').waitFor({ state: 'detached' });
    assert.match(await p.locator('main').innerText(), /Da rimborsare[\s\S]*Operatore di prova/);
    const [m] = (await pool.query(`select status, reimb_status, account_id, paid_by, currency, amount::int from movements where description = 'PROVA taxi da rimborsare'`)).rows;
    assert.deepEqual(m, { status: 'draft', reimb_status: 'due', account_id: null, paid_by: 'Operatore di prova', currency: 'MGA', amount: 18000 });
    // l'operatore vede la spesa in "Da rimborsare" ma non può rimborsarla
    await p.goto(`${base}/rimborsi`);
    await p.getByText('PROVA taxi da rimborsare').waitFor();
    assert.equal(await p.getByRole('button', { name: /Registra il rimborso/ }).count(), 0);
  });
  const rs = await login('resp@test.local');
  const sa = await login('andrea@test.local');
  await check('responsabile: rimborsa la spesa → registrata con la data del rimborso e il conto scelto', async () => {
    const p = rs.page;
    await p.goto(`${base}/`);
    await p.getByRole('link', { name: /1 spesa da rimborsare/ }).click();
    await p.waitForURL(/\/rimborsi$/);
    const panel = p.locator('section.panel', { hasText: 'PROVA taxi da rimborsare' });
    await panel.locator('select[name=account_id]').selectOption({ label: 'Cassa Madagascar (contanti)' });
    await panel.getByRole('button', { name: /Registra il rimborso/ }).click();
    await p.waitForURL(/\/rimborsi\?ok=MOV-/);
    await p.getByText('Nessuna spesa da rimborsare.').waitFor();
    await p.getByText('Ultimi rimborsi').waitFor();
    const [m] = (await pool.query(`select m.status, m.reimb_status, a.code, m.op_date::text d, m.ref, m.recorded_by = (select id from profiles where full_name = 'Responsabile di prova') by_resp
      from movements m join accounts a on a.id = m.account_id where m.description = 'PROVA taxi da rimborsare'`)).rows;
    assert.deepEqual([m.status, m.reimb_status, m.code, m.d, m.by_resp], ['recorded', 'paid', 'Cassa Missione', today, true]);
    assert.match(m.ref, new RegExp(`^MOV-${year}-\\d{3}$`));
    await p.screenshot({ path: `${SHOTS}/resp_rimborsi.png`, fullPage: true });
  });
  await check('responsabile: riconciliazione bancaria con l\'estratto (quadra solo al centesimo)', async () => {
    const p = rs.page;
    await p.goto(`${base}/riconciliazione`);
    await p.locator('a.rec-card', { hasText: 'Satispay' }).click();
    await p.waitForURL(/\/riconciliazione\?conto=/);
    const [{ bal, n }] = (await pool.query(`select a.opening_balance + coalesce(sum(case when m.id is null then 0
        when m.account_id = a.id then (case when m.kind = 'income' then m.amount else -m.amount end) * m.sign
        else m.to_amount * m.sign end), 0) as bal, count(m.id)::int n
      from accounts a left join movements m on (m.account_id = a.id or m.to_account_id = a.id) and m.status <> 'draft' and m.op_date <= current_date
      where a.code = 'Satispay' group by a.opening_balance`)).rows;
    const it = (v) => `${v < 0 ? '-' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}`;
    const confirm = p.getByRole('button', { name: 'Conferma la riconciliazione' });
    await p.getByLabel(/Saldo dell’estratto/).fill(it(Number(bal) + 1));
    assert.equal(await confirm.isDisabled(), true, 'non quadra: conferma disattivata');
    await p.getByLabel(/Saldo dell’estratto/).fill(Number(bal) === 0 ? '0' : it(Number(bal)));
    await p.getByText('Quadra').waitFor();
    await confirm.click();
    await p.waitForURL(/ok=1/);
    await p.getByText('Riconciliazione registrata.').waitFor();
    await p.getByText('Riconciliazioni fatte').waitFor();
    const [r] = (await pool.query(`select items_count, statement_balance from bank_reconciliations b join accounts a on a.id = b.account_id where a.code = 'Satispay'`)).rows;
    assert.deepEqual([r.items_count, Number(r.statement_balance)], [n, Number(bal)]);
    await p.screenshot({ path: `${SHOTS}/resp_riconciliazione.png`, fullPage: true });
  });
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

  await check('responsabile: preventivo del progetto in sola lettura (si modifica nel Preventivo) e nuovo finanziamento', async () => {
    const p = rs.page;
    const [{ id: prj }] = (await pool.query(`select id from projects where name = 'École Antanetibe'`)).rows;
    await p.goto(`${base}/progetti/${prj}?anno=${year}`);
    // il preventivo si modifica solo nella pagina Preventivo: qui si legge, con il collegamento
    const link = p.getByRole('link', { name: 'modifica nel Preventivo →' });
    assert.match(await link.getAttribute('href'), new RegExp(`/preventivo\\?anno=${year}&vista=analisi&progetto=${prj}`));
    assert.equal(await p.getByText('Imposta il budget').count(), 0);
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
    // conta per tagli: 2 × 20.000 + 3 × 500 = 41.500 MGA, differenza calcolata subito
    await p.getByLabel('Quantità del taglio 20.000', { exact: true }).fill('2');
    await p.getByLabel('Quantità del taglio 500', { exact: true }).fill('3');
    assert.match((await p.locator('.cc-res').innerText()).replace(/[\u00a0\u202f]/g, ' '), /41\.500 MGA/);
    await p.getByLabel('Quantità del taglio 20.000', { exact: true }).fill('');
    await p.getByLabel('Quantità del taglio 500', { exact: true }).fill('');
    // cassa vuota: basta scrivere 0 in un taglio
    await p.getByLabel('Quantità del taglio 500', { exact: true }).fill('0');
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
  await check('rendiconto al finanziatore: Excel con riepilogo, spese con giustificativi ed entrate; vietato agli operatori', async () => {
    const ExcelJS = require('exceljs');
    const [{ id: org }] = (await pool.query('select id from organizations')).rows;
    const [{ id: gid }] = (await pool.query(`insert into grants(org_id, title, code, amount, currency, start_date, end_date)
      values ($1, 'PROVA bando scuola', 'PB-01', 10000, 'EUR', $2, $3) returning id`, [org, `${year}-01-01`, `${year}-12-31`])).rows;
    // movimenti registrati (non verificati: quelli verificati non cambiano più), uno di spesa e uno di entrata
    const pick = async (kind) => (await pool.query(`select id, description from movements where kind = $1 and status = 'recorded'
      and reverses_id is null and extract(year from op_date) = $2 order by op_date limit 1`, [kind, year])).rows[0];
    const e = await pick('expense'); const i = await pick('income');
    assert.ok(e && i, 'movimenti registrati di prova');
    await pool.query(`update movements set grant_id = $1 where id = any($2)`, [gid, [e.id, i.id]]);
    const [{ spent, recv }] = (await pool.query(`select
        coalesce(sum(amount_eur * sign) filter (where kind = 'expense'), 0)::float spent,
        coalesce(sum(amount_eur * sign) filter (where kind = 'income'), 0)::float recv
      from movements where grant_id = $1 and status <> 'draft'`, [gid])).rows;
    assert.ok(spent > 0 && recv > 0, 'dati di prova');
    // dalla pagina del finanziamento
    await rs.page.goto(`${base}/finanziamenti/${gid}`);
    const [dl] = await Promise.all([rs.page.waitForEvent('download'), rs.page.getByRole('button', { name: 'Scarica il rendiconto (Excel)' }).click()]);
    assert.match(dl.suggestedFilename(), /^rendiconto-pb-01-/);
    await dl.saveAs(`${SHOTS}/rendiconto_finanziatore.xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await dl.path());
    assert.deepEqual(wb.worksheets.map((w) => w.name), ['Riepilogo', 'Spese', 'Entrate']);
    const val = (ws, label) => { let v; ws.eachRow((r) => { if (r.getCell(1).value === label) v = r.getCell(2).value; }); return v; };
    assert.equal(val(wb.getWorksheet('Riepilogo'), 'Speso nel periodo EUR'), spent);
    assert.equal(val(wb.getWorksheet('Riepilogo'), 'Ricevuto nel periodo EUR'), recv);
    const sp = []; wb.getWorksheet('Spese').eachRow((r) => sp.push(r.values.join('|')));
    assert.ok(sp.some((x) => x.includes(e.description)), 'spesa elencata');
    assert.ok(!sp.some((x) => x.includes(i.description)), 'entrata non tra le spese');
    // periodo che esclude tutto: totali a zero
    const r0 = await rs.page.request.get(`${base}/api/v1/export/finanziamento?id=${gid}&dal=${year - 1}-01-01&al=${year - 1}-01-31`);
    const wb0 = new ExcelJS.Workbook(); await wb0.xlsx.load(await r0.body());
    assert.equal(val(wb0.getWorksheet('Riepilogo'), 'Speso nel periodo EUR'), 0);
    assert.equal((await op.page.request.get(`${base}/api/v1/export/finanziamento?id=${gid}`)).status(), 403);
    assert.equal((await rs.page.request.get(`${base}/api/v1/export/finanziamento?id=${randomUUID()}`)).status(), 404);
    await pool.query(`update movements set grant_id = null where grant_id = $1`, [gid]);
    await pool.query(`delete from grants where id = $1`, [gid]);
  });
  await check('movimenti: ricerca per descrizione o numero e filtro «Senza giustificativo»', async () => {
    const p = rs.page;
    await p.goto(`${base}/movimenti`);
    // i filtri si applicano da soli: si scrive e, dopo una breve pausa, la lista si aggiorna senza premere nulla
    await p.getByRole('searchbox').fill('donazione');
    await p.waitForURL(/q=donazione/);
    await p.getByText('PROVA donazione').first().waitFor();
    const txt = await p.locator('main table').innerText();
    assert.match(txt, /PROVA donazione/);
    assert.doesNotMatch(txt, /PROVA materiale scolastico/);
    const [{ ref }] = (await pool.query(`select ref from movements where ref is not null order by ref limit 1`)).rows;
    await p.goto(`${base}/movimenti?q=${ref}`);
    assert.equal(await p.locator('main tbody tr').count(), 1, 'ricerca per numero MOV');
    // pulsante «Filtri»: il pannello si apre, un menu si applica subito e il numero dei filtri attivi compare sul pulsante
    await p.goto(`${base}/movimenti`);
    await p.getByRole('button', { name: /^Filtri/ }).click();
    await p.locator('#fb-sheet select[name=tipo]').selectOption('income');
    await p.waitForURL(/tipo=income/);
    await p.locator('.fb-btn .fb-n').filter({ hasText: '1' }).waitFor();
    assert.doesNotMatch(await p.locator('main table').innerText(), /PROVA materiale scolastico/);
    await p.goto(`${base}/movimenti?doc=no`);
    const [{ n }] = (await pool.query(`select count(*)::int n from movements where no_doc_reason is not null`)).rows;
    assert.equal(await p.locator('main .mv-table tbody tr').count(), Math.min(n, 100));
    await p.goto(`${base}/movimenti?q=zzz-niente`);
    await p.getByText('Nessun movimento corrisponde alla ricerca.').waitFor();
  });
  await check('documenti: movimento collegato, ricerca, filtro «Non collegati»', async () => {
    const p = rs.page;
    const [d] = (await pool.query(`select m.ref, m.description from movement_documents md join movements m on m.id = md.movement_id
      where m.ref is not null order by m.ref limit 1`)).rows;
    assert.ok(d, 'un giustificativo collegato a un movimento numerato');
    await p.goto(`${base}/documenti`);
    assert.match(await p.locator('main table').innerText(), new RegExp(d.ref));
    await p.goto(`${base}/documenti?q=${encodeURIComponent(d.ref)}`);
    assert.ok(await p.locator('main tbody tr').count() >= 1);
    for (const row of await p.locator('main tbody tr').allInnerTexts()) assert.match(row, new RegExp(d.ref));
    const [{ n }] = (await pool.query(`select count(*)::int n from documents d where not exists (select 1 from movement_documents md where md.document_id = d.id)`)).rows;
    await p.goto(`${base}/documenti?f=orfani`);
    if (n === 0) await p.getByText('Nessun documento corrisponde alla ricerca.').waitFor();
    else assert.equal(await p.locator('main tbody tr').count(), n);
  });
  await check('documenti: scarica tutti in uno ZIP; un giustificativo senza movimento si scarica e si collega', async () => {
    const p = rs.page;
    await p.goto(`${base}/documenti`);
    const [{ y }] = (await pool.query(`select extract(year from coalesce(d.doc_date, m.op_date, d.created_at::date))::int y
      from documents d left join movement_documents md on md.document_id = d.id left join movements m on m.id = md.movement_id
      order by d.created_at limit 1`)).rows;
    await p.locator('.dzip select').first().selectOption(String(y));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Scarica tutti (ZIP)' }).click()]);
    assert.match(dl.suggestedFilename(), new RegExp(`^giustificativi_${y}\\.zip$`));
    const buf = await fs.promises.readFile(await dl.path());
    assert.equal(buf.subarray(0, 2).toString(), 'PK', 'è un file ZIP');
    // un file caricato e mai collegato: si scarica dalla lista e si collega a un movimento registrato
    const [src] = (await pool.query(`select org_id, original_path, mime, uploaded_by from documents limit 1`)).rows;
    const sha = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const [{ id: orphan }] = (await pool.query(`insert into documents(org_id, client_uuid, doc_type, original_path, sha256, mime, file_name, uploaded_by)
      values ($1, $2, 'receipt', $3, $4, $5, 'ricevuta-sciolta.pdf', $6) returning id`, [src.org_id, randomUUID(), src.original_path, sha, src.mime, src.uploaded_by])).rows;
    const [mv] = (await pool.query(`select id, ref from movements where status = 'recorded' and ref is not null and kind <> 'transfer' order by ref limit 1`)).rows;
    await p.goto(`${base}/documenti?f=orfani`);
    const row = p.locator('main tbody tr', { hasText: 'ricevuta-sciolta.pdf' });
    assert.ok(await row.locator('a.dl-link').getAttribute('href'), 'link per scaricarlo');
    await row.locator('input[name=ref]').fill(mv.ref.toLowerCase());
    await row.getByRole('button', { name: 'Collega' }).click();
    await p.getByText(`Giustificativo collegato a ${mv.ref}.`).waitFor();
    const [{ n }] = (await pool.query(`select count(*)::int n from movement_documents where document_id = $1 and movement_id = $2`, [orphan, mv.id])).rows;
    assert.equal(n, 1);
  });
  await check('analisi: totali dell\'anno uguali al database, gruppi con preventivo, filtro per progetto; vietata agli operatori', async () => {
    const p = rs.page;
    await p.goto(`${base}/analisi`);
    const [{ out }] = (await pool.query(`select coalesce(sum(amount_eur), 0)::float out from v_ledger where kind = 'expense' and year = $1`, [year])).rows;
    const fmtEur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' });
    const figs = await p.locator('.kpi4').innerText();
    assert.ok(figs.replace(/\s/g, '').includes(fmtEur.format(out).replace(/\s/g, '')), `uscite ${fmtEur.format(out)} in ${figs}`);
    await p.goto(`${base}/analisi?vista=uscite`);
    await p.getByText('Uscite per gruppo di spesa e preventivo').waitFor();
    const [{ id: prj }] = (await pool.query(`select project_id id from v_ledger where kind = 'expense' and year = $1 and project_id is not null limit 1`, [year])).rows;
    await p.goto(`${base}/analisi?anno=${year}&progetto=${prj}`);
    assert.equal(await p.locator('select[name=progetto]').inputValue(), prj);
    await op.page.goto(`${base}/analisi`);
    await op.page.getByText('Questa sezione è visibile a responsabili', { exact: false }).waitFor();
    await p.screenshot({ path: `${SHOTS}/resp_analisi.png`, fullPage: true });
  });
  await check('anticipi: nuova persona, consegna, spesa con l\'anticipo, autocertificazione firmata', async () => {
    const p = rs.page;
    await p.goto(`${base}/anticipi`);
    await p.getByText('Altre operazioni').click();
    await p.getByLabel('Nome della persona').fill('Hery');
    await p.getByRole('button', { name: 'Crea', exact: true }).click();
    await p.waitForURL(/\/anticipi\?ok=1/);
    await p.goto(`${base}/anticipi`);
    await p.getByText('Altre operazioni').click();
    await p.locator('#adv').selectOption({ label: 'Hery · MGA' });
    await p.locator('#advcash').selectOption({ label: 'Cassa Madagascar (contanti) · MGA' });
    await p.locator('#advamt').fill('200.000');
    await p.getByRole('button', { name: 'Registra', exact: true }).click();
    await p.waitForURL(/\/anticipi\?(ok|err)=/);
    assert.match(p.url(), /ok=1/, decodeURIComponent(p.url()));
    const [adv] = (await pool.query(`select id, holder from accounts where kind = 'advance' and holder = 'Hery'`)).rows;
    const [tr] = (await pool.query(`select m.amount, m.fx_rate, a.code from movements m join accounts a on a.id = m.account_id
      where m.kind = 'transfer' and m.to_account_id = $1`, [adv.id])).rows;
    assert.deepEqual([tr.amount, tr.fx_rate, tr.code], ['200000.00', '5000.0000', 'Cassa Missione']);
    // nel modulo: «Con l'anticipo» propone solo i conti anticipi e mette la persona in «Pagato da»
    const o = op.page;
    await o.goto(`${base}/nuovo`);
    await o.locator('#account').waitFor();
    if (!(await o.getByRole('radio', { name: 'Con l’anticipo' }).count())) await o.reload();
    await o.getByRole('radio', { name: 'Con l’anticipo' }).click();
    await o.locator('#account').selectOption({ label: 'Hery · MGA' });
    assert.equal(await o.locator('#paidby').inputValue(), 'Hery');
    assert.match(await o.locator('main').innerText(), /non riduce la cassa/);
    // spesa con l'anticipo, senza scontrino
    const [{ op: opId }] = (await pool.query(`select id op from profiles where full_name = 'Operatore di prova'`)).rows;
    const [{ cat, prj }] = (await pool.query(`select (select id from categories where code = '401') cat, (select id from projects where name = 'École Piccolino') prj`)).rows;
    const sp = await save(opId, { client_uuid: randomUUID(), kind: 'expense', status: 'recorded', op_date: today, amount: 50000, currency: 'MGA',
      fx_rate: 5000, account_id: adv.id, category_id: cat, project_id: prj, paid_by: 'Hery', description: 'PROVA mercato con anticipo',
      no_doc_reason: 'mercato senza ricevuta' });
    await p.goto(`${base}/movimenti/${sp.id}`);
    const aut = p.locator('section.panel', { hasText: 'Autocertificazione di spesa' });
    assert.equal(await aut.getByLabel('Dichiarante (chi ha speso)').inputValue(), 'Hery');
    await aut.getByLabel('Luogo della spesa').fill('Antananarivo');
    await aut.getByRole('button', { name: 'Genera il PDF' }).click();
    await p.waitForURL(/ok=aut/);
    await p.getByText('Autocertificazione generata e allegata al movimento.').waitFor();
    const [sc] = (await pool.query(`select s.number, s.amount, s.lang, d.doc_type, d.mime from self_certs s join documents d on d.id = s.document_id
      where s.movement_id = $1`, [sp.id])).rows;
    assert.match(sc.number, new RegExp(`^AUT-${year}-\\d{3}$`));
    assert.deepEqual([sc.amount, sc.lang, sc.doc_type, sc.mime], ['50000.00', 'both', 'self_cert', 'application/pdf']);
    const href = await p.locator('ul.docs a', { hasText: 'Apri' }).first().getAttribute('href');
    const pdf = await p.request.get(href.startsWith('http') ? href : `${base}${href}`);
    const pb = await pdf.body();
    assert.equal(pb.subarray(0, 5).toString(), '%PDF-');
    await p.locator('section.panel', { hasText: sc.number }).getByText('Da firmare').waitFor();
    await p.getByRole('button', { name: 'Copia firmata vista' }).click();
    await p.waitForURL(/ok=aut_signed/);
    await p.locator('section.panel', { hasText: sc.number }).getByText('Firmata', { exact: true }).waitFor();
    // riepilogo: consegnato 200.000, speso 50.000, da giustificare 150.000
    await p.goto(`${base}/anticipi`);
    const row = p.locator('.aw-list > li', { hasText: 'Hery' });
    assert.match((await row.innerText()).replace(/[\u00a0\u202f]/g, ' '), /150\.000 MGA/);
    await row.getByRole('link').click();
    await p.waitForURL(/persona=/);
    const top = (await p.locator('.aw-top').innerText()).replace(/[\u00a0\u202f]/g, ' ');
    assert.match(top, /150\.000 MGA[\s\S]*consegnato 200\.000 MGA · speso 50\.000 MGA/);
    assert.match(await p.locator('.aw-sheet').innerText(), /PROVA mercato con anticipo/);
    await p.screenshot({ path: `${SHOTS}/resp_anticipi.png`, fullPage: true });
  });
  await check('anticipi: richiesta per una persona che non è utente (nome scritto, conto creato da solo)', async () => {
    const o = op.page;
    await o.goto(`${base}/anticipi?nuova=1`);
    await o.locator('#rq-acc').selectOption('new');
    await o.locator('#rq-acc-n').fill('Voahangy Prova');
    await o.locator('#rq-acc-c').selectOption('MGA');
    await o.locator('#rq-amt').fill('15.000');
    await o.locator('#rq-p').fill('PROVA persona nuova');
    await o.getByRole('button', { name: 'Invia la richiesta' }).click();
    await o.waitForURL(/ok=req/);
    const [r] = (await pool.query(`select a.holder, a.currency, r.amount from advance_requests r join accounts a on a.id = r.account_id where r.purpose = 'PROVA persona nuova'`)).rows;
    assert.deepEqual([r.holder, r.currency, r.amount], ['Voahangy Prova', 'MGA', '15000.00']);
    // ora compare nella lista di chi ha un conto anticipi
    await o.goto(`${base}/anticipi?nuova=1`);
    assert.equal(await o.locator('#rq-acc option', { hasText: 'Voahangy Prova · MGA' }).count(), 1);
  });
  await check('anticipi: richiesta con preventivo, autorizzazione a quattro occhi, consegna con ricevuta, restituzione del resto e chiusura automatica', async () => {
    const o = op.page, p = rs.page;
    // 1 richiesta dell'operatore, con il preventivo allegato
    await o.goto(`${base}/anticipi?nuova=1`);
    await o.locator('#rq-acc').selectOption({ label: 'Hery · MGA' });
    await o.locator('#rq-amt').fill('80.000');
    await o.locator('#rq-p').fill('PROVA materiale laboratorio');
    await o.locator('.adv-up input[type=file]').setInputFiles({ name: 'preventivo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 preventivo di prova') });
    await o.getByText('Allegato: preventivo.pdf').waitFor();
    await o.getByRole('button', { name: 'Invia la richiesta' }).click();
    await o.waitForURL(/ok=req/);
    const [rq0] = (await pool.query(`select r.status, d.doc_type from advance_requests r join documents d on d.id = r.estimate_document_id where r.purpose = 'PROVA materiale laboratorio'`)).rows;
    assert.deepEqual([rq0.status, rq0.doc_type], ['requested', 'estimate']);
    // il preventivo non è un giustificativo di spesa
    await p.goto(`${base}/documenti`);
    assert.doesNotMatch(await p.locator('main').innerText(), /preventivo\.pdf/);
    // 2 autorizzazione del responsabile (non è chi ha chiesto); l'operatore non vede i tasti
    await o.goto(`${base}/anticipi`);
    assert.equal(await o.locator('summary', { hasText: 'Autorizza' }).count(), 0);
    await p.goto(`${base}/anticipi`);
    const li = p.locator('.aw-rq > li', { hasText: 'PROVA materiale laboratorio' });
    await li.locator('summary', { hasText: 'Autorizza' }).click();
    await li.locator('.ar-form').getByRole('button', { name: 'Autorizza' }).click();
    await p.waitForURL(/ok=authorize/);
    // 3 consegna: giroconto dalla cassa in ariary al conto anticipi di Hery, poi la ricevuta di consegna da firmare
    await li.locator('summary', { hasText: 'Consegna i contanti' }).click();
    await li.getByRole('button', { name: 'Registra e prepara la ricevuta' }).click();
    await p.waitForURL(/ok=deliver/);
    const [rq] = (await pool.query(`select r.status, m.amount, m.kind, a.holder from advance_requests r join movements m on m.id = r.delivery_movement_id
      join accounts a on a.id = m.to_account_id where r.purpose = 'PROVA materiale laboratorio'`)).rows;
    assert.deepEqual([rq.status, rq.amount, rq.kind, rq.holder], ['delivered', '80000.00', 'transfer', 'Hery']);
    await p.getByRole('link', { name: 'Apri la ricevuta di consegna →' }).click();
    await p.getByRole('heading', { name: 'Ricevuta di consegna' }).waitFor();
    assert.match((await p.locator('main').innerText()).replace(/[  ]/g, ' '), /Hery[\s\S]*dichiara di aver ricevuto[\s\S]*80\.000 MGA/);
    // avviso in Scadenze per le ricevute
    await o.goto(`${base}/scadenze?periodo=30`);
    await o.locator('ul.dl').getByRole('link', { name: 'Giustificare l’anticipo: Hery' }).waitFor();
    // portafoglio di Hery: ricevuta di consegna firmata caricata, poi restituzione del resto → saldo a zero e chiusura automatica
    const [{ acc }] = (await pool.query(`select id acc from accounts where kind = 'advance' and holder = 'Hery'`)).rows;
    await p.goto(`${base}/anticipi?persona=${acc}`);
    await p.locator('.aw-rc input[type=file]').setInputFiles({ name: 'ricevuta-firmata.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 firmata') });
    await p.locator('.aw-rc', { hasText: 'firmata ✓' }).waitFor();
    assert.match((await p.locator('.aw-top > b').innerText()).replace(/[  ]/g, ' '), /230\.000 MGA/);
    await p.locator('.aw-btns summary', { hasText: 'Restituzione' }).click();
    await p.getByRole('button', { name: 'Registra la restituzione' }).click();
    await p.waitForURL(/ok=closed/);
    const [{ st, dd }] = (await pool.query(`select r.status st, d.doc_type dd from advance_requests r join documents d on d.id = r.delivery_document_id where purpose = 'PROVA materiale laboratorio'`)).rows;
    assert.deepEqual([st, dd], ['closed', 'delivery_receipt']);
  });
  await check('preventivo: griglia codici × progetti (cella scritta e dettaglio in ariary), approvazione con delibera, confronto, Excel', async () => {
    const p = rs.page;
    await p.goto(`${base}/preventivo?anno=${year}`);
    await p.getByRole('button', { name: 'Nuovo preventivo vuoto' }).click();
    await p.waitForURL(/vista=modifica/);
    // codice aggiunto alla griglia, poi il dettaglio della cella (quantità × costo in ariary)
    await p.selectOption('#bv-add', { label: '401 · Materiali di consumo' });
    await p.getByRole('button', { name: 'Aggiungi', exact: true }).click();
    await p.waitForURL(/add=/);
    await p.getByRole('link', { name: 'Dettaglio 401 · École Piccolino' }).click();
    await p.waitForURL(/cella=/);
    await p.fill('#bi-desc', 'Quaderni e penne');
    await p.fill('#bi-qty', '10');
    await p.fill('#bi-unit', 'kit');
    await p.fill('#bi-cost', '100.000');
    await p.selectOption('#bi-cur', 'MGA');
    await p.fill('#bi-rate', '5000');
    await p.getByRole('button', { name: 'Aggiungi la riga' }).click();
    await p.waitForURL(/ok=1.*cella=|cella=.*ok=1/);
    await p.locator('.bv-items li', { hasText: 'Quaderni e penne' }).waitFor();
    // entrata scritta direttamente nella cella (Invio salva)
    await p.goto(`${base}/preventivo?anno=${year}&vista=modifica`);
    await p.selectOption('#bv-add', { label: 'E101 · Donazioni da privati' });
    await p.getByRole('button', { name: 'Aggiungi', exact: true }).click();
    await p.waitForURL(/add=/);
    const cell = p.getByRole('textbox', { name: 'E101 · Generale' });
    await cell.fill('3.000');
    await cell.press('Enter');
    for (let i = 0; i < 40; i++) { if ((await pool.query(`select count(*)::int n from budget_items`)).rows[0].n === 2) break; await p.waitForTimeout(250); }
    const [{ n, eur }] = (await pool.query(`select count(*)::int n, sum(amount_eur)::text eur from budget_items`)).rows;
    assert.deepEqual([n, eur], [2, '3200.00']);
    // cella con ariary: non si scrive direttamente, si apre il dettaglio
    assert.equal(await p.getByRole('textbox', { name: '401 · École Piccolino' }).count(), 0);
    // il responsabile non approva: lo fa un amministratore con la delibera
    assert.equal(await p.getByRole('button', { name: /^Approva (originale|revisione)/i }).count(), 0);
    assert.equal(await p.getByText('Approva…').count(), 0);
    const a = sa.page;
    await a.goto(`${base}/preventivo?anno=${year}`);
    await a.getByText('Approva…').click();
    await a.fill('#apref', 'Delibera CdA di prova');
    await a.getByRole('button', { name: /^Approva originale/i }).click();
    await a.waitForURL(/ok=1/);
    assert.equal((await pool.query(`select status from budgets`)).rows[0].status, 'approved');
    assert.match((await a.locator('main').innerText()).replace(/[\u00a0\u202f]/g, ' '), /In vigore/);
    await a.goto(`${base}/preventivo?anno=${year}&vista=confronto`);
    const txt = (await a.locator('table.cgrid').innerText()).replace(/[\u00a0\u202f]/g, ' ');
    assert.match(txt, /401/);
    // la spesa in ariary dei dati di prova (1.010.000 MGA ≈ 200 €) confrontata con i 200 € previsti
    assert.match(txt, /su 200 €/);
    // schema del rendiconto: totale uscite previste = righe del preventivo in uscita
    await a.goto(`${base}/preventivo?anno=${year}&vista=schema`);
    const st = (await a.locator('table.stmt').innerText()).replace(/[\u00a0\u202f]/g, ' ');
    assert.match(st, /Totale uscite\s+200,00/);
    assert.match(st, /Totale entrate\s+3\.000,00/);
    const x = await a.request.get(`${base}/api/v1/export/budget?anno=${year}`);
    assert.equal(x.status(), 200);
    { const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await x.body());
      assert.ok(wb.getWorksheet('Schema rendiconto'), 'foglio schema del rendiconto'); }
    assert.equal(await op.page.request.get(`${base}/api/v1/export/budget?anno=${year}`).then((r) => r.status()), 403);
    await a.screenshot({ path: `${SHOTS}/sa_preventivo.png`, fullPage: true });
    // versione in vigore: il responsabile non tocca le righe; l'amministratore le corregge ed elimina con il motivo
    await p.goto(`${base}/preventivo?anno=${year}`);
    assert.equal(await p.locator('a.bg-det').count(), 0);
    await a.goto(`${base}/preventivo?anno=${year}`);
    await a.getByRole('link', { name: 'Dettaglio 401 · École Piccolino' }).click();
    await a.locator('.bv-items li', { hasText: 'Quaderni e penne' }).getByRole('link', { name: 'Modifica', exact: true }).click();
    await a.waitForURL(/edit=/);
    await a.fill('#bi-cost', '120.000');
    await a.fill('#bi-reason', 'nuovo preventivo del fornitore');
    await a.getByRole('button', { name: 'Salva la riga' }).click();
    await a.waitForURL(/ok=1/);
    await a.locator('.bv-items', { hasText: '1.200.000' }).waitFor();
    await a.goto(`${base}/preventivo?anno=${year}`);
    await a.getByRole('link', { name: 'Dettaglio E101 · Generale' }).click();
    await a.locator('.bv-items li', { hasText: 'Donazioni da privati' }).getByRole('link', { name: 'Elimina', exact: true }).click();
    await a.waitForURL(/elimina=/);
    await a.fill('#del-reason', 'voce annullata');
    await a.locator('form.del-row input[name=confirm]').check();
    await a.getByRole('button', { name: 'Elimina la riga' }).click();
    await a.waitForURL(/ok=row_deleted/);
    const am = (await pool.query(`select op, reason from budget_amendments order by id`)).rows.map((r) => `${r.op}:${r.reason}`);
    assert.deepEqual(am, ['update:nuovo preventivo del fornitore', 'delete:voce annullata']);
    const [{ n: n2, eur: eur2 }] = (await pool.query(`select count(*)::int n, sum(amount_eur)::text eur from budget_items`)).rows;
    assert.deepEqual([n2, eur2], [1, '240.00']);
    assert.equal((await pool.query(`select status from budgets`)).rows[0].status, 'approved', 'resta in vigore');
  });
  await check('scadenze: nuova scadenza, segnata fatta, adempimenti ETS, calendario, file .ics', async () => {
    const p = rs.page;
    await p.goto(`${base}/scadenze?nuovo=1`);
    await p.fill('#dl-t', 'PROVA pagare affitto sede');
    await p.fill('#dl-d', today);
    await p.fill('#dl-a', '450');
    await p.selectOption('#dl-pr', 'high');
    await p.getByRole('button', { name: 'Salva' }).click();
    await p.waitForURL(/ok=1/);
    const li = p.locator('ul.dl li', { hasText: 'PROVA pagare affitto sede' });
    await li.getByText('Oggi').waitFor();
    // clic sul titolo: si aprono i dettagli della scadenza
    await li.locator('.dl-t a').click();
    await p.locator('.dl-sheet').waitFor();
    assert.match(await p.locator('.dl-sheet').innerText(), /Tipo[\s\S]*Stato/);
    await p.locator('.dl-sheet').getByRole('link', { name: 'Chiudi' }).click();
    await p.locator('.dl-sheet').waitFor({ state: 'detached' });
    await li.getByRole('button', { name: 'Fatta' }).click();
    await p.locator('ul.dl li', { hasText: 'PROVA pagare affitto sede' }).getByRole('button', { name: 'Riapri' }).waitFor();
    assert.equal((await pool.query(`select status from deadlines where title = 'PROVA pagare affitto sede'`)).rows[0].status, 'done');
    await p.goto(`${base}/scadenze?periodo=all`);
    assert.match(await p.locator('main').innerText(), /RUNTS/);
    await p.goto(`${base}/scadenze?vista=calendario`);
    await p.locator('.cal').waitFor();
    const ics = await p.request.get(`${base}/api/v1/scadenze.ics`);
    assert.equal(ics.status(), 200);
    assert.match(await ics.text(), /BEGIN:VCALENDAR[\s\S]*BEGIN:VEVENT/);
  });
  await check('impostazioni: logo dell\'ente caricato (ridimensionato nel browser), visibile nell\'anteprima', async () => {
    const p = sa.page;
    await p.goto(`${base}/admin/impostazioni`);
    // logo 900×300 px: il browser lo riduce a 480×160
    const big = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 300;
      const g = c.getContext('2d'); g.fillStyle = '#2E3D52'; g.fillRect(0, 0, 900, 300); g.fillStyle = '#9fd6cf'; g.fillRect(60, 60, 300, 180);
      return c.toDataURL('image/png').split(',')[1]; });
    await p.locator('.logo-up input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(big, 'base64') });
    await p.getByRole('button', { name: 'Salva il logo' }).click();
    await p.waitForURL(/ok=1/);
    const [{ v }] = (await pool.query(`select value v from settings where key = 'org_logo'`)).rows;
    assert.equal(v.mime, 'image/png');
    const img = Buffer.from(v.data, 'base64');
    assert.deepEqual([img.readUInt32BE(16), img.readUInt32BE(20)], [480, 160], 'ridimensionato');
    await p.locator('.logo-prev').waitFor();
  });
  await check('documenti emessi: ricevuta dal movimento, anteprima, emissione numerata, PDF, annullamento', async () => {
    const p = rs.page;
    const [{ id: inc }] = (await pool.query(`select id from movements where description = 'PROVA donazione'`)).rows;
    await p.goto(`${base}/movimenti/${inc}`);
    await p.getByRole('link', { name: 'Ricevuta' }).click();
    await p.waitForURL(/documenti-emessi\/nuovo\?tipo=RIC/);
    assert.equal(await p.inputValue('#df-amount'), '2500');
    await p.fill('#df-party_name', 'Mario Rossi');
    await p.getByRole('button', { name: /Salva la bozza/ }).click();
    await p.waitForURL(/ok=saved/);
    assert.match(await p.locator('.docprev').innerText(), /BOZZA[\s\S]*Mario Rossi[\s\S]*2\.500,00/);
    await p.getByRole('button', { name: 'Emetti e genera il PDF' }).click();
    await p.waitForURL(/ok=issued/);
    const [d] = (await pool.query(`select number, status, document_id from issued_docs`)).rows;
    assert.match(d.number, new RegExp(`^RIC-${year}-001$`));
    assert.ok(d.document_id);
    assert.equal((await pool.query('select count(*)::int n from movement_documents where movement_id = $1 and document_id = $2', [inc, d.document_id])).rows[0].n, 1);
    const href = await p.getByRole('link', { name: 'Scarica il PDF' }).getAttribute('href');
    const pdf = await p.request.get(href.startsWith('http') ? href : `${base}${href}`);
    const pb = await pdf.body();
    assert.equal(pb.subarray(0, 5).toString(), '%PDF-');
    assert.match(pb.toString('latin1'), /\/Subtype\s*\/Image/, 'il PDF contiene il logo');
    await p.locator('.docprev .dp-logo').waitFor();
    await p.fill('#cr', 'prova di annullamento');
    await p.getByRole('button', { name: 'Annulla il documento' }).click();
    await p.waitForURL(/ok=cancelled/);
    await p.goto(`${base}/documenti-emessi`);
    assert.match(await p.locator('main').innerText(), new RegExp(`${d.number}[\\s\\S]*Annullato`));
  });
  await check('report: mensile, per codice, senza giustificativo; Excel con gli stessi numeri', async () => {
    const p = rs.page;
    for (const k of ['mensile', 'categorie', 'fornitori', 'utenti', 'nodoc', 'cassa', 'scadenze']) {
      await p.goto(`${base}/report?tipo=${k}&anno=${year}`);
      await p.locator('main section.panel').first().waitFor();
      assert.doesNotMatch(await p.locator('main').innerText(), /Errore nel caricamento/);
    }
    await p.goto(`${base}/report?tipo=mensile&anno=${year}`);
    const ExcelJS = require('exceljs');
    const r = await p.request.get(`${base}/api/v1/export/report?tipo=mensile&anno=${year}`);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await r.body());
    const ws = wb.worksheets[0];
    const tot = ws.getRow(ws.rowCount - 1).values.filter((v) => typeof v === 'number');
    const [{ s }] = (await pool.query(`select coalesce(sum(amount_eur * sign), 0)::float s from movements where kind = 'income' and status <> 'draft' and extract(year from op_date) = $1`, [year])).rows;
    assert.ok(Math.abs(tot[0] + tot[1] - s) < 0.01, `entrate ${tot[0] + tot[1]} = ${s}`);
  });
  await check('riconciliazione: estratto CSV letto nel browser, movimenti abbinati e spuntati', async () => {
    const p = rs.page;
    await p.goto(`${base}/riconciliazione`);
    await p.locator('a.rec-card', { hasText: 'Banca Italia' }).click();
    await p.waitForURL(/\/riconciliazione\?conto=/);
    await p.locator('.rec-import').waitFor();
    const legs = await p.locator('tbody input[type=checkbox]').count();
    assert.ok(legs > 0);
    const [{ amt, d }] = (await pool.query(`select amount::text amt, to_char(op_date, 'DD/MM/YYYY') d from movements where description = 'PROVA donazione'`)).rows;
    const csv = `Data;Descrizione;Importo;Saldo\n${d};Donazione;${amt.replace('.', ',')};\n${d};Riga sconosciuta;-1.234,00;\n`;
    await p.locator('.rec-import input[type=file]').setInputFiles({ name: 'estratto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await p.getByText(/Righe dell'estratto: 2; movimenti abbinati e spuntati: 1/).waitFor();
    await p.getByText(/Righe senza movimento in YouCount: 1/).waitFor();
    assert.equal(await p.locator('tbody input[type=checkbox]:checked').count(), 1);
    // la riga non trovata apre il nuovo movimento precompilato
    const add = p.locator('.rec-import a', { hasText: 'Registra' });
    const href = await add.getAttribute('href');
    assert.match(href, /\/nuovo\?tipo=expense&data=\d{4}-\d{2}-\d{2}&importo=1234&conto=/);
    await p.goto(`${base}${href}`);
    await p.getByText(/Dati presi dalla riga dell'estratto conto/).waitFor();
    assert.equal(await p.inputValue('input[inputmode=decimal]'), '1.234');
    // estratto in Excel: stesso risultato
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Estratto');
    ws.addRow(['Banca Italia - movimenti']); ws.addRow(['Data operazione', 'Descrizione', 'Importo']);
    const [dd, mm, yy] = d.split('/');
    ws.addRow([new Date(Date.UTC(+yy, +mm - 1, +dd)), 'Donazione', Number(amt)]);
    await p.goto(`${base}/riconciliazione`);
    await p.locator('a.rec-card', { hasText: 'Banca Italia' }).click();
    await p.locator('.rec-import').waitFor();
    await p.locator('.rec-import input[type=file]').setInputFiles({ name: 'estratto.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
    await p.getByText(/Righe dell'estratto: 1; movimenti abbinati e spuntati: 1/).waitFor();
    // vecchio .xls binario: messaggio chiaro
    await p.locator('.rec-import input[type=file]').setInputFiles({ name: 'vecchio.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) });
    await p.getByText(/vecchio formato \(\.xls\)/).waitFor();
  });
  await check('dashboard con grafici, rendiconto modello E', async () => {
    const p = rs.page;
    await p.goto(`${base}/`);
    assert.ok(await p.locator('figure svg rect').count() >= 24, 'barre mensili');
    assert.match(await p.locator('main').innerText(), /Uscite per progetto/);
    // autonomia di cassa: spesa media degli ultimi 3 mesi chiusi uguale al database
    const panel = p.locator('section.panel', { hasText: 'Cassa e autonomia' });
    const [{ burn }] = (await pool.query(`select coalesce(sum(amount_eur), 0)::float / 3 burn from v_ledger where kind = 'expense'
      and op_date >= date_trunc('month', current_date) - interval '3 months' and op_date < date_trunc('month', current_date)`)).rows;
    const fmtEur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' });
    const e0 = fmtEur.format(Math.round(burn)).replace(/,00(?=\s?€)/, '');
    assert.match(await panel.innerText(), new RegExp(`ultimi tre mesi \\(${e0.replace(/[.\u00a0\u202f ]/g, '.?\\s?')} al mese\\)`));
    const opDash = await op.page.goto(`${base}/`).then(() => op.page.locator('main').innerText());
    assert.doesNotMatch(opDash, /Cassa e autonomia/, 'operatore: non vede l\'autonomia di cassa');
    await p.screenshot({ path: `${SHOTS}/resp_dashboard.png`, fullPage: true });
    await p.goto(`${base}/rendiconto?anno=${year}&modello=E`);
    const txt = await p.locator('main').innerText();
    assert.match(txt, /A\) Entrate da attività di interesse generale/);
    assert.doesNotMatch(txt, /4\) Erogazioni liberali/, 'nel modello E solo le sezioni');
  });

  await check('super admin: modifica conti, progetti, piano dei conti, controparti e chiude un mese', async () => {
    const p = sa.page;
    const row = (text) => p.locator('details.erow', { hasText: text });
    // dopo ogni salvataggio si ricarica la pagina senza ?ok=1, così il salvataggio successivo è riconoscibile
    const submit = async (btn) => {
      await btn.click();
      await p.waitForURL(/[?&](ok|err)=/, { timeout: 30000 });
      assert.match(p.url(), /[?&]ok=1/, `salvataggio non riuscito: ${decodeURIComponent(p.url())}`);
      await p.goto(p.url().replace(/[?&]ok=1/, ''));
    };
    // saldo iniziale di un conto
    await p.goto(`${base}/admin/conti`);
    await row('Cassa Italia (contanti)').locator('summary').click();
    await row('Cassa Italia (contanti)').locator('input[name=opening_balance]').fill('1.250,50');
    await submit(row('Cassa Italia (contanti)').getByRole('button', { name: 'Salva' }));
    const [acc] = (await pool.query(`select opening_balance from accounts where code = 'Cassa Italia'`)).rows;
    assert.equal(acc.opening_balance, '1250.50');
    const [aud] = (await pool.query(`select count(*)::int n from audit_log where table_name = 'accounts' and action = 'update'`)).rows;
    assert.ok(aud.n >= 1, 'modifica registrata nel registro');
    await p.screenshot({ path: `${SHOTS}/sa_admin_conti.png`, fullPage: true });
    // nuovo progetto
    await p.goto(`${base}/admin/progetti`);
    await p.locator('form', { hasText: 'Aggiungi' }).last().locator('input[name=name]').fill('Progetto e2e');
    await submit(p.getByRole('button', { name: 'Aggiungi' }));
    assert.equal((await pool.query(`select count(*)::int n from projects where name = 'Progetto e2e' and active`)).rows[0].n, 1);
    // riga di rendiconto di un codice da classificare, poi ripristino
    await p.goto(`${base}/admin/piano-conti?dir=out`);
    await row('Altre spese da riclassificare').locator('summary').click();
    await row('Altre spese da riclassificare').locator('select[name=report_line_key]').selectOption('A5');
    await submit(row('Altre spese da riclassificare').getByRole('button', { name: 'Salva' }));
    assert.equal((await pool.query(`select report_line_key k from categories where code = '999'`)).rows[0].k, 'A5');
    await row('Altre spese da riclassificare').locator('summary').click();
    await row('Altre spese da riclassificare').locator('select[name=report_line_key]').selectOption('');
    await submit(row('Altre spese da riclassificare').getByRole('button', { name: 'Salva' }));
    assert.equal((await pool.query(`select report_line_key k from categories where code = '999'`)).rows[0].k, null);
    // controparte con dati riservati
    await p.goto(`${base}/controparti`);
    await p.locator('form', { hasText: 'Aggiungi' }).last().locator('input[name=name]').fill('Fornitore e2e');
    await submit(p.getByRole('button', { name: 'Aggiungi' }));
    await row('Fornitore e2e').locator('summary').click();
    await row('Fornitore e2e').locator('input[name=iban]').fill('IT60X0542811101000000123456');
    await submit(row('Fornitore e2e').getByRole('button', { name: 'Salva' }).last());
    const [cp] = (await pool.query(`select x.iban from counterparty_private x join counterparties c on c.id = x.counterparty_id where c.name = 'Fornitore e2e'`)).rows;
    assert.equal(cp.iban, 'IT60X0542811101000000123456');
    // chiusura e riapertura di un mese vecchio senza movimenti da verificare
    await p.goto(`${base}/admin/periodi`);
    const last = p.locator('tbody tr').last();
    await submit(last.getByRole('button', { name: 'Chiudi il mese' }));
    assert.equal((await pool.query(`select count(*)::int n from periods where closed_at is not null`)).rows[0].n, 1);
    await submit(p.locator('tbody tr').last().getByRole('button', { name: 'Riapri' }));
    assert.equal((await pool.query(`select count(*)::int n from periods where closed_at is not null`)).rows[0].n, 0);
  });
  await check('collegamento con altre app: chiave creata in Impostazioni (mostrata una volta), API di sola lettura', async () => {
    const p = sa.page;
    await p.goto(`${base}/admin/dati`);
    await p.locator('input[name=name]').fill('App madre e2e');
    await p.getByRole('button', { name: 'Crea chiave' }).click();
    const key = (await p.locator('.note.ok code').innerText()).trim();
    assert.match(key, /^yc_[0-9a-f]{64}$/);
    const [{ n }] = (await pool.query(`select count(*)::int n from movements where status <> 'draft'`)).rows;
    const r = await p.request.get(`${base}/api/v1/integrazione/movements?limit=1000`, { headers: { authorization: `Bearer ${key}` } });
    assert.equal(r.status(), 200);
    const body = await r.json();
    assert.equal(body.count, n);
    assert.equal(body.next, null);
    assert.equal((await p.request.get(`${base}/api/v1/integrazione/movements`, { headers: { authorization: 'Bearer yc_sbagliata' } })).status(), 401);
    assert.equal((await p.request.get(`${base}/api/v1/integrazione/profiles`, { headers: { authorization: `Bearer ${key}` } })).status(), 404);
    await p.reload();
    assert.equal(await p.locator('.note.ok code').count(), 0, 'la chiave non si rivede');
    await p.getByText('App madre e2e').waitFor();
  });
  await check('backup completo: righe identiche al database per ogni tabella; vietato agli operatori', async () => {
    await sa.page.goto(`${base}/`);
    await sa.page.getByText('Nessun backup scaricato', { exact: false }).waitFor();
    const res = await sa.page.request.get(`${base}/api/v1/backup`);
    assert.equal(res.status(), 200);
    assert.match(res.headers()['content-disposition'], /YouCount-backup-\d{8}-\d{4}\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.body());
    const info = wb.getWorksheet('LEGGIMI');
    let tables = 0;
    for (let r = 2; info.getRow(r).getCell(1).value && info.getRow(r).getCell(2).value !== null; r++) {
      const table = info.getRow(r).getCell(1).value;
      const n = info.getRow(r).getCell(2).value;
      if (typeof n !== 'number') break;
      const db = (await pool.query(`select count(*)::int n from public.${table}`)).rows[0].n;
      // la data del backup (settings, e la sua traccia in audit_log) si registra dopo l'esportazione
      assert.ok(n === db || (['settings', 'audit_log'].includes(table) && n === db - 1), `righe di ${table}: ${n} contro ${db}`);
      assert.equal(Math.max(0, wb.getWorksheet(table).rowCount - 1), n, `foglio ${table}`);
      tables++;
    }
    // ogni tabella del database è nel backup: una tabella nuova dimenticata fa fallire la prova
    const { rows: all } = await pool.query(`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
    assert.equal(tables, all[0].n);
    assert.equal((await op.page.request.get(`${base}/api/v1/backup`)).status(), 403);
    // dopo il backup il promemoria sparisce e Impostazioni mostra la data
    await sa.page.goto(`${base}/`);
    assert.equal(await sa.page.getByText('backup dei dati', { exact: false }).count(), 0);
    await sa.page.goto(`${base}/admin/dati`);
    await sa.page.getByText('Ultimo backup:', { exact: false }).waitFor();
  });
  await check('documenti › rendiconti: versione approvata e firmata archiviata, anteprima e download, non fra i giustificativi', async () => {
    const p = sa.page;
    await p.goto(`${base}/rendiconto?anno=${year}`);
    await p.getByText('Archivia versione approvata').click();
    await p.locator('#ar-y').fill(String(year - 1));
    await p.locator('#ar-d').fill(today);
    await p.locator('#ar-r').fill('Verbale assemblea di prova e2e');
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n' + randomUUID());
    await p.locator('#ar-f').setInputFiles({ name: 'rendiconto-firmato.pdf', mimeType: 'application/pdf', buffer: pdf });
    await p.getByRole('button', { name: 'Archivia', exact: true }).click();
    await p.locator('.arch-new .ok-t, .arch-new .err-t').waitFor();
    assert.equal(await p.locator('.arch-new [role=status]').innerText(), 'Versione approvata archiviata.');
    const li = p.locator('.arch-list li', { hasText: 'Verbale assemblea di prova e2e' });
    await li.waitFor();
    assert.match(await li.innerText(), new RegExp(String(year - 1)));
    assert.equal(await li.getByRole('link', { name: 'Scarica' }).count(), 1);
    const [{ n }] = (await pool.query(`select count(*)::int n from statement_archive a join documents d on d.id = a.document_id where d.doc_type = 'statement'`)).rows;
    assert.equal(n, 1);
    await p.goto(`${base}/documenti?q=rendiconto-firmato`);
    assert.equal(await p.locator('main tbody tr').count(), 0, 'il rendiconto firmato non è un giustificativo');
  });
  await check('guida «Come faccio a…»: la ricerca trova la domanda giusta, passi numerati e «Portami lì»', async () => {
    const p = sa.page;
    await p.goto(`${base}/guida`);
    await p.getByRole('searchbox').fill('tasca');
    const t = p.locator('details.g-task:not([hidden])');
    await t.first().waitFor();
    assert.equal(await t.count(), 1);
    assert.match(await t.innerText(), /Rimborsare una spesa pagata di tasca propria[\s\S]*Pagato da/);
    assert.equal(await t.getByRole('link', { name: 'Portami lì →' }).getAttribute('href'), '/rimborsi');
    await p.getByRole('searchbox').fill('');
    assert.ok(await p.locator('details.g-task:not([hidden])').count() >= 15);
  });
  await check('impostazioni: sede in Madagascar salvata, promemoria di rinnovo 6 mesi prima in Scadenze', async () => {
    const p = sa.page;
    await p.goto(`${base}/admin/impostazioni`);
    const f = p.locator('#sede-mg');
    await f.locator('#mg-agreement_no').fill('E2E-ACC-1');
    await f.locator('#mg-expires_on').fill('2028-09-30');
    await f.locator('#mg-nif').fill('NIF-E2E');
    await f.getByRole('button', { name: 'Salva' }).click();
    await p.getByText('Dati della sede in Madagascar salvati.').waitFor();
    assert.match(await f.innerText(), /Promemoria di rinnovo in Scadenze il 30\/03\/2028/);
    const [{ value }] = (await pool.query(`select value from settings where key = 'mg_seat'`)).rows;
    assert.equal(value.nif, 'NIF-E2E');
    const dl = (await pool.query(`select due_date::text d, priority from deadlines where id = $1`, [value.deadline_id])).rows;
    assert.deepEqual(dl, [{ d: '2028-03-30', priority: 'high' }]);
    // cambiando la scadenza il promemoria si sposta, non se ne crea un secondo
    await f.locator('#mg-expires_on').fill('2029-01-31');
    await f.getByRole('button', { name: 'Salva' }).click();
    await p.getByText('Accordo valido fino al 31/01/2029').waitFor();
    const all = (await pool.query(`select due_date::text d from deadlines where title = 'Rinnovo accordo di sede in Madagascar'`)).rows;
    assert.deepEqual(all, [{ d: '2028-07-31' }]);
  });
  await check('super admin: pagine di amministrazione e lingua francese', async () => {
    for (const [path, text] of [['/admin/utenti', 'Responsabile di prova'], ['/admin/piano-conti', 'Retribuzioni personale locale'],
      ['/admin/registro', 'Movimenti'], ['/admin/periodi', 'Aperto|da verificare'], ['/admin/impostazioni', 'Quattro occhi'], ['/admin/dati', 'Backup'],
      ['/admin/conti', 'BNI Madagascar'], ['/admin/progetti', 'Spese generali'], ['/progetti', 'École Piccolino'],
      ['/conti', 'Saldo iniziale'], ['/controparti', 'Cartoleria di prova'], ['/cambi', 'prova e2e'], ['/sincronizzazione', 'Ultimi invii ricevuti dal server'], ['/guida', 'Come faccio a…']]) {
      await sa.page.goto(base + path);
      assert.match(await sa.page.locator('main').innerText(), new RegExp(text, 'i'), path);
    }
    await sa.page.goto(`${base}/altro`);
    await sa.page.screenshot({ path: `${SHOTS}/sa_altro.png`, fullPage: true });
    await sa.page.goto(`${base}/account`);
    await sa.page.getByRole('button', { name: 'Français' }).click();
    await sa.page.waitForURL(/\/account/);
    await sa.page.getByText('Mon compte').first().waitFor();
    await sa.page.goto(`${base}/`);
    const header = await sa.page.locator('header').innerText();
    assert.match(header, /Tableau de bord/);
    assert.match(await sa.page.locator('nav.side-nav').innerText(), /Tableau de bord/);
    assert.match(await sa.page.locator('main').innerText(), /Trésorerie et autonomie/);
    await sa.page.screenshot({ path: `${SHOTS}/sa_dashboard_fr.png`, fullPage: true });
    const [{ lang }] = (await pool.query(`select lang from profiles where email = 'andrea@test.local'`)).rows;
    assert.equal(lang, 'fr');
    // il pulsante della lingua nell'intestazione riporta all'italiano restando sulla stessa pagina
    await sa.page.goto(`${base}/analisi`);
    await sa.page.getByRole('button', { name: 'Lingua: IT' }).click();
    await sa.page.waitForURL(/\/analisi/);
    await sa.page.locator('header').getByText('Analisi').first().waitFor();
    const [{ lang: back }] = (await pool.query(`select lang from profiles where email = 'andrea@test.local'`)).rows;
    assert.equal(back, 'it');
  });

  await check('tasso automatico: senza tasso del mese usa l’ultimo tasso usato in un movimento', async () => {
    await pool.query('delete from fx_rates');
    const [{ fx_rate }] = (await pool.query(`select fx_rate from movements where currency = 'MGA' and fx_rate is not null
                                             order by op_date desc, created_at desc limit 1`)).rows;
    const p = op.page;
    await p.goto(`${base}/nuovo`);
    await p.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    // il tasso arriva dal database dopo la scelta del conto: prima si attende l'avviso, poi si controlla il valore
    await p.getByText('ultimo tasso usato, inserito in automatico').waitFor();
    assert.equal(await p.inputValue('#rate'), new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 2 }).format(Number(fx_rate)));
  });
  await check('eliminazione definitiva di un movimento: password sbagliata rifiutata, poi eliminato e tracciato', async () => {
    const [m] = (await pool.query(`select id, ref from movements where status <> 'draft' and not demo and reverses_id is null
      and not exists (select 1 from movements r where r.reverses_id = movements.id) order by created_at desc limit 1`)).rows;
    const p = sa.page;
    await p.goto(`${base}/movimenti/${m.id}`);
    await p.locator('#elimina > summary').click();
    await p.fill('#elimina input[name=reason]', 'inserito per prova');
    await p.fill('#elimina input[name=password]', 'password-sbagliata');
    await p.locator('#elimina input[name=confirm]').check();
    await p.getByRole('button', { name: 'Elimina definitivamente' }).click();
    await p.getByText('Password non corretta').waitFor();
    await p.locator('#elimina > summary').click().catch(() => {});
    await p.fill('#elimina input[name=reason]', 'inserito per prova');
    await p.fill('#elimina input[name=password]', TEST_PASSWORD);
    await p.locator('#elimina input[name=confirm]').check();
    await p.getByRole('button', { name: 'Elimina definitivamente' }).click();
    await p.waitForURL(/ok=purged/);
    assert.equal((await pool.query('select count(*)::int n from movements where id = $1', [m.id])).rows[0].n, 0);
    assert.equal((await pool.query(`select count(*)::int n from audit_log where table_name = 'movements' and action = 'delete' and row_id = $1`, [m.id])).rows[0].n, 1);
  });
  await check('AI: traduzione IT/FR dei movimenti in sottofondo e «Chiedi all\'AI» (risposte simulate)', async () => {
    await pool.query(`insert into settings(org_id, key, value) select id, 'ai_reading', 'true'::jsonb from organizations
                      on conflict (org_id, key) do update set value = 'true'::jsonb`);
    const p = sa.page;
    await p.goto(`${base}/movimenti`);
    const t0 = Date.now();
    let n = 0;
    while (Date.now() - t0 < 20000) { n = (await pool.query('select count(*)::int n from movement_translations')).rows[0].n; if (n > 0) break; await p.waitForTimeout(500); }
    assert.ok(n > 0, 'traduzioni salvate');
    const [tr] = (await pool.query(`select t.it, t.fr, m.description from movement_translations t join movements m on m.id = t.movement_id limit 1`)).rows;
    assert.equal(tr.it, tr.description); assert.equal(tr.fr, `[FR] ${tr.description}`);
    const r = await p.request.post(`${base}/api/v1/ask`, { data: { q: 'Quanto abbiamo speso?', year: new Date().getFullYear() } });
    assert.equal(r.status(), 200);
    assert.match((await r.json()).answer, /Risposta simulata/);
    await p.goto(`${base}/chiedi`);
    await p.locator('.ask-chip').first().click();
    await p.locator('.ask-a', { hasText: 'Risposta simulata' }).waitFor();
    assert.equal((await ro.page.request.post(`${base}/api/v1/translate`, { data: { ids: [] } })).status(), 403, 'sola lettura non scrive traduzioni');
  });
  await check('schermata d\'apertura: bianca, visibile 4 secondi dopo l\'accesso, poi sparisce e non blocca l\'app', async () => {
    const ctx = await browser.newContext({ splash: true });
    const p = await ctx.newPage();
    await p.goto(`${base}/`);
    await p.waitForURL(/\/login/);
    await p.fill('#email', 'andrea@test.local'); await p.fill('#password', TEST_PASSWORD);
    await p.click('button[type=submit]');
    await p.waitForURL(`${base}/`, { timeout: 60000 });
    await p.locator('#yc-splash').waitFor({ state: 'attached' });
    const st = await p.locator('#yc-splash').evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.animationDuration, parseFloat(c.animationDelay) * (c.animationDelay.endsWith('ms') ? 1 : 1000)]; });
    assert.deepEqual(st.slice(0, 2), ['rgb(255, 255, 255)', '0.35s'], 'bianca, con 0,35 s di dissolvenza');
    // 4 s in tutto contati dall'apertura: l'attesa residua è al massimo 3,65 s (meno il tempo già passato)
    assert.ok(st[2] >= 0 && st[2] <= 3650, `attesa residua ${st[2]} ms`);
    await p.locator('#yc-splash').waitFor({ state: 'hidden', timeout: 7000 });
    // alla pagina successiva della stessa sessione non ricompare
    await p.goto(`${base}/movimenti`);
    assert.equal(await p.locator('#yc-splash').isVisible(), false);
    await ctx.close();
  });
  await check('uscita: chiude la sessione', async () => {
    await ro.page.goto(`${base}/altro`);
    await ro.page.getByRole('button', { name: 'Esci' }).first().click();
    await ro.page.waitForURL(/\/login/);
    await ro.page.goto(`${base}/`);
    assert.match(ro.page.url(), /\/login/);
  });
  await check('link email (invito o nuova password): apre la sessione e porta a «Imposta la password»', async () => {
    const r = await fetch(`${stack.url}/auth/v1/token?grant_type=password`, { method: 'POST',
      headers: { 'content-type': 'application/json', apikey: stack.anonKey },
      body: JSON.stringify({ email: 'lettore@test.local', password: TEST_PASSWORD }) });
    const tok = await r.json();
    assert.ok(tok.access_token, 'token di prova');
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    // link dei modelli Supabase predefiniti: arriva sulla radice con i dati dopo il #
    await p.goto(`${base}/#access_token=${tok.access_token}&refresh_token=${tok.refresh_token}&type=recovery`);
    await p.waitForURL(/\/account\/password$/, { timeout: 30000 });
    await p.getByText('Imposta la password').first().waitFor();
    // link scaduto: messaggio chiaro e nessuna sessione
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/auth/callback#error=access_denied&error_code=otp_expired`);
    await p2.getByText('Il link non è valido o è scaduto', { exact: false }).waitFor();
    await ctx.close(); await ctx2.close();
  });
  await check('link email dei modelli YouCount (token_hash verso l\'app): un solo uso, poi «Imposta la password»', async () => {
    const [{ id }] = (await pool.query(`select id from auth.users where email = 'lettore@test.local'`)).rows;
    // un antispam che scarica la pagina senza eseguirla non consuma il link
    const scan = await fetch(`${base}/auth/callback?token_hash=th.${id}&type=invite`);
    assert.equal(scan.status, 200);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${base}/auth/callback?token_hash=th.${id}&type=invite`);
    await p.waitForURL(/\/account\/password$/, { timeout: 30000 });
    await p.getByText('Imposta la password').first().waitFor();
    // seconda apertura dello stesso link: già usato
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/auth/callback?token_hash=th.${id}&type=invite`);
    await p2.getByText('Il link non è valido o è scaduto', { exact: false }).waitFor();
    await ctx.close(); await ctx2.close();
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
if (restarts) console.log(`(server di sviluppo riavviato ${restarts} volte per memoria esaurita)`);
if (failed) { console.log(next.log().slice(-3000)); process.exit(1); }
void U;
