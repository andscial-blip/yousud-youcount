import { ADMIN, can, requireMe } from '@/lib/session';
import type { Key } from '@/lib/i18n';
import { Denied, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { loadDemo, purgeDemo, resetAccounting, removeLogo, saveLogo, saveDocDetails, toggleSetting } from './actions';
import { ApiKeys } from '@/components/ApiKeys';
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
  const demo = can(me, ADMIN) ? ((await supabase.rpc('demo_counts')).data as Record<string, number> | null) : null;
  const reset = me?.role === 'super_admin' ? ((await supabase.rpc('reset_counts')).data as Record<string, number | string | null> | null) : null;
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data }, { data: keys }] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('api_clients').select('id, name, key_prefix, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }),
  ]);
  const val = (k: string, def: boolean) => {
    const v = (data ?? []).find((s) => s.key === k)?.value;
    return v === undefined || v === null ? def : v === true;
  };
  const orgDet = ((data ?? []).find((s) => s.key === 'org_details')?.value ?? {}) as { legal_name?: string; address?: string; tax_id?: string; iban?: string; runts?: string; email?: string; phone?: string; web?: string };
  const signer = ((data ?? []).find((s) => s.key === 'doc_signer')?.value ?? {}) as { name?: string; role?: string };
  const lg = ((data ?? []).find((s) => s.key === 'org_logo')?.value ?? {}) as { mime?: string; data?: string };
  const logoUrl = lg.mime && lg.data ? `data:${lg.mime};base64,${lg.data}` : null;
  const lastBackup = (data ?? []).find((s) => s.key === 'last_backup')?.value as { at?: string; by?: string } | undefined;
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
      <DemoPanel lang={lang} counts={demo} />
      <ResetPanel lang={lang} c={reset} />
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

// Dati dimostrativi: servono a provare filtri, grafici e scostamenti. Marcati DEMO ovunque e mai mescolati ai reali.
function DemoPanel({ lang, counts }: { lang: 'it' | 'fr'; counts: Record<string, number> | null }) {
  if (!counts) return null;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const total = Object.values(counts).reduce((a, b) => a + Number(b), 0);
  const rows: [string, string, string][] = [['movements', 'Movimenti', 'Mouvements'], ['budgets', 'Preventivi', 'Budgets'], ['budget_items', 'Voci di preventivo', 'Lignes de budget'],
    ['fx_rates', 'Tassi di cambio', 'Taux de change'], ['projects', 'Progetti', 'Projets'], ['counterparties', 'Controparti', 'Contreparties'],
    ['deadlines', 'Scadenze', 'Échéances'], ['issued_docs', 'Documenti emessi', 'Documents émis']];
  return (
    <Panel title={L('Dati dimostrativi', 'Données de démonstration')} pad>
      <div id="demo" />
      <p className="muted" style={{ marginTop: 0 }}>{L('Un anno di movimenti inventati costruiti sul preventivo e sui tassi del foglio Excel «Contabilità 2026», per provare filtri, grafici, scostamenti e cambi. Ogni dato è marcato DEMO e non è un dato reale di YouSud. Svuotando si eliminano tutti e soli i dati DEMO.',
        'Une année de mouvements inventés, construits sur le budget et les taux du fichier Excel « Contabilità 2026 », pour tester filtres, graphiques, écarts et taux. Chaque donnée est marquée DEMO et n\'est pas une donnée réelle de YouSud. Vider supprime toutes les données DEMO et seulement elles.')}</p>
      {total > 0 ? (
        <>
          <table className="t keep" style={{ maxWidth: 420 }}><tbody>
            {rows.filter(([k]) => Number(counts[k])).map(([k, it, fr]) => <tr key={k}><td>{L(it, fr)}</td><td className="r num">{counts[k]}</td></tr>)}
          </tbody></table>
          <form action={purgeDemo} className="stack" style={{ gap: 10, marginTop: 12 }}>
            <input type="hidden" name="expected" value={counts.movements} />
            <label className="check"><input type="checkbox" name="confirm" required /> {L(`Confermo: elimina ${counts.movements} movimenti DEMO e gli altri dati DEMO elencati. I dati reali non vengono toccati.`,
              `Je confirme : supprimer ${counts.movements} mouvements DEMO et les autres données DEMO listées. Les données réelles ne sont pas touchées.`)}</label>
            <div><button className="btn danger" type="submit">{L('Svuota i dati dimostrativi', 'Vider les données de démonstration')}</button></div>
          </form>
        </>
      ) : (
        <form action={loadDemo}><button className="btn" type="submit">{L('Carica i dati dimostrativi', 'Charger les données de démonstration')}</button></form>
      )}
    </Panel>
  );
}

// Azzeramento prima dell'avvio: solo il super amministratore. Mostra cosa verrà eliminato e cosa resta.
function ResetPanel({ lang, c }: { lang: 'it' | 'fr'; c: Record<string, number | string | null> | null }) {
  if (!c) return null;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const bk = c.last_backup ? new Date(String(c.last_backup)) : null;
  const fresh = !!bk && Date.now() - bk.getTime() < 24 * 3600e3;
  const n = (k: string) => Number(c[k] ?? 0);
  return (
    <Panel title={L('Azzera movimenti e preventivi', 'Remettre à zéro mouvements et budgets')} pad className="danger-panel">
      <div id="azzera" />
      <p style={{ marginTop: 0 }}>{L('Da usare una sola volta, prima dell\'avvio, per eliminare i dati di collaudo. Elimina:', 'À utiliser une seule fois, avant le lancement, pour supprimer les données de test. Supprime :')}</p>
      <ul className="reset-list">
        <li><b className="num">{n('movements')}</b> {L('movimenti', 'mouvements')} ({n('movements_demo')} DEMO)</li>
        <li><b className="num">{n('budgets')}</b> {L('preventivi', 'budgets')} {L('con', 'avec')} <b className="num">{n('budget_items')}</b> {L('righe', 'lignes')}{n('budget_lines') ? ` + ${n('budget_lines')} ${L('budget di progetto per gruppo', 'budgets de projet par groupe')}` : ''}</li>
        <li><b className="num">{n('reconciliations')}</b> {L('riconciliazioni bancarie', 'rapprochements bancaires')}, <b className="num">{n('cash_counts')}</b> {L('conte di cassa', 'comptages de caisse')}, <b className="num">{n('self_certs')}</b> {L('autocertificazioni', 'attestations')}</li>
      </ul>
      <p className="muted">{L('Restano: conti, piano dei conti, progetti, controparti, utenti, tassi di cambio, impostazioni; giustificativi e documenti emessi restano in archivio, scollegati. La numerazione MOV riparte da 001. Ogni riga eliminata resta nel registro modifiche e nel backup.',
        'Restent : comptes, plan comptable, projets, contreparties, utilisateurs, taux de change, paramètres ; justificatifs et documents émis restent archivés, sans lien. La numérotation MOV repart de 001. Chaque ligne supprimée reste dans l\'historique et dans la sauvegarde.')}</p>
      <p className={fresh ? 'note ok' : 'note err'}>{fresh ? L(`Backup scaricato il ${bk!.toLocaleString('it-IT', { timeZone: 'Indian/Antananarivo' })}.`, `Sauvegarde téléchargée le ${bk!.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })}.`)
        : L('Prima scarica il backup completo (serve un backup delle ultime 24 ore).', 'Téléchargez d\'abord la sauvegarde complète (moins de 24 heures).')} <a href="/api/v1/backup">{L('Scarica il backup', 'Télécharger la sauvegarde')}</a></p>
      <form action={resetAccounting} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="movements" value={n('movements')} /><input type="hidden" name="budgets" value={n('budgets')} />
        <label className="field" style={{ maxWidth: 320 }}><span className="flabel">{L('Scrivi AZZERA per confermare', 'Écrivez AZZERA pour confirmer')}</span>
          <input className="input" name="word" required pattern="AZZERA" autoComplete="off" /></label>
        <label className="check"><input type="checkbox" required /> {L(`Confermo: elimina ${n('movements')} movimenti e ${n('budgets')} preventivi. L'operazione non si annulla dall'app.`, `Je confirme : supprimer ${n('movements')} mouvements et ${n('budgets')} budgets. L'opération ne s'annule pas depuis l'application.`)}</label>
        <div><button className="btn danger" type="submit" disabled={!fresh}>{L('Azzera movimenti e preventivi', 'Remettre à zéro')}</button></div>
      </form>
    </Panel>
  );
}
