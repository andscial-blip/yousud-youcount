import { ADMIN, can, requireMe } from '@/lib/session';
import type { Key } from '@/lib/i18n';
import { Denied, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { saveDocDetails, toggleSetting } from './actions';
import { ApiKeys } from '@/components/ApiKeys';

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
  const [{ data }, { data: keys }] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('api_clients').select('id, name, key_prefix, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }),
  ]);
  const val = (k: string, def: boolean) => {
    const v = (data ?? []).find((s) => s.key === k)?.value;
    return v === undefined || v === null ? def : v === true;
  };
  const orgDet = ((data ?? []).find((s) => s.key === 'org_details')?.value ?? {}) as { address?: string; tax_id?: string; iban?: string };
  const signer = ((data ?? []).find((s) => s.key === 'doc_signer')?.value ?? {}) as { name?: string; role?: string };
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
      <Panel title={t('doc_title')} pad>
        <p className="muted" style={{ marginTop: 0 }}>{t('doc_text')}</p>
        <form action={saveDocDetails} className="fgrid">
          <div className="field span2"><label htmlFor="d-addr">{t('doc_address')}</label>
            <input className="input" id="d-addr" name="address" maxLength={300} defaultValue={orgDet.address ?? ''} /></div>
          <div className="field"><label htmlFor="d-tax">{t('doc_tax')}</label>
            <input className="input" id="d-tax" name="tax_id" maxLength={40} defaultValue={orgDet.tax_id ?? ''} /></div>
          <div className="field"><label htmlFor="d-iban">IBAN</label>
            <input className="input num" id="d-iban" name="iban" maxLength={40} defaultValue={orgDet.iban ?? ''} /></div>
          <div className="field"><label htmlFor="d-sig">{t('doc_signer')}</label>
            <input className="input" id="d-sig" name="signer" maxLength={120} defaultValue={signer.name ?? ''} /></div>
          <div className="field"><label htmlFor="d-sigr">{t('doc_signer_role')}</label>
            <input className="input" id="d-sigr" name="signer_role" maxLength={120} defaultValue={signer.role ?? ''} /></div>
          <div className="span2"><button className="btn primary" type="submit">{t('save')}</button></div>
        </form>
      </Panel>
      <Panel title={t('bk_title')}>
        <div className="panel-b stack" style={{ gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>{t('bk_text')}</p>
          {lastBackup?.at && <p style={{ margin: 0 }}>{t('bk_last')}: <b>{new Date(lastBackup.at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</b> · {lastBackup.by}</p>}
          <div><a className="btn primary" href="/api/v1/backup"><Ico name="download" />{t('bk_btn')}</a></div>
        </div>
      </Panel>
      <Panel title={t('api_title')}>
        <p className="panel-b muted" style={{ margin: 0, paddingBottom: 0 }}>{t('api_text')}</p>
        <ApiKeys rows={keys ?? []} lang={lang} labels={{ name: t('api_name'), create: t('api_create'), shown: t('api_shown'), copy: t('api_copy'),
          revoke: t('api_revoke'), revoked: t('api_revoked'), never: t('api_never'), last: t('api_last'), created: t('api_created'),
          none: t('api_none'), prefix: t('api_prefix') }} />
      </Panel>
    </div>
  );
}
