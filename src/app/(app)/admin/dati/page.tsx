import { ADMIN, can, requireMe } from '@/lib/session';
import { Denied, PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { ApiKeys } from '@/components/ApiKeys';
import { DemoPanel, ResetPanel } from '../impostazioni/panels';

export const dynamic = 'force-dynamic';

// Dati e sicurezza: backup, dati dimostrativi, azzeramento prima dell'avvio e collegamenti con altre app.
// (Prima stavano in «Ente e documenti», che ora contiene solo dati dell'ente, logo, firma e regole.)
export default async function DataSettings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const [{ data: demo }, { data: reset }, { data: bk }, { data: keys }] = await Promise.all([
    supabase.rpc('demo_counts'),
    me?.role === 'super_admin' ? supabase.rpc('reset_counts') : Promise.resolve({ data: null }),
    supabase.from('settings').select('value').eq('key', 'last_backup').maybeSingle(),
    supabase.from('api_clients').select('id, name, key_prefix, created_at, last_used_at, revoked_at').order('created_at', { ascending: false }),
  ]);
  const lastBackup = bk?.value as { at?: string; by?: string } | undefined;
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <PageHead title={lang === 'fr' ? 'Données et sécurité' : 'Dati e sicurezza'} />
      {ok && <div className="note ok" role="status">{ok === 'demo_loaded' ? (lang === 'fr' ? 'Données de démonstration chargées.' : 'Dati dimostrativi caricati.')
        : ok === 'demo_purged' ? (lang === 'fr' ? 'Données de démonstration supprimées.' : 'Dati dimostrativi eliminati.')
        : ok === 'reset' ? (lang === 'fr' ? 'Comptabilité remise à zéro : mouvements et budgets supprimés. La numérotation repart de 001.' : 'Contabilità azzerata: movimenti e preventivi eliminati. La numerazione riparte da 001.')
        : lang === 'fr' ? 'Enregistré.' : 'Salvato.'}</div>}
      {err && <div className="note err">{err}</div>}
      <DemoPanel lang={lang} counts={demo as Record<string, number> | null} />
      <ResetPanel lang={lang} c={reset as Record<string, number | string | null> | null} />
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
