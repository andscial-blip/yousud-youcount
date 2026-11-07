import { ADMIN, can, requireMe } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { Denied, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

// Ultimi 18 mesi con lo stato di chiusura. Chiusura e riapertura dall'interfaccia: tappa 4e.
export default async function Periods() {
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data: periods }, { data: users }] = await Promise.all([
    supabase.from('periods').select('year, month, closed_at, closed_by'),
    supabase.rpc('user_directory'),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const now = new Date();
  const months = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'long', year: 'numeric' });
  return (
    <div className="stack">
      <PageHead title={t('nav_periods')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <Panel>
        <table className="t">
          <thead><tr><th>{t('period')}</th><th>{t('status')}</th><th>{t('closed_at')}</th><th>{t('closed_by')}</th></tr></thead>
          <tbody>
            {months.map(({ y, m }) => {
              const p = (periods ?? []).find((x) => x.year === y && x.month === m);
              const closed = Boolean(p?.closed_at);
              return (
                <tr key={`${y}-${m}`}>
                  <td>{fmt.format(new Date(y, m - 1, 1))}</td>
                  <td><span className={`chip ${closed ? 'ok' : ''}`}>{closed ? t('closed') : t('open')}</span></td>
                  <td className="num">{closed ? dateTime(p!.closed_at, lang) : '–'}</td>
                  <td>{closed ? name.get(p!.closed_by) ?? '–' : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
