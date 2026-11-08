import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

// Guida breve: cosa si fa in ogni sezione. Va aggiornata a ogni tappa.
const G: { href: string; it: [string, string]; fr: [string, string] }[] = [
  { href: '/nuovo', it: ['Registrare una spesa o un\'entrata', 'Premi «+», fotografa o carica il giustificativo, controlla i campi proposti e registra. Senza giustificativo serve il motivo. (In costruzione: tappa 4c.)'],
    fr: ['Enregistrer une dépense ou une recette', 'Appuyez sur « + », photographiez ou chargez la pièce, contrôlez les champs proposés et enregistrez. Sans pièce, il faut en indiquer le motif. (En construction : étape 4c.)'] },
  { href: '/movimenti', it: ['Movimenti', 'Bozza: la stai ancora compilando. Da verificare: registrato, ha un numero MOV e conta nei saldi. Verificato: controllato da una seconda persona, non si modifica più.'],
    fr: ['Mouvements', 'Brouillon : en cours de saisie. À vérifier : enregistré, il a un numéro MOV et compte dans les soldes. Vérifié : contrôlé par une deuxième personne, il ne se modifie plus.'] },
  { href: '/verifica', it: ['Verifica e storni', 'Un responsabile verifica i movimenti inseriti da altri. Un errore su un movimento verificato si corregge con uno storno, che resta collegato all\'originale.'],
    fr: ['Vérification et extournes', 'Un responsable vérifie les mouvements saisis par d\'autres. Une erreur sur un mouvement vérifié se corrige par une extourne, liée à l\'original.'] },
  { href: '/conti', it: ['Conti', 'Saldi di banca, cassa e mobile money in Italia (EUR) e in Madagascar (MGA). Una cassa in negativo è segnata in rosso: di solito manca una registrazione.'],
    fr: ['Comptes', 'Soldes de banque, caisse et mobile money en Italie (EUR) et à Madagascar (MGA). Une caisse négative est en rouge : il manque en général un enregistrement.'] },
  { href: '/progetti', it: ['Progetti', 'Entrate e uscite in EUR per progetto. «Spese generali» raccoglie i costi di struttura.'],
    fr: ['Projets', 'Recettes et dépenses en EUR par projet. « Spese generali » regroupe les frais généraux de structure.'] },
  { href: '/rendiconto', it: ['Rendiconto', 'Bozza del rendiconto per cassa (Mod. D) calcolata dai movimenti. La conformità la verifica il commercialista.'],
    fr: ['Bilan', 'Brouillon du compte de caisse (modèle D) calculé à partir des mouvements. La conformité est vérifiée par l\'expert-comptable.'] },
  { href: '/documenti', it: ['Documenti', 'Archivio dei giustificativi. Lo stesso file caricato due volte non crea un secondo documento.'],
    fr: ['Documents', 'Archive des pièces justificatives. Le même fichier chargé deux fois ne crée pas un deuxième document.'] },
];

export default async function Guide() {
  const { t, lang } = await requireMe();
  return (
    <div className="stack">
      <PageHead title={t('nav_guide')} />
      {G.map((g) => {
        const [title, text] = lang === 'fr' ? g.fr : g.it;
        return (
          <Panel key={g.href} title={title} pad>
            <p style={{ margin: '0 0 10px' }}>{text}</p>
            <Link className="btn" href={g.href}>{title} →</Link>
          </Panel>
        );
      })}
    </div>
  );
}
