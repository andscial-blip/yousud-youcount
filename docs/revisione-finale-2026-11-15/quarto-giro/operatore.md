# YouCount: l'esperienza dell'operatore (revisione indipendente, 16/11/2026)

operatore@test.local, 375 px, IT e FR; copia di sviluppo condivisa, più lenta della produzione. Prove in `/tmp/yc-final/work/op/`.
Il database è stato ripristinato due volte durante le prove (registro attività): ho ripetuto le prove interessate. Non è un difetto dell'app.

## 1. Percorsi provati

| # | Percorso | Tocchi | Tempo percepito | Esito (prova) |
|---|---|---|---|---|
| 1 | Prima apertura, «Da fare» | 0 | ~1 s a caldo | «Tutto in ordine», poi «1 spesa da rimborsare», «Autocertificazioni da firmare: 1» (sp10_dash_dafare.png). |
| 2a | Spesa MGA in contanti con foto | 11–12 | 60–90 s | Salvata; scansione nitida (sp1_step2.png); AI non ha compilato nulla (simulata) |
| 2b | Senza giustificativo, con motivo | 9 + autocertificazione 4 | ~60 s | 4 scorciatoie per il motivo; autocertificazione proposta subito (sp3_after_full.png) |
| 3 | Pagata di tasca propria | 10 | ~60 s | Compare in «Da rimborsare» (sp5_rimborsi.png); conferma «Bozza salvata: .» |
| 4 | Spesa da un anticipo | 8 da «+ Ricevuta» | ~50 s | /anticipi: «Contanti che ho in mano 200.000 → 135.000 MGA» (s16, s17). Dashboard: nulla |
| 5 | Correggere bozza / registrato | 3 per la bozza | Modifica 17,7 s (a freddo) | Bozza modificabile; sul registrato frase chiara «…chiedi a un responsabile…» (sp12_reg.png) |
| 6 | Ritrovare un proprio movimento | 3 (cerca) | 2–4 s | Ricerca e stato chiari; nessun filtro «I miei» tra 1.012 movimenti dell'ente (s22) |
| 7 | Autocertificazione | 4 | ~5 s | PDF allegato, «Da firmare»; nessun passo successivo (sp4_crop.png) |
| 8 | Aiuto | 1 | 1,6 s | «i» completa ma fitta; la Guida dice «usa Storna» anche all'operatore (s23) |
| 9 | Errori | – | – | Vedi §3 |
| 10 | Senza rete | – | – | «Salvato sul telefono…», inviato al ritorno della rete (s30) |

## 2. Velocità (Playwright, 375 px)

| Pagina | Primo contenuto a caldo | networkidle a caldo | A freddo | Rete lenta simulata (400 ms RTT, 400 kbit/s): contenuto / idle |
|---|---|---|---|---|
| Dashboard | 1,0 s | 2,6 s | 3,2 s login→dashboard | 7,4 s / 66 s |
| Nuovo movimento | 1,0–2,0 s | 3,1 s | 4–19 s | 12,0 s / 62 s |
| Movimenti | 1,0 s | 3,9 s | 3,6 s | 6,7 s / 57 s |
| Anticipi, Rimborsi, Guida | 1,3–1,9 s | 3,2–4,1 s | 5–23 s | – |
| Registra → conferma | 3,0–3,7 s | – | Bozza 9,2 s | – |

Fonti: s2, s28, s29.

## 3. Valutazione per area

### Facilità per l'operatore: 7
Funziona: il «+» centrale, «Da fare», il conto e il progetto proposti dall'ultimo movimento, «+ Ricevuta» dagli anticipi.
Non funziona: la Dashboard mostra entrate, avanzo, gruppi di spesa e la cassa Madagascar a −20.441.300 MGA, tutte cifre dell'ente che l'operatore non deve gestire (dash_full.png). Il menu Altro presenta «Impostazioni: Account, utenti, categorie e dati». Nel modulo compaiono Entrata, Giroconto, Banca Italia, Quietanza/Notula.
Per arrivare a 9:
1. Una Dashboard per l'operatore: «Contanti in mano», «Le mie ultime 5 spese» con lo stato, «Da fare». Le cifre dell'ente vanno nascoste o messe in fondo.
2. Per l'operatore: solo «Uscita» preselezionata, con Entrata e Giroconto dietro «Altro tipo». Elenco conti limitato a casse MG e Mvola.
3. In Altro: «Il mio account» al posto di «Impostazioni».

### Registrazione di una spesa (telefono): 7,5
Funziona: scansione con ritaglio e pulizia, «Importo letto: 87.500 MGA · Controvalore 16,39 €», tasso inserito da solo, avviso di cassa sotto zero che non blocca, conferma con numero MOV e «Registrane un altro».
Non funziona: la foto richiede 3 tocchi (Scatta → Avanti → Usa la scansione). Il codice va cercato con parole del piano dei conti: «igiene» → «0 codici trovati» (s21). Con «Anticipo» bisogna scegliere tra gli anticipi di altre persone e il proprio non è preselezionato (s15).
Per arrivare a 9:
1. Un solo passo dopo lo scatto: «Usa» con bordi automatici; «Ritaglia» resta facoltativo.
2. Parole chiave per i codici (riso, sapone, taxi, carburante) e 6 «codici frequenti» in pulsanti sopra l'elenco.
3. Se l'operatore ha un anticipo aperto: «Anticipo» preselezionato con «Hai in mano 135.000 MGA» accanto.

### Chiarezza di stati e prossimi passi: 7,5
Funziona: le etichette Bozza / Da verificare / Verificato, «In attesa di verifica 1 · tuoi movimenti», la frase sulle correzioni, «ricevute entro il 03/12/2026».
Non funziona: «Bozza salvata: .» (numero vuoto) sulle spese di tasca propria e sulle bozze (s21). Una spesa di tasca propria resta «Bozza» e l'operatore non capisce se ha finito. Dopo «Da firmare» manca il passo successivo. I contanti in mano e la scadenza delle ricevute non compaiono in «Da fare».
Per arrivare a 9:
1. Testo: «Spesa salvata: la rimborserà un responsabile» al posto di «Bozza salvata: .». Etichetta «In attesa di rimborso» al posto di «Bozza».
2. Sotto «Da firmare»: «Stampa il PDF, firmalo e consegnalo al responsabile. La firma la registra lui». Oppure un pulsante «Firma sul telefono».
3. In «Da fare»: «Hai in mano 135.000 MGA, ricevute entro il 03/12».

### Errori e recupero: 7
Funziona: errori in linea, riepilogo accanto al pulsante («Per registrare mancano: …»), cursore sul primo campo, importi tolleranti («1 250 000», «1.250.000», decimali in ariary arrotondati e dichiarati).
Non funziona: per una data futura, solo dopo l'invio compare «Salvataggio non riuscito: invalid: data operazione troppo nel futuro», con termine tecnico e lontano dal campo (s6). Una data di 10 mesi prima (10/01/2026) viene registrata senza avviso (s31). Se il motivo è vuoto, il riepilogo dice «giustificativo» invece di «motivo».
Per arrivare a 9:
1. Controllo immediato sotto la data: «La data è nel futuro» (blocca) e «È di più di 30 giorni fa: confermi?» (avviso).
2. Rimuovere «invalid:» da tutti i messaggi che vengono dal server.
3. Nel riepilogo: «motivo del giustificativo mancante».

### Aiuto e guida per l'operatore: 7
Funziona: «i» in IT e FR; Guida «Come faccio a…» con «Portami lì →».
Non funziona: i testi sono lunghi, a blocchi di 5–6 frasi. La Guida non tiene conto del ruolo: «Bozze e movimenti non ancora verificati si modificano… usa Storna» contraddice ciò che vede l'operatore. Non spiega come si firma l'autocertificazione.
Per arrivare a 9:
1. Una Guida per l'operatore con 6 voci (spesa, senza scontrino, di tasca mia, anticipo, errore, senza rete) e frasi corte.
2. Nella «i»: 3 punti brevi in alto e il resto dietro «Altro».
3. Nella voce «Correggere un errore», per l'operatore: «Scrivi al responsabile il numero MOV».

### Francese per l'operatore: 8
Funziona: interfaccia, errori, aiuto e guida tradotti in modo naturale («De sa poche», «Pour comptabiliser il manque…»), cifre con spazio («32 000 MGA»).
Non funziona: «Texte repris du Gestionale» (fr_mov.png). Il motivo rapido resta in italiano nel dato («Sans justificatif: Mancia o piccola spesa»). Nel campo importo il separatore è il punto («1.250.000»), nel resto dell'app lo spazio (s27).
Per arrivare a 9: «Gestionale» → «logiciel»; motivi salvati come codici e mostrati nella lingua di chi legge; spazio come separatore nel campo importo in FR.

### Velocità percepita: 6,5
Funziona: a caldo 1–2 s; senza rete il salvataggio va sul telefono.
Non funziona: con rete lenta 7–12 s al primo contenuto e ~60 s di attività; «Registra» 3–4 s; prime aperture 8–23 s (copia di sviluppo).
Per arrivare a 9:
1. Registro dell'operatore limitato ai suoi movimenti e paginato (oggi ne carica 1.012).
2. Alleggerire la Dashboard dell'operatore (niente grafici dell'ente).
3. Conferma immediata dopo «Registra», invio in background (come già senza rete).

### Esperienza operatore complessiva: 7

## 4. Voti

| Area | Voto |
|---|---|
| Facilità per l'operatore | 7 |
| Registrazione di una spesa (telefono) | 7,5 |
| Chiarezza di stati e prossimi passi | 7,5 |
| Errori e recupero | 7 |
| Aiuto e guida per l'operatore | 7 |
| Francese per l'operatore | 8 |
| Velocità percepita | 6,5 |
| **Complessiva** | **7** |

## 5. Difetti

| Gravità | Difetto | Pagina | Larghezza | Prova |
|---|---|---|---|---|
| P1 | Registro e Dashboard di tutto l'ente, senza filtro «I miei» | /, /movimenti | 375 | dash_full.png, s22 |
| P1 | «Anticipo»: il proprio non è preselezionato, compaiono quelli altrui | /nuovo | 375 | s15 |
| P2 | «Bozza salvata: .» con numero vuoto | /movimenti/[id] | 375 | sp5_after_full.png, s21 |
| P2 | Autocertificazione «Da firmare» senza il passo successivo | /movimenti/[id] | 375 | sp4_crop.png |
| P2 | Data futura: errore «invalid:» solo dopo l'invio; data di 10 mesi prima senza avviso | /nuovo | 375 | s6, s31 |
| P2 | La Guida dice all'operatore di modificare e stornare | /guida | 375 | s23 |
| P2 | Ricerca dei codici solo per nome tecnico | /nuovo | 375 | s21 |
| P2 | Contanti in mano assenti da Dashboard e «Da fare» | / | 375 | s15, s19 |
| P2 | Richiesta di anticipo: «Chi riceve i contanti» propone un'altra persona | /anticipi | 375 | s9 |
| P3 | Anteprima di un JPG: «Anteprima non disponibile: usa «Apri»» | /movimenti/[id] | 375 | sp5_after_full.png |
| P3 | «Testo ripreso dal Gestionale» (IT e FR) | /movimenti/[id] | 375 | fr_mov.png |

Non verificato: lettura AI, fotocamera reale, PWA. Lingua riportata all'italiano (s27).
