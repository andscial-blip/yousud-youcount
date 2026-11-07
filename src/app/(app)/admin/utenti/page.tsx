import { ADMIN, can, requireMe, type Role } from '@/lib/session';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { inviteUser, sendReset, setActive, setProjects, setRole } from '../actions';

export const dynamic = 'force-dynamic';

type U = { id: string; full_name: string; role: Role; active: boolean; email: string | null };
const ROLES: Role[] = ['super_admin', 'admin', 'responsabile', 'operator', 'read_only'];

export default async function Users({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data, error }, { data: projects }, { data: members }, { data: profs }] = await Promise.all([
    supabase.rpc('user_directory'),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('project_members').select('user_id, project_id'),
    supabase.from('profiles').select('id, all_projects'),
  ]);
  const rows = (data ?? []) as U[];
  const allP = new Map((profs ?? []).map((p) => [p.id, p.all_projects]));
  const roleOpts = ROLES.filter((r) => r !== 'super_admin' || me!.role === 'super_admin');
  const errText = err === 'inv_nokey' ? t('inv_nokey') : err;
  return (
    <div className="stack">
      <PageHead title={t('nav_users')} />
      {ok && <div className="note ok" role="status">{t('u_saved')}</div>}
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
      <Panel>
        <table className="t">
          <thead><tr><th>{t('name')}</th><th className="hm">{t('email')}</th><th>{t('role')}</th><th>{t('status')}</th><th /></tr></thead>
          <tbody>
            {rows.map((u) => {
              const self = u.id === me!.id;
              const locked = self || (u.role === 'super_admin' && me!.role !== 'super_admin');
              const mine = new Set((members ?? []).filter((m) => m.user_id === u.id).map((m) => m.project_id));
              return (
                <tr key={u.id}>
                  <td>{u.full_name || '–'}</td>
                  <td className="hm">{u.email ?? '–'}</td>
                  <td>
                    {locked ? t(`r_${u.role}`) : (
                      <form action={setRole} style={{ display: 'flex', gap: 6 }}>
                        <input type="hidden" name="id" value={u.id} />
                        <select className="input" name="role" defaultValue={u.role} aria-label={t('role')} style={{ minWidth: 150 }}>
                          {roleOpts.map((r) => <option key={r} value={r}>{t(`r_${r}`)}</option>)}
                        </select>
                        <button className="btn" type="submit">{t('save')}</button>
                      </form>
                    )}
                  </td>
                  <td><span className={`chip ${u.active ? 'ok' : 'warn'}`}>{u.active ? t('active') : t('suspended')}</span></td>
                  <td>
                    {!locked && (
                      <details>
                        <summary className="btn ghost">{t('edit')}</summary>
                        <div className="stack" style={{ gap: 10, padding: '10px 0', minWidth: 260 }}>
                          <form action={setActive}>
                            <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.active ? 'false' : 'true'} />
                            <button className="btn" type="submit">{u.active ? t('u_suspend') : t('u_reactivate')}</button>
                          </form>
                          {u.email && (
                            <form action={sendReset}><input type="hidden" name="email" value={u.email} />
                              <button className="btn" type="submit">{t('u_reset')}</button></form>
                          )}
                          {u.role === 'operator' && (
                            <form action={setProjects} className="stack" style={{ gap: 6 }}>
                              <input type="hidden" name="id" value={u.id} />
                              <b style={{ fontFamily: 'var(--f-ui)' }}>{t('u_projects')}</b>
                              <label className="check"><input type="checkbox" name="all" defaultChecked={allP.get(u.id)} /> {t('u_all_projects')}</label>
                              {(projects ?? []).map((p) => (
                                <label key={p.id} className="check" style={{ fontWeight: 400 }}>
                                  <input type="checkbox" name="project" value={p.id} defaultChecked={mine.has(p.id)} /> {p.name}
                                </label>
                              ))}
                              <div><button className="btn primary" type="submit">{t('save')}</button></div>
                            </form>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
