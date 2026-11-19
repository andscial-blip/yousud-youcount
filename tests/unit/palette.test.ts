import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_SHADES, EXPENSE_SHADES, INCOME_SHADES, ITEM_PAL, REST, groupColor, projectColorMap } from '../../src/lib/palette.ts';

// Guardia contro le regressioni dei colori (settimo giro di esperti, 19/11): ogni famiglia ha i suoi colori, mai condivisi.
const up = (xs: readonly string[]) => xs.map((x) => x.toUpperCase());
const FIXED = up(['#2E3D52', '#1E2B3C', '#E8BE5A', '#5FB8A3', '#5B8FD6', '#E2917F', '#8FAFD6', '#A596E6']); // entrate, uscite, saldo, previsto, corallo, Italia, Madagascar

test('progetti e gruppi di spesa non condividono nessun colore', () => {
  const p = new Set(up(ITEM_PAL));
  for (const c of up(EXPENSE_SHADES)) assert.ok(!p.has(c), `${c} è sia di un progetto sia di un gruppo di spesa`);
  for (const c of up(INCOME_SHADES)) assert.ok(!p.has(c), `${c} è sia di un progetto sia di un gruppo di entrata`);
});

test('i progetti non usano i colori con un significato fisso né quelli dei paesi', () => {
  const p = new Set(up(ITEM_PAL));
  for (const c of [...FIXED, ...up(COUNTRY_SHADES.IT), ...up(COUNTRY_SHADES.MG), REST.toUpperCase()]) assert.ok(!p.has(c), `${c} non può essere un colore di progetto`);
});

test('fino a dodici progetti nessun colore si ripete', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
  const m = projectColorMap(ids);
  assert.equal(new Set(m.values()).size, 12);
  assert.equal(m.get('p0'), projectColorMap(['p0', 'nuovo']).get('p0'), 'un progetto nuovo non cambia il colore dei vecchi');
});

test('ogni gruppo ha il suo colore, diverso dagli altri gruppi', () => {
  const out = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map(groupColor);
  assert.equal(new Set(out).size, 9);
  const inc = ['E1', 'E2', 'E3', 'E4'].map(groupColor);
  assert.equal(new Set(inc).size, 4);
  for (const c of inc) assert.ok(!out.includes(c));
});
