import { requireMe } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type S = { id: number; at: string; operation: string; outcome: 'applied' | 'duplicate' | 'conflict'; device_id: string | null };

export default async function Sync() {
  const { supabase, me, t, lang } = await requireMe();
  const { data, error } = await supabase.from('sync_log').select('id, at, operation, outcome, device_id')
    .eq('user_id', me!.id).order('at', { ascending: false }).limit(50).returns<S[]>();
  const label = { applied: 'ok', duplicate: lang === 'fr' ? 'déjà reçu' : 'già ricevuto', conflict: lang === 'fr' ? 'conflit' : 'conflitto' };
  return (
    <div className="stack">
      <PageHead title={t('nav_sync')} />
      <div className="note"><b>{t('coming')}.</b> {t('sync_text')}</div>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('audit_when')}</th><th>{t('sync_op')}</th><th>{t('sync_outcome')}</th></tr></thead>
            <tbody>
              {data!.map((s) => (
                <tr key={s.id}>
                  <td className="num">{dateTime(s.at, lang)}</td><td>{s.operation}</td>
                  <td><span className={`chip ${s.outcome === 'conflict' ? 'warn' : 'ok'}`}>{label[s.outcome]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
