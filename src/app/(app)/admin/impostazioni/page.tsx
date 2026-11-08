import { ADMIN, can, requireMe } from '@/lib/session';
import type { Key } from '@/lib/i18n';
import { Denied, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { toggleSetting } from './actions';

export const dynamic = 'force-dynamic';

const ROWS: { key: string; label: Key; def: boolean }[] = [
  { key: 'four_eyes', label: 'set_four_eyes', def: true },
  { key: 'require_document', label: 'set_require_doc', def: true },
  { key: 'ai_reading', label: 'set_ai_reading', def: false },
];

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data } = await supabase.from('settings').select('key, value');
  const val = (k: string, def: boolean) => {
    const v = (data ?? []).find((s) => s.key === k)?.value;
    return v === undefined || v === null ? def : v === true;
  };
  const lastBackup = (data ?? []).find((s) => s.key === 'last_backup')?.value as { at?: string; by?: string } | undefined;
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <PageHead title={t('nav_settings')} />
      {ok && <div className="note ok" role="status">✓</div>}
      {err && <div className="note err">{err}</div>}
      <Panel>
        <table className="t">
          <tbody>
            {ROWS.map((r) => {
              const on = val(r.key, r.def);
              return (
                <tr key={r.key}>
                  <td>{t(r.label)}</td>
                  <td className="r nw">
                    <form action={toggleSetting} className="seg">
                      <input type="hidden" name="key" value={r.key} />
                      <button name="value" value="true" aria-pressed={on}>{t('yes')}</button>
                      <button name="value" value="false" aria-pressed={!on}>{t('no')}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
      <Panel title={t('bk_title')}>
        <div className="panel-b stack" style={{ gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>{t('bk_text')}</p>
          {lastBackup?.at && <p style={{ margin: 0 }}>{t('bk_last')}: <b>{new Date(lastBackup.at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</b> · {lastBackup.by}</p>}
          <div><a className="btn primary" href="/api/v1/backup"><Ico name="download" />{t('bk_btn')}</a></div>
        </div>
      </Panel>
    </div>
  );
}
