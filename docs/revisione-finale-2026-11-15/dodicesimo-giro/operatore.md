# YouCount, revisione dell'operatore (dodicesimo giro, 21/11/2026)

Prove svolte a 375 px come `operatore`. Ho usato `responsabile` solo per autorizzare e consegnare un anticipo di 150.000 MGA. Schermate e script sono in `/tmp/yc-final/work`.
Nota: il server si è riavviato da solo due volte (alle 07:59 e alle 08:11, vedi watchdog) e ogni riavvio ha cancellato i dati di prova. Per questo alcuni passaggi sono stati rifatti.

## A. Riverifica dei difetti precedenti

| Difetto | Stato | Prova |
|---|---|---|
| N-1 Due date diverse per le ricevute | CHIUSO | La Dashboard non mostra più la data. /anticipi dice «ricevute entro il 06/12/2026» (`n1__anticipi.txt`). Ne nasce però O5 |
| N-2 Data «di oggi» in UTC | CHIUSO in parte | Con l'orologio del telefono alle 01:30 del 22/11 (ora del Madagascar), /nuovo e /conti propongono il 22/11 (`tz.mjs`). Per la richiesta di anticipo e per Scadenze la data viene dal server: non verificato, perché ora UTC e Madagascar hanno lo stesso giorno |
| N-3 Anticipo autorizzato assente da «Da fare» | CHIUSO | Compare «Anticipo autorizzato: ritira 150.000 MGA» (`n3__.txt`) |
| N-4 Autocertificazione su bozze e movimenti altrui | CHIUSO | Nella bozza: «Nessun dato.». In DEMO-2026-1010 non c'è il modulo (`tutti.mjs`) |
| N-5 Aiuto di Scadenze da amministratore, con «…» | CHIUSO | 52 parole, adatte all'operatore. Ho visto «…» una sola volta, durante un riavvio del server, e non si è ripetuto |
| N-6 PDF in francese | APERTO (P3) | «Lieu et date :» ora è corretto. Ma il PDF dice ancora «relative au projet « Spese generali »» (`autocert_fr.pdf`) |
| N-7 Casella di conferma troppo piccola | CHIUSO | La casella è di 22 px, dentro un'etichetta toccabile di 313×101 px (`conta2.mjs`) |
| N-8 «tissu» senza risultati | CHIUSO, ma vedi O6 | Ora trova 405 «Piccole attrezzature e arredi» |
| N-9 «2 richiesta» | CHIUSO | Ora dice «2 richieste in corso» |
| N9-1 «Tutti» mostra l'ente intero ed è lento | APERTO, attenuato (P3) | 510 movimenti, compreso lo stipendio «RAF · nov». Si caricano in 3,5–6,6 s |
| N9-2 Avviso di doppione tagliato | CHIUSO | Ora intero: «già allegato a MOV-2026-006 del 21/11: è la stessa spesa?» (`dup1.png`) |
| N9-3 Data futura | CHIUSO | «Per registrare mancano: data del documento (nel futuro)» |
| N9-4 Storico delle conte che deborda | CHIUSO | Le tre colonne sono visibili. La tabella sporge di 8 px oltre il margine interno (`conta_hist2.png`) |
| N9-5 Francese: «de sa poche» | APERTO (P3) | La Dashboard dice «À vous rembourser … payées de sa poche»: mescola «vous» e «sa» (`fr__.txt`) |
| N9-6 Finanziamento proposto senza regola chiara | Non riprodotto | Nel modulo dell'operatore il campo non compare più |
| N9-7 «…» nell'aiuto | come N-5 | |
| N9-8 Titolo «Operatore Prova» negli anticipi aperti | Non riprodotto | |

## B. Compiti fissi e voti

**Dashboard.** È chiara. Il pulsante grande «Registra una spesa» è in cima. Le quattro schede usano le parole degli stati. «Da fare» mostra ogni passo del ciclo dell'anticipo (in attesa, autorizzato, contanti in mano), le bozze, le autocertificazioni e gli errori segnalati.

**Spesa dall'anticipo, con foto** (`spesa2.mjs`): 13 s di script, MOV-2026-007.
- La foto apre «Ritaglia».
- Scegliendo «Anticipo» il progetto si compila dall'anticipo (École Antanetibe). Compare «Hai in mano 150.000 · dopo 25.000».
- La conferma è corretta e «Registrane un altro» funziona.

**Progetto non più precompilato.** Con «Registrane un altro» il progetto resta «Scegli…»: verificato.

**Descrizione che propone i codici.** Il codice giusto compare per primo:
- «riso», «pane», «sacco di riso 25 kg» → 307;
- «taxi» → 202.

Il campo di ricerca funziona: riso → 307, taxi → 202, pane → 307. Con una parola che non esiste («xyzzy») compare un messaggio chiaro: «Nessun codice per «xyzzy». Prova…».

Problemi della descrizione, vedi O1, O3 e O4.

**Stati.** Bozza, Da verificare, Verificato e Da rimborsare usano le stesse parole in Dashboard, elenco, scheda, filtro Stato e aiuto (`st__.txt`, `help.mjs`).

**Errori e recupero.**
- Registrando a vuoto, ogni campo mostra «Campo obbligatorio».
- Una bozza con il solo importo si salva in 1,4 s, con le istruzioni.
- La segnalazione d'errore compare nella scheda, in «Da fare» e in Scadenze.
- La conta con una differenza di 20,6 milioni di MGA blocca il pulsante finché non si spunta la conferma e si scrive la nota.
- Difetto: O2.

**Francese.** Le schermate sono complete e i suggerimenti funzionano anche in francese («taxi-brousse» → 202). Ricadono qui N-6 e N9-5.

**Velocità.** Una pagina intera si apre in 2–5 s. /guida impiega 14 s la prima volta, poi 2,2 s. Toccando il menu in basso si cambia pagina in 0,2 s (`speed.mjs`).

| Area | Voto prec. | Voto | Difetti conteggiati | Motivo dell'eventuale calo |
|---|---|---|---|---|
| Facilità complessiva | 8 | **9** | N9-1 (P3) | |
| Registrare una spesa | 8 | **7** | O1, O3 (P2); O4, O6, O8 (P3) | O3 è un peggioramento reale: viene dalla funzione nuova. O1 probabilmente c'era già ma non era stato visto: nei giri precedenti l'operatore non aveva contanti in mano dopo una spesa |
| Capire gli stati | 9 | **9** | nessuno | |
| Errori e recupero | 9 | **8** | O2 (P2) | Non so dire se è nuovo: non era stato provato il percorso «di tasca propria» senza scontrino |
| Aiuto in pagina e Guida | 9 | **9** | O5, O7 (P3) | |
| Francese | 9 | **9** | N-6, N9-5 (P3) | |
| Velocità percepita | 8 | **8** | Pagine intere da 2 a 5 s sulla copia di sviluppo; con un telefono vero e senza rete: non verificato | |
| **Complessivo** | **8** | **8** | | |

## C. Difetti nuovi

| Id | Gravità | Area | Dove | Descrizione | Prova | Correzione proposta |
|---|---|---|---|---|---|---|
| O1 | **P2** | Registrare | /nuovo · 375 | L'operatore ha 19.000 MGA dell'anticipo in mano, eppure il modulo nuovo propone «Soldi di YouSud · Cassa Madagascar». Se conferma, una spesa fatta con i contanti dell'anticipo riduce la cassa una seconda volta. La Dashboard intanto dice «Registra ogni spesa con «Anticipo»» | `again.mjs`: start = «Cassa Madagascar», con «Hai in mano 19.000» | Se l'operatore ha un anticipo aperto con contanti in mano, preselezionare «Anticipo», il suo anticipo e il progetto dell'anticipo. Altrimenti lasciare «Soldi di YouSud» |
| O2 | **P2** | Errori | /nuovo, «Salva da rimborsare» | Con «Il giustificativo non c'è» e la casella «prepara l'autocertificazione» spuntata, la spesa di tasca propria si salva senza il modulo: la scheda dice solo «Senza giustificativo: …». La Dashboard conta 1 autocertificazione su 2, e la Guida promette il modulo. Con «Registra» invece il modulo compare (`?aut=1`) | `tasca1.png`, `nogiu.mjs`, `st__.txt` | Dopo «Salva da rimborsare» aprire la scheda con `aut=1` e il modulo già compilato, e contare la spesa in «Autocertificazioni da preparare» |
| O3 | **P2** | Registrare (funzione nuova) | /nuovo · IT e FR | I suggerimenti tratti dalla descrizione sono rumorosi e lontani dal campo. (1) Le parole vuote suggeriscono codici: «Pane **per** merenda» → 101 e 102 Retribuzioni; «Riso e **olio** per la mensa» → 204 Carburante; in francese «**pour** la cantine» → 303 e 305. (2) Il codice suggerito si ripete tra i pulsanti dei più usati (307 compare due volte). (3) La riga «Dalla descrizione» sta circa 810 px sotto il campo, cioè una schermata intera più in basso, e la tastiera la copre: chi scrive non la vede | `nogiu.mjs`, `spesa.mjs`, `fr2.mjs`, `pos2.mjs` (desc 649, suggerimento 1460) | Ignorare le parole vuote (per, di, e, la, il, pour, et, de, la, les, pour) e le parole sotto i 4 caratteri. Mostrare al massimo 2 codici e solo con buona corrispondenza. Metterli subito sotto la descrizione («Codice proposto: 307 Alimentazione [Usa]»). Togliere il doppione dai pulsanti dei più usati |
| O4 | P3 | Registrare | /nuovo | Si sceglie «Anticipo» (il progetto diventa École Antanetibe), poi si torna a «Soldi di YouSud» o «Di tasca propria»: il progetto dell'anticipo resta, senza avviso | `again.mjs` | Se il progetto è venuto dall'anticipo, riportarlo a «Scegli…» quando si cambia modo di pagamento. Oppure scrivere sotto il campo «dal tuo anticipo» |
| O5 | P3 | Aiuto | Aiuto della Dashboard | L'aiuto dice: «Contanti in mano: quanto ti resta dell'anticipo e la data entro cui portare le ricevute». Ma la scheda mostra solo «contanti dell'anticipo», senza data | `help.mjs`, `st__.txt` | Rimettere nella scheda «ricevute entro il 06/12», presa dalla stessa fonte di /anticipi |
| O6 | P3 | Registrare | Ricerca dei codici | «tissu» e «tessuti» portano a 405 «Piccole attrezzature e arredi». Eppure è proprio l'esempio del modulo di richiesta («tessuti, filo e aghi per il laboratorio»), che andrebbe in 401 Materiali di consumo o 404 Materie prime | `search.mjs` | Collegare tessuti, filo e aghi (tissu, fil, aiguilles) a 401 e 404 |
| O7 | P3 | Guida | /guida | La Guida dice «per esempio «venditore di strada senza ricevuta»», ma il pulsante si chiama «Venditore senza ricevuta». Dice anche «Tocca «+ Nuovo movimento»», ma in Dashboard il pulsante dell'operatore si chiama «Registra una spesa» | `guida.mjs` | Usare le parole esatte dei pulsanti |
| O8 | P3 | Registrare | /nuovo | Durante il salvataggio della bozza, la scritta «Salvataggio…» compare sul pulsante «Registra» e non su «Salva bozza» | `bozza.mjs` | Mettere la rotellina sul pulsante premuto |

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

| N. | Intervento | Area che sale |
|---|---|---|
| 1 | O1: «Anticipo» preselezionato quando l'operatore ha contanti in mano | Registrare |
| 2 | O3: niente parole vuote, al massimo 2 suggerimenti subito sotto la descrizione, nessun doppione | Registrare |
| 3 | O2: autocertificazione anche per le spese di tasca propria senza scontrino | Errori, da 8 a 9 |
| 4 | O4, O6 e O8, così in Registrare restano al massimo due P3 | Registrare, da 7 a 9 |
| 5 | Pagine intere sotto i 2 s sul telefono: dati in cache e «Tutti» paginato (N9-1). Da verificare sulla versione pubblicata | Velocità, da 8 a 9 |
| 6 | O5, O7, N-6 e N9-5 (data nella scheda, parole dei pulsanti, «Frais généraux», «de votre poche») | Rifinitura verso il 10 |
