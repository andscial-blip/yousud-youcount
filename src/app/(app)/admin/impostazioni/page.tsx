import { ADMIN, can, requireMe } from '@/lib/session';
import type { Key } from '@/lib/i18n';
import { Denied, PageHead, Panel } from '@/components/Page';
import { removeLogo, saveAdvLimits, saveLogo, saveDocDetails, saveMgSeat, toggleSetting } from './actions';
import { CountryMark } from '@/components/CountryMark';
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
  const mg = ((data ?? []).find((s) => s.key === 'mg_seat')?.value ?? {}) as Record<string, string | undefined>;
  const al = ((data ?? []).find((s) => s.key === 'adv_limits')?.value ?? {}) as { resp?: number | null; admin?: number | null; ref?: string | null };
  const FR = lang === 'fr', L = (it: string, fr: string) => (FR ? fr : it);
  const dmy = (d?: string) => (d ? d.split('-').reverse().join('/') : '');
  const remind = mg.expires_on ? (() => { const d = new Date(`${mg.expires_on}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 6); return d.toISOString().slice(0, 10); })() : '';
  const mf = (k: string, it: string, fr: string, o: { span?: boolean; type?: string; max?: number; area?: boolean; ph?: string } = {}) => (
    <div className={`field${o.span ? ' span2' : ''}`}><label htmlFor={`mg-${k}`}>{L(it, fr)}</label>
      {o.area ? <textarea className="input" id={`mg-${k}`} name={k} rows={3} maxLength={o.max ?? 1000} defaultValue={mg[k] ?? ''} placeholder={o.ph} />
        : <input className="input" id={`mg-${k}`} name={k} type={o.type ?? 'text'} maxLength={o.max ?? 120} defaultValue={mg[k] ?? ''} placeholder={o.ph} />}</div>);
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <PageHead title={t('nav_settings')} />
      {ok && <div className="note ok" role="status">{ok === 'demo_loaded' ? (lang === 'fr' ? 'Données de démonstration chargées.' : 'Dati dimostrativi caricati.')
        : ok === 'demo_purged' ? (lang === 'fr' ? 'Données de démonstration supprimées.' : 'Dati dimostrativi eliminati.')
        : ok === 'adv' ? L('Soglie degli anticipi salvate.', 'Seuils des avances enregistrés.') : ok === 'mg' ? L('Dati della sede in Madagascar salvati.', 'Données du siège à Madagascar enregistrées.') : ok === 'reset' ? (lang === 'fr' ? 'Comptabilité remise à zéro : mouvements et budgets supprimés. La numérotation repart de 001.' : 'Contabilità azzerata: movimenti e preventivi eliminati. La numerazione riparte da 001.') : '✓'}</div>}
      {err && <div className="note err">{err}</div>}
      <Panel title={L('Regole di controllo', 'Règles de contrôle')}>
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
      <section className="panel" id="soglie-anticipi">
        <div className="panel-h"><h2>{L('Anticipi · soglie di autorizzazione', 'Avances · seuils d’autorisation')}</h2></div>
        <div className="panel-b">
          <p className="muted" style={{ marginTop: 0 }}>{L('Chi può autorizzare un anticipo, in euro (per gli ariary vale il tasso del mese). Oltre la soglia dell’amministratore serve la delibera del Consiglio. Vuoto = nessun limite.',
            'Qui peut autoriser une avance, en euros (pour l’ariary, taux du mois). Au-delà du seuil de l’administrateur, il faut la délibération du Conseil. Vide = aucune limite.')}</p>
          <form action={saveAdvLimits} className="fgrid">
            <div className="field"><label htmlFor="al-r">{L('Responsabile fino a (€)', 'Responsable jusqu’à (€)')}</label>
              <input className="input num" id="al-r" name="resp" inputMode="numeric" defaultValue={al.resp ?? ''} /></div>
            <div className="field"><label htmlFor="al-a">{L('Amministratore fino a (€)', 'Administrateur jusqu’à (€)')}</label>
              <input className="input num" id="al-a" name="admin" inputMode="numeric" defaultValue={al.admin ?? ''} /></div>
            <div className="field span2"><label htmlFor="al-ref">{L('Decise con (delibera, verbale)', 'Fixés par (délibération, procès-verbal)')}</label>
              <input className="input" id="al-ref" name="ref" maxLength={200} defaultValue={al.ref ?? ''} placeholder={L('Es. provvisorie, in attesa della delibera del Consiglio', 'Ex. provisoires, en attente de la délibération du Conseil')} /></div>
            <div className="span2"><button className="btn primary" type="submit">{t('save')}</button></div>
          </form>
        </div>
      </section>
      <section className="panel country" id="sede-mg">
        <div className="panel-h"><CountryMark loc="MG" label="Madagascar" /><h2>{L('Sede in Madagascar · accordo di sede', 'Siège à Madagascar · accord de siège')}</h2></div>
        <div className="panel-b">
          {mg.expires_on && <p className="note" style={{ marginTop: 0 }}>{L(`Accordo valido fino al ${dmy(mg.expires_on)}. Promemoria di rinnovo in Scadenze il ${dmy(remind)} (6 mesi prima).`,
            `Accord valable jusqu’au ${dmy(mg.expires_on)}. Rappel de renouvellement dans Échéances le ${dmy(remind)} (6 mois avant).`)}</p>}
          <form action={saveMgSeat} className="fgrid">
            {mf('agreement_no', 'Numero dell’accordo', 'Numéro de l’accord', { max: 80 })}
            {mf('ministries', 'Ministeri firmatari o di riferimento', 'Ministères signataires ou de tutelle', { max: 300 })}
            {mf('signed_on', 'Data di firma', 'Date de signature', { type: 'date', max: 10 })}
            {mf('expires_on', 'Data di scadenza', 'Date d’expiration', { type: 'date', max: 10 })}
            {mf('rep_name', 'Rappresentante legale in Madagascar', 'Représentant légal à Madagascar')}
            {mf('rep_mandate', 'Mandato o procura (estremi)', 'Mandat ou procuration (références)', { max: 200 })}
            {mf('nif', 'NIF', 'NIF', { max: 40 })}
            {mf('stat', 'STAT', 'STAT', { max: 40 })}
            {mf('cnaps', 'CNaPS (affiliazione)', 'CNaPS (affiliation)', { max: 40 })}
            {mf('ostie', 'OSTIE o altro servizio medico', 'OSTIE ou autre service médical', { max: 40 })}
            {mf('address', 'Indirizzo della sede', 'Adresse du siège', { span: true, max: 300 })}
            {mf('zones', 'Zone di intervento', 'Zones d’intervention', { span: true, max: 300 })}
            {mf('accounts', 'Conti bancari e firmatari', 'Comptes bancaires et signataires', { span: true, area: true, ph: L('Banca, numero (ultime cifre), chi firma e con quali limiti', 'Banque, numéro (derniers chiffres), qui signe et avec quelles limites') })}
            {mf('exemptions', 'Esenzioni e agevolazioni previste dall’accordo', 'Exonérations et facilités prévues par l’accord', { span: true, area: true })}
            {mf('notes', 'Note (allegati, dove si trova la copia firmata)', 'Notes (annexes, où se trouve la copie signée)', { span: true, area: true })}
            <div className="span2"><button className="btn primary" type="submit">{t('save')}</button></div>
          </form>
        </div>
      </section>
    </div>
  );
}

