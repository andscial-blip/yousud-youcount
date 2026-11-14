import 'server-only';
import type { createClient } from './supabase/server';

// Report contabili: una sola funzione per tipo costruisce la tabella, usata dalla pagina e dall'esportazione Excel,
// così i numeri a schermo e nel file sono gli stessi. Solo movimenti registrati e verificati, salvo dove detto.
type Sb = Awaited<ReturnType<typeof createClient>>;
export type Cell = { v: number | string | null; t?: 'eur' | 'int' | 'date' | 'text' | 'cur'; cur?: string; href?: string };
// Grafico facoltativo accanto alla tabella (stessi numeri): mesi affiancati o barre orizzontali delle voci principali.
export type Chart = { kind: 'months'; data: { inc: number; out: number }[]; hrefs?: string[] }
  | { kind: 'bars'; dir: 'in' | 'out'; rows: { label: string; value: number; href?: string }[]; more: number; total: number };
export type Table = { title: string; head: { h: string; num?: boolean }[]; rows: Cell[][]; foot?: Cell[]; note?: string; chart?: Chart };
const TOP = 8;
const bars = (dir: 'in' | 'out', rows: { label: string; value: number; href?: string }[], other: string): Chart | undefined => {
  const r = rows.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  // le percentuali si calcolano sul totale di TUTTE le voci (non solo le otto mostrate): le voci restanti stanno in una riga a parte
  const total = r.reduce((x, y) => x + y.value, 0), rest = r.slice(TOP);
  const shown = rest.length ? [...r.slice(0, TOP), { label: `${other} (${rest.length})`, value: rest.reduce((x, y) => x + y.value, 0) }] : r;
  return r.length ? { kind: 'bars', dir, rows: shown, more: 0, total } : undefined;
};
export type ReportKind = 'mensile' | 'categorie' | 'fornitori' | 'utenti' | 'nodoc' | 'cassa' | 'scadenze';
export const REPORTS: { k: ReportKind; it: string; fr: string }[] = [
  { k: 'mensile', it: 'Mensile Italia / Madagascar', fr: 'Mensuel Italie / Madagascar' },
  { k: 'categorie', it: 'Per codice contabile', fr: 'Par code comptable' },
  { k: 'fornitori', it: 'Per fornitore e donatore', fr: 'Par fournisseur et donateur' },
  { k: 'utenti', it: 'Per utente', fr: 'Par utilisateur' },
  { k: 'nodoc', it: 'Senza giustificativo', fr: 'Sans justificatif' },
  { k: 'cassa', it: 'Cassa, banche e anticipi', fr: 'Caisse, banques et avances' },
  { k: 'scadenze', it: 'Scadenziario', fr: 'Échéancier' },
];

const MONTHS = { it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] };
const eur = (v: number): Cell => ({ v: Math.round(v * 100) / 100, t: 'eur' });
const int = (v: number): Cell => ({ v, t: 'int' });
const txt = (v: string | null | undefined, href?: string): Cell => ({ v: v ?? '', t: 'text', href });

type Led = { id: string; kind: string; amount_eur: string | null; account_id: string | null; category_id: string | null; category_code: string | null;
  counterparty_id: string | null; month: number; out_of_report: boolean | null };

async function ledger(sb: Sb, year: number) {
  const { data, error } = await sb.from('v_ledger')
    .select('id, kind, amount_eur, account_id, category_id, category_code, counterparty_id, month, out_of_report')
    .eq('year', year).neq('kind', 'transfer').limit(50000).returns<Led[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buildReport(sb: Sb, kind: ReportKind, year: number, lang: 'it' | 'fr'): Promise<Table[]> {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const nm = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);

  if (kind === 'mensile' || kind === 'categorie') {
    const [led, { data: accs }, { data: cats }] = await Promise.all([
      ledger(sb, year),
      sb.from('accounts').select('id, location'),
      sb.from('categories').select('id, code, name_it, name_fr, direction, sort').order('sort'),
    ]);
    const loc = new Map((accs ?? []).map((a) => [a.id, a.location as string]));
    const L2 = (l: Led) => (l.account_id ? loc.get(l.account_id) ?? 'IT' : 'IT');
    if (kind === 'mensile') {
      const z = () => ({ iIT: 0, iMG: 0, oIT: 0, oMG: 0 });
      const by = Array.from({ length: 12 }, z);
      for (const l of led) {
        const v = Number(l.amount_eur ?? 0), r = by[l.month - 1], mg = L2(l) === 'MG';
        if (l.kind === 'income') { if (mg) r.iMG += v; else r.iIT += v; } else if (mg) r.oMG += v; else r.oIT += v;
      }
      const tot = by.reduce((a, r) => ({ iIT: a.iIT + r.iIT, iMG: a.iMG + r.iMG, oIT: a.oIT + r.oIT, oMG: a.oMG + r.oMG }), z());
      const row = (r: ReturnType<typeof z>) => [eur(r.iIT), eur(r.iMG), eur(r.oIT), eur(r.oMG), eur(r.iIT + r.iMG - r.oIT - r.oMG)];
      return [{
        title: `${L('Entrate e uscite per mese', 'Recettes et dépenses par mois')} ${year}`,
        head: [{ h: L('Mese', 'Mois') }, { h: L('Entrate Italia', 'Recettes Italie'), num: true }, { h: L('Entrate Madagascar', 'Recettes Madagascar'), num: true },
          { h: L('Uscite Italia', 'Dépenses Italie'), num: true }, { h: L('Uscite Madagascar', 'Dépenses Madagascar'), num: true }, { h: L('Saldo del mese', 'Solde du mois'), num: true }],
        rows: by.map((r, i) => [txt(MONTHS[lang][i], `/movimenti?dal=${year}-${String(i + 1).padStart(2, '0')}-01&al=${year}-${String(i + 1).padStart(2, '0')}-${String(new Date(year, i + 1, 0).getDate()).padStart(2, '0')}`), ...row(r)]),
        foot: [txt(L('Totale', 'Total')), ...row(tot)],
        chart: { kind: 'months', data: by.map((r) => ({ inc: r.iIT + r.iMG, out: r.oIT + r.oMG })) },
        note: L('Il paese è quello del conto del movimento. In euro al cambio di ciascun movimento.', 'Le pays est celui du compte du mouvement. En euros au taux de chaque mouvement.'),
      }];
    }
    const by = new Map<string, { IT: number; MG: number; n: number }>();
    for (const l of led) {
      if (!l.category_id) continue;
      const r = by.get(l.category_id) ?? { IT: 0, MG: 0, n: 0 };
      r[L2(l) === 'MG' ? 'MG' : 'IT'] += Number(l.amount_eur ?? 0); r.n += 1; by.set(l.category_id, r);
    }
    const tables: Table[] = [];
    for (const d of ['in', 'out'] as const) {
      const cs = (cats ?? []).filter((c) => c.direction === d && by.has(c.id));
      const tot = cs.reduce((a, c) => { const r = by.get(c.id)!; return { IT: a.IT + r.IT, MG: a.MG + r.MG, n: a.n + r.n }; }, { IT: 0, MG: 0, n: 0 });
      tables.push({
        title: d === 'in' ? L('Entrate per codice', 'Recettes par code') : L('Uscite per codice', 'Dépenses par code'),
        head: [{ h: L('Codice', 'Code') }, { h: L('Voce', 'Poste') }, { h: 'Italia', num: true }, { h: 'Madagascar', num: true }, { h: L('Totale', 'Total'), num: true }, { h: L('Movimenti', 'Mouvements'), num: true }],
        rows: cs.map((c) => { const r = by.get(c.id)!; return [txt(c.code, `/movimenti?dal=${year}-01-01&al=${year}-12-31&codice=${c.id}`), txt(nm(c)), eur(r.IT), eur(r.MG), eur(r.IT + r.MG), int(r.n)]; }),
        foot: [txt(L('Totale', 'Total')), txt(''), eur(tot.IT), eur(tot.MG), eur(tot.IT + tot.MG), int(tot.n)],
        chart: bars(d, cs.map((c) => { const r = by.get(c.id)!; return { label: `${c.code} · ${nm(c)}`, value: r.IT + r.MG, href: `/movimenti?dal=${year}-01-01&al=${year}-12-31&codice=${c.id}` }; }), L('Altre voci', 'Autres postes')),
      });
    }
    return tables;
  }

  if (kind === 'fornitori') {
    const [led, { data: cps }] = await Promise.all([ledger(sb, year), sb.from('counterparties').select('id, name, kind')]);
    const cpn = new Map((cps ?? []).map((c) => [c.id, c.name as string]));
    const by = new Map<string, { o: number; i: number; n: number }>();
    for (const l of led) {
      const k = l.counterparty_id ?? '';
      const r = by.get(k) ?? { o: 0, i: 0, n: 0 };
      if (l.kind === 'income') r.i += Number(l.amount_eur ?? 0); else r.o += Number(l.amount_eur ?? 0);
      r.n += 1; by.set(k, r);
    }
    const list = [...by.entries()].sort((a, b) => b[1].o + b[1].i - (a[1].o + a[1].i));
    const tot = list.reduce((a, [, r]) => ({ o: a.o + r.o, i: a.i + r.i, n: a.n + r.n }), { o: 0, i: 0, n: 0 });
    return [{
      title: `${L('Fornitori e donatori', 'Fournisseurs et donateurs')} ${year}`,
      head: [{ h: L('Controparte', 'Contrepartie') }, { h: L('Uscite', 'Dépenses'), num: true }, { h: L('Entrate', 'Recettes'), num: true }, { h: L('Movimenti', 'Mouvements'), num: true }],
      rows: list.map(([k, r]) => [txt(k ? cpn.get(k) ?? '–' : L('(senza controparte)', '(sans contrepartie)')), eur(r.o), eur(r.i), int(r.n)]),
      foot: [txt(L('Totale', 'Total')), eur(tot.o), eur(tot.i), int(tot.n)],
      chart: bars('out', list.map(([k, r]) => ({ label: k ? (cpn.get(k) ?? '–') : L('(senza controparte)', '(sans tiers)'), value: r.o })), L('Altre voci', 'Autres postes')),
    }];
  }

  if (kind === 'utenti') {
    const [{ data: mv, error }, { data: users }] = await Promise.all([
      sb.from('movements').select('created_by, status, kind, amount_eur, sign').gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`).limit(50000),
      sb.rpc('user_directory'),
    ]);
    if (error) throw new Error(error.message);
    const un = new Map(((users ?? []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u.full_name ?? '–']));
    const by = new Map<string, { n: number; d: number; r: number; v: number; e: number }>();
    for (const m of mv ?? []) {
      const r = by.get(m.created_by) ?? { n: 0, d: 0, r: 0, v: 0, e: 0 };
      r.n += 1; if (m.status === 'draft') r.d += 1; else if (m.status === 'recorded') r.r += 1; else r.v += 1;
      if (m.kind === 'expense' && m.status !== 'draft') r.e += Number(m.amount_eur ?? 0) * m.sign;
      by.set(m.created_by, r);
    }
    return [{
      title: `${L('Registrazioni per utente', 'Saisies par utilisateur')} ${year}`,
      head: [{ h: L('Utente', 'Utilisateur') }, { h: L('Movimenti', 'Mouvements'), num: true }, { h: L('Bozze', 'Brouillons'), num: true },
        { h: L('Da verificare', 'À vérifier'), num: true }, { h: L('Verificati', 'Vérifiés'), num: true }, { h: L('Spese registrate', 'Dépenses saisies'), num: true }],
      rows: [...by.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, r]) => [txt(un.get(k) ?? '–'), int(r.n), int(r.d), int(r.r), int(r.v), eur(r.e)]),
    }];
  }

  if (kind === 'nodoc') {
    const { data, error } = await sb.from('movements')
      .select('id, ref, op_date, kind, description, amount, currency, amount_eur, sign, no_doc_reason, status, docs:movement_documents(count), category:categories(code), project:projects(name)')
      .gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`).neq('kind', 'transfer').neq('status', 'draft')
      .is('reverses_id', null).order('op_date').limit(5000);
    if (error) throw new Error(error.message);
    type R = { id: string; ref: string | null; op_date: string; kind: string; description: string | null; amount: string; currency: string;
      amount_eur: string | null; sign: number; no_doc_reason: string | null; docs: { count: number }[]; category: { code: string } | null; project: { name: string } | null };
    const list = ((data ?? []) as unknown as R[]).filter((m) => !(m.docs?.[0]?.count > 0));
    return [{
      title: `${L('Movimenti senza giustificativo', 'Mouvements sans justificatif')} ${year} · ${list.length}`,
      head: [{ h: L('Data', 'Date') }, { h: L('Rif.', 'Réf.') }, { h: L('Descrizione', 'Description') }, { h: L('Codice', 'Code') }, { h: L('Progetto', 'Projet') },
        { h: L('Importo', 'Montant'), num: true }, { h: 'EUR', num: true }, { h: L('Motivo indicato', 'Motif indiqué') }],
      rows: list.map((m) => [{ v: m.op_date, t: 'date' }, txt(m.ref, `/movimenti/${m.id}`), txt(m.description), txt(m.category?.code), txt(m.project?.name),
        { v: Number(m.amount) * m.sign, t: 'cur', cur: m.currency }, eur(Number(m.amount_eur ?? 0) * m.sign), txt(m.no_doc_reason ?? L('nessuno', 'aucun'))]),
      note: L('Per ogni spesa senza scontrino o fattura si può generare l\'autocertificazione dal dettaglio del movimento.',
        'Pour chaque dépense sans ticket ni facture, l\'attestation se génère depuis le détail du mouvement.'),
    }];
  }

  if (kind === 'cassa') {
    const at = `${year}-12-31` < new Date().toISOString().slice(0, 10) ? `${year}-12-31` : new Date().toISOString().slice(0, 10);
    const [{ data: bal, error }, { data: adv }, { data: counts }] = await Promise.all([
      sb.rpc('account_balances', { p_at: at }),
      sb.rpc('advance_summary', { p_at: at }),
      sb.from('cash_counts').select('account_id, count_date, counted, difference').order('count_date', { ascending: false }).limit(200),
    ]);
    if (error) throw new Error(error.message);
    type B = { account_id: string; name_it: string; name_fr: string | null; currency: string; kind: string; location: string; balance: string; unverified: number };
    type A = { holder: string; currency: string; given: string; spent: string; returned: string; balance: string; open_since: string | null };
    const lastCount = new Map<string, { d: string; diff: string }>();
    for (const c of counts ?? []) if (!lastCount.has(c.account_id)) lastCount.set(c.account_id, { d: c.count_date, diff: c.difference });
    const accs = ((bal ?? []) as B[]).filter((b) => b.kind !== 'advance');
    return [{
      title: `${L('Saldi al', 'Soldes au')} ${at.split('-').reverse().join('/')}`,
      head: [{ h: L('Conto', 'Compte') }, { h: L('Paese', 'Pays') }, { h: L('Saldo', 'Solde'), num: true }, { h: L('Da verificare', 'À vérifier'), num: true },
        { h: L('Ultima verifica di cassa', 'Dernier contrôle de caisse') }, { h: L('Differenza', 'Écart'), num: true }],
      rows: accs.map((b) => { const c = lastCount.get(b.account_id); return [txt(nm(b)), txt(b.location), { v: Number(b.balance), t: 'cur', cur: b.currency }, int(b.unverified),
        c ? { v: c.d, t: 'date' } : txt('–'), c ? { v: Number(c.diff), t: 'cur', cur: b.currency } : txt('')]; }),
    }, {
      title: L('Anticipi al personale', 'Avances au personnel'),
      head: [{ h: L('Persona', 'Personne') }, { h: L('Consegnato', 'Remis'), num: true }, { h: L('Speso', 'Dépensé'), num: true }, { h: L('Restituito', 'Restitué'), num: true },
        { h: L('Da giustificare', 'À justifier'), num: true }, { h: L('Aperto dal', 'Ouvert depuis') }],
      rows: ((adv ?? []) as A[]).map((a) => [txt(a.holder), { v: Number(a.given), t: 'cur', cur: a.currency }, { v: Number(a.spent), t: 'cur', cur: a.currency },
        { v: Number(a.returned), t: 'cur', cur: a.currency }, { v: Number(a.balance), t: 'cur', cur: a.currency }, a.open_since && Number(a.balance) > 0 ? { v: a.open_since, t: 'date' } : txt('–')]),
    }];
  }

  // scadenze: quelle salvate dell'anno (gli adempimenti dell'app si vedono nella pagina Scadenze)
  const { data, error } = await sb.from('deadlines').select('title, category, due_date, amount, currency, status, priority, notes, project:projects(name)')
    .gte('due_date', `${year}-01-01`).lte('due_date', `${year}-12-31`).order('due_date');
  if (error) throw new Error(error.message);
  const CAT: Record<string, [string, string]> = { pay: ['Pagamento', 'Paiement'], inc: ['Incasso', 'Encaissement'], ets: ['RUNTS / ETS', 'RUNTS / ETS'], fisc: ['Fiscale', 'Fiscal'],
    int: ['Interna', 'Interne'], prj: ['Progetti', 'Projets'], doc: ['Documenti', 'Documents'], altro: ['Altro', 'Autre'] };
  const ST: Record<string, [string, string]> = { open: ['Aperta', 'Ouverte'], done: ['Fatta', 'Faite'], cancelled: ['Annullata', 'Annulée'] };
  type D = { title: string; category: string; due_date: string; amount: string | null; currency: string | null; status: string; priority: string; notes: string | null; project: { name: string } | null };
  return [{
    title: `${L('Scadenze', 'Échéances')} ${year}`,
    head: [{ h: L('Data', 'Date') }, { h: L('Scadenza', 'Échéance') }, { h: L('Tipo', 'Type') }, { h: L('Progetto', 'Projet') }, { h: L('Importo', 'Montant'), num: true }, { h: L('Stato', 'Statut') }],
    rows: ((data ?? []) as unknown as D[]).map((d) => [{ v: d.due_date, t: 'date' }, txt(d.title), txt(L(...(CAT[d.category] ?? CAT.altro))), txt(d.project?.name),
      d.amount ? { v: Number(d.amount), t: 'cur', cur: d.currency ?? 'EUR' } : txt(''), txt(L(...(ST[d.status] ?? ST.open)))]),
  }];
}
