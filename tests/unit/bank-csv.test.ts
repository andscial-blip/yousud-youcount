import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, match, parseDate, parseNum, readCsv, toLines } from '../../src/lib/bank-csv.ts';

test('numeri in formato italiano, francese e inglese', () => {
  assert.equal(parseNum('1.234,56'), 1234.56);
  assert.equal(parseNum('-1 234,56'), -1234.56);
  assert.equal(parseNum('1,234.56'), 1234.56);
  assert.equal(parseNum('250.000'), 250000);
  assert.equal(parseNum('(12,50)'), -12.5);
  assert.equal(parseNum('12,50-'), -12.5);
  assert.equal(parseNum('€ 7,00'), 7);
  assert.equal(parseNum('abc'), null);
});

test('date in formato giorno/mese/anno e ISO', () => {
  assert.equal(parseDate('05/11/2026'), '2026-11-05');
  assert.equal(parseDate('5.11.26'), '2026-11-05');
  assert.equal(parseDate('2026-11-05'), '2026-11-05');
  assert.equal(parseDate('saldo'), null);
});

test('estratto con colonne Dare/Avere e righe di intestazione prima della tabella', () => {
  const csv = 'Banca di prova;;\nConto 123;;\nData contabile;Data valuta;Descrizione;Dare;Avere;Saldo\n03/11/2026;03/11/2026;"BONIFICO; affitto";450,00;;1.550,00\n04/11/2026;04/11/2026;Donazione;;100,00;1.650,00\n';
  const { rows, header, hi } = readCsv(csv);
  const mp = detect(header);
  assert.equal(header[mp.date], 'Data contabile');
  const lines = toLines(rows, hi, mp);
  assert.deepEqual(lines.map((l) => [l.date, l.amount, l.balance]), [['2026-11-03', -450, 1550], ['2026-11-04', 100, 1650]]);
  assert.equal(lines[0].text, 'BONIFICO; affitto');
});

test('estratto inglese con una colonna Amount separata da virgole', () => {
  const { rows, header, hi } = readCsv('Date,Description,Amount,Balance\n2026-11-01,Card payment,-12.50,987.50\n');
  const lines = toLines(rows, hi, detect(header));
  assert.deepEqual(lines, [{ date: '2026-11-01', amount: -12.5, text: 'Card payment', balance: 987.5 }]);
});

test('abbinamento: stesso importo, data più vicina entro 7 giorni, un movimento una volta sola', () => {
  const legs = [{ key: 'a', amount: -450, op_date: '2026-11-01' }, { key: 'b', amount: -450, op_date: '2026-11-03' }, { key: 'c', amount: 100, op_date: '2026-10-01' }];
  const r = match([{ date: '2026-11-03', amount: -450, text: '', balance: null }, { date: '2026-11-04', amount: -450, text: '', balance: null },
    { date: '2026-11-04', amount: 100, text: '', balance: null }], legs);
  assert.deepEqual(r.map((x) => x.leg?.key ?? null), ['b', 'a', null]);
});

import { fromRows, sniff } from '../../src/lib/bank-csv.ts';
import { decodeText, xlsxRows } from '../../src/lib/bank-csv.ts';
import ExcelJS from 'exceljs';

test('riconosce il tipo di file dai primi byte', () => {
  assert.equal(sniff(new Uint8Array([0x50, 0x4b, 3, 4])), 'xlsx');
  assert.equal(sniff(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1])), 'xls');
  assert.equal(sniff(new TextEncoder().encode('  <html><table><tr><td>Data</td></tr></table>')), 'html');
  assert.equal(sniff(new TextEncoder().encode('Data;Importo\n01/11/2026;5,00')), 'text');
});

test('CSV in codifica Windows (accenti) si legge correttamente', () => {
  const buf = new Uint8Array([0x44, 0x61, 0x74, 0x61, 0x3b, 0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x7a, 0x69, 0x6f, 0x6e, 0x65, 0x0a, 0x50, 0x65, 0x72, 0xf2]).buffer;
  assert.match(decodeText(buf), /Però$/);
});

test('estratto in Excel: intestazione dopo righe di titolo, date e numeri come celle', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Movimenti');
  ws.addRow(['Banca di prova']);
  ws.addRow([]);
  ws.addRow(['Data operazione', 'Descrizione', 'Importo', 'Saldo']);
  ws.addRow([new Date(Date.UTC(2026, 10, 3)), 'Bonifico affitto', -450, 1550]);
  ws.addRow([new Date(Date.UTC(2026, 10, 4)), { richText: [{ text: 'Dona' }, { text: 'zione' }] }, 100.5, { formula: 'D4+C5', result: 1650.5 }]);
  const buf = await wb.xlsx.writeBuffer();
  const rows = await xlsxRows(buf as ArrayBuffer);
  const { rows: r, header, hi } = fromRows(rows);
  const lines = toLines(r, hi, detect(header));
  assert.deepEqual(lines.map((l) => [l.date, l.amount, l.text, l.balance]),
    [['2026-11-03', -450, 'Bonifico affitto', 1550], ['2026-11-04', 100.5, 'Donazione', 1650.5]]);
});
