import { ADMIN, can, requireMe } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type A = { id: number; at: string; table_name: string; action: 'insert' | 'update' | 'delete'; actor: string | null;
           row_id: string | null; new_row: Record<string, unknown> | null; old_row: Record<string, unknown> | null };

const TABLE: Record<string, [string, string]> = {
  movements: ['Movimenti', 'Mouvements'], documents: ['Documenti', 'Documents'], movement_documents: ['Collegamenti documenti', 'Liens documents'],
  accounts: ['Conti', 'Comptes'], categories: ['Piano dei conti', 'Plan comptable'], projects: ['Progetti', 'Projets'],
  profiles: ['Utenti', 'Utilisateurs'], periods: ['Chiusure', 'Clôtures'], settings: ['Impostazioni', 'Paramètres'],
  counterparties: ['Fornitori e donatori', 'Fournisseurs et donateurs'], counterparty_private: ['Dati personali controparti', 'Données personnelles'],
  project_members: ['Accessi ai progetti', 'Accès aux projets'],
};

export default async function Audit() {
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data, error }, { data: users }] = await Promise.all([
    supabase.from('audit_log').select('id, at, table_name, action, actor, row_id, new_row, old_row')
      .order('at', { ascending: false }).limit(200).returns<A[]>(),
    supabase.rpc('user_directory'),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const what = (a: A) => {
    const r = (a.new_row ?? a.old_row ?? {}) as Record<string, unknown>;
    return String(r.ref ?? r.name ?? r.code ?? r.full_name ?? r.key ?? '');
  };
  return (
    <div className="stack">
      <PageHead title={t('nav_audit')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('audit_when')} (MG)</th><th>{t('audit_who')}</th><th>{t('audit_table')}</th>
              <th>{t('audit_what')}</th><th /></tr></thead>
            <tbody>
              {data!.map((a) => (
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
