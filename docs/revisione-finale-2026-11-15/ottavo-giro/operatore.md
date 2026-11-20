# YouCount, giro 8: revisione dell'operatore

Utente: Operatore Prova, 375 px; per l'autorizzazione e la consegna ho usato il ruolo responsabile. Le schermate sono in `/tmp/yc-final/work/op8/`. I dati di prova sono marcati «(PROVA REVISORE 8)».
**Limite:** alle 00:26 il server si è fermato. In quel momento erano in corso `scripts/db_reset_local.sh` e `tests/e2e/layout.e2e.mjs`, lanciati da altri. Alle 00:53 non era ancora ripartito e il watchdog non è attivo. Per questo **non ho verificato** il francese, la larghezza 768 e l'aggiunta di un giustificativo dopo la registrazione. Non ho verificato nemmeno l'uso senza rete.

## A. Riverifica dei difetti precedenti

| # | Difetto | Esito | Prova |
|---|---|---|---|
| 6·P1 | «Salva bozza» rifiutata | CHIUSO | Con il solo importo la bozza si salva: `bozza_vuota.png`, `bozza_scheda1.png` |
| 6·P1 | Conti italiani in /nuovo | CHIUSO | Compaiono solo BNI, Cassa MG e Mvola: `nuovo1_2.png`; lo stesso vale in modifica |
| 6·P2 | «Anticipo di» propone gli anticipi altrui | CHIUSO* | L'anticipo proprio è preselezionato: `ant_spesa1.png` (*il caso «senza anticipo proprio» non è stato riprovato) |
| 6·P2 | «Chi riceve» predefinito su un'altra persona | CHIUSO | Risulta «Operatore Prova»: `ant_new.png` |
| 6·P2 | Autocertificazione mancante ma «Tutto in ordine» | CHIUSO | Il «Da fare» mostra «Autocertificazioni da preparare: 1» |
| 6·P2 | Segnalazione: nessuna traccia; in Scadenze «Fatta» | APERTO (attenuato) | La traccia nella scheda c'è e «Fatta» è sparita. Il pulsante ✎ però apre il modulo completo, dove il «Responsabile» è l'operatore stesso: `scad_edit2.png` |
| 6·P2 | Conti: saldi di tutto l'ente | APERTO (attenuato) | Le banche sono nascoste. Restano Cassa MG a −3.834 € in rosso, «15 movimenti da verificare» di tutto l'ente e un riquadro «Italia» vuoto: `conti1_1.png` |
| 6·P2 | Aiuto prolisso e misto | CHIUSO | Da 44 a 93 parole per pagina, testi per l'operatore; restano piccoli residui (N8, N9) |
| 6·P2 | PDF FR: motivo in italiano, «payée par» vuoto | CHIUSO | Nel PDF bilingue il motivo è «Vendeur sans reçu» e «payée par» è sparito: `aut.pdf` |
| 6·P3 | Codice contabile vuoto nella conferma | CHIUSO | `reg_stato.png` |
| 6·P3 | «Modifiche salvate» alla registrazione della bozza | CHIUSO | Il messaggio è «Movimento registrato: MOV-2026-010» |
| 6·P3 | «Importo letto» senza foto | CHIUSO | Non compare: `nuovo1` |
| 6·P3 | «1 movimenti» | CHIUSO (375) | Ora «1 movimento»: `mov1.png` |
| 6·P3 | Data del documento futura accettata | APERTO | Compare un avviso, ma fuori schermo; «Registra» va avanti e il movimento resta con 01/03/2027: `reg_futuro.png`, MOV-2026-006 |
| 6·P3 | «Ritaglia»: pulsanti di altezza diversa | APERTO | Misurati 44 e 50 px: `foto1.png` |
| 6·P3 | FR: «tu» nella richiesta di anticipo | non verificato | Server fermo |
| 6·P3 | Contenuti da amministratore in Scadenze e Da rimborsare | APERTO | Restano «Nuova scadenza», «Fine del finanziamento…», «Da pagare/incassare in 30 gg», «Rimborsato nel 2026»: `scad1.png` |
| 7·1 | Ricerca senza risultati | CHIUSO | Il messaggio è visibile e il codice precedente viene azzerato: `cod2_zzqx.png` |
| 7·2 | «Pagato da» non segue l'anticipo | CHIUSO | Diventa Hery, poi torna all'operatore |
| 7·3 | Spesa di tasca propria come «Bozza» | CHIUSO | È «Da rimborsare» in scheda e in Dashboard; il filtro Bozze ne trova 0 |
| 7·4 | Contanti in mano con l'anticipo di Hery | CHIUSO | 100.000 MGA propri, separati da «consegnati ad altre persone»; la Dashboard è coerente |
| 7·5 | Conta con differenza enorme senza conferma | CHIUSO | Il pulsante resta disattivato finché non si spunta la conferma: `conta2.png` |
| 7·6 | «riso» restituisce anche 101–108 | CHIUSO | Ora solo 307, mai selezionato da solo: `cod2_riso.png` |
| 7·7 | «0 MGA · anticipo ricevuto» | CHIUSO | Ora «nessun contante in mano» |
| 7·8 | Stati diversi nell'aiuto della Dashboard | CHIUSO | Bozza, Da verificare, Verificato, Da rimborsare |
| 7·9 | Fumetto nativo del browser | CHIUSO | «Campo obbligatorio» nello stile dell'app: `ant_err.png` |
| 7·10 | Conti italiani in modifica | CHIUSO | Solo conti MG |
| 7·11 | «Da fare» doppio e icona «<» | CHIUSO | Una sola riga: `dash_segn.png` |
| 7·12 | FR: «Errore segnalato» non tradotto | non verificato | Server fermo |
| 7·13 | Anno 2027 nel selettore | CHIUSO | Anni dal 2026 al 2022: `dash1.png` |
| 7·14 | Guida per amministratori | APERTO (attenuato) | Le pagine sono filtrate, ma le domande «Rimborsare…» e «Dare un anticipo» contengono passi da responsabile |
| 7·15 | «Apri il PDF» in un altro riquadro | CHIUSO | Ora sta dentro l'autocertificazione: `autoc_gen.png` |
| 7·16 | Voce tecnica «Anticipi al referente» | CHIUSO in /nuovo | Resta nei filtri (N10) |

**Conteggio (34 voci): CHIUSO 26 · APERTO 6 · PEGGIORATO 0 · non verificato 2.**

## B. Compiti svolti (375 px)

| Compito | Esito |
|---|---|
| Dashboard | Chiara: un pulsante, quattro riquadri, «Da fare» |
| Spesa in contanti MGA con foto, codice «riso» | Registrata MOV-2026-006, numero nella conferma |
| Ricerca codice: «taxi», «pane», parola senza risultati | taxi→202, pane→307, «zzqx» → messaggio d'aiuto |
| Bozza incompleta, poi completata | Bozza con il solo importo; completata come spesa «di tasca propria» |
| Spesa di tasca propria | Stato «Da rimborsare» coerente in scheda, Dashboard e /rimborsi |
| Anticipo per sé e per Hery (senza account) | Richiesti; autorizzati e consegnati dal responsabile; i saldi dell'operatore sono corretti |
| Spesa con l'anticipo | MOV-2026-009; contanti in mano da 100.000 a 60.000 MGA |
| Spesa senza giustificativo e autocertificazione | MOV-2026-010, PDF AUT-2026-001 bilingue, Da fare aggiornato |
| «Hai trovato un errore?» | La traccia compare in scheda, in Da fare e in Scadenze |
| Conta di cassa con differenza grande | Chiede la conferma; registrata con «Conta registrata.» |
| Aiuto in pagina e Guida | Testi brevi e per ruolo; piccole contraddizioni |
| Francese e 768 px | **Non verificato** (server fermo) |

**Velocità:** nelle visite successive alla prima il contenuto appare in 0,7–1,2 s, misurato fino a h1 senza indicatore di caricamento. I salvataggi hanno richiesto da 1,7 a 14 s; a macchina carica fino a più di 30 s (bozza, anticipo).

## Difetti nuovi

| ID | Gr. | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| N1 | **P2** | /anticipi?nuova=1 · 375 | «Invia la richiesta» non dà alcun segnale durante l'invio: niente pulsante disattivato, niente «Invio…». Con la rete rallentata (latenza 2 s) il pulsante resta uguale. A server lento ho ottenuto due richieste identiche. | `ant_sent.png` (20 s dopo il clic), `ant_lenta1.png`, `ant_doppia.png` |
| N3 | P3 | /nuovo | Durante il salvataggio «Possibili doppioni» elenca proprio il movimento che si sta salvando | `bozza_salvata.png` |
| N5 | P3 | /conti · conta | Chiede di «scrivere il motivo nelle note», ma registra anche senza nota; la frase «il database registra il saldo» è tecnica | `conta3.png`, tabella delle conte |
| N6 | P3 | /nuovo · anticipo | Scegliendo l'anticipo di Hery compare «Hai in mano: 50.000 MGA», ma i contanti li ha Hery | testo del passaggio |
| N7 | P3 | scheda della bozza | Dice «premi «Registra»», ma nella scheda il pulsante non c'è: bisogna passare da Modifica | testo di `nogiu_bozza` |
| N8 | P3 | /guida | Dice «Per la bozza bastano importo e conto», mentre all'app basta l'importo. Dice anche «se lo scontrino arriva dopo… allegalo», ma nella scheda registrata MOV-006 ci sono solo Apri e Scarica | `guida1.png` |
| N9 | P3 | aiuto Anticipi | Cita «Chiedi un anticipo», ma il pulsante si chiama «+ Nuova richiesta» | aiuto /anticipi |
| N10 | P3 | /movimenti · filtri | All'operatore mostra Banca Italia, PayPal, «Anticipi al referente…» e «Dati: reali/dimostrativi»; nel filtro Stato manca «Da rimborsare» | `filtri1.png` |
| N11 | P3 | / | Le richieste di anticipo in attesa di autorizzazione non compaiono in Dashboard | `dash_ant` |
| N12 | P3 | /scadenze · 375 | «MOV-2026-006» va a capo al trattino; il ✎ apre il modulo in cima alla pagina senza scorrere fino a lì | `scad2.png` |
| N14 | P3 | Ritaglia · 375 | Le maniglie degli angoli sono tagliate dal bordo | `foto1.png` |

## Voti

| Area | Giro 7 | Giro 8 | Difetti che pesano |
|---|---|---|---|
| Facilità complessiva | 7,5 | **8** | Conti di tutto l'ente (P2 aperto), N11, Scadenze da amministratore |
| Registrare una spesa | 7,5 | **8,5** | Nessun P2; P3: data futura, N3, N6, N7, Ritaglia, N14 |
| Capire gli stati | 6,5 | **9** | Stessi nomi ovunque; N10 (P3) |
| Errori e recupero | 7,5 | **8** | N1 (P2); N5; modifica della segnalazione (P3) |
| Aiuto in pagina e Guida | 8,5 | **8,5** | N8, N9, Guida per amministratori (tre P3) |
| Francese | 8 | **n.v.** | Server fermo: non verificato |
| Velocità percepita | 7 | **7,5** | Pagine in circa 1 s; salvataggi lenti a macchina carica (impressione, ambiente condiviso) |
| **Complessivo** | **7,5** | **8** | |

Nessuna area scende rispetto al giro 7. Il francese non è votato perché non ho potuto verificarlo; non è un peggioramento.

**Per arrivare a 9:** segnale di invio e blocco del doppio invio (N1); in Conti solo cassa e anticipo propri; data futura bloccata; «Registra» nella scheda della bozza.
