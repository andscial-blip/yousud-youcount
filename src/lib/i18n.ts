// Testi dell'interfaccia in italiano e francese. La lingua è quella del profilo (o, prima
// dell'accesso, il cookie "lang" o la lingua del browser). I nomi di conti e codici arrivano
// dal database in entrambe le lingue (name_it / name_fr).
export type Lang = 'it' | 'fr';

const it = {
  app_tagline: 'Ogni spesa, il suo giustificativo',
  app_sub: 'Contabilità YouSud ODV',
  // navigazione
  nav_dashboard: 'Dashboard', nav_movements: 'Movimenti', nav_new: 'Nuovo', nav_new_long: '+ Nuovo movimento',
  nav_verify: 'Da verificare', nav_documents: 'Documenti', nav_projects: 'Progetti', nav_accounts: 'Conti',
  nav_report: 'Rendiconto', nav_more: 'Altro', nav_counterparties: 'Fornitori e donatori',
  nav_sync: 'Sincronizzazione', nav_guide: 'Guida', nav_account: 'Il mio account',
  nav_users: 'Utenti e ruoli', nav_chart: 'Piano dei conti', nav_admin_projects: 'Progetti e centri di costo',
  nav_admin_accounts: 'Conti finanziari', nav_periods: 'Chiusure mensili', nav_settings: 'Impostazioni',
  nav_audit: 'Registro attività', grp_work: 'Lavoro', grp_admin: 'Amministrazione', grp_me: 'Account',
  // comuni
  none: 'Nessun dato.', date: 'Data', ref: 'Rif.', description: 'Descrizione', code: 'Codice', project: 'Progetto',
  account: 'Conto', amount: 'Importo', status: 'Stato', type: 'Tipo', name: 'Nome', country: 'Paese', role: 'Ruolo',
  active: 'Attivo', suspended: 'Sospeso', yes: 'sì', no: 'no', place: 'Luogo', italy: 'Italia', madagascar: 'Madagascar',
  balance: 'Saldo', in: 'Entrate', out: 'Uscite', currency: 'Valuta', email: 'Email', reversal: 'storno',
  st_draft: 'Bozza', st_recorded: 'Da verificare', st_verified: 'Verificato',
  k_income: 'Entrata', k_expense: 'Uscita', k_transfer: 'Giroconto',
  all: 'Tutti', drafts: 'Bozze', verified: 'Verificati',
  only_admin: 'Questa sezione è riservata agli amministratori.',
  only_staff: 'Questa sezione è visibile a responsabili, amministratori e utenti in sola lettura.',
  coming: 'In costruzione', error_load: 'Dati non disponibili',
  // dashboard
  dash_it: 'Liquidità in Italia', dash_it_s: 'banca, cassa e conti online in EUR',
  dash_mg: 'Liquidità in Madagascar', dash_mg_s: 'banca, cassa e mobile money in MGA',
  dash_verify_s: 'movimenti registrati non ancora verificati', dash_drafts: 'Le mie bozze',
  dash_drafts_s: 'da completare e registrare', balances: 'Saldi dei conti',
  balances_note: 'I saldi comprendono i movimenti registrati e verificati; gli storni sono già sottratti.',
  // verifica
  verify_intro: 'Movimenti registrati in attesa di verifica. Chi ha inserito un movimento non può verificarlo.',
  verify_btn: 'Verifica', verify_own: 'inserito da te', verify_done: 'Verificato.', entered_by: 'Inserito da',
  // progetti
  prj_spent: 'Uscite', prj_income: 'Entrate', prj_moves: 'Movimenti', prj_structure: 'struttura',
  prj_note: 'Importi in EUR dei movimenti registrati e verificati dell\'anno. Budget e confronto speso/preventivo: tappa 4d.',
  // conti
  acc_opening: 'Saldo iniziale', acc_in: 'Entrate', acc_out: 'Uscite e giroconti in uscita',
  // rendiconto
  rep_title: 'Rendiconto per cassa', rep_draft: 'Bozza calcolata dai movimenti registrati e verificati, secondo le righe del Mod. D usate nel Gestionale. La conformità al D.M. 5 marzo 2020 va verificata dal commercialista prima dell\'approvazione.',
  rep_missing_rate: 'movimenti in MGA senza tasso di cambio: importi in EUR incompleti.',
  rep_unclassified: 'movimenti con codici senza riga di rendiconto (es. 999 / E999): da riclassificare.',
  rep_item: 'Voce', rep_total_out: 'Totale uscite', rep_total_in: 'Totale entrate', rep_result: 'Avanzo / disavanzo',
  rep_result_s: 'entrate meno uscite, investimenti e imposte inclusi',
  // documenti
  doc_uploaded: 'Caricato', doc_number: 'Numero', doc_total: 'Totale',
  // account
  acc_lang: 'Lingua', sign_out: 'Esci', save: 'Salva',
  // login
  login_title: 'Accedi', login_btn: 'Accedi', login_busy: 'Accesso…', password: 'Password',
  login_bad: 'Email o password non corretti.', login_offline: 'Serve una connessione per il primo accesso.',
  login_invite: 'L\'accesso è solo su invito. Per un nuovo account o una password dimenticata rivolgiti all\'amministratore di YouSud.',
  not_configured: 'Collegamento al database non configurato.',
  not_configured_long: 'Mancano le variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example in .env.local e inserisci i valori del progetto Supabase. Nessun dato viene mostrato finché il collegamento non è attivo.',
  account_suspended: 'Account sospeso. Rivolgiti all\'amministratore di YouSud.',
  account_noprofile: 'Account senza profilo. Rivolgiti all\'amministratore di YouSud.',
  offline_title: 'Senza connessione', offline_text: 'Questa pagina non era stata salvata sul dispositivo. Le pagine già aperte con la rete restano consultabili.',
  // pagine in costruzione
  new_text: 'Tappa 4c: fotografa o carica il giustificativo, l\'app migliora l\'immagine, ne fa un PDF, propone i campi letti e tu li verifichi uno per uno prima di registrare.',
  sync_text: 'Tappa 4e: coda dei movimenti salvati senza rete, invio automatico e manuale, conflitti. Qui sotto gli ultimi invii registrati dal server.',
  sync_outcome: 'Esito', sync_op: 'Operazione',
  admin_readonly: 'Consultazione. Le modifiche da questa pagina arrivano con la tappa 4e.',
  set_four_eyes: 'Quattro occhi: chi inserisce un movimento non lo verifica',
  set_require_doc: 'Giustificativo obbligatorio alla registrazione (o motivo della mancanza)',
  period: 'Mese', closed: 'Chiuso', open: 'Aperto', closed_by: 'Chiuso da', closed_at: 'Chiuso il',
  audit_when: 'Quando', audit_who: 'Chi', audit_what: 'Cosa', audit_table: 'Tabella',
  a_insert: 'creazione', a_update: 'modifica', a_delete: 'eliminazione',
  rl: 'Riga rendiconto', to_classify: 'da classificare', group: 'Gruppo',
  cp_kind_supplier: 'Fornitore', cp_kind_donor: 'Donatore', cp_kind_beneficiary: 'Beneficiario', cp_kind_staff: 'Personale', cp_kind_other: 'Altro',
  r_super_admin: 'Super amministratore', r_admin: 'Amministratore', r_responsabile: 'Responsabile', r_operator: 'Operatore', r_read_only: 'Sola lettura',
};

export type Key = keyof typeof it;

const fr: Record<Key, string> = {
  app_tagline: 'Chaque dépense, sa pièce justificative',
  app_sub: 'Comptabilité YouSud ODV',
  nav_dashboard: 'Tableau de bord', nav_movements: 'Mouvements', nav_new: 'Nouveau', nav_new_long: '+ Nouveau mouvement',
  nav_verify: 'À vérifier', nav_documents: 'Documents', nav_projects: 'Projets', nav_accounts: 'Comptes',
  nav_report: 'Bilan', nav_more: 'Plus', nav_counterparties: 'Fournisseurs et donateurs',
  nav_sync: 'Synchronisation', nav_guide: 'Guide', nav_account: 'Mon compte',
  nav_users: 'Utilisateurs et rôles', nav_chart: 'Plan comptable', nav_admin_projects: 'Projets et centres de coût',
  nav_admin_accounts: 'Comptes financiers', nav_periods: 'Clôtures mensuelles', nav_settings: 'Paramètres',
  nav_audit: 'Journal d\'activité', grp_work: 'Travail', grp_admin: 'Administration', grp_me: 'Compte',
  none: 'Aucune donnée.', date: 'Date', ref: 'Réf.', description: 'Description', code: 'Code', project: 'Projet',
  account: 'Compte', amount: 'Montant', status: 'Statut', type: 'Type', name: 'Nom', country: 'Pays', role: 'Rôle',
  active: 'Actif', suspended: 'Suspendu', yes: 'oui', no: 'non', place: 'Lieu', italy: 'Italie', madagascar: 'Madagascar',
  balance: 'Solde', in: 'Recettes', out: 'Dépenses', currency: 'Devise', email: 'E-mail', reversal: 'extourne',
  st_draft: 'Brouillon', st_recorded: 'À vérifier', st_verified: 'Vérifié',
  k_income: 'Recette', k_expense: 'Dépense', k_transfer: 'Virement interne',
  all: 'Tous', drafts: 'Brouillons', verified: 'Vérifiés',
  only_admin: 'Cette section est réservée aux administrateurs.',
  only_staff: 'Cette section est visible par les responsables, les administrateurs et les utilisateurs en lecture seule.',
  coming: 'En construction', error_load: 'Données indisponibles',
  dash_it: 'Trésorerie en Italie', dash_it_s: 'banque, caisse et comptes en ligne en EUR',
  dash_mg: 'Trésorerie à Madagascar', dash_mg_s: 'banque, caisse et mobile money en MGA',
  dash_verify_s: 'mouvements enregistrés pas encore vérifiés', dash_drafts: 'Mes brouillons',
  dash_drafts_s: 'à compléter et enregistrer', balances: 'Soldes des comptes',
  balances_note: 'Les soldes incluent les mouvements enregistrés et vérifiés ; les extournes sont déjà déduites.',
  verify_intro: 'Mouvements enregistrés en attente de vérification. La personne qui a saisi un mouvement ne peut pas le vérifier.',
  verify_btn: 'Vérifier', verify_own: 'saisi par vous', verify_done: 'Vérifié.', entered_by: 'Saisi par',
  prj_spent: 'Dépenses', prj_income: 'Recettes', prj_moves: 'Mouvements', prj_structure: 'structure',
  prj_note: 'Montants en EUR des mouvements enregistrés et vérifiés de l\'année. Budget et comparaison dépensé/prévu : étape 4d.',
  acc_opening: 'Solde initial', acc_in: 'Recettes', acc_out: 'Dépenses et virements sortants',
  rep_title: 'Compte de caisse', rep_draft: 'Brouillon calculé à partir des mouvements enregistrés et vérifiés, selon les lignes du modèle D utilisées dans le Gestionale. La conformité au décret du 5 mars 2020 doit être vérifiée par l\'expert-comptable avant l\'approbation.',
  rep_missing_rate: 'mouvements en MGA sans taux de change : montants en EUR incomplets.',
  rep_unclassified: 'mouvements avec des codes sans ligne de bilan (ex. 999 / E999) : à reclasser.',
  rep_item: 'Poste', rep_total_out: 'Total des dépenses', rep_total_in: 'Total des recettes', rep_result: 'Excédent / déficit',
  rep_result_s: 'recettes moins dépenses, investissements et impôts compris',
  doc_uploaded: 'Chargé le', doc_number: 'Numéro', doc_total: 'Total',
  acc_lang: 'Langue', sign_out: 'Se déconnecter', save: 'Enregistrer',
  login_title: 'Connexion', login_btn: 'Se connecter', login_busy: 'Connexion…', password: 'Mot de passe',
  login_bad: 'E-mail ou mot de passe incorrect.', login_offline: 'Une connexion est nécessaire pour le premier accès.',
  login_invite: 'L\'accès se fait uniquement sur invitation. Pour un nouveau compte ou un mot de passe oublié, adressez-vous à l\'administrateur de YouSud.',
  not_configured: 'Connexion à la base de données non configurée.',
  not_configured_long: 'Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont manquantes. Copiez .env.example dans .env.local et indiquez les valeurs du projet Supabase. Aucune donnée n\'est affichée tant que la connexion n\'est pas active.',
  account_suspended: 'Compte suspendu. Adressez-vous à l\'administrateur de YouSud.',
  account_noprofile: 'Compte sans profil. Adressez-vous à l\'administrateur de YouSud.',
  offline_title: 'Pas de connexion', offline_text: 'Cette page n\'avait pas été enregistrée sur l\'appareil. Les pages déjà ouvertes avec le réseau restent consultables.',
  new_text: 'Étape 4c : photographiez ou chargez la pièce justificative ; l\'application améliore l\'image, en fait un PDF, propose les champs lus et vous les vérifiez un par un avant d\'enregistrer.',
  sync_text: 'Étape 4e : file d\'attente des mouvements saisis hors ligne, envoi automatique et manuel, conflits. Ci-dessous, les derniers envois enregistrés par le serveur.',
  sync_outcome: 'Résultat', sync_op: 'Opération',
  admin_readonly: 'Consultation. Les modifications depuis cette page arrivent avec l\'étape 4e.',
  set_four_eyes: 'Quatre yeux : la personne qui saisit un mouvement ne le vérifie pas',
  set_require_doc: 'Pièce justificative obligatoire à l\'enregistrement (ou motif de son absence)',
  period: 'Mois', closed: 'Clôturé', open: 'Ouvert', closed_by: 'Clôturé par', closed_at: 'Clôturé le',
  audit_when: 'Quand', audit_who: 'Qui', audit_what: 'Quoi', audit_table: 'Table',
  a_insert: 'création', a_update: 'modification', a_delete: 'suppression',
  rl: 'Ligne du bilan', to_classify: 'à classer', group: 'Groupe',
  cp_kind_supplier: 'Fournisseur', cp_kind_donor: 'Donateur', cp_kind_beneficiary: 'Bénéficiaire', cp_kind_staff: 'Personnel', cp_kind_other: 'Autre',
  r_super_admin: 'Super administrateur', r_admin: 'Administrateur', r_responsabile: 'Responsable', r_operator: 'Opérateur', r_read_only: 'Lecture seule',
};

const DICT: Record<Lang, Record<Key, string>> = { it, fr };

export const normLang = (v: string | null | undefined): Lang => (v === 'fr' ? 'fr' : 'it');
export const translator = (lang: Lang) => (k: Key) => DICT[lang][k];
export type T = ReturnType<typeof translator>;
