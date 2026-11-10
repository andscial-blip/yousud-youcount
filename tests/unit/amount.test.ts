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

import { formatTyping } from '../../src/lib/amount.ts';
test('mentre si scrive: punto delle migliaia e virgola dei decimali', () => {
  assert.equal(formatTyping('5000').text, '5.000');
  assert.equal(formatTyping('1234567').text, '1.234.567');
  assert.equal(formatTyping('1234567,5').text, '1.234.567,5');
  assert.equal(formatTyping('5.0000').text, '50.000');
  assert.equal(formatTyping('12.5').text, '12,5');
  assert.equal(formatTyping('12,345').text, '12,34');
  assert.equal(formatTyping('').text, '');
  assert.equal(formatTyping('0005').text, '5');
  assert.equal(formatTyping(',5').text, '0,5');
  assert.deepEqual(formatTyping('5000', 4), { text: '5.000', caret: 5 });
  assert.deepEqual(formatTyping('15000', 2), { text: '15.000', caret: 2 });
});
