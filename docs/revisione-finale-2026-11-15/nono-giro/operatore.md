# Revisione 9 · Operatore (375 px, IT e FR, più 768 px)

Ho usato l'app con l'account operatore, attraverso un solo browser Playwright guidato da script. Le schermate sono in /tmp/yc-final/work. I dati di prova sono marcati «(PROVA REVISORE 9)»: MOV-2026-006, 007, 010, 011, 012, una spesa da rimborsare, due anticipi e una conta di cassa. Il server si è fermato una volta (verso le 23:40) e il sorvegliante l'ha riavviato da solo. L'uso senza rete e la PWA installata **non sono verificati**.

## A. Riverifica dei difetti precedenti (operatore)
| Difetto | Stato | Prova |
|---|---|---|
| 6·P1 «Salva bozza» rifiutata | CHIUSO | Basta l'importo: `bozza_post.png` |
| 6·P1 Conti italiani in /nuovo | CHIUSO | Compaiono solo BNI, Cassa MG e Mvola: `nuovo1.png` |
| 6·P2 «Anticipo di» propone anticipi altrui | CHIUSO* | L'anticipo proprio è preselezionato (`ant_spesa1.png`). Il caso «senza anticipo proprio» non è riproducibile, perché ora l'anticipo c'è |
| 6·P2 «Chi riceve» su un'altra persona | CHIUSO | Il predefinito è «Operatore Prova»: `ant_invio.png` |
| 6·P2 Autocertificazione mancante ma «Tutto in ordine» | CHIUSO | Da fare mostra «Autocertificazioni da preparare/far firmare»: `dash3.png` |
| 6·P2 Segnalazione d'errore | CHIUSO | La traccia è nella scheda (`segn1.png`). In Scadenze non ci sono più né ✎ né «Fatta» (`scad1.png`) |
| 6·P2 Conti: saldi di tutto l'ente | **APERTO** | Cassa a −3.828 € in rosso. «1 conto, tutto verificato» accanto a «14 da verificare» (`conti1.png`). In FR: «5 mouvements à vérifier» contro «20 à vérifier» (`fr_conti.png`) |
| 6·P2 Aiuto prolisso e misto | CHIUSO | Da 39 a 88 parole, scritte per l'operatore |
| 6·P2 PDF FR | CHIUSO | `aut9.pdf` è bilingue, con «Vendeur sans reçu» |
| 6·P3 Codice vuoto nella conferma | CHIUSO | `spesa1_post.png` |
| 6·P3 «Modifiche salvate» | CHIUSO | «Movimento registrato: MOV-2026-011» |
| 6·P3 «Importo letto» senza foto | CHIUSO | `nuovo1.png` |
| 6·P3 «1 movimenti» | CHIUSO | «1 movimento» con il filtro Bozze |
| 6·P3 Data futura accettata | CHIUSO | Il 2027 blocca «Registra». Il messaggio però è impreciso (vedi N9-3): `futuro1.png` |
| 6·P3 Riquadro vuoto «Anteprima non disponibile» | **APERTO** | `autoc2.png` |
| 6·P3 «Ritaglia» con altezze diverse / pillole di Scadenze | **APERTO** | Pulsanti da 44 e 50 px (`foto1.png`). Pillole su tre righe asimmetriche (`scad_click.png`) |
| 6·P3 FR «tu» | CHIUSO | «Que devez-vous acheter», tutto al «vous»: `fr_ant_new.png` |
| 6·P3 Contenuti da amministratore in Scadenze | CHIUSO | Non ci sono più «Nuova scadenza» né la fine del finanziamento: `scad1.png` |
| 7·1 Ricerca senza risultati | CHIUSO | `cod_zzqx.png` |
| 7·2 «Pagato da» non segue l'anticipo | CHIUSO | Diventa Hery, poi torna all'operatore |
| 7·3 Spesa di tasca propria come «Bozza» | CHIUSO | In elenco e in Dashboard è «Da rimborsare». Resta un residuo (N9-2) |
| 7·4 Contanti in mano | CHIUSO | 50.000 propri, i 30.000 di Hery a parte: `ant_op2` |
| 7·5 Conta senza conferma | CHIUSO | Casella più nota obbligatoria: `conta1.png`, `conta_nonota.png` |
| 7·6 «riso» → 101–108 | CHIUSO | Trova solo 307 |
| 7·7 «0 MGA · anticipo ricevuto» | CHIUSO | `dash1.png` |
| 7·8 Stati nell'aiuto della Dashboard | CHIUSO | `dash_help.png` |
| 7·9 Fumetto nativo del browser | CHIUSO | «Campo obbligatorio» nello stile dell'app |
| 7·10 Conti italiani in modifica | CHIUSO | Solo conti MG (provato su una bozza poi eliminata) |
| 7·11 «Da fare» doppio | CHIUSO | |
| 7·12 FR «Errore segnalato» | CHIUSO | «Erreurs signalées…»: `fr_dash.png` |
| 7·13 Anno 2027 | CHIUSO | |
| 7·14 Guida da amministratore | **APERTO** (residuo) | «Vedere cosa scade» parla di pagamenti a 30 giorni e di «Fatta», che l'operatore non vede |
| 7·15 «Apri il PDF» fuori riquadro | CHIUSO | `autoc2.png` |
| 7·16 Voce tecnica tra le persone | CHIUSO | |
| N1 Doppio invio della richiesta | CHIUSO | Con 2 s di latenza: pulsante grigio con rotellina (`ant_invio.png`). Due tocchi creano una sola richiesta |
| N3 Doppione di sé stesso | CHIUSO | Non riprodotto |
| N5 Conta senza nota | CHIUSO | Nota obbligatoria. La parola «database» non compare più |
| N6 «Hai in mano» con l'anticipo di Hery | CHIUSO | «Hery … ha in mano: 30.000 MGA» |
| N7 Bozza: «premi Registra» | CHIUSO | Ora dice «tocca Modifica, poi Registra» |
| N8 Guida su bozza e scontrino | CHIUSO | |
| N9 «Chiedi un anticipo» | CHIUSO | L'aiuto cita «+ Nuova richiesta» |
| N10 Filtri da amministratore | CHIUSO | Banca Italia e PayPal non ci sono più; «Da rimborsare» compare nel filtro Stato |
| N11 Richieste non in Dashboard | CHIUSO | «Richiesta di anticipo in attesa» |
| N12 MOV a capo / ✎ | CHIUSO | Trattino non separabile; il ✎ non c'è più |
| N14 Maniglie tagliate | CHIUSO | `foto1.png` |

**Conteggio: 41 CHIUSI · 4 APERTI · 0 PEGGIORATI.**

## B. Compiti svolti (375 px salvo dove indicato)
- **Dashboard**: si capisce subito cosa fare: c'è il pulsante «Registra una spesa», ci sono quattro riquadri e il «Da fare» è personale (`dash3.png`).
- **Spesa in contanti MGA con foto**: «riso», «pane» e «taxi» trovano un solo codice ciascuno, giusto (307 o 202). «zzqx» mostra un messaggio chiaro e non lascia nessun codice scelto. Il ritaglio funziona. MOV-2026-006 registrato (`spesa1_post.png`).
- **Di tasca propria**: risulta «Da rimborsare» in scheda, in Dashboard, nel filtro e nella pagina Rimborsi. In più l'app avvisa che la stessa foto è già allegata a un altro movimento (`tasca_pre.png`).
- **Anticipo per sé e per Hery** (persona senza account): ho inviato due volte con la rete rallentata e la richiesta è una sola. Come responsabile ho autorizzato e consegnato, con «Registra e prepara la ricevuta». Tornato operatore, i contanti risultano separati per persona.
- **Spesa con l'anticipo**: l'anticipo proprio è preselezionato. Scegliendo quello di Hery, «Pagato da» e «Hai in mano» seguono la scelta. MOV-2026-010 registrato.
- **Spesa senza giustificativo**: il motivo si sceglie con un tocco. L'autocertificazione è precompilata e il PDF bilingue è corretto (`aut9.pdf`).
- **Bozza incompleta → Registra**: la pagina torna in cima e il campo mancante è evidenziato (`bozza_reg_err.png`).
- **«Hai trovato un errore?»**: il campo vuoto viene rifiutato. Dopo l'invio c'è una traccia nella scheda, in Da fare e in Scadenze.
- **Conta di cassa con differenza di 20,5 milioni MGA**: servono la spunta e la nota, poi compare «Conta registrata.» (`conta3.png`).
- **Aiuto e Guida**: sono coerenti con lo schermo, con un solo residuo (7·14).
- **FR**: Dashboard, Nuovo con ricerca «riz/pain/taxi/zzqx», una spesa registrata (MOV-012), Anticipi, Conti, Movimenti, scheda, Échéances, Guide, aiuto e menu «Plus». Poi ho riportato la lingua in italiano.
- **768 px**: Dashboard, Movimenti, Nuovo, Conti, Anticipi, Scadenze, scheda e Guida (`t768_*.png`). Nessuno scorrimento orizzontale della pagina: deborda solo la tabella delle conte.

## Voti
| Area | Giro 8 | Giro 9 | Motivo |
|---|---|---|---|
| Facilità complessiva | 8 | **7** | Due P2: Conti (6·P2 aperto) e N9-1 |
| Registrare una spesa | 8,5 | **8,5** | Flusso senza esitazioni; tre P3 (N9-2, Ritaglia, N9-6) |
| Capire gli stati | 9 | **9** | Stesse parole ovunque, in IT e in FR; un P3 (N9-2) |
| Errori e recupero | 8 | **9** | Conta protetta, data futura bloccata; due P3 (N9-3, N9-4) |
| Aiuto in pagina e Guida | 8,5 | **9** | Testi brevi e per ruolo; due P3 (7·14, N9-7) |
| Francese | 8 (giro 7) | **8,5** | «vous» ovunque, errori tradotti; tre P3 (N9-5) |
| Velocità percepita | 7,5 | **7,5** | Visite ripetute in 2,0–2,4 s. Salvataggi con foto in 19–30 s (2 misure, server condiviso); senza foto in 1,3–4 s |
| **Complessivo** | **8** | **8** | |

**Perché scende la Facilità complessiva.** Il P2 sui Conti c'era già ed era stato tollerato. Il secondo P2 (N9-1) quasi certamente c'era già ma non era stato visto: nel giro 8 la vista «Tutti» non era stata aperta. Non è un peggioramento dimostrato.

## Difetti nuovi
| # | Grav. | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| N9-1 | **P2** | /movimenti?mie=0 · 375 | In «Tutti» l'operatore vede 1.011 movimenti di tutto l'ente, compreso il giroconto da Banca Italia (MOV-2026-003, con i conti), e può persino segnalarvi errori. Conti invece dice che i conti bancari «li vedono responsabili e amministratori». Questa pagina impiega anche 6–13 s | `op_giroconto.png` |
| N9-2 | P3 | /nuovo · 375 | L'avviso «già allegato a MOV-2026-006 … è la stessa spe…» è tagliato a metà parola. In FR chiama «Brouillon» la spesa da rimborsare | `crop_dup.png` |
| N9-3 | P3 | /modifica · 375 | Con la data del documento nel 2027 il messaggio è «Per registrare mancano: data del documento», ma la data c'è: è nel futuro | `futuro1.png` |
| N9-4 | P3 | /conti · 375/768 | Lo storico delle conte deborda: la colonna «Differenza» (375) e l'ultima colonna (768) restano fuori vista | `conta_nonota.png`, `t768_conti.png` |
| N9-5 | P3 | FR | «Dépenses avancées sur fonds propres» (vuol dire capitale proprio). «De sa poche» nel modulo contro «de votre poche» in Dashboard. Manca lo spazio in «comptabilisé:» | `fr_scad`, `fr_spesa_post.png` |
| N9-6 | P3 | /nuovo | Il finanziamento è proposto da solo per MOV-006, 007 e 012, ma non per MOV-010, che è dello stesso progetto (impressione: la regola non è chiara) | schede |
| N9-7 | P3 | aiuto, tutte le pagine | All'apertura il pannello mostra «…» per circa 1 s prima del testo | primo tentativo su `dash_help` |
| N9-8 | P3 | /conti · 375/768 | «Anticipi aperti 11 €» porta come titolo «Operatore Prova» insieme a «2 persone» | `t768_conti.png` |

Fuori dall'area operatore: la pagina /anticipi del responsabile scrive «2 richiesta in corso» (P3).

**Non giudicato**: l'anteprima del giustificativo appena caricato è un'immagine rotta. Il file salvato nell'archivio locale (porta 3400) è un corpo multipart e non un PDF, quindi è probabilmente un limite di questa copia: non verificabile qui.
