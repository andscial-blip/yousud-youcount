import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orgNow, todayYmd } from '../../src/lib/today.ts';

// «Oggi» è sempre quello di Antananarivo (UTC+3), anche su un server in UTC (revisione 21/11)
test('dopo la mezzanotte malgascia è già il giorno dopo', () => {
  assert.equal(todayYmd(new Date('2026-11-20T22:30:00Z')), '2026-11-21');
  assert.equal(todayYmd(new Date('2026-11-20T20:59:00Z')), '2026-11-20');
  assert.equal(todayYmd(new Date('2026-12-31T21:00:00Z')), '2027-01-01');
});
test('orgNow ha anno, mese e giorno di Antananarivo', () => {
  const d = orgNow(new Date('2026-11-30T21:30:00Z'));
  assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()], [2026, 12, 1, 0]);
});
test('anche con il processo in UTC, tra le 00 e le 03 di Antananarivo è già il giorno dopo (N-2, verifica finale)', () => {
  for (const [utc, ymd] of [['2026-11-22T21:00:00Z', '2026-11-23'], ['2026-11-22T22:30:00Z', '2026-11-23'], ['2026-11-22T23:59:59Z', '2026-11-23'], ['2026-11-22T20:59:59Z', '2026-11-22']] as const)
    assert.equal(todayYmd(new Date(utc)), ymd);
});
