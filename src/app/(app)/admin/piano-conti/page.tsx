import Link from 'next/link';
import { ADMIN, can, requireMe } from '@/lib/session';
import { nm } from '@/lib/format';
import { Denied, ErrorNote, PageHead, Panel, SearchBox } from '@/components/Page';
import { EditRow, F, Flash, Hidden, SaveBar } from '@/components/Admin';
import { saveRow } from '../actions';

export const dynamic = 'force-dynamic';

type C = { id: string; code: string; name_it: string; name_fr: string; report_line_key: string | null; active: boolean;
           group_id: string; group: { code: string; name_it: string; name_fr: string } | null };
type G = { id: string; code: string; name_it: string; name_fr: string };
type RL = { key: string; section_it: string; name_it: string; name_fr: string };

// Il piano dei conti è quello del Gestionale (versione codici 2): qui si correggono nomi, riga del rendiconto
// e stato. Il codice di una voce esistente non si cambia.
export default async function Chart({ searchParams }: { searchParams: Promise<{ dir?: string; ok?: string; err?: string; q?: string }> }) {
  const { dir: d, ok, err, q: q0 = '' } = await searchParams;
  const term = q0.trim().slice(0, 60).toLowerCase();
  const dir = d === 'in' ? 'in' : 'out';
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data, error }, { data: groupsList }, { data: lines }] = await Promise.all([
    supabase.from('categories')
      .select('id, code, name_it, name_fr, report_line_key, active, group_id, group:category_groups(code, name_it, name_fr)')
      .eq('direction', dir).order('sort').returns<C[]>(),
    supabase.from('category_groups').select('id, code, name_it, name_fr').eq('direction', dir).order('sort').returns<G[]>(),
    supabase.from('report_lines').select('key, section_it, name_it, name_fr').eq('direction', dir).order('sort').returns<RL[]>(),
  ]);
  const groups = Object.values((data ?? []).filter((c) => !term || [c.code, c.name_it, c.name_fr, c.group?.name_it].some((x) => x?.toLowerCase().includes(term)))
    .reduce<Record<string, C[]>>((acc, c) => {
    (acc[c.group?.code ?? '-'] ||= []).push(c);
    return acc;
  }, {}));
  const back = `/admin/piano-conti?dir=${dir}`;
  const rlSelect = (v: string | null) => (
    <select className="input" name="report_line_key" defaultValue={v ?? ''}>
      <option value="">{t('to_classify')}</option>
      {(lines ?? []).map((l) => <option key={l.key} value={l.key}>{l.key} · {nm(lang, l)}</option>)}
    </select>
  );
  return (
    <div className="stack">
      <PageHead title={t('nav_chart')}>
        <div className="seg">
          <Link href="/admin/piano-conti?dir=out" aria-current={(dir === 'out') ? 'true' : undefined}>{t('out')}</Link>
          <Link href="/admin/piano-conti?dir=in" aria-current={(dir === 'in') ? 'true' : undefined}>{t('in')}</Link>
        </div>
      </PageHead>
      <p className="muted" style={{ margin: 0 }}>{lang === 'fr' ? 'Plan comptable, pour l’expert-comptable.' : 'Piano dei conti, per il commercialista.'} {t('admin_readonly')}</p>
      <SearchBox action="/admin/piano-conti" value={q0} placeholder={t('search_chart')} clearLabel={t('search_clear')} hidden={{ dir }} />
      {term && groups.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('empty_search_generic')}</p>}
      <Flash ok={ok} err={err} okText={t('saved')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      {groups.map((g) => (
        <Panel key={g[0].group?.code} title={`${g[0].group?.code} · ${nm(lang, g[0].group)}`}>
          {g.map((c) => (
            <EditRow key={c.id} inactive={!c.active} summary={<>
              <span className="num" style={{ width: 52 }}>{c.code}</span>
              <span className="grow">{nm(lang, c)}</span>
              {c.group?.code === 'E9' ? <span className="chip">{t('out_report')}</span> : c.report_line_key ? <span className="chip">{c.report_line_key}</span> : <span className="chip warn">{t('to_classify')}</span>}
              {!c.active && <span className="chip">{t('inactive')}</span>}
            </>}>
              <form action={saveRow} className="fgrid">
                <Hidden v={{ _table: 'categories', id: c.id, _back: back }} />
                <F label={t('name_it_l')}><input className="input" name="name_it" defaultValue={c.name_it} required /></F>
                <F label={t('name_fr_l')}><input className="input" name="name_fr" defaultValue={c.name_fr} /></F>
                <F label={t('rl')}>{rlSelect(c.report_line_key)}</F>
                <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="active" defaultChecked={c.active} /> {t('active')}</label>
                <p className="hint span2" style={{ margin: 0 }}>{t('retro_warn')}</p>
                <SaveBar label={t('save')} />
              </form>
            </EditRow>
          ))}
        </Panel>
      ))}
      <Panel title={t('c_new')} pad>
        <form action={saveRow} className="fgrid">
          <Hidden v={{ _table: 'categories', direction: dir, active: 'true', _back: back }} />
          <F label={t('code')}><input className="input" name="code" required maxLength={10} /></F>
          <F label={t('group')}>
            <select className="input" name="group_id" required>
              {(groupsList ?? []).map((g) => <option key={g.id} value={g.id}>{g.code} · {nm(lang, g)}</option>)}
            </select></F>
          <F label={t('name_it_l')}><input className="input" name="name_it" required /></F>
          <F label={t('name_fr_l')}><input className="input" name="name_fr" /></F>
          <F label={t('rl')}>{rlSelect(null)}</F>
          <SaveBar label={t('add')} />
        </form>
      </Panel>
    </div>
  );
}
