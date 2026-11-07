import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { money } from '@/lib/format';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type L = { project_id: string | null; kind: string; amount_eur: string | null };

export default async function Projects({ searchParams }: { searchParams: Promise<{ anno?: string }> }) {
  const { anno } = await searchParams;
  const year = Number(anno) || new Date().getFullYear();
  const { supabase, t, lang } = await requireMe();
  const [{ data: projects, error }, { data: ledger }] = await Promise.all([
    supabase.from('projects').select('id, name, kind, active').order('kind').order('name'),
    supabase.from('v_ledger').select('project_id, kind, amount_eur').eq('year', year).neq('kind', 'transfer').limit(20000).returns<L[]>(),
  ]);
  const agg = new Map<string, { out: number; inc: number; n: number }>();
  for (const l of ledger ?? []) {
    const k = l.project_id ?? '-';
    const a = agg.get(k) ?? { out: 0, inc: 0, n: 0 };
    if (l.kind === 'expense') a.out += Number(l.amount_eur ?? 0); else a.inc += Number(l.amount_eur ?? 0);
    a.n += 1;
    agg.set(k, a);
  }
  return (
    <div className="stack">
      <PageHead title={`${t('nav_projects')} ${year}`}>
        <div className="seg">
          <Link href={`/progetti?anno=${year - 1}`}>{year - 1}</Link>
          <Link href={`/progetti?anno=${year}`} aria-current="true">{year}</Link>
          <Link href={`/progetti?anno=${year + 1}`}>{year + 1}</Link>
        </div>
      </PageHead>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(projects ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('project')}</th><th className="r">{t('prj_spent')}</th><th className="r">{t('prj_income')}</th>
              <th className="r">{t('prj_moves')}</th></tr></thead>
            <tbody>
              {projects!.map((p) => {
                const a = agg.get(p.id) ?? { out: 0, inc: 0, n: 0 };
                return (
                  <tr key={p.id} style={p.active ? undefined : { opacity: .6 }}>
                    <td><Link className="rowlink" href={`/progetti/${p.id}?anno=${year}`}>{p.name}</Link> {p.kind === 'structure' && <span className="chip">{t('prj_structure')}</span>}</td>
                    <td className="r num">{a.out ? money(a.out, 'EUR', lang) : '–'}</td>
                    <td className="r num">{a.inc ? money(a.inc, 'EUR', lang) : '–'}</td>
                    <td className="r num">{a.n || '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      <p className="muted" style={{ margin: 0 }}>{t('prj_note')}</p>
    </div>
  );
}
