import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

// Guida breve: cosa si fa in ogni sezione. Va aggiornata quando cambia una funzione.
const G: { href: string; it: [string, string]; fr: [string, string] }[] = [
  { href: '/nuovo', it: ['Registrare una spesa o un\'entrata', 'Premi «+», fotografa o carica il giustificativo, controlla i campi proposti e registra. Se il giustificativo non c\'è, va scritto il motivo. L\'IA legge il documento e propone i campi: quelli incerti sono evidenziati.'],
    fr: ['Enregistrer une dépense ou une recette', 'Appuyez sur « + », photographiez ou chargez la pièce, contrôlez les champs proposés et enregistrez. Sans pièce, il faut en indiquer le motif. L\'IA lit le document et propose les champs : ceux qui sont incertains sont signalés.'] },
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
  { href: '/rimborsi', it: ['Spese da rimborsare', 'Chi paga di tasca propria sceglie «Di tasca propria, da rimborsare». Un responsabile rimborsa dalla pagina Da rimborsare: la spesa entra nei conti con la data del rimborso.'],
    fr: ['Dépenses à rembourser', 'Qui paie de sa poche choisit « De sa poche, à rembourser ». Un responsable rembourse depuis la page À rembourser : la dépense entre dans les comptes à la date du remboursement.'] },
  { href: '/anticipi', it: ['Anticipi e autocertificazioni', 'Contanti dati a una persona: si registrano da Anticipi come consegna (esce dalla cassa) e restituzione. Le spese fatte con quei contanti si registrano con «Con l’anticipo»: contano nel rendiconto senza ridurre di nuovo la cassa. Se manca lo scontrino, dal movimento si genera l’autocertificazione AUT da stampare e far firmare.'],
    fr: ['Avances et attestations', 'Espèces remises à une personne : elles s’enregistrent depuis Avances comme remise (sortie de caisse) et restitution. Les dépenses payées avec ces espèces s’enregistrent avec « Avec l’avance » : elles comptent dans le rapport sans réduire une seconde fois la caisse. Sans ticket, on génère depuis le mouvement l’attestation AUT à imprimer et faire signer.'] },
  { href: '/riconciliazione', it: ['Riconciliazione bancaria', 'Con l\'estratto conto in mano: data e saldo dell\'estratto, poi spunta i movimenti che compaiono. Si conferma quando la differenza è zero.'],
    fr: ['Rapprochement bancaire', 'Avec le relevé en main : date et solde du relevé, puis cochez les mouvements qui y figurent. On valide quand l\'écart est nul.'] },
  { href: '/finanziamenti', it: ['Finanziamenti e rendiconto al finanziatore', 'Per ogni finanziamento: budget per gruppo di spesa e, scelto il periodo, il rendiconto in Excel con spese, giustificativi ed entrate.'],
    fr: ['Financements et rapport au bailleur', 'Pour chaque financement : budget par groupe de dépenses et, pour la période choisie, le rapport Excel avec dépenses, pièces et recettes.'] },
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
