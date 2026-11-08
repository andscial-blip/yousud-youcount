import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Backup completo dei dati (solo amministratori): un file Excel con un foglio per tabella, tutte le
// colonne così come sono nel database (id compresi), per poterlo leggere e, se serve, ricaricare.
// I file dei giustificativi restano nello Storage: il foglio "documents" ne elenca percorso e impronta SHA-256.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ordine di ricarica: prima le tabelle a cui le altre fanno riferimento
// con la chiave primaria, per pagine stabili
const TABLES: [string, string[]][] = [
  ['organizations', ['id']], ['settings', ['org_id', 'key']], ['profiles', ['id']], ['accounts', ['id']], ['report_lines', ['id']],
  ['category_groups', ['id']], ['categories', ['id']], ['projects', ['id']], ['project_members', ['project_id', 'user_id']],
  ['payment_methods', ['id']], ['counterparties', ['id']], ['counterparty_private', ['counterparty_id']], ['grants', ['id']],
  ['budget_lines', ['id']], ['documents', ['id']], ['movements', ['id']], ['movement_documents', ['movement_id', 'document_id']],
  ['periods', ['org_id', 'year', 'month']], ['fx_rates', ['org_id', 'year', 'month']], ['cash_counts', ['id']], ['bank_reconciliations', ['id']], ['api_clients', ['id']], ['reconciliation_items', ['movement_id', 'side']],
  ['audit_log', ['id']], ['sync_log', ['id']],
];
const PAGE = 1000;   // PostgREST restituisce al massimo 1000 righe per richiesta

const cell = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : v);

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'non autenticato' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role, active, org_id').eq('id', auth.user.id).maybeSingle();
  if (!me?.active || !['super_admin', 'admin'].includes(me.role)) return NextResponse.json({ error: 'solo amministratori' }, { status: 403 });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'YouCount · YouSud ODV';
  wb.created = new Date();
  const info = wb.addWorksheet('LEGGIMI');
  const summary: { table: string; rows: number; sha256: string }[] = [];

  for (const [table, pk] of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      // api_clients: l'impronta delle chiavi non esce dal database (le chiavi si ricreano, non si ripristinano)
      const sel: string = table === 'api_clients' ? 'id, org_id, name, key_prefix, scopes, created_by, created_at, last_used_at, revoked_at, revoked_by' : '*';
      let q = supabase.from(table).select(sel);
      for (const k of pk) q = q.order(k, { ascending: true });
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
      rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
      if ((data ?? []).length < PAGE) break;
    }
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const ws = wb.addWorksheet(table.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(10, c.length + 2)) }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(Object.fromEntries(cols.map((c) => [c, cell(r[c])])));
    // impronta del contenuto: permette di controllare in futuro che il foglio non sia stato alterato
    const sha256 = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    summary.push({ table, rows: rows.length, sha256 });
  }

  const now = new Date();
  info.columns = [{ header: 'Tabella', key: 'table', width: 24 }, { header: 'Righe', key: 'rows', width: 10 }, { header: 'Impronta SHA-256 dei dati', key: 'sha256', width: 70 }];
  info.getRow(1).font = { bold: true };
  for (const s of summary) info.addRow(s);
  info.addRow({});
  info.addRow({ table: 'Creato il', rows: null, sha256: now.toISOString() });
  info.addRow({ table: 'Da', rows: null, sha256: auth.user.email ?? auth.user.id });
  info.addRow({ table: 'Nota', rows: null, sha256: 'I file dei giustificativi non sono inclusi: il foglio documents ne elenca percorso nello Storage e impronta.' });

  const buf = await wb.xlsx.writeBuffer();
  // data dell'ultimo backup: la dashboard ricorda agli amministratori di rifarlo dopo 7 giorni
  await supabase.from('settings').upsert({ org_id: me.org_id, key: 'last_backup', value: { at: now.toISOString(), by: auth.user.email },
    updated_by: auth.user.id, updated_at: now.toISOString() });
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="YouCount-backup-${stamp}.xlsx"`,
      'cache-control': 'no-store',
    },
  });
}
