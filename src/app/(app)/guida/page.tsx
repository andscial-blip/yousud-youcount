import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { HELP, HELP_SECTIONS } from '@/lib/help';
import { PageHead } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';
import { GuideSearch } from '@/components/GuideSearch';
import { CIcon } from '@/components/CIcon';

export const dynamic = 'force-dynamic';

const anchor = (href: string) => href.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';
const SEC_IC: Record<string, string> = { start: 'info', home: 'home', mov: 'list', cassa: 'bank', bud: 'wallet', prj: 'brief', anal: 'chart', docs: 'receipt', set: 'gear' };

// Guida: i primi passi in quattro schede, poi gli argomenti per sezione (gli stessi testi del pulsante (i) di ogni pagina),
// ognuno richiudibile, con ricerca. Stampabile in PDF (la stampa apre tutto).
export default async function Guide() {
  const { lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const steps: [string, string, string, string][] = [
    ['plus', L('Registra un movimento', 'Saisir un mouvement'), L('Con il «+»: foto del giustificativo, importo, conto, codice e progetto.', 'Avec le « + » : photo du justificatif, montant, compte, code et projet.'), '/nuovo'],
    ['check', L('Fai verificare', 'Faire vérifier'), L('Un responsabile controlla i movimenti registrati: quattro occhi.', 'Un responsable contrôle les mouvements enregistrés : quatre yeux.'), '/movimenti?stato=recorded'],
    ['wallet', L('Confronta col preventivo', 'Comparer au budget'), L('Speso e previsto per codice e progetto, con gli avvisi.', 'Dépensé et prévu par code et projet, avec les alertes.'), '/preventivo'],
    ['chart', L('Leggi i numeri', 'Lire les chiffres'), L('Dashboard, Analisi e Rendiconto si aggiornano da soli.', 'Tableau de bord, Analyses et Compte rendu se mettent à jour seuls.'), '/analisi'],
  ];
  return (
    <div className="stack guide">
      <PageHead title={L('Guida', 'Guide')}><PrintButton label={L('Stampa o salva in PDF', 'Imprimer ou enregistrer en PDF')} /></PageHead>

      <section className="panel g-hero">
        <div className="panel-b">
          <h2>{L('Come si usa YouCount', 'Comment utiliser YouCount')}</h2>
          <p className="muted">{L('Quattro passi per il lavoro di ogni giorno. In ogni pagina il pulsante (i) in alto spiega quella pagina.',
            'Quatre étapes pour le travail de tous les jours. Sur chaque page, le bouton (i) en haut explique cette page.')}</p>
          <ol className="g-steps">
            {steps.map(([ic, title, text, href], i) => (
              <li key={href}><Link href={href}>
                <span className="g-n">{i + 1}</span><span className="hic"><CIcon name={ic} size={16} /></span>
                <b>{title}</b><span className="muted">{text}</span>
              </Link></li>
            ))}
          </ol>
        </div>
      </section>

      <GuideSearch placeholder={L('Cerca nella guida (es. rimborso, cambio, storno)', 'Rechercher dans le guide (ex. remboursement, change)')}
        none={L('Nessun argomento trovato.', 'Aucun sujet trouvé.')} />

      <nav className="g-idx no-print" aria-label={L('Sezioni', 'Sections')}>
        {HELP_SECTIONS.map((s) => (
          <a key={s.id} href={`#sec-${s.id}`}><CIcon name={SEC_IC[s.id] ?? 'info'} size={16} /><span>{lang === 'fr' ? s.fr : s.it}</span>
            <small>{HELP.filter((h) => h.sec === s.id).length}</small></a>
        ))}
      </nav>

      {HELP_SECTIONS.map((s) => {
        const items = HELP.filter((h) => h.sec === s.id);
        if (!items.length) return null;
        return (
          <section key={s.id} className="panel g-sec" id={`sec-${s.id}`}>
            <div className="panel-h"><h2 className="h-ic"><span className="hic"><CIcon name={SEC_IC[s.id] ?? 'info'} size={15} /></span>{lang === 'fr' ? s.fr : s.it}</h2></div>
            {items.map((h, i) => {
              const [title, paras] = lang === 'fr' ? h.fr : h.it;
              return (
                <details key={h.href} id={anchor(h.href)} className="g-topic" open={s.id === 'start' && i === 0}>
                  <summary><span>{title}</span><CIcon name="arrow" size={16} /></summary>
                  <div className="g-body">
                    {paras.map((p, k) => <p key={k}>{p}</p>)}
                    <Link className="btn small no-print" href={h.href}>{L('Vai alla pagina', 'Aller à la page')} →</Link>
                  </div>
                </details>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
