import { ADMIN, can, requireMe, type Role } from '@/lib/session';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type U = { id: string; full_name: string; role: Role; active: boolean; email: string | null };

export default async function Users() {
  const { supabase, me, t } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data, error } = await supabase.rpc('user_directory');
  const rows = (data ?? []) as U[];
  return (
    <div className="stack">
      <PageHead title={t('nav_users')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {rows.length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('status')}</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || '–'}</td><td>{u.email ?? '–'}</td><td>{t(`r_${u.role}`)}</td>
                  <td><span className={`chip ${u.active ? 'ok' : 'warn'}`}>{u.active ? t('active') : t('suspended')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
