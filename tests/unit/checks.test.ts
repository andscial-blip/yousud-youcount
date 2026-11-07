import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Extraction, mockExtraction, runChecks } from '../../src/lib/ai/schema.ts';

test('schema della lettura IA: accetta solo campi completi e stati previsti', () => {
  const f = { value: 1, source: 'x', confidence: 0.9, status: 'present' };
  const ok = Object.fromEntries(['doc_type', 'doc_date', 'doc_number', 'supplier_name', 'supplier_tax_id', 'total', 'currency',
    'tax_amount', 'description', 'category_code', 'payment_method', 'language'].map((k) => [k, f]));
  assert.ok(Extraction.safeParse(ok).success);
  assert.ok(!Extraction.safeParse({ ...ok, total: { ...f, status: 'guessed' } }).success, 'stato non previsto');
  assert.ok(!Extraction.safeParse({ ...ok, total: { ...f, confidence: 3 } }).success, 'confidenza fuori scala');
  const missing = { ...ok }; delete (missing as Record<string, unknown>).total;
  assert.ok(!Extraction.safeParse(missing).success, 'campo mancante');
});

test('controlli automatici sui valori letti', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const x = mockExtraction();
  x.doc_date.value = '2026-11-01';
  const ok = Object.fromEntries(runChecks(x, now).map((c) => [c.code, c.ok]));
  assert.deepEqual([ok.total_present, ok.date_valid, ok.date_recent, ok.currency_known], [true, true, true, true]);
  x.doc_date.value = '2027-01-01';
  x.total = { value: null, source: null, confidence: 0, status: 'missing' };
  x.currency = { value: 'USD', source: '$', confidence: 0.9, status: 'present' };
  x.supplier_name = { value: 'Boh', source: 'B..h', confidence: 0.4, status: 'ambiguous' };
  const ko = Object.fromEntries(runChecks(x, now).map((c) => [c.code, c]));
  assert.equal(ko.total_present.ok, false);
  assert.equal(ko.date_valid.ok, false, 'data futura');
  assert.equal(ko.currency_known.ok, false);
  assert.match(ko.confidence.message, /supplier_name/);
});
