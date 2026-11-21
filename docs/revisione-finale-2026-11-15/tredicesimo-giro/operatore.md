# YouCount — Operatore, tredicesimo giro (21/11/2026)

Prove a 375 px salvo dove indicato. Schermate e script in `/tmp/yc-final/work/op13/`. Durante il giro il server si è riavviato una volta e i dati sono stati ricaricati: richiesta, autorizzazione e consegna di un anticipo da 50.000 MGA sono state rifatte (`setup.mjs`). Telefono vero, PWA e uso senza rete: non verificati.

## A. Riverifica dei difetti precedenti

| Id | Stato | Prova |
|---|---|---|
| O1 Il modulo propone «Soldi di YouSud» con l'anticipo in mano | CHIUSO | Con 50.000 MGA in mano il modulo parte da «Anticipo» → «Operatore Prova · MGA» e mostra «Hai in mano: 50.000 MGA» (`nuovo__2.png`) |
| O2 Autocertificazione assente con «Salva da rimborsare» | CHIUSO (resta Q3) | La scheda ora contiene il modulo «Autocertificazione di spesa». La Dashboard conta «Autocertificazioni da preparare: 3» su 3 spese |
| O3 Suggerimenti rumorosi e lontani dal campo | CHIUSO | «Codice suggerito» compare subito sotto la descrizione (`sp2_b.png`). Le parole vuote non generano più suggerimenti: «Pane per merenda» e «Riso e olio per la mensa» → 307, «Taxi…» → 202, «xqzw» → nessun suggerimento. In francese «Riz pour la cantine» → 307. Niente doppioni (`sp3`, `fr3`) |
| O4 Il progetto dell'anticipo resta dopo aver cambiato modo di pagamento | APERTO | Si passa da «Anticipo» a «Soldi di YouSud» o a «Di tasca propria»: il progetto resta «École Antanetibe», senza avviso (`sp7`, `sp8`, `o4_yousud.png`). La Guida dice che il progetto «va scelto ogni volta», ma arriva già compilato |
| O5 Nell'aiuto c'è la data delle ricevute, nella scheda no | CHIUSO | La scheda mostra «ricevute entro il 06/12/2026» (`dash2`) |
| O6 «tessuti» e «tissu» portano a 405 | CHIUSO | Entrambe le parole portano a 401 Materiali di consumo (`sp4`) |
| O7 Guida: nomi dei pulsanti sbagliati | CHIUSO | Ora dice «Venditore senza ricevuta» e «l'operatore trova in Dashboard «Registra una spesa»» (`guida.txt`) |
| O8 «Salvataggio…» compare sul pulsante sbagliato | CHIUSO | Ora la scritta «Salvataggio…» compare su «Salva bozza» e «Registra» resta com'è (`o8_saving.png`) |
| N-6 PDF dell'autocertificazione in francese | APERTO (in parte) | «Lieu et date :» è corretto e il motivo è tradotto (`autocert_fr.pdf`). Restano in italiano «Visa… – Pasquale Esposito, **Presidente**» e «Spese generali» nell'elenco dei progetti in francese (`fr3`) |
| N9-5 Francese: «fonds propres», «de sa poche», spazio mancante | APERTO (in parte) | «fonds propres» e «comptabilisé:» non compaiono più. Resta «De sa poche» nel modulo e in Échéances, contro «de votre poche» in Dashboard (`fr3`, `fr4`) |
| N9-1 In «Tutti» compaiono i movimenti di tutto l'ente, ed è lento | CHIUSO | «Tutti» mostra 367 movimenti; non ci sono più Banca Italia né MOV-2026-003. Si carica in 2,7–3,3 s, prima 6–13 s (`tutti.png`). Si vedono però Spese generali e Mvola; non so se rientrano nei progetti assegnati (impressione) |
| N-2 La data «di oggi» è quella UTC | APERTO (in parte, ora P3) | Ho simulato le 01:30 del 22/11 in Madagascar. «Data operazione» e la data della conta propongono il 22/11 (corretto). «Quando servono» della richiesta di anticipo propone il 21/11. Le date calcolate dal server (Scadenze, «oggi» in Dashboard) non sono verificabili qui (`tz.mjs`) |

Chiusi anche, verificati di passaggio:
- N-7: la casella «Differenza grande» ora è grande (`conta1.png`).
- N9-4: lo storico delle conte sta nei 375 px (`conta4.png`).
- N9-7: l'aiuto mostra subito il testo, senza «…».
- N-3: la Dashboard dice «Anticipo autorizzato: ritira 50.000 MGA».

## B. Compiti fissi e voti

| Area | Giro prec. | Voto | Cosa funziona | Cosa impedisce il 10 |
|---|---|---|---|---|
| Facilità complessiva | 9 | **9** | Dashboard chiara: un solo pulsante principale, quattro riquadri, «Da fare» con azioni precise (anticipo da ritirare, autocertificazioni, ricevute entro il…) | Q5, N-2 (residuo) |
| Registrare una spesa | 7 | **8,5** | Spesa in contanti MGA con foto: ritaglio, «Usa», anteprima. Il modulo parte da «Anticipo» e mostra «dopo questa spesa: 20.000 MGA». La ricerca trova «riso» e «pane» → 307, «taxi» → 202; con una parola senza risultati compare un messaggio chiaro con un suggerimento. Registrazione in 3,8 s con «Movimento registrato: MOV-2026-007» (`sp6_done.png`) | Q1: con un solo risultato il codice non viene scelto, e «Registra» risponde «mancano: codice contabile» (un'esitazione reale). Resta O4 |
| Capire gli stati | 9 | **9** | Le stesse parole («Bozza», «Da verificare», «Verificato», «Da rimborsare») in Dashboard, elenco, scheda, filtro Stato e aiuto (`help_dash.png`, `filt`) | Q7 (solo a 1440 px) |
| Errori e recupero | 8 | **9** | Campi mancanti: messaggio «Per registrare mancano: …» e l'errore sotto il campo. Bozza incompleta: stesso comportamento. Segnalazione d'errore: obbligatoria, confermata e visibile nella scheda e in Dashboard. Conta da 20,5 milioni di MGA: casella da spuntare e nota obbligatoria (`segn_done.png`, `conta4.png`) | Q2, Q3 |
| Aiuto in pagina e Guida | 9 | **9** | Aiuti brevi (36–118 parole), scritti per l'operatore e coerenti con lo schermo | Q4, Q5 (contato in Facilità) |
| Francese | 9 | **9** | Dashboard, modulo, suggerimenti, ricerca e PDF tradotti; nessun testo che deborda (`fr_dash.png`). Lingua riportata in italiano alla fine | N9-5 e N-6 (residui) |
| Velocità percepita | 8 | **8,5** | Visite successive: circa 2,0–2,3 s per pagina, misurate con un'attesa fissa di circa 0,9 s compresa. Registrazione in 3,8 s. «Tutti» in circa 3 s (prima 6–13 s). Il pulsante si disattiva e mostra «Salvataggio…» | Con rete lenta e telefono vero: non verificato |
| **Complessivo** | **8** | **8,5** | Nessun P0, P1 o P2 trovato | Circa nove P3 sparsi: secondo la scala, il 9 ne ammette al massimo due per area |

Nessuna area è scesa rispetto al giro precedente.

## C. Difetti nuovi

| Id | Gravità | Area | Dove | Descrizione | Prova | Correzione |
|---|---|---|---|---|---|---|
| Q1 | P3 | Registrare | /nuovo, ricerca del codice | Con un solo risultato («riso» → 307) il codice non viene scelto. L'elenco sotto mostra «1 codice trovato», che sembra una scelta già fatta. «Registra» risponde «Per registrare mancano: codice contabile» | `sp5_err.png` | Con un solo risultato sceglierlo da solo, evidenziando il pulsante. In alternativa scrivere «Tocca il codice qui sopra» al posto di «1 codice trovato» |
| Q2 | P3 | Errori | /nuovo, «Salva da rimborsare» senza motivo | La casella «Il giustificativo non c'è» è spuntata, eppure il messaggio dice «Per registrare mancano: giustificativo». In realtà manca il motivo, e il pulsante premuto era «Salva da rimborsare», non «Registra» | `o2_err.png` | Scrivere «Manca: perché manca il giustificativo» e usare un verbo neutro («Per salvare manca…») |
| Q3 | P3 | Errori | Scheda dopo «Salva da rimborsare» | Con «prepara l'autocertificazione» spuntata, la scheda si apre in cima: nell'indirizzo manca `aut=1` e la pagina non scorre (scrollY 0). La conferma non nomina il modulo. Con «Registra» invece la pagina scende fino al modulo (scrollY 1066). Aiuto e Guida promettono che «si apre il modulo» | `o2.mjs`, `aut.mjs` | Fare come con «Registra»: aggiungere `aut=1`, scorrere fino al modulo e scrivere nella conferma «Ora prepara l'autocertificazione qui sotto» |
| Q4 | P3 | Aiuto/Guida | /rimborsi (operatore) · 375 | L'aiuto dice «le spese che hai pagato di tasca tua», ma la pagina mostra riquadri da amministratore: «Rimborsi da effettuare»; «Da documentare 0» con la barra verde piena e tre righe contraddittorie («con documento 0 · da documentare 0 · 0 con documento, 1 con motivo dichiarato»). Il titolo «Rimborsato a te nel 2…» è tagliato | `rimb__1.png` | Per l'operatore: un riquadro «Da rimborsare a te» con l'elenco delle sue spese, senza «Da documentare»; titolo breve («Rimborsato nel 2026») |
| Q5 | P3 | Facilità | Dashboard, /anticipi, aiuto, Guida | La stessa cosa ha due nomi: «Contanti in mano» in Dashboard e nell'aiuto di Anticipi, «Contanti che ho in mano» in /anticipi e nella Guida. In /anticipi c'è solo l'importo in MGA, mentre la Dashboard mette in grande gli euro | `ant__1.png`, `help2` | Usare ovunque «Contanti in mano» e lo stesso formato (€ in grande, MGA piccolo) |
| Q7 | P3 | Capire gli stati | /movimenti · 1440 | La spesa «Da rimborsare» porta sotto la data la scritta «bozza» al posto del numero, mentre il suo stato è «Da rimborsare» | `mov1440__1.png` | Sotto la data: «da rimborsare», oppure niente |

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

1. **Q1** (Registrare): con un solo risultato scegliere il codice da solo e togliere «1 codice trovato». È l'unica esitazione rimasta nel compito principale.
2. **O4** (Registrare): quando si cambia modo di pagamento, svuotare il progetto preso dall'anticipo o avvisare «Progetto preso dall'anticipo: controllalo». Allineare la Guida («va scelto ogni volta»).
3. **Q3 + Q2** (Errori): con «Salva da rimborsare» portare al modulo dell'autocertificazione; messaggio di errore preciso sul motivo mancante.
4. **Velocità**: verificare su un telefono vero con rete lenta (3G). Ridurre il tempo di registrazione, oggi 3,8 s: conferma subito mentre il server salva, e precaricamento della scheda.
5. **Q5, Q4** (Facilità e Aiuto): un solo nome per «Contanti in mano»; /rimborsi semplificata per l'operatore.
6. **N9-5, N-6** (Francese): «de votre poche» ovunque; tradurre «Spese generali» (Frais généraux) e «Presidente» (Président) nel PDF.
7. **N-2** (residuo): data di «Quando servono» presa dall'ora locale; controllare con il server le date di Scadenze e Dashboard tra le 00:00 e le 03:00.
8. **Q7**: etichetta corretta sotto la data a 1440 px.

## Riepilogo dei voti

| Area | Voto |
|---|---|
| Facilità complessiva | 9 |
| Registrare una spesa | 8,5 |
| Capire gli stati | 9 |
| Errori e recupero | 9 |
| Aiuto in pagina e Guida | 9 |
| Francese | 9 |
| Velocità percepita | 8,5 |
| **Complessivo** | **8,5** |
