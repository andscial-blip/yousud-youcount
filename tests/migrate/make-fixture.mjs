// Crea un backup Excel di prova con la stessa struttura del Gestionale (fogli Info, Movimenti, Pocket,
// Documenti, Parametri; oggetti in cella come «§» + JSON). Dati inventati per il test, non dati reali.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const out = process.argv[2] ?? '/tmp/gestionale-prova.xlsx';
const clean = process.argv.includes('--clean'); // senza il movimento difettoso
const acc = JSON.parse(fs.readFileSync(new URL('./accounts.json', import.meta.url)));

const movs = [
  { id: 'ec25-001', tipo: 'Expense', date: '2025-01-03', amt: 8.47, cur: 'EUR', eur: 8.47, mga: 42350, rate: 5000, acct: 'Banca Italia', method: 'Addebito su C/C', code: '904', prj: 'General', status: 'Done', ref: 'MOV-2025-001', desc: 'Imposta di bollo', cv: 2, recon: { d: '2025-11-27' }, imp: 'EC 27/11/2025' },
  { id: 'm2', tipo: 'Expense', date: '2025-01-10', amt: 250000, cur: 'MGA', eur: 50, mga: 250000, rate: 5000, acct: 'Cassa Missione', method: 'Contanti', code: '202', prj: 'General', status: 'Done', ref: 'MOV-2025-002', desc: 'Carburante', supplier: 'Lousin', who: 'Valentina', place: 'Antananarivo', rcpt: 'Ricevuta', rcptNo: 'n.089' },
  { id: 'm3', tipo: 'Expense', date: '2025-06-15', amt: 100, cur: 'EUR', eur: 100, mga: 510000, rate: 5100, acct: 'Cassa Missione', method: 'Contanti', code: '303', prj: 'École Piccolino', status: 'Done', ref: 'MOV-2025-003', desc: 'Quaderni pagati in euro dalla cassa' },
  { id: 'm4', tipo: 'Income', date: '2025-02-01', amt: 1500, cur: 'EUR', eur: 1500, mga: 7500000, rate: 5000, acct: 'Banca Italia', method: 'Bonifico', code: 'E101', prj: 'General', status: 'Done', ref: 'MOV-2025-004', desc: 'Donazione', supplier: 'Mario Rossi' },
  { id: 'm5', tipo: 'Transfer', date: '2025-02-10', amt: 1000, cur: 'EUR', eur: 1000, mga: 5050000, rate: 5050, acct: 'Banca Italia', acct2: 'Banca Missione', amt2: 5050000, method: 'Bonifico', status: 'Done', ref: 'MOV-2025-005', desc: 'Trasferimento in Madagascar' },
  { id: 'm6', tipo: 'Expense', date: '2025-03-01', amt: 40, cur: 'EUR', eur: 40, mga: 200000, rate: 5000, acct: 'Cassa Italia', method: 'Contanti', code: '401', prj: 'General', status: 'Done', ref: 'MOV-2025-006', desc: 'Cancelleria pagata da un volontario', reimb: 'due', who: 'Giulia' },
  { id: 'm7', tipo: 'Expense', date: '2025-12-28', amt: 60, cur: 'EUR', eur: 60, mga: 306000, rate: 5100, acct: 'Banca Italia', method: 'Bonifico', code: '203', prj: 'General', status: 'Done', ref: 'MOV-2025-007', desc: 'Pasto in missione rimborsato', reimb: 'paid', reimbDate: '2026-01-05', who: 'Andrea' },
  { id: 'm8', tipo: 'Expense', date: '2025-04-01', amt: 999, cur: 'EUR', eur: 999, acct: 'Banca Italia', code: '401', prj: 'General', status: 'Cancelled', ref: 'MOV-2025-008', desc: 'Annullato' },
  { id: 'm9', tipo: 'Expense', date: '2025-02-15', amt: 30000, cur: 'MGA', eur: 6, mga: 30000, rate: 5000, acct: 'Cassa Missione', method: 'Contanti', code: '307', prj: 'École Antanetibe', status: 'Done', ref: 'MOV-2025-009', desc: 'Riso per la mensa', pocket: true, who: 'Chanfy' },
  { id: 'm10', tipo: 'Expense', date: '2025-07-01', amt: 100000, cur: 'MGA', eur: 20, mga: 100000, rate: 5000, acct: 'Mvola Telma', method: 'Mobile money', code: '304', prj: 'Agroecologia', status: 'Done', ref: 'MOV-2025-010', desc: 'Semi' },
  { id: 'm11', tipo: 'Income', date: '2025-01-01', amt: 500, cur: 'EUR', eur: 500, acct: 'Banca Italia', method: 'Altro', code: 'E904', prj: 'General', status: 'Done', ref: 'MOV-2025-011', desc: 'Avanzo 2024' },
  { id: 'm12', tipo: 'Expense', date: '2024-12-20', amt: 10, cur: 'EUR', eur: 10, acct: 'Banca Italia', method: 'Addebito su C/C', code: '902', prj: 'General', status: 'Done', ref: 'MOV-2024-001', desc: 'Commissione prima dell\'apertura' },
  { id: 'm13', tipo: 'Expense', date: '2025-08-01', amt: 15, cur: 'EUR', eur: 15, acct: 'Paypal', method: 'PayPal', code: '806', prj: 'General', status: 'Done', desc: 'Commissione senza numero' },
  { id: 'm14', tipo: 'Expense', date: '2025-08-02', amt: 12, cur: 'EUR', eur: 12, acct: 'Paypal', prj: 'General', status: 'Done', ref: 'MOV-2025-012', desc: 'Senza codice' },
];
const pocket = [
  { id: 'p1', date: '2025-02-01', worker: 'Chanfy', kind: 'given', mga: 100000 },
  { id: 'p2', date: '2025-03-01', worker: 'Chanfy', kind: 'returned', mga: 20000 },
];
const cfg = { accounts: acc, openings: { 'Banca Italia': 10000, 'Cassa Missione': 5000000 }, openAt: '2025-01-01',
              structPrj: ['General'], codesV: 2, codesInV: 2, projects: ['General', 'École Piccolino', 'École Antanetibe', 'Agroecologia'] };
const rates = { '2025-01': 5000, '2025-06': 5100 };

const XL = (v) => (typeof v === 'object' && v !== null ? '§' + JSON.stringify(v) : v);
const wb = new ExcelJS.Workbook();
const info = wb.addWorksheet('Info');
[['Applicazione', 'YouSud Gestionale (prova)'], ['Esportato il', '2026-11-07T17:00:00.000Z'], ['Formato', '1']].forEach((r) => info.addRow(r));
const sheet = (name, rows) => {
  const ws = wb.addWorksheet(name);
  const keys = ['id']; rows.forEach((r) => Object.keys(r).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  ws.addRow(keys);
  rows.forEach((r) => ws.addRow(keys.map((k) => (r[k] === undefined ? null : XL(r[k])))));
};
sheet('Movimenti', clean ? movs.filter((m) => m.id !== 'm14') : movs);
sheet('Documenti', []);
sheet('Pocket', pocket);
const par = []; const put = (key, obj) => { const s = JSON.stringify(obj); for (let i = 0, p = 0; i < s.length; i += 30000, p++) par.push({ chiave: key, parte: p, json: s.slice(i, i + 30000) }); };
put('config/main', cfg); put('config/rates', rates);
const ps = wb.addWorksheet('Parametri'); ps.addRow(['chiave', 'parte', 'json']); par.forEach((r) => ps.addRow([r.chiave, r.parte, r.json]));
await wb.xlsx.writeFile(out);
console.log(out);
