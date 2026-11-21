# YouCount — giro 10, operatore (375 px, controllo a 768 px)

Prove in `/tmp/yc-final/work/`. Il server si è riavviato due volte durante il lavoro (01:17 e ~01:30), e ogni volta i dati di prova sono stati azzerati. Per questo alcune prove stanno solo nelle schermate e nell'output degli script, e alcune verifiche sono state rifatte con dati nuovi. L'uso senza rete non è verificato.

## A. Riverifica dei difetti dell'operatore

| Giro · difetto | Esito | Prova |
|---|---|---|
| 6 · P1 «Salva bozza» rifiutata | CHIUSO | Bozza salvata con importo e descrizione: «Bozza salvata… tocca «Modifica», poi «Registra»» (`bozza_ok.png`) |
| 6 · P1 Banca Italia e PayPal nel modulo | CHIUSO | Il modulo nuovo e la modifica propongono solo BNI, Cassa Madagascar e Mvola (`nuovo_part1.png`, futuro.mjs) |
| 6 · P2 «Anticipo di» propone anticipi di altri | APERTO, attenuato (P3) | Senza un anticipo proprio, «Anticipo di» elenca solo Fanomezantsoa. Non è più preselezionato (`fin_senza_ant.png`) |
| 6 · P2 Richiesta predefinita su un'altra persona | CHIUSO | Il campo parte da «Operatore Prova» (`antn_p0.png`) |
| 6 · P2 Autocertificazione: «Tutto in ordine» | CHIUSO | «Autocertificazioni da preparare: 1» (aut.mjs) |
| 6 · P2 Segnalazione senza traccia, chiusa dall'operatore | CHIUSO | La scheda mostra «Segnalato il…, in attesa del responsabile». In Scadenze non c'è «Fatta» (`apri.png`, `scad_p1.png`) |
| 6 · P2 Conti con i saldi di tutto l'ente | APERTO, parziale | Banche e «da verificare» tolti, e c'è una spiegazione. Resta la cassa a −20.441.300 MGA in rosso con «1 conto, tutto verificato» (`conti_p0.png`) |
| 6 · P2 Aiuto prolisso e misto per ruolo | APERTO, parziale (P3) | Dashboard, Nuovo, Movimenti, Anticipi e Conti sono brevi e per l'operatore. L'aiuto di Scadenze resta da amministratore (vedi N-6) |
| 6 · P2 PDF FR: motivo in italiano | CHIUSO | «Motif… : Transport local sans billet». «payée par» non c'è più (`aut_fr.pdf`) |
| 6 · P3 Codice vuoto nella conferma | CHIUSO | Nella conferma c'è «202 · Trasporti locali…» (`sp_conferma.png`) |
| 6 · P3 «Modifiche salvate» | CHIUSO per il modulo nuovo | «Movimento registrato: MOV-2026-006». Il passaggio da bozza a Registra non è stato riprovato |
| 6 · P3 «Importo letto» senza foto | CHIUSO | Non compare più |
| 6 · P3 «1 movimenti» | CHIUSO | «1 movimento» (filtro Bozze) |
| 6 · P3 Data futura accettata | CHIUSO | «La data del giustificativo è nel futuro: controllala.» |
| 6 · P3 Riquadro vuoto «Anteprima non disponibile» | APERTO | Riquadro vuoto alto circa 330 px sopra «Apri» (`aut_dopo.png`) |
| 6 · P3 Ritaglia e filtri di Scadenze | APERTO, parziale | Ritaglia è a posto (`sp_foto1.png`). I filtri di Scadenze sono ancora asimmetrici: «Scadute» da solo su una riga (`scad_p1.png`) |
| 6 · P3 «tu» nella richiesta in FR | CHIUSO | «Que devez-vous acheter» |
| 6 · P3 Scadenze con contenuti da amministratore | CHIUSO nella pagina | Niente «Nuova scadenza». Resta solo l'aiuto |
| 7-1 Nessun risultato invisibile | CHIUSO | Avviso visibile e codice precedente tolto (`srch_xyzqk.png`) |
| 7-2 «Pagato da» con l'anticipo altrui | CHIUSO | Con l'anticipo di Hery, «Pagato da» diventa Hery |
| 7-3 Spesa di tasca propria chiamata «Bozza» | CHIUSO | Stato «Da rimborsare»; il riquadro Bozze resta a 0 |
| 7-4 «Contanti che ho in mano» con Hery | CHIUSO | Due blocchi separati: «Contanti che ho in mano» e «Contanti consegnati ad altre persone» |
| 7-5 Conta grande senza conferma | CHIUSO | Il pulsante resta disattivato senza spunta e nota (`conta_grande.png`) |
| 7-6 «riso» trova 101–108 | CHIUSO | «riso» trova solo 307 |
| 7-7 «0 MGA · anticipo ricevuto» | CHIUSO | «nessun contante in mano» (`op_dash_aut__1.png`) |
| 7-8 Stati diversi nell'aiuto | CHIUSO | L'aiuto usa Bozza, Da verificare, Verificato, Da rimborsare |
| 7-9 Errori nel fumetto del browser | CHIUSO | «Campo obbligatorio» nello stile dell'app (`ant_vuota.png`) |
| 7-10 Conti italiani in modifica | CHIUSO | Solo i conti malgasci |
| 7-11 «Da fare» doppio, icona «<» | CHIUSO | Una sola riga, icona «i» |
| 7-12 FR «Errore segnalato» non tradotto | NON RIVERIFICATO | I dati sono stati azzerati prima della prova in FR |
| 7-13 Anno 2027 nel selettore | CHIUSO | Il selettore va dal 2026 al 2022 |
| 7-14 Capitoli della Guida da amministratore | CHIUSO | Niente Preventivo né Utenti |
| 7-15 «Apri il PDF» in un altro riquadro | CHIUSO | «Apri il PDF da stampare» è nel riquadro dell'autocertificazione |
| 7-16 Voce tecnica del referente | CHIUSO | Non c'è più |
| 8-N1 Doppio invio della richiesta | CHIUSO | Rete rallentata 3 s, due tocchi, un solo invio. Pulsante grigio con rotellina (`ant_invio.png`) |
| 8-N3, N5, N6, N7, N8, N9, N11, N12, N14 | CHIUSI (9) | Doppione di sé non riprodotto. Nota obbligatoria. «Hery ha in mano». «tocca Modifica». Guida: «basta l'importo». «+ Nuova richiesta». Richiesta visibile in Dashboard. «MOV‑2026‑006» non va a capo. Maniglie intere |
| 8-N10 Filtri da amministratore | APERTO, parziale (P3) | Banca Italia non c'è più e «Da rimborsare» sì. Restano PayPal, Satispay, Bonifico e i codici delle entrate E101–E999 (`fin_filtri.png`) |
| 9-N9-1 «Tutti» con le banche, lento | CHIUSO | 509–510 movimenti senza banche né giroconti; 2,7–3,2 s |
| 9-N9-2 Avviso doppione tagliato | NON RIVERIFICATO | Doppione non provato |
| 9-N9-3 Messaggio sulla data nel 2027 | CHIUSO | «data del documento (nel futuro)» |
| 9-N9-4 Storico delle conte che deborda | APERTO | A 375 px la colonna «Differenza» è tagliata a «+38.4» (`conta_esito_fondo.png`) |
| 9-N9-5 FR «de sa poche» / «de votre poche» | APERTO | Il modulo dice «De sa poche», la Dashboard «de votre poche» |
| 9-N9-6 Proposta automatica non chiara | APERTO | In IT il progetto viene proposto scegliendo l'anticipo. In FR, con l'anticipo già preselezionato, resta «Choisir…» (fr3.mjs) |
| 9-N9-7 «…» per circa 1 s nell'aiuto | APERTO, solo in Scadenze | A 150 ms compare «Guida … …»; le altre pagine sono immediate |
| 9-N9-8 Titolo di «Anticipi aperti» | APERTO | In /anticipi (responsabile): «Fanomezantsoa Rakotondrabe · 3 persone». Per l'operatore, con una persona sola, è corretto |

**Conteggio (53 difetti):** CHIUSO 40 · APERTO 11 · PEGGIORATO 0 · non riverificati 2.

## B. Compiti svolti (operatore, 375 px)
- **Svolti tutti:** Dashboard, spesa in contanti MGA con foto (MOV-2026-006), ricerca «riso», «taxi», «pane», «xyzqk», campi mancanti, bozza incompleta, spesa di tasca propria, anticipo per sé e per una persona senza account (doppio tocco con rete lenta, poi autorizzazione e consegna col responsabile), spesa con l'anticipo (MOV-2026-009), spesa senza giustificativo con autocertificazione (AUT-2026-001), «Hai trovato un errore?», conta con differenza di 38,5 milioni, «Tutti», aiuto su 6 pagine e Guida.
- **Francese:** stesse pagine, richiesta di anticipo e spesa con anticipo (MOV-2026-007, `fr_spesa_top.png`), poi ritorno all'italiano.
- **768 px:** Dashboard, Nuovo, Conti, Anticipi e Movimenti sono ordinati, senza sbordature (`t768_*`).
- **Velocità** (visite successive alla prima): 1,8–2,3 s per pagina. La prima visita di /rimborsi e /altro richiede circa 8 s.

## Difetti nuovi

| # | Gravità | Pagina · larghezza | Descrizione completa | Prova |
|---|---|---|---|---|
| N-1 | P2 | /, /anticipi · 375 | Per lo stesso anticipo, la Dashboard dice «ricevute entro il 05/12/2026» e /anticipi «entro il 08/12/2026» (uso il 23/11 + 15 giorni). Probabilmente la Dashboard prende la scadenza della richiesta da 1.000 MGA non ancora consegnata (uso il 20/11). Così l'operatore riceve due date diverse per lo stesso obbligo. | `op_dash_cons__1.png`, testo di /anticipi |
| N-2 | P2 | /nuovo, /anticipi, /conti, scheda, Scadenze · tutte | La data «di oggi» è quella UTC. Tra le 00:00 e le 03:00 in Madagascar, la data operazione, la data della conta e «Quando servono» propongono il giorno prima: il 20/11 alle 01:56 del 21/11. La scheda dice «Segnalato il 20/11» ma «Inserito 21/11 01:01». In Scadenze il 20/11 è «Oggi» e il 21/11 «Tra 1 gg», mentre la Dashboard dice «oggi 21/11/2026». Il primo giorno del mese la spesa finirebbe nel mese precedente. | `sp_conferma.png`, `scad_p1.png`, `t768__nuovo__1.png` |
| N-3 | P3 | / · 375 | Un anticipo autorizzato ma non ancora consegnato non compare in «Da fare»: l'operatore non sa che può ritirare i contanti. | `op_dash_aut__1.png` |
| N-4 | P3 | scheda della bozza; schede altrui in «Tutti» | Il modulo dell'autocertificazione («Dichiarante (chi ha speso)…», «Genera il PDF») compare anche sulle bozze senza scontrino e sui movimenti dell'amministratore. | bozza.mjs, altrui.mjs |
| N-5 | P3 | /scadenze, aiuto · 375 | L'aiuto è da amministratore e lungo 186 parole: quattro riquadri, «Nuova scadenza», «si segnano come fatte», 770, soglie, commercialista. All'apertura mostra «…». | help.mjs |
| N-6 | P3 | PDF dell'autocertificazione FR | Il progetto «Spese generali» non è tradotto. «Lieu et date:» manca dello spazio prima dei due punti. | `aut_fr.pdf` |
| N-7 | P3 | /conti · 375 | La casella di conferma della «Differenza grande» è quella nativa, di circa 13 px: troppo piccola da toccare col dito. | `conta_grande.png` |
| N-8 | P3 | /nuovo · 375 | «tissu» non trova codici, mentre il modulo della richiesta suggerisce proprio «tessuti, filo e aghi». | fr3.mjs |
| N-9 | P3 | /anticipi (responsabile) | «2 richiesta in corso»: plurale sbagliato. | resp1.mjs |

Non segnalato: anteprima dell'immagine rotta, perché l'archivio della copia locale risponde con `multipart/form-data` (img.mjs).

## Voti

| Area | Giro 9 | Giro 10 | Motivo |
|---|---|---|---|
| Facilità complessiva | 7 | **8** | Nessun P1. Un P2 (N-1) e alcuni P3 (N-3, filtri, N9-8) |
| Registrare una spesa | 8,5 | **8** | Un P2 (N-2) e alcuni P3 (anticipo altrui, N9-6, N-8) |
| Capire gli stati | 9 | **9** | Bozza, Da verificare, Verificato e Da rimborsare sono uguali in Dashboard, elenco, scheda, filtri e aiuto |
| Errori e recupero | 9 | **9** | Due P3 (N9-4, N-7) |
| Aiuto in pagina e Guida | 9 | **9** | Solo Scadenze (N-5) |
| Francese | 8,5 | **9** | Compiti completi. Due P3 (N9-5, N-6) |
| Velocità percepita | 7,5 | **8** | ~2 s per pagina, «Tutti» 3 s, registrazione con foto 8 s |
| **Complessivo** | 8 | **8** | Nessun P0 o P1. Due P2 in tutto, uno per area. Contando i P2 su tutta l'app la scala darebbe 7 |

**Area scesa — Registrare una spesa (8,5 → 8):** il difetto N-2 non è un peggioramento reale. Molto probabilmente c'era già ma non era stato visto: si vede solo usando l'app tra le 00:00 e le 03:00 ora malgascia, l'orario in cui ho svolto questo giro (01:00–02:00).

Senza rete: non verificato.
