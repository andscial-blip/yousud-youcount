# YouCount — Operatore, quindicesimo giro

21/11/2026, 13:30–13:55 ora di Antananarivo, operatore, 375 px. Prove in `/tmp/yc-final/work/`. Il server si è riavviato alle 13:41 e alle 13:51: ho rifatto i passi. L'anteprima della foto nella scheda è rotta perché l'archivio locale (porta 3400) restituisce il corpo multipart: limite della copia di sviluppo, «non verificato».

## A. Riverifica dei difetti aperti

| Id | Esito | Prova |
|---|---|---|
| R1 «scegli dall'elenco» senza elenco | CHIUSO | Con «zzzxq» compare «Nessun codice per «zzzxq». Prova una parola più generale… o scegli dall'elenco qui sotto, che mostra tutti i codici». Il menu ha 64 codici (`cerca.mjs`) |
| R2 Guida: «un solo codice è già scelto» | CHIUSO | La Guida ora dice «se resta un solo codice, toccalo per sceglierlo» (`guida_op.txt`, riga 75). È coerente con il menu «1 codice trovato: toccalo qui sopra» (`sp3_riso.png`) |
| R3 «In attesa di verifica» in Dashboard | CHIUSO in Dashboard | Il riquadro si chiama «Da verificare» in italiano e «À vérifier» in francese (`o_home2__1.png`, `fr_home.png`). Resta una traccia in /movimenti: vedi S1 |
| R4 Scadenze da amministratore | CHIUSO | La voce ora è «Rimborso che ti spetta: 1 · Spese che hai pagato di tasca tua: te le rimborsa un responsabile». La legenda ha solo «da fare / promemoria / fatta» (`o_scad__2.png`, testo di /scadenze) |
| R5 Campo e pulsante restano dopo la segnalazione | CHIUSO | Dopo l'invio compare il riquadro «Segnalato il 21/11/2026, in attesa del responsabile», con il testo citato e il link «Aggiungi un dettaglio alla segnalazione». Il pulsante «Segnala al responsabile» non c'è più (`segn_dopo.png`) |
| R6 Guida: conto, «+ Nuovo movimento», «Rimborsato a te» | APERTO, in parte | (c) è chiuso: «Rimborsato nel» anno in corso. (b) è chiuso nelle domande frequenti («tocca «Registra una spesa»»). Nel capitolo «Registrare una spesa o un'entrata» restano però «Premi «+ Nuovo movimento»» (b) e «Scegli il conto da cui escono o in cui entrano i soldi» (a) (`guida_op.txt`, righe 79 e 81) |
| Q4 /rimborsi da amministratore | CHIUSO | La pagina mostra «Da rimborsare a te», «Le tue spese da rimborsare» e «Rimborsato nel 2026» per intero. «Da documentare» non c'è più. L'aiuto è coerente con la pagina (`o_rimb2__1.png`, `help.mjs`). Resta un dettaglio: S3 |
| N-6 PDF in francese | CHIUSO | Il PDF bilingue contiene «relative au projet « Frais généraux »» e «Lieu et date : ___» (`aut1.pdf`, pdftotext) |
| N-2 Data UTC tra le 00 e le 03 | non verificabile ora | Ora locale 13:32 |

## B. Compiti fissi e voti

| Compito | Esito | Prova |
|---|---|---|
| Dashboard | Chiaro. In alto il pulsante «Registra una spesa», poi 4 riquadri e «Da fare», che dice cosa tocca all'operatore (autocertificazioni, bozze, errori segnalati, richiesta di anticipo) | `o_home__1.png`, `o_home2__1.png`, `bozza.mjs` |
| Spesa in contanti MGA con foto | Riuscita. Ho caricato la foto, l'ho ritagliata e ho toccato «Usa». «Hai scritto: 15.000 MGA · Controvalore: 2,81 €». Poi codice 307 e progetto. La conferma dice «Movimento registrato: MOV-2026-006. Ora lo controlla un responsabile.» | `sp_foto.png`, `sp3_scheda.png` |
| Ricerca dei codici | «riso» → 307, «taxi» → 202, «pane» → 307: un solo risultato, da toccare. Con una parola senza risultati compare l'elenco completo. Il «Codice suggerito» sotto la descrizione è corretto per «Taxi per Ambanja», «Pane per merenda» e «Riso e olio per la mensa» | `cerca.mjs`, `sugg.mjs` |
| Stati | «Bozza», «Da verificare», «Verificato» e «Da rimborsare» sono uguali in Dashboard, nell'elenco, nella scheda, nei filtri e nell'aiuto, tranne la riga di riepilogo di /movimenti (S1) | `o_mov__1.png`, `filtri.mjs` |
| Campi mancanti | Il messaggio «Per registrare mancano: importo, codice contabile, progetto, descrizione, giustificativo» compare con «Campo obbligatorio» sotto ogni campo | `sp_vuoto.png` |
| Bozza incompleta | Si salva con il solo importo. La scheda dice «Bozza salvata… tocca «Modifica», poi «Registra»». «Registra» elenca i campi che mancano. La Dashboard conta «Bozze 1» e la voce «Bozze da completare: 1» | `bozza.mjs`, `bozza2.png` |
| Spesa di tasca propria senza giustificativo | Senza motivo compare «Per salvare mancano: perché manca il giustificativo». Con il motivo, la scheda si apre su `aut=1` e scende fino al modulo (scrollY 973) | `tasca_nomotivo.png`, `aut.mjs` |
| Segnalazione d'errore | Funziona. Arriva in «Da fare» e in Scadenze. Con il campo vuoto compare il fumetto del browser (S6) | `segn_dopo.png`, `o_scad__2.png` |
| Conta di cassa con differenza grande | Il pulsante resta disattivato finché non si spunta la conferma e non si scrive la nota obbligatoria. Il messaggio è chiaro: «Differenza grande (20.541.300 MGA). Riconta…». La casella è di 22 px dentro un riquadro tutto toccabile | `conta1.png` |
| Francese | 8 pagine e i loro aiuti tradotti con coerenza («Saisir une dépense», «À vérifier», «Brouillon»). Utente riportato in italiano | `fr.mjs`, `fr_*.png`, `it.mjs` |
| Velocità (visite successive) | Pagina leggibile (DOMContentLoaded) in 0,50–0,70 s su 8 pagine; tutto caricato in 1,6–1,8 s. Navigazione dal menu in basso: 60–70 ms. Salvataggi: bozza 1,7 s, spesa con foto 7,7 s | `speed.mjs` |

| Area | Giro prec. | Voto | Motivo |
|---|---|---|---|
| Facilità complessiva | 9 | **9** | Dashboard chiara; due P3 (S3, S5) |
| Registrare una spesa | 9 | **9,5** | Nessun difetto nuovo. Ricerca, suggerimento, foto, tasso e conferma funzionano senza esitazioni. Non 10: 7,7 s per salvare con la foto (impressione) |
| Capire gli stati | 9 | **9** | Un P3 (S1) |
| Errori e recupero | 9 | **9** | Un P3 (S6) |
| Aiuto in pagina e Guida | 9 | **9** | Gli aiuti sono brevi (35–112 parole) e coerenti con la pagina e il ruolo. Due P3: R6 aperto in parte, S2 |
| Francese | 9 | **9** | Un P3 (S4) |
| Velocità percepita | 9 | **9** | Valori buoni. I PDF e l'uso senza rete non sono verificati |
| **Complessivo** | **8** | **8,5** | Nessun P0, P1 o P2. In tutto restano 7 P3: più dei 2 che la scala concede per il 9 |

Nessuna area è scesa rispetto al giro precedente.

## C. Difetti nuovi

| Id | Gravità | Area | Dove | Descrizione | Prova | Correzione |
|---|---|---|---|---|---|---|
| S1 | P3 | Stati | /movimenti · IT e FR | La riga di riepilogo dice «1 in attesa di verifica» («1 en vérification»), mentre etichette, filtro e Dashboard dicono «Da verificare» («À vérifier»). È lo stesso caso di R3, rimasto in un'altra pagina | `o_mov__1.png`, `fr_mov.txt` riga 10 | «1 da verificare» / «1 à vérifier» |
| S2 | P3 | Guida | /guida, «Registrare una spesa o un'entrata» | Frase sgrammaticata: «Con «Anticipo» toccalo per sceglierlo il tuo anticipo e accanto leggi…» | `guida_op.txt` riga 75 | «Con «Anticipo» tocca il tuo anticipo per sceglierlo: accanto leggi…» |
| S3 | P3 | Facilità | /rimborsi · 375 | Didascalie doppie con barra vuota: «nessuna spesa da rimborsare» e sotto «nessuna spesa da rimborsarti»; «nessun rimborso» e sotto «nessun rimborso quest'anno» | `o_rimb__1.png`, `o_rimb2__1.png` | Senza dati, una sola riga e nessuna traccia di barra |
| S4 | P3 | Francese | /nuovo, scheda, elenco · FR | Il progetto «Spese generali» non è tradotto nell'app: compare nel menu, nel suggerimento «choisissez « Spese generali »» e in «Projet: Spese generali». Il PDF invece scrive «Frais généraux» | `fr_nuovo.txt` righe 112 e 122, `fr_scheda` | Mostrare «Frais généraux» in francese, come nel PDF |
| S5 | P3 | Facilità | /movimenti › Filtri · 375 | Il pulsante dice «Mostra 1 movimenti» (plurale sbagliato). In «Conto o cassa» compare «Anticipi – Fanomezantsoa Rakotondrabe», cioè l'anticipo di un'altra persona | `filtri.mjs`, output | «Mostra 1 movimento»; all'operatore mostrare solo il proprio anticipo |
| S6 | P3 | Errori | scheda, «Segnala al responsabile» con il campo vuoto | Compare solo il fumetto nativo del browser («Please fill out this field», nella lingua del browser), non un messaggio nello stile dell'app | `segn.mjs` (validationMessage) | Pulsante disattivato finché il campo è vuoto, oppure «Scrivi cosa è sbagliato» sotto il campo, come nel modulo |

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

Tutte le aree sono già ad almeno 9. Per il 9 complessivo (al massimo due P3):

1. **R6 e S2, Guida.** Nel capitolo «Registrare» sostituire «Premi «+ Nuovo movimento»» con «Tocca «Registra una spesa» (o il «+» in basso)» e «il conto da cui escono…» con «in «Come è stata pagata» scegli Soldi di YouSud, Di tasca propria o Anticipo». Correggere anche la frase sull'anticipo. Togliere «oppure «+ Nuovo movimento»» dalle domande frequenti.
2. **S1.** Usare «da verificare» / «à vérifier» anche nel riepilogo di /movimenti.
3. **S4.** Tradurre «Spese generali» in francese in tutta l'app.
4. **S5.** Sistemare il plurale nel pulsante dei filtri e limitare «Conto o cassa» all'anticipo dell'operatore.
5. **S6.** Mostrare il messaggio di campo vuoto nello stile dell'app.
6. **S3.** Una sola didascalia negli stati vuoti di /rimborsi.
7. **Da verificare al prossimo giro:** N-2, tra le 00:00 e le 03:00 di Antananarivo, e l'anteprima della foto su un archivio reale.
