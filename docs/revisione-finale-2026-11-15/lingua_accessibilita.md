# YouCount · revisione finale: testi, francese, accessibilità

Revisore indipendente, 15/11/2026. Prove in `/tmp/yc-final/work/la/` (testi `super_admin_*.txt`, `admin_fr_*.txt`; schermate `admin_fr_375_*`, `admin_fr_1440_*`; axe `axe_*.json`; tastiera `inter*.json`; ritagli `frvis_*.json`).

## Cosa è stato provato
- Testo di 37 pagine in italiano (super_admin) e delle stesse 37 in francese (admin_fr); aiuto in linea aperto su tutte.
- 14 pagine francesi in schermata a 375 e a 1440 px, più controllo automatico di testi troncati e parole spezzate.
- axe-core (regole WCAG 2.0/2.1/2.2 A-AA e buone pratiche) su 15 pagine a 1440 px in italiano e 14 a 375 px in francese.
- Modulo «Nuovo movimento»: etichette, ordine di tabulazione (60 pressioni di Tab), focus, invio a vuoto. Esc su aiuto, filtri, ricerca.

## Voti

| Area | Voto |
|---|---|
| Chiarezza dei testi (italiano) | 8,5 |
| Francese | 8 |
| Coerenza terminologica | 7 |
| Guida e aiuto in linea | 8 |
| Accessibilità | 8 |

### Chiarezza dei testi (italiano) · 8,5
- Funziona: frasi brevi, verbi d'azione, suggerimenti sotto i campi («Chi ha speso materialmente: tu o un collega»), errore che elenca cosa manca («Per registrare mancano: importo, codice contabile» più «Campo obbligatorio» sui campi), quattro motivi pronti per il giustificativo mancante.
- Non funziona: «Gestionale» compare due volte senza spiegazione (Rendiconti; autocertificazione nel dettaglio movimento); in Dati e sicurezza «il foglio documents ne elenca percorso e impronta» e «Le istruzioni tecniche sono nel progetto del codice»; l'aiuto dice «si trova qui e non più nel Registro» (storia dell'app, non istruzione).
- Verso il 10: togliere i tre gerghi; riscrivere le frasi che raccontano modifiche passate.

### Francese · 8
- Funziona: corretto e naturale, non letterale («Virement interne», «Tiers», «extourne», «Rapprochement», «Clôtures mensuelles», «attestation sur l'honneur»); spazi prima di : ; ? ! e dentro « » giusti quasi ovunque; `lang="fr"`; accesso in francese con scelta della lingua.
- Non funziona: «comptabilisé» e «enregistré» per lo stesso stato; «Spese generali» non tradotto (anche nel suggerimento del modulo); spazio mancante prima dei due punti in 8 stringhe («Pour comptabiliser il manque: …», «Montant lu: », «Solde initial: », «Banque Italie: 78 %», «Octobre: », «Codes: 999», «Recettes 2025: », «2025: –»); «(87%)» accanto a «87 %»; «14 prochains j»; «non prévue» riferito a «un poste»; «Comptes rendus» e «Compte ETS» ambigui per il rendiconto; pagina 404 generale in italiano con `lang="it"`; titolo della scheda di accesso «YouCount · Contabilità YouSud».
- Verso il 10: «comptabiliser» per registrare ed «enregistrer» solo per salvare; tradurre il centro di costo di sistema; correggere gli 8 due punti.

### Coerenza terminologica · 7
Lo stesso oggetto cambia nome fra menu, scheda, aiuto e Guida (verificato sui testi):

| Menu o scheda | Aiuto o Guida |
|---|---|
| Saldi | Conti e cassa |
| Da verificare | Verifica in blocco |
| Il mio account / Mon compte | Il tuo account / Votre compte |
| Conti finanziari | Conti (amministrazione) |
| Association et documents | Organisme et documents |
| Categorie | Piano dei conti · codice contabile · voci |
| Registro attività | registro modifiche · Storico delle modifiche |
| Esporta tutto il 2026 | «Esporta in Excel» |
| Déconnexion (1440) | Se déconnecter (375) |

Verso il 10: un glossario unico IT/FR applicato a menu, titoli dell'aiuto e indice della Guida.

### Guida e aiuto in linea · 8
- Funziona: aiuto presente su 35 pagine su 37; Guida con 22 «Come faccio a…» e indice per sezione; su telefono il pulsante diventa «Come si fa» / «Mode d'emploi», come scritto nella Guida.
- Etichette citate nell'aiuto: la maggior parte esiste. Errori verificati: «Esporta in Excel» (il pulsante è «Esporta tutto il 2026», IT e FR); «Apri» in Da verificare (c'è solo «Verifica»); Rendiconti dice che le versioni firmate sono «In alto» e due righe dopo «in fondo alla pagina»; in francese «au-delà du rythme» contro «Au-dessus du rythme» in pagina.
- Non funziona: «Chiedi all'AI» e il menu su telefono rispondono «Pas encore d'explication pour cette page»; il dettaglio movimento riapre l'aiuto del Registro; l'aiuto del Preventivo è un blocco di circa 4.500 caratteri senza titoletti.
- Verso il 10: correggere le 4 etichette; aiuto proprio per dettaglio e Chiedi all'AI; spezzare gli aiuti lunghi in passi.

### Accessibilità · 8
- Funziona: 0 violazioni critiche su 14 pagine su 15; 15 campi su 15 con etichetta nel nuovo movimento; «Vai al contenuto» al primo Tab; focus visibile (bordo 2 px sui comandi, alone sui campi); Esc chiude aiuto, filtri e ricerca; `lang` corretto; titolo della scheda per pagina; errore annunciato (`role=alert`) e focus sul primo campo mancante; nessuno scorrimento orizzontale a 375 px.
- Non funziona: difetti 1, 5, 6, 8, 9.
- Verso il 10: righe nella griglia del calendario; bersagli a 44 px; `aria-invalid` sui campi in errore; contrasto del ruolo nel menu.

## axe-core per pagina (regole violate / nodi)

| Pagina | IT 1440 critiche | IT 1440 serie | IT 1440 moderate | FR 375 critiche | FR 375 serie | FR 375 moderate |
|---|---|---|---|---|---|---|
| Login | 0 | 0 | 0 | 0 | 0 | 0 |
| Offline | 0 | 0 | 0 | 0 | 0 | 0 |
| Dashboard | 0 | 3/3 | 0 | 0 | 2/2 | 0 |
| Movimenti | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Nuovo movimento | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Dettaglio movimento | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Conti | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Preventivo | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Analisi | 0 | 3/3 | 0 | 0 | 2/2 | 0 |
| Report | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Documenti emessi | 0 | 2/2 | 1/1 | 0 | 1/1 | 1/1 |
| Impostazioni | 0 | 2/2 | 0 | 0 | 1/1 | 0 |
| Guida | 0 | 2/2 | 1/1 | 0 | 1/2 | 1/1 |
| Scadenze | 2/50 | 3/5 | 0 | 2/50 | 1/1 | 0 |
| Menu (/altro) | 0 | 2/2 | 0 | non misurato | – | – |

Nessuna violazione «minore». Le serie a 1440 sono sempre le stesse due: contrasto 4,23:1 di «Super amministratore» nel menu (#9aa1ac su #2e3d52, 12,5 px) e nome accessibile «Cerca (⌘K)» diverso dal testo visibile; in Dashboard e Analisi si aggiunge il grafico con elementi attivabili annidati. A 375 la serie è il «You» verde del logo (3,1:1; i loghi sono esenti) e, in Guida, le etichette della barra in basso (4,31:1, 12 px).

Bersagli a 375 px (francese): schede di sezione alte 40 px; icone in alto larghe 34 px; «Mode d'emploi» alto 30 px; scelta dell'anno alta 34 px; campi del modulo 40-42 px; segni del calendario alti 6 px. Barra in basso e «+»: almeno 44 px.

Tabulazione nel nuovo movimento: 24 fermate prima del primo campo (1 con «Vai al contenuto»); un solo salto all'indietro (dalla data del documento a «Uscita / Entrata / Giroconto», che sta più in alto).

## Difetti

| # | Gravità | Pagina | Larghezza | Difetto | Prova |
|---|---|---|---|---|---|
| 1 | P2 | Scadenze | 375, 1440 | Calendario `role="grid"` senza righe: 50 nodi critici per axe (l'elenco sotto resta leggibile) | `axe_super_admin_1440.json`, `axe_admin_fr_375.json` |
| 2 | P2 | Da verificare, Nuovo, Dashboard (FR) | tutte | «40 mouvements comptabilisés en attente» in pagina, «Mouvements enregistrés en attente» nell'aiuto; pulsante «Comptabiliser», aiuto «Enregistrer une dépense» | `admin_fr_verifica.txt`, `admin_fr_nuovo.txt` |
| 3 | P2 | Registro, Da verificare, Rendiconti, Analisi (FR) | tutte | Aiuto che cita etichette inesistenti o si contraddice (4 casi sopra) | `super_admin_movimenti.txt`, `_verifica.txt`, `_rendiconto.txt` |
| 4 | P2 | Preventivo, Conti, Analisi (FR) | 375 | Testi troncati nei riquadri: «E1 · Dons et coti…», «05 · Investissem…», «dépenses couver…», «BNI Madag…», «recettes moins d…» | `admin_fr_375_preventivo__1.png`, `_conti__1.png`, `_analisi__1.png` |
| 5 | P2 | tutte | 375 | Comandi principali sotto i 44 px (schede 40, icone 34, aiuto 30) | `frvis_admin_fr_375.json` |
| 6 | P2 | Nuovo movimento | tutte | Dopo l'errore nessun campo ha `aria-invalid` o `aria-describedby` (0 su 15) | `inter2_super_admin.json` |
| 7 | P2 | FR, varie | tutte | «Spese generali» non tradotto; 404 generale in italiano; 8 due punti senza spazio | `admin_fr_nuovo.txt`, `admin_fr_admin_categorie.txt`, `inter2_admin_fr.json` |
| 8 | P3 | tutte | 1440 | Contrasto 4,23:1 del ruolo nel menu; nome accessibile della ricerca | `axe_super_admin_1440.json` |
| 9 | P3 | Movimenti, Dashboard | 1440 | Pannello Filtri senza `aria-modal` e senza spostare il focus; la ricerca chiusa con Esc non restituisce il focus | `inter2_super_admin.json`, `inter_super_admin.json` |
| 10 | P3 | Nuovo, dettaglio, login | tutte | Titolo della scheda non specifico («Movimenti · YouCount», «Registro · Movimenti», «Contabilità YouSud») | `super_admin_meta.json` |
| 11 | P3 | Rendiconti, dettaglio, Dati | tutte | Gergo: «Gestionale», «foglio documents», «impronta» | `super_admin_rendiconto.txt`, `_movdett.txt`, `_admin_dati.txt` |
| 12 | P3 | Scadenze (FR) | tutte | «14 prochains j», «À payer sous 30 j»; data troncata «2025, 3…» | `admin_fr_1440_scadenze__1.png` |
| 13 | P3 | 404, Nuovo (FR) | 375, 1440 | Pulsanti su due righe: «Aller au tableau de bord», «Argent de YouSud» | `admin_fr_375_movdett__1.png`, `admin_fr_1440_nuovo__1.png` |

Parole spezzate a metà: nessuna trovata nelle 14 pagine a 375 px.

## Non verificato
- PWA installata, telefoni veri, lettori di schermo (solo regole automatiche e tastiera).
- Esc sui pannelli «Aggiungi riga» del preventivo e «Nuova scadenza»: lo script non è riuscito ad aprirli. Conferme di eliminazione: non lette.
- Nodi di contrasto che axe lascia «da rivedere» (fino a 34 per pagina).
- axe a 375 px su /altro (il server si è riavviato durante la misura).
- Etichette dell'aiuto che compaiono solo dopo un'azione (circa 60): non provocate una per una.
- Testi visti da responsabile e operatore; PDF emessi; formato dei campi data (il browser di prova mostra mm/dd/yyyy).
- I testi sono stati letti con uno script unico equivalente a `text.mjs`, per usare un solo browser.
