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
  return fromRows(L.map((l) => splitCsv(l, sep)));
}

// Tabella già divisa in celle (CSV, foglio Excel, tabella HTML): trova la riga d'intestazione.
export function fromRows(rows: string[][]): { rows: string[][]; header: string[]; hi: number } {
  rows = rows.filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return { rows: [], header: [], hi: -1 };
  const hi = rows.findIndex((r) => r.some((c) => /data|date|booking/i.test(c)) && r.some((c) => /importo|amount|montant|dare|avere|debit|credit|débit|crédit|uscit|entrat|addebit|accredit/i.test(c)));
  return { rows, header: hi >= 0 ? rows[hi] : rows[0].map((_, i) => `Col ${i + 1}`), hi };
}

// Che cosa contiene il file, dai primi byte: molte banche chiamano «.xls» una tabella HTML o un testo.
export function sniff(b: Uint8Array): 'xlsx' | 'xls' | 'html' | 'text' {
  if (b[0] === 0x50 && b[1] === 0x4b) return 'xlsx';
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'xls';
  const head = new TextDecoder().decode(b.slice(0, 512)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return head.startsWith('<') && /<(html|table|!doctype)/.test(head) ? 'html' : 'text';
}

export function detect(header: string[]): Mapping {
  const H = header.map((h) => h.toLowerCase());
  const f = (re: RegExp) => H.findIndex((h) => re.test(h));
  const date = (() => { const i = f(/^data( contabile| operazione)?$|^date( op[ée]ration| comptable)?$|^booking/); return i >= 0 ? i : Math.max(0, f(/data|date/)); })();
  return {
    date,
    amount: (() => { const i = f(/^(?!.*(data|date|saldo|solde|balance))(importo|amount|montant)/); return i >= 0 ? i : f(/^(?!.*(data|date|saldo))valore/); })(),
    debit: f(/dare|addebit|uscit|debit|débit/), credit: f(/avere|accredit|entrat|credit|crédit/),
    // descrizione: mai la colonna della data («Data operazione»); prima i nomi più espliciti
    text: (() => { const i = f(/^(?!.*(data|date)).*(descr|causale|libell|details|wording)/); return i >= 0 ? i : f(/^(?!.*(data|date)).*(motivo|operaz|note)/); })(),
    balance: f(/saldo|solde|balance/),
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

// ---- Estratto in Excel (.xlsx) o tabella HTML salvata come .xls (exceljs si carica solo quando serve)
type Cell = { value: unknown; text?: string };

function cellText(c: Cell): string {
  const v = c.value as unknown;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.result !== undefined) return cellText({ value: o.result });
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text) return String(o.text);
  }
  return String(v).trim();
}

export async function xlsxRows(buf: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  // il primo foglio con una riga d'intestazione riconoscibile, altrimenti il primo
  let best: string[][] = [];
  for (const ws of wb.worksheets) {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const out: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => { out[col - 1] = cellText(cell as unknown as Cell); });
      rows.push(Array.from(out, (x) => x ?? ''));
    });
    if (fromRows(rows).hi >= 0) return rows;
    if (!best.length) best = rows;
  }
  return best;
}

export function htmlRows(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()));
}

// Testo in UTF-8 o, se non lo è, nella codifica di Windows usata da molte banche italiane e francesi.
export function decodeText(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

// Righe del file (CSV, .xlsx, tabella HTML) oppure 'xls' se è un vecchio Excel binario (da salvare come .xlsx o CSV).
export async function fileRows(f: File): Promise<string[][] | 'xls'> {
  const buf = await f.arrayBuffer();
  const kind = sniff(new Uint8Array(buf));
  if (kind === 'xls') return 'xls';
  if (kind === 'xlsx') return xlsxRows(buf);
  const text = decodeText(buf);
  return kind === 'html' ? htmlRows(text) : readCsv(text).rows;
}
