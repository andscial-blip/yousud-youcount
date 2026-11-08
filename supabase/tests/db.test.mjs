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
