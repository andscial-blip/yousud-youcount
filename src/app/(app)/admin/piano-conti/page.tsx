import Link from 'next/link';
import { ADMIN, can, requireMe } from '@/lib/session';
import { nm } from '@/lib/format';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type C = { id: string; code: string; name_it: string; name_fr: string; report_line_key: string | null; active: boolean;
           group: { code: string; name_it: string; name_fr: string } | null };

export default async function Chart({ searchParams }: { searchParams: Promise<{ dir?: string }> }) {
  const { dir: d } = await searchParams;
  const dir = d === 'in' ? 'in' : 'out';
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data, error } = await supabase.from('categories')
    .select('id, code, name_it, name_fr, report_line_key, active, group:category_groups(code, name_it, name_fr)')
    .eq('direction', dir).order('sort').returns<C[]>();
  const groups = Object.values((data ?? []).reduce<Record<string, C[]>>((acc, c) => {
    (acc[c.group?.code ?? '-'] ||= []).push(c);
    return acc;
  }, {}));
  return (
    <div className="stack">
      <PageHead title={t('nav_chart')}>
        <div className="seg">
          <Link href="/admin/piano-conti?dir=out" aria-pressed={dir === 'out'}>{t('out')}</Link>
          <Link href="/admin/piano-conti?dir=in" aria-pressed={dir === 'in'}>{t('in')}</Link>
        </div>
      </PageHead>
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <ErrorNote prefix={t('error_load')} error={error} />
      {groups.map((g) => (
        <Panel key={g[0].group?.code} title={`${g[0].group?.code} · ${nm(lang, g[0].group)}`}>
          <table className="t">
            <thead><tr><th style={{ width: 80 }}>{t('code')}</th><th>{t('name')}</th><th style={{ width: 160 }}>{t('rl')}</th></tr></thead>
            <tbody>
              {g.map((c) => (
                <tr key={c.id} style={c.active ? undefined : { opacity: .6 }}>
                  <td className="num">{c.code}</td><td>{nm(lang, c)}</td>
                  <td>{c.report_line_key ?? <span className="chip warn">{t('to_classify')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
    </div>
  );
}
