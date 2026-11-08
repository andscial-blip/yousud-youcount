import { requireMe } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { OutboxList } from '@/components/OutboxList';
import { dictFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

// nomi delle operazioni del server in parole dell'utente
const OP: Record<string, [string, string]> = {
  save_movement: ['Movimento salvato', 'Mouvement enregistré'], register_document: ['Giustificativo caricato', 'Pièce chargée'],
  verify_movement: ['Movimento verificato', 'Mouvement vérifié'], reverse_movement: ['Storno', 'Extourne'],
  reimburse_expenses: ['Rimborso registrato', 'Remboursement enregistré'], reconcile_account: ['Riconciliazione bancaria', 'Rapprochement bancaire'],
  delete_draft: ['Bozza eliminata', 'Brouillon supprimé'], link_document: ['Giustificativo collegato', 'Pièce liée'],
};

type S = { id: number; at: string; operation: string; outcome: 'applied' | 'duplicate' | 'conflict'; device_id: string | null };

export default async function Sync() {
  const { supabase, me, t, lang } = await requireMe();
  const { data, error } = await supabase.from('sync_log').select('id, at, operation, outcome, device_id')
    .eq('user_id', me!.id).order('at', { ascending: false }).limit(50).returns<S[]>();
  const label = { applied: 'ok', duplicate: lang === 'fr' ? 'déjà reçu' : 'già ricevuto', conflict: lang === 'fr' ? 'conflit' : 'conflitto' };
  return (
    <div className="stack">
      <PageHead title={t('nav_sync')} />
      <div className="note">{t('sync_text')}</div>
      <OutboxList t={dictFor(lang)} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel title={t('q_server_log')}>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('audit_when')}</th><th>{t('sync_op')}</th><th>{t('sync_outcome')}</th></tr></thead>
            <tbody>
              {data!.map((s) => (
                <tr key={s.id}>
                  <td className="num">{dateTime(s.at, lang)}</td><td>{OP[s.operation]?.[lang === 'fr' ? 1 : 0] ?? s.operation}</td>
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
