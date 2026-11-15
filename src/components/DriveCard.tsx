import { Panel } from '@/components/Page';
import { driveConfigured, driveStatus } from '@/lib/drive';
import { dateTime } from '@/lib/format';
import { ROOT_NAME } from '@/lib/drive-naming';

/** Impostazioni › «Archivio su Google Drive»: stato del collegamento, conteggi e comandi (solo amministratori). */
export async function DriveCard({ org, lang, flag, n }: { org: string; lang: 'it' | 'fr'; flag?: string; n?: Record<string, string | undefined> }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const conf = driveConfigured();
  const st = conf ? await driveStatus(org) : null;
  const link = st?.link ?? null;
  const msg = !flag ? null
    : flag === 'ok' ? L('Google Drive collegato. La prima copia parte con «Sincronizza ora».', 'Google Drive connecté. La première copie démarre avec « Synchroniser maintenant ».')
    : flag === 'synced' ? L(`Sincronizzazione fatta: ${n?.dc ?? 0} copiati, ${n?.du ?? 0} aggiornati, ${n?.df ?? 0} non riusciti, ${n?.dq ?? 0} ancora in coda.`, `Synchronisation faite : ${n?.dc ?? 0} copiés, ${n?.du ?? 0} mis à jour, ${n?.df ?? 0} en échec, ${n?.dq ?? 0} encore en attente.`)
    : flag === 'refused' ? L('Autorizzazione non concessa: il collegamento non è stato fatto.', 'Autorisation refusée : la connexion n’a pas été faite.')
    : flag === 'norefresh' ? L('Google non ha dato un’autorizzazione duratura. Togli YouCount da myaccount.google.com › Sicurezza › Accesso di terze parti e riprova.', 'Google n’a pas donné d’autorisation durable. Retirez YouCount dans myaccount.google.com › Sécurité › Accès tiers et réessayez.')
    : flag === 'noconf' ? L('Collegamento non ancora configurato sul server.', 'Connexion pas encore configurée sur le serveur.')
    : flag === 'denied' ? L('Solo un amministratore può collegare Google Drive.', 'Seul un administrateur peut connecter Google Drive.')
    : L('Collegamento non riuscito. Riprova; se si ripete, guarda il messaggio qui sotto.', 'Connexion échouée. Réessayez ; si cela se répète, voyez le message ci-dessous.');
  const good = flag === 'ok' || flag === 'synced';
  return (
    <Panel title={L('Archivio su Google Drive', 'Archive sur Google Drive')} pad>
      <div id="drive" className="stack drive-card" style={{ gap: 12 }}>
        {msg && <div className={`note ${good ? 'ok' : 'err'}`} role="status">{msg}</div>}
        <p className="muted" style={{ margin: 0 }}>{L(
          `Giustificativi dei movimenti registrati e documenti emessi vengono copiati nella cartella «${ROOT_NAME}» del Drive dell’associazione, in cartelle per anno. Bozze e file non collegati non vengono copiati; nel Drive non si elimina mai nulla. La versione che fa fede resta quella in YouCount.`,
          `Les justificatifs des mouvements comptabilisés et les documents émis sont copiés dans le dossier « ${ROOT_NAME} » du Drive de l’association, dans des dossiers par année. Brouillons et fichiers non liés ne sont pas copiés ; rien n’est jamais supprimé dans le Drive. La version qui fait foi reste celle de YouCount.`)}</p>
        {!conf ? <p className="note" style={{ margin: 0 }}>{L('Da configurare: mancano le credenziali Google sul server.', 'À configurer : les identifiants Google manquent sur le serveur.')}</p>
          : !link ? <div className="row-btns eq"><a className="btn primary" href="/api/v1/drive/connect">{L('Collega Google Drive', 'Connecter Google Drive')}</a></div>
          : (<>
            <dl className="kv">
              <dt>{L('Account', 'Compte')}</dt><dd>{link.google_email ?? '–'}</dd>
              <dt>{L('Ultima sincronizzazione', 'Dernière synchronisation')}</dt><dd>{link.last_sync_at ? dateTime(link.last_sync_at, lang) : L('mai', 'jamais')}</dd>
              <dt>{L('Copiati', 'Copiés')}</dt><dd className="num">{st?.done ?? 0}</dd>
              <dt>{L('Da copiare', 'À copier')}</dt><dd className="num">{st?.waiting ?? 0}</dd>
              <dt>{L('Non riusciti', 'En échec')}</dt><dd className="num">{st?.failed ?? 0}</dd>
            </dl>
            {link.last_error && <div className="note err">{L('Ultimo errore', 'Dernière erreur')}: {link.last_error}</div>}
            <div className="row-btns eq">
              <form action="/api/v1/drive/sync" method="post"><button className="btn primary" type="submit">{L('Sincronizza ora', 'Synchroniser maintenant')}</button></form>
              {link.root_folder_id && <a className="btn" href={`https://drive.google.com/drive/folders/${link.root_folder_id}`} target="_blank" rel="noreferrer">{L('Apri la cartella', 'Ouvrir le dossier')}</a>}
              <a className="btn ghost" href="/api/v1/drive/connect">{L('Ricollega', 'Reconnecter')}</a>
            </div>
          </>)}
      </div>
    </Panel>
  );
}
