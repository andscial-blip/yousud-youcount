import { ADMIN, can, requireMe } from '@/lib/session';
import { Denied, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { ApiKeys } from '@/components/ApiKeys';
import { DemoPanel, ResetPanel } from '../impostazioni/panels';
import { purgeAllAction } from '../../movimenti/actions';

export const dynamic = 'force-dynamic';

// Dati e sicurezza: backup, dati dimostrativi, azzeramento prima dell'avvio e collegamenti con altre app.
// (Prima stavano in «Ente e documenti», che ora contiene solo dati dell'ente, logo, firma e regole.)
export default async function DataSettings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const superAdmin = me?.role === 'super_admin';
  const [{ data: demo }, { data: reset }, { data: bk }, { data: keys }, { count: allCount }, { count: closedCount }] = await Promise.all([
    supabase.rpc('demo_counts'),
    me?.role === 'super_admin' ? supabase.rpc('reset_counts') : Promise.resolve({ data: null }),
    supabase.from('settings').select('value').eq('key', 'last_backup').maybeSingle(),
    supabase.from('api_clients').select('id, name, key_prefix, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }),
    supabase.from('movements').select('id', { count: 'exact', head: true }),
    supabase.from('periods').select('year', { count: 'exact', head: true }).not('closed_at', 'is', null),
  ]);
  const lastBackup = bk?.value as { at?: string; by?: string } | undefined;
  const bkAt = lastBackup?.at ?? null;
  const bkFresh = Boolean(bkAt && Date.now() - Date.parse(bkAt) < 24 * 3600e3);
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <PageHead title={lang === 'fr' ? 'Données et sécurité' : 'Dati e sicurezza'} />
      {ok && <div className="note ok" role="status">{ok === 'demo_loaded' ? (lang === 'fr' ? 'Données de démonstration chargées.' : 'Dati dimostrativi caricati.')
        : ok === 'demo_purged' ? (lang === 'fr' ? 'Données de démonstration supprimées.' : 'Dati dimostrativi eliminati.')
        : ok === 'purged_all' ? L('Tutti i movimenti sono stati eliminati. La numerazione riparte da 001.', 'Tous les mouvements ont été supprimés. La numérotation repart de 001.')
        : ok === 'reset' ? (lang === 'fr' ? 'Comptabilité remise à zéro : mouvements et budgets supprimés. La numérotation repart de 001.' : 'Contabilità azzerata: movimenti e preventivi eliminati. La numerazione riparte da 001.')
        : lang === 'fr' ? 'Enregistré.' : 'Salvato.'}</div>}
      {err && <div className="note err">{err}</div>}
      <Panel title={t('bk_title')}>
        <div className="panel-b stack" style={{ gap: 12 }}>
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
      <h2 className="dz-h">{L('Zona di pericolo', 'Zone de danger')}</h2>
      <DemoPanel lang={lang} counts={demo as Record<string, number> | null} />
      <ResetPanel lang={lang} c={reset as Record<string, number | string | null> | null} />
      {superAdmin && (allCount ?? 0) > 0 && (
        <details className="danger-zone panel" id="svuota">
          <summary className="btn ghost">{L(`Svuota l'elenco: elimina tutti i ${allCount} movimenti…`, `Vider la liste : supprimer les ${allCount} mouvements…`)}</summary>
          <form action={purgeAllAction} className="stack panel-b" style={{ gap: 10 }}>
            <input type="hidden" name="expected" value={allCount ?? 0} />
            <p className="muted" style={{ margin: 0 }}>{L(
              'Elimina definitivamente tutti i movimenti (reali e DEMO) con i loro abbinamenti; preventivi, conti e categorie restano, la numerazione MOV riparte da 001. Serve un backup scaricato nelle ultime 24 ore.',
              'Supprime définitivement tous les mouvements (réels et DEMO) avec leurs rapprochements ; budgets, comptes et catégories restent, la numérotation MOV repart de 001. Il faut une sauvegarde téléchargée dans les dernières 24 heures.')}</p>
            <p style={{ margin: 0 }}>{bkFresh
              ? <span className="chip ok">{L('Backup recente', 'Sauvegarde récente')}: {new Date(bkAt!).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT')}</span>
              : <><span className="chip warn">{L('Nessun backup nelle ultime 24 ore', 'Aucune sauvegarde dans les dernières 24 heures')}</span>{' '}
                <a className="btn small" href="/api/v1/backup"><Ico name="download" />{L('Scarica il backup', 'Télécharger la sauvegarde')}</a></>}</p>
            {(closedCount ?? 0) > 0 && <p style={{ margin: 0 }}><span className="chip warn">{L('Ci sono mesi chiusi: vanno riaperti prima', 'Des mois sont clôturés : il faut d’abord les rouvrir')}</span></p>}
            <label className="field"><span>{L('Motivo', 'Motif')}</span>
              <input className="input" name="reason" required minLength={5} maxLength={300} placeholder={L('Es. pulizia dei movimenti di prova prima dell\'avvio', 'Ex. nettoyage des mouvements de test avant le démarrage')} /></label>
            <label className="field"><span>{L('La tua password', 'Votre mot de passe')}</span>
              <input className="input" name="password" type="password" required autoComplete="current-password" /></label>
            <label className="check"><input type="checkbox" name="confirm" required /> {L(`Elimino definitivamente tutti i ${allCount} movimenti`, `Je supprime définitivement les ${allCount} mouvements`)}</label>
            <div><button className="btn danger" type="submit" disabled={!bkFresh || (closedCount ?? 0) > 0}>{L('Elimina tutti i movimenti', 'Supprimer tous les mouvements')}</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
