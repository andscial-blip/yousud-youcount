#!/usr/bin/env node
// Confronta YouCount dopo l'importazione con i valori attesi calcolati con le regole del Gestionale.
// Uso: DATABASE_URL=... node scripts/migrate/verify.mjs <cartella-uscita>
// Esce con codice 1 se un saldo o una riga di rendiconto non torna.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pg = require('pg');
const DIR = process.argv[2];
const exp = JSON.parse(fs.readFileSync(path.join(DIR, 'expected.json'), 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test' });

const r2 = (x) => Math.round(x * 100) / 100;
const out = [];
let bad = 0;

const { rows: bal } = await pool.query(`
  select a.code, a.currency, a.opening_balance::numeric open,
    a.opening_balance + coalesce(sum(case
      when m.kind = 'income' and m.account_id = a.id then m.amount * m.sign
      when m.kind = 'expense' and m.account_id = a.id then -m.amount * m.sign
      when m.kind = 'transfer' and m.account_id = a.id then -m.amount * m.sign
      when m.kind = 'transfer' and m.to_account_id = a.id then m.to_amount * m.sign else 0 end), 0) as bal
  from public.accounts a
  left join public.movements m on (m.account_id = a.id or m.to_account_id = a.id) and m.status <> 'draft'
  group by a.id order by a.sort`);
out.push('## Saldi per conto', '| Conto | Gestionale | YouCount | Differenza |', '|---|---:|---:|---:|');
for (const [code, e] of Object.entries(exp.balances)) {
  const y = bal.find((b) => b.code === code);
  const yc = y ? +y.bal : NaN;
  const tol = e.cur === 'MGA' ? 1 : 0.01;
  const d = yc - e.bal;
  const ok = Math.abs(d) < tol;
  if (!ok) bad++;
  out.push(`| ${code} (${e.cur}) | ${e.bal.toFixed(e.cur === 'MGA' ? 0 : 2)} | ${Number.isNaN(yc) ? 'manca' : yc.toFixed(e.cur === 'MGA' ? 0 : 2)} | ${ok ? '✓' : d.toFixed(2)} |`);
}

const { rows: st } = await pool.query(`
  select extract(year from m.op_date)::int y, c.direction dir, c.code, sum(m.amount_eur * m.sign) eur
  from public.movements m join public.categories c on c.id = m.category_id
  where m.status <> 'draft' and m.kind <> 'transfer' and c.code <> 'E904'
  group by 1, 2, 3`);
const yc = new Map(st.map((x) => [`${x.y}|${x.dir}|${x.code}`, +x.eur]));
const keys = [...new Set([...Object.keys(exp.statement), ...yc.keys()])].sort();
out.push('', '## Rendiconto per anno e codice (EUR)', '| Anno · tipo · codice | Gestionale | YouCount | Differenza |', '|---|---:|---:|---:|');
const tot = {};
for (const k of keys) {
  const g = exp.statement[k] ?? 0, y = r2(yc.get(k) ?? 0), d = r2(y - g);
  const [yr, dir] = k.split('|');
  const t = (tot[`${yr}|${dir}`] ||= { g: 0, y: 0 }); t.g += g; t.y += y;
  if (Math.abs(d) >= 0.01) out.push(`| ${k.replace(/\|/g, ' · ')} | ${g.toFixed(2)} | ${y.toFixed(2)} | ${d.toFixed(2)} |`);
}
out.push('', '| Totale anno · tipo | Gestionale | YouCount | Differenza |', '|---|---:|---:|---:|');
for (const [k, t] of Object.entries(tot)) {
  const d = r2(t.y - t.g);
  // differenze di arrotondamento sotto 1 € per anno sono attese (euro ricalcolati dai MGA al tasso)
  if (Math.abs(d) >= 1) bad++;
  out.push(`| ${k.replace('|', ' · ')} | ${r2(t.g).toFixed(2)} | ${r2(t.y).toFixed(2)} | ${Math.abs(d) < 0.01 ? '✓' : d.toFixed(2)} |`);
}
const { rows: [c] } = await pool.query(`select count(*)::int n, count(*) filter (where status = 'draft')::int d from public.movements where legacy_id is not null`);
out.push('', `Movimenti importati: ${c.n} (attesi ${exp.movements}) · bozze: ${c.d} (attese ${exp.drafts})`);
if (c.n !== exp.movements || c.d !== exp.drafts) bad++;
out.push(bad ? `\n**${bad} controlli non tornano.**` : '\n**Tutti i controlli tornano.**');
fs.writeFileSync(path.join(DIR, 'verify.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
await pool.end();
process.exit(bad ? 1 : 0);
