import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../../src/lib/amount.ts';

test('importi scritti in forme diverse', () => {
  const cases: [string, number | null][] = [
    ['1.234,56', 1234.56], ['1234,56', 1234.56], ['1,234.56', 1234.56], ['1234.56', 1234.56], ['1 234', 1234],
    ['1.234', 1234], ['1,234', 1234], ['1.010.000', 1010000], ['1 010 000 Ar', 1010000], ['12,5', 12.5],
    ['0,750', 0.75], ['250', 250], ['€ 35,00', 35], ['', null], ['abc', null], ['-5', null], ['0', null],
  ];
  for (const [s, exp] of cases) assert.equal(parseAmount(s), exp, s);
});
