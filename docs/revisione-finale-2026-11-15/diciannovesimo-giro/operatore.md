# YouCount · Esperienza dell'operatore · giro 19 (22/11/2026)

Operatore a 375, 768 e 1440 px, IT e FR (riportato poi in IT; admin_fr per i termini). Script e schermate in `/tmp/yc-final/work/op`.
Nota: il server si è riavviato più volte (06:54, 07:02, 07:13 e durante audit 375). A ogni riavvio i dati di prova spariscono, quindi alcuni flussi li ho rifatti da capo.

## 1. Riverifica dei difetti aperti al giro 18

| Id | Esito | Prova |
|---|---|---|
| V1 codice vuoto nella conferma | **CHIUSO** (non riprodotto, 4 su 4) | `s2.log`: «Codice contabile 307» nella conferma di MOV‑006/007/008; anche `s3.log` (MOV‑009) |
| V2 l'operatore emette ricevute ufficiali | **CHIUSO** | `s11.log`, `s11_RIC_end.png`: la Ricevuta resta in bozza e la scheda dice «questo documento lo emette un responsabile o un amministratore», senza il pulsante Emetti. La Quietanza si emette, con conferma: QUI‑2026‑001 (`s12.log`). L'autocertificazione AUT‑2026‑001 si genera dalla spesa (`s4.log`) |
| V3 Conti dell'operatore: 3 schede su griglia da 4 | **CHIUSO** | `conti1440__1`, `conti768__1`, `conti375__1`: 2 schede su 2 colonne, tabella a tutta larghezza |
| V4 BNI nel filtro «Conto o cassa» | **CHIUSO** | `s13.log`: ci sono solo Cassa Madagascar e Mvola |
| V5 Guida «Come si fa» sul telefono | **CHIUSO** | `guida_full.txt` r. 90: «sul telefono il pulsante ⓘ» |
| N‑2 residuo (data UTC) | **Lato telefono CHIUSO; lato server non verificabile** | `tz.mjs`: con l'orologio del browser alle 01:30 del 25/11 in Madagascar, /nuovo e la conta propongono 25/11. «Quando servono» in /anticipi propone invece 22/11, cioè la data del server. Questa copia gira alle 07–08 di Madagascar: non posso provare la fascia 00–03 lato server |

Chiusi anche: N‑3 (anticipo da ritirare in Da fare), O1 (modulo parte da «Anticipo»), N‑6 (PDF FR), O6, R5, S6, U2, U4, Q3 (2 su 2, `q3.mjs`), N‑7.

## 2. Compiti svolti (375 px)

| Compito | Esito |
|---|---|
| Uscita con foto, in contanti MGA | Ritaglio, «Usa», «riso» → 307, Registra: «Movimento registrato: MOV‑2026‑006. Ora lo controlla un responsabile.» (`s2_post.png`), in 4–8 s |
| Ricerca codice | riso → 307, taxi → 202, pane → 307, tissu → 401. «zzqwx» dà un messaggio chiaro (`nores.png`) |
| Senza giustificativo | Motivo rapido e casella spuntata. La pagina scende al modulo dell'autocertificazione (`s3_A.png`), PDF bilingue corretto |
| Di tasca propria | «Salva da rimborsare» porta a «Spesa salvata: la rimborserà un responsabile» (`s3_B.png`). In Dashboard compare in «Da rimborsare a te» |
| Anticipo | Richiesta, autorizzazione e consegna (fatte da super_admin), poi Dashboard «Hai in mano 50.000 MGA · entro il 09/12/2026». La spesa con l'anticipo lo fa scendere a 20.000. Le date coincidono tra Dashboard e /anticipi (`s8.log`, `s8_ant2.png`) |
| Errori | Il modulo vuoto si ferma in cima e indica i campi; la bozza con il solo importo si salva; la segnalazione va in Da fare e in Scadenze (`s15.log`). Conta con differenza grande: chiede conferma e motivo (`s16.log`) |
| Documenti | Quietanza emessa da solo; Ricevuta, Notula e Dichiarazione restano in bozza (vedi W5) |
| Dati altrui | «Tutti» mostra 362 movimenti, solo dei progetti assegnati; nessun conto bancario. Restano visibili l'anticipo di un collega (W3) e il saldo comune della cassa (spiegato in pagina) |
| Velocità (visite successive) | Pagine pronte in 1,5–2,5 s (DOM in 0,4–0,6 s); «Tutti» in 2,4 s (`speed.mjs`) |

## 3. Prova di allineamento (audit.mjs, operatore)

- **1440** (`audit_1440.txt`): segnala solo il calendario di Scadenze, che non conta.
- **375** (`audit_375.txt`, rilanciato dopo il riavvio): «Le mie richieste» vuota (59 px) e i filtri di Documenti emessi (60 px). Guardandole (`a375__1`, `de375__1`), sono stati vuoti corretti, non difetti.
- **Guardato a occhio**: lo script non vede la Dashboard a 1440 (W1) né i titoli sfalsati in Conti FR (W2).

## 4. Difetti nuovi

| Id | Gr. | Area | Pagina · larghezza | Descrizione | Correzione suggerita |
|---|---|---|---|---|---|
| W1 | **P2** | Facilità | Dashboard · 1440 | La colonna sinistra («Le mie ultime spese») finisce molto prima di quella destra («Da fare» + «Note»): circa 360 px vuoti senza spese, 162 px con 3 spese. audit.mjs non lo segnala (`d1440__1.png`, `s14_dash1440.png`) | «Note» a tutta larghezza sotto le due schede, oppure in colonna sinistra sotto le spese; colonne con fondo comune |
| W2 | **P2** | Francese | /conti · 375 FR | «Espèces dans les caisses» va su due righe, così «‑3 828 €» sta circa 20 px più in basso di «0 €» nella scheda accanto (`fr__conti.png`). In IT è allineato | Riga del titolo di altezza fissa (2 righe), oppure «Espèces en caisse» |
| W3 | P3 | Registrare | /nuovo · «Anticipo di» | L'operatore può scegliere l'anticipo di Fanomezantsoa e legge «ha in mano: 1.162.500 MGA». L'aiuto della pagina dice invece «L'operatore vede… solo il proprio anticipo» (`s17.log`) | Decidere una regola sola: togliere gli anticipi altrui all'operatore, oppure correggere l'aiuto |
| W4 | P3 | Aiuto | Pannello /nuovo › «Tutti i dettagli» | Dice «per salvarla bastano importo e conto», mentre il riassunto e la Guida dicono «basta l'importo» (confermato da `s15.log`). Dice anche «Premi «+ Nuovo movimento»» (`help_op.log`) | Allineare il testo e togliere le frasi da amministratore |
| W5 | P3 | Aiuto | /documenti-emessi/nuovo e bozza · 375 | Mentre si sceglie il tipo, nulla dice che Ricevuta, Notula ecc. le emette un responsabile: lo si scopre solo dopo aver compilato. Il pannello d'aiuto di questa pagina non ha il riassunto per l'operatore e parte con «Emetti…» (`dnhelp__1.png`). Dopo il salvataggio la banda dice «controlla l'anteprima, poi emetti», mentre sotto si legge che la emette un responsabile (`s11_RIC.png`) | Pastiglia «la emette un responsabile» sulle schede dei tipi non suoi; banda «Bozza salvata: la emette un responsabile»; riassunto per l'operatore anche qui |
| W6 | P3 | Stati | /movimenti · 1440 | Appena si genera il PDF dell'autocertificazione, non ancora firmata, la colonna Giustificativo passa da «Senza documento, motivo dichiarato» a «Con documento» (`s18.mjs`) | «Autocertificazione da firmare» finché la firma non è registrata |
| W7 | P3 | Facilità | /nuovo, filtri contro /conti | L'operatore registra e filtra su «Mvola (mobile money)», ma in Conti vede solo la Cassa, e l'aiuto dice «Vedi le casse in contanti» (`dom.mjs`, `conti375__1`) | Mostrargli Mvola in Conti, oppure toglierlo dal modulo |
| W8 | P3 | Facilità | /conti · tutte, IT e FR | Nella scheda «Contanti nelle casse ‑3.828 €» manca sotto l'ariary (‑20.441.300 MGA). L'aiuto della pagina e la regola «euro grande, ariary piccolo» lo prevedono | Riga piccola con l'importo in MGA |
| W9 | P3 | Francese | /nuovo, /, /rimborsi | Tre nomi per la stessa cosa: «Payée personnellement» (modulo), «payées de votre poche» (Dashboard), «Dépense payée de ma poche» (pulsante di Rimborsi) (`fr.txt` r. 22, 80, 275) | Un solo termine, per esempio «Payée de ma poche» nel modulo |

## 5. Voti

| Area | Giro 18 | Giro 19 | Motivo |
|---|---|---|---|
| Facilità complessiva | 7 | **8** | V2 e V3 chiusi; restano W1 (P2), W7 e W8 (P3) |
| Registrare una spesa | 9 | **9** | Flussi completi e senza esitazioni; V1 non riprodotto; resta W3 |
| Capire gli stati | 9,5 | **9** | Nuovo W6. Non è un peggioramento dell'app: la regola c'era già, ma nessuno aveva provato a generare il PDF prima della firma |
| Errori e recupero | 9,5 | **9,5** | Nessun difetto trovato |
| Aiuto in pagina e Guida | 9 | **9** | V5 chiuso; Guida adattata al ruolo; restano W4 e W5 |
| Francese | 9,5 | **8** | W2 (P2: disallineamento visibile, che il BRIEF conta almeno P2) e W9. W2 è una pagina che prima non era in questa forma (V3 l'ha ridisegnata): è un difetto nuovo nato dalla correzione |
| Velocità percepita | 9 | **9** | 1,5–2,5 s per pagina; registrazione 4–8 s (copia di sviluppo). Rete lenta e telefono vero: non verificati |
| **Complessivo** | **8** | **8,5** | Nessun P0 o P1; 2 P2 (W1, W2) e 7 P3 |

## 6. Ordine di intervento

1. W1: impaginazione della Dashboard a 1440.
2. W2: titoli delle schede di Conti in francese.
3. W5 e W3: chiarire subito cosa emette l'operatore e quali anticipi può usare.
4. W6: stato «da firmare».
5. W4 e W9: testi.
6. W7 e W8: Mvola e importo in ariary in Conti.
7. N‑2: verificare la data lato server tra le 00 e le 03 di Madagascar.
