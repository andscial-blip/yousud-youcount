#!/usr/bin/env node
// Migrazione dal Gestionale YouSud a YouCount.
//
// Legge SOLO il backup Excel scaricato dal Gestionale (scheda Backup → «Scarica backup Excel»):
// il Gestionale non viene mai toccato. Produce:
//   <out>/chunks/NN.sql blocchi da eseguire in ordine (prima in locale, poi online); <out>/import.sql = tutti i blocchi
//   <out>/report.md    cosa entra, cosa resta fuori e perché, decisioni da prendere
//   <out>/expected.json saldi per conto e rendiconto per anno calcolati con le regole del Gestionale,
//                       da confrontare con quelli di YouCount dopo il caricamento (scripts/migrate/verify.mjs)
//
// Regole riprodotte dal Gestionale (app.html): movimenti validi = stato vuoto o «Done»; i movimenti «Cancelled»
// non contano; «da rimborsare» (reimb=due) non tocca i conti né il rendiconto; un rimborso pagato vale alla data
// del rimborso; le spese «pocket» le paga il personale con l'anticipo ricevuto; i saldi partono da cfg.openings
// alla data cfg.openAt; codici vecchi (cfg.codesV < 2) convertiti con migTarget del Gestionale.
//
// Uso: node scripts/migrate/gestionale.mjs <backup.xlsx | copia.json> <cartella-uscita> [--add=movimenti.json]
//        [--pocket-account=CODICE] [--status=recorded|verified]
// Una copia .json è il contenuto d.json delle copie automatiche del Gestionale (scheda Backup); --add aggiunge
// o sostituisce (stesso id) movimenti letti dopo la copia.

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { migTarget, CODES_EX_OLD, CODES_IN_OLD } from './gestionale-rules.mjs';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

const [, , SRC, OUT, ...flags] = process.argv;
if (!SRC || !OUT) { console.error('uso: gestionale.mjs <backup.xlsx> <cartella-uscita>'); process.exit(2); }
const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, '').split('=')));
const POCKET_ACC = opt['pocket-account'] ?? 'Anticipi personale';
const STATUS = opt.status === 'verified' ? 'verified' : 'recorded';
// --verified-before=AAAA-MM-GG: i movimenti con data di cassa precedente entrano come verificati (già controllati nel Gestionale)
const VERIFIED_BEFORE = opt['verified-before'] ?? null;

// ------------------------------------------------------------------ lettura del backup Excel
const XL_PRE = '§';
function cellValue(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return v.text;
    if ('result' in v) return v.result;
  }
  return v;
}
async function readBackup(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = (name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return [];
    const head = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { head[i] = String(cellValue(c.value) ?? '').trim(); });
    const rows = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const o = {};
      row.eachCell({ includeEmpty: false }, (c, i) => {
        let v = cellValue(c.value);
        if (v === undefined || v === '' || !head[i]) return;
        if (typeof v === 'string' && v[0] === XL_PRE) { try { v = JSON.parse(v.slice(1)); } catch { /* resta testo */ } }
        o[head[i]] = v;
      });
      if (o.id != null) o.id = String(o.id);
      if (Object.keys(o).length) rows.push(o);
    });
    return rows;
  };
  const info = Object.fromEntries(sheet('Info').map((r) => Object.values(r)).filter((a) => a.length >= 2).map(([k, v]) => [k, v]));
  const par = sheet('Parametri');
  const gj = (key) => {
    const pr = par.filter((r) => r.chiave === key).sort((a, b) => a.parte - b.parte);
    return pr.length ? JSON.parse(pr.map((r) => r.json).join('')) : null;
  };
  // la prima riga del foglio Info è un dato, non un'intestazione
  const wsInfo = wb.getWorksheet('Info');
  const infoRows = [];
  wsInfo?.eachRow((row) => infoRows.push([cellValue(row.getCell(1).value), cellValue(row.getCell(2).value)]));
  return { info: Object.fromEntries(infoRows), movs: sheet('Movimenti'), pocket: sheet('Pocket'), docs: sheet('Documenti'),
           cfg: gj('config/main') ?? {}, rates: gj('config/rates') ?? {}, sheets: wb.worksheets.map((w) => w.name), _info: info };
}

function readSnapshot(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { info: { 'Esportato il': d.ts ? new Date(d.ts).toISOString() : '?' }, movs: d.movs ?? [], pocket: d.pocket ?? [],
           docs: d.docs ?? [], cfg: d.cfg ?? {}, rates: d.rates ?? {}, sheets: ['copia automatica (JSON)'] };
}

// ------------------------------------------------------------------ regole del Gestionale
const r2 = (x) => Math.round(x * 100) / 100;
const mvOK = (m) => !m.status || m.status === 'Done';
const cashDate = (m) => (m.reimb === 'paid' && m.reimbDate ? m.reimbDate : m.date);
function makeRules(cfg, rates) {
  const rk = Object.keys(rates).sort();
  const rateFor = (date) => {
    if (!rk.length) return null;
    const ym = String(date).slice(0, 7);
    let best = null; rk.forEach((k) => { if (k <= ym) best = k; });
    return +rates[best ?? rk[0]];
  };
  const calc = (m) => {
    const cur = m.cur || 'EUR', amt = +m.amt || 0, rate = +m.rate || rateFor(m.date) || 0;
    return { eur: r2(cur === 'EUR' ? amt : rate ? amt / rate : 0), mga: Math.round(cur === 'MGA' ? amt : rate ? amt * rate : 0), rate };
  };
  const amtIn = (m, accCur) => (accCur === 'MGA' ? (m.fx ? 0 : (+m.mga || calc(m).mga)) : (+m.eur || calc(m).eur));
  return { rateFor, calc, amtIn };
}

// ------------------------------------------------------------------ utilità SQL
const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined || Number.isNaN(+v) ? 'null' : String(+v));
function uuidFrom(name) { // UUID v5-like deterministico: stesso id del Gestionale → stesso id in YouCount
  const h = createHash('sha1').update(`yousud-gestionale:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// ------------------------------------------------------------------ piano di importazione
const B = SRC.endsWith('.json') ? readSnapshot(SRC) : await readBackup(SRC);
if (opt.add) {
  const extra = JSON.parse(fs.readFileSync(opt.add, 'utf8'));
  for (const m of extra) {
    const i = B.movs.findIndex((x) => x.id === m.id);
    if (i >= 0) B.movs[i] = m; else B.movs.push(m);
  }
  B.sheets.push(`+ ${extra.length} movimenti da ${path.basename(opt.add)}`);
}
const cfg = B.cfg, rules = makeRules(cfg, B.rates);
// conti: quelli della configurazione del Gestionale, altrimenti il suo elenco predefinito (ACCOUNTS in app.html)
const accounts = Array.isArray(cfg.accounts) && cfg.accounts.length ? cfg.accounts
  : JSON.parse(fs.readFileSync(new URL('./gestionale-accounts.json', import.meta.url), 'utf8'));
const ACC = new Map((accounts ?? []).map((a) => [a.c, a]));
// come pendEx()/pendIn() del Gestionale: conversione solo se la versione è < 2 E gli elenchi salvati sono quelli vecchi
const oldStored = (L, OLD) => Array.isArray(L) && L.length > 0
  && L.filter((x) => { const q = OLD.find((z) => z[0] === x.c); return q && q[2] === x.it; }).length >= L.length / 2;
const pendEx = (+cfg.codesV || 1) < 2 && oldStored(cfg.lists?.codesEx, CODES_EX_OLD);
const pendIn = (+cfg.codesInV || 1) < 2 && oldStored(cfg.lists?.codesIn, CODES_IN_OLD);
const oldEx = new Set(pendEx ? CODES_EX_OLD.map((x) => x[0]) : []), oldIn = new Set(pendIn ? CODES_IN_OLD.map((x) => x[0]) : []);
const structPrj = Array.isArray(cfg.structPrj) ? cfg.structPrj : ['General'];

const issues = [];           // problemi che bloccano l'importazione di un movimento
const notesOut = [];         // informazioni per il rapporto
const skipped = { cancelled: [], other: [] };
const plan = [];             // movimenti da inserire
const remaps = new Map();    // codice vecchio → nuovo
const projects = new Set(), suppliers = new Map(), usedAccounts = new Set();
let pocketUsed = false;

for (const m of B.movs) {
  const tag = `${m.ref ?? m.id} (${m.date ?? 's.d.'})`;
  if (m.status === 'Cancelled') { skipped.cancelled.push(m); continue; }
  if (!mvOK(m)) { skipped.other.push({ m, why: `stato «${m.status}»` }); continue; }
  if (!['Expense', 'Income', 'Transfer'].includes(m.tipo)) { issues.push(`${tag}: tipo sconosciuto «${m.tipo}»`); continue; }
  if (!isoDate(m.date)) { issues.push(`${tag}: data mancante o non valida «${m.date}»`); continue; }
  if (m.fx) { issues.push(`${tag}: movimento di differenza di cambio (campo fx): da decidere a mano`); continue; }
  const kind = m.tipo === 'Expense' ? 'expense' : m.tipo === 'Income' ? 'income' : 'transfer';
  const due = m.reimb === 'due';
  const pocket = Boolean(m.pocket) && m.tipo === 'Expense';
  const accCode = pocket ? POCKET_ACC : m.acct;
  if (pocket) pocketUsed = true;
  if (!accCode) { issues.push(`${tag}: conto mancante`); continue; }
  usedAccounts.add(accCode);
  const acc = ACC.get(accCode) ?? (pocket ? { c: POCKET_ACC, cur: 'MGA' } : null);
  if (!acc) { issues.push(`${tag}: conto «${accCode}» non presente nella configurazione del Gestionale`); continue; }
  // importo nella valuta del conto, come amtIn() del Gestionale
  const amount = rules.amtIn(m, acc.cur);
  if (!(amount > 0)) { issues.push(`${tag}: importo nullo o negativo (${m.amt} ${m.cur})`); continue; }
  const rate = acc.cur === 'MGA' ? (+m.rate || rules.rateFor(m.date) || (m.eur ? +m.mga / +m.eur : null)) : null;
  if (acc.cur === 'MGA' && !rate) { issues.push(`${tag}: manca il tasso di cambio`); continue; }
  let to = null, toAmount = null;
  if (kind === 'transfer') {
    to = ACC.get(m.acct2);
    if (!to) { issues.push(`${tag}: giroconto senza conto di destinazione valido «${m.acct2 ?? ''}»`); continue; }
    usedAccounts.add(to.c);
    toAmount = m.amt2 !== undefined && m.amt2 !== '' && m.amt2 !== null ? +m.amt2 : rules.amtIn(m, to.cur);
    if (!(toAmount > 0)) { issues.push(`${tag}: importo di arrivo del giroconto non valido`); continue; }
  }
  let code = kind === 'transfer' ? null : String(m.code ?? '');
  if (kind !== 'transfer') {
    if (!code) { issues.push(`${tag}: codice contabile mancante`); continue; }
    const isOld = m.cv !== 2 && (kind === 'expense' ? oldEx.has(code) : oldIn.has(code));
    if (isOld) {
      const t = migTarget(code, m.desc, m.prj, +m.eur || 0);
      if (!t) { issues.push(`${tag}: codice vecchio ${code} senza corrispondenza`); continue; }
      const k = `${code} → ${t}`; remaps.set(k, (remaps.get(k) ?? 0) + 1); code = t;
    }
  }
  const prj = kind === 'transfer' ? null : (m.prj || (kind === 'expense' ? 'General' : null));
  if (prj) projects.add(prj);
  const supplier = typeof m.supplier === 'string' && m.supplier.trim() ? m.supplier.trim() : null;
  if (supplier && kind !== 'transfer') suppliers.set(supplier.toLowerCase(), { name: supplier, kind: kind === 'income' ? 'donor' : 'supplier' });
  const opDate = cashDate(m);
  const bits = [];
  if (m.who) bits.push(`${kind === 'income' ? 'Registrato da' : 'Pagato da'}: ${m.who}`);
  if (m.place) bits.push(`Luogo: ${m.place}`);
  if (m.reimb === 'paid') bits.push(`Rimborsato il ${m.reimbDate} (spesa del ${m.date})`);
  if (due) bits.push('Da rimborsare a chi ha pagato (nel Gestionale «da rimborsare»): resta bozza finché non si rimborsa');
  if (pocket) bits.push(`Pagato con l'anticipo in contanti del personale${m.acct ? ` (conto indicato: ${m.acct})` : ''}`);
  if (m.imp) bits.push(`Importato da ${m.imp}`);
  if (m.recon?.d) bits.push(`Riconciliato con l'estratto conto il ${m.recon.d}`);
  if (m.note) bits.push(String(m.note));
  bits.push(`Gestionale: ${m.id}`);
  const rcpt = [m.rcpt, m.rcptNo].filter(Boolean).join(' ');
  const nDocs = (Array.isArray(m.docs) ? m.docs.length : 0) + (Array.isArray(m.photos) ? m.photos.length : 0);
  plan.push({
    legacy: m.id, ref: m.ref ?? null, kind, status: due ? 'draft' : VERIFIED_BEFORE && opDate < VERIFIED_BEFORE ? 'verified' : STATUS, opDate, docDate: m.date !== opDate ? m.date : (isoDate(m.date) ?? null),
    description: String(m.desc ?? '').slice(0, 500), amount: acc.cur === 'MGA' ? Math.round(amount) : r2(amount), currency: acc.cur,
    rate: acc.cur === 'MGA' ? +(+rate).toFixed(4) : null, acc: acc.c, to: to?.c ?? null,
    toAmount: to ? (to.cur === 'MGA' ? Math.round(toAmount) : r2(toAmount)) : null,
    code, prj, supplier, method: m.method ?? null, notes: bits.join(' · ').slice(0, 2000),
    noDoc: kind === 'transfer' || due ? null
      : `Migrato dal Gestionale: giustificativo nell'archivio del Gestionale${rcpt ? ` (${rcpt})` : ''}${nDocs ? `, ${nDocs} file collegati` : ''}`.slice(0, 500),
  });
}

// anticipi del personale (foglio Pocket): consegna = giroconto cassa → anticipi; restituzione = il contrario
for (const p of B.pocket) {
  const tag = `pocket ${p.id} (${p.date ?? 's.d.'})`;
  if (!['given', 'returned'].includes(p.kind)) { issues.push(`${tag}: tipo «${p.kind}» non gestito`); continue; }
  if (!isoDate(p.date) || !(+p.mga > 0)) { issues.push(`${tag}: data o importo non validi`); continue; }
  pocketUsed = true;
  const cash = p.acct || 'Cassa Missione';
  usedAccounts.add(cash);
  const given = p.kind === 'given';
  plan.push({
    legacy: `pocket:${p.id}`, ref: null, kind: 'transfer', status: VERIFIED_BEFORE && p.date < VERIFIED_BEFORE ? 'verified' : STATUS, opDate: p.date, docDate: null,
    description: `${given ? 'Anticipo in contanti a' : 'Restituzione anticipo da'} ${p.worker ?? 'personale'}`.slice(0, 500),
    amount: Math.round(+p.mga), currency: 'MGA', rate: rules.rateFor(p.date) ?? null,
    acc: given ? cash : POCKET_ACC, to: given ? POCKET_ACC : cash, toAmount: Math.round(+p.mga),
    code: null, prj: null, supplier: null, method: 'Contanti', notes: `Gestionale (Pocket): ${p.id}${p.note ? ` · ${p.note}` : ''}`, noDoc: null,
  });
}

// numerazione: i movimenti senza numero ricevono il successivo dell'anno, dopo quelli del Gestionale
const maxRef = new Map();
for (const x of plan) {
  const mm = /^MOV-(\d{4})-(\d+)$/.exec(x.ref ?? '');
  if (mm) maxRef.set(+mm[1], Math.max(maxRef.get(+mm[1]) ?? 0, +mm[2]));
}
const seenRef = new Set();
for (const x of plan.sort((a, b) => (a.opDate < b.opDate ? -1 : a.opDate > b.opDate ? 1 : 0))) {
  if (x.ref && seenRef.has(x.ref)) { notesOut.push(`numero ${x.ref} ripetuto nel Gestionale: il secondo riceve un numero nuovo`); x.ref = null; }
  if (x.ref) { seenRef.add(x.ref); continue; }
  if (x.status === 'draft') continue;
  const y = +x.opDate.slice(0, 4), n = (maxRef.get(y) ?? 0) + 1;
  maxRef.set(y, n); x.ref = `MOV-${y}-${String(n).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ valori attesi (regole del Gestionale)
const openAt = cfg.openAt || '';
const openings = cfg.openings ?? {};
const expectedBalances = {};
for (const a of accounts ?? []) {
  const o = { open: +openings[a.c] || 0, inc: 0, exp: 0, tin: 0, tout: 0 };
  for (const m of B.movs) {
    if (!mvOK(m) || m.pocket || m.reimb === 'due') continue;
    if (openAt && String(m.date || '') < openAt) continue;
    if (m.tipo === 'Income' && m.acct === a.c) o.inc += rules.amtIn(m, a.cur);
    else if (m.tipo === 'Expense' && m.acct === a.c) o.exp += rules.amtIn(m, a.cur);
    else if (m.tipo === 'Transfer') {
      if (m.acct === a.c) o.tout += rules.amtIn(m, a.cur);
      if (m.acct2 === a.c) o.tin += m.amt2 !== undefined && m.amt2 !== '' ? +m.amt2 : rules.amtIn(m, a.cur);
    }
  }
  for (const p of B.pocket) {
    if ((p.acct || 'Cassa Missione') !== a.c) continue;
    if (p.kind === 'given') o.tout += +p.mga || 0;
    if (p.kind === 'returned') o.tin += +p.mga || 0;
  }
  expectedBalances[a.c] = { cur: a.cur, ...o, bal: o.open + o.inc - o.exp + o.tin - o.tout };
}
// movimenti precedenti alla data di apertura: nel Gestionale non toccano i saldi, in YouCount sì.
// Per avere gli stessi saldi, il saldo iniziale di YouCount si riduce del loro effetto netto (decisione da confermare).
const preOpen = {};
if (openAt) {
  for (const p of plan) {
    if (p.status === 'draft' || p.opDate >= openAt || p.legacy.startsWith('pocket:')) continue;
    const m = B.movs.find((x) => x.id === p.legacy);
    if (!m || String(m.date || '') >= openAt) continue;
    const add = (c, v) => { preOpen[c] = (preOpen[c] ?? 0) + v; };
    if (p.kind === 'income') add(p.acc, p.amount);
    if (p.kind === 'expense') add(p.acc, -p.amount);
    if (p.kind === 'transfer') { add(p.acc, -p.amount); add(p.to, p.toAmount); }
  }
}
// rendiconto per anno di cassa e codice (EUR), come buildReport('ets'): stesse esclusioni del Gestionale
const codeOf = new Map(plan.map((x) => [x.legacy, x.code]));
const statement = {};
for (const m of B.movs) {
  if (!mvOK(m) || m.reimb === 'due' || m.tipo === 'Transfer' || m.code === 'E904' || !m.date) continue;
  const code = codeOf.get(m.id) ?? m.code;
  const k = `${String(cashDate(m)).slice(0, 4)}|${m.tipo === 'Expense' ? 'out' : 'in'}|${code}`;
  statement[k] = r2((statement[k] ?? 0) + (+m.eur || 0));
}
// conto degli anticipi al personale: consegnato − restituito − speso (come pocketBal del Gestionale)
if (pocketUsed) {
  let bal = 0;
  for (const p of B.pocket) { if (p.kind === 'given') bal += +p.mga || 0; if (p.kind === 'returned') bal -= +p.mga || 0; }
  for (const m of B.movs) if (m.pocket && mvOK(m) && m.tipo === 'Expense') bal -= rules.amtIn(m, 'MGA');
  expectedBalances[POCKET_ACC] = { cur: 'MGA', open: 0, bal };
}

// ------------------------------------------------------------------ SQL a blocchi con impronta di controllo
// Ogni blocco chiama app.import_gestionale (migrazione 1100): inserisce i movimenti e ricalcola l'impronta MD5
// dei dati scritti; se non coincide con quella calcolata qui, il blocco viene annullato.
const f2 = (v) => (+v).toFixed(2), f4 = (v) => (+v).toFixed(4);
const canon = (x) => [x.legacy, x.ref ?? '', x.kind, x.status, x.opDate, x.docDate ?? '', x.description, f2(x.amount), x.currency,
  x.rate ? f4(x.rate) : '', x.acc, x.to ?? '', x.toAmount != null ? f2(x.toAmount) : '', x.code ?? '', x.prj ?? '',
  (x.supplier ?? '').toLowerCase(), x.method ?? '', x.notes ?? '', x.noDoc ?? ''].join('|');
const md5 = (rows) => createHash('md5').update(rows.slice().sort((a, b) => (a.legacy < b.legacy ? -1 : a.legacy > b.legacy ? 1 : 0))
  .map(canon).join('\n'), 'utf8').digest('hex');
const J = (x) => ({
  id: uuidFrom(x.legacy), cu: uuidFrom('client:' + x.legacy), lid: x.legacy, ref: x.ref, k: x.kind, st: x.status, d: x.opDate,
  dd: x.docDate, de: x.description, a: f2(x.amount), cur: x.currency, r: x.rate ? f4(x.rate) : null, acc: x.acc, to: x.to,
  ta: x.toAmount != null ? f2(x.toAmount) : null, code: x.code, prj: x.prj, str: x.prj ? structPrj.includes(x.prj) : false,
  cp: x.supplier, pm: x.method, no: x.notes, nd: x.noDoc,
});
const setup = {
  pocket: pocketUsed, pocketCode: POCKET_ACC,
  openings: (accounts ?? []).filter((a) => a.c in openings || preOpen[a.c]).map((a) => {
    const open = (+openings[a.c] || 0) - (preOpen[a.c] ?? 0);
    return { c: a.c, v: a.cur === 'MGA' ? String(Math.round(open)) : f2(open), d: openAt || '' };
  }),
  projects: [...projects].filter((p) => !structPrj.includes(p)),
  cps: [...suppliers.values()].map((x) => ({ n: x.name, k: x.kind })),
};
const SIZE = +(opt.chunk ?? 45);
const ordered = plan.slice().sort((a, b) => (a.legacy < b.legacy ? -1 : a.legacy > b.legacy ? 1 : 0));
const chunks = [];
for (let i = 0; i < ordered.length || i === 0; i += SIZE) {
  const part = ordered.slice(i, i + SIZE);
  const body = { movs: part.map(J), md5: md5(part) };
  if (i === 0) body.setup = setup;
  if (i + SIZE >= ordered.length) body.total = plan.length;
  const json = JSON.stringify(body);
  if (json.includes('$g$')) throw new Error('testo con $g$: cambiare delimitatore');
  chunks.push(`select app.import_gestionale($g$${json}$g$::jsonb);`);
  if (!ordered.length) break;
}
fs.mkdirSync(path.join(OUT, 'chunks'), { recursive: true });
for (const f of fs.readdirSync(path.join(OUT, 'chunks'))) fs.unlinkSync(path.join(OUT, 'chunks', f));
chunks.forEach((c, i) => fs.writeFileSync(path.join(OUT, 'chunks', `${String(i + 1).padStart(2, '0')}.sql`), c + '\n'));
const sql = [`-- Importazione dal Gestionale: ${plan.length} movimenti in ${chunks.length} blocchi (scripts/migrate/gestionale.mjs)`, ...chunks];

// ------------------------------------------------------------------ rapporto
const count = (f) => plan.filter(f).length;
const R = [];
const r = (s = '') => R.push(s);
r('# Migrazione dal Gestionale: rapporto');
r();
r(`File: \`${path.basename(SRC)}\` · esportato il ${B.info['Esportato il'] ?? '?'} · fogli: ${B.sheets.join(', ')}`);
r();
r('| | Numero |');
r('|---|---:|');
r(`| Movimenti nel Gestionale | ${B.movs.length} |`);
r(`| Da importare come registrati | ${count((x) => x.status !== 'draft')} |`);
r(`| Da importare come bozze (da rimborsare) | ${count((x) => x.status === 'draft')} |`);
r(`| Annullati nel Gestionale (non importati) | ${skipped.cancelled.length} |`);
r(`| Esclusi per altri motivi | ${skipped.other.length} |`);
r(`| Con problemi da risolvere | ${issues.length} |`);
r(`| Movimenti di anticipo al personale (foglio Pocket) | ${B.pocket.length} |`);
r(`| Spese pagate con l'anticipo del personale | ${count((x) => x.acc === POCKET_ACC && x.kind === 'expense')} |`);
r(`| Giustificativi elencati (foglio Documenti) | ${B.docs.length} |`);
r();
r(`Codici: ${pendEx || pendIn ? 'nel Gestionale il passaggio ai codici versione 2 non è completato: conversione con le regole del Gestionale' : 'già nella versione 2, nessuna conversione'}.`);
if (remaps.size) { r(); r('| Codice vecchio → nuovo | Movimenti |'); r('|---|---:|'); for (const [k, v] of remaps) r(`| ${k} | ${v} |`); }
r();
r(`Saldi iniziali (configurazione del Gestionale): ${Object.entries(openings).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nessuno'}${openAt ? ` alla data ${openAt}` : ''}.`);
if (Object.keys(preOpen).length) r(`Movimenti precedenti alla data di apertura (in YouCount il saldo iniziale viene ridotto del loro effetto): ${Object.entries(preOpen).map(([k, v]) => `${k} ${r2(v)}`).join(' · ')}.`);
r();
r(`Progetti usati: ${[...projects].join(', ') || '–'}. Controparti da creare o collegare: ${suppliers.size}.`);
if (issues.length) { r(); r('## Problemi (questi movimenti NON sono nel file SQL)'); issues.forEach((i) => r(`- ${i}`)); }
if (notesOut.length) { r(); r('## Note'); notesOut.forEach((i) => r(`- ${i}`)); }
r();
r('## Saldi attesi per conto (regole del Gestionale)');
r('| Conto | Valuta | Saldo |'); r('|---|---|---:|');
for (const [k, v] of Object.entries(expectedBalances)) r(`| ${k} | ${v.cur} | ${v.cur === 'MGA' ? Math.round(v.bal) : r2(v.bal).toFixed(2)} |`);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'import.sql'), sql.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'report.md'), R.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'expected.json'), JSON.stringify({
  balances: expectedBalances, statement, pocketAccount: pocketUsed ? POCKET_ACC : null,
  movements: plan.length, drafts: count((x) => x.status === 'draft'), issues: issues.length,
}, null, 2));
console.log(`movimenti nel piano: ${plan.length} · problemi: ${issues.length} · annullati: ${skipped.cancelled.length}`);
