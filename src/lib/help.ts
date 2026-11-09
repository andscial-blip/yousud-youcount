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
      '« Enregistrer le brouillon » ne compte pas dans les soldes ; « Enregistrer » attribue le numéro MOV et le mouvement entre en comptabilité. Sans pièce, il faut indiquer le motif ; si vous avez payé de votre poche, choisissez « De sa poche, à rembourser ».',
      'Sans réseau, le mouvement reste sur le téléphone et part tout seul au retour de la connexion (indicateur en haut).']] },
  { href: '/', sec: 'home',
    it: ['Dashboard', [
      'A sinistra l\'anno in sintesi: entrate, uscite, avanzo e liquidità di oggi, il grafico mese per mese e le barre del preventivo. La tacca sulla barra indica quanta parte dell\'anno è passata: se la barra la supera di molto, la spesa corre più del previsto.',
      'A destra «Da fare» raccoglie ciò che chiede un\'azione: movimenti da verificare, rimborsi, anticipi aperti, codici oltre il preventivo, tasso del mese mancante, backup, scadenze vicine. Sotto: il cambio MGA/EUR e i saldi dei conti.',
      'Le cifre contano i movimenti registrati e verificati, in euro al tasso salvato su ciascun movimento; i giroconti non sono né entrate né uscite. L\'anno si cambia in alto a destra.']],
    fr: ['Tableau de bord', [
      'À gauche, l\'année en synthèse : recettes, dépenses, excédent et liquidités du jour, le graphique mois par mois et les barres du budget. Le repère sur la barre indique la part de l\'année écoulée : si la barre le dépasse nettement, la dépense va plus vite que prévu.',
      'À droite, « À faire » regroupe ce qui demande une action : mouvements à vérifier, remboursements, avances ouvertes, codes au-delà du budget, taux du mois manquant, sauvegarde, échéances proches. Dessous : le change MGA/EUR et les soldes des comptes.',
      'Les montants comptent les mouvements enregistrés et vérifiés, en euros au taux enregistré sur chaque mouvement ; les virements internes ne sont ni recettes ni dépenses. L\'année se change en haut à droite.']] },
  { href: '/scadenze', sec: 'home',
    it: ['Scadenze', [
      'Elenco delle scadenze: quelle inserite a mano (pagamenti, rendicontazioni ai finanziatori) e gli adempimenti dell\'associazione proposti dall\'app (es. 770, dichiarazioni). Si segnano come fatte o si annullano.',
      'Le scadenze vicine e quelle scadute compaiono anche in «Da fare» nella Dashboard. Le date degli adempimenti fiscali vanno confermate con il commercialista.']],
    fr: ['Échéances', [
      'Liste des échéances : celles saisies à la main (paiements, rapports aux bailleurs) et les obligations de l\'association proposées par l\'application. On les marque comme faites ou on les annule.',
      'Les échéances proches et en retard apparaissent aussi dans « À faire » du tableau de bord. Les dates fiscales sont à confirmer avec l\'expert-comptable.']] },
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
      'Un responsabile rimborsa da questa pagina scegliendo il conto da cui escono i soldi: la spesa entra in contabilità con la data del rimborso.']],
    fr: ['Dépenses à rembourser', [
      'Qui paie de sa poche enregistre la dépense avec « De sa poche, à rembourser » : elle ne touche pas les comptes avant le remboursement.',
      'Un responsable rembourse depuis cette page en choisissant le compte qui paie : la dépense entre en comptabilité à la date du remboursement.']] },
  { href: '/documenti', sec: 'mov',
    it: ['Giustificativi', [
      'Archivio di scontrini, fatture e ricevute caricati con i movimenti. Ogni file prende il nome del movimento a cui è collegato; lo stesso file caricato due volte non crea un doppione (si riconosce dall\'impronta).',
      'Da qui si cercano i giustificativi e si vede a quale movimento appartengono. I documenti generati dall\'app (ricevute, notule…) sono invece nella sezione Documenti.']],
    fr: ['Justificatifs', [
      'Archive des tickets, factures et reçus chargés avec les mouvements. Chaque fichier prend le nom du mouvement lié ; le même fichier chargé deux fois ne crée pas de doublon (reconnu par son empreinte).',
      'Ici on recherche les justificatifs et on voit à quel mouvement ils appartiennent. Les documents générés par l\'application (reçus, notes d\'honoraires…) sont dans la section Documents.']] },
  { href: '/controparti', sec: 'mov',
    it: ['Controparti', [
      'Fornitori, donatori, finanziatori e beneficiari. I dati personali (codice fiscale, indirizzo) sono visibili solo a responsabili e amministratori.',
      'Una controparte collegata ai movimenti permette di filtrare il registro e di vedere nelle Analisi i principali fornitori e donatori.']],
    fr: ['Contreparties', [
      'Fournisseurs, donateurs, bailleurs et bénéficiaires. Les données personnelles (code fiscal, adresse) ne sont visibles que par les responsables et administrateurs.',
      'Une contrepartie liée aux mouvements permet de filtrer le registre et de voir dans les Analyses les principaux fournisseurs et donateurs.']] },
  { href: '/verifica', sec: 'mov',
    it: ['Verifica in blocco', [
      'Un responsabile controlla i movimenti registrati da altri e li segna come verificati. Un movimento verificato non si modifica più: un errore si corregge con uno storno.']],
    fr: ['Vérification groupée', [
      'Un responsable contrôle les mouvements enregistrés par d\'autres et les marque comme vérifiés. Un mouvement vérifié ne se modifie plus : une erreur se corrige par une contre-passation.']] },
  { href: '/conti', sec: 'cassa',
    it: ['Conti e cassa', [
      'Saldi di banca, cassa e mobile money in Italia (EUR) e in Madagascar (MGA): saldo iniziale più movimenti registrati e verificati. Un saldo negativo è in rosso: di solito manca una registrazione.',
      'La conta di cassa confronta i contanti contati con il saldo dell\'app e registra la differenza con chi l\'ha fatta.']],
    fr: ['Comptes et caisse', [
      'Soldes de banque, caisse et mobile money en Italie (EUR) et à Madagascar (MGA) : solde initial plus mouvements enregistrés et vérifiés. Un solde négatif est en rouge : il manque en général un enregistrement.',
      'Le comptage de caisse compare les espèces comptées au solde de l\'application et enregistre l\'écart avec la personne qui l\'a fait.']] },
  { href: '/anticipi', sec: 'cassa',
    it: ['Anticipi e autocertificazioni', [
      'Contanti consegnati a una persona: si registrano come consegna (escono dalla cassa) e restituzione. Le spese fatte con quei contanti si registrano con «Con l\'anticipo»: contano nel rendiconto senza ridurre di nuovo la cassa.',
      'Un anticipo aperto da oltre 30 giorni compare in «Da fare». Se manca lo scontrino, dal movimento si genera l\'autocertificazione AUT da stampare e far firmare.']],
    fr: ['Avances et attestations', [
      'Espèces remises à une personne : enregistrées comme remise (sortie de caisse) et restitution. Les dépenses payées avec ces espèces s\'enregistrent avec « Avec l\'avance » : elles comptent sans réduire une seconde fois la caisse.',
      'Une avance ouverte depuis plus de 30 jours apparaît dans « À faire ». Sans ticket, on génère depuis le mouvement l\'attestation AUT à imprimer et faire signer.']] },
  { href: '/riconciliazione', sec: 'cassa',
    it: ['Riconciliazione bancaria', [
      'Con l\'estratto conto: data e saldo dell\'estratto, poi spunta i movimenti che vi compaiono (si può importare l\'estratto da Excel o CSV). Si conferma quando la differenza è zero; i movimenti riconciliati restano bloccati.',
      'Una riga dell\'estratto senza movimento si registra con «Registra»: il modulo si apre già compilato con data, importo e descrizione.']],
    fr: ['Rapprochement bancaire', [
      'Avec le relevé : date et solde du relevé, puis cochez les mouvements qui y figurent (le relevé peut être importé d\'Excel ou CSV). On valide quand l\'écart est nul ; les mouvements rapprochés restent bloqués.',
      'Une ligne du relevé sans mouvement s\'enregistre avec « Enregistrer » : le formulaire s\'ouvre déjà rempli avec date, montant et description.']] },
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
      'Il preventivo è annuale e si costruisce per righe: codice contabile, progetto, quantità × costo unitario, in euro o in ariary. Si approva con il riferimento della delibera; dopo si cambia solo con una revisione e le versioni precedenti restano consultabili.',
      '«Preventivo e consuntivo» confronta ogni codice con quanto speso e incassato; «Schema del rendiconto» lo mostra con le voci del rendiconto ETS. Si esporta in Excel.',
      'Si possono eliminare righe e bozze; una versione approvata reale la elimina solo un amministratore, indicando il motivo (resta traccia nel registro modifiche e torna in vigore la versione precedente).']],
    fr: ['Budget', [
      'Le budget est annuel et se construit par lignes : code comptable, projet, quantité × coût unitaire, en euros ou en ariary. Il s\'approuve avec la référence de la délibération ; ensuite il ne change que par une révision et les versions précédentes restent consultables.',
      '« Budget et réalisé » compare chaque code avec le dépensé et l\'encaissé ; « Schéma du compte rendu » le présente avec les postes du compte rendu ETS. Export Excel.',
      'On peut supprimer des lignes et des brouillons ; une version approuvée réelle ne peut être supprimée que par un administrateur, avec le motif (trace dans l\'historique, la version précédente redevient en vigueur).']] },
  { href: '/progetti', sec: 'prj',
    it: ['Progetti', [
      'Una scheda per progetto: preventivo dell\'anno, uscite, entrate, saldo (entrate − uscite) e residuo (preventivo − uscite), con la barra della quota usata e la tacca del tempo trascorso.',
      'Un solo avviso per scheda: oltre il preventivo, spesa più veloce del tempo (oltre 15 punti) o spese senza preventivo. Aprendo la scheda si vede il cruscotto completo: andamento mensile, voci di spesa, preventivo per codice, movimenti, scadenze, documenti e finanziamenti.',
      'L\'icona indica il tipo di attività; un amministratore la imposta in Impostazioni › Centri di costo.']],
    fr: ['Projets', [
      'Une fiche par projet : budget de l\'année, dépenses, recettes, solde (recettes − dépenses) et reste (budget − dépenses), avec la barre de la part utilisée et le repère du temps écoulé.',
      'Une seule alerte par fiche : au-delà du budget, dépense plus rapide que le temps (plus de 15 points) ou dépenses sans budget. La fiche ouvre le tableau de bord complet : évolution mensuelle, postes, budget par code, mouvements, échéances, documents et financements.',
      'L\'icône indique le type d\'activité ; un administrateur la règle dans Paramètres › Centres de coût.']] },
  { href: '/finanziamenti', sec: 'prj',
    it: ['Finanziamenti', [
      'Per ogni finanziamento: importo, periodo, budget per gruppo di spesa e, scelto il periodo, il rendiconto al finanziatore in Excel con spese, giustificativi ed entrate.']],
    fr: ['Financements', [
      'Pour chaque financement : montant, période, budget par groupe de dépenses et, pour la période choisie, le rapport au bailleur en Excel avec dépenses, pièces et recettes.']] },
  { href: '/analisi', sec: 'anal',
    it: ['Analisi', [
      'Schede: Panoramica, Entrate, Uscite, Progetti, Andamento e Preventivo e consuntivo. Il filtro progetto vale per tutte. Ogni voce porta ai movimenti che la compongono.',
      'Tutte le cifre sono in euro e contano i movimenti registrati e verificati dell\'anno scelto (bozze e giroconti esclusi; storni già sottratti). «Anno prima, stessi mesi» confronta lo stesso periodo dell\'anno precedente.',
      'Il preventivo è annuale: per capire se la spesa corre troppo si confronta la quota usata con la parte di anno trascorsa («oltre il ritmo» = più del 10% sopra).']],
    fr: ['Analyses', [
      'Onglets : Vue d\'ensemble, Recettes, Dépenses, Projets, Évolution et Budget et réalisé. Le filtre projet vaut pour tous. Chaque poste mène aux mouvements qui le composent.',
      'Tous les montants sont en euros et comptent les mouvements enregistrés et vérifiés de l\'année choisie (hors brouillons et virements ; contre-passations déduites). « Année précédente, mêmes mois » compare la même période.',
      'Le budget est annuel : pour savoir si la dépense va trop vite, on compare la part utilisée à la part de l\'année écoulée (« au-delà du rythme » = plus de 10 % au-dessus).']] },
  { href: '/rendiconto', sec: 'anal',
    it: ['Rendiconto', [
      'Bozza del rendiconto per cassa (Mod. D, enti del Terzo settore) calcolata dai movimenti, con le voci collegate al piano dei conti. La conformità la verifica il commercialista.']],
    fr: ['Compte rendu', [
      'Brouillon du compte rendu de caisse (modèle D, organismes du Tiers secteur italien) calculé à partir des mouvements. La conformité est vérifiée par l\'expert-comptable.']] },
  { href: '/report', sec: 'anal',
    it: ['Report', [
      'Report contabili dell\'anno con grafico e tabella, stampabili in PDF dal browser ed esportabili in Excel con gli stessi numeri.']],
    fr: ['Rapports', [
      'Rapports comptables de l\'année avec graphique et tableau, imprimables en PDF depuis le navigateur et exportables en Excel avec les mêmes chiffres.']] },
  { href: '/documenti-emessi', sec: 'docs',
    it: ['Documenti emessi', [
      'Qui ci sono solo i documenti generati e salvati da YouSud (non i modelli), divisi per tipo: ricevute e quietanze, notule, note di rimborso, autocertificazioni, autorizzazioni di spesa, dichiarazioni, note di debito e buoni d\'ordine. Le fatture non si emettono: YouSud non ha partita IVA.',
      '«+ Emetti nuovo documento»: scegli il tipo, compila i dati (precompilati se parti da un movimento o da un progetto) e guarda l\'anteprima che si aggiorna mentre scrivi. Il documento può essere in italiano, francese o bilingue; gli importi sono in euro (grande) e in ariary (piccolo) al tasso del mese o del movimento.',
      'La bozza non ha numero. «Emetti» assegna il numero definitivo (es. RIC-2026-004), genera il PDF con logo e dati dell\'associazione e lo collega al movimento. Un documento emesso non si modifica: «Correggi» crea una nuova bozza con gli stessi dati e l\'originale si annulla con il motivo. «Archivia» toglie dall\'elenco i documenti chiusi senza cancellarli.']],
    fr: ['Documents émis', [
      'Ici se trouvent seulement les documents générés et enregistrés par YouSud (pas les modèles), par type : reçus et quittances, notes d\'honoraires, notes de frais, attestations, autorisations de dépense, déclarations, notes de débit et bons de commande. Pas de factures : YouSud n\'a pas de numéro de TVA.',
      '« + Émettre un nouveau document » : choisissez le type, remplissez les données (préremplies si vous partez d\'un mouvement ou d\'un projet) et regardez l\'aperçu qui se met à jour pendant la saisie. Le document peut être en italien, en français ou bilingue ; les montants sont en euros (grand) et en ariary (petit) au taux du mois ou du mouvement.',
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
    it: ['Piano dei conti', ['Codici contabili di entrata e di uscita raggruppati come nel Gestionale YouSud, ciascuno collegato a una voce del rendiconto ETS.']],
    fr: ['Plan comptable', ['Codes comptables de recettes et de dépenses regroupés comme dans le Gestionale YouSud, chacun lié à un poste du compte rendu ETS.']] },
  { href: '/admin/progetti', sec: 'set',
    it: ['Centri di costo', ['Progetti e struttura: nome, codice, tipo di attività (icona), date e stato. Un progetto non attivo non si propone nei nuovi movimenti ma resta nei report.']],
    fr: ['Centres de coût', ['Projets et structure : nom, code, type d\'activité (icône), dates et statut. Un projet inactif n\'est plus proposé mais reste dans les rapports.']] },
  { href: '/admin/periodi', sec: 'set',
    it: ['Chiusure mensili', ['Chiudere un mese blocca nuove registrazioni con data in quel mese. Si chiude dopo aver verificato tutti i movimenti del mese.']],
    fr: ['Clôtures mensuelles', ['Clôturer un mois bloque les nouveaux enregistrements datés de ce mois. On clôture après avoir vérifié tous les mouvements du mois.']] },
  { href: '/admin/impostazioni', sec: 'set',
    it: ['Ente e impostazioni', [
      'Dati dell\'associazione usati nei documenti (denominazione legale, sede, codice fiscale, IBAN, iscrizione RUNTS, contatti), firmatario e logo.',
      'Backup completo in Excel da salvare nel Drive condiviso di YouSud; chiavi per collegare altre app. I dati dimostrativi si caricano e si svuotano da qui, con conferma del numero.']],
    fr: ['Organisme et paramètres', [
      'Données de l\'association utilisées dans les documents (dénomination légale, siège, code fiscal, IBAN, inscription RUNTS, contacts), signataire et logo.',
      'Sauvegarde complète en Excel à enregistrer dans le Drive partagé de YouSud ; clés pour relier d\'autres applications. Les données de démonstration se chargent et se vident ici, avec confirmation du nombre.']] },
  { href: '/admin/registro', sec: 'set',
    it: ['Registro modifiche', ['Ogni creazione, modifica ed eliminazione con data, ora e autore, filtrabile per tabella e persona.']],
    fr: ['Historique des modifications', ['Chaque création, modification et suppression avec date, heure et auteur, filtrable par table et personne.']] },
  { href: '/sincronizzazione', sec: 'set',
    it: ['Sincronizzazione', ['Stato degli invii dal telefono al server: movimenti salvati senza rete e in attesa, ultimi invii riusciti.']],
    fr: ['Synchronisation', ['État des envois du téléphone vers le serveur : mouvements enregistrés hors ligne en attente, derniers envois réussis.']] },
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
