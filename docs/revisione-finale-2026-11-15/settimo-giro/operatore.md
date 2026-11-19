# YouCount – esperienza dell'operatore (giro finale, 19/11/2026)

Operatore a 375 px (e 768). Francese provato con lo stesso operatore (pulsante «FR»), poi riportato in italiano: admin_fr non è servito.
Prove in `/tmp/yc-final/work/op/` (script sN, schermate `op/…`). Dati «(PROVA REVISORE)»: MOV-2026-006, 007, 010, 011, una spesa di tasca propria, due anticipi, AUT-2026-001, una segnalazione, una conta. Anticipi autorizzati e consegnati col ruolo responsabile.

## Compiti svolti (tutti riusciti)

| Compito | Esito | Prova |
|---|---|---|
| Capire cosa fare (Dashboard) | Chiaro: un pulsante grande, 4 riquadri cliccabili, «Da fare» con azioni | `op/w375__.png`, `op/dash_dopo.png`, `op768_dash__1.png` |
| Spesa in contanti in MGA + foto + codice «riso» | Riuscita: ritaglio foto, 57.000 MGA → 10,67 €, MOV-2026-006 «Da verificare» | `op/editor.png`, `op/prima_registra.png`, s5/s6 |
| Bozza incompleta e ripresa | «Per salvare la bozza mancano: importo» → salvata → ritrovata da «Da fare» → registrata | `op/bozza_salvata.png`, s9–s11 |
| Spesa di tasca propria | «Salva da rimborsare», messaggio chiaro, compare in Da rimborsare e Dashboard | `op/tasca_sel.png`, `op/tasca_dopo.png` |
| Anticipo per sé e per una persona senza account | Moduli semplici; «Altra persona…» con nome libero; stato chiaro «da autorizzare → autorizzata, da consegnare → consegnata» | `op/anticipo_form2.png`, `op/anticipo_altra_inviato.png` |
| Spesa con l'anticipo | «Hai in mano 80.000 MGA · dopo questa spesa: 50.000» ottimo; «+ Ricevuta» precompila anticipo e progetto | s22, s23 |
| Senza giustificativo → autocertificazione | Motivi in un tocco, modulo precompilato, PDF AUT-2026-001, «Da firmare» in Da fare | `op/autocert_blocco.png`, s11–s12 |
| «Hai trovato un errore?» | Segnalazione inviata, visibile nel movimento e in Da fare | `op/segnala_dopo.png`, s13 |
| Conta di cassa | Tastierino numerico, totali per taglio, «Conta registrata.» | `op/conta_compilata.png`, `op/conta_dopo.png` |
| Aiuto | «Come funziona questa scheda» breve e pertinente; Guida «Come faccio a…» con «Portami lì» | `op/help_nuovo.png`, s26 |

## Valutazione per area

**Facilità complessiva – 7,5.** Funziona: percorso principale corto, linguaggio quotidiano («di tasca propria», «Hai in mano»), messaggi di conferma con passo successivo («Registrane un altro / Torna al registro»). Non funziona: alcune incoerenze di stato e di conteggi (sotto) costringono a pensare. Per il 10: unificare stati e conteggi; correggere la ricerca codici.

**Registrare una spesa – 7,5.** Funziona: foto con ritaglio, controvalore in euro mentre si scrive, pulsanti dei codici più usati, progetto ricordato, «taxi», «sapone», «semi», «benzina» trovano il codice giusto (s3). Non funziona (verificato, s3/s4/s22):
- ricerca senza risultati («pane») non avvisa in modo visibile (il «0 codici trovati» è 0×0 px) e **lascia selezionato il codice precedente** (202 Trasporti): rischio di codice sbagliato;
- «riso» trova 9 codici: 307 più tutti i 101–108 del personale;
- comportamento incoerente: «riso» seleziona da sola il primo risultato, «trasporto» no (mostra «4 codici trovati» nel menu e poi «Campo obbligatorio», `op/ant_hery_dopo.png`);
- spesa con l'anticipo di Hery: «Pagato da» resta «Operatore Prova» (MOV-2026-011, s23).
Per il 10: risultati come elenco di pulsanti visibili, nessuna selezione automatica silenziosa, messaggio visibile «nessun codice: prova "cibo"/"alimentazione"», sinonimi (pane, pasto…); «Pagato da» = titolare dell'anticipo.

**Capire gli stati – 6,5.** Funziona: etichette colorate «Bozza», «Da verificare», «In attesa di rimborso», «Da firmare»; frasi di conferma che spiegano cosa succede dopo. Non funziona (verificato):
- la spesa di tasca propria nel dettaglio si chiama «**Bozza** · Uscita» con «Elimina bozza», ma in Dashboard «Bozze 0»; il filtro «Bozze» (`/movimenti?stato=draft`) mostra 2 movimenti, incluso quello di tasca propria (s8, s10);
- l'aiuto della Dashboard parla di «Registrato» e «Verificato», l'interfaccia mostra «Da verificare» (s26);
- «Contanti in mano 0 MGA · anticipo ricevuto» quando l'anticipo è solo autorizzato, non consegnato (s19);
- in Anticipi «Contanti che ho in mano» elenca 80.000 e 110.000 MGA senza nome: i primi sono di Hery, non miei; la Dashboard dice invece 110.000 (`op/anticipi_dopo_spese.png`).
Per il 10: un solo vocabolario di stati (anche nell'aiuto), «Da rimborsare» mai chiamata bozza, nome della persona su ogni anticipo.

**Errori e recupero – 7,5.** Funziona: campi obbligatori segnati in rosso e riepilogo «Per registrare mancano: importo, codice contabile, progetto, descrizione, giustificativo»; schermo riportato in alto (`op/err_vuoto.png`); bozza salvabile con il solo importo; segnalazione d'errore semplice e tracciata. Non funziona: richiesta di anticipo e segnalazione vuote usano il fumetto del browser («Please fill out this field», `op/anticipo_vuoto.png`, `op/segnala_vuoto.png`) invece dello stile dell'app; conta di cassa con differenza +20.872.300 MGA registrata senza nessuna conferma (s25; il saldo negativo è dei dati demo, la mancanza di avviso no). Per il 10: stesso stile di errore ovunque; conferma se la differenza supera una soglia.

**Aiuto in pagina e Guida – 8,5.** Funziona: pannello breve, passi numerati, collegamento alla scheda della Guida; Guida orientata ai compiti («Ho sbagliato una spesa», «Cosa fare se manca lo scontrino») e coerente con quello che ho visto. Non funziona: la Guida mostra all'operatore capitoli che non può usare (Preventivo, Utenti, Riconciliazione…); la guida dice «scrivi il motivo», l'app offre motivi da toccare; l'autocertificazione dice «apri il PDF» ma il pulsante «Apri» è nel riquadro Giustificativi sopra. Per il 10: Guida filtrata per ruolo, pulsante «Apri PDF» dentro il riquadro autocertificazione.

**Francese – 8.** Funziona: traduzione completa e naturale (formulario, errori «Champ obligatoire», aiuto, Guida); ricerca codici in francese («riz», «taxi», «savon», «carburant» → codici giusti, s27); `lang="fr"` dopo il cambio. Non funziona: in «À faire» resta «Errore segnalato: MOV-2026-007» in italiano (s27, `op/fr_.png`); a 375 px l'etichetta lunga «En attente de remboursement» schiaccia il titolo su 4 righe. Nomi di progetto in italiano: dati, non difetto.

**Velocità percepita – 7.** Misure sul server locale (s29, carico macchina 1,7–2,4 su 2 CPU):

| Pagina | 1ª visita (compilazione di sviluppo) | Visita successiva: titolo / completa |
|---|---|---|
| Dashboard | 7,0 s (s1) | 0,9–1,5 s / 2,3–2,5 s |
| Nuovo | 9,4 s (s2) | 0,9 s / 2,2–2,4 s |
| Movimenti | 3,3–17 s | 1,3 s / 2,3 s |
| Conti / Anticipi | 11 s | 1,2 s / 2,1–2,2 s |

Salvataggi 1,5–2,7 s con «Salvataggio…» visibile. Prime visite lente = compilazione della copia di sviluppo, non l'app. Ogni pagina trasferisce 2,9–3,7 MB (build di sviluppo; produzione non verificata). Senza rete: **non verificato**.

## Tabella dei voti

| Area | Voto |
|---|---|
| Facilità complessiva | 7,5 |
| Registrare una spesa | 7,5 |
| Capire gli stati | 6,5 |
| Errori e recupero | 7,5 |
| Aiuto in pagina e Guida | 8,5 |
| Francese | 8 |
| Velocità percepita | 7 (senza rete: non verificato) |
| **Esperienza complessiva dell'operatore** | **7,5** |

## Difetti

| # | Gravità | Pagina | Larg. | Difetto | Prova |
|---|---|---|---|---|---|
| 1 | P2 | /nuovo | 375 | Ricerca codice senza risultati: messaggio invisibile e resta il codice precedente | s4 («pane» → 202) |
| 2 | P2 | /nuovo (anticipo altrui) | 375 | «Pagato da» resta l'operatore anche se si spende l'anticipo di un'altra persona | MOV-2026-011, s23 |
| 3 | P2 | /movimenti/<id>, /, /movimenti?stato=draft | 375 | Spesa di tasca propria chiamata «Bozza», contata nel filtro Bozze ma non nel riquadro Bozze | `op/tasca_dopo.png`, s10 |
| 4 | P2 | /anticipi | 375 | «Contanti che ho in mano» include l'anticipo di Hery, senza nome; Dashboard mostra un altro totale | `op/anticipi_dopo_spese.png` |
| 5 | P2 | /conti | 375 | Conta con differenza enorme registrata senza conferma | `op/conta_dopo.png` |
| 6 | P3 | /nuovo | 375 | «riso» restituisce anche i codici 101–108; selezione automatica sì/no incoerente | s4, `op/ant_hery_dopo.png` |
| 7 | P3 | / (Dashboard) | 375 | «0 MGA · anticipo ricevuto» prima della consegna | s19 |
| 8 | P3 | aiuto Dashboard | 375 | Stati «Registrato/Verificato» diversi da quelli mostrati | s26 |
| 9 | P3 | /anticipi, /movimenti/<id> | 375 | Errori con fumetto nativo del browser, non nello stile dell'app | `op/anticipo_vuoto.png`, `op/segnala_vuoto.png` |
| 10 | P3 | /movimenti/<id>/modifica | 375 | In modifica compaiono i conti italiani (Banca Italia, PayPal…), assenti nel modulo nuovo | s10 |
| 11 | P3 | / | 768 | «Da fare» ripete la segnalazione su due righe; icona «<» fuori luogo | `op768_dash__1.png` |
| 12 | P3 | / (FR) | 375 | «Errore segnalato: …» non tradotto; badge lungo schiaccia il titolo | `op/fr_.png` |
| 13 | P3 | / | 375 | Selettore anno propone 2027 (anno futuro, vuoto) | s1 |
| 14 | P3 | /guida | 375 | Capitoli per amministratori mostrati all'operatore | s1 |
| 15 | P3 | /movimenti/<id> | 375 | «Apri il PDF» dell'autocertificazione: pulsante in un altro riquadro | `op/autocert_blocco.png` |
| 16 | P3 | /nuovo (anticipo) | 375 | Voce tecnica «Anticipi al referente in Madagascar · EUR» tra le persone | s21 |

Nessun P0 o P1 trovato.
