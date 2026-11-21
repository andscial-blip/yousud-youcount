import { loadProjectColors, ITEM_PAL } from '@/lib/palette';
import { ProjectIcon } from '@/components/ProjectIcon';
import { THEMES } from '@/lib/project-theme';
import { ADMIN, can, requireMe } from '@/lib/session';
import { date } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { EditRow, F, Flash, Hidden, SaveBar } from '@/components/Admin';
import { saveRow } from '../actions';

export const dynamic = 'force-dynamic';

type P = { id: string; name: string; code: string | null; kind: string; theme: string | null; active: boolean; start_date: string | null;
           end_date: string | null; legacy_name: string | null };

export default async function AdminProjects({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data, error }, prjColors] = await Promise.all([supabase.from('projects')
    .select('*').order('kind').order('name').returns<P[]>(), loadProjectColors(supabase)]);
  // il colore si sceglie solo se la colonna esiste (migrazione project_color applicata): prima il modulo non lo invia
  const hasColor = (data ?? []).some((p) => 'color' in (p as object));
  const used = new Set(prjColors.values());
  const freeColor = ITEM_PAL.find((c) => !used.has(c)) ?? ITEM_PAL[0];
  const fields = (p?: P) => (<>
    <F label={t('name')}><input className="input" name="name" defaultValue={p?.name} required maxLength={120} /></F>
    <F label={t('code')}><input className="input" name="code" defaultValue={p?.code ?? ''} maxLength={40} /></F>
    <F label={t('type')}>
      <select className="input" name="kind" defaultValue={p?.kind ?? 'project'}>
        <option value="project">{t('project')}</option><option value="structure">{t('prj_structure')}</option>
      </select></F>
    <F label={lang === 'fr' ? 'Type d\'activité (icône)' : 'Tipo di attività (icona)'}>
      <select className="input" name="theme" defaultValue={p?.theme ?? ''}>
        <option value="">{lang === 'fr' ? 'Déduit du nom' : 'Dedotto dal nome'}</option>
        {(Object.keys(THEMES) as (keyof typeof THEMES)[]).filter((k) => k !== 'structure').map((k) => <option key={k} value={k}>{lang === 'fr' ? THEMES[k].fr : THEMES[k].it}</option>)}
      </select></F>
    {hasColor && <fieldset className="span2 swatches">
      <legend>{lang === 'fr' ? 'Couleur du projet dans les graphiques' : 'Colore del progetto nei grafici'}</legend>
      {ITEM_PAL.map((c) => {
        const cur = p ? prjColors.get(p.id) : freeColor;
        const others = [...prjColors.entries()].filter(([id, v]) => v === c && id !== p?.id).length;
        return (<label key={c} className="sw" title={c}>
          <input type="radio" name="color" value={c} defaultChecked={cur === c} required />
          <i className="sw-dot" style={{ background: c }} aria-hidden="true" />
          <span className="sr-only">{c}{others ? (lang === 'fr' ? ' (déjà utilisée)' : ' (già usato)') : ''}</span>
          {others > 0 && <i className="sw-used" aria-hidden="true" />}
        </label>);
      })}
      <p className="hint" style={{ margin: 0 }}>{lang === 'fr' ? 'Le point indique une couleur déjà utilisée par un autre projet : mieux vaut en choisir une libre.' : 'Il punto indica un colore già usato da un altro progetto: meglio sceglierne uno libero.'}</p>
    </fieldset>}
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
            <ProjectIcon p={p} size={28} color={prjColors.get(p.id)} />
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
