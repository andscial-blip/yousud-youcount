// Lettura di un estratto conto CSV scaricato dalla banca (nel browser: il file non viene inviato né salvato).
// Riconosce da sola le colonne più comuni (data, importo oppure dare/avere, descrizione, saldo) in italiano,
// francese e inglese; numeri in formato italiano/francese (1.234,56 · 1 234,56) o inglese (1,234.56).
// Ripreso dalla logica del Gestionale YouSud (bkParseCsv, brDetect).
export type StmtLine = { date: string; amount: number; text: string; balance: number | null };
export type Mapping = { date: number; amount: number; debit: number; credit: number; text: number; balance: number };

export function splitCsv(line: string, sep: string): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseNum(s: string | undefined): number | null {
  if (s == null) return null;
  let v = s.replace(/[\s  '€]|EUR|MGA|Ar\b/gi, '');
  if (!v) return null;
  let neg = false;
  if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
  if (/^[-−]/.test(v)) { neg = true; v = v.slice(1); } else if (/-$/.test(v)) { neg = true; v = v.slice(0, -1); } else if (/^\+/.test(v)) v = v.slice(1);
  if (!/^\d[\d.,]*$/.test(v)) return null;
  const lastC = v.lastIndexOf(','), lastD = v.lastIndexOf('.');
  if (lastC > lastD) v = v.replace(/\./g, '').replace(',', '.');                 // 1.234,56
  else if (lastD > lastC && lastC >= 0) v = v.replace(/,/g, '');                  // 1,234.56
  else if (lastD >= 0 && v.split('.').length > 2) v = v.replace(/\./g, '');       // 1.234.567
  else if (lastD >= 0 && /\.\d{3}$/.test(v) && !/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, '');   // 1.234 (migliaia)
  const n = Number(v);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}

export function readCsv(text: string): { rows: string[][]; header: string[]; hi: number } {
  const L = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!L.length) return { rows: [], header: [], hi: -1 };
  const probe = L.slice(0, 15).join('\n');
  const sep = [';', '\t', ','].map((c) => [c, (probe.match(new RegExp(c === '\t' ? '\\t' : c, 'g')) ?? []).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows = L.map((l) => splitCsv(l, sep));
  const hi = rows.findIndex((r) => r.some((c) => /data|date|booking/i.test(c)) && r.some((c) => /importo|amount|montant|dare|avere|debit|credit|débit|crédit|uscit|entrat|addebit|accredit/i.test(c)));
  return { rows, header: hi >= 0 ? rows[hi] : rows[0].map((_, i) => `Col ${i + 1}`), hi };
}

export function detect(header: string[]): Mapping {
  const H = header.map((h) => h.toLowerCase());
  const f = (re: RegExp) => H.findIndex((h) => re.test(h));
  const date = (() => { const i = f(/^data( contabile| operazione)?$|^date( op[ée]ration| comptable)?$|^booking/); return i >= 0 ? i : Math.max(0, f(/data|date/)); })();
  return {
    date,
    amount: (() => { const i = f(/^(?!.*(data|date|saldo|solde|balance))(importo|amount|montant)/); return i >= 0 ? i : f(/^(?!.*(data|date|saldo))valore/); })(),
    debit: f(/dare|addebit|uscit|debit|débit/), credit: f(/avere|accredit|entrat|credit|crédit/),
    text: f(/descr|causale|libell|details|motivo|operaz|note|wording/), balance: f(/saldo|solde|balance/),
  };
}

export function toLines(rows: string[][], hi: number, mp: Mapping): StmtLine[] {
  const out: StmtLine[] = [];
  for (const r of rows.slice(hi + 1)) {
    const date = parseDate(r[mp.date]);
    if (!date) continue;
    let a = mp.amount >= 0 ? parseNum(r[mp.amount]) : null;
    if (a === null && (mp.debit >= 0 || mp.credit >= 0)) {
      const de = mp.debit >= 0 ? parseNum(r[mp.debit]) : null, cr = mp.credit >= 0 ? parseNum(r[mp.credit]) : null;
      if (de === null && cr === null) continue;
      a = (cr ? Math.abs(cr) : 0) - (de ? Math.abs(de) : 0);
    }
    if (a === null || a === 0) continue;
    const text = (mp.text >= 0 ? r[mp.text] : r.filter((_, i) => i !== mp.date && i !== mp.amount).join(' ')) ?? '';
    out.push({ date, amount: Math.round(a * 100) / 100, text: text.replace(/\s+/g, ' ').trim(), balance: mp.balance >= 0 ? parseNum(r[mp.balance]) : null });
  }
  return out;
}

// Abbinamento: stesso importo (al centesimo; 1 ariary per MGA) e data entro 7 giorni, la più vicina; ogni movimento una volta sola.
export function match<T extends { key: string; amount: number; op_date: string }>(lines: StmtLine[], legs: T[], tol = 0.005) {
  const used = new Set<string>();
  return lines.map((l) => {
    let best: { leg: T; dd: number } | null = null;
    for (const g of legs) {
      if (used.has(g.key) || Math.abs(g.amount - l.amount) > tol) continue;
      const dd = Math.abs(Date.parse(g.op_date) - Date.parse(l.date)) / 864e5;
      if (dd > 7) continue;
      if (!best || dd < best.dd) best = { leg: g, dd };
    }
    if (best) used.add(best.leg.key);
    return { line: l, leg: best?.leg ?? null };
  });
}
