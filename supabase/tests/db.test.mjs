// Test del database: ruoli, RLS, registrazione, storni, idempotenza, periodi, registro modifiche, rendiconto.
// Richiede un Postgres locale preparato con scripts/db_reset_local.sh (stub Supabase + migrazioni + seed).
// Uso: DATABASE_URL=postgres://tester:tester@localhost:5432/mizana_test node --test supabase/tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';

const URL = process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test';
const pool = new pg.Pool({ connectionString: URL, max: 4 });
const U = {};          // utenti di prova
const R = {};          // riferimenti del seed
let ORG;

const sql = (text, params) => pool.query(text, params).then((r) => r.rows);

// Esegue fn come utente autenticato (ruolo "authenticated" + sub del JWT), come fa PostgREST.
async function as(uid, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (uid === 'anon') await c.query("set local role anon");
    else {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    }
    const out = await fn((t, p) => c.query(t, p).then((r) => r.rows));
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
const rpc = (uid, fn, ...args) =>
  as(uid, (q) => q(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) as r`, args)).then((r) => r[0].r);

async function newUser(name, role) {
  const [u] = await sql(
    `insert into auth.users(email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [`${name}@test.local`, { role }, { full_name: name }]);
  return u.id;
}
const today = new Date().toISOString().slice(0, 10);
const year = Number(today.slice(0, 4));
const sha = (s) => createHash('sha256').update(s).digest('hex');

async function doc(uid, label = randomUUID()) {
  const r = await rpc(uid, 'register_document', {
    client_uuid: randomUUID(), sha256: sha(label), original_path: `${ORG}/${year}/${label}.jpg`, mime: 'image/jpeg',
  });
  return r.id;
}
function mov(over = {}) {
  return {
    client_uuid: randomUUID(), kind: 'expense', op_date: today, amount: 100, currency: 'EUR',
    account_id: R.acc['Banca Italia'], category_id: R.out['201'], project_id: R.prj['École Piccolino'],
    description: 'test', ...over,
  };
}

before(async () => {
  [{ id: ORG }] = await sql('select id from public.organizations');
  // primo utente con ruolo super_admin dai metadati: accettato perché l'ente non ne ha ancora uno
  U.sa = await newUser('superadmin', 'super_admin');
  U.sa2 = await newUser('secondo_sa', 'super_admin');          // declassato a read_only dal trigger
  U.admin = await newUser('admin', 'admin');
  U.resp = await newUser('resp', 'responsabile');
  U.resp2 = await newUser('resp2', 'responsabile');
  U.op = await newUser('operatore', 'operator');
  U.op2 = await newUser('operatore2', 'operator');
  U.ro = await newUser('lettore', 'read_only');
  U.susp = await newUser('sospeso', 'operator');
  await sql('update public.profiles set all_projects = true where id = $1', [U.op]);

  R.acc = Object.fromEntries((await sql('select code, id from accounts')).map((r) => [r.code, r.id]));
  R.out = Object.fromEntries((await sql(`select code, id from categories where direction='out'`)).map((r) => [r.code, r.id]));
  R.in = Object.fromEntries((await sql(`select code, id from categories where direction='in'`)).map((r) => [r.code, r.id]));
  R.prj = Object.fromEntries((await sql('select name, id from projects')).map((r) => [r.name, r.id]));
  R.gen = R.prj['Spese generali'];
});
after(() => pool.end());

// ------------------------------------------------------------------ seed
test('seed: piano dei conti ripreso dal Gestionale', async () => {
  const [c] = await sql(`select count(*) filter (where direction='out')::int o, count(*) filter (where direction='in')::int i,
                                count(*) filter (where report_line_key is null)::int n from categories`);
  // senza riga: i due codici «da classificare» e E904 (saldo iniziale, fuori rendiconto come nel Gestionale)
  assert.deepEqual(c, { o: 64, i: 25, n: 3 });
  const unmapped = await sql(`select code from categories where report_line_key is null order by code`);
  assert.deepEqual(unmapped.map((r) => r.code), ['999', 'E904', 'E999']);
  const [g] = await sql(`select kind, legacy_name from projects where name = 'Spese generali'`);
  assert.deepEqual(g, { kind: 'structure', legacy_name: 'General' });
});

test('profili: ruoli dai metadati di invito, un solo super admin', async () => {
  const rows = await sql('select id, role from profiles');
  const role = Object.fromEntries(rows.map((r) => [r.id, r.role]));
  assert.equal(role[U.sa], 'super_admin');
  assert.equal(role[U.sa2], 'read_only');
  assert.equal(role[U.op], 'operator');
});

// ------------------------------------------------------------------ accesso
test('anonimo: nessun accesso alle tabelle', async () => {
  await assert.rejects(as('anon', (q) => q('select * from movements')), /permission denied/);
  await assert.rejects(as('anon', (q) => q('select public.save_movement($1)', [mov()])), /permission denied/);
});

test('sola lettura: non registra', async () => {
  await assert.rejects(rpc(U.ro, 'save_movement', mov()), /forbidden/);
});

test('nessuna scrittura diretta sulle tabelle dei movimenti', async () => {
  await assert.rejects(as(U.admin, (q) => q(
    `insert into movements(org_id, client_uuid, kind, op_date, amount, currency, account_id, created_by)
     values ($1, gen_random_uuid(), 'expense', current_date, 1, 'EUR', $2, $3)`, [ORG, R.acc['Banca Italia'], U.admin])),
  /permission denied/);
  await assert.rejects(as(U.sa, (q) => q('delete from movements')), /permission denied/);
  await assert.rejects(as(U.sa, (q) => q('update audit_log set action = action')), /permission denied/);
});

test('utente sospeso: non vede e non registra', async () => {
  await rpc(U.sa, 'admin_set_active', U.susp, false);
  await assert.rejects(rpc(U.susp, 'save_movement', mov()), /forbidden/);
  const rows = await as(U.susp, (q) => q('select * from accounts'));
  assert.equal(rows.length, 0);
});

// ------------------------------------------------------------------ registrazione
test('bozza idempotente: stesso client_uuid = un solo movimento', async () => {
  const m = mov();
  const a = await rpc(U.op, 'save_movement', m);
  const b = await rpc(U.op, 'save_movement', m);
  assert.equal(a.outcome, 'applied');
  assert.equal(b.outcome, 'duplicate');
  assert.equal(a.id, b.id);
  assert.equal(a.status, 'draft');
  const [{ n }] = await sql('select count(*)::int n from movements where client_uuid = $1', [m.client_uuid]);
  assert.equal(n, 1);
});

test('registrazione: serve il giustificativo o il motivo', async () => {
  await assert.rejects(rpc(U.op, 'save_movement', mov({ status: 'recorded' })), /document_required/);
  const d = await doc(U.op);
  const r = await rpc(U.op, 'save_movement', mov({ status: 'recorded', document_ids: [d] }));
  assert.equal(r.status, 'recorded');
  assert.match(r.ref, new RegExp(`^MOV-${year}-\\d{3}$`));
  const r2 = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'commissione bancaria da estratto conto' }));
  assert.equal(r2.status, 'recorded');
  assert.notEqual(r2.ref, r.ref);
});

test('controlli: valuta del conto, tasso MGA, direzione del codice', async () => {
  const reason = { status: 'recorded', no_doc_reason: 'prova controlli' };
  await assert.rejects(rpc(U.op, 'save_movement', mov({ ...reason, currency: 'MGA', fx_rate: 5000 })), /currency_mismatch/);
  await assert.rejects(rpc(U.op, 'save_movement', mov({ ...reason, currency: 'MGA', account_id: R.acc['Cassa Missione'] })),
    /violates check constraint/);
  await assert.rejects(rpc(U.op, 'save_movement', mov({ ...reason, category_id: R.in['E101'] })), /invalid/);
  const ok = await rpc(U.op, 'save_movement', mov({ ...reason, currency: 'MGA', amount: 505000, fx_rate: 5050,
    account_id: R.acc['Cassa Missione'] }));
  const [m] = await sql('select amount_eur from movements where id = $1', [ok.id]);
  assert.equal(m.amount_eur, '100.00');
});

test('modifiche concorrenti: versione diversa = conflitto, modifica ripetuta = nessun effetto', async () => {
  const a = await rpc(U.op, 'save_movement', mov());
  const op = randomUUID();
  const e1 = await rpc(U.op, 'save_movement', { id: a.id, expected_version: a.version, op_uuid: op, amount: 120 });
  assert.equal(e1.outcome, 'applied');
  assert.equal(e1.version, a.version + 1);
  const again = await rpc(U.op, 'save_movement', { id: a.id, expected_version: a.version, op_uuid: op, amount: 120 });
  assert.equal(again.outcome, 'duplicate');
  const stale = await rpc(U.op, 'save_movement', { id: a.id, expected_version: a.version, op_uuid: randomUUID(), amount: 130 });
  assert.equal(stale.outcome, 'conflict');
  assert.equal(stale.current.amount, 120);
  const [m] = await sql('select amount, description from movements where id = $1', [a.id]);
  assert.equal(m.amount, '120.00');
  assert.equal(m.description, 'test');   // i campi non inviati restano invariati
});

test('movimento registrato: lo modifica solo un responsabile', async () => {
  const r = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova permessi' }));
  await assert.rejects(rpc(U.op, 'save_movement', { id: r.id, expected_version: r.version, amount: 99 }), /forbidden/);
  const e = await rpc(U.resp, 'save_movement', { id: r.id, expected_version: r.version, amount: 99 });
  assert.equal(e.outcome, 'applied');
  await assert.rejects(rpc(U.resp, 'save_movement', { id: r.id, expected_version: e.version, status: 'draft' }),
    /invalid_transition/);
});

test('quattro occhi e immutabilità del verificato', async () => {
  const r = await rpc(U.resp, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova quattro occhi' }));
  await assert.rejects(rpc(U.resp, 'verify_movement', r.id, r.version), /four_eyes/);
  await assert.rejects(rpc(U.op, 'verify_movement', r.id, r.version), /forbidden/);
  const v = await rpc(U.resp2, 'verify_movement', r.id, r.version);
  assert.equal(v.status, 'verified');
  // il super amministratore verifica anche ciò che ha registrato lui
  const s = await rpc(U.sa, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova super amministratore' }));
  const sv = await rpc(U.sa, 'verify_movement', s.id, s.version);
  assert.equal(sv.status, 'verified');
  await assert.rejects(rpc(U.resp2, 'save_movement', { id: r.id, expected_version: v.version, amount: 1 }), /immutable/);
  // nemmeno chi ha accesso diretto al database (chiave di servizio, SQL) lo modifica o lo cancella
  await assert.rejects(sql('update movements set amount = 1 where id = $1', [r.id]), /immutable/);
  await assert.rejects(sql('delete from movements where id = $1', [r.id]), /immutable/);
});

test('storno: movimento uguale e contrario, una sola volta, idempotente', async () => {
  const bal = async () => (await as(U.ro, (q) => q('select * from public.account_balances($1)', [today])))
    .find((b) => b.code === 'Satispay').balance;
  const b0 = Number(await bal());
  const r = await rpc(U.op, 'save_movement', mov({ status: 'recorded', amount: 40, account_id: R.acc['Satispay'],
    no_doc_reason: 'prova storno' }));
  assert.equal(Number(await bal()), b0 - 40);
  await assert.rejects(rpc(U.op, 'reverse_movement', r.id, 'importo errato', randomUUID(), null), /forbidden/);
  await assert.rejects(rpc(U.resp, 'reverse_movement', r.id, 'no', randomUUID(), null), /invalid/);
  const cu = randomUUID();
  const s = await rpc(U.resp, 'reverse_movement', r.id, 'importo errato', cu, null);
  const s2 = await rpc(U.resp, 'reverse_movement', r.id, 'importo errato', cu, null);
  assert.equal(s.outcome, 'applied');
  assert.equal(s2.outcome, 'duplicate');
  await assert.rejects(rpc(U.resp, 'reverse_movement', r.id, 'secondo storno', randomUUID(), null), /already_reversed/);
  await assert.rejects(rpc(U.resp, 'reverse_movement', s.id, 'storno dello storno', randomUUID(), null), /invalid_transition/);
  const [x] = await sql('select sign, reverses_id, amount from movements where id = $1', [s.id]);
  assert.deepEqual(x, { sign: -1, reverses_id: r.id, amount: '40.00' });
  assert.equal(Number(await bal()), b0);
  await assert.rejects(rpc(U.resp, 'save_movement', { id: r.id, expected_version: r.version + 0, amount: 1 }), /immutable/);
});

test('saldi: entrate, uscite e giroconti anche tra valute', async () => {
  const bal = async () => Object.fromEntries((await as(U.ro, (q) => q('select * from public.account_balances($1)', [today])))
    .map((b) => [b.code, Number(b.balance)]));
  const b0 = await bal();
  const nd = { status: 'recorded', no_doc_reason: 'prova saldi' };
  await rpc(U.resp, 'save_movement', mov({ ...nd, kind: 'income', amount: 1000, account_id: R.acc['Paypal'], category_id: R.in['E101'] }));
  await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 250, account_id: R.acc['Paypal'] }));
  await rpc(U.resp, 'save_movement', mov({ ...nd, kind: 'transfer', category_id: null, project_id: null, amount: 100,
    account_id: R.acc['Paypal'], to_account_id: R.acc['Cassa Italia'], to_amount: 100 }));
  await rpc(U.resp, 'save_movement', mov({ ...nd, kind: 'transfer', category_id: null, project_id: null, amount: 200,
    account_id: R.acc['Paypal'], to_account_id: R.acc['Mvola Telma'], to_amount: 1010000 }));
  await assert.rejects(rpc(U.resp, 'save_movement', mov({ ...nd, kind: 'transfer', category_id: null, amount: 10,
    account_id: R.acc['Paypal'], to_account_id: R.acc['Cassa Italia'], to_amount: 11 })), /invalid/);
  const b1 = await bal();
  assert.equal(b1['Paypal'] - b0['Paypal'], 1000 - 250 - 100 - 200);
  assert.equal(b1['Cassa Italia'] - b0['Cassa Italia'], 100);
  assert.equal(b1['Mvola Telma'] - b0['Mvola Telma'], 1010000);
});

// ------------------------------------------------------------------ visibilità
test('operatore con progetti limitati vede solo i suoi', async () => {
  const nd = { status: 'recorded', no_doc_reason: 'prova visibilità' };
  const pA = R.prj['StreetFood'], pB = R.prj['Sapone Solidale'];
  const a = await rpc(U.resp, 'save_movement', mov({ ...nd, project_id: pA }));
  const b = await rpc(U.resp, 'save_movement', mov({ ...nd, project_id: pB }));
  const draft = await rpc(U.resp, 'save_movement', mov({ project_id: pA }));
  const seen = async () => new Set((await as(U.op2, (q) => q('select id from movements'))).map((r) => r.id));
  let s = await seen();
  assert.ok(!s.has(a.id) && !s.has(b.id));
  await assert.rejects(rpc(U.op2, 'save_movement', mov({ project_id: pA })), /forbidden/);
  await rpc(U.admin, 'admin_set_projects', U.op2, false, [pA]);
  s = await seen();
  assert.ok(s.has(a.id), 'vede il progetto assegnato');
  assert.ok(!s.has(b.id), 'non vede gli altri progetti');
  assert.ok(!s.has(draft.id), 'non vede le bozze altrui');
  const ro = new Set((await as(U.ro, (q) => q('select id from movements'))).map((r) => r.id));
  assert.ok(ro.has(a.id) && !ro.has(draft.id), 'sola lettura: niente bozze');
});

test('dati personali delle controparti solo ai responsabili', async () => {
  const [cp] = await as(U.op, (q) => q(`insert into counterparties(org_id, name, created_by) values ($1, 'Fornitore X', $2) returning id`, [ORG, U.op]));
  await as(U.resp, (q) => q(`insert into counterparty_private(counterparty_id, org_id, tax_code) values ($1, $2, 'RSSMRA80A01H501U')`, [cp.id, ORG]));
  assert.equal((await as(U.op, (q) => q('select * from counterparty_private'))).length, 0);
  assert.equal((await as(U.resp, (q) => q('select * from counterparty_private'))).length, 1);
  await assert.rejects(as(U.op, (q) => q(`insert into counterparty_private(counterparty_id, org_id) values ($1, $2)`, [cp.id, ORG])),
    /row-level security/);
});

// ------------------------------------------------------------------ documenti
test('documenti: stesso file non si duplica, percorso vincolato, niente cancellazioni', async () => {
  const label = randomUUID();
  const id = await doc(U.op, label);
  const r = await rpc(U.op2, 'register_document', { client_uuid: randomUUID(), sha256: sha(label),
    original_path: `${ORG}/${year}/altro.jpg`, mime: 'image/jpeg' });
  assert.equal(r.outcome, 'duplicate_file');
  assert.equal(r.id, id);
  await assert.rejects(rpc(U.op, 'register_document', { client_uuid: randomUUID(), sha256: sha(randomUUID()),
    original_path: `altro-ente/${year}/x.jpg`, mime: 'image/jpeg' }), /invalid/);
  await assert.rejects(sql('delete from documents where id = $1', [id]), /immutable/);
  await assert.rejects(sql(`update documents set original_path = 'x' where id = $1`, [id]), /immutable/);
  const u = await rpc(U.op, 'update_document', { id, extraction: { total: { value: 12, confidence: 0.9 } }, extraction_model: 'test' });
  assert.equal(u.outcome, 'applied');
});

test('rendiconti approvati: archiviati solo dagli amministratori, fuori dai giustificativi', async () => {
  const label = randomUUID();
  const d = await rpc(U.admin, 'register_document', { client_uuid: randomUUID(), sha256: sha(label), original_path: `${ORG}/rendiconti/${year}/${label}.pdf`,
    mime: 'application/pdf', doc_type: 'statement', doc_date: today, doc_number: 'Assemblea di prova' });
  const p = { document_id: d.id, year: year - 1, approved_on: today, approval_ref: 'Verbale assemblea di prova' };
  await assert.rejects(rpc(U.op, 'archive_statement', p), /forbidden/);
  const a = await rpc(U.admin, 'archive_statement', p);
  assert.equal(a.year, year - 1);
  const again = await rpc(U.admin, 'archive_statement', { ...p, approval_ref: 'Verbale corretto' });
  assert.equal(again.id, a.id, 'stesso documento: si aggiorna, non si duplica');
  const other = await doc(U.admin);
  await assert.rejects(rpc(U.admin, 'archive_statement', { ...p, document_id: other }), /not_found/);
  assert.equal((await as(U.op, (q) => q('select count(*)::int n from statement_archive')))[0].n, 0, 'l\'operatore non vede l\'archivio');
});

test('anticipi: richiesta, autorizzazione a quattro occhi, soglie, consegna collegata, rendiconto, chiusura', async () => {
  const acc = (await rpc(U.resp, 'create_advance_account', 'Volontario di prova', 'EUR', 'IT')).id;
  const req = await rpc(U.op, 'advance_request', { account_id: acc, amount: 300, purpose: 'Materiale per il laboratorio', use_date: today, beneficiary_id: U.op });
  assert.equal(req.status, 'requested');
  assert.equal(Number(req.amount_eur), 300);
  assert.equal(req.report_by, new Date(Date.parse(today) + 15 * 864e5).toISOString().slice(0, 10), 'giustificare entro 15 giorni');
  await assert.rejects(rpc(U.op, 'advance_step', { id: req.id, step: 'authorize' }), /forbidden/);
  // soglie: il responsabile fino a 200 €, l'amministratore fino a 250 €, oltre serve la delibera
  await sql(`insert into settings(org_id, key, value) values ($1, 'adv_limits', '{"resp": 200, "admin": 250}') on conflict (org_id, key) do update set value = excluded.value`, [ORG]);
  await assert.rejects(rpc(U.resp, 'advance_step', { id: req.id, step: 'authorize' }), /over_limit/);
  await assert.rejects(rpc(U.admin, 'advance_step', { id: req.id, step: 'authorize' }), /board_needed/);
  const auth = await rpc(U.admin, 'advance_step', { id: req.id, step: 'authorize', board_ref: 'Delibera CdA di prova' });
  assert.equal(auth.status, 'authorized');
  await sql(`delete from settings where key = 'adv_limits'`);
  // chi chiede non autorizza
  const req2 = await rpc(U.resp, 'advance_request', { account_id: acc, amount: 50, purpose: 'Trasporti', use_date: today });
  await assert.rejects(rpc(U.resp, 'advance_step', { id: req2.id, step: 'authorize' }), /four_eyes/);
  // consegna: il giroconto deve andare sul conto anticipi della persona
  const wrong = await rpc(U.resp, 'save_movement', mov({ status: 'recorded', kind: 'transfer', category_id: null, project_id: null, amount: 300, to_amount: 300,
    account_id: R.acc['Banca Italia'], to_account_id: R.acc['Cassa Italia'], no_doc_reason: 'giroconto' }));
  await assert.rejects(rpc(U.resp, 'advance_step', { id: req.id, step: 'deliver', movement_id: wrong.id }), /invalid/);
  const mv = await rpc(U.resp, 'save_movement', mov({ status: 'recorded', kind: 'transfer', category_id: null, project_id: null, amount: 300, to_amount: 300,
    account_id: R.acc['Cassa Italia'], to_account_id: acc, no_doc_reason: 'consegna anticipo' }));
  const del = await rpc(U.resp, 'advance_step', { id: req.id, step: 'deliver', movement_id: mv.id });
  assert.equal(del.status, 'delivered');
  // anticipo scaduto e non giustificato: niente nuova richiesta per la stessa persona
  await sql(`update advance_requests set use_date = current_date - 40, report_by = current_date - 25 where id = $1`, [req.id]);
  await assert.rejects(rpc(U.op, 'advance_request', { account_id: acc, amount: 10, purpose: 'Altro', use_date: today }), /advance_overdue/);
  const rep = await rpc(U.op, 'advance_step', { id: req.id, step: 'report' });
  assert.equal(rep.status, 'reported');
  await assert.rejects(rpc(U.op, 'advance_step', { id: req.id, step: 'close' }), /forbidden/);
  const cl = await rpc(U.resp, 'advance_step', { id: req.id, step: 'close', note: 'residuo restituito' });
  assert.equal(cl.status, 'closed');
  // l'operatore vede solo le richieste sue
  const seen = await as(U.op2, (q) => q('select count(*)::int n from advance_requests'));
  assert.equal(seen[0].n, 0);
  // persona nuova (non utente): il conto anticipi si crea con la richiesta, uno per valuta, senza doppioni
  const n1 = await rpc(U.op, 'advance_request', { holder: '  Rasoa   Nirina ', currency: 'MGA', amount: 20000, purpose: 'Trasporto materiale', use_date: today });
  const n2 = await rpc(U.op, 'advance_request', { holder: 'rasoa nirina', currency: 'MGA', amount: 1000, purpose: 'Secondo anticipo', use_date: today });
  assert.equal(n1.account_id, n2.account_id);
  const [na] = await sql(`select holder, currency, kind, location from accounts where id = $1`, [n1.account_id]);
  assert.deepEqual([na.holder, na.currency, na.kind, na.location], ['Rasoa Nirina', 'MGA', 'advance', 'MG']);
  // utente dell'app scelto dalla lista: conto a suo nome, beneficiario collegato
  const u1 = await rpc(U.op, 'advance_request', { beneficiary_id: U.op, currency: 'EUR', amount: 30, purpose: 'Spese varie', use_date: today });
  assert.equal(u1.beneficiary_id, U.op);
  assert.equal((await sql(`select a.currency from accounts a where a.id = $1`, [u1.account_id]))[0].currency, 'EUR');
  await assert.rejects(rpc(U.op, 'advance_request', { holder: 'X', currency: 'MGA', amount: 10, purpose: 'Nome troppo corto', use_date: today }), /invalid/);
  await assert.rejects(rpc(U.op, 'advance_account', { holder: 'Qualcuno', currency: 'MGA' }), /forbidden/);
});

test('bozze: si eliminano solo le bozze', async () => {
  const d = await rpc(U.op, 'save_movement', mov());
  await assert.rejects(rpc(U.op2, 'discard_draft', d.id), /forbidden|not_found/);
  assert.equal((await rpc(U.op, 'discard_draft', d.id)).outcome, 'applied');
  const r = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova bozze' }));
  await assert.rejects(rpc(U.op, 'discard_draft', r.id), /immutable/);
  const [{ n }] = await sql(`select count(*)::int n from audit_log where table_name='movements' and row_id=$1 and action='delete'`, [d.id]);
  assert.equal(n, 1, 'la cancellazione della bozza resta nel registro');
});

test('possibili doppioni segnalati', async () => {
  await rpc(U.op, 'save_movement', mov({ status: 'recorded', amount: 77.7, no_doc_reason: 'prova doppioni' }));
  const rows = await as(U.op, (q) => q('select * from public.find_duplicates($1)', [{ amount: 77.7, currency: 'EUR',
    op_date: today, account_id: R.acc['Banca Italia'] }]));
  assert.ok(rows.length >= 1 && rows[0].same_account);
});

// ------------------------------------------------------------------ periodi
test('chiusura del mese: blocca nuove registrazioni nel periodo', async () => {
  const d = '2025-01-15';
  const r = await rpc(U.resp, 'save_movement', mov({ status: 'recorded', op_date: d, no_doc_reason: 'prova periodo' }));
  await assert.rejects(rpc(U.resp, 'close_period', 2025, 1), /forbidden/);
  await assert.rejects(rpc(U.admin, 'close_period', 2025, 1), /unverified_movements/);
  await rpc(U.resp2, 'verify_movement', r.id, r.version);
  assert.equal((await rpc(U.admin, 'close_period', 2025, 1)).outcome, 'applied');
  await assert.rejects(rpc(U.resp, 'save_movement', mov({ status: 'recorded', op_date: d, no_doc_reason: 'dopo chiusura' })), /period_closed/);
  const draft = await rpc(U.op, 'save_movement', mov({ op_date: d }));
  assert.equal(draft.status, 'draft', 'le bozze restano possibili');
  await assert.rejects(rpc(U.admin, 'reopen_period', 2025, 1), /forbidden/);
  await rpc(U.sa, 'reopen_period', 2025, 1);
  const ok = await rpc(U.op, 'save_movement', { id: draft.id, expected_version: draft.version, status: 'recorded', no_doc_reason: 'dopo riapertura' });
  assert.equal(ok.status, 'recorded');
});

// ------------------------------------------------------------------ registro e utenti
test('registro delle modifiche: completo, non modificabile, visibile agli amministratori', async () => {
  const a = await rpc(U.op, 'save_movement', mov());
  await rpc(U.op, 'save_movement', { id: a.id, expected_version: a.version, amount: 55 });
  const [{ n }] = await sql(`select count(*)::int n from audit_log where table_name='movements' and row_id=$1`, [a.id]);
  assert.equal(n, 2);
  await assert.rejects(sql('update audit_log set action = action'), /immutable/);
  await assert.rejects(sql('delete from audit_log'), /immutable/);
  assert.equal((await as(U.op, (q) => q('select * from audit_log'))).length, 0);
  assert.ok((await as(U.admin, (q) => q('select * from audit_log'))).length > 0);
  const h = await as(U.op, (q) => q('select * from public.movement_history($1)', [a.id]));
  assert.equal(h.length, 2);
  assert.equal(h[1].old_row.amount, 100);
  assert.equal(h[1].new_row.amount, 55);
});

test('gestione utenti: limiti di admin e super admin', async () => {
  await assert.rejects(rpc(U.admin, 'admin_set_role', U.sa, 'read_only'), /forbidden/);
  await assert.rejects(rpc(U.admin, 'admin_set_role', U.ro, 'super_admin'), /forbidden/);
  await assert.rejects(rpc(U.admin, 'admin_set_role', U.admin, 'super_admin'), /forbidden/);
  await assert.rejects(rpc(U.resp, 'admin_set_role', U.ro, 'operator'), /forbidden/);
  assert.equal((await rpc(U.admin, 'admin_set_role', U.ro, 'read_only')).outcome, 'applied');
  await assert.rejects(as(U.op, (q) => q(`update profiles set role = 'super_admin' where id = $1`, [U.op])), /permission denied/);
  const [p] = await as(U.op, (q) => q(`update profiles set full_name = 'Operatore Uno' where id = $1 returning full_name`, [U.op]));
  assert.equal(p.full_name, 'Operatore Uno');
  const dirOp = await as(U.op, (q) => q('select * from public.user_directory()'));
  assert.ok(dirOp.every((r) => r.email === null), 'email nascoste ai non amministratori');
  // un admin non tocca i super admin; un super admin non modifica il proprio ruolo
  await rpc(U.sa, 'admin_set_role', U.sa2, 'super_admin');
  await rpc(U.sa2, 'admin_set_role', U.sa, 'admin');
  await assert.rejects(rpc(U.sa, 'admin_set_role', U.sa2, 'admin'), /forbidden/);
  await assert.rejects(rpc(U.sa2, 'admin_set_role', U.sa2, 'admin'), /forbidden/);
  await rpc(U.sa2, 'admin_set_role', U.sa, 'super_admin');
});

// ------------------------------------------------------------------ rendiconto
test('rendiconto: struttura in sezione E, progetti in A, storni netti, solo staff', async () => {
  const y = 2024;
  const nd = { status: 'recorded', op_date: `${y}-03-10`, no_doc_reason: 'prova rendiconto' };
  await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 300, category_id: R.out['101'], project_id: R.gen }));
  await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 200, category_id: R.out['101'] }));
  const x = await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 50, category_id: R.out['101'] }));
  await rpc(U.resp2, 'reverse_movement', x.id, 'registrato due volte', randomUUID(), `${y}-03-11`);
  await rpc(U.resp, 'save_movement', mov({ ...nd, kind: 'income', amount: 1000, category_id: R.in['E101'], project_id: null }));
  await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 15, category_id: R.out['999'] }));
  const rows = await as(U.ro, (q) => q('select * from public.report_cash_statement($1)', [y]));
  const line = (d, k) => Number(rows.find((r) => r.direction === d && r.key === k).amount_eur);
  assert.equal(line('out', 'E4'), 300);
  assert.equal(line('out', 'A4'), 200);
  assert.equal(line('in', 'A4'), 1000);
  const un = await as(U.ro, (q) => q('select * from public.report_unclassified($1)', [y]));
  assert.equal(un.length, 1);
  assert.equal((await as(U.op, (q) => q('select * from public.report_cash_statement($1)', [y]))).length, 0);
});

// ------------------------------------------------------------------ cambi e progetto obbligatorio
test('tassi di cambio: li imposta un responsabile, si usa quello del mese o il precedente', async () => {
  await assert.rejects(as(U.op, (q) => q('insert into fx_rates(org_id, year, month, rate) values ($1, 2026, 3, 5000)', [ORG])),
    /row-level security/);
  await as(U.resp, (q) => q('insert into fx_rates(org_id, year, month, rate, source) values ($1, 2026, 3, 5000, $2), ($1, 2026, 5, 5100, $2)',
    [ORG, 'prova']));
  const rate = async (d) => (await as(U.op, (q) => q('select public.fx_rate_for($1) r', [d])))[0].r;
  assert.equal(await rate('2026-03-15'), '5000.0000');
  assert.equal(await rate('2026-04-02'), '5000.0000');
  assert.equal(await rate('2026-06-30'), '5100.0000');
  assert.equal(await rate('2026-01-10'), null);
});

test('uscita registrata senza progetto: rifiutata (serve il progetto o «Spese generali»)', async () => {
  await assert.rejects(rpc(U.op, 'save_movement', mov({ project_id: null, status: 'recorded', no_doc_reason: 'prova progetto' })),
    /movements_expense_project/);
  const d = await rpc(U.op, 'save_movement', mov({ project_id: null }));
  assert.equal(d.status, 'draft', 'in bozza il progetto può mancare');
});

// ------------------------------------------------------------------ finanziamenti, budget, cassa, soci
test('budget per progetto e per finanziamento: speso per gruppo di codici', async () => {
  const prj = R.prj['Sport & Inclusione'];
  const [{ id: g01 }] = await sql(`select id from category_groups where direction='out' and code='01'`);
  const [{ id: g04 }] = await sql(`select id from category_groups where direction='out' and code='04'`);
  await assert.rejects(as(U.op, (q) => q('insert into budget_lines(org_id, project_id, year, group_id, amount_eur) values ($1,$2,2023,$3,100)', [ORG, prj, g01])),
    /row-level security/);
  await as(U.resp, (q) => q('insert into budget_lines(org_id, project_id, year, group_id, amount_eur) values ($1,$2,2023,$3,1000), ($1,$2,2023,$4,500)',
    [ORG, prj, g01, g04]));
  const [grant] = await as(U.resp, (q) => q(`insert into grants(org_id, title, project_id, amount, created_by) values ($1, 'Bando prova', $2, 3000, $3) returning id`,
    [ORG, prj, U.resp]));
  await as(U.resp, (q) => q('insert into budget_lines(org_id, grant_id, group_id, amount_eur) values ($1,$2,$3,800)', [ORG, grant.id, g01]));
  const nd = { status: 'recorded', op_date: '2023-05-02', project_id: prj, no_doc_reason: 'prova budget' };
  await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 300, category_id: R.out['101'], grant_id: grant.id }));
  await rpc(U.resp, 'save_movement', mov({ ...nd, amount: 120, category_id: R.out['401'] }));
  const byProject = await as(U.ro, (q) => q('select * from public.budget_vs_actual($1, 2023, null)', [prj]));
  const row = (rows, code) => { const r = rows.find((x) => x.group_code === code); return { ...r, budget_eur: Number(r.budget_eur), spent_eur: Number(r.spent_eur) }; };
  assert.deepEqual([row(byProject, '01').budget_eur, row(byProject, '01').spent_eur], [1000, 300]);
  assert.deepEqual([row(byProject, '04').budget_eur, row(byProject, '04').spent_eur], [500, 120]);
  const byGrant = await as(U.ro, (q) => q('select * from public.budget_vs_actual(null, null, $1)', [grant.id]));
  assert.deepEqual([row(byGrant, '01').budget_eur, row(byGrant, '01').spent_eur, row(byGrant, '04').spent_eur], [800, 300, 0]);
  assert.equal((await as(U.op, (q) => q('select * from public.budget_vs_actual($1, 2023, null)', [prj]))).length, 0, 'operatore: niente budget');
});

test('conta di cassa: confronta i contanti con il saldo dell\'app alla data', async () => {
  const acc = R.acc['Cassa Missione'];
  const bal = (await as(U.ro, (q) => q('select balance from public.account_balances($1) where account_id = $2', [today, acc])))[0].balance;
  const r = await rpc(U.op, 'record_cash_count', acc, today, 1000, 'conta di prova', null);
  assert.equal(Number(r.system_balance), Number(bal));
  assert.equal(Number(r.difference), 1000 - Number(bal));
  await assert.rejects(rpc(U.op, 'record_cash_count', R.acc['Banca Italia'], today, 10, null, null), /invalid/);
  await assert.rejects(rpc(U.ro, 'record_cash_count', acc, today, 10, null, null), /forbidden/);
  await assert.rejects(sql('update cash_counts set counted = 0'), /immutable/);
});

test('quote associative per socio (codice E104)', async () => {
  const [m] = await as(U.op, (q) => q(`insert into counterparties(org_id, name, kind, created_by) values ($1, 'Socia di prova', 'member', $2) returning id`, [ORG, U.op]));
  await rpc(U.resp, 'save_movement', mov({ kind: 'income', amount: 30, category_id: R.in['E104'], project_id: null, counterparty_id: m.id,
    status: 'recorded', op_date: '2022-02-01', no_doc_reason: 'prova quote' }));
  const fees = await as(U.ro, (q) => q('select * from public.member_fees(2022)'));
  assert.deepEqual(fees.map((f) => [f.name, f.amount_eur]), [['Socia di prova', '30.00']]);
});

test('set_budget: sostituisce le righe in un colpo solo, solo responsabili', async () => {
  const prj = R.prj['Agricoltura'];
  const groups = await sql(`select id, code from category_groups where direction='out' order by code`);
  const g = Object.fromEntries(groups.map((x) => [x.code, x.id]));
  await assert.rejects(rpc(U.op, 'set_budget', prj, 2024, null, JSON.stringify([{ group_id: g['01'], amount_eur: 10 }])), /forbidden/);
  await rpc(U.resp, 'set_budget', prj, 2024, null, JSON.stringify([{ group_id: g['01'], amount_eur: 100 }, { group_id: g['02'], amount_eur: 50 }]));
  await rpc(U.resp, 'set_budget', prj, 2024, null, JSON.stringify([{ group_id: g['03'], amount_eur: 70 }, { group_id: g['04'], amount_eur: 0 }]));
  const rows = await sql('select g.code, b.amount_eur from budget_lines b join category_groups g on g.id = b.group_id where b.project_id = $1 order by g.code', [prj]);
  assert.deepEqual(rows.map((r) => [r.code, Number(r.amount_eur)]), [['03', 70]]);
  const [{ n }] = await sql(`select count(*)::int n from audit_log where table_name = 'budget_lines' and action = 'delete'`);
  assert.ok(n >= 2, 'le righe sostituite restano nel registro');
});

test('spese da rimborsare: senza conto e fuori dai saldi; il rimborso le registra alla data di cassa', async () => {
  const due = (over) => mov({ account_id: null, currency: 'MGA', fx_rate: 5000, amount: 40000, category_id: R.out['203'],
    project_id: R.prj['École Piccolino'], paid_by: 'Chanfy', reimb_status: 'due', op_date: '2025-03-10', doc_date: '2025-03-10', ...over });
  const accMga = R.acc['Cassa Missione'];
  const bal = async () => Number((await as(U.ro, (q) => q('select balance from public.account_balances($1) where account_id = $2', [today, accMga])))[0].balance);
  const before = await bal();
  // operatore: registra due spese pagate di tasca propria (bozze senza conto, senza numero)
  const a = await rpc(U.op, 'save_movement', due({ description: 'taxi', document_ids: [await doc(U.op)] }));
  const b = await rpc(U.op, 'save_movement', due({ description: 'pranzo', amount: 25000, no_doc_reason: 'scontrino perso' }));
  assert.deepEqual([a.status, a.ref, b.status], ['draft', null, 'draft']);
  // non si può registrare senza conto, né chiedere "paid" direttamente
  await assert.rejects(rpc(U.op, 'save_movement', due({ status: 'recorded' })), /movements_account_or_due|due_is_expense_draft/);
  await assert.rejects(rpc(U.op, 'save_movement', due({ reimb_status: 'paid' })), /reimburse_expenses/);
  assert.equal(await bal(), before, 'le spese da rimborsare non toccano i saldi');
  // il rimborso lo fa un responsabile, non l'operatore
  const batch = randomUUID();
  const p = { ids: [a.id, b.id], account_id: accMga, date: '2025-04-02', client_batch: batch };
  await assert.rejects(rpc(U.op, 'reimburse_expenses', p), /forbidden/);
  await assert.rejects(rpc(U.resp, 'reimburse_expenses', { ...p, account_id: R.acc['Banca Italia'] }), /currency_mismatch/);
  const r = await rpc(U.resp, 'reimburse_expenses', p);
  assert.deepEqual([r.outcome, r.count, Number(r.total)], ['applied', 2, 65000]);
  const rows = await sql('select status, op_date::text d, doc_date::text dd, account_id, reimb_status, ref, recorded_by, paid_by from movements where id = any($1) order by amount', [[a.id, b.id]]);
  for (const m of rows) {
    assert.deepEqual([m.status, m.d, m.dd, m.account_id, m.reimb_status, m.recorded_by, m.paid_by],
      ['recorded', '2025-04-02', '2025-03-10', accMga, 'paid', U.resp, 'Chanfy']);
    assert.match(m.ref, /^MOV-2025-\d{3}$/);
  }
  assert.equal(await bal(), before - 65000, 'il saldo scende alla data del rimborso');
  // reinvio dello stesso rimborso: nessun effetto doppio
  const again = await rpc(U.resp, 'reimburse_expenses', p);
  assert.deepEqual([again.outcome, again.count], ['duplicate', 2]);
  // una spesa già rimborsata non si rimborsa di nuovo
  await assert.rejects(rpc(U.resp, 'reimburse_expenses', { ...p, client_batch: randomUUID() }), /già rimborsata/);
  // senza giustificativo né motivo il rimborso è rifiutato (e non resta nulla a metà)
  const c = await rpc(U.op, 'save_movement', due({ description: 'senza ricevuta' }));
  await assert.rejects(rpc(U.resp, 'reimburse_expenses', { ids: [c.id], account_id: accMga, date: '2025-04-03', client_batch: randomUUID() }), /document_required/);
  const [cc] = await sql('select status, reimb_status, account_id from movements where id = $1', [c.id]);
  assert.deepEqual([cc.status, cc.reimb_status, cc.account_id], ['draft', 'due', null]);
  // spesa incompleta (es. bozza importata): messaggio chiaro invece dell'errore di vincolo
  const d = await rpc(U.op, 'save_movement', due({ description: 'incompleta', category_id: null, no_doc_reason: 'scontrino perso' }));
  await assert.rejects(rpc(U.resp, 'reimburse_expenses', { ids: [d.id], account_id: accMga, date: '2025-04-03', client_batch: randomUUID() }),
    /incompleta \(Chanfy\): manca il codice contabile/);
  // spesa in ariary senza tasso: prende il tasso del mese del rimborso (o dell'ultimo precedente)
  const e = await rpc(U.op, 'save_movement', due({ description: 'senza tasso', fx_rate: null, no_doc_reason: 'scontrino perso' }));
  const rate = (await sql(`select r.rate from fx_rates r where (r.year, r.month) <= (2025, 4) order by r.year desc, r.month desc limit 1`))[0]?.rate;
  if (rate) {
    await rpc(U.resp, 'reimburse_expenses', { ids: [e.id], account_id: accMga, date: '2025-04-03', client_batch: randomUUID() });
    const [ee] = await sql('select status, fx_rate from movements where id = $1', [e.id]);
    assert.deepEqual([ee.status, Number(ee.fx_rate)], ['recorded', Number(rate)]);
  } else {
    await assert.rejects(rpc(U.resp, 'reimburse_expenses', { ids: [e.id], account_id: accMga, date: '2025-04-03', client_batch: randomUUID() }),
      /manca il tasso di cambio/);
  }
});

test('riconciliazione bancaria: spunta dell\'estratto, quadratura al centesimo, movimenti bloccati, annullo', async () => {
  const acc = R.acc['Banca Missione'];
  const mga = (over) => mov({ status: 'recorded', currency: 'MGA', fx_rate: 5000, account_id: acc, no_doc_reason: 'prova riconciliazione',
    op_date: '2025-05-05', ...over });
  const inc = await rpc(U.resp, 'save_movement', mga({ kind: 'income', amount: 1000000, category_id: R.in['E101'], project_id: null }));
  const exp = await rpc(U.resp, 'save_movement', mga({ amount: 150000 }));
  const chq = await rpc(U.resp, 'save_movement', mga({ amount: 70000, description: 'assegno non incassato' }));
  // giroconto dalla cassa alla banca: il lato «to» si spunta sulla banca
  const tr = await rpc(U.resp, 'save_movement', mga({ kind: 'transfer', amount: 200000, account_id: R.acc['Cassa Missione'],
    to_account_id: acc, to_amount: 200000, category_id: null, project_id: null, no_doc_reason: null }));
  const later = await rpc(U.resp, 'save_movement', mga({ amount: 5000, op_date: '2025-06-10' }));
  const rows = await as(U.resp, (q) => q('select * from public.account_legs($1)', [acc]));
  const leg = (id) => rows.find((r) => r.movement_id === id);
  assert.deepEqual([Number(leg(inc.id).amount), Number(leg(exp.id).amount), leg(tr.id).side, Number(leg(tr.id).amount)],
    [1000000, -150000, 'to', 200000]);
  assert.equal((await as(U.op, (q) => q('select * from public.account_legs($1)', [acc]))).length, 0, 'operatore: non vede la riconciliazione');

  const items = [inc, exp, tr].map((m) => ({ movement_id: m.id, side: m.id === tr.id ? 'to' : 'from' }));
  const base = { account_id: acc, statement_date: '2025-05-31', items };
  const [{ opening_balance }] = await sql('select opening_balance from accounts where id = $1', [acc]);
  const expected = Number(opening_balance) + 1000000 - 150000 + 200000;
  // operatore no; cassa no; saldo che non quadra no; movimento dopo la data dell'estratto no
  await assert.rejects(rpc(U.op, 'reconcile_account', { ...base, client_uuid: randomUUID(), statement_balance: expected }), /forbidden/);
  await assert.rejects(rpc(U.resp, 'reconcile_account', { ...base, account_id: R.acc['Cassa Missione'], client_uuid: randomUUID(),
    statement_balance: expected }), /conta di cassa/);
  await assert.rejects(rpc(U.resp, 'reconcile_account', { ...base, client_uuid: randomUUID(), statement_balance: expected - 70000 }),
    /unbalanced.*differenza/);
  await assert.rejects(rpc(U.resp, 'reconcile_account', { ...base, client_uuid: randomUUID(), statement_balance: expected - 5000,
    items: [...items, { movement_id: later.id, side: 'from' }] }), /data successiva/);
  assert.equal(Number((await sql('select count(*) n from bank_reconciliations'))[0].n), 0, 'nessuna riconciliazione a metà');

  const client = randomUUID();
  const r = await rpc(U.resp, 'reconcile_account', { ...base, client_uuid: client, statement_balance: expected });
  assert.deepEqual([r.outcome, r.count], ['applied', 3]);
  assert.equal((await rpc(U.resp, 'reconcile_account', { ...base, client_uuid: client, statement_balance: expected })).outcome, 'duplicate');
  // il movimento spuntato non cambia importo; quello non spuntato sì
  const [e] = await sql('select version from movements where id = $1', [exp.id]);
  await assert.rejects(rpc(U.resp, 'save_movement', { id: exp.id, expected_version: e.version, amount: 151000 }), /reconciled/);
  const [c] = await sql('select version from movements where id = $1', [chq.id]);
  await rpc(U.resp, 'save_movement', { id: chq.id, expected_version: c.version, notes: 'modificabile', amount: 70000 });
  // il lato «from» del giroconto (cassa) non è spuntato: la cassa non si riconcilia qui, il giroconto però è bloccato
  const [t] = await sql('select version from movements where id = $1', [tr.id]);
  await assert.rejects(rpc(U.resp, 'save_movement', { id: tr.id, expected_version: t.version, op_date: '2025-05-06' }), /reconciled/);
  // seconda riconciliazione: parte dal saldo riconciliato; data precedente rifiutata; già spuntato rifiutato
  await assert.rejects(rpc(U.resp, 'reconcile_account', { account_id: acc, statement_date: '2025-05-20', client_uuid: randomUUID(),
    statement_balance: expected, items: [] }), /successiva/);
  await assert.rejects(rpc(U.resp, 'reconcile_account', { account_id: acc, statement_date: '2025-06-30', client_uuid: randomUUID(),
    statement_balance: expected - 150000, items: [items[1]] }), /già spuntato/);
  const r2 = await rpc(U.resp, 'reconcile_account', { account_id: acc, statement_date: '2025-06-30', client_uuid: randomUUID(),
    statement_balance: expected - 70000 - 5000, items: [{ movement_id: chq.id, side: 'from' }, { movement_id: later.id, side: 'from' }] });
  assert.equal(Number(r2.previous), expected);
  // annullo: solo amministratori, solo l'ultima, con motivo; poi i movimenti tornano modificabili
  await assert.rejects(rpc(U.resp, 'cancel_reconciliation', r2.id, 'errore di prova'), /forbidden/);
  await assert.rejects(rpc(U.admin, 'cancel_reconciliation', r.id, 'errore di prova'), /ultima/);
  await assert.rejects(rpc(U.admin, 'cancel_reconciliation', r2.id, 'no'), /motivo/);
  await rpc(U.admin, 'cancel_reconciliation', r2.id, 'estratto sbagliato');
  const [c2] = await sql('select version from movements where id = $1', [chq.id]);
  await rpc(U.resp, 'save_movement', { id: chq.id, expected_version: c2.version, amount: 71000 });
  const [h] = await sql('select cancelled_at is not null as x, cancel_reason from bank_reconciliations where id = $1', [r2.id]);
  assert.deepEqual([h.x, h.cancel_reason], [true, 'estratto sbagliato']);
  // lo storico non si cancella dall'app
  await assert.rejects(as(U.admin, (q) => q('delete from public.bank_reconciliations where id = $1', [r.id])), /permission denied/);
});

test('collegamento con altre app: chiave mostrata una volta, sola lettura a pagine, niente bozze, revoca', async () => {
  await assert.rejects(rpc(U.resp, 'create_api_client', 'App madre'), /forbidden/);
  const k = await rpc(U.admin, 'create_api_client', 'App madre');
  assert.match(k.key, /^yc_[0-9a-f]{64}$/);
  const [row] = await sql('select key_hash, key_prefix from api_clients where id = $1', [k.id]);
  assert.notEqual(row.key_hash, k.key, 'nel database solo l\'impronta');
  assert.equal(row.key_prefix, k.key.slice(0, 10));
  // l'app collegata non ha un utente (ruolo anon)
  const anon = async (fn, ...a) => {
    const c = await pool.connect();
    try {
      await c.query('set role anon');
      return (await c.query(`select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(',')}) as r`, a)).rows[0].r;
    } finally { await c.query('reset role').catch(() => {}); c.release(); }
  };
  await assert.rejects(anon('api_read', 'yc_sbagliata', 'movements', null, null, 10), /unauthorized/);
  await assert.rejects(anon('api_read', k.key, 'profiles', null, null, 10), /entità sconosciuta/);
  const [{ n }] = await sql(`select count(*)::int n from movements where status <> 'draft'`);
  let seen = 0, since = null, after = null, pages = 0;
  do {
    const r = await anon('api_read', k.key, 'movements', since, after, 7);
    assert.ok(r.items.every((m) => m.status !== 'draft'), 'niente bozze');
    seen += r.count; pages++;
    since = r.next?.since ?? null; after = r.next?.after ?? null;
  } while (since && pages < 100);
  assert.equal(seen, n, 'tutte le pagine, nessun doppione');
  const cps = await anon('api_read', k.key, 'counterparties', null, null, 1000);
  assert.ok(cps.items.every((c) => !('iban' in c) && !('tax_code' in c)), 'niente dati personali');
  // revoca: la chiave smette di funzionare
  await rpc(U.admin, 'revoke_api_client', k.id);
  await assert.rejects(anon('api_read', k.key, 'projects', null, null, 10), /unauthorized/);
});

test('anticipi al personale: consegna fuori cassa, spese nel rendiconto, saldo da giustificare, autocertificazione', async () => {
  const cash = R.acc['Cassa Missione'];
  const rate = { currency: 'MGA', fx_rate: 5000 };
  await assert.rejects(rpc(U.op, 'create_advance_account', 'Rakoto', 'MGA', 'MG'), /forbidden/);
  const acc = await rpc(U.resp, 'create_advance_account', 'Rakoto', 'MGA', 'MG');
  await assert.rejects(rpc(U.resp, 'create_advance_account', 'rakoto', 'MGA', 'MG'), /esiste già/);
  const cashBal = async () => (await as(U.resp, (q) => q('select balance from account_balances() where account_id = $1', [cash])))[0].balance;
  const sum = async () => (await as(U.resp, (q) => q('select * from advance_summary() where account_id = $1', [acc.id])))[0];
  const stmt = async () => Number((await as(U.resp, (q) => q(
    `select coalesce(sum(amount_eur),0) s from report_cash_statement($1) where direction = 'out'`, [year])))[0].s);
  const c0 = Number(await cashBal()); const s0 = await stmt();

  // consegna: giroconto cassa → anticipi (la cassa scende, il rendiconto no)
  const old = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  await rpc(U.resp, 'save_movement', { client_uuid: randomUUID(), kind: 'transfer', op_date: old, amount: 500000, to_amount: 500000,
    account_id: cash, to_account_id: acc.id, status: 'recorded', ...rate });
  assert.equal(Number(await cashBal()), c0 - 500000);
  assert.equal(await stmt(), s0);

  // spesa con l'anticipo: entra nel rendiconto, la cassa non scende di nuovo
  const sp = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'mercato senza ricevuta',
    account_id: acc.id, amount: 150000, paid_by: 'Rakoto', ...rate }));
  assert.equal(Number(await cashBal()), c0 - 500000);
  assert.equal(await stmt(), s0 + 30);
  // su un conto anticipi non si incassa
  await assert.rejects(rpc(U.op, 'save_movement', mov({ kind: 'income', category_id: R.in['E101'], account_id: acc.id,
    status: 'recorded', no_doc_reason: 'prova entrata', ...rate })), /non si registrano entrate/);

  // restituzione parziale
  await rpc(U.resp, 'save_movement', { client_uuid: randomUUID(), kind: 'transfer', op_date: today, amount: 50000, to_amount: 50000,
    account_id: acc.id, to_account_id: cash, status: 'recorded', ...rate });
  let s = await sum();
  assert.deepEqual([Number(s.given), Number(s.spent), Number(s.returned), Number(s.balance)], [500000, 150000, 50000, 300000]);
  assert.equal(s.open_since.toISOString().slice(0, 10) <= old, true, 'aperto dalla consegna di 40 giorni fa');
  assert.equal(s.holder, 'Rakoto');
  assert.equal(s.spent_count, 1);
  // l'operatore non vede il riepilogo
  assert.equal((await as(U.op, (q) => q('select * from advance_summary()'))).length, 0);

  // autocertificazione: dati presi dal movimento, numero AUT, un PDF allegato, poi firmata
  await assert.rejects(rpc(U.ro, 'create_self_cert', { movement_id: sp.id, declarant: 'Rakoto', reason: 'mercato' }), /forbidden/);
  await assert.rejects(rpc(U.op, 'create_self_cert', { movement_id: sp.id, declarant: 'Rakoto', reason: '' }), /motivo/);
  const a1 = await rpc(U.op, 'create_self_cert', { movement_id: sp.id, declarant: 'Rakoto', reason: 'mercato senza ricevuta', amount: 1 });
  assert.match(a1.number, new RegExp(`^AUT-${year}-\\d{3}$`));
  assert.equal(Number(a1.amount), 150000, 'importo dal movimento, non dal dispositivo');
  const a2 = await rpc(U.op, 'create_self_cert', { movement_id: sp.id, declarant: 'Rakoto Jean', reason: 'mercato senza ricevuta', lang: 'fr' });
  assert.equal(a2.number, a1.number, 'riemessa prima del PDF: stesso numero');
  assert.equal(a2.lang, 'fr');
  await assert.rejects(rpc(U.resp, 'sign_self_cert', a1.id), /prima si genera/);
  const d = await doc(U.op);
  const at = await rpc(U.op, 'attach_self_cert', a1.id, d);
  assert.equal(at.document_id, d);
  const [dd] = await sql('select doc_type, doc_number from documents where id = $1', [d]);
  assert.deepEqual(dd, { doc_type: 'self_cert', doc_number: a1.number });
  assert.equal((await sql('select 1 from movement_documents where movement_id = $1 and document_id = $2', [sp.id, d])).length, 1);
  await assert.rejects(rpc(U.op, 'create_self_cert', { movement_id: sp.id, declarant: 'X', reason: 'altro motivo' }), /già emessa/);
  assert.equal((await sum()).aut_to_sign, 1);
  await assert.rejects(rpc(U.op, 'sign_self_cert', a1.id), /forbidden/);
  const sg = await rpc(U.resp, 'sign_self_cert', a1.id);
  assert.ok(sg.signed_at);
  s = await sum();
  assert.equal(s.aut_to_sign, 0);
  assert.equal(s.spent_no_doc, 0);
  // non per entrate o giroconti
  const inc = await rpc(U.op, 'save_movement', mov({ kind: 'income', category_id: R.in['E101'], status: 'recorded', no_doc_reason: 'prova entrata' }));
  await assert.rejects(rpc(U.op, 'create_self_cert', { movement_id: inc.id, declarant: 'X', reason: 'prova motivo' }), /solo per una spesa/);
});

test('preventivo: versioni, approvazione con delibera, blocco delle righe, revisione, confronto con il consuntivo', async () => {
  const Y = Number(today.slice(0, 4));
  await assert.rejects(rpc(U.op, 'budget_draft', Y, null, null), /forbidden/);
  const d1 = await rpc(U.resp, 'budget_draft', Y, null, 'Preventivo');
  assert.equal(d1.version, 1);
  assert.equal((await rpc(U.resp, 'budget_draft', Y, null, null)).outcome, 'exists', 'una sola bozza per anno');
  const [{ id: prj }] = await sql(`insert into projects(org_id, name) values ($1, 'Prova preventivo') returning id`, [ORG]);
  const l1 = await rpc(U.resp, 'budget_item_save', { budget_id: d1.id, category_id: R.out['201'], project_id: prj, qty: 12, unit: 'mesi', unit_cost: 100, currency: 'EUR' });
  assert.equal(Number(l1.amount_eur), 1200);
  const l2 = await rpc(U.resp, 'budget_item_save', { budget_id: d1.id, category_id: R.out['401'], project_id: prj, qty: 2, unit_cost: 250000, currency: 'MGA', fx_rate: 5000 });
  assert.equal(Number(l2.amount_eur), 100);
  await assert.rejects(rpc(U.resp, 'budget_item_save', { budget_id: d1.id, category_id: R.out['401'], unit_cost: 1, currency: 'MGA' }), /tasso/);
  await rpc(U.resp, 'budget_item_save', { budget_id: d1.id, category_id: R.in['E101'], qty: 1, unit_cost: 5000, currency: 'EUR' });
  // approvazione: solo amministratori e con la delibera
  await assert.rejects(rpc(U.resp, 'budget_approve', d1.id, 'CdA 10/01'), /forbidden/);
  await assert.rejects(rpc(U.admin, 'budget_approve', d1.id, ''), /delibera/);
  const ap = await rpc(U.admin, 'budget_approve', d1.id, 'Delibera CdA del 10 gennaio');
  assert.equal(ap.status, 'approved');
  // approvato = bloccato
  await assert.rejects(rpc(U.resp, 'budget_item_save', { id: l1.id, budget_id: d1.id, category_id: R.out['201'], unit_cost: 1 }), /approvato/);
  await assert.rejects(rpc(U.resp, 'budget_item_delete', l1.id), /approvato/);
  await assert.rejects(rpc(U.resp, 'budget_discard', d1.id), /bozza/);
  // revisione: copia l'approvata, che diventa superata solo quando si approva la revisione
  const d2 = await rpc(U.resp, 'budget_draft', Y, null, 'Revisione 1');
  assert.deepEqual([d2.version, d2.copied], [2, 3]);
  const [r2] = await sql(`select id from budget_items where budget_id = $1 and category_id = $2`, [d2.id, R.out['201']]);
  await rpc(U.resp, 'budget_item_save', { id: r2.id, budget_id: d2.id, category_id: R.out['201'], project_id: prj, qty: 12, unit_cost: 150, currency: 'EUR' });
  assert.equal((await sql(`select status from budgets where id = $1`, [d1.id]))[0].status, 'approved');
  await rpc(U.admin, 'budget_approve', d2.id, 'Delibera CdA di giugno – revisione');
  assert.deepEqual((await sql(`select version, status from budgets where year = $1 order by version`, [Y])).map((r) => r.status), ['superseded', 'approved']);
  assert.equal(Number((await sql(`select sum(amount_eur) s from budget_items where budget_id = $1 and category_id = $2`, [d1.id, R.out['201']]))[0].s), 1200, 'la versione superata non cambia');
  // consuntivo: una spesa registrata e una bozza (impegnato) nel 2031
  await rpc(U.op, 'save_movement', mov({ project_id: prj, amount: 300, status: 'recorded', no_doc_reason: 'prova consuntivo' }));
  await rpc(U.op, 'save_movement', mov({ project_id: prj, amount: 50, status: 'draft' }));
  const cmp = await as(U.resp, (q) => q('select * from budget_compare($1)', [Y]));
  const row = cmp.find((r) => r.category_id === R.out['201'] && r.project_id === prj);
  assert.deepEqual([Number(row.budget_eur), Number(row.actual_eur), Number(row.committed_eur)], [1800, 300, 50]);
  const v1 = await as(U.resp, (q) => q('select * from budget_compare($1, $2)', [Y, d1.id]));
  assert.equal(Number(v1.find((r) => r.category_id === R.out['201'] && r.project_id === prj).budget_eur), 1200, 'confronto con una versione scelta');
  assert.equal((await as(U.op, (q) => q('select * from budget_compare($1)', [Y]))).length, 0, 'l\'operatore non vede il preventivo');
  // il budget di progetto per anno viene dal preventivo approvato
  const bva = await as(U.resp, (q) => q('select * from budget_vs_actual($1, $2, null)', [prj, Y]));
  assert.equal(bva.reduce((s, r) => s + Number(r.budget_eur), 0), 1900);
  // una bozza vuota si elimina
  const d3 = await rpc(U.resp, 'budget_draft', Y, null, null);
  assert.equal((await rpc(U.resp, 'budget_discard', d3.id)).outcome, 'deleted');
  // copia da un altro anno
  const n = await rpc(U.resp, 'budget_draft', Y + 1, Y, null);
  assert.equal(n.copied, 3);
});

test('preventivo nello schema del rendiconto: stesse voci del consuntivo, struttura in E, codici da classificare', async () => {
  const Y = Number(today.slice(0, 4)) + 3;
  const d = await rpc(U.resp, 'budget_draft', Y, null, null);
  const [{ id: prj }] = await sql(`insert into projects(org_id, name) values ($1, 'Prova schema') returning id`, [ORG]);
  const add = (category_id, project_id, unit_cost) => rpc(U.resp, 'budget_item_save', { budget_id: d.id, category_id, project_id, qty: 1, unit_cost, currency: 'EUR' });
  await add(R.out['101'], R.gen, 300);     // struttura -> E4
  await add(R.out['101'], prj, 200);       // progetto -> A4
  await add(R.out['999'], prj, 15);        // senza voce
  await add(R.in['E101'], null, 1000);     // entrata A4
  const draft = await as(U.ro, (q) => q('select * from budget_statement($1, $2)', [Y, d.id]));
  const line = (rows, dir, k) => Number(rows.find((r) => r.direction === dir && r.key === k)?.budget_eur ?? NaN);
  assert.equal(line(draft, 'out', 'E4'), 300);
  assert.equal(line(draft, 'out', 'A4'), 200);
  assert.equal(line(draft, 'in', 'A4'), 1000);
  assert.equal(Number(draft.find((r) => r.direction === 'out' && r.key === null).budget_eur), 15, 'riga da classificare');
  const tot = draft.filter((r) => r.direction === 'out').reduce((s, r) => s + Number(r.budget_eur), 0);
  assert.equal(tot, 515, 'il totale torna con le righe del preventivo');
  // senza versione: l'approvata (qui nessuna, quindi zero)
  assert.equal((await as(U.ro, (q) => q('select * from budget_statement($1)', [Y]))).reduce((s, r) => s + Number(r.budget_eur), 0), 0);
  await rpc(U.admin, 'budget_approve', d.id, 'Delibera di prova');
  assert.equal(line(await as(U.ro, (q) => q('select * from budget_statement($1)', [Y])), 'out', 'E4'), 300);
  assert.equal((await as(U.op, (q) => q('select * from budget_statement($1)', [Y]))).length, 0, 'solo staff');
});

test('scadenziario: scadenze a mano, adempimenti dell\'app, ricorrenza, visibilità', async () => {
  await assert.rejects(rpc(U.ro, 'deadline_save', { title: 'Prova', due_date: '2031-01-31' }), /forbidden/);
  const d = await rpc(U.op, 'deadline_save', { title: 'Pagare affitto ufficio', category: 'pay', due_date: '2031-01-31', amount: 450, repeat: 'monthly', priority: 'high' });
  assert.deepEqual([d.currency, d.status, d.priority], ['EUR', 'open', 'high']);
  const done = await rpc(U.op, 'deadline_set_status', d.id, 'done');
  assert.ok(done.done_at);
  const next = await sql(`select due_date::text d, status from deadlines where title = 'Pagare affitto ufficio' order by due_date`);
  assert.deepEqual(next.map((r) => r.d), ['2031-01-31', '2031-02-28'], 'la ricorrenza mensile crea la successiva');
  // adempimento dell'app: una sola riga per chiave, anche se salvato due volte
  await rpc(U.resp, 'deadline_save', { rule_key: 'runts-2031', title: 'Deposito del bilancio 2030 al RUNTS', category: 'ets', due_date: '2031-06-30' });
  const r2 = await rpc(U.resp, 'deadline_save', { rule_key: 'runts-2031', title: 'Deposito del bilancio 2030 al RUNTS', due_date: '2031-06-27' });
  assert.equal(r2.due_date, '2031-06-27');
  assert.equal((await sql(`select count(*)::int n from deadlines where rule_key = 'runts-2031'`))[0].n, 1);
  // l'operatore vede solo le sue
  const mine = await as(U.op, (q) => q('select title from deadlines'));
  assert.ok(mine.every((r) => r.title !== 'Deposito del bilancio 2030 al RUNTS'));
  await assert.rejects(rpc(U.op, 'deadline_set_status', r2.id, 'done'), /forbidden/);
  assert.ok(Number(await rpc(U.resp, 'income_of_year', Number(today.slice(0, 4)))) >= 0);
});

test('documenti emessi: bozza, emissione numerata e bloccata, PDF collegato al movimento, annullamento con motivo', async () => {
  const inc = await rpc(U.op, 'save_movement', mov({ kind: 'income', category_id: R.in['E101'], status: 'recorded', no_doc_reason: 'donazione' }));
  await assert.rejects(rpc(U.op, 'issued_doc_save', { type: 'FAT', party_name: 'X' }), /tipo/);
  const dr = await rpc(U.op, 'issued_doc_save', { type: 'RIC', movement_id: inc.id, party_name: 'Mario Rossi', party_tax_id: 'RSSMRA80A01H501U',
    amount: 100, currency: 'EUR', lang: 'it', data: { causale: 'don', method: 'Bonifico' } });
  assert.equal(dr.status, 'draft');
  assert.equal(dr.number, null);
  // dati personali: staff e autore
  assert.equal((await as(U.ro, (q) => q('select party_tax_id from issued_docs where id = $1', [dr.id])))[0].party_tax_id, 'RSSMRA80A01H501U');
  const iss = await rpc(U.op, 'issued_doc_issue', dr.id);
  assert.match(iss.number, new RegExp(`^RIC-${today.slice(0, 4)}-\\d{3}$`));
  await assert.rejects(rpc(U.op, 'issued_doc_save', { id: dr.id, type: 'RIC', party_name: 'Altro', amount: 1 }), /già emesso/);
  const d = await doc(U.op);
  await rpc(U.op, 'issued_doc_attach', dr.id, d);
  assert.equal((await sql('select count(*)::int n from movement_documents where movement_id = $1 and document_id = $2', [inc.id, d]))[0].n, 1);
  // annullamento: solo un responsabile, con motivo; il numero resta
  await assert.rejects(rpc(U.op, 'issued_doc_cancel', dr.id, 'errore di importo'), /forbidden/);
  await assert.rejects(rpc(U.resp, 'issued_doc_cancel', dr.id, ''), /motivo/);
  const c = await rpc(U.resp, 'issued_doc_cancel', dr.id, 'errore di importo');
  assert.deepEqual([c.status, c.number], ['cancelled', iss.number]);
  // la numerazione prosegue, non riusa
  const n2 = await rpc(U.op, 'issued_doc_save', { type: 'RIC', party_name: 'Anna', amount: 20, currency: 'EUR' });
  const i2 = await rpc(U.op, 'issued_doc_issue', n2.id);
  assert.notEqual(i2.number, iss.number);
  // bozza incompleta non si emette; una bozza si elimina
  const n3 = await rpc(U.op, 'issued_doc_save', { type: 'QUI', amount: 0 });
  await assert.rejects(rpc(U.op, 'issued_doc_issue', n3.id), /controparte/);
  assert.equal((await rpc(U.op, 'issued_doc_cancel', n3.id, null)).outcome, 'deleted');
});

test('dati dimostrativi: caricamento marcato DEMO, eliminazione sicura, svuotamento con conferma del numero, reali intatti', async () => {
  const { execFileSync } = await import('node:child_process');
  const p = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/demo-payload.mjs', String(year)], { maxBuffer: 1 << 26 }).toString());
  const realBefore = (await sql('select count(*)::int n from movements where not demo'))[0].n;
  const realBudget = (await sql(`select count(*)::int n from budgets where year = $1 and status = 'approved' and not demo`, [year]))[0].n > 0;
  await assert.rejects(rpc(U.resp, 'demo_load', p), /forbidden|amministratore/);
  await rpc(U.admin, 'demo_load', p);
  await assert.rejects(rpc(U.admin, 'demo_load', p), /già dati dimostrativi/);
  const c = await rpc(U.admin, 'demo_counts');
  assert.ok(c.movements > 300, `movimenti demo: ${c.movements}`);
  // il preventivo demo entra solo se per l'anno non c'è già un preventivo reale approvato (quello reale prevale)
  if (realBudget) assert.equal(c.budget_items, 0); else assert.ok(c.budget_items > 100);
  // ogni movimento demo è riconoscibile; i reali non sono stati toccati
  assert.equal((await sql(`select count(*)::int n from movements where demo and (ref is not null and ref not like 'DEMO-%')`))[0].n, 0);
  assert.equal((await sql(`select count(*)::int n from movements where demo and notes not like 'DEMO%'`))[0].n, 0);
  assert.equal((await sql('select count(*)::int n from movements where not demo'))[0].n, realBefore);
  // i tassi reali del foglio Excel entrano come reali con la fonte
  assert.ok((await sql(`select count(*)::int n from fx_rates where not demo and source like '%Exchange Rate%'`))[0].n >= 1);
  // un movimento demo registrato si elimina (responsabile), uno reale registrato no: si storna
  const dm = (await sql(`select id from movements where demo and status <> 'draft' limit 1`))[0].id;
  await assert.rejects(rpc(U.op, 'movement_delete', dm), /forbidden/);
  await rpc(U.resp, 'movement_delete', dm);
  const real = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova' }));
  await assert.rejects(rpc(U.resp, 'movement_delete', real.id), /storno/);
  const draft = await rpc(U.op, 'save_movement', mov({ status: 'draft' }));
  assert.equal((await rpc(U.op, 'movement_delete', draft.id)).outcome, 'deleted');
  // l'eliminazione resta nel registro modifiche
  assert.equal((await sql(`select count(*)::int n from audit_log where table_name = 'movements' and row_id = $1 and action = 'delete' and old_row is not null`, [dm]))[0].n, 1);
  // anche i finanziamenti di prova sono demo e si eliminano con il resto
  await sql(`insert into grants(org_id, title, demo) select org_id, 'Finanziamento di prova', true from profiles where id = $1`, [U.admin]);
  // svuotamento: numero sbagliato → nulla eliminato; numero giusto → solo i demo
  const c2 = await rpc(U.admin, 'demo_counts');
  assert.ok(c2.grants >= 1);
  await assert.rejects(rpc(U.admin, 'demo_purge', c2.movements + 1), /ricarica/);
  await assert.rejects(rpc(U.resp, 'demo_purge', c2.movements), /forbidden|amministratore/);
  await rpc(U.admin, 'demo_purge', c2.movements);
  const c3 = await rpc(U.admin, 'demo_counts');
  assert.deepEqual([c3.movements, c3.budgets, c3.deadlines, c3.counterparties, c3.grants], [0, 0, 0, 0, 0]);
  assert.equal((await sql('select count(*)::int n from movements where not demo'))[0].n, realBefore + 1);
  assert.ok((await sql(`select count(*)::int n from fx_rates where not demo and source like '%Exchange Rate%'`))[0].n >= 1, 'i tassi reali restano');
});

test('preventivo: eliminazione di una bozza; versione approvata reale solo da amministratore con motivo, torna in vigore la precedente', async () => {
  const Y = year + 3;
  const b1 = await rpc(U.resp, 'budget_draft', Y, null, 'Versione 1');
  await rpc(U.resp, 'budget_item_save', { budget_id: b1.id, category_id: R.out['201'], project_id: R.prj['École Piccolino'], qty: 1, unit_cost: 100, currency: 'EUR' });
  await rpc(U.admin, 'budget_approve', b1.id, 'delibera di prova 1');
  const b2 = await rpc(U.resp, 'budget_draft', Y, null, 'Versione 2');
  await rpc(U.admin, 'budget_approve', b2.id, 'delibera di prova 2');
  await assert.rejects(rpc(U.resp, 'budget_delete', b2.id, 'errore grave'), /amministratore/);
  await assert.rejects(rpc(U.admin, 'budget_delete', b2.id, ''), /motivo/);
  await rpc(U.admin, 'budget_delete', b2.id, 'approvato per errore');
  assert.equal((await sql('select status from budgets where id = $1', [b1.id]))[0].status, 'approved');
  const b3 = await rpc(U.resp, 'budget_draft', Y, null, 'Bozza da buttare');
  assert.equal((await rpc(U.resp, 'budget_delete', b3.id, null)).outcome, 'deleted');
});

test('preventivo: righe della versione in vigore corrette ed eliminate una per una, con motivo e storico', async () => {
  const Y = year + 4;
  const b = await rpc(U.resp, 'budget_draft', Y, null, 'Da correggere');
  const it1 = await rpc(U.resp, 'budget_item_save', { budget_id: b.id, category_id: R.out['201'], qty: 2, unit_cost: 100, currency: 'EUR' });
  const it2 = await rpc(U.resp, 'budget_item_save', { budget_id: b.id, category_id: R.out['201'], qty: 1, unit_cost: 50, currency: 'EUR' });
  // bozza: modifica ed eliminazione dirette, senza storico
  await rpc(U.resp, 'budget_item_amend', { ...it2, budget_id: b.id, unit_cost: 60 }, null);
  await rpc(U.admin, 'budget_approve', b.id, 'delibera di prova');
  // versione approvata: la scrittura diretta resta bloccata
  await assert.rejects(rpc(U.resp, 'budget_item_save', { ...it1, budget_id: b.id, unit_cost: 1 }), /immutable|approvato/);
  await assert.rejects(rpc(U.resp, 'budget_item_amend', { ...it1, budget_id: b.id, unit_cost: 120 }, 'motivo valido'), /amministratore/);
  await assert.rejects(rpc(U.admin, 'budget_item_amend', { ...it1, budget_id: b.id, unit_cost: 120 }, ''), /motivo/);
  const up = await rpc(U.admin, 'budget_item_amend', { ...it1, budget_id: b.id, unit_cost: 120 }, 'nuovo preventivo del fornitore');
  assert.equal(Number(up.amount), 240);
  await rpc(U.admin, 'budget_item_remove', it2.id, 'voce annullata');
  await assert.rejects(rpc(U.admin, 'budget_item_remove', it1.id, 'ultima riga'), /ultima riga/);
  const h = await sql('select op, reason, (old_row->>\'unit_cost\')::numeric old_cost, (new_row->>\'unit_cost\')::numeric new_cost from budget_amendments where budget_id = $1 order by id', [b.id]);
  assert.deepEqual(h.map((r) => [r.op, r.reason, Number(r.old_cost), r.new_cost == null ? null : Number(r.new_cost)]),
    [['update', 'nuovo preventivo del fornitore', 100, 120], ['delete', 'voce annullata', 60, null]]);
  await assert.rejects(sql('update budget_amendments set reason = $1', ['x']), /immutable|non si modifica/);
  assert.equal((await sql('select status from budgets where id = $1', [b.id]))[0].status, 'approved', 'resta la versione in vigore');
});

test('documenti emessi: dichiarazione senza importo, buono d\'ordine, archiviazione', async () => {
  const d = await rpc(U.op, 'issued_doc_save', { type: 'DIC', party_name: 'Volontaria di prova', currency: 'EUR', data: { tpl: 'vol', period: '2026' } });
  const i = await rpc(U.op, 'issued_doc_issue', d.id);
  assert.match(i.number, /^DIC-\d{4}-\d{3}$/);
  const o = await rpc(U.op, 'issued_doc_save', { type: 'BDC', party_name: 'Fornitore', amount: 120, currency: 'EUR', data: { lines: [{ d: 'Quaderni', q: 10, p: 12 }] } });
  await assert.rejects(rpc(U.op, 'issued_doc_archive', o.id, true), /forbidden/);
  await assert.rejects(rpc(U.resp, 'issued_doc_archive', o.id, true), /bozza/);
  await rpc(U.op, 'issued_doc_issue', o.id);
  assert.ok((await rpc(U.resp, 'issued_doc_archive', o.id, true)).archived_at);
  assert.equal((await rpc(U.resp, 'issued_doc_archive', o.id, false)).archived_at, null);
});

test('numerazione oltre 999: MOV-AAAA-1000 non tronca e non duplica', async () => {
  const Y = year + 5;
  await sql(`insert into app.ref_counters(org_id, year, last) values ($1, $2, 999) on conflict (org_id, year) do update set last = 999`, [ORG, Y]);
  const ref = (await sql(`select app.next_ref($1, $2::date) r`, [ORG, `${Y}-03-01`]))[0].r;
  assert.match(ref, new RegExp(`^MOV-${Y}-\\d{4}$`), ref);
});

test('azzeramento prima dell\'avvio: solo super admin, backup recente, numeri e parola di conferma; poi zero movimenti e preventivi', async () => {
  const c = await rpc(U.sa, 'reset_counts');
  assert.ok(c.movements > 0 && c.budgets > 0);
  await assert.rejects(rpc(U.admin, 'reset_accounting', c.movements, c.budgets, 'AZZERA'), /super amministratore/);
  await assert.rejects(rpc(U.sa, 'reset_accounting', c.movements, c.budgets, 'azzera'), /AZZERA/);
  await assert.rejects(rpc(U.sa, 'reset_accounting', c.movements, c.budgets, 'AZZERA'), /backup/);
  await sql(`insert into settings(org_id, key, value) values ($1, 'last_backup', jsonb_build_object('at', now())) on conflict (org_id, key) do update set value = excluded.value`, [ORG]);
  await assert.rejects(rpc(U.sa, 'reset_accounting', c.movements + 1, c.budgets, 'AZZERA'), /ricarica/);
  const auditBefore = (await sql(`select count(*)::int n from audit_log where table_name = 'movements' and action = 'delete'`))[0].n;
  await rpc(U.sa, 'reset_accounting', c.movements, c.budgets, 'AZZERA');
  const after = await rpc(U.sa, 'reset_counts');
  assert.deepEqual([after.movements, after.budgets, after.budget_items, after.reconciliations, after.cash_counts], [0, 0, 0, 0, 0]);
  assert.equal((await sql(`select count(*)::int n from audit_log where table_name = 'movements' and action = 'delete'`))[0].n - auditBefore, c.movements, 'ogni movimento eliminato resta nel registro');
  // la numerazione riparte da 001
  const m = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'dopo azzeramento' }));
  assert.match(m.ref, new RegExp(`^MOV-${year}-001$`));
  assert.ok((await sql('select count(*)::int n from accounts'))[0].n > 0, 'i conti restano');
});

// come rpc(), ma con il token di chi ha appena reinserito la password (amr «password» di ageSec secondi fa)
const rpcPw = (uid, ageSec, fn, ...args) => as(uid, async (q) => {
  await q("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated',
    amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) - ageSec }] })]);
  return (await q(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) as r`, args))[0].r;
});

test('eliminazione definitiva di movimenti: amministratore, password appena reinserita, motivo, storni insieme, mesi chiusi esclusi, tutto con backup', async () => {
  const a = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova eliminazione A' }));
  const b = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova eliminazione B' }));
  const s = await rpc(U.resp, 'reverse_movement', b.id, 'importo errato', randomUUID(), null);
  await assert.rejects(rpcPw(U.resp, 10, 'movement_purge', [a.id], 'prova di errore'), /amministratore/);
  await assert.rejects(rpc(U.admin, 'movement_purge', [a.id], 'prova di errore'), /password/);
  await assert.rejects(rpcPw(U.admin, 900, 'movement_purge', [a.id], 'prova di errore'), /password/, 'password vecchia');
  await assert.rejects(rpcPw(U.admin, 10, 'movement_purge', [a.id], 'no'), /motivo/);
  const before = (await sql(`select count(*)::int n from audit_log where table_name = 'movements' and action = 'delete'`))[0].n;
  const r = await rpcPw(U.admin, 10, 'movement_purge', [a.id, b.id], 'movimenti inseriti per prova');
  assert.equal(r.deleted, 3, 'con lo storno del movimento B');
  assert.ok(s, 'storno creato');
  assert.equal((await sql('select count(*)::int n from movements where id = any($1) or reverses_id = $2', [[a.id, b.id], b.id]))[0].n, 0);
  assert.equal((await sql(`select count(*)::int n from audit_log where table_name = 'movements' and action = 'delete'`))[0].n - before, 3, 'restano nel registro');
  // mese chiuso: non si elimina
  const c = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'prova mese chiuso', op_date: `${year - 1}-03-10` }));
  await sql(`insert into periods(org_id, year, month, closed_at, closed_by) values ($1, $2, 3, now(), $3)`, [ORG, year - 1, U.admin]);
  await assert.rejects(rpcPw(U.admin, 10, 'movement_purge', [c.id], 'mese già chiuso'), /mese chiuso/);
  await assert.rejects(rpcPw(U.sa, 10, 'movement_purge_all', 999, 'ripulisco tutto'), /backup|mesi chiusi|ricarica/);
  await sql(`delete from periods where org_id = $1 and year = $2 and month = 3`, [ORG, year - 1]);
  await sql(`insert into settings(org_id, key, value) values ($1, 'last_backup', jsonb_build_object('at', now())) on conflict (org_id, key) do update set value = excluded.value`, [ORG]);
  const n = (await sql('select count(*)::int n from movements'))[0].n;
  await assert.rejects(rpcPw(U.sa, 10, 'movement_purge_all', n + 1, 'ripulisco tutto'), /ricarica/);
  const all = await rpcPw(U.sa, 10, 'movement_purge_all', n, 'ripulisco tutto');
  assert.equal(all.deleted, n);
  assert.equal((await sql('select count(*)::int n from movements'))[0].n, 0);
  const m = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'dopo la pulizia' }));
  assert.match(m.ref, new RegExp(`^MOV-${year}-001$`));
});

test('riapertura della verifica: solo amministratore con motivo; torna registrato, si corregge, si riverifica', async () => {
  const r = await rpc(U.op, 'save_movement', mov({ status: 'recorded', no_doc_reason: 'da verificare e riaprire' }));
  const [row] = await sql('select version from movements where id = $1', [r.id]);
  await rpc(U.resp, 'verify_movement', r.id, row.version);
  await assert.rejects(sql('update movements set description = $2 where id = $1', [r.id, 'x']), /verificato/);
  await assert.rejects(rpc(U.resp, 'movement_unverify', r.id, 'errore di codice'), /amministratore/);
  await assert.rejects(rpc(U.admin, 'movement_unverify', r.id, 'no'), /motivo/);
  await rpc(U.admin, 'movement_unverify', r.id, 'codice contabile sbagliato');
  const [m] = await sql('select status, verified_by, notes from movements where id = $1', [r.id]);
  assert.equal(m.status, 'recorded'); assert.equal(m.verified_by, null);
  assert.match(m.notes, /Verifica riaperta.*codice contabile sbagliato/);
  await assert.rejects(rpc(U.admin, 'movement_unverify', r.id, 'di nuovo'), /non è verificato/);
});

test('eliminazione di un utente: solo super amministratore con password; senza dati sparisce, con dati resta il nome ma non l\'accesso', async () => {
  const clean = await newUser('da-eliminare', 'operator');
  const busy = await newUser('con-dati', 'responsabile');
  await rpc(busy, 'save_movement', mov({ status: 'draft' }));
  await assert.rejects(rpcPw(U.admin, 10, 'user_delete', clean, 'non serve più'), /super amministratore/);
  await assert.rejects(rpc(U.sa, 'user_delete', clean, 'non serve più'), /password/);
  await assert.rejects(rpcPw(U.sa, 10, 'user_delete', U.sa, 'prova su me'), /te stesso|super amministratore/);
  assert.equal((await rpcPw(U.sa, 10, 'user_delete', clean, 'non serve più')).outcome, 'deleted');
  assert.equal((await sql('select count(*)::int n from auth.users where id = $1', [clean]))[0].n, 0);
  assert.equal((await sql('select count(*)::int n from profiles where id = $1', [clean]))[0].n, 0);
  const r = await rpcPw(U.sa, 10, 'user_delete', busy, 'ha lasciato l\'associazione');
  assert.equal(r.outcome, 'disabled');
  const [p] = await sql('select active, email, deleted_at, full_name from profiles where id = $1', [busy]);
  assert.deepEqual([p.active, p.email, Boolean(p.deleted_at), p.full_name], [false, null, true, 'con-dati']);
  const [a] = await sql('select email, banned_until from auth.users where id = $1', [busy]);
  assert.equal(a.email, null); assert.ok(a.banned_until);
  await assert.rejects(rpcPw(U.sa, 10, 'user_delete', busy, 'di nuovo'), /già eliminato/);
});
