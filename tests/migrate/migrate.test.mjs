// Migrazione dal Gestionale su un backup Excel di prova: piano, importazione nel database locale, verifica dei totali.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pg = require('pg');
const DB = process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts });

async function freshDb() {
  run('bash', ['scripts/db_reset_local.sh']);
  const pool = new pg.Pool({ connectionString: DB });
  await pool.query(`insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
                    values ('00000000-0000-4000-8000-000000000001', 'admin@prova.local', '{"role":"super_admin"}', '{"full_name":"Admin"}')`);
  return pool;
}

test('backup completo: importa e i totali tornano con quelli del Gestionale', async () => {
  const pool = await freshDb();
  try {
  run('node', ['tests/migrate/make-fixture.mjs', '/tmp/mig-clean.xlsx', '--clean']);
  run('node', ['scripts/migrate/gestionale.mjs', '/tmp/mig-clean.xlsx', '/tmp/mig-clean']);
  run('psql', [DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/mig-clean/import.sql']);
  const v = run('node', ['scripts/migrate/verify.mjs', '/tmp/mig-clean']);
  assert.match(v, /Tutti i controlli tornano/);
  const q = async (s) => (await pool.query(s)).rows;
  // numeri del Gestionale conservati; il movimento senza numero riceve il successivo dell'anno
  const refs = (await q(`select ref from movements where legacy_id is not null and ref is not null order by ref`)).map((r) => r.ref);
  assert.ok(refs.includes('MOV-2025-002') && refs.includes('MOV-2024-001'));
  assert.equal((await q(`select ref from movements where legacy_id = 'm13'`))[0].ref, 'MOV-2025-014'); // dopo i due anticipi di febbraio e marzo
  // il prossimo numero dell'anno continua dopo quelli importati
  assert.equal((await q(`select last from app.ref_counters where year = 2025`))[0].last, 14);
  // da rimborsare = bozza; rimborso pagato = data del rimborso; annullato = escluso
  assert.equal((await q(`select status from movements where legacy_id = 'm6'`))[0].status, 'draft');
  assert.deepEqual((await q(`select op_date::text, doc_date::text from movements where legacy_id = 'm7'`))[0], { op_date: '2026-01-05', doc_date: '2025-12-28' });
  assert.equal((await q(`select count(*)::int n from movements where legacy_id = 'm8'`))[0].n, 0);
  // spesa in euro dalla cassa in ariary: registrata in MGA al tasso del Gestionale
  assert.deepEqual((await q(`select amount::text, currency, fx_rate::text, amount_eur::text from movements where legacy_id = 'm3'`))[0],
    { amount: '510000.00', currency: 'MGA', fx_rate: '5100.0000', amount_eur: '100.00' });
  // anticipi al personale: conto in MGA, consegna e restituzione come giroconti, spesa sul conto anticipi
  assert.equal((await q(`select a.code from movements m join accounts a on a.id = m.account_id where legacy_id = 'm9'`))[0].code, 'Anticipi personale');
  // progetto non presente in YouCount creato con il nome del Gestionale; controparti create
  assert.equal((await q(`select count(*)::int n from projects where name = 'Agroecologia'`))[0].n, 1);
  assert.equal((await q(`select count(*)::int n from counterparties where name in ('Lousin', 'Mario Rossi')`))[0].n, 2);
  // saldo iniziale: fuori dal rendiconto anche in YouCount
  assert.equal((await q(`select report_line from v_ledger where category_code = 'E904'`))[0].report_line, null);
  // rieseguire l'importazione non crea doppioni e i totali restano giusti
  run('psql', [DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/mig-clean/import.sql']);
  assert.equal((await q(`select count(*)::int n from movements`))[0].n, 14);
  assert.match(run('node', ['scripts/migrate/verify.mjs', '/tmp/mig-clean']), /Tutti i controlli tornano/);
  } finally { await pool.end(); }
});

test('movimento difettoso: escluso, segnalato nel rapporto e la verifica lo mostra', async () => {
  const pool = await freshDb();
  try {
  run('node', ['tests/migrate/make-fixture.mjs', '/tmp/mig-bad.xlsx']);
  run('node', ['scripts/migrate/gestionale.mjs', '/tmp/mig-bad.xlsx', '/tmp/mig-bad']);
  assert.match(fs.readFileSync('/tmp/mig-bad/report.md', 'utf8'), /MOV-2025-012 \(2025-08-02\): codice contabile mancante/);
  run('psql', [DB, '-qX', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/mig-bad/import.sql']);
  let out = '';
  try { run('node', ['scripts/migrate/verify.mjs', '/tmp/mig-bad']); } catch (e) { out = e.stdout; }
  assert.match(out, /\| Paypal \(EUR\) \| -27\.00 \| -15\.00 \| 12\.00 \|/);
  } finally { await pool.end(); }
});
