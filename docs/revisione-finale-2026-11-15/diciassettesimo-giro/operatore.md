# YouCount — revisione Operatore, diciassettesimo giro (375 px, IT e FR)

Fatto il 21/11/2026 tra le 19:40 e le 20:05 di Antananarivo. Prove in `/tmp/yc-final/work/op/`.
Alle 19:51 il server si è riavviato (`watchdog.log`) e ha ricaricato i dati dimostrativi. Dopo il riavvio ho rifatto in francese spesa, bozza, spesa di tasca e segnalazione (`fr2.log`). Alla fine l'operatore è di nuovo in italiano (`fr2.log`, riga FINALE: «Dashboard FR»).
Come da istruzioni non ho contato l'anteprima rotta dell'immagine né il formato mm/dd/yyyy dei campi data, che dipende dal browser.

## A. Riverifica dei difetti aperti

| Id | Esito | Prova |
|---|---|---|
| T1 Guida da amministratore | **CHIUSO** | I capitoli ora parlano all'operatore. «Spese da rimborsare» elenca i tre riquadri che vede («Da rimborsare a te», «In attesa da», «Rimborsato nel»). «Conti e cassa» dice «Vedi le casse in contanti del Madagascar e il tuo anticipo». Non si parla più di «Rimborsa» né di liquidità Italia/Madagascar (`guida_all.txt`, righe 1–137; `help.txt`) |
| T2 Nomi in Scadenze | **CHIUSO** | In Scadenze compaiono «Bozze da completare: 1» e «Rimborso che ti spetta: 1». Le categorie «Documenti / Pagamento / Interna» non ci sono più (`s_4c.png`, `segn.log`). In Dashboard si legge «Bozze da completare: 1» |
| T3 Bozza senza giustificativo | **CHIUSO** | La scheda dice «Nessun giustificativo. Per aggiungerlo tocca «Modifica» e fotografa lo scontrino.», con il pulsante Modifica. In FR: «Aucun justificatif. Pour l'ajouter, touchez « Modifier »…» (`reg.log` BOZZA, `fr2.log` BROUILLON) |
| T4 Rimborsi doppi | **CHIUSO** | Il riquadro non ha più la barra «a chi» con una sola persona e la riga «OP Operatore Prova» doppia è sparita. Sotto resta solo l'elenco «Le tue spese da rimborsare» (`b__rimborsi.png`). In FR è uguale (`fr2.log` PAGE /rimborsi) |
| N-2 Data UTC | **non verificabile ora** (erano le 19:40–20:05 EAT). Non lo conto | `date` con TZ Indian/Antananarivo |

## B. Compiti fissi e voti

| Compito | Esito verificato |
|---|---|
| Capire cosa fare entrando in Dashboard | Il pulsante «Registra una spesa» è in cima, sotto ci sono 4 riquadri (Contanti in mano, Da rimborsare a te, Da verificare, Bozze). «Da fare» elenca segnalazioni, bozze e anticipo (`a__.png`, `segn.log` DASH) |
| Spesa in contanti MGA con foto | Foto → ritaglio con «Usa» → «scontrino.jpg caricato». Ho scritto la descrizione e 25.000 MGA (controvalore 4,68 €), scelto la cassa e il codice 307 con «riso», poi Agricoltura e «Registra». Risultato: MOV-2026-006 «Da verificare» con il giustificativo allegato (`r_2c.png`, `r_5c.png`, `segn.log`). Scrivendo «Pane per la mensa» compare «Codice suggerito: 307» (`help2.txt`) |
| Ricerca del codice | «riso» → 307, «taxi» → 202, «pane» → 307: «1 codice trovato: toccalo qui sopra». Con una parola senza risultati l'app propone un'altra parola o l'elenco completo, che è davvero sotto (`c_it.txt`, `c_it_zxqwv.png`). In FR riz/taxi/pain dà gli stessi risultati (`fr_cerca.txt`) |
| Campi mancanti | Ogni campo mancante ha «Campo obbligatorio» e in fondo «Per registrare mancano: importo, codice contabile, progetto, descrizione, giustificativo» (`r_1_vuoto.png`). In FR: «Pour comptabiliser il manque : …» |
| Bozza incompleta | Basta l'importo. La scheda dice «Bozza salvata: non conta ancora nei saldi. Per completarla tocca «Modifica», poi «Registra».» |
| Segnalazione d'errore | Se il campo è vuoto compare «Campo obbligatorio» nello stile dell'app (`s_2_vuoto.png`; S6 risolto). Dopo l'invio: «Segnalazione inviata», «Segnalato il 21/11/2026, in attesa del responsabile», «Aggiungi un dettaglio» (niente doppio invio). La segnalazione compare in Scadenze e in Dashboard |
| Conta di cassa, differenza grande | Con 10 × 20.000 compare «Differenza grande (20.666.300 MGA). Riconta…». «Registra la conta» resta disattivo finché non si spunta, poi chiede le note («Campo obbligatorio»). Alla fine «Conta registrata.» e la riga nello storico (`conta.log`, `k_3t.png`, `k_3c.png`) |
| Stati | Bozza / Da verificare / Verificato / Da rimborsare sono uguali in Dashboard, elenco, scheda, filtri («Bozze, Da verificare, Verificati, Da rimborsare, Storni») e aiuto (`filt.txt`, `help2.txt`) |
| Aiuto in pagina | «Come funziona questa scheda» in Dashboard, Nuovo, Registro, Rimborsi, Conti e Scadenze descrive lo schermo dell'operatore (`help.txt`, `help2.txt`). In Conti per circa 1,7 s si vedono solo «…» prima del testo |
| Francese | Il percorso completo funziona. «Spese generali» ora è «Frais généraux» (S4 risolto) |
| Velocità (visite successive) | Ricaricare una pagina intera richiede 2,0–2,2 s. Passare da una scheda all'altra con la barra in basso richiede circa 0,5 s (`help.txt`). Registrare una spesa con foto mostra «Salvataggio…» per più di 3,5 s (`r_5c.png`) |

| Area | Giro prec. | Voto | Motivo |
|---|---|---|---|
| Facilità complessiva | 9 | **9,5** | T4 chiuso; resta U2 (P3) |
| Registrare una spesa | 9,5 | **9,5** | Nessun difetto nuovo; T3 chiuso. Non è 10 per il salvataggio lento (oltre 3,5 s) e perché la bozza senza descrizione in elenco si chiama solo «Uscita» |
| Capire gli stati | 9 | **9,5** | T2 chiuso; resta U4 (P3) |
| Errori e recupero | 9,5 | **9,5** | Resta U1 (P3) |
| Aiuto in pagina e Guida | 9 | **9,5** | T1 chiuso; nessun errore trovato |
| Francese | 9,5 | **9,5** | Resta U3 (P3) |
| Velocità percepita | 9 | **9** | Come prima (misure sopra); uso senza rete non verificato |
| **Complessivo** | **8** | **8** | Nessun P0, P1 o P2 verificato; restano 4 P3 aperti (U1–U4), più dei due ammessi per il 9 |

Nessuna area è scesa rispetto al giro precedente.

## C. Difetti nuovi

| Id | Gravità | Area | Dove | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| U1 | P3 | Errori | Scheda di una spesa registrata · IT e FR | Sopra il riquadro «Hai trovato un errore? / Segnala al responsabile» c'è un paragrafo che dice «…chiedi a un responsabile di correggerlo o stornarlo, indicandogli il numero qui sopra». È un'istruzione da fare fuori dall'app e ripete il modulo che sta subito sotto: sembrano due strade diverse (`s_1_scheda.png`, `segn.log` SCHEDA; FR «Une erreur dans ce mouvement ?…») | Per l'operatore togliere il paragrafo, oppure ridurlo a «Non puoi più modificarla: usa «Segnala al responsabile» qui sotto» |
| U2 | P3 | Facilità | /nuovo, menu «Conto» · 375 | Tra i conti l'operatore trova «BNI Madagascar (banca) · MGA». Però in /conti legge «I conti bancari li vedono responsabili e amministratori», quindi può registrare una spesa su un conto che poi non vede (`a__nuovo.txt` contro `a__conti.txt`) | Mostrare all'operatore solo casse e mobile money. Se la banca serve, spiegare nella riga d'aiuto del conto che il saldo bancario lo vede il responsabile |
| U3 | P3 | Francese | /scadenze FR | (a) «Brouillons hors soldes tant qu'ils ne sont pas **enregistrés**», mentre il pulsante e la Dashboard dicono «Comptabiliser». (b) In «Erreur signalée: MOV‑…» manca lo spazio prima dei due punti, che invece c'è in «Remboursement qui vous revient : 1» (`fr2.log` PAGE /scadenze) | Scrivere «…tant qu'ils ne sont pas comptabilisés» e «Erreur signalée : » |
| U4 | P3 | Stati | /scadenze · IT e FR | La stessa richiesta si chiama «Richiesta di anticipo in attesa: 1.000 MGA» in Dashboard e «Anticipo da autorizzare: Operatore Prova» in Scadenze, cioè con il proprio nome invece dell'importo. La pastiglia «automatica» («automatique») è una parola da amministratore che all'operatore non dice nulla (`a__.txt` contro `a__scadenze.txt`, `s_4c.png`) | Per l'operatore usare lo stesso titolo della Dashboard, con l'importo. Nascondergli «automatica» |

## Ordine di intervento per arrivare ad almeno 9 in ogni area

Tutte le aree sono già a 9 o più. Per portare il complessivo da 8 a 9 bisogna scendere ad al massimo due P3 aperti. N-2 va riverificato tra le 00:00 e le 03:00 EAT: è un P2 e, se è ancora aperto, blocca il 9.

1. **N-2** (P2, data UTC): calcolare la data «di oggi» sul fuso Indian/Antananarivo. Se resta aperto, il complessivo non può superare 8.
2. **U1**: togliere o riscrivere il paragrafo che ripete il modulo di segnalazione. È una modifica di testo.
3. **U4**: dare in Scadenze lo stesso titolo della Dashboard e nascondere «automatica» all'operatore.
4. **U3**: correggere le due frasi francesi di Scadenze.
5. **U2**: togliere la banca dai conti dell'operatore, o spiegarla.
6. Facoltativo (per il 10 in Registrare e Velocità): rendere più breve l'attesa su «Salvataggio…» e chiamare la bozza senza descrizione «Bozza senza descrizione» invece di «Uscita».
