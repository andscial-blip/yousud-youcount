import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docName, fileExt } from '../../src/lib/doc-name.ts';

test('nome del giustificativo dal numero del movimento', () => {
  assert.equal(docName('MOV-2026-003', 1, 'org/2026/abc.jpg', 'IMG_1234.JPG'), 'MOV-2026-003.jpg');
  assert.equal(docName('MOV-2026-003', 2, 'org/2026/def.pdf', 'fattura.pdf'), 'MOV-2026-003_2.pdf');
  assert.equal(docName('MOV-2026-003', 3, 'org/2026/def-scan.jpg'), 'MOV-2026-003_3.jpg');
});

test('bozza senza numero: resta il nome originale', () => {
  assert.equal(docName(null, 1, 'org/2026/abc.jpg', 'IMG_1234.JPG'), 'IMG_1234.JPG');
  assert.equal(docName(null, 1, 'org/2026/abc.jpg'), 'abc.jpg');
});

test('estensione', () => {
  assert.equal(fileExt('org/2026/a.b.PDF'), 'pdf');
  assert.equal(fileExt('org/2026/senza'), '');
});
