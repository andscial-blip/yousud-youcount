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
};

export default async function Audit({ searchParams }: { searchParams: Promise<{ tab?: string; chi?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in TABLE ? sp.tab : '';
  const who = /^[0-9a-f-]{36}$/.test(sp.chi ?? '') ? sp.chi! : sp.chi === 'sistema' ? 'sistema' : '';
  const term = (sp.q ?? '').trim().slice(0, 60).toLowerCase();
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  let q = supabase.from('audit_log').select('id, at, table_name, action, actor, row_id, new_row, old_row')
    .order('at', { ascending: false }).limit(term ? 1000 : 300);
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
    return String(r.ref ?? r.title ?? r.name ?? r.name_it ?? r.file_name ?? r.code ?? r.full_name ?? r.key ?? '');
  };
  const data = (raw ?? []).filter((a) => !term || what(a).toLowerCase().includes(term)).slice(0, 300);
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
            <thead><tr><th>{t('audit_when')} (MG)</th><th>{t('audit_who')}</th><th>{t('audit_table')}</th>
              <th>{t('audit_what')}</th><th /></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="num">{dateTime(a.at, lang)}</td>
                  <td>{a.actor ? name.get(a.actor) ?? '–' : (lang === 'fr' ? 'système' : 'sistema')}</td>
                  <td>{TABLE[a.table_name]?.[lang === 'fr' ? 1 : 0] ?? a.table_name}</td>
                  <td>{what(a) || '–'}</td>
                  <td><span className="chip">{t(`a_${a.action}`)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
