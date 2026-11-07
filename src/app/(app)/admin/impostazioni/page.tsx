import { ADMIN, can, requireMe } from '@/lib/session';
import { Denied, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const { supabase, me, t } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data } = await supabase.from('settings').select('key, value');
  const v = (k: string) => (data ?? []).find((s) => s.key === k)?.value;
  const rows = [
    { label: t('set_four_eyes'), on: v('four_eyes') !== false },
    { label: t('set_require_doc'), on: v('require_document') !== false },
  ];
  return (
    <div className="stack">
      <PageHead title={t('nav_settings')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <Panel>
        <table className="t">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="r"><span className={`chip ${r.on ? 'ok' : 'warn'}`}>{r.on ? t('yes') : t('no')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
