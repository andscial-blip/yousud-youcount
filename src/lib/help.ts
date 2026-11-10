// Guida dell'app: una voce per ogni scheda. Lo stesso testo compare nel pulsante (i) dell'intestazione di ogni
// scheda e nella pagina Guida, così non ci sono due versioni da tenere allineate. Va aggiornata quando cambia una funzione.
export type HelpEntry = { href: string; sec: string; it: [string, string[]]; fr: [string, string[]] };

export const HELP_SECTIONS: { id: string; it: string; fr: string }[] = [
  { id: 'start', it: 'Per cominciare', fr: 'Pour commencer' },
  { id: 'home', it: 'Dashboard', fr: 'Tableau de bord' },
  { id: 'mov', it: 'Movimenti', fr: 'Mouvements' },
  { id: 'cassa', it: 'Conti', fr: 'Comptes' },
  { id: 'bud', it: 'Preventivo', fr: 'Budget' },
  { id: 'prj', it: 'Progetti', fr: 'Projets' },
  { id: 'anal', it: 'Analisi', fr: 'Analyses' },
  { id: 'docs', it: 'Documenti', fr: 'Documents' },
  { id: 'set', it: 'Impostazioni', fr: 'Paramètres' },
];

export const HELP: HelpEntry[] = [
  { href: '/nuovo', sec: 'start',
    it: ['Registrare una spesa o un\'entrata', [
      'Premi «+ Nuovo movimento» (sul telefono il «+» al centro in basso). Prima cosa: fotografa o carica il giustificativo; l\'app legge il documento e propone data, importo, fornitore e codice. Controlla i campi evidenziati come incerti.',
      'Scegli il conto da cui escono o in cui entrano i soldi, il codice contabile e il progetto (per le spese fuori progetto: «Spese generali»). Per gli importi in ariary il tasso del mese viene proposto da solo e resta salvato sul movimento.',
      '«Salva bozza» non conta nei saldi; «Registra» assegna il numero MOV e il movimento entra in contabilità. Se il giustificativo non c\'è, va scritto il motivo; se hai pagato di tasca tua scegli «Di tasca propria, da rimborsare».',
      'Senza rete il movimento resta sul telefono e parte da solo appena torna la connessione (indicatore in alto).']],
    fr: ['Enregistrer une dépense ou une recette', [
      'Appuyez sur « + Nouveau mouvement » (sur téléphone le « + » au centre en bas). D\'abord : photographiez ou chargez la pièce ; l\'application lit le document et propose date, montant, fournisseur et code. Contrôlez les champs signalés comme incertains.',
      'Choisissez le compte, le code comptable et le projet (hors projet : « Spese generali »). Pour les montants en ariary, le taux du mois est proposé automatiquement et reste enregistré sur le mouvement.',
      '« Brouillon » ne compte pas dans les soldes ; « Comptabiliser » attribue le numéro MOV et le mouvement entre en comptabilité. Sans pièce, il faut indiquer le motif ; si vous avez payé de votre poche, choisissez « De sa poche, à rembourser ».',
      'Sans réseau, le mouvement reste sur le téléphone et part tout seul au retour de la connexion (indicateur en haut).']] },
  { href: '/', sec: 'home',
    it: ['Dashboard', [
      'A sinistra l\'anno in sintesi: entrate, uscite, avanzo e liquidità di oggi, il grafico mese per mese e le barre del preventivo. La tacca sulla barra indica quanta parte dell\'anno è passata: se la barra la supera di molto, la spesa corre più del previsto.',
      'A destra «Da fare» raccoglie ciò che chiede un\'azione: movimenti da verificare, rimborsi, anticipi aperti, codici oltre il preventivo, tasso del mese mancante, backup, scadenze vicine. Sotto: il cambio MGA/EUR e i saldi dei conti.',
      'Le cifre contano i movimenti registrati e verificati, in euro al tasso salvato su ciascun movimento; i giroconti non sono né entrate né uscite. L\'anno si cambia in alto a destra.',
      'Autonomia di cassa: per quanti mesi la liquidità di oggi copre le spese, al ritmo medio degli ultimi tre mesi chiusi; i rimborsi dovuti sono già tolti, gli anticipi al personale esclusi.']],
    fr: ['Tableau de bord', [
      'À gauche, l\'année en synthèse : recettes, dépenses, excédent et liquidités du jour, le graphique mois par mois et les barres du budget. Le repère sur la barre indique la part de l\'année écoulée : si la barre le dépasse nettement, la dépense va plus vite que prévu.',
      'À droite, « À faire » regroupe ce qui demande une action : mouvements à vérifier, remboursements, avances ouvertes, codes au-delà du budget, taux du mois manquant, sauvegarde, échéances proches. Dessous : le change MGA/EUR et les soldes des comptes.',
      'Les montants comptent les mouvements enregistrés et vérifiés, en euros au taux enregistré sur chaque mouvement ; les virements internes ne sont ni recettes ni dépenses. L\'année se change en haut à droite.',
      'Autonomie de trésorerie : nombre de mois que la trésorerie actuelle couvre au rythme moyen des trois derniers mois clos ; remboursements dus déduits, avances au personnel exclues.']] },
  { href: '/scadenze', sec: 'home',
    it: ['Scadenze', [
      'Elenco delle scadenze: quelle inserite a mano (pagamenti, rendicontazioni ai finanziatori) e gli adempimenti dell\'associazione proposti dall\'app (es. 770, dichiarazioni). Si segnano come fatte o si annullano.',
      'Le scadenze vicine e quelle scadute compaiono anche in «Da fare» nella Dashboard. Le date degli adempimenti fiscali vanno confermate con il commercialista.',
      'Le soglie si applicano alle entrate dell\'esercizio e vanno confermate con il commercialista. Gli adempimenti ricorrenti sono promemoria con la fonte indicata: le date si verificano ogni anno.']],
    fr: ['Échéances', [
      'Liste des échéances : celles saisies à la main (paiements, rapports aux bailleurs) et les obligations de l\'association proposées par l\'application. On les marque comme faites ou on les annule.',
      'Les échéances proches et en retard apparaissent aussi dans « À faire » du tableau de bord. Les dates fiscales sont à confirmer avec l\'expert-comptable.',
      'Les seuils s\'appliquent aux recettes de l\'exercice et sont à confirmer avec l\'expert-comptable. Les obligations récurrentes sont des rappels avec leur source : les dates se vérifient chaque année.']] },
  { href: '/movimenti', sec: 'mov',
    it: ['Registro dei movimenti', [
      'Ogni movimento nasce come bozza (non conta), viene registrato (riceve il numero MOV e conta nei saldi) e poi verificato da un responsabile. Il filtro «Da verificare» mostra i registrati non ancora controllati; dal dettaglio un responsabile li verifica.',
      'Ricerca e filtri si combinano: periodo, tipo, codice, progetto, fornitore o donatore, modalità di pagamento, conto, valuta, stato, giustificativo, dati reali o dimostrativi. Restano nell\'indirizzo della pagina: «Salva questo filtro» li ricorda su questo dispositivo, oppure mandi il link a un collega.',
      'I totali in alto riguardano tutti i movimenti filtrati (bozze e giroconti esclusi), in euro. Gli importi in ariary mostrano sotto il controvalore in euro.',
      'Un movimento registrato non si cancella: si corregge con uno storno dal dettaglio, così il registro resta completo. Si eliminano solo le bozze e i dati dimostrativi (DEMO).']],
    fr: ['Registre des mouvements', [
      'Chaque mouvement naît comme brouillon (il ne compte pas), puis il est enregistré (numéro MOV, il compte dans les soldes) et enfin vérifié par un responsable. Le filtre « À vérifier » montre les enregistrés pas encore contrôlés ; un responsable les vérifie depuis le détail.',
      'Recherche et filtres se combinent : période, type, code, projet, fournisseur ou donateur, mode de paiement, compte, devise, statut, justificatif, données réelles ou de démonstration. Ils restent dans l\'adresse de la page : « Enregistrer ce filtre » les garde sur cet appareil, ou envoyez le lien à un collègue.',
      'Les totaux en haut portent sur tous les mouvements filtrés (hors brouillons et virements internes), en euros. Les montants en ariary montrent dessous la contre-valeur en euros.',
      'Un mouvement enregistré ne se supprime pas : on le corrige par une contre-passation depuis le détail, pour que le registre reste complet. On supprime seulement les brouillons et les données de démonstration (DEMO).']] },
  { href: '/rimborsi', sec: 'mov',
    it: ['Spese da rimborsare', [
      'Chi paga di tasca propria registra la spesa con «Di tasca propria, da rimborsare»: non tocca i conti finché non viene rimborsata.',
      'Un responsabile rimborsa da questa pagina scegliendo il conto da cui escono i soldi: la spesa entra in contabilità con la data del rimborso.',
      'Spese pagate di tasca propria. Non toccano i conti finché non si rimborsano: il rimborso le registra con la data in cui escono i soldi, come vuole il rendiconto per cassa.']],
    fr: ['Dépenses à rembourser', [
      'Qui paie de sa poche enregistre la dépense avec « De sa poche, à rembourser » : elle ne touche pas les comptes avant le remboursement.',
      'Un responsable rembourse depuis cette page en choisissant le compte qui paie : la dépense entre en comptabilité à la date du remboursement.',
      'Dépenses payées de sa poche. Elles ne touchent pas les comptes tant qu’elles ne sont pas remboursées : le remboursement les enregistre à la date où l’argent sort, comme le veut le compte de caisse.']] },
  { href: '/documenti', sec: 'docs',
    it: ['Giustificativi', [
      'Archivio di scontrini, fatture e ricevute caricati con i movimenti. Ogni file prende il nome del movimento a cui è collegato; lo stesso file caricato due volte non crea un doppione (si riconosce dall\'impronta).',
      'Da qui si cercano i giustificativi e si vede a quale movimento appartengono. I documenti generati dall\'app (ricevute, notule…) sono in Documenti › Emessi; i rendiconti approvati in Documenti › Rendiconti.',
      '«Scarica tutti (ZIP)» raccoglie in un solo file i giustificativi dell\'anno o del mese scelto, con i nomi data_MOV-… (per il commercialista). Un giustificativo rimasto senza movimento si scarica dal suo nome e si collega scrivendo il numero del movimento.']],
    fr: ['Justificatifs', [
      'Archive des tickets, factures et reçus chargés avec les mouvements. Chaque fichier prend le nom du mouvement lié ; le même fichier chargé deux fois ne crée pas de doublon (reconnu par son empreinte).',
      'Ici on recherche les justificatifs et on voit à quel mouvement ils appartiennent. Les documents générés par l\'application (reçus, notes d\'honoraires…) sont dans Documents › Émis ; les comptes rendus approuvés dans Documents › Comptes rendus.',
      '« Tout télécharger (ZIP) » rassemble dans un seul fichier les justificatifs de l\'année ou du mois choisi, nommés date_MOV-… (pour le comptable). Un justificatif sans mouvement se télécharge depuis son nom et se lie en saisissant le numéro du mouvement.']] },
  { href: '/controparti', sec: 'mov',
    it: ['Controparti', [
      'Fornitori, donatori, finanziatori e beneficiari. I dati personali (codice fiscale, indirizzo) sono visibili solo a responsabili e amministratori.',
      'Una controparte collegata ai movimenti permette di filtrare il registro e di vedere nelle Analisi i principali fornitori e donatori.']],
    fr: ['Contreparties', [
      'Fournisseurs, donateurs, bailleurs et bénéficiaires. Les données personnelles (code fiscal, adresse) ne sont visibles que par les responsables et administrateurs.',
      'Une contrepartie liée aux mouvements permet de filtrer le registre et de voir dans les Analyses les principaux fournisseurs et donateurs.']] },
  { href: '/verifica', sec: 'mov',
    it: ['Verifica in blocco', [
      'Un responsabile controlla i movimenti registrati da altri e li segna come verificati (il super amministratore può verificare anche i propri). Un movimento verificato non si modifica più: un errore si corregge con uno storno.',
      'Movimenti registrati in attesa di verifica. Chi ha inserito un movimento non può verificarlo.']],
    fr: ['Vérification groupée', [
      'Un responsable contrôle les mouvements enregistrés par d\'autres et les marque comme vérifiés (le super administrateur peut aussi vérifier les siens). Un mouvement vérifié ne se modifie plus : une erreur se corrige par une contre-passation.',
      'Mouvements enregistrés en attente de vérification. La personne qui a saisi un mouvement ne peut pas le vérifier.']] },
  { href: '/conti', sec: 'cassa',
    it: ['Conti e cassa', [
      'Saldi di banca, cassa e mobile money in Italia (EUR) e in Madagascar (MGA): saldo iniziale più movimenti registrati e verificati. Un saldo negativo è in rosso: di solito manca una registrazione.',
      'La conta di cassa confronta i contanti contati con il saldo dell\'app e registra la differenza con chi l\'ha fatta.',
      'I saldi comprendono i movimenti registrati e verificati; gli storni sono già sottratti.',
      'Conta i contanti e registra il totale: l’app lo confronta con il saldo alla stessa data.']],
    fr: ['Comptes et caisse', [
      'Soldes de banque, caisse et mobile money en Italie (EUR) et à Madagascar (MGA) : solde initial plus mouvements enregistrés et vérifiés. Un solde négatif est en rouge : il manque en général un enregistrement.',
      'Le comptage de caisse compare les espèces comptées au solde de l\'application et enregistre l\'écart avec la personne qui l\'a fait.',
      'Les soldes incluent les mouvements enregistrés et vérifiés ; les extournes sont déjà déduites.',
      'Comptez les espèces et enregistrez le total : l’application le compare au solde à la même date.']] },
  { href: '/anticipi', sec: 'cassa',
    it: ['Anticipi e autocertificazioni', [
      'Come funziona: 1 chiedi i contanti con «+ Nuova richiesta» (per te o, se la persona non usa l\'app, un responsabile per lei), indicando cosa comprare e allegando il preventivo o la stima. 2 Il direttore o un responsabile autorizza (mai chi ha chiesto o chi riceve; oltre le soglie serve la delibera del Consiglio). 3 Si consegnano i contanti dalla cassa e si stampa la ricevuta di consegna da far firmare (poi si carica la copia firmata). 4 Ogni ricevuta o fattura si registra con «+ Ricevuta» dal portafoglio della persona: quello che ha in mano scende da solo. 5 Il resto si restituisce con «Restituzione»: a saldo zero l\'anticipo si chiude da solo.',
      'Chi ha un anticipo da giustificare oltre la scadenza non può riceverne un altro. Le scadenze compaiono in Scadenze. Nel portafoglio della persona c\'è l\'estratto: consegne, spese e restituzioni.',
      'Contanti consegnati a una persona: si registrano come consegna (escono dalla cassa) e restituzione. Le spese fatte con quei contanti si registrano con «Con l\'anticipo»: contano nel rendiconto senza ridurre di nuovo la cassa.',
      'Un anticipo aperto da oltre 30 giorni compare in «Da fare». Se manca lo scontrino, dal movimento si genera l\'autocertificazione AUT da stampare e far firmare.',
      'Contanti consegnati a una persona per le spese sul posto. La consegna esce dalla cassa ma non è una spesa; le spese pagate con l’anticipo contano nel rendiconto alla loro data e non riducono di nuovo la cassa; quello che resta va giustificato con le spese o restituito.']],
    fr: ['Avances et attestations', [
      'Fonctionnement : 1 demandez les espèces avec « + Nouvelle demande » (pour vous ou, si la personne n\'utilise pas l\'app, un responsable pour elle), en indiquant quoi acheter et en joignant le devis ou l\'estimation. 2 Le directeur ou un responsable autorise (jamais le demandeur ni le bénéficiaire ; au-delà des seuils il faut la délibération du Conseil). 3 On remet les espèces depuis la caisse et on imprime le reçu de remise à faire signer (puis on charge la copie signée). 4 Chaque reçu ou facture s\'enregistre avec « + Reçu » depuis le portefeuille de la personne : ce qu\'elle a en main diminue tout seul. 5 Le reste se restitue avec « Restitution » : à solde zéro l\'avance se clôture toute seule.',
      'Une personne avec une avance à justifier en retard ne peut pas en recevoir une autre. Les échéances apparaissent dans Échéances. « Fiche et impression » ouvre le récapitulatif à imprimer ou enregistrer en PDF et à faire signer.',
      'Espèces remises à une personne : enregistrées comme remise (sortie de caisse) et restitution. Les dépenses payées avec ces espèces s\'enregistrent avec « Avec l\'avance » : elles comptent sans réduire une seconde fois la caisse.',
      'Une avance ouverte depuis plus de 30 jours apparaît dans « À faire ». Sans ticket, on génère depuis le mouvement l\'attestation AUT à imprimer et faire signer.',
      'Espèces remises à une personne pour les dépenses sur place. La remise sort de la caisse mais n’est pas une dépense ; les dépenses payées avec l’avance comptent dans le rapport à leur date et ne réduisent pas une seconde fois la caisse ; le reste se justifie par des dépenses ou se restitue.']] },
  { href: '/riconciliazione', sec: 'cassa',
    it: ['Riconciliazione bancaria', [
      'Con l\'estratto conto: data e saldo dell\'estratto, poi spunta i movimenti che vi compaiono (si può importare l\'estratto da Excel o CSV). Si conferma quando la differenza è zero; i movimenti riconciliati restano bloccati.',
      'Una riga dell\'estratto senza movimento si registra con «Registra»: il modulo si apre già compilato con data, importo e descrizione.',
      'Confronta i movimenti dell’app con l’estratto conto. Inserisci data e saldo dell’estratto e spunta i movimenti che vi compaiono: si conferma quando la differenza è zero. I movimenti non spuntati (per esempio un assegno non ancora incassato) restano per l’estratto successivo.',
      'Le casse si controllano con la conta di cassa, nella pagina Conti.']],
    fr: ['Rapprochement bancaire', [
      'Avec le relevé : date et solde du relevé, puis cochez les mouvements qui y figurent (le relevé peut être importé d\'Excel ou CSV). On valide quand l\'écart est nul ; les mouvements rapprochés restent bloqués.',
      'Une ligne du relevé sans mouvement s\'enregistre avec « Enregistrer » : le formulaire s\'ouvre déjà rempli avec date, montant et description.',
      'Comparez les mouvements de l’app avec le relevé de compte. Saisissez la date et le solde du relevé et cochez les mouvements qui y figurent : on valide quand l’écart est nul. Les mouvements non cochés (par exemple un chèque pas encore encaissé) restent pour le relevé suivant.',
      'Les caisses se contrôlent avec le comptage de caisse, dans la page Comptes.']] },
  { href: '/cambi', sec: 'cassa',
    it: ['Tassi di cambio', [
      'Un tasso per mese, in ariary per 1 euro, con la fonte (banca, BFM, cambio effettivo). Viene proposto ai nuovi movimenti in ariary del mese.',
      'Tre nozioni: tasso del mese (quello inserito qui), tasso corrente (l\'ultimo mese disponibile fino a oggi), tasso applicato (quello salvato su ogni movimento). Correggere il tasso di un mese non cambia i movimenti già registrati; la modifica resta nello storico.',
      'Il grafico confronta il tasso del mese con la media dei tassi applicati ai movimenti, pesata sugli importi.']],
    fr: ['Taux de change', [
      'Un taux par mois, en ariary pour 1 euro, avec sa source (banque, BFM, taux effectif). Il est proposé aux nouveaux mouvements en ariary du mois.',
      'Trois notions : taux du mois (saisi ici), taux courant (dernier mois disponible jusqu\'à aujourd\'hui), taux appliqué (enregistré sur chaque mouvement). Corriger le taux d\'un mois ne change pas les mouvements déjà enregistrés ; la modification reste dans l\'historique.',
      'Le graphique compare le taux du mois à la moyenne des taux appliqués aux mouvements, pondérée par les montants.']] },
  { href: '/preventivo', sec: 'bud',
    it: ['Preventivo', [
      'Il preventivo è annuale e si compila in «Voci del preventivo», una riga per voce: codice di spesa o entrata, progetto, cosa, quantità e unità, costo unitario, valuta (in ariary con il tasso), note; il totale si calcola da solo. La riga di inserimento è sempre in fondo e dopo «Aggiungi» ripropone codice e progetto. Si approva con il riferimento della delibera; dopo si cambia con «Prepara una revisione» e le versioni precedenti restano consultabili.',
      '«Riepilogo» mostra il preventivo per entrate e uscite, gruppo e codice, e per progetto; in fondo lo schema del rendiconto (Mod. D). «Confronto con il consuntivo» ha una riga per codice: previsto, speso, residuo e percentuale (tacca = anno trascorso, rosso solo oltre il previsto). Si esporta in Excel.',
      'Si possono eliminare righe e bozze; una versione approvata reale la elimina solo un amministratore, indicando il motivo (resta traccia nel registro modifiche e torna in vigore la versione precedente).',
      'Schema del rendiconto: voci del modello D (rendiconto per cassa, DM 5 marzo 2020) con la stessa regola del consuntivo; le uscite dei progetti di struttura vanno nella sezione E. Il preventivo nello schema ETS è uno strumento interno: la legge non ne impone il formato.',
      'Consuntivo: movimenti registrati e verificati dell\'anno, in euro al cambio del movimento. Impegnato: spese ancora in bozza (rimborsi da pagare, spese da completare).']],
    fr: ['Budget', [
      'Le budget est annuel et se remplit dans « Postes du budget », une ligne par poste : code de dépense ou recette, projet, quoi, quantité et unité, coût unitaire, devise (en ariary avec le taux), notes ; le total se calcule tout seul. La ligne de saisie est toujours en bas et après « Ajouter » elle reprend le code et le projet. Il s\'approuve avec la référence de la délibération ; ensuite on le change avec « Préparer une révision » et les versions précédentes restent consultables.',
      '« Récapitulatif » présente le budget par recettes et dépenses, groupe et code, et par projet ; en bas le schéma du compte rendu (Mod. D). « Comparaison avec le réalisé » a une ligne par code : prévu, dépensé, reste et pourcentage (repère = année écoulée, rouge seulement au-delà du prévu). Export Excel.',
      'On peut supprimer des lignes et des brouillons ; une version approuvée réelle ne peut être supprimée que par un administrateur, avec le motif (trace dans l\'historique, la version précédente redevient en vigueur).',
      'Schéma du compte rendu : postes du modèle D (DM du 5 mars 2020) avec la même règle que le réalisé ; les dépenses des projets de structure vont en section E. Le budget au schéma ETS est un outil interne : la loi n\'en impose pas le format.',
      'Réalisé : mouvements enregistrés et vérifiés de l\'année, en euros au taux du mouvement. Engagé : dépenses encore en brouillon (remboursements à payer, dépenses à compléter).']] },
  { href: '/progetti', sec: 'prj',
    it: ['Progetti', [
      'In alto quattro riquadri per tutti i progetti: previsto, speso (con la quota dell\'anno trascorso), residuo e entrate; sotto, «Dove vanno i fondi» mostra il peso di ogni progetto sulle uscite.',
      'Una scheda per progetto: l\'anello è la parte del preventivo già spesa, la tacca verde segna l\'anno trascorso (se l\'anello la supera si spende più in fretta del ritmo lineare). Accanto speso, previsto e residuo; sotto le uscite mese per mese. Diventa rossa solo se si supera il preventivo.',
      'Aprendo la scheda si vede il cruscotto completo: andamento mensile, voci di spesa, preventivo per codice (si modifica nella pagina Preventivo), movimenti, scadenze, documenti e finanziamenti. L\'icona del tipo di attività la imposta un amministratore in Impostazioni › Progetti.']],
    fr: ['Projets', [
      'En haut, quatre encadrés pour tous les projets : prévu, dépensé (avec la part de l\'année écoulée), reste et recettes ; en dessous, « Où vont les fonds » montre le poids de chaque projet dans les dépenses.',
      'Une fiche par projet : l\'anneau est la part du budget déjà dépensée, le repère vert marque l\'année écoulée (si l\'anneau le dépasse, on dépense plus vite que le rythme linéaire). À côté, dépensé, prévu et reste ; en dessous, les dépenses mois par mois. Elle devient rouge seulement si le budget est dépassé.',
      'En ouvrant la fiche, on voit le tableau de bord complet : évolution mensuelle, postes de dépense, budget par code (il se modifie dans la page Budget), mouvements, échéances, documents et financements. L\'icône du type d\'activité est réglée par un administrateur dans Paramètres › Projets.']] },
  { href: '/finanziamenti', sec: 'prj',
    it: ['Finanziamenti', [
      'Per ogni finanziamento: importo, periodo, budget per gruppo di spesa e, scelto il periodo, il rendiconto al finanziatore in Excel con spese, giustificativi ed entrate.',
      'Entrate e spese collegate a questo finanziamento nel periodo scelto: riepilogo per gruppo di spesa con preventivo e residuo, elenco delle spese con i giustificativi, elenco delle entrate. Solo movimenti registrati o verificati.']],
    fr: ['Financements', [
      'Pour chaque financement : montant, période, budget par groupe de dépenses et, pour la période choisie, le rapport au bailleur en Excel avec dépenses, pièces et recettes.',
      'Recettes et dépenses liées à ce financement sur la période choisie : synthèse par groupe de dépenses avec budget et reste, liste des dépenses avec les justificatifs, liste des recettes. Seulement les mouvements comptabilisés ou vérifiés.']] },
  { href: '/analisi', sec: 'anal',
    it: ['Analisi', [
      'Schede: Panoramica, Entrate, Uscite, Progetti, Andamento e Preventivo e consuntivo. Il filtro progetto vale per tutte. Ogni voce porta ai movimenti che la compongono.',
      'Tutte le cifre sono in euro e contano i movimenti registrati e verificati dell\'anno scelto (bozze e giroconti esclusi; storni già sottratti). «Anno prima, stessi mesi» confronta lo stesso periodo dell\'anno precedente.',
      'Il preventivo è annuale: per capire se la spesa corre troppo si confronta la quota usata con la parte di anno trascorsa («oltre il ritmo» = più del 10% sopra).',
      'Paese del conto da cui escono i soldi.',
      'Euro, movimenti registrati e verificati. Clic su un mese per i suoi movimenti.']],
    fr: ['Analyses', [
      'Onglets : Vue d\'ensemble, Recettes, Dépenses, Projets, Évolution et Budget et réalisé. Le filtre projet vaut pour tous. Chaque poste mène aux mouvements qui le composent.',
      'Tous les montants sont en euros et comptent les mouvements enregistrés et vérifiés de l\'année choisie (hors brouillons et virements ; contre-passations déduites). « Année précédente, mêmes mois » compare la même période.',
      'Le budget est annuel : pour savoir si la dépense va trop vite, on compare la part utilisée à la part de l\'année écoulée (« au-delà du rythme » = plus de 10 % au-dessus).',
      'Pays du compte d’où sort l’argent.',
      'Euros, mouvements enregistrés et vérifiés. Cliquez sur un mois pour ses mouvements.']] },
  { href: '/rendiconto', sec: 'docs',
    it: ['Rendiconti', [
      'Bozza del rendiconto per cassa (Mod. D, enti del Terzo settore) calcolata dai movimenti, con le voci collegate alle categorie. La conformità la verifica il commercialista.',
      'In alto, «Versioni approvate e firmate»: dopo l\'approvazione in assemblea l\'amministratore archivia il PDF firmato con anno, data ed estremi del verbale («Archivia versione approvata»). Ogni versione si apre in anteprima e si scarica; non finisce fra i giustificativi.']],
    fr: ['Comptes rendus', [
      'Brouillon du compte rendu de caisse (modèle D, organismes du Tiers secteur italien) calculé à partir des mouvements. La conformité est vérifiée par l\'expert-comptable.',
      'En haut, « Versions approuvées et signées » : après l\'approbation par l\'assemblée, l\'administrateur archive le PDF signé avec l\'année, la date et les références du procès-verbal (« Archiver la version approuvée »). Chaque version s\'ouvre en aperçu et se télécharge ; elle ne figure pas parmi les justificatifs.']] },
  { href: '/report', sec: 'anal',
    it: ['Report', [
      'Report contabili dell\'anno con grafico e tabella, stampabili in PDF dal browser ed esportabili in Excel con gli stessi numeri.']],
    fr: ['Rapports', [
      'Rapports comptables de l\'année avec graphique et tableau, imprimables en PDF depuis le navigateur et exportables en Excel avec les mêmes chiffres.']] },
  { href: '/documenti-emessi', sec: 'docs',
    it: ['Documenti emessi', [
      'Qui ci sono solo i documenti generati e salvati da YouSud (non i modelli), divisi per tipo: ricevute e quietanze, notule, note di rimborso, autocertificazioni, autorizzazioni di spesa, dichiarazioni, note di debito e buoni d\'ordine. Le fatture non si emettono: YouSud non ha partita IVA.',
      '«+ Emetti»: scegli il tipo, compila i dati (precompilati se parti da un movimento o da un progetto) e guarda l\'anteprima che si aggiorna mentre scrivi. Il documento può essere in italiano, francese o bilingue; gli importi sono in euro (grande) e in ariary (piccolo) al tasso del mese o del movimento.',
      'La bozza non ha numero. «Emetti» assegna il numero definitivo (es. RIC-2026-004), genera il PDF con logo e dati dell\'associazione e lo collega al movimento. Un documento emesso non si modifica: «Correggi» crea una nuova bozza con gli stessi dati e l\'originale si annulla con il motivo. «Archivia» toglie dall\'elenco i documenti chiusi senza cancellarli.']],
    fr: ['Documents émis', [
      'Ici se trouvent seulement les documents générés et enregistrés par YouSud (pas les modèles), par type : reçus et quittances, notes d\'honoraires, notes de frais, attestations, autorisations de dépense, déclarations, notes de débit et bons de commande. Pas de factures : YouSud n\'a pas de numéro de TVA.',
      '« + Émettre » : choisissez le type, remplissez les données (préremplies si vous partez d\'un mouvement ou d\'un projet) et regardez l\'aperçu qui se met à jour pendant la saisie. Le document peut être en italien, en français ou bilingue ; les montants sont en euros (grand) et en ariary (petit) au taux du mois ou du mouvement.',
      'Le brouillon n\'a pas de numéro. « Émettre » attribue le numéro définitif (ex. RIC-2026-004), génère le PDF avec logo et données de l\'association et le lie au mouvement. Un document émis ne se modifie pas : « Corriger » crée un nouveau brouillon avec les mêmes données et l\'original s\'annule avec le motif. « Archiver » retire de la liste les documents clos sans les supprimer.']] },
  { href: '/account', sec: 'set',
    it: ['Il tuo account', ['Nome, lingua dell\'app (italiano o francese) e password.']],
    fr: ['Votre compte', ['Nom, langue de l\'application (italien ou français) et mot de passe.']] },
  { href: '/admin/utenti', sec: 'set',
    it: ['Utenti', ['Inviti per email, ruolo (amministratore, responsabile, operatore, sola lettura) e progetti visibili a ciascuno. Un utente sospeso non vede e non registra nulla.']],
    fr: ['Utilisateurs', ['Invitations par e-mail, rôle (administrateur, responsable, opérateur, lecture seule) et projets visibles pour chacun. Un utilisateur suspendu ne voit et n\'enregistre rien.']] },
  { href: '/admin/conti', sec: 'set',
    it: ['Conti (amministrazione)', ['Elenco dei conti con saldo e data di apertura. Valuta e paese si scelgono alla creazione e poi non cambiano.']],
    fr: ['Comptes (administration)', ['Liste des comptes avec solde et date d\'ouverture. Devise et pays se choisissent à la création et ne changent plus.']] },
  { href: '/admin/piano-conti', sec: 'set',
    it: ['Categorie', ['Le categorie (il «piano dei conti» per il commercialista) sono i codici contabili di entrata e di uscita raggruppati come nel Gestionale YouSud, ciascuno collegato a una voce del rendiconto ETS.']],
    fr: ['Catégories', ['Les catégories (le « plan comptable » pour l’expert-comptable) sont les codes comptables de recettes et de dépenses regroupés comme dans le Gestionale YouSud, chacun lié à un poste du compte rendu ETS.']] },
  { href: '/admin/progetti', sec: 'set',
    it: ['Progetti (amministrazione)', ['Ogni movimento va su un progetto oppure su «Struttura e spese generali» (sede, amministrazione, spese comuni): non servono centri di costo a parte. Per ciascuno: nome, codice, tipo di attività (icona), date e stato. Un progetto non attivo non si propone nei nuovi movimenti ma resta nei report.']],
    fr: ['Projets (administration)', ['Chaque mouvement va sur un projet ou sur « Structure et frais généraux » (siège, administration, frais communs) : pas besoin de centres de coût séparés. Pour chacun : nom, code, type d\'activité (icône), dates et statut. Un projet inactif n\'est plus proposé mais reste dans les rapports.']] },
  { href: '/admin/periodi', sec: 'set',
    it: ['Chiusure mensili', ['Chiudere un mese blocca nuove registrazioni con data in quel mese. Si chiude dopo aver verificato tutti i movimenti del mese.',
      'Si chiude un mese quando tutti i suoi movimenti sono verificati. Dopo la chiusura in quel mese non si registra né si modifica nulla; riaprire spetta al super amministratore.']],
    fr: ['Clôtures mensuelles', ['Clôturer un mois bloque les nouveaux enregistrements datés de ce mois. On clôture après avoir vérifié tous les mouvements du mois.',
      'On clôture un mois quand tous ses mouvements sont vérifiés. Ensuite, rien ne s’enregistre ni ne se modifie dans ce mois ; la réouverture revient au super administrateur.']] },
  { href: '/admin/impostazioni', sec: 'set',
    it: ['Ente e documenti', [
      'Dati dell\'associazione usati nei documenti (denominazione legale, sede, codice fiscale, IBAN, iscrizione RUNTS, contatti), firmatario e logo.',
      'Qui si scelgono anche le regole: controllo a quattro occhi, giustificativo obbligatorio, lettura dei documenti con l\'AI.',
      'Compaiono nell\'intestazione di tutti i documenti emessi (ricevute, quietanze, notule, note spese, autocertificazioni). Il firmatario è chi firma per l\'ente.',
      'In fondo, «Sede in Madagascar»: numero e date dell\'accordo di sede, ministeri, rappresentante legale, NIF, STAT, CNaPS, conti e firmatari, esenzioni. Con la data di scadenza l\'app mette in Scadenze il promemoria di rinnovo 6 mesi prima. I dati li inserisce l\'amministratore dai documenti ufficiali.']],
    fr: ['Organisme et documents', [
      'Données de l\'association utilisées dans les documents (dénomination légale, siège, code fiscal, IBAN, inscription RUNTS, contacts), signataire et logo.',
      'Ici se choisissent aussi les règles : contrôle à quatre yeux, justificatif obligatoire, lecture des documents par l\'IA.',
      'Elles figurent dans l\'en-tête de tous les documents émis (reçus, quittances, notes d\'honoraires, notes de frais, attestations). Le signataire est celui qui signe pour l\'association.',
      'En bas, « Siège à Madagascar » : numéro et dates de l\'accord de siège, ministères, représentant légal, NIF, STAT, CNaPS, comptes et signataires, exonérations. Avec la date d\'expiration, l\'app ajoute dans Échéances le rappel de renouvellement 6 mois avant. Les données sont saisies par l\'administrateur à partir des documents officiels.']] },
  { href: '/admin/dati', sec: 'set',
    it: ['Dati e sicurezza', [
      'Backup completo in Excel da salvare nel Drive condiviso di YouSud; chiavi per collegare altre app. I dati dimostrativi si caricano e si svuotano da qui, con conferma del numero.',
      'Solo il super amministratore, prima dell\'avvio: «Azzera movimenti e preventivi» elimina tutti i movimenti e i preventivi di collaudo. Serve un backup scaricato nelle ultime 24 ore e la parola AZZERA; la numerazione MOV riparte da 001.',
      'Tutti i dati dell’app (movimenti, conti, categorie, progetti, controparti, registro delle modifiche) in un file Excel, un foglio per tabella. Conservalo nel Drive condiviso di YouSud. I file dei giustificativi restano nell’archivio dell’app: il foglio documents ne elenca percorso e impronta.']],
    fr: ['Données et sécurité', [
      'Sauvegarde complète en Excel à enregistrer dans le Drive partagé de YouSud ; clés pour relier d\'autres applications. Les données de démonstration se chargent et se vident ici, avec confirmation du nombre.',
      'Seulement le super administrateur, avant le lancement : « Remettre à zéro » supprime tous les mouvements et budgets de test. Il faut une sauvegarde de moins de 24 heures et le mot AZZERA ; la numérotation MOV repart de 001.',
      'Toutes les données de l’app (mouvements, comptes, catégories, projets, tiers, journal des modifications) dans un fichier Excel, une feuille par table. Conservez-le dans le Drive partagé de YouSud. Les fichiers des pièces restent dans l’archive de l’app : la feuille documents indique leur chemin et leur empreinte.']] },
  { href: '/admin/registro', sec: 'set',
    it: ['Registro modifiche', ['Ogni creazione, modifica ed eliminazione con data, ora e autore, filtrabile per tabella e persona.']],
    fr: ['Historique des modifications', ['Chaque création, modification et suppression avec date, heure et auteur, filtrable par table et personne.']] },
  { href: '/sincronizzazione', sec: 'set',
    it: ['Sincronizzazione', ['Stato degli invii dal telefono al server: movimenti salvati senza rete e in attesa, ultimi invii riusciti.',
      'Senza rete i movimenti nuovi restano sul telefono e partono da soli appena torna la connessione. Per usare l’app offline aprila almeno una volta con la rete.']],
    fr: ['Synchronisation', ['État des envois du téléphone vers le serveur : mouvements enregistrés hors ligne en attente, derniers envois réussis.',
      'Sans réseau, les nouveaux mouvements restent sur le téléphone et partent tout seuls dès le retour de la connexion. Pour utiliser l’app hors ligne, ouvrez-la au moins une fois avec le réseau.']] },
];

// Voce della guida per un indirizzo: la più specifica che lo contiene (/movimenti/123 → Registro).
export function helpFor(path: string): HelpEntry | null {
  let best: HelpEntry | null = null;
  for (const h of HELP) {
    const hit = h.href === '/' ? path === '/' : path === h.href || path.startsWith(h.href + '/');
    if (hit && (!best || h.href.length > best.href.length)) best = h;
  }
  return best;
}
