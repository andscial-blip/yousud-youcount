import ExcelJS from 'exceljs';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normLang } from '@/lib/i18n';
import { buildReport, REPORTS, type ReportKind } from '@/lib/reports';

// Esportazioni Excel con i permessi dell'utente collegato (la RLS filtra le righe).
// /api/v1/export/movimenti?anno=2026&stato=verified   ·   /api/v1/export/rendiconto?anno=2026
export const dynamic = 'force-dynamic';

const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } } as const;
const SECT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } as const;

function sheet(wb: ExcelJS.Workbook, name: string, cols: { header: string; key: string; width: number; fmt?: string }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FF16324F' } }; c.fill = HEAD; });
  return ws;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'non autenticato' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('lang, active, role').eq('id', auth.user.id).maybeSingle();
  if (!me?.active) return NextResponse.json({ error: 'account non attivo' }, { status: 403 });
  const fr = normLang(me.lang) === 'fr';
  const year = Number(req.nextUrl.searchParams.get('anno')) || new Date().getFullYear();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'YouCount · YouSud ODV';
  wb.created = new Date();
  let file = '';

  if (kind === 'movimenti') {
    let q = supabase.from('movements').select(`ref, op_date, doc_date, kind, status, description, amount, currency, fx_rate, amount_eur, sign,
        category:categories(code, name_it, name_fr), project:projects(name), grant:grants(title), counterparty:counterparties(name),
        account:accounts!movements_account_id_fkey(name_it, name_fr), to_account:accounts!movements_to_account_id_fkey(name_it, name_fr), reverses_id`)
      .gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`).order('op_date').order('ref');
    const st = req.nextUrl.searchParams.get('stato');
    if (st && ['draft', 'recorded', 'verified'].includes(st)) q = q.eq('status', st);
    const { data, error } = await q.limit(50000);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const K = fr ? { income: 'Recette', expense: 'Dépense', transfer: 'Virement interne' } : { income: 'Entrata', expense: 'Uscita', transfer: 'Giroconto' };
    const S = fr ? { draft: 'Brouillon', recorded: 'À vérifier', verified: 'Vérifié' } : { draft: 'Bozza', recorded: 'Da verificare', verified: 'Verificato' };
    const ws = sheet(wb, fr ? 'Mouvements' : 'Movimenti', [
      { header: fr ? 'Réf.' : 'Rif.', key: 'ref', width: 14 }, { header: 'Data', key: 'date', width: 12, fmt: 'dd/mm/yyyy' },
      { header: fr ? 'Type' : 'Tipo', key: 'kind', width: 12 }, { header: fr ? 'Statut' : 'Stato', key: 'status', width: 13 },
      { header: fr ? 'Description' : 'Descrizione', key: 'desc', width: 38 }, { header: fr ? 'Code' : 'Codice', key: 'code', width: 8 },
      { header: fr ? 'Libellé du code' : 'Voce', key: 'codename', width: 32 }, { header: fr ? 'Projet' : 'Progetto', key: 'project', width: 24 },
      { header: fr ? 'Financement' : 'Finanziamento', key: 'grant', width: 22 }, { header: fr ? 'Tiers' : 'Controparte', key: 'cp', width: 22 },
      { header: fr ? 'Compte' : 'Conto', key: 'account', width: 26 }, { header: fr ? 'Vers le compte' : 'Al conto', key: 'to', width: 22 },
      { header: fr ? 'Devise' : 'Valuta', key: 'cur', width: 7 }, { header: fr ? 'Montant' : 'Importo', key: 'amount', width: 15, fmt: '#,##0.00' },
      { header: fr ? 'Taux' : 'Tasso', key: 'rate', width: 9, fmt: '#,##0' }, { header: fr ? 'Montant EUR' : 'Importo EUR', key: 'eur', width: 14, fmt: '#,##0.00' },
    ]);
    type N = { name_it: string; name_fr: string } | null;
    const L = (o: N) => (!o ? '' : fr && o.name_fr ? o.name_fr : o.name_it);
    for (const m of data ?? []) {
      const sgn = m.sign * (m.kind === 'income' ? 1 : m.kind === 'expense' ? -1 : 1);
      const c = m.category as unknown as (N & { code: string }) | null;
      ws.addRow({
        ref: m.ref ?? '', date: new Date(m.op_date), kind: K[m.kind as keyof typeof K] + (m.reverses_id ? (fr ? ' (extourne)' : ' (storno)') : ''),
        status: S[m.status as keyof typeof S], desc: m.description, code: c?.code ?? '', codename: L(c),
        project: (m.project as unknown as { name: string } | null)?.name ?? '', grant: (m.grant as unknown as { title: string } | null)?.title ?? '',
        cp: (m.counterparty as unknown as { name: string } | null)?.name ?? '', account: L(m.account as unknown as N),
        to: L(m.to_account as unknown as N), cur: m.currency, amount: Number(m.amount) * sgn,
        rate: m.fx_rate ? Number(m.fx_rate) : null, eur: m.amount_eur !== null ? Number(m.amount_eur) * sgn : null,
      });
    }
    ws.autoFilter = { from: 'A1', to: 'P1' };
    file = `${fr ? 'mouvements' : 'movimenti'}-${year}.xlsx`;
  } else if (kind === 'rendiconto') {
    const { data, error } = await supabase.rpc('report_cash_statement', { p_year: year });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.length) return NextResponse.json({ error: 'non disponibile per questo ruolo' }, { status: 403 });
    const { data: lbl } = await supabase.from('report_lines').select('direction, key, section_fr, name_fr');
    const frl = new Map((lbl ?? []).map((l) => [`${l.direction}/${l.key}`, l]));
    const ws = sheet(wb, fr ? 'Compte de caisse' : 'Rendiconto', [
      { header: fr ? 'Poste' : 'Voce', key: 'item', width: 70 }, { header: String(year), key: 'cur', width: 16, fmt: '#,##0.00' },
      { header: String(year - 1), key: 'prev', width: 16, fmt: '#,##0.00' },
    ]);
    for (const dir of ['out', 'in'] as const) {
      const rows = (data as { direction: string; section: string; section_it: string; key: string; name_it: string; amount_eur: string; amount_eur_prev: string }[])
        .filter((r) => r.direction === dir);
      const t = ws.addRow({ item: dir === 'out' ? (fr ? 'DÉPENSES' : 'USCITE') : (fr ? 'RECETTES' : 'ENTRATE') });
      t.font = { bold: true, color: { argb: 'FF16324F' } };
      let sec = '';
      for (const r of rows) {
        const f = frl.get(`${dir}/${r.key}`);
        if (r.section !== sec) {
          sec = r.section;
          const tot = rows.filter((x) => x.section === sec);
          const h = ws.addRow({ item: fr && f?.section_fr ? f.section_fr : r.section_it,
            cur: tot.reduce((s, x) => s + Number(x.amount_eur), 0), prev: tot.reduce((s, x) => s + Number(x.amount_eur_prev), 0) });
          h.font = { bold: true };
          h.eachCell((c) => { c.fill = SECT; });
        }
        ws.addRow({ item: `   ${fr && f?.name_fr ? f.name_fr : r.name_it}`, cur: Number(r.amount_eur), prev: Number(r.amount_eur_prev) });
      }
      const tr = ws.addRow({ item: dir === 'out' ? (fr ? 'Total des dépenses' : 'Totale uscite') : (fr ? 'Total des recettes' : 'Totale entrate'),
        cur: rows.reduce((s, x) => s + Number(x.amount_eur), 0), prev: rows.reduce((s, x) => s + Number(x.amount_eur_prev), 0) });
      tr.font = { bold: true };
      ws.addRow({});
    }
    const note = ws.addRow({ item: fr
      ? 'Brouillon calculé par YouCount à partir des mouvements comptabilisés et vérifiés. Conformité à vérifier par l’expert-comptable.'
      : 'Bozza calcolata da YouCount dai movimenti registrati e verificati. Conformità da verificare con il commercialista.' });
    note.font = { color: { argb: 'FF5E6B7C' } };
    file = `${fr ? 'compte-de-caisse' : 'rendiconto'}-${year}.xlsx`;
  } else if (kind === 'finanziamento') {
    const r = await grantReport(supabase, req, fr, wb, me.role);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    file = r.file;
  } else if (kind === 'report') {
    const tipo = (REPORTS.find((r) => r.k === req.nextUrl.searchParams.get('tipo'))?.k ?? 'mensile') as ReportKind;
    let tables;
    try { tables = await buildReport(supabase, tipo, year, fr ? 'fr' : 'it'); } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'errore' }, { status: 400 });
    }
    tables.forEach((tb, i) => {
      const ws = sheet(wb, tb.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Report ${i + 1}`,
        tb.head.map((h, j) => ({ header: h.h, key: `c${j}`, width: h.num ? 16 : j === 0 ? 22 : 30, fmt: h.num ? '#,##0.00' : undefined })));
      const put = (cells: typeof tb.rows[number]) => ws.addRow(Object.fromEntries(cells.map((c, j) => [`c${j}`,
        c.t === 'date' && c.v ? new Date(String(c.v)) : c.v])));
      tb.rows.forEach((r) => put(r));
      if (tb.foot) put(tb.foot).font = { bold: true };
      if (tb.note) ws.addRow([]).getCell(1).value = tb.note;
    });
    file = `report-${tipo}-${year}.xlsx`;
  } else if (kind === 'budget') {
    if (!['super_admin', 'admin', 'responsabile', 'read_only'].includes(me.role)) return NextResponse.json({ error: 'non autorizzato' }, { status: 403 });
    const vid = req.nextUrl.searchParams.get('v');
    const { data: b } = vid ? await supabase.from('budgets').select('id, version, status, approval_ref').eq('id', vid).maybeSingle()
      : await supabase.from('budgets').select('id, version, status, approval_ref').eq('year', year).eq('status', 'approved').maybeSingle();
    const [{ data: items }, { data: cmp }, { data: stB }, { data: stA }] = await Promise.all([
      b ? supabase.from('budget_items').select('line_no, description, qty, unit, unit_cost, currency, fx_rate, amount, amount_eur, notes, category:categories(code, name_it, name_fr, direction), project:projects(name), counterparty:counterparties(name)').eq('budget_id', b.id).order('line_no')
        : Promise.resolve({ data: [] }),
      supabase.rpc('budget_compare', { p_year: year, p_budget: b && b.status !== 'approved' ? b.id : null }),
      supabase.rpc('budget_statement', { p_year: year, p_budget: b && b.status !== 'approved' ? b.id : null }),
      supabase.rpc('report_cash_statement', { p_year: year }),
    ]);
    type It = { line_no: number; counterparty: { name: string } | null; description: string | null; qty: string; unit: string | null; unit_cost: string; currency: string; fx_rate: string | null; amount: string; amount_eur: string; notes: string | null;
      category: { code: string; name_it: string; name_fr: string; direction: string } | null; project: { name: string } | null };
    const w1 = sheet(wb, fr ? 'Lignes' : 'Righe', [
      { header: fr ? 'N°' : 'N.', key: 'no', width: 6 }, { header: fr ? 'Type' : 'Tipo', key: 'd', width: 10 }, { header: 'Code', key: 'c', width: 8 }, { header: fr ? 'Poste' : 'Voce', key: 'n', width: 32 },
      { header: fr ? 'Projet' : 'Progetto', key: 'p', width: 22 }, { header: fr ? 'Description' : 'Descrizione', key: 'ds', width: 32 },
      { header: fr ? 'Donateur / Fournisseur' : 'Donatore / Fornitore', key: 'cp', width: 24 }, { header: fr ? 'Quantité' : 'Quantità', key: 'q', width: 10, fmt: '#,##0.##' },
      { header: fr ? 'Unité' : 'Unità', key: 'u', width: 10 }, { header: fr ? 'Coût unitaire' : 'Costo unitario', key: 'uc', width: 14, fmt: '#,##0.00' },
      { header: fr ? 'Devise' : 'Valuta', key: 'cur', width: 8 }, { header: fr ? 'Taux' : 'Tasso', key: 'r', width: 10, fmt: '#,##0.####' },
      { header: fr ? 'Montant' : 'Importo', key: 'a', width: 14, fmt: '#,##0.00' }, { header: 'EUR', key: 'e', width: 14, fmt: '#,##0.00' }, { header: fr ? 'Notes' : 'Note', key: 'nt', width: 32 }]);
    for (const i of (items ?? []) as unknown as It[]) w1.addRow({ no: i.line_no, cp: i.counterparty?.name ?? '', nt: i.notes ?? '', d: i.category?.direction === 'in' ? (fr ? 'Recette' : 'Entrata') : (fr ? 'Dépense' : 'Uscita'),
      c: i.category?.code, n: fr && i.category?.name_fr ? i.category.name_fr : i.category?.name_it, p: i.project?.name ?? (fr ? 'Général' : 'Generale'), ds: i.description,
      q: Number(i.qty), u: i.unit, uc: Number(i.unit_cost), cur: i.currency, r: i.fx_rate ? Number(i.fx_rate) : null, a: Number(i.amount), e: Number(i.amount_eur) });
    type Cm = { direction: string; category_code: string; cat_it: string; cat_fr: string; project_name: string | null; budget_eur: string; actual_eur: string; committed_eur: string };
    const w2 = sheet(wb, fr ? 'Budget vs réalisé' : 'Prev. vs cons.', [
      { header: fr ? 'Type' : 'Tipo', key: 'd', width: 10 }, { header: 'Code', key: 'c', width: 8 }, { header: fr ? 'Poste' : 'Voce', key: 'n', width: 32 },
      { header: fr ? 'Projet' : 'Progetto', key: 'p', width: 22 }, { header: fr ? 'Budget' : 'Preventivo', key: 'b', width: 14, fmt: '#,##0.00' },
      { header: fr ? 'Réalisé' : 'Consuntivo', key: 'a', width: 14, fmt: '#,##0.00' }, { header: fr ? 'Engagé' : 'Impegnato', key: 'k', width: 14, fmt: '#,##0.00' },
      { header: fr ? 'Reste' : 'Residuo', key: 'r', width: 14, fmt: '#,##0.00' }, { header: '%', key: 'pc', width: 8, fmt: '0%' }]);
    for (const r of (cmp ?? []) as Cm[]) w2.addRow({ d: r.direction === 'in' ? (fr ? 'Recette' : 'Entrata') : (fr ? 'Dépense' : 'Uscita'), c: r.category_code,
      n: fr && r.cat_fr ? r.cat_fr : r.cat_it, p: r.project_name ?? (fr ? 'Général' : 'Generale'), b: Number(r.budget_eur), a: Number(r.actual_eur),
      k: Number(r.committed_eur), r: Number(r.budget_eur) - Number(r.actual_eur), pc: Number(r.budget_eur) ? Number(r.actual_eur) / Number(r.budget_eur) : null });
    if (b) w2.addRow([]).getCell(1).value = `${fr ? 'Version' : 'Versione'} ${b.version} · ${b.status}${b.approval_ref ? ` · ${b.approval_ref}` : ''}`;
    // schema del rendiconto per cassa (modello D): stesse voci del rendiconto, preventivo e consuntivo
    type St = { direction: string; section_it: string; section_fr: string; key: string | null; name_it: string; name_fr: string; budget_eur: string };
    const act = new Map(((stA ?? []) as { direction: string; key: string; amount_eur: string }[]).map((a) => [`${a.direction}|${a.key}`, Number(a.amount_eur)]));
    const w3 = sheet(wb, fr ? 'Schéma compte rendu' : 'Schema rendiconto', [
      { header: fr ? 'Type' : 'Tipo', key: 'd', width: 10 }, { header: 'Section', key: 's', width: 34 }, { header: fr ? 'Poste' : 'Voce', key: 'k', width: 8 },
      { header: fr ? 'Libellé' : 'Descrizione', key: 'n', width: 48 }, { header: fr ? 'Budget' : 'Preventivo', key: 'b', width: 14, fmt: '#,##0.00' },
      { header: fr ? 'Réalisé' : 'Consuntivo', key: 'a', width: 14, fmt: '#,##0.00' }, { header: fr ? 'Écart' : 'Differenza', key: 'x', width: 14, fmt: '#,##0.00' }]);
    for (const r of (stB ?? []) as St[]) {
      const a = r.key ? act.get(`${r.direction}|${r.key}`) ?? 0 : null;
      if (!Number(r.budget_eur) && !a) continue;
      w3.addRow({ d: r.direction === 'in' ? (fr ? 'Recette' : 'Entrata') : (fr ? 'Dépense' : 'Uscita'), s: fr && r.section_fr ? r.section_fr : r.section_it,
        k: r.key ?? '', n: fr && r.name_fr ? r.name_fr : r.name_it, b: Number(r.budget_eur), a, x: a === null ? null : Number(r.budget_eur) - a });
    }
    file = `${fr ? 'budget' : 'preventivo'}-${year}.xlsx`;
  } else {
    return NextResponse.json({ error: 'esportazione sconosciuta' }, { status: 404 });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'no-store',
    },
  });
}

type Sb = Awaited<ReturnType<typeof createClient>>;
type Nm = { name_it: string; name_fr: string | null } | null;

// Rendiconto al finanziatore: entrate e spese collegate al finanziamento nel periodo scelto, per gruppo di budget,
// con i giustificativi. Solo dati già in YouCount (movimenti registrati o verificati); nessuna regola di ripartizione.
// /api/v1/export/finanziamento?id=<uuid>&dal=2026-01-01&al=2026-06-30
async function grantReport(supabase: Sb, req: NextRequest, fr: boolean, wb: ExcelJS.Workbook, role: string) {
  if (!['super_admin', 'admin', 'responsabile', 'read_only'].includes(role)) return { error: 'non disponibile per questo ruolo', status: 403 };
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id') ?? '';
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const { data: g, error: ge } = await supabase.from('grants')
    .select('id, title, code, currency, amount, start_date, end_date, donor:counterparties(name), project:projects(name)').eq('id', id).maybeSingle();
  if (ge || !g) return { error: 'finanziamento non trovato', status: 404 };
  const from = iso(sp.get('dal')) ?? g.start_date ?? null;
  const to = iso(sp.get('al')) ?? g.end_date ?? null;
  if (from && to && from > to) return { error: 'periodo non valido', status: 400 };

  const sel = `id, ref, op_date, doc_date, kind, status, description, amount, currency, fx_rate, amount_eur, sign, no_doc_reason,
    category:categories(code, name_it, name_fr, group_id), counterparty:counterparties(name), docs:movement_documents(document:documents(file_name, doc_number))`;
  let q = supabase.from('movements').select(sel).eq('grant_id', id).neq('status', 'draft').in('kind', ['income', 'expense']);
  if (from) q = q.gte('op_date', from);
  if (to) q = q.lte('op_date', to);
  const [{ data: moves, error: me }, { data: allExp }, { data: groups }, { data: budget }] = await Promise.all([
    q.order('op_date').order('ref').limit(20000),
    // speso dall'inizio fino alla fine del periodo, per il residuo
    (to ? supabase.from('movements').select('amount_eur, sign, category:categories(group_id)').lte('op_date', to)
      : supabase.from('movements').select('amount_eur, sign, category:categories(group_id)'))
      .eq('grant_id', id).eq('kind', 'expense').neq('status', 'draft').limit(50000),
    supabase.from('category_groups').select('id, code, name_it, name_fr, sort').eq('direction', 'out').order('sort'),
    supabase.from('budget_lines').select('group_id, amount_eur').eq('grant_id', id),
  ]);
  if (me) return { error: me.message, status: 400 };
  type Cat = { code: string; name_it: string; name_fr: string | null; group_id: string | null } | null;
  type Doc = { document: { file_name: string | null; doc_number: string | null } | null };
  const L = (o: Nm) => (!o ? '' : fr && o.name_fr ? o.name_fr : o.name_it);
  const S = fr ? { recorded: 'À vérifier', verified: 'Vérifié' } : { recorded: 'Da verificare', verified: 'Verificato' };
  const rows = (moves ?? []).map((m) => ({ ...m, cat: m.category as unknown as Cat, docs: (m.docs ?? []) as unknown as Doc[] }));
  const exp = rows.filter((m) => m.kind === 'expense');
  const inc = rows.filter((m) => m.kind === 'income');
  const eur = (m: { amount_eur: string | number | null; sign: number }) => (m.amount_eur === null ? 0 : Number(m.amount_eur) * m.sign);
  const sum = (a: { amount_eur: string | number | null; sign: number }[]) => Math.round(a.reduce((s, m) => s + eur(m), 0) * 100) / 100;
  const gname = new Map((groups ?? []).map((x) => [x.id, `${x.code} ${L(x)}`]));
  const day = (d: string | null) => (d ? d.split('-').reverse().join('/') : '–');
  const donor = (g.donor as unknown as { name: string } | null)?.name ?? '';
  const project = (g.project as unknown as { name: string } | null)?.name ?? '';

  // ---- riepilogo
  const ws = sheet(wb, fr ? 'Synthèse' : 'Riepilogo', [
    { header: fr ? 'Groupe de dépenses' : 'Gruppo di spesa', key: 'g', width: 44 },
    { header: fr ? 'Budget EUR' : 'Preventivo EUR', key: 'b', width: 16, fmt: '#,##0.00' },
    { header: fr ? 'Dépensé sur la période EUR' : 'Speso nel periodo EUR', key: 'p', width: 20, fmt: '#,##0.00' },
    { header: fr ? 'Dépensé cumulé EUR' : 'Speso dall’inizio EUR', key: 'c', width: 21, fmt: '#,##0.00' },
    { header: fr ? '% du budget' : '% del preventivo', key: 'pc', width: 17, fmt: '0.0%' },
    { header: fr ? 'Reste EUR' : 'Residuo EUR', key: 'r', width: 16, fmt: '#,##0.00' },
  ]);
  ws.spliceRows(1, 0, [], [], [], [], [], [], [], [], [], []);
  ws.views = [{ state: 'frozen', ySplit: 11 }];
  const info: [string, string | number][] = [
    [fr ? 'Financement' : 'Finanziamento', `${g.title}${g.code ? ` (${g.code})` : ''}`],
    [fr ? 'Bailleur' : 'Finanziatore', donor || '–'],
    [fr ? 'Projet' : 'Progetto', project || '–'],
    [fr ? 'Durée du financement' : 'Durata del finanziamento', `${day(g.start_date)} – ${day(g.end_date)}`],
    [fr ? 'Période du rapport' : 'Periodo del rendiconto', `${day(from)} – ${day(to)}`],
    [fr ? `Montant accordé (${g.currency})` : `Importo concesso (${g.currency})`, g.amount ? Number(g.amount) : '–'],
    [fr ? 'Reçu sur la période EUR' : 'Ricevuto nel periodo EUR', sum(inc)],
    [fr ? 'Dépensé sur la période EUR' : 'Speso nel periodo EUR', sum(exp)],
  ];
  info.forEach(([k, v], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = k; row.getCell(1).font = { bold: true, color: { argb: 'FF16324F' } };
    row.getCell(2).value = v; row.getCell(2).alignment = { horizontal: 'left' };
    if (typeof v === 'number') row.getCell(2).numFmt = '#,##0.00';
  });
  const bud = new Map<string, number>();
  for (const b of budget ?? []) bud.set(b.group_id, (bud.get(b.group_id) ?? 0) + Number(b.amount_eur));
  const per = new Map<string, number>(); const cum = new Map<string, number>();
  for (const m of exp) { const k = m.cat?.group_id ?? '-'; per.set(k, (per.get(k) ?? 0) + eur(m)); }
  for (const m of allExp ?? []) {
    const k = (m.category as unknown as { group_id: string | null } | null)?.group_id ?? '-';
    cum.set(k, (cum.get(k) ?? 0) + eur(m as { amount_eur: string | number | null; sign: number }));
  }
  const keys = [...(groups ?? []).map((x) => x.id), '-'].filter((k) => bud.has(k) || per.has(k) || cum.has(k));
  let tb = 0, tp = 0, tc = 0;
  for (const k of keys) {
    const b = bud.get(k) ?? 0, p = per.get(k) ?? 0, c = cum.get(k) ?? 0;
    tb += b; tp += p; tc += c;
    ws.addRow({ g: k === '-' ? (fr ? 'Sans code' : 'Senza codice') : gname.get(k) ?? k, b: b || null, p, c,
      pc: b ? c / b : null, r: b ? b - c : null });
  }
  const tr = ws.addRow({ g: fr ? 'Total' : 'Totale', b: tb || null, p: tp, c: tc, pc: tb ? tc / tb : null, r: tb ? tb - tc : null });
  tr.font = { bold: true }; tr.eachCell((c) => { c.fill = SECT; });
  ws.addRow({});
  const nd = exp.filter((m) => m.docs.length === 0).length;
  const nv = rows.filter((m) => m.status !== 'verified').length;
  const notes = [
    fr ? 'Montants en EUR au taux enregistré sur chaque mouvement; les extournes sont déduites.'
      : 'Importi in EUR al tasso registrato su ciascun movimento; gli storni sono sottratti.',
    nv ? (fr ? `${nv} mouvement(s) pas encore vérifié(s) : voir la colonne Statut.` : `${nv} movimento/i non ancora verificato/i: vedi la colonna Stato.`) : '',
    nd ? (fr ? `${nd} dépense(s) sans pièce justificative jointe : voir la colonne Justificatifs.` : `${nd} spesa/e senza giustificativo allegato: vedi la colonna Giustificativi.`) : '',
    fr ? 'Document préparé par YouCount : à contrôler avant l’envoi au bailleur.' : 'Documento preparato da YouCount: da controllare prima dell’invio al finanziatore.',
  ].filter(Boolean);
  for (const n of notes) ws.addRow({ g: n }).font = { color: { argb: 'FF5E6B7C' } };

  // ---- spese ed entrate
  const detail = (name: string, list: typeof rows, withDocs: boolean) => {
    const d = sheet(wb, name, [
      { header: 'N.', key: 'n', width: 5 }, { header: fr ? 'Réf.' : 'Rif.', key: 'ref', width: 14 },
      { header: fr ? 'Date (caisse)' : 'Data (cassa)', key: 'date', width: 12, fmt: 'dd/mm/yyyy' },
      { header: fr ? 'Date du document' : 'Data documento', key: 'dd', width: 13, fmt: 'dd/mm/yyyy' },
      { header: fr ? 'Description' : 'Descrizione', key: 'desc', width: 38 }, { header: fr ? 'Tiers' : 'Controparte', key: 'cp', width: 22 },
      { header: fr ? 'Code' : 'Codice', key: 'code', width: 8 }, { header: fr ? 'Libellé' : 'Voce', key: 'cn', width: 30 },
      ...(withDocs ? [{ header: fr ? 'Groupe' : 'Gruppo', key: 'grp', width: 26 }] : []),
      { header: fr ? 'Devise' : 'Valuta', key: 'cur', width: 7 }, { header: fr ? 'Montant' : 'Importo', key: 'amt', width: 15, fmt: '#,##0.00' },
      { header: fr ? 'Taux' : 'Tasso', key: 'rate', width: 9, fmt: '#,##0' }, { header: fr ? 'Montant EUR' : 'Importo EUR', key: 'eur', width: 14, fmt: '#,##0.00' },
      { header: fr ? 'Statut' : 'Stato', key: 'st', width: 13 },
      ...(withDocs ? [{ header: fr ? 'Justificatifs' : 'Giustificativi', key: 'docs', width: 44 }] : []),
    ]);
    list.forEach((m, i) => {
      const files = m.docs.map((x) => x.document?.file_name || x.document?.doc_number).filter(Boolean).join(' · ');
      d.addRow({
        n: i + 1, ref: m.ref ?? '', date: new Date(m.op_date), dd: m.doc_date ? new Date(m.doc_date) : null,
        desc: m.description + (m.sign < 0 ? (fr ? ' (extourne)' : ' (storno)') : ''),
        cp: (m.counterparty as unknown as { name: string } | null)?.name ?? '', code: m.cat?.code ?? '', cn: L(m.cat),
        grp: m.cat?.group_id ? gname.get(m.cat.group_id) ?? '' : '', cur: m.currency, amt: Number(m.amount) * m.sign,
        rate: m.fx_rate ? Number(m.fx_rate) : null, eur: eur(m), st: S[m.status as keyof typeof S] ?? m.status,
        docs: files || (m.no_doc_reason ? `${fr ? 'manquant' : 'manca'}: ${m.no_doc_reason}` : fr ? 'aucun' : 'nessuno'),
      });
    });
    const t = d.addRow({ desc: fr ? 'Total' : 'Totale', eur: sum(list) });
    t.font = { bold: true };
    d.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: d.columnCount } };
  };
  detail(fr ? 'Dépenses' : 'Spese', exp, true);
  detail(fr ? 'Recettes' : 'Entrate', inc, false);
  // stampa: orizzontale, tutte le colonne in una pagina di larghezza
  for (const w of wb.worksheets) w.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  const slug = (g.code || g.title).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'finanziamento';
  return { file: `${fr ? 'rapport' : 'rendiconto'}-${slug}-${from ?? 'inizio'}_${to ?? 'oggi'}.xlsx` };
}
