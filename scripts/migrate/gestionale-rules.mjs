// Regole del Gestionale YouSud copiate senza modifiche da app.html (artifact 7ebd59f3).
// Servono a riprodurre esattamente il suo passaggio ai codici versione 2. Non modificare a mano.
const MIG_THR=500; // soglia di capitalizzazione indicativa (€ per unità): sopra = bene durevole
const MIG_IN={"E101":"E101","E102":"E102","E104":"E302","E105":"E101","E201":"E301","E202":"E304","E203":"E303","E204":"E302","E301":"E202","E302":"E203","E303":"E204","E304":"E204","E401":"E104","E501":"E105","E502":"E202","E601":"E401","E602":"E402","E603":"E403","E701":"E106","E702":"E509","E801":"E205","E802":"E101","E901":"E501","E902":"E502","E903":"E503","E904":"E904"};
function migTarget(old,desc,prj,unit){
  if(old[0]==="E"){if(old==="E103")return prj&&prj!=="General"?"E201":"E103";return MIG_IN[old]||null}
  const d=(desc||"").toLowerCase();
  const M={"101":"101","102":"102","103":"103","105":"104","201":"201","202":"202","203":"206","204":"204","205":"203","206":"504","304":"303","305":"403","306":"304","401":"107","403":"704","404":"301","405":"701","501":"601","502":"505","503":"607","504":"506","505":"602","506":"603","507":"604","508":"606","509":"605","601":"608","701":"801","702":"802","703":"803","704":"804","801":"609","802":"205","803":"907","804":"402","901":"901","902":"902","903":"903","904":"806","905":"904","906":"905","907":"906"};
  switch(old){
    case"104":return /alloggi|alloggio|hotel/.test(d)?"203":"105";
    case"301":if(/ingredient|mensa|aliment|pasti|\briso\b|spezie|\bcibo/.test(d))return"307";if(/sement|\bsemi\b|piantin|concim|agricol|pianta/.test(d))return"304";if(/quaderni|scolast|matite|gessett|didattic/.test(d))return"303";if(/cancelleria/.test(d))return"402";return"401";
    case"302":case"303":{const it=/comput|laptop|portatile|tablet|stampante|router/.test(d);if(unit<MIG_THR)return"405";return it?"502":old==="302"?"501":"503"}
    case"402":return /consulente|fundrais/.test(d)?"103":"305";
    case"602":return prj==="General"?"108":"308";
    case"899":if(/affitto/.test(d))return"309";if(/monitor/.test(d))return"705";if(/iscrizion|tornei|torneo|event|amichevol/.test(d))return"302";return"999";
  }
  return M[old]||null;
}
const CODES_EX_OLD=[["101","01","Personale locale (stipendi)","Personnel local (salaires)"],
["102","01","Personale espatriato e direzione","Personnel expatrié et direction"],
["103","01","Collaboratori occasionali e notule","Collaborateurs occasionnels et notes d'honoraires"],
["104","01","Indennità di missione e diarie","Indemnités de mission et per diem"],
["105","01","Contributi previdenziali e oneri sociali","Cotisations sociales et charges (CNaPS, OSTIE, INPS)"],
["201","02","Viaggi internazionali (voli, treni)","Voyages internationaux (vols, trains)"],
["202","02","Trasporto del personale in loco","Transport du personnel sur place"],
["203","02","Trasporto e spedizione di materiali","Transport et expédition de matériel"],
["204","02","Carburante e manutenzione dei mezzi","Carburant et entretien des véhicules"],
["205","02","Alloggio e vitto in missione","Hébergement et repas en mission"],
["206","02","Acquisto di mezzi di trasporto","Achat de véhicules"],
["301","03","Materiali di consumo","Fournitures consommables"],
["302","03","Attrezzature durevoli","Équipements durables"],
["303","03","Arredi","Mobilier"],
["304","03","Kit e materiali didattici","Kits et matériel éducatifs"],
["305","03","Merchandising (acquisto per rivendita)","Merchandising (achat pour revente)"],
["306","03","Input agricoli (semi, piantine, concimi)","Intrants agricoles (semences, plants, engrais)"],
["401","04","Formazione del personale","Formation du personnel"],
["402","04","Prestazioni professionali di terzi","Prestations professionnelles de tiers"],
["403","04","Certificazioni e audit","Certifications et audits"],
["404","04","Formazione di beneficiari e comunità","Formation des bénéficiaires et communautés"],
["405","04","Consulenza contabile, fiscale e legale","Conseil comptable, fiscal et juridique"],
["501","05","Affitto locali","Loyer des locaux"],
["502","05","Ristrutturazione straordinaria","Rénovation extraordinaire"],
["503","05","Manutenzione ordinaria","Entretien courant"],
["504","05","Acquisto immobili","Achat immobilier"],
["505","05","Energia elettrica","Électricité"],
["506","05","Acqua","Eau"],
["507","05","Gas e combustibile","Gaz et combustible"],
["508","05","Telefonia e internet","Téléphonie et internet"],
["509","05","Energia di backup (generatore, solare)","Énergie de secours (groupe électrogène, solaire)"],
["601","06","Assicurazioni","Assurances"],
["602","06","Spese mediche","Frais médicaux"],
["701","07","Comunicazione istituzionale","Communication institutionnelle"],
["702","07","Materiale di comunicazione","Supports de communication"],
["703","07","Eventi di visibilità","Événements de visibilité"],
["704","07","Costi di raccolta fondi (eventi, campagne)","Coûts de collecte de fonds (événements, campagnes)"],
["801","08","Abbonamenti e servizi digitali","Abonnements et services numériques"],
["802","08","Visti e permessi","Visas et permis"],
["803","08","Tasse e oneri amministrativi locali","Taxes et charges administratives locales"],
["804","08","Cancelleria e spese d'ufficio","Fournitures de bureau et frais de fonctionnement"],
["899","08","Altre spese non classificabili","Autres dépenses non classables"],
["901","09","Canone e spese di tenuta conto","Frais de tenue de compte"],
["902","09","Commissioni su bonifici e operazioni bancarie","Commissions sur virements et opérations bancaires"],
["903","09","Commissioni mobile money e carte","Commissions mobile money et cartes (Mvola, Orange Money, prépayées)"],
["904","09","Commissioni delle piattaforme di incasso","Commissions des plateformes d'encaissement (PayPal, Satispay, crowdfunding)"],
["905","09","Imposta di bollo e imposte sui conti","Droit de timbre et taxes sur comptes"],
["906","09","Perdite su cambio (differenze di cambio passive)","Pertes de change"],
["907","09","Interessi passivi","Intérêts débiteurs"]];
const CODES_IN_OLD=[["E101","E1","Donazioni da privati","Dons de particuliers"],
["E102","E1","Donazioni da aziende","Dons d'entreprises"],
["E103","E1","Donazioni da fondazioni","Dons de fondations"],
["E104","E1","Campagne annuali","Campagnes annuelles"],
["E105","E1","Contributi volontari","Contributions volontaires"],
["E201","E2","Eventi di raccolta fondi","Événements de collecte de fonds"],
["E202","E2","Vendita merchandising","Vente de merchandising"],
["E203","E2","Crowdfunding e piattaforme online","Crowdfunding et plateformes en ligne"],
["E204","E2","Campagne digitali","Campagnes numériques"],
["E301","E3","Bandi pubblici italiani","Appels à projets publics italiens"],
["E302","E3","Fondi europei","Fonds européens"],
["E303","E3","Agenzie internazionali","Agences internationales"],
["E304","E3","Programmi e donatori esteri","Programmes et bailleurs étrangers"],
["E401","E4","Quote associative annuali","Cotisations annuelles"],
["E501","E5","5x1000","5 pour mille (5x1000)"],
["E502","E5","Contributi comunali e locali","Contributions communales et locales"],
["E601","E6","Vendita di beni prodotti dai progetti","Vente de biens produits par les projets"],
["E602","E6","Turismo responsabile","Tourisme responsable"],
["E603","E6","Prestazioni a terzi e agenzie internazionali","Prestations à des tiers et agences internationales"],
["E701","E7","Lasciti e successioni","Legs et successions"],
["E702","E7","Altre entrate straordinarie","Autres recettes exceptionnelles"],
["E801","E8","Cofinanziamento da partner","Cofinancement de partenaires"],
["E802","E8","Cofinanziamento volontario da associati","Cofinancement volontaire des membres"],
["E901","E9","Interessi attivi","Intérêts créditeurs"],
["E902","E9","Guadagni su cambio (differenze attive)","Gains de change"],
["E903","E9","Rimborsi e storni (anche commissioni)","Remboursements et extournes (y compris commissions)"],
["E904","E9","Avanzo dell'anno precedente (saldo iniziale, non è un ricavo)","Excédent de l'exercice précédent (solde d'ouverture, pas un produit)"]];
export { MIG_THR, MIG_IN, migTarget, CODES_EX_OLD, CODES_IN_OLD };
