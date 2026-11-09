import { ADMIN, can, requireMe, type Role } from '@/lib/session';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { CIcon } from '@/components/CIcon';
import { Ico } from '@/components/Ui';
import { deleteUser, inviteUser, sendReset, setActive, setProjects, setRole } from '../actions';

export const dynamic = 'force-dynamic';

type U = { id: string; full_name: string; role: Role; active: boolean; email: string | null };
const ROLES: Role[] = ['super_admin', 'admin', 'responsabile', 'operator', 'read_only'];

export default async function Users({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data, error }, { data: projects }, { data: members }, { data: profs }] = await Promise.all([
    supabase.rpc('user_directory'),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('project_members').select('user_id, project_id'),
    supabase.from('profiles').select('id, all_projects, deleted_at'),
  ]);
  const rows = (data ?? []) as U[];
  const allP = new Map((profs ?? []).map((p) => [p.id, p.all_projects]));
  const gone = new Set((profs ?? []).filter((p) => p.deleted_at).map((p) => p.id));
  rows.sort((a, b) => Number(gone.has(a.id)) - Number(gone.has(b.id)));
  const roleOpts = ROLES.filter((r) => r !== 'super_admin' || me!.role === 'super_admin');
  const errText = err === 'inv_nokey' ? t('inv_nokey') : err;
  return (
    <div className="stack">
      <PageHead title={t('nav_users')} />
      {ok && <div className="note ok" role="status">{ok === 'user_deleted' ? (lang === 'fr' ? 'Utilisateur supprimé.' : 'Utente eliminato.')
        : ok === 'user_disabled' ? (lang === 'fr' ? 'Accès supprimé : le nom reste dans l\'historique des données qu\'il a saisies.' : 'Accesso eliminato: il nome resta nello storico dei dati che ha inserito.') : t('u_saved')}</div>}
      {errText && <div className="note err">{errText}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel title={t('inv_title')} pad>
        <form action={inviteUser} className="fgrid" style={{ alignItems: 'end' }}>
          <div className="field"><label htmlFor="inv-email">{t('email')}</label><input className="input" id="inv-email" name="email" type="email" required /></div>
          <div className="field"><label htmlFor="inv-name">{t('name')}</label><input className="input" id="inv-name" name="full_name" required /></div>
          <div className="field"><label htmlFor="inv-role">{t('role')}</label>
            <select className="input" id="inv-role" name="role" defaultValue="operator">
              {roleOpts.filter((r) => r !== 'super_admin').map((r) => <option key={r} value={r}>{t(`r_${r}`)}</option>)}
            </select></div>
          <div><button className="btn primary" type="submit"><Ico name="plus" />{t('inv_send')}</button></div>
        </form>
      </Panel>
      {/* un utente per riga: nome ed email, ruolo, stato e azioni sulla stessa linea; il dettaglio si apre sotto, a tutta larghezza */}
      <Panel>
        <div className="ulist-h" aria-hidden="true"><span>{t('name')}</span><span>{t('role')}</span><span>{t('status')}</span><span /></div>
        <ul className="ulist">
          {rows.map((u) => {
            const self = u.id === me!.id;
            const deleted = gone.has(u.id);
            const locked = self || deleted || (u.role === 'super_admin' && me!.role !== 'super_admin');
            const mine = new Set((members ?? []).filter((m) => m.user_id === u.id).map((m) => m.project_id));
            return (
              <li key={u.id}>
                <details className="urow">
                  <summary>
                    <span className="u-who"><CIcon name="user" size={16} /><span><b>{u.full_name || '–'}{self && <small className="muted"> · {lang === 'fr' ? 'vous' : 'tu'}</small>}</b><small>{u.email ?? '–'}</small></span></span>
                    <span className="u-role">{t(`r_${u.role}`)}</span>
                    <span>{deleted ? <span className="chip">{lang === 'fr' ? 'Supprimé' : 'Eliminato'}</span>
                      : <span className={`chip ${u.active ? 'ok' : 'warn'}`}>{u.active ? t('active') : t('suspended')}</span>}</span>
                    <span className="u-act">{locked ? <span className="muted small">–</span> : <span className="btn small ghost">{t('edit')}</span>}</span>
                  </summary>
                  {!locked && (
                    <div className="u-body">
                      <div className="u-col">
                        <form action={setRole} className="u-line">
                          <input type="hidden" name="id" value={u.id} />
                          <label className="field"><span>{t('role')}</span>
                            <select className="input" name="role" defaultValue={u.role}>
                              {roleOpts.map((r) => <option key={r} value={r}>{t(`r_${r}`)}</option>)}
                            </select></label>
                          <button className="btn" type="submit">{t('save')}</button>
                        </form>
                        <div className="u-line">
                          <form action={setActive}>
                            <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.active ? 'false' : 'true'} />
                            <button className="btn" type="submit">{u.active ? t('u_suspend') : t('u_reactivate')}</button>
                          </form>
                          {u.email && (
                            <form action={sendReset}><input type="hidden" name="email" value={u.email} />
                              <button className="btn" type="submit">{t('u_reset')}</button></form>
                          )}
                        </div>
                      </div>
                      {u.role === 'operator' && (
                        <form action={setProjects} className="u-col u-prj">
                          <input type="hidden" name="id" value={u.id} />
                          <b className="u-t">{t('u_projects')}</b>
                          <label className="check u-all"><input type="checkbox" name="all" defaultChecked={allP.get(u.id)} /> {t('u_all_projects')}</label>
                          <div className="u-grid">
                            {(projects ?? []).map((p) => (
                              <label key={p.id} className="check"><input type="checkbox" name="project" value={p.id} defaultChecked={mine.has(p.id)} /> {p.name}</label>
                            ))}
                          </div>
                          <div><button className="btn primary" type="submit">{t('save')}</button></div>
                        </form>
                      )}
                      {me!.role === 'super_admin' && u.role !== 'super_admin' && (
                        <details className="danger-zone u-del">
                          <summary className="btn ghost">{lang === 'fr' ? 'Supprimer l\'utilisateur…' : 'Elimina l\'utente…'}</summary>
                          <form action={deleteUser} className="stack" style={{ gap: 8, marginTop: 10 }}>
                            <input type="hidden" name="id" value={u.id} />
                            <p className="muted" style={{ margin: 0 }}>{lang === 'fr'
                              ? 'Sans données saisies, l\'utilisateur est supprimé. S\'il a saisi des données, son nom reste dans l\'historique mais l\'accès est supprimé (plus d\'email ni de mot de passe).'
                              : 'Se non ha inserito dati, l\'utente viene eliminato. Se ne ha inseriti, il suo nome resta nello storico ma l\'accesso viene eliminato (niente più email né password).'}</p>
                            <label className="field"><span>{lang === 'fr' ? 'Motif' : 'Motivo'}</span>
                              <input className="input" name="reason" required minLength={5} maxLength={300} /></label>
                            <label className="field"><span>{lang === 'fr' ? 'Votre mot de passe' : 'La tua password'}</span>
                              <input className="input" name="password" type="password" required autoComplete="current-password" /></label>
                            <label className="check"><input type="checkbox" name="confirm" required /> {lang === 'fr' ? `Je supprime ${u.full_name || u.email}` : `Elimino ${u.full_name || u.email}`}</label>
                            <div><button className="btn danger" type="submit">{lang === 'fr' ? 'Supprimer' : 'Elimina'}</button></div>
                          </form>
                        </details>
                      )}
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
