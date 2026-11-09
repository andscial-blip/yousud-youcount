import { ADMIN, can, requireMe } from '@/lib/session';
import type { Key } from '@/lib/i18n';
import { Denied, PageHead, Panel } from '@/components/Page';
import { removeLogo, saveLogo, saveDocDetails, toggleSetting } from './actions';
import { LogoUpload } from '@/components/LogoUpload';
import { LOGO_MAX } from '@/lib/org';

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
  const orgDet = ((data ?? []).find((s) => s.key === 'org_details')?.value ?? {}) as { legal_name?: string; address?: string; tax_id?: string; iban?: string; runts?: string; email?: string; phone?: string; web?: string };
  const signer = ((data ?? []).find((s) => s.key === 'doc_signer')?.value ?? {}) as { name?: string; role?: string };
  const lg = ((data ?? []).find((s) => s.key === 'org_logo')?.value ?? {}) as { mime?: string; data?: string };
  const logoUrl = lg.mime && lg.data ? `data:${lg.mime};base64,${lg.data}` : null;
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <PageHead title={t('nav_settings')} />
      {ok && <div className="note ok" role="status">{ok === 'demo_loaded' ? (lang === 'fr' ? 'Données de démonstration chargées.' : 'Dati dimostrativi caricati.')
        : ok === 'demo_purged' ? (lang === 'fr' ? 'Données de démonstration supprimées.' : 'Dati dimostrativi eliminati.')
        : ok === 'reset' ? (lang === 'fr' ? 'Comptabilité remise à zéro : mouvements et budgets supprimés. La numérotation repart de 001.' : 'Contabilità azzerata: movimenti e preventivi eliminati. La numerazione riparte da 001.') : '✓'}</div>}
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
          <div className="field span2"><label htmlFor="d-ln">{lang === 'fr' ? 'Dénomination légale (comme au RUNTS)' : 'Denominazione legale (come nel RUNTS)'}</label>
            <input className="input" id="d-ln" name="legal_name" maxLength={120} placeholder="YOUSUD ODV" defaultValue={orgDet.legal_name ?? ''} /></div>
          <div className="field span2"><label htmlFor="d-addr">{t('doc_address')}</label>
            <input className="input" id="d-addr" name="address" maxLength={300} defaultValue={orgDet.address ?? ''} /></div>
          <div className="field"><label htmlFor="d-tax">{t('doc_tax')}</label>
            <input className="input" id="d-tax" name="tax_id" maxLength={40} defaultValue={orgDet.tax_id ?? ''} /></div>
          <div className="field"><label htmlFor="d-iban">IBAN</label>
            <input className="input num" id="d-iban" name="iban" maxLength={40} defaultValue={orgDet.iban ?? ''} /></div>
          <div className="field span2"><label htmlFor="d-runts">{lang === 'fr' ? 'Inscription au registre (pied de page)' : 'Iscrizione al registro (piè di pagina)'}</label>
            <input className="input" id="d-runts" name="runts" maxLength={200} defaultValue={orgDet.runts ?? ''} /></div>
          <div className="field"><label htmlFor="d-mail">Email</label>
            <input className="input" id="d-mail" name="email" type="email" maxLength={120} defaultValue={orgDet.email ?? ''} /></div>
          <div className="field"><label htmlFor="d-tel">{lang === 'fr' ? 'Téléphone' : 'Telefono'}</label>
            <input className="input" id="d-tel" name="phone" maxLength={40} defaultValue={orgDet.phone ?? ''} /></div>
          <div className="field"><label htmlFor="d-web">{lang === 'fr' ? 'Site web' : 'Sito web'}</label>
            <input className="input" id="d-web" name="web" maxLength={120} defaultValue={orgDet.web ?? ''} /></div>
          <div className="field"><label htmlFor="d-sig">{t('doc_signer')}</label>
            <input className="input" id="d-sig" name="signer" maxLength={120} defaultValue={signer.name ?? ''} /></div>
          <div className="field"><label htmlFor="d-sigr">{t('doc_signer_role')}</label>
            <input className="input" id="d-sigr" name="signer_role" maxLength={120} defaultValue={signer.role ?? ''} /></div>
          <div className="span2"><button className="btn primary" type="submit">{t('save')}</button></div>
        </form>
        <h3 style={{ margin: '18px 0 8px' }}>{t('logo_title')}</h3>
        <LogoUpload current={logoUrl} action={saveLogo} removeAction={removeLogo} max={LOGO_MAX}
          labels={{ pick: t('logo_pick'), hint: t('logo_hint'), save: t('logo_save'), remove: t('logo_remove'), big: t('logo_big'), bad: t('logo_bad') }} />
      </Panel>
    </div>
  );
}

