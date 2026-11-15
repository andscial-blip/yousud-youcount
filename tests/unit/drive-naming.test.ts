import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountTag, fileName, folderPath, slug, yearOf, type DriveTarget } from '../../src/lib/drive-naming.ts';

const base: DriveTarget = { document_id: 'x', kind: 'receipt', code: 'FAT', ref: 'MOV-2026-012', on_date: '2026-01-14', seq: 1,
  party: 'Telma', total: 185000, currency: 'MGA', cancelled: false, path: 'org/a/b.jpg', mime: 'image/jpeg', file_name: 'IMG.jpg' };

test('giustificativo: cartella per mese della data del movimento, nome con movimento e progressivo', () => {
  assert.deepEqual(folderPath(base), ['2026', '01_Giustificativi', '2026-01']);
  assert.equal(fileName(base), '2026-01-14_MOV-2026-012_a01_FAT_Telma_185000MGA.jpg');
});
test('il PDF generato prende estensione pdf; controparte con accenti e simboli ripulita', () => {
  const t = { ...base, mime: 'application/pdf', path: 'org/a/b.pdf', party: 'Épicerie «Chez Noël» & Fils', total: '12.5', currency: 'EUR', seq: 3 };
  assert.equal(fileName(t), '2026-01-14_MOV-2026-012_a03_FAT_Epicerie-Chez-Noel-Fils_12.50EUR.pdf');
});
test('senza controparte né importo il nome resta valido', () => {
  assert.equal(fileName({ ...base, party: null, total: null }), '2026-01-14_MOV-2026-012_a01_FAT.jpg');
});
test('autocertificazione: cartella propria fra i documenti emessi', () => {
  assert.deepEqual(folderPath({ ...base, code: 'AUT' }), ['2026', '02_Documenti-emessi', 'AUT_Autocertificazioni']);
});
test('documento emesso: anno della serie di numerazione, non della data', () => {
  const t: DriveTarget = { ...base, kind: 'issued', code: 'RIC', ref: 'RIC-2025-014', on_date: '2026-01-03', party: 'Parrocchia San Marco', total: 150, currency: 'EUR', mime: 'application/pdf', path: 'x.pdf' };
  assert.equal(yearOf(t), '2025');
  assert.deepEqual(folderPath(t), ['2025', '02_Documenti-emessi', 'RIC_Ricevute']);
  assert.equal(fileName(t), 'RIC-2025-014_2026-01-03_Parrocchia-San-Marco_150EUR.pdf');
  assert.equal(fileName({ ...t, cancelled: true }), 'RIC-2025-014_2026-01-03_Parrocchia-San-Marco_150EUR_ANNULLATO.pdf');
});
test('notule nella cartella riservata; tipo sconosciuto in una cartella «Altri»', () => {
  const t: DriveTarget = { ...base, kind: 'issued', code: 'NOT', ref: 'NOT-2026-003' };
  assert.deepEqual(folderPath(t), ['2026', '05_Riservato', 'NOT_Notule']);
  assert.deepEqual(folderPath({ ...t, code: 'XYZ', ref: 'XYZ-2026-001' }), ['2026', '02_Documenti-emessi', 'XYZ_Altri']);
});
test('slug e importi', () => {
  assert.equal(slug('  Coop. Fanilo / Ambanja  '), 'Coop-Fanilo-Ambanja');
  assert.equal(slug('a'.repeat(50)).length, 30);
  assert.equal(amountTag(900000, 'MGA'), '900000MGA');
  assert.equal(amountTag('', 'EUR'), '');
});
