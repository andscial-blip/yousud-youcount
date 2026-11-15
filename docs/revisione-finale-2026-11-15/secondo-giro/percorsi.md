# YouCount · revisione finale dei percorsi d'uso

Revisore UX indipendente. Percorsi eseguiti con Playwright (importi digitati un tasto alla volta), soprattutto a 375 px. Script, log e schermate: `/tmp/yc-final/work/p/`. Il server si è riavviato quattro volte (19:59, 20:09, 20:26, 20:46) azzerando i dati: i percorsi toccati sono stati rifatti. «Verificato» = provato; «impressione» = non dimostrato.

## Esito dei percorsi

| # | Percorso | Esito | Passi | Prova |
|---|---|---|---|---|
| 1 | Uscita MGA senza giustificativo | Riuscito. Motivo a scelta rapida (4 pulsanti), autocertificazione già spuntata; dopo «Registra» si apre la scheda del movimento con conferma, numero, «Registrane un altro» e modulo dell'autocertificazione (dichiarante e motivo già compilati). Il modulo resta disponibile anche riaprendo il movimento. Avviso chiaro se la cassa va sotto zero. | ~13 tocchi + testo | p1c, p1_after.png, pb.mjs |
| 2 | Importi, campo vuoto, ricerca voce | Importi corretti in tutti i formati italiani; errori in pagina con scorrimento e fuoco sul primo campo; ricerca voce utile ma non seleziona. Vedi tabella sotto. | – | p2.log, p2b.log, p2_empty_view.png |
| 3 | Anticipo di contanti | Riuscito: «+» → «Chiedi un anticipo» → modulo corto (chi riceve = sé stesso, MGA) → «Richiesta inviata: ora la autorizza il direttore o un responsabile», stato «da autorizzare», «Annulla». Sul proprio movimento registrato: nessuna modifica, messaggio «chiedi a un responsabile… indicandogli il numero». | 5 tocchi | p3e, p3b.log |
| 4 | Verifica e storno (responsabile) | Riuscito: «Verifica» in un tocco; storno con motivo obbligatorio; dopo lo storno messaggio «MOV-007 annulla MOV-006. Va verificato da un'altra persona» e pulsante «Crea la copia corretta»; l'originale mostra «Stornato da MOV-007». Storico leggibile ma povero («modifica · Stato»). | 2 + 3 tocchi | p4g.log, p4_after_storno.png |
| 5 | Ricevuta: bozza, emissione, PDF, annullamento | Riuscito. Anteprima «BOZZA – non valida», numero RIC-2026-001 all'emissione, PDF scaricato; dopo l'annullamento il PDF porta fascia rossa «Documento annullato / Document annulé – motivo» e filigrana «ANNULLATO». | ~9 tocchi | p5_draft.png, p5_emesso.pdf, p5_annullato_pg-1.png |
| 6 | Preventivo: revisione, riga, eliminazione | Riuscito (1440 px). «Prepara una revisione» crea la Revisione 2; riga salvata («Riga n. 4 salvata»), gruppo aperto e riga in vista; «Elimina la bozza» chiede conferma in due passi («Conferma: elimina la bozza»). | 4 + 3 | p6_after_row.png, p6f, p6g |
| 7 | Cambio password | Riuscito: chiede la password attuale, rifiuta quella sbagliata («La password attuale non è corretta.»), segnala «Le due password non coincidono.», minimo 10 caratteri; «Annulla» torna a Il mio account; la vecchia password funziona ancora. | 3 | p7b, p7c |
| 8 | Coerenza delle cifre | Coerente. Vedi sotto. | – | p8_*.txt, p8b.log, p9b.log |
| 9 | Navigazione su telefono | Buona: «Altro» ordinato per sezioni; una sola freccia indietro per pagina («Torna al menu» in Impostazioni, «Torna alla pagina precedente» in /nuovo); titoli H1 presenti (Utenti, Categorie, Chiusure mensili…); «Come si fa» apre la spiegazione della scheda; nessuno scorrimento orizzontale su 18 pagine. Ricerca della Guida debole. | – | p9.log, p9b.log |

### Percorso 2 · digitato → salvato (operatore, 375 px)

| Digitato | Valuta | Mostrato nel campo | «Importo letto» | Salvato |
|---|---|---|---|---|
| 12,50 | EUR | 12,50 | 12,50 € | 12,50 € |
| 1250 | EUR | 1.250 | 1.250,00 € | 1.250,00 € |
| 1.250 | EUR | 1.250 | 1.250,00 € | 1.250,00 € |
| 12.5 | EUR | 12,5 | 12,50 € | 12,50 € |
| 1.250,5 | EUR | 1.250,5 | 1.250,50 € | 1.250,50 € |
| 25.000 | MGA | 25.000 | 25.000 MGA · 4,68 € | 25.000 MGA |
| 1.250.000 | MGA | 1.250.000 | 1.250.000 MGA · 234,10 € | 1.250.000 MGA |
| 12,5 | MGA | 12,5 | 13 MGA, «i decimali vengono arrotondati» | 13 MGA |
| 1,250.50 | EUR | 1,25 | 1,25 € | 1,25 € (resto scartato senza avviso) |
| -5 / 12,505 / 0 | EUR | 5 / 12,50 / 0 | 5,00 € / 12,50 € / – | 5,00 € / 12,50 € / rifiutato |

Campo vuoto: messaggio rosso «Campo obbligatorio» sotto il campo, riepilogo «Per registrare mancano: …» vicino al pulsante. Ricerca voce: «taxi» → 202, «carbur» → 204, «606» → 606; «benzina» → 0 voci.

### Percorso 8 · numeri letti (dati iniziali, 2026)

| Pagina | Entrate | Uscite | Saldo |
|---|---|---|---|
| Dashboard | 228.094 € | 173.334 € | 54.760 € |
| Analisi | 228.094 € | 173.334 € | 54.760 € |
| Report mensile (totale) | 227.859,33 + 234,21 = 228.093,54 € | 75.059,23 + 98.274,80 = 173.334,03 € | 54.759,51 € |
| Registro | 228.093,54 € | 173.334,03 € | 54.759,51 € |
| Rendiconto | 228.093,54 € | 172.220,78 € | 55.872,76 € |

Rendiconto: differenza di 1.113,25 € dichiarata nell'avviso «18 movimenti con codici senza riga (999)… non entrano» (173.334,03 − 172.220,78 = 1.113,25: torna). Liquidità: Dashboard 53.090 € = Conti 53.090 € = 52.000,10 € + 5.820.097 MGA al cambio 5.339,63. Da verificare: Dashboard 40 · Verifica 40 · Conti 40 (17+4+14+5) · Registro filtrato 40 · Chiusure mensili 38+1+1.

## Voti

| Area | Voto | Funziona | Non funziona | Cosa impedisce il 10 |
|---|---|---|---|---|
| UX | 8 | Conferme chiare dopo ogni azione; passo successivo sempre proposto; errori in pagina | Convalida a tappe; messaggi del browser in alcuni moduli; emissione senza conferma | Elenco completo dei campi mancanti al primo tentativo; stessi messaggi in tutti i moduli; conferma all'emissione |
| Facilità per operatore poco esperto | 7,5 | Motivi a un tocco, «Importo letto», proposta del conto, messaggio «a chi rivolgersi» | Dashboard dell'operatore = conti dell'ente + compito «da verificare» che non può svolgere; ricerca voce senza sinonimi né selezione | Dashboard operatore centrata su «le mie cose»; ricerca voce che seleziona e capisce parole comuni |
| Completezza | 8,5 | Tutti i nove percorsi si chiudono; autocertificazione, storno, copia corretta, PDF annullato | Storico poco descrittivo; descrizione non obbligatoria | Storico con «da → a» e storno; descrizione obbligatoria |
| Affidabilità e coerenza dati | 8 | Totali, liquidità e «da verificare» coincidono ovunque; importi interpretati bene | Cambio sbagliato sull'autocertificazione; movimento senza descrizione verificabile | Stesso cambio del movimento sui documenti; controlli minimi alla verifica |
| Organizzazione e navigazione | 8 | Menu «Altro», una freccia, titoli, aiuto per scheda | Ricerca Guida a parole singole; nomi diversi per la stessa cosa (Categorie / Codice contabile / voce) | Ricerca tollerante; un solo termine |
| Qualità complessiva | 8 | Prodotto coerente e curato, adatto all'uso reale | I difetti sotto | Chiudere i P1–P2 |

## Difetti

| # | Gravità | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| 1 | P1 | Autocertificazione PDF · 375 | «Cambio applicato: 1 € = 5.357 MGA» mentre il movimento dice 5.340 (tasso del mese 5.339,63): il cambio è ricalcolato da 3.000 MGA / 0,56 € arrotondati | pb_aut.pdf, pc.mjs |
| 2 | P2 | /nuovo, /verifica · 375 | Si registra e si verifica un movimento senza descrizione né modalità: scheda «Descrizione –», nelle liste compare solo «Uscita» | p3b.log, p4a |
| 3 | P2 | /nuovo · 375 | Campi mancanti segnalati a tappe: modulo vuoto → «mancano: importo, codice contabile»; poi «giustificativo»; poi «conto, progetto» | p2.log A1, p2c.log, p2d.log |
| 4 | P2 | /documenti-emessi/<id> · 375 | «Emetti e genera il PDF» (e «Emetti» nella barra) assegna subito il numero definitivo, senza conferma | p5d emit |
| 5 | P2 | Dashboard operatore · 375 | Mostra entrate/uscite dell'ente e «41 movimenti da verificare»; /verifica risponde «sezione visibile a responsabili…» | p3f, pa.mjs |
| 6 | P3 | /nuovo | Ricerca voce: un solo risultato non viene selezionato; «1 voci trovate»; «benzina» → 0 | p2.log B |
| 7 | P3 | Anticipi, storno, annullamento, password | Campi vuoti segnalati dal browser («Please fill out this field»), non dall'app | p3e, p4e, p7b |
| 8 | P3 | Scheda movimento | Storico: «modifica · Stato» senza valori; lo storno non compare nello storico dell'originale | p4g.log |
| 9 | P3 | /guida · 375 | «ricevuta persa» → «Nessun argomento trovato» | p9b.log |
| 10 | P3 | /nuovo | «1,250.50» diventa 1,25 senza avviso; «Salva bozza» con 0 dice «Per registrare mancano» | p2b.log |
| 11 | P3 | Rendiconto / Dashboard | Due «avanzi» diversi (55.873 e 54.760 €); spiegato solo nell'avviso | p8_rendiconto.txt |
| 12 | P3 | Documento emesso | Il registro del documento non riporta la data di annullamento; azioni doppie (riquadro + barra) | p5d state, p5_draft.png |

## Non verificato
Telefono vero, PWA, fotocamera («Scatta una foto»), uso senza rete e rete lenta. Tempi di risposta (15–85 s su macchina condivisa: non attribuibili all'app). Un «Application error» comparso una volta dopo lo storno, in coincidenza con la caduta del server: non riprodotto al secondo tentativo. Autorizzazione e consegna dell'anticipo, quindi i contanti dell'operatore con un anticipo aperto (visto solo «Anticipi aperti 0 €»). «Crea la copia corretta» e «Modifica» del responsabile. Se la ricevuta emessa genera un movimento. Interfaccia in francese. Percorsi 1–5 e 7 solo a 375 px; 6 e 8 a 1440 px. Cifre del percorso 8 lette sui dati iniziali, non dopo i miei dati di prova.
