import { Panel } from '@/components/Page';
import { loadDemo, purgeDemo, resetAccounting } from './actions';

// Dati dimostrativi: servono a provare filtri, grafici e scostamenti. Marcati DEMO ovunque e mai mescolati ai reali.
export function DemoPanel({ lang, counts }: { lang: 'it' | 'fr'; counts: Record<string, number> | null }) {
  if (!counts) return null;
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const total = Object.values(counts).reduce((a, b) => a + Number(b), 0);
  const rows: [string, string, string][] = [['movements', 'Movimenti', 'Mouvements'], ['budgets', 'Preventivi', 'Budgets'], ['budget_items', 'Voci di preventivo', 'Lignes de budget'],
    ['fx_rates', 'Tassi di cambio', 'Taux de change'], ['projects', 'Progetti', 'Projets'], ['counterparties', 'Controparti', 'Tiers'],
    ['deadlines', 'Scadenze', 'Échéances'], ['issued_docs', 'Documenti emessi', 'Documents émis'], ['grants', 'Finanziamenti', 'Financements']];
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
export function ResetPanel({ lang, c }: { lang: 'it' | 'fr'; c: Record<string, number | string | null> | null }) {
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
      <p className="muted">{L('Restano: conti, categorie, progetti, controparti, utenti, tassi di cambio, impostazioni; giustificativi e documenti emessi restano in archivio, scollegati. La numerazione MOV riparte da 001. Ogni riga eliminata resta nel registro modifiche e nel backup.',
        'Restent : comptes, catégories, projets, tiers, utilisateurs, taux de change, paramètres ; justificatifs et documents émis restent archivés, sans lien. La numérotation MOV repart de 001. Chaque ligne supprimée reste dans l\'historique et dans la sauvegarde.')}</p>
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
