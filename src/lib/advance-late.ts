// Regola unica del ritardo degli anticipi, usata da Dashboard, Scadenze e Conti › Anticipi (revisione 14/11):
//  · se l'anticipo nasce da una richiesta, è in ritardo quando è passata la data per portare le ricevute (report_by);
//  · se non c'è una richiesta (anticipo dato direttamente), è in ritardo dopo ADVANCE_DAYS giorni con saldo ancora aperto.
export const ADVANCE_DAYS = 15;
export type AdvReq = { account_id: string; status: string; report_by: string };
export type AdvWallet = { account_id: string; balance: string | number; open_since: string | null };

export function advanceLate(w: AdvWallet, reqs: AdvReq[], today: string): { since: string } | null {
  const mine = reqs.filter((r) => r.account_id === w.account_id && (r.status === 'delivered' || r.status === 'reported'));
  const late = mine.filter((r) => r.report_by < today).map((r) => r.report_by).sort()[0];
  if (late) return { since: late };
  if (mine.length > 0 || !(Number(w.balance) > 0) || !w.open_since) return null;
  const due = new Date(Date.parse(w.open_since) + ADVANCE_DAYS * 864e5).toISOString().slice(0, 10);
  return due < today ? { since: due } : null;
}
