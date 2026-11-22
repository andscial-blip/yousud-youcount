# YouCount — 18° giro · Esperienza dell'operatore

Ruolo operatore, soprattutto a 375 e 768 px, in IT e in FR (pulsante «FR», poi riportato in IT). Prove in `/tmp/yc-final/work/op`.
Nota: il server si è riavviato più volte (03:58, 04:07, 04:20, 04:33, 04:45, 04:53) e a ogni riavvio i dati tornano quelli di partenza. Per questo ho rifatto i percorsi più lunghi in un solo script (`s6.mjs`, `s7.mjs`).

## Percorsi svolti (verificati)
| Compito | Esito | Prova |
|---|---|---|
| Spesa in contanti da 45.000 MGA con foto; codice cercato con riso, taxi, pane e «zzzqx» | Registrata come MOV‑2026‑006 in 9 s; «zzzqx» mostra un messaggio chiaro | `s1.log`, `s1_scheda.png` |
| Spesa senza giustificativo | Il motivo è obbligatorio; dopo «Registra» la pagina scende al modulo (`aut=1`) e il PDF si genera | `s2b.log`, `s2b_scheda.png`, `s2b_pdf.png` |
| Spesa di tasca propria | «Salva da rimborsare»; /rimborsi e Dashboard sono coerenti (2,25 €) | `s3.log`, `s3_rimb1.png` |
| Anticipo: richiesta, autorizzazione, consegna, spesa, ricevute | Tutto fluido; «Hai in mano 15.000 MGA», ricevute entro il 07/12 sia in Dashboard sia in Anticipi | `s6.log`, `s7.log`, `s7_home.png`, `s7_scad2.png` |
| Bozza, errori, data futura | Bozza con istruzioni chiare; messaggi nello stile dell'app; avviso «data nel futuro» | `bz.log`, `bz_vuoto.png` |
| Conta di cassa con differenza grande | «Registra la conta» resta disattivato finché non si spunta la conferma; casella di 22 px dentro un'area di tocco di 313×101 px | `conta.mjs` |
| Aiuto in pagina (7 pagine) e Guida | Testi brevi, per l'operatore, coerenti con lo schermo; testo pronto a 0,3 s | `s9.log`, `guida_full_op.txt` |
| Francese | Dashboard, modulo, scheda, segnalazione, Scadenze e aiuto tutti tradotti | `fr.log`, `fr2` |
| Pagine riservate | /preventivo, /verifica, /riconciliazione, /rendiconto, /report e /admin/* sono bloccate. In «Tutti» nessun movimento bancario (filtro BNI: 0 movimenti) | `s8b.log`, `bni.mjs` |

## Riverifica dei difetti aperti
| Difetto | Esito | Prova |
|---|---|---|
| U1 paragrafo doppio sopra «Segnala» | **CHIUSO**: resta solo il riquadro, con una riga sotto, in IT e in FR | `s1c_giust.png`, `fr.log` SCHEDA |
| U2 BNI nel menu «Conto» di /nuovo | **CHIUSO**: si vedono solo Cassa Madagascar e Mvola. Resta un'eco nel filtro (vedi V4) | `t_nuovo.txt` |
| U3 FR «enregistrés» e spazio prima dei due punti | **CHIUSO**: «…tant qu'ils ne sont pas comptabilisés», «Erreur signalée : » | `fr2` (output), `fr.log` |
| U4 nome invece dell'importo; «automatica» | **CHIUSO**: in Scadenze «Richiesta di anticipo in attesa: 60.000 MGA», nessuna pastiglia «automatica» | `s4b` (output), `s7_scad2.png` |
| N‑2 data UTC | **APERTO IN PARTE, attenuato a P3**. Con l'orologio del telefono alle 23:30 di Antananarivo del 21/11, /nuovo propone 21/11 (corretto). /anticipi «Quando servono» propone invece 22/11, e Scadenze segna il 22/11 come «Oggi»: queste due pagine usano la data del server. Qui il server è in ora malgascia, quindi l'errore in produzione (server in UTC) non è verificabile | `n2.mjs` (due esecuzioni) |
| Riscontri a campione su difetti già chiusi | Ancora chiusi: N‑1 (stessa data in Dashboard e Anticipi), N‑3 («Anticipo autorizzato: ritira…»), N‑7, N9‑3, N9‑7, O6 («tessuti» → 401), T2, T3, T4, Q4, S3, S4 (FR «Frais généraux») | log citati sopra |

## Prova di allineamento (audit.mjs, operatore)
- 375: «Le mie richieste» 59 px (/anticipi) e «Filtri» 60 px (/documenti-emessi). Ho guardato le pagine (`a_ant375__1.png`, `a_de375__1.png`, `a_de1440__1.png`): sono stati vuoti con illustrazione, non buchi. Non li conto.
- 1440: Scadenze, 87 px nel calendario (non conta, come da BRIEF); /documenti-emessi come sopra.
- **Lo script non vede /conti** (V3): a 1440 tre schede in una griglia da quattro, con un posto vuoto a destra, e la tabella «Madagascar» che non arriva al bordo della scheda. A 768 «Anticipi aperti» resta da sola su mezza riga. Prova: `c1440__1.png`, `t768_conti__1.png`, `c375__1.png`.

## Difetti nuovi
| Id | Gravità | Area | Pagina · larghezza | Descrizione | Correzione suggerita |
|---|---|---|---|---|---|
| V1 | P3 | Registrare | Scheda subito dopo «Registra» · 375 | Nella conferma «Movimento registrato» il campo «Codice contabile» è vuoto; ricaricando compare (307, 401). Succede in modo intermittente: 2 volte su 9 (`s1.log`, `s6.log` contro `v1.mjs`, `v1b.mjs`). È il vecchio P3 del sesto giro, tornato | Nella conferma leggere il codice dal movimento salvato, non dallo stato del modulo; oppure ricaricare i dati dopo il salvataggio |
| V2 | **P2** | Facilità (coerenza col ruolo) | /documenti-emessi/nuovo · 375 | L'operatore può emettere da solo documenti ufficiali e definitivi a nome dell'ente. Ho emesso **RIC‑2026‑001**, una ricevuta per erogazione liberale da 50 € «Per ricevuta – Pasquale Esposito, Presidente», con l'opzione di nota sulla deducibilità (art. 83 CTS). Non serve alcuna approvazione né un movimento collegato, il numero è definitivo e il documento si può solo annullare (`de.mjs`, `de2.mjs`). Tra i tipi ci sono anche «Autorizzazione di spesa», «Dichiarazione dell'associazione» e «Notula»; questi li ho visti nell'elenco ma non li ho emessi | Per l'operatore lasciare solo «Quietanza di pagamento» e l'autocertificazione. Per gli altri tipi: solo bozza, con l'emissione fatta da un responsabile |
| V3 | **P2** | Facilità (impaginazione) | /conti · 1440, 768, 375 | Vista operatore: tre schede nella griglia pensata per quattro. A 1440 resta un posto vuoto a destra; a 768 «Anticipi aperti» è sola su mezza riga; a 375 va a tutta larghezza. «Contanti nelle casse» e «Madagascar» ripetono lo stesso importo (‑3.828 €). La tabella dei conti si ferma circa 125 px prima del bordo a 1440 | Per l'operatore due schede (Cassa Madagascar e Anticipi aperti) su 2 colonne a 768 e 1440, oppure una griglia `auto-fit`. Tabella con `width: 100%` |
| V4 | P3 | Facilità | /movimenti › Filtri › «Conto o cassa» | L'elenco propone «BNI Madagascar (banca)», che dà sempre 0 movimenti; /conti dice che i conti bancari li vedono i responsabili (`s9.log`, `bni.mjs`) | Mostrare nel filtro solo i conti che l'operatore può vedere |
| V5 | P3 | Aiuto e Guida | /guida «Muoversi nell'app» · 375 | Dice «Come funziona questa scheda (sul telefono «Come si fa»)», ma sul telefono c'è solo l'icona ⓘ, senza scritta (`home375__1.png`) | «sul telefono l'icona ⓘ accanto alle sotto-schede» |

Osservazioni non contate:
- (a) L'anteprima della foto nella scheda è un'immagine rotta con il testo alternativo in blu sottolineato (`s1c_giust.png`). Però l'archivio locale restituisce `multipart/form-data` (`s1c.mjs`), quindi è probabilmente un effetto di questa copia: non verificato. Manca comunque un'immagine di ripiego.
- (b) La Cassa Madagascar del set dimostrativo è a ‑20,4 milioni di MGA, quindi l'operatore vede sempre l'avviso «Avvisa il responsabile». Sono i dati, non l'app.
- (c) Con 3G lento simulato (400 ms di latenza, 400 kbit/s) il caricamento completo richiede 7–14 s. È la copia di sviluppo, quindi non è un dato rappresentativo.

## Voti
| Area | Giro 17 | Giro 18 | Motivo |
|---|---|---|---|
| Facilità complessiva | 9,5 | **7** | V2 e V3 (due P2), più V4. Non è un peggioramento dell'app: tutti e due c'erano già ma non erano stati visti. V3 l'ha fatto emergere la nuova prova di allineamento, V2 il controllo del ruolo chiesto in questo giro |
| Registrare una spesa | 9,5 | **9** | V1 (P3 intermittente, già noto al sesto giro e tornato). Il resto scorre: foto, «Usa», codici, anticipo preselezionato |
| Capire gli stati | 9,5 | **9,5** | Bozza, Da verificare, Verificato e Da rimborsare usano le stesse parole in Dashboard, elenco, scheda, Scadenze, aiuto e FR |
| Errori e recupero | 9,5 | **9,5** | Messaggi nello stile dell'app, data futura segnalata, conta bloccata finché non si conferma, segnalazione visibile in Scadenze |
| Aiuto in pagina e Guida | 9,5 | **9** | V5 (P3). Aiuti brevi e per l'operatore |
| Francese | 9,5 | **9,5** | U3 chiuso, nessun residuo trovato |
| Velocità percepita | 9 | **9** | Visite successive: 0,55–1,65 s (Dashboard 0,57; /movimenti 1,65); dal menu Dashboard a Movimenti 1,3 s (`speed.mjs`). La rete lenta reale non è verificata |
| **Complessivo** | **8** | **7** | Nessun P0 o P1; due P2 (V2, V3); P3: V1, V4, V5 e N‑2 residuo |

## Ordine di intervento
1. **V2**: togliere all'operatore l'emissione di ricevute, autorizzazioni, dichiarazioni e notule (lasciargli solo la bozza).
2. **V3**: griglia delle schede di /conti per l'operatore e tabella a tutta larghezza.
3. **V1**: codice contabile nella conferma letto dal movimento salvato.
4. **N‑2 residuo**: /anticipi «Quando servono» e Scadenze «Oggi» con la data del dispositivo, come già fa /nuovo.
5. **V4** filtro conti; **V5** frase della Guida.
