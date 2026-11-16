# YouCount — Esperienza dell'operatore (revisione indipendente, 16/11/2026)

Utente operatore@test.local, 375 px, IT e FR (rimesso «IT» alla fine). Prove in /tmp/yc-final/work (file citati). Nota: il server si è riavviato alle 12:25 e ha ricaricato i dati demo; le prove 4-10 sono successive. Le date nei campi appaiono mm/dd/yyyy per via della lingua del browser di prova, non è un difetto.

## Percorsi provati (verificato)
| # | Percorso | Tocchi / tempo | Esito | Prova |
|---|---|---|---|---|
| 1 | Accesso → Dashboard | 3 tocchi; primo contenuto 1,1 s, rete ferma 3,3 s | Chiaro: «Registra una spesa», 4 riquadri, «Da fare» | op_home_full.png |
| 2a | Contanti MGA con foto | 14 tocchi; conferma dopo 8-12 s | MOV registrato; ritaglio foto sempre da confermare («Usa») | s2c_*.png |
| 2b | Senza giustificativo | 11 tocchi; motivo con 4 pulsanti | Manca il motivo → scorre al campo e lo evidenzia | s2d_after_1.png |
| 3 | Di tasca propria | 11 tocchi | «Salva da rimborsare» → «La trovi in Da rimborsare»; riquadro «Da rimborsare a te» in Dashboard | s3_home.png, s3_rimborsi.png |
| 4 | Anticipo (richiesta → autorizzazione → consegna → spesa) | richiesta 4 campi; spesa 16 tocchi | «Hai in mano 200.000 · dopo questa spesa 80.000»: ottimo | s4b, s4i_search.png |
| 5 | Correggere una bozza | 4 tocchi | Bene. Registrato: solo testo «chiedi a un responsabile» | s5_*.png, verif_detail.png |
| 6 | Ritrovare e capire «Verificato» | 1 tocco (Movimenti) | Etichetta chiara, ma 4 riquadri contabili prima dell'elenco | s6_list_full.png |
| 7 | Autocertificazione | 2 campi + 1 tocco | PDF allegato, «Da firmare», istruzioni, voce in «Da fare» | s7_after.png |
| 8 | «i» e Guida | 1 tocco | Completa ma a muro di testo; una frase contraddice l'app | s8_help__1.png, s8_guida__2.png |
| 9 | Errori | — | Campi obbligatori tutti insieme + riepilogo; data futura e 2025 registrate con solo avviso | s9_*.png, fr_old_after.png |
| 10 | Senza rete | 1 tocco | «Salvato sul telefono», contatore, invio automatico: verificato | off_2.png, off_3.png |

## Voti
| Area | Voto | Funziona | Non funziona |
|---|---|---|---|
| Facilità per l'operatore | 8 | Dashboard centrata su «cosa fare», pulsante unico, codici frequenti a pulsanti, ricerca «semi»→304 scelto da solo | Moduli e pagine da contabile (Entrata/Giroconto, 7 conti tra cui Italia/PayPal, tasso modificabile, «Genera Quietanza/Notula») |
| Registrazione spesa (telefono) | 7,5 | Foto+ritaglio, importo «letto» con controvalore, anticipo preselezionato, coda senza rete | Modulo lungo ~2.200 px, 11-16 tocchi; «Di tasca propria» parte in EUR (8.000 → 8.000,00 €, nessun avviso); avviso «cassa sotto zero (-20 milioni)» a ogni spesa e anche quando il conto non c'entra |
| Chiarezza stati e prossimi passi | 8,5 | Messaggi dopo ogni azione («Ora lo controlla un responsabile»), etichette di stato, «Da fare» con scadenze | Anticipo solo autorizzato mostrato come «0,00 € · anticipo ricevuto»; «Bozza · In attesa di rimborso» insieme; messaggio «Salvato sul telefono» resta dopo l'invio |
| Errori e recupero | 7 | Tutti gli obbligatori insieme, scorrimento al primo, riepilogo «Pour comptabiliser il manque : …», decimali in ariary arrotondati con spiegazione | Data 25/12/2026 e 10/01/2025 registrate (MOV-2025-001) con solo avviso; «Salva bozza» pretende tutti i campi; errore su registrato: nessun pulsante per segnalarlo |
| Aiuto e guida | 8 | «i» contestuale, FAQ «Come faccio a…», «Portami lì», sezione «Ho sbagliato una spesa» | Guida dice «Salva bozza se manca qualcosa» (falso); paragrafi lunghi; FAQ da amministratore («Dare un anticipo») al posto di «Chiedere un anticipo»; frase interna «Testo ripreso dal vecchio foglio… da far verificare al commercialista» |
| Francese per l'operatore | 8,5 | Traduzione completa e naturale («Comptabiliser», «De sa poche», «Apportez les reçus») | Titolo tagliato «En attente de vérifica…»; due punti senza spazio («Montant lu: », «comptabilisé: ») |
| Velocità percepita | 7 | A caldo: primo contenuto 0,4-0,9 s, rete ferma 1,7-3,3 s; senza rete funziona | Picchi 8-19 s (/anticipi, /rimborsi, /movimenti, copia di sviluppo e macchina condivisa); «Registra» → conferma 8-12 s con solo «Salvataggio…»; ~3 MB a pagina (sviluppo: produzione non verificata) |
| **Esperienza operatore complessiva** | **8** | Flusso coerente dall'anticipo alla firma | Il 9 richiede meno campi, blocchi su date sbagliate e un canale per gli errori |

## Difetti
| # | Gravità | Pagina, larghezza | Difetto | Prova |
|---|---|---|---|---|
| 1 | P1 | /nuovo, 375 | Spesa con data futura (25/12/2026) o dell'anno precedente (10/01/2025, MOV-2025-001) registrata con solo avviso | s9 (registro MOV-2026-008), fr_old_after.png |
| 2 | P1 | /nuovo «Di tasca propria», 375 | Valuta predefinita EUR anche per chi spende in ariary; 8.000 diventa 8.000,00 € senza avviso | s3_eur8000.png |
| 3 | P2 | /nuovo, 375 | «Salva bozza» chiede conto, codice, progetto e giustificativo: la bozza non serve a «completare dopo»; la Guida dice il contrario | s5_bozza.png, s8_guida__2.png |
| 4 | P2 | /nuovo, 375 | Avviso «cassa sotto zero» a ogni spesa, resta anche con «Di tasca propria»; chiede all'operatore un giroconto che non può fare | s3_full.png |
| 5 | P2 | Dashboard, 375 | Anticipo autorizzato ma non consegnato: «Contanti in mano 0,00 € · anticipo ricevuto», «Da fare: Tutto in ordine» | s4_op_home_aut__1.png |
| 6 | P2 | /movimenti/<id>, 375 | Errore su un registrato: solo testo, nessun pulsante «Segnala» | verif_detail.png |
| 7 | P2 | /nuovo, 375 | Conferma dopo «Registra» in 8-12 s senza indicazione di avanzamento | s2c_after_2.png |
| 8 | P2 | /movimenti, 375 | 4 riquadri (Entrate, Saldo «disavanzo» rosso) prima dell'elenco: l'elenco parte a ~800 px | s6_list_full.png |
| 9 | P2 | Dashboard FR, 375 | «En attente de vérifica…» troncato | fr_home.png |
| 10 | P3 | /movimenti/<id> | Frase interna «Testo ripreso dal vecchio foglio di calcolo… da far verificare al commercialista»; «Quietanza/Notula/Nota di rimborso» visibili all'operatore | s2e_after_full.png |
| 11 | P3 | /anticipi vs Dashboard | 200.000 MGA = 37,46 € (anticipi) e 37,84 € (dashboard) | s4h, testo dashboard |
| 12 | P3 | /rimborsi, 375 | Riquadro «Da documentare» con righe ripetute e contraddittorie | s3_rimborsi.png |
| 13 | P3 | /nuovo dopo invio senza rete | «Salvato sul telefono» resta dopo l'invio | off_3.png |
| 14 | P3 | Movimento 2025, 375 | «-13 MGA» grande e «0» piccolo (euro mancante) | fr_old_after.png |
| 15 | P3 | Ritaglio foto, 375 | 4 pulsanti di altezze diverse; anteprima PDF «non disponibile» in un riquadro vuoto alto | s2_afterphoto_1.png, s7_after.png |

## I 10 interventi più efficaci (in ordine)
1. Data operazione: bloccare il futuro e i mesi o anni chiusi o precedenti per l'operatore, con il testo «Questa data è nel futuro: correggila» / «Le spese del 2025 le registra un responsabile».
2. Valuta e conto: per l'operatore in Madagascar preselezionare MGA e il suo ultimo conto anche in «Di tasca propria»; sopra 1.000 € avvisare «Sono davvero 8.000 euro?».
3. Bozza vera: «Salva bozza» con solo importo o foto; gli obbligatori servono solo a «Registra». Allinea la Guida.
4. Pulsante «Segnala un errore» sul movimento registrato (campo libero → notifica al responsabile + voce nel suo «Da verificare»). Risparmia telefonate e messaggi fuori dall'app.
5. Modulo operatore ridotto: nascondere Entrata/Giroconto, conti italiani, tasso (sola lettura), «Modalità di pagamento» (dedotta dal conto) e «Genera documento». Da 16 a circa 9 tocchi.
6. Avviso cassa negativa solo ai responsabili; mai con «Di tasca propria» o «Anticipo».
7. Stati dell'anticipo in Dashboard: «Anticipo autorizzato: ritira 200.000 MGA da …» invece di «anticipo ricevuto»; un solo cambio per l'euro.
8. Dopo «Registra»: tornare subito al «Registrane un altro» con «Invio in corso…» (come la coda senza rete) invece di 8-12 s di attesa.
9. Movimenti per l'operatore: elenco subito sotto le schede, riquadri contabili ridotti a una riga «2 da verificare · 1 bozza».
10. Guida operatore: 5 FAQ sue (Registrare, Senza scontrino, Chiedere un anticipo, Di tasca mia, Ho sbagliato) a frasi brevi; togliere la frase interna; correggere il titolo francese troncato e lo spazio prima dei due punti.
