import Link from 'next/link';
import { ADMIN, can, requireMe } from '@/lib/session';
import { FilterBar } from '@/components/FilterBar';
import { dateTime } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type A = { id: number; at: string; table_name: string; action: 'insert' | 'update' | 'delete'; actor: string | null;
           row_id: string | null; new_row: Record<string, unknown> | null; old_row: Record<string, unknown> | null };

const TABLE: Record<string, [string, string]> = {
  movements: ['Movimenti', 'Mouvements'], documents: ['Documenti', 'Documents'], movement_documents: ['Collegamenti documenti', 'Liens documents'],
  accounts: ['Conti', 'Comptes'], categories: ['Categorie', 'Catégories'], projects: ['Progetti', 'Projets'],
  profiles: ['Utenti', 'Utilisateurs'], periods: ['Chiusure', 'Clôtures'], settings: ['Impostazioni', 'Paramètres'],
  counterparties: ['Fornitori e donatori', 'Fournisseurs et donateurs'], counterparty_private: ['Dati personali controparti', 'Données personnelles'],
  project_members: ['Accessi ai progetti', 'Accès aux projets'], grants: ['Finanziamenti', 'Financements'],
  budget_lines: ['Budget', 'Budget'], cash_counts: ['Conte di cassa', 'Comptages de caisse'], fx_rates: ['Tassi di cambio', 'Taux de change'],
  organizations: ['Ente', 'Organisation'], report_lines: ['Righe del rendiconto', 'Lignes du compte de caisse'],
  category_groups: ['Gruppi di codici', 'Groupes de codes'], payment_methods: ['Modalità di pagamento', 'Moyens de paiement'],
  bank_reconciliations: ['Riconciliazioni bancarie', 'Rapprochements bancaires'],
  budget_items: ['Righe del preventivo', 'Lignes du budget'], budgets: ['Preventivi', 'Budgets'], issued_docs: ['Documenti emessi', 'Documents émis'],
  deadlines: ['Scadenze', 'Échéances'], advance_requests: ['Richieste di anticipo', 'Demandes d’avance'], self_certs: ['Autocertificazioni', 'Attestations'],
  budget_amendments: ['Modifiche al preventivo', 'Modifications du budget'], counterparty_logos: ['Loghi dei finanziatori', 'Logos des bailleurs'],
  api_clients: ['Collegamenti con altre app', 'Liens avec d’autres apps'], statement_archive: ['Rendiconti archiviati', 'Comptes rendus archivés'],
};
// campi mostrati nel dettaglio «prima → dopo», con il nome che l'utente conosce (gli altri si contano soltanto)
const FIELD: Record<string, [string, string]> = {
  amount: ['Importo', 'Montant'], currency: ['Valuta', 'Devise'], status: ['Stato', 'Statut'], description: ['Descrizione', 'Description'], op_date: ['Data', 'Date'],
  notes: ['Note', 'Notes'], fx_rate: ['Tasso', 'Taux'], rate: ['Tasso', 'Taux'], name: ['Nome', 'Nom'], name_it: ['Nome', 'Nom'], title: ['Titolo', 'Titre'],
  role: ['Ruolo', 'Rôle'], active: ['Attivo', 'Actif'], closed_at: ['Chiuso il', 'Clôturé le'], reopen_reason: ['Motivo della riapertura', 'Motif de la réouverture'],
  verified_at: ['Verificato il', 'Vérifié le'], recorded_at: ['Registrato il', 'Comptabilisé le'], ref: ['Numero', 'Numéro'], no_doc_reason: ['Motivo senza documento', 'Motif sans pièce'],
  reversal_reason: ['Motivo dello storno', 'Motif de l’extourne'], due_date: ['Scadenza', 'Échéance'], qty: ['Quantità', 'Quantité'], unit_cost: ['Costo unitario', 'Coût unitaire'],
  start_date: ['Inizio', 'Début'], end_date: ['Fine', 'Fin'], paid_by: ['Pagato da', 'Payé par'], reimb_status: ['Rimborso', 'Remboursement'], value: ['Valore', 'Valeur'],
};
const PER = 50;

export default async function Audit({ searchParams }: { searchParams: Promise<{ tab?: string; chi?: string; q?: string; p?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in TABLE ? sp.tab : '';
  const who = /^[0-9a-f-]{36}$/.test(sp.chi ?? '') ? sp.chi! : sp.chi === 'sistema' ? 'sistema' : '';
  const term = (sp.q ?? '').trim().slice(0, 60).toLowerCase();
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  let q = supabase.from('audit_log').select('id, at, table_name, action, actor, row_id, new_row, old_row')
    .order('at', { ascending: false });
  const page = Math.max(1, Number(sp.p) || 1);
  // 50 righe per volta (prima 300 in una pagina: quasi 48.000 px su telefono); con la ricerca si filtra tra le ultime 1.000
  q = term ? q.limit(1000) : q.range((page - 1) * PER, page * PER);
  if (tab) q = q.eq('table_name', tab);
  if (who === 'sistema') q = q.is('actor', null); else if (who) q = q.eq('actor', who);
  const [{ data: raw, error }, { data: users }] = await Promise.all([
    q.returns<A[]>(),
    supabase.rpc('user_directory'),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const what = (a: A) => {
    const r = (a.new_row ?? a.old_row ?? {}) as Record<string, unknown>;
    if (a.table_name === 'fx_rates' && r.month) return `${String(r.month).padStart(2, '0')}/${r.year} · ${r.rate}`;
    if (a.table_name === 'bank_reconciliations' && r.statement_date) return String(r.statement_date).split('-').reverse().join('/');
    if (a.table_name === 'periods' && r.month) return `${String(r.month).padStart(2, '0')}/${r.year}${r.closed_at ? '' : r.reopen_reason ? ` · ${lang === 'fr' ? 'rouvert' : 'riaperto'}: ${r.reopen_reason}` : ''}`;
    return String(r.ref ?? r.number ?? r.title ?? r.name ?? r.name_it ?? r.file_name ?? r.code ?? r.full_name ?? r.key ?? r.description ?? '');
  };
  // dettaglio di una modifica: i campi cambiati, prima → dopo
  const show = (v: unknown) => v === null || v === undefined || v === '' ? '–' : typeof v === 'boolean' ? (v ? (lang === 'fr' ? 'oui' : 'sì') : 'no')
    : typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? dateTime(String(v), lang) : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v).split('-').reverse().join('/') : String(v).slice(0, 120);
  const changes = (a: A) => {
    if (a.action !== 'update' || !a.old_row || !a.new_row) return { rows: [] as [string, string, string][], more: 0 };
    const keys = Object.keys(a.new_row).filter((k) => JSON.stringify(a.new_row![k]) !== JSON.stringify(a.old_row![k]) && !['updated_at', 'version', 'updated_by', 'last_op_uuid'].includes(k));
    const known = keys.filter((k) => FIELD[k]);
    return { rows: known.map((k) => [FIELD[k]![lang === 'fr' ? 1 : 0], show(a.old_row![k]), show(a.new_row![k])] as [string, string, string]), more: keys.length - known.length };
  };
  const all = (raw ?? []).filter((a) => !term || what(a).toLowerCase().includes(term));
  const hasNext = !term && all.length > PER;
  const data = all.slice(0, term ? 300 : PER);
  const pg = (n: number) => `/admin/registro?${new URLSearchParams({ ...(tab ? { tab } : {}), ...(who ? { chi: who } : {}), p: String(n) })}`;
  const L = lang === 'fr' ? 1 : 0;
  return (
    <div className="stack">
      <PageHead title={t('nav_audit')} />
      <FilterBar className="bare" action="/admin/registro" lang={lang} search={{ value: sp.q ?? '', placeholder: t('search_audit') }}
        active={(tab ? 1 : 0) + (who ? 1 : 0)} reset={tab || who || term ? '/admin/registro' : null}>
        <label className="field"><span className="flabel">{t('audit_table')}</span>
          <select className="input" name="tab" defaultValue={tab}><option value="">{t('all')}</option>
            {Object.entries(TABLE).sort((x, y) => x[1][L].localeCompare(y[1][L])).map(([k, v]) => <option key={k} value={k}>{v[L]}</option>)}</select></label>
        <label className="field"><span className="flabel">{t('audit_who')}</span>
          <select className="input" name="chi" defaultValue={who}><option value="">{t('all')}</option>
            <option value="sistema">{t('audit_system')}</option>
            {((users ?? []) as { id: string; full_name: string }[]).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
      </FilterBar>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {data.length === 0 ? <Empty text={tab || who || term ? t('empty_search_generic') : t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('audit_when')} ({lang === 'fr' ? 'heure de Madagascar' : 'ora del Madagascar'})</th><th>{t('audit_who')}</th><th>{t('audit_table')}</th>
              <th>{t('audit_what')}</th><th /></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="num">{dateTime(a.at, lang)}</td>
                  <td>{a.actor ? name.get(a.actor) ?? '–' : (lang === 'fr' ? 'système' : 'sistema')}</td>
                  <td>{TABLE[a.table_name]?.[lang === 'fr' ? 1 : 0] ?? a.table_name}</td>
                  <td>{(() => { const c = changes(a); return c.rows.length === 0 ? (what(a) || '–') : (
                    <details className="au-d"><summary>{what(a) || '–'}</summary>
                      <ul>{c.rows.map(([l, o, n]) => <li key={l}><b>{l}</b>: {o} → {n}</li>)}
                        {c.more > 0 && <li className="muted">{lang === 'fr' ? `et ${c.more} autres champs techniques` : `e altri ${c.more} campi tecnici`}</li>}</ul></details>); })()}</td>
                  <td><span className="chip">{t(`a_${a.action}`)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!term && (page > 1 || hasNext) && (
          <nav className="pager panel-f" aria-label={t('f_pages')}>
            {page > 1 ? <Link className="btn" href={pg(page - 1)} rel="prev">← {t('f_prev')}</Link> : <span />}
            <span className="muted num">{page}</span>
            {hasNext ? <Link className="btn" href={pg(page + 1)} rel="next">{t('f_next')} →</Link> : <span />}
          </nav>
        )}
      </Panel>
    </div>
  );
}
