import { ADMIN, can, requireMe } from '@/lib/session';
import { date } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { EditRow, F, Flash, Hidden, SaveBar } from '@/components/Admin';
import { saveRow } from '../actions';

export const dynamic = 'force-dynamic';

type P = { id: string; name: string; code: string | null; kind: string; active: boolean; start_date: string | null;
           end_date: string | null; legacy_name: string | null };

export default async function AdminProjects({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data, error } = await supabase.from('projects')
    .select('id, name, code, kind, active, start_date, end_date, legacy_name').order('kind').order('name').returns<P[]>();
  const fields = (p?: P) => (<>
    <F label={t('name')}><input className="input" name="name" defaultValue={p?.name} required maxLength={120} /></F>
    <F label={t('code')}><input className="input" name="code" defaultValue={p?.code ?? ''} maxLength={40} /></F>
    <F label={t('type')}>
      <select className="input" name="kind" defaultValue={p?.kind ?? 'project'}>
        <option value="project">{t('project')}</option><option value="structure">{t('prj_structure')}</option>
      </select></F>
    <span />
    <F label={t('start_date')}><input className="input" type="date" name="start_date" defaultValue={p?.start_date ?? ''} /></F>
    <F label={t('end_date')}><input className="input" type="date" name="end_date" defaultValue={p?.end_date ?? ''} /></F>
  </>);
  return (
    <div className="stack">
      <PageHead title={t('nav_admin_projects')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <Flash ok={ok} err={err} okText={t('saved')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : data!.map((p) => (
          <EditRow key={p.id} inactive={!p.active} summary={<>
            <b className="grow">{p.name}</b>
            {p.kind === 'structure' && <span className="chip">{t('prj_structure')}</span>}
            <span className="muted num">{p.start_date ? `${date(p.start_date)} – ${date(p.end_date)}` : ''}</span>
            {!p.active && <span className="chip">{t('inactive')}</span>}
          </>}>
            <form action={saveRow} className="fgrid">
              <Hidden v={{ _table: 'projects', id: p.id }} />
              {fields(p)}
              <label className="check"><input type="checkbox" name="active" defaultChecked={p.active} /> {t('active')}</label>
              {p.legacy_name && <p className="hint span2" style={{ margin: 0 }}>Gestionale: {p.legacy_name}</p>}
              <SaveBar label={t('save')} />
            </form>
          </EditRow>
        ))}
      </Panel>
      <Panel title={t('p_new')} pad>
        <form action={saveRow} className="fgrid">
          <Hidden v={{ _table: 'projects', active: 'true' }} />
          {fields()}
          <SaveBar label={t('add')} />
        </form>
      </Panel>
    </div>
  );
}
