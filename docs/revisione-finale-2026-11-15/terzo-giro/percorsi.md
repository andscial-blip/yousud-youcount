# YouCount – revisione finale dei percorsi d'uso

Metodo: script Playwright in `/tmp/yc-final/work/p` (schermate e PDF nella stessa cartella), 375 px, importi digitati un tasto alla volta. Il server si è riavviato azzerando i dati alle 03:58, 04:08, 04:16 e 04:29: i percorsi interrotti sono stati rifatti. «Verificato» = provato; «impressione» dove indicato.

## Esito dei percorsi

| # | Percorso | Passi | Esito |
|---|---|---|---|
| 1 | Uscita MGA senza giustificativo + autocertificazione | 10 tocchi (6 dal secondo movimento: conto, progetto e modalità riproposti) + 3 per il PDF | Riuscito. Motivo con un tocco, opzione autocertificazione già spuntata. Dopo «Registra»: scheda con «Movimento registrato: MOV-…», «Registrane un altro / Torna al registro», modulo autocertificazione aperto. PDF bilingue per MGA, allegato al movimento, stato «Da firmare». Cambio stampato «1 € = 5.340 MGA» = scheda movimento («5.340»); il modulo mostrava 5.339,63 (D4) |
| 2 | Importi, modulo vuoto, ricerca voce | – | Riuscito. Tutti gli importi richiesti salvati correttamente (tabella sotto). Modulo vuoto: errori tutti insieme («Per registrare mancano: importo, codice contabile, descrizione, giustificativo» + «Campo obbligatorio» sui campi). Descrizione obbligatoria. Ricerca «taxi» → 1 voce, da selezionare a mano (D9) |
| 3 | Anticipo, contanti e Dashboard dell'operatore | 2 tocchi per arrivare («+» → «Chiedi un anticipo»), 4 campi | Riuscito: richiesta «da autorizzare», annullabile. Conti: solo casse, anticipi e conta di cassa, con spiegazione. Dashboard: nessun compito altrui in «Da fare», ma messaggio contraddittorio (D3). Movimento proprio: sola lettura con spiegazione chiara su come farlo correggere |
| 4 | Verifica e storno (responsabile) | 1 tocco per verificare; storno 3 (apri, motivo, conferma) | Riuscito con intoppo: dopo «Verifica» la lista non si aggiorna (D1). Storno: motivo obbligatorio, messaggio chiaro («MOV-007 annulla MOV-006. Va verificato da un'altra persona»), propone «Crea la copia corretta». Storico poco leggibile (D8) |
| 5 | Ricevuta: bozza → emissione → PDF → annullo → PDF | 5 campi + 2 + 2 | Riuscito. Conferma esplicita prima del numero definitivo («Conferma: emetti il documento», con avviso). PDF RIC-2026-001 scaricato. Annullo con motivo obbligatorio; PDF annullato con fascia rossa «Documento annullato / Document annulé – motivo» e filigrana «ANNULLATO · ANNULÉ» |
| 6 | Preventivo: revisione, riga, eliminazione bozza | 1 + 6 campi + 3 | Riuscito con intoppi: «Prepara una revisione» crea subito la Revisione 2 (344 righe copiate, messaggio solo «Salvato.»). Riga salvata: «Riga n. … salvata», gruppo aperto; visibile nella bozza piccola, fuori schermo in quella da 345 righe (D5). Eliminazione: conferma presente, ma lo schermo non cambia (D2) |
| 7 | Cambio password | 2 tocchi | Riuscito. Chiede password attuale, nuova e ripetizione (min. 10); attuale sbagliata → «La password attuale non è corretta.»; «Annulla» torna all'account; password di prova ancora valida |
| 8 | Coerenza delle cifre | – | Coerente (numeri sotto) |
| 9 | Navigazione su telefono | – | Riuscito: «Altro» apre 6 sezioni + Esci; una sola freccia indietro per pagina; titolo proprio in ogni pagina di Impostazioni; aiuto di scheda e ricerca della Guida funzionano (D13) |

### Percorso 2 – digitato → salvato

| Digitato | Valuta | «Importo letto» | Salvato |
|---|---|---|---|
| 12,50 | EUR | 12,50 € | 12,50 € |
| 1250 | EUR | 1.250,00 € (il campo mostra «1.250») | 1.250,00 € |
| 1.250 | EUR | 1.250,00 € | 1.250,00 € |
| 12.5 | EUR | 12,50 € (il campo diventa «12,5») | 12,50 € |
| 1.250,5 | EUR | 1.250,50 € | 1.250,50 € |
| 25.000 | MGA | 25.000 MGA · 4,68 € | 25.000 MGA / 4,68 € |
| 1.250.000 | MGA | 1.250.000 MGA · 234,10 € | 1.250.000 MGA / 234,10 € |

Solo lettura del campo, non registrati: «12.50» → 12,50 · «1.25» → 1,25 · «12.500» → 12.500,00 · «1250.75» → 1.250,75 · «-5» → 5,00 · «abc» → vuoto · «1,250» → 1,25 e «12,505» → 12,50 (D6).

### Percorso 8 – numeri letti (super_admin, 2026, dati appena azzerati)

| Dato | Dashboard | Analisi | Report mensile | Registro | Rendiconto |
|---|---|---|---|---|---|
| Entrate | 228.094 € | 228.094 € | 228.094 € (227.859,33 IT + 234,21 MG) | 228.093,54 € | 228.093,54 € |
| Uscite | 173.334 € | 173.334 € | 173.334 € (75.059,23 + 98.274,80) | 173.334,03 € | 172.220,78 € |
| Saldo | 54.760 € | 54.760 € | 54.759,51 € | 54.759,51 € | 55.872,76 € |

Il Rendiconto differisce di 1.113,25 €, pari ai 18 movimenti con codice 999, e lo dichiara in un avviso: coerente. Liquidità: Dashboard 53.090 € = Conti 53.090 € (52.000,10 € Italia + 5.820.097 MGA = 1.090 €). Da verificare: Dashboard 40 = Verifica 40 = Conti 40 (17+4+14+5 per conto) = Registro filtrato 40.

## Voti

| Area | Voto | Funziona | Non funziona | Cosa impedisce il 10 |
|---|---|---|---|---|
| UX | 7,5 | Conferme a due passi coerenti (emetti, storna, annulla, elimina); esiti con numero e passo successivo | Due azioni senza riscontro a schermo (D1, D2); riga nuova fuori vista (D5) | Aggiornare la lista dopo ogni azione; portare in vista e evidenziare la riga salvata |
| Facilità per operatore poco esperto | 7,5 | Motivi pronti, «Importo letto», errori tutti insieme, campi riproposti, spiegazione su cosa può fare | Dashboard contraddittoria (D3); voce unica non selezionata (D9); note interne visibili (D10) | Togliere il riquadro «Da verificare» all'operatore o rinominarlo; elencare l'autocertificazione da firmare |
| Completezza | 8,5 | Tutti i 9 percorsi si chiudono, compresi PDF e annullo | Storico parziale (D8, D12) | Storico con stato da→a, storno e annullo con autore e ora |
| Affidabilità e coerenza dei dati | 8 | Cifre identiche fra 5 pagine; scarto del Rendiconto spiegato | Tasso mostrato arrotondato che non riproduce gli importi (D4); cifra troncata in digitazione (D6) | Stampare il tasso con i decimali usati; avvisare quando una cifra viene scartata |
| Organizzazione e navigazione | 8 | Una freccia indietro, titoli chiari, menu «Altro» ordinato, Guida con ricerca immediata | Etichette del menu operatore non adattate al ruolo (D14); nome dell'aiuto incoerente (D13) | Descrizioni di menu per ruolo; un solo nome per l'aiuto |
| Qualità complessiva | 8 | Solido sui percorsi contabili e sui documenti | I difetti P2 qui sotto | Chiudere D1–D6 |

## Difetti

| ID | Grav. | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| D1 | P2 | /verifica con filtro «Inserito da» · 375 | Dopo «Verifica» la riga resta e il conteggio non cambia per almeno 16 s, senza messaggio; solo ricaricando sparisce (41→40). Visto 2 volte | log p4d.mjs, p4d_lista_dopo.png |
| D2 | P2 | /preventivo · 375 | Dopo «Conferma: elimina la bozza» lo schermo mostra ancora la bozza e il vecchio avviso «Riga n. 345 salvata» per almeno 10 s; la bozza è in realtà eliminata. Nessun «bozza eliminata» | p6f_dopo_elimina.png, p6g.mjs |
| D3 | P2 | Dashboard operatore · 375 | Riquadro «Da verificare 40» sopra «Tutto in ordine · Niente da verificare, rimborsare o firmare»; l'autocertificazione «Da firmare» dell'operatore non compare in «Da fare» | p9c_op_dash.png, log p3b.mjs |
| D4 | P2 | Scheda movimento, PDF autocertificazione e ricevuta | Tasso salvato 5.339,63, mostrato e stampato «5.340»: 1.250.000 MGA ÷ 5.340 = 234,08 € ma è scritto 234,10 €; 150 € × 5.340 = 801.000 MGA ma è stampato 800.945 | autocert.pdf, ricevuta_emessa.pdf, log p2b.mjs |
| D5 | P2 | /preventivo bozza da 345 righe · 375 | La riga appena salvata è 440 px sotto il bordo dello schermo (nella bozza da 3 righe è visibile) | log p6f.mjs, p6f_dopo_riga.png |
| D6 | P2 | /nuovo · 375 | «1,250» diventa 1,25 e «12,505» diventa 12,50: la terza cifra è scartata mentre si digita, senza avviso | log p2c.mjs |
| D7 | P3 | /nuovo, /conti | Cassa Madagascar a −20.441.300 MGA; una nuova uscita in contanti passa con il solo avviso | log p1a.mjs, p8_conti.txt |
| D8 | P3 | Scheda movimento | Storico: «modifica · Stato» senza dire quale stato; lo storno e la generazione dell'autocertificazione non compaiono nello storico dell'originale | log p4e.mjs |
| D9 | P3 | /nuovo | «1 voci trovate»; la voce unica non viene selezionata | log p1b.mjs |
| D10 | P3 | Scheda movimento (operatore) | Nota interna «Testo ripreso dal Gestionale: da far verificare al commercialista» | p1f_det.png |
| D11 | P3 | Ricevuta in euro | Stampa controvalore in MGA e cambio non richiesti | ricevuta_emessa.pdf |
| D12 | P3 | Documento emesso annullato | «Registro» riporta creazione ed emissione, non chi e quando ha annullato; il PDF annullato non ha data di annullamento | log p5h.mjs |
| D13 | P3 | Guida / pulsante di aiuto | La Guida parla di «Come funziona questa scheda», il pulsante si chiama «Come si fa» | log p9b.mjs |
| D14 | P3 | Menu e Progetti (operatore) | «Impostazioni: account, utenti, categorie e dati» e «Documenti: rendiconti…» per sezioni che non può aprire; Progetti dice «nessun preventivo in vigore» | log p9c.mjs |
| D15 | P3 | /preventivo, registro | «Prepara una revisione» risponde solo «Salvato.»; lo storno in registro è etichettato «Uscita» con importo positivo | log p6e.mjs, p4e.mjs |
| D16 | P3 | Anticipi, storno, annullo, password | Campi obbligatori segnalati solo dal fumetto del browser, non con il messaggio in pagina usato in /nuovo | log p3b.mjs, p7.mjs |
| D17 | P3 | Dashboard | Errore di idratazione in console | log p3a.mjs |

## Non verificato
- Foto del giustificativo e lettura AI; uso offline e PWA; telefono vero.
- Se D1 si presenta anche senza filtro; se D1 e D2 dipendono dall'ambiente di prova.
- Se l'operatore deve vedere tutti i 1.017 movimenti e i totali dell'ente (stipendi compresi) o solo i progetti assegnati: qui li vede tutti.
- Se l'operatore può emettere documenti («+ Emetti» e «Quietanza» gli sono offerti): modulo aperto, emissione non provata.
- Registrazione della copia firmata dell'autocertificazione; autorizzazione e consegna dell'anticipo.
- Tempi di salvataggio (1,4–13 s osservati) su macchina condivisa.
- Versione francese dei percorsi.
