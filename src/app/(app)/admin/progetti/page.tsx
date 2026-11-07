import { ADMIN, can, requireMe } from '@/lib/session';
import { date } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

export default async function AdminProjects() {
  const { supabase, me, t } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data, error } = await supabase.from('projects')
    .select('id, name, kind, active, start_date, end_date, legacy_name').order('kind').order('name');
  return (
    <div className="stack">
      <PageHead title={t('nav_admin_projects')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('name')}</th><th>{t('type')}</th><th>{t('date')}</th><th>Gestionale</th><th>{t('status')}</th></tr></thead>
            <tbody>
              {data!.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.kind === 'structure' ? <span className="chip">{t('prj_structure')}</span> : t('project')}</td>
                  <td className="num">{p.start_date ? `${date(p.start_date)} – ${date(p.end_date)}` : '–'}</td>
                  <td className="muted">{p.legacy_name ?? '–'}</td>
                  <td><span className={`chip ${p.active ? 'ok' : ''}`}>{p.active ? t('active') : '–'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
