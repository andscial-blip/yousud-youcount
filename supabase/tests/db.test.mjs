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
  R.gen = R.prj['Spese generali (fuori progetto)'];
});
after(() => pool.end());

// ------------------------------------------------------------------ seed
test('seed: piano dei conti ripreso dal Gestionale', async () => {
  const [c] = await sql(`select count(*) filter (where direction='out')::int o, count(*) filter (where direction='in')::int i,
                                count(*) filter (where report_line_key is null)::int n from categories`);
  assert.deepEqual(c, { o: 64, i: 25, n: 2 });
  const unmapped = await sql(`select code from categories where report_line_key is null order by code`);
  assert.deepEqual(unmapped.map((r) => r.code), ['999', 'E999']);
  const [g] = await sql(`select kind, legacy_name from projects where name = 'Spese generali (fuori progetto)'`);
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
