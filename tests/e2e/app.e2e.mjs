// Test end-to-end: app Next.js (next dev) + PostgREST + database di prova con le vere migrazioni.
// Prepara utenti e movimenti con le funzioni del database, poi entra nell'app con Playwright come
// operatore e come utente in sola lettura e controlla cosa vede ciascuno.
// Uso: npm run db:reset && node tests/e2e/app.e2e.mjs
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
    assert.equal(await p.inputValue('#amount'), '125000');
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
    assert.match(await p.locator('main').innerText(), /Da rimborsare[\s\S]*Operatore di prova/);
    const [m] = (await pool.query(`select status, reimb_status, account_id, paid_by, currency, amount::int from movements where description = 'PROVA taxi da rimborsare'`)).rows;
    assert.deepEqual(m, { status: 'draft', reimb_status: 'due', account_id: null, paid_by: 'Operatore di prova', currency: 'MGA', amount: 18000 });
    // l'operatore vede la spesa in "Da rimborsare" ma non può rimborsarla
    await p.goto(`${base}/rimborsi`);
    await p.getByText('PROVA taxi da rimborsare').waitFor();
    assert.equal(await p.getByRole('button', { name: /Registra il rimborso/ }).count(), 0);
  });
  const rs = await login('resp@test.local');
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
    await p.locator('tr', { hasText: 'Satispay' }).getByRole('link', { name: 'Riconcilia' }).click();
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
    await p.getByRole('searchbox').fill('donazione');
    await p.getByRole('searchbox').press('Enter');
    await p.waitForURL(/q=donazione/);
    const txt = await p.locator('main table').innerText();
    assert.match(txt, /PROVA donazione/);
    assert.doesNotMatch(txt, /PROVA materiale scolastico/);
    const [{ ref }] = (await pool.query(`select ref from movements where ref is not null order by ref limit 1`)).rows;
    await p.goto(`${base}/movimenti?q=${ref}`);
    assert.equal(await p.locator('main tbody tr').count(), 1, 'ricerca per numero MOV');
    await p.goto(`${base}/movimenti?stato=nodoc`);
    const [{ n }] = (await pool.query(`select count(*)::int n from movements where no_doc_reason is not null`)).rows;
    assert.equal(await p.locator('main tbody tr').count(), Math.min(n, 200));
    await p.goto(`${base}/movimenti?q=zzz-niente`);
    await p.getByText('Nessun movimento corrisponde alla ricerca.').waitFor();
  });
  await check('dashboard con grafici, rendiconto modello E', async () => {
    const p = rs.page;
    await p.goto(`${base}/`);
    assert.ok(await p.locator('figure svg rect').count() >= 24, 'barre mensili');
    assert.match(await p.locator('main').innerText(), /Uscite per progetto/);
    // autonomia di cassa: spesa media degli ultimi 3 mesi chiusi uguale al database
    const panel = p.locator('section.panel', { hasText: 'Autonomia di cassa' });
    const [{ burn }] = (await pool.query(`select coalesce(sum(amount_eur), 0)::float / 3 burn from v_ledger where kind = 'expense'
      and op_date >= date_trunc('month', current_date) - interval '3 months' and op_date < date_trunc('month', current_date)`)).rows;
    const fmtEur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' });
    assert.match(await panel.innerText(), new RegExp(`Spesa media mensile\\s*${fmtEur.format(burn).replace(/[.\u00a0\u202f ]/g, '.?\\s?')}`));
    const opDash = await op.page.goto(`${base}/`).then(() => op.page.locator('main').innerText());
    assert.doesNotMatch(opDash, /Autonomia di cassa/, 'operatore: non vede l\'autonomia di cassa');
    await p.screenshot({ path: `${SHOTS}/resp_dashboard.png`, fullPage: true });
    await p.goto(`${base}/rendiconto?anno=${year}&modello=E`);
    const txt = await p.locator('main').innerText();
    assert.match(txt, /A\) Entrate da attività di interesse generale/);
    assert.doesNotMatch(txt, /4\) Erogazioni liberali/, 'nel modello E solo le sezioni');
  });

  const sa = await login('andrea@test.local');
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
  await check('backup completo: righe identiche al database per ogni tabella; vietato agli operatori', async () => {
    await sa.page.goto(`${base}/`);
    await sa.page.getByText('Non è ancora stato fatto un backup', { exact: false }).waitFor();
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
    await sa.page.goto(`${base}/admin/impostazioni`);
    await sa.page.getByText('Ultimo backup:', { exact: false }).waitFor();
  });
  await check('super admin: pagine di amministrazione e lingua francese', async () => {
    for (const [path, text] of [['/admin/utenti', 'Responsabile di prova'], ['/admin/piano-conti', 'Retribuzioni personale locale'],
      ['/admin/registro', 'Movimenti'], ['/admin/periodi', 'Aperto|da verificare'], ['/admin/impostazioni', 'Quattro occhi'],
      ['/admin/conti', 'BNI Madagascar'], ['/admin/progetti', 'Spese generali'], ['/progetti', 'École Piccolino'],
      ['/conti', 'Saldo iniziale'], ['/controparti', 'Cartoleria di prova'], ['/admin/cambi', 'prova e2e'], ['/sincronizzazione', 'Ultimi invii ricevuti dal server'], ['/guida', 'Verifica e storni']]) {
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

  await check('tasso automatico: senza tasso del mese usa l’ultimo tasso usato in un movimento', async () => {
    await pool.query('delete from fx_rates');
    const [{ fx_rate }] = (await pool.query(`select fx_rate from movements where currency = 'MGA' and fx_rate is not null
                                             order by op_date desc, created_at desc limit 1`)).rows;
    const p = op.page;
    await p.goto(`${base}/nuovo`);
    await p.selectOption('#account', { label: 'Cassa Madagascar (contanti) · MGA' });
    assert.equal(await p.inputValue('#rate'), String(Number(fx_rate)).replace('.', ','));
    await p.getByText('ultimo tasso usato, inserito in automatico').waitFor();
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
if (failed) { console.log(next.log().slice(-3000)); process.exit(1); }
void U;
