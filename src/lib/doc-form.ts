import { parseAmount } from './amount';
import { notTotals, type DocType, type NotLine, type NrsLine } from './doc-model';

// Lettura del modulo di un documento: la usano l'anteprima live (browser) e il salvataggio (server), così
// l'anteprima mostra esattamente ciò che verrà salvato.
const n = (s: FormDataEntryValue | null) => parseAmount(String(s ?? '')) ?? 0;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
export const LINES = { NOT: 6, BDC: 8, NRS: 8 } as const;

export function readDocForm(f: FormData) {
  const type = str(f, 'type') as DocType;
  const data: Record<string, unknown> = {};
  for (const k of ['causale', 'causale_txt', 'method', 'desc', 'period', 'activity', 'role', 'code', 'supplier', 'need_by', 'reason', 'ref', 'pay_by',
    'received_on', 'paid_on', 'tpl', 'title', 'body', 'body_fr', 'declarant', 'year', 'hours', 'delivery_by', 'delivery_place', 'terms'])
    if (str(f, k)) data[k] = str(f, k);
  for (const k of ['deduc', 'bollo_exempt', 'volunteer', 'advance']) data[k] = f.get(k) === 'on';
  let amount: number | null = parseAmount(str(f, 'amount'));
  if (type === 'NOT' || type === 'BDC') {
    const lines: NotLine[] = [];
    for (let i = 0; i < LINES[type]; i++) { const d = str(f, `l${i}_d`), p = n(f.get(`l${i}_p`)); if (d || p) lines.push({ d, q: n(f.get(`l${i}_q`)) || 1, p }); }
    data.lines = lines;
    if (type === 'NOT') { data.ritenuta = n(f.get('ritenuta')); amount = notTotals(lines, Number(data.ritenuta)).gross; }
    else amount = Math.round(lines.reduce((s, l) => s + l.q * l.p, 0) * 100) / 100;
  }
  if (type === 'NRS') {
    const lines: NrsLine[] = [];
    for (let i = 0; i < LINES.NRS; i++) { const d = str(f, `l${i}_d`), a = n(f.get(`l${i}_a`)); if (d || a) lines.push({ date: str(f, `l${i}_date`), d, amt: a, doc: f.get(`l${i}_doc`) === 'on' }); }
    data.lines = lines;
    amount = Math.round(lines.reduce((s, l) => s + l.amt, 0) * 100) / 100;
  }
  return { id: str(f, 'id') || undefined, type, lang: str(f, 'lang') || 'it', doc_date: str(f, 'doc_date'), movement_id: str(f, 'movement_id'),
    project_id: str(f, 'project_id'), counterparty_id: str(f, 'counterparty_id'), party_name: str(f, 'party_name'), party_tax_id: str(f, 'party_tax_id'),
    party_address: str(f, 'party_address'), amount: amount ?? '', currency: str(f, 'currency') || 'EUR', data };
}

// Tasso del documento: quello del movimento collegato, altrimenti il tasso mensile del mese del documento
// (o l'ultimo disponibile prima). Chiave «AAAA-MM».
export function pickRate(rates: Record<string, number>, docDate: string, movementRate?: number | null) {
  if (movementRate && movementRate > 0) return movementRate;
  const key = (docDate || new Date().toISOString()).slice(0, 7);
  if (rates[key]) return rates[key];
  const prev = Object.keys(rates).filter((k) => k <= key).sort().pop();
  return prev ? rates[prev] : 0;
}
