import ExcelJS from 'exceljs';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normLang } from '@/lib/i18n';

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
  const { data: me } = await supabase.from('profiles').select('lang, active').eq('id', auth.user.id).maybeSingle();
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
