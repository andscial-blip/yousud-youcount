# YouCount: revisione dell'operatore, sedicesimo giro (21/11/2026, 375 px)

Prove in `/tmp/yc-final/work/op/` (schermate `.png`, testi `.txt`, registri `.log`).
Dati di partenza: l'operatore non aveva movimenti (dati ricaricati dopo un riavvio). Ho registrato MOV-2026-006 (riso, 45.000 MGA, con foto), una bozza da 12.000 MGA, una spesa di tasca propria (taxi, 30.000 MGA, senza giustificativo) e due conte di cassa di prova. Alla fine l'operatore è di nuovo in italiano: l'intestazione mostra «FR» (`it.mjs`).

## A. Riverifica dei difetti precedenti

| Id | Esito | Prova |
|---|---|---|
| S1 «in attesa di verifica» in /movimenti | CHIUSO | La riga di riepilogo dice «1 movimento · 1 da verificare»; in «Tutti» dice «365 movimenti · 18 da verificare» (`t2__movimenti.txt`, `t__movimenti_mie_0.txt`) |
| S2 Frase sgrammaticata nella Guida | CHIUSO | Ora dice «se resta un solo codice, toccalo per sceglierlo» (`guida_full_operatore.txt`, riga 75) |
| S3 Didascalie doppie in /rimborsi | CHIUSO | Una sola didascalia per riquadro: «nessuna spesa da rimborsarti», «nessun rimborso quest'anno» (`t__rimborsi.txt`) |
| S4 «Spese generali» non tradotto in FR | CHIUSO | «Frais généraux» nel menu, nel suggerimento, nell'elenco e nella scheda (`fr__nuovo.txt`, `fr__movimenti*.txt`) |
| S5 «Mostra 1 movimenti»; anticipo altrui nel filtro | CHIUSO | Il pulsante dice «Mostra 1 movimento». «Conto o cassa» contiene solo BNI, Cassa e Mvola (`s2.log`) |
| S6 Fumetto nativo su «Segnala» con campo vuoto | CHIUSO | Sotto il campo compare in rosso «Campo obbligatorio», nello stile dell'app (`seg_vuoto.png`) |
| R6 Guida: conto, «+ Nuovo movimento», «Rimborsato a te» | CHIUSO | Guida righe 79–81: «l'operatore trova in Dashboard «Registra una spesa»», «In «Come è stata pagata» indica chi ha pagato». Riga 20: «Rimborsato nel» anno in corso |
| N-2 Data UTC tra le 00:00 e le 03:00 | non verificabile ora | La prova è stata fatta alle 14:50–15:15 di Antananarivo |

Ho riprovato anche altri difetti, tutti chiusi:
- R1: con una parola senza risultati il messaggio è chiaro e rimanda all'elenco completo (`reg.mjs`).
- R4: Scadenze mostra «Rimborso che ti spetta» (`scad2.txt`).
- R5: dopo la segnalazione restano solo il riepilogo e «Aggiungi un dettaglio» (`seg_ok.png`).
- O2/Q3: «Salva da rimborsare» con l'autocertificazione spuntata apre `?aut=1` e scende al modulo (scrollY 974).
- Q2: il messaggio dice «mancano: perché manca il giustificativo».
- N-7: la casella di conferma è di 22 × 22 px e si spunta toccando anche il testo.
- H19: in Dashboard «Da verificare» ha l'orologio.

## B. Compiti e voti

Come ho svolto i compiti:
- **Dashboard.** È chiara: un solo pulsante principale, quattro riquadri e «Da fare» con autocertificazione, errore segnalato e bozza, ciascuno con la sua spiegazione (`h__.png`).
- **Spesa in contanti MGA con foto.** Ho scattato la foto, ritagliato e toccato «Usa»: compare «scontrino.png caricato». Descrizione e importo danno «Hai scritto: 45.000 MGA · Controvalore: 8,43 €». Ho cercato il codice con «riso» → 307, «taxi» → 202, «pane» → 307; per «zzzqx» compare un messaggio con suggerimenti. Il progetto si sceglie a parte. «Registra» porta a «Movimento registrato: MOV-2026-006» in 4,9 s (`reg4.log`, `scheda1.png`).
- **Stati.** In Dashboard, nell'elenco, nel filtro Stato e nell'aiuto si usano le stesse quattro parole: Bozza, Da verificare, Verificato, Da rimborsare. L'unica eccezione è T2 in Scadenze.
- **Errori.**
  - «Registra» con il modulo vuoto: «Campo obbligatorio» accanto a ogni campo (`vuoto.png`).
  - Bozza con il solo importo: si salva.
  - Quella bozza, registrata da «Modifica»: «Per registrare mancano: codice contabile, progetto, descrizione, giustificativo».
  - Conta di cassa con differenza grande: chiede di contare di nuovo, la conferma è obbligatoria e anche la nota; poi compare «Conta registrata.» (`conta1.png`, `conta5.png`).
- **Francese.** Tutte le pagine provate sono tradotte, compreso «Code suggéré : 307» per «Riz pour la cantine» (`fr.log`).
- **Velocità** (visite successive alla prima). Le pagine ricaricate da capo si aprono in circa 2,0–2,4 s. La navigazione interna richiede 0,05–0,85 s (`nav.mjs`). Due volte /rimborsi ha impiegato 16,6 s, subito dopo un riavvio del server; poi si apriva in 2,0 s. Lo considero la compilazione della copia di sviluppo, non un difetto.

| Area | Giro prec. | Voto | Motivo |
|---|---|---|---|
| Facilità complessiva | 9 | **9** | 1 P3 (T4) |
| Registrare una spesa | 9,5 | **9,5** | Fluida; 1 P3 (T3) |
| Capire gli stati | 9 | **9** | 1 P3 (T2) |
| Errori e recupero | 9 | **9,5** | Nessun difetto aperto; messaggi nello stile dell'app ovunque |
| Aiuto in pagina e Guida | 9 | **9** | Aiuto in pagina corretto per il ruolo, senza «…» all'apertura; 1 P3 nella Guida (T1) |
| Francese | 9 | **9,5** | Nessun difetto trovato; S4 chiuso |
| Velocità percepita | 9 | **9** | Circa 2 s a pagina intera, meno di 1 s tra le schede; picco isolato dopo il riavvio |
| **Complessivo** | 8 | **8** | Nessun P0, P1 o P2, ma 4 P3 aperti (T1–T4): sono più di due, quindi non arriva a 9 |

Nessuna area è più bassa del giro precedente.

## C. Difetti nuovi

| Id | Grav. | Area | Dove | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| T1 | P3 | Guida | /guida, capitoli «Spese da rimborsare» e «Conti e cassa» · 375 | Descrivono la schermata dell'amministratore: «quattro riquadri: quanto dobbiamo in tutto (la barra mostra a chi)… quante spese non hanno ancora il giustificativo», «una riga per persona: «Rimborsa»…», «liquidità totale…, totale dei conti in Italia e in Madagascar». L'operatore vede tre riquadri, solo il Madagascar e nessun «Rimborsa». Prova: `guida_full_operatore.txt` righe 156–158 e 166–168, contro `h__rimborsi.txt` e `conti2.txt` | Per il ruolo operatore mostrare solo il paragrafo per l'operatore, che esiste già («Se hai chiesto o ricevuto un anticipo…»), oppure mettere quello dell'amministratore sotto «Per i responsabili» |
| T2 | P3 | Stati | /scadenze · 375 | La stessa bozza si chiama «Bozze da completare: 1» in Dashboard e «Movimenti da completare: 1 · Documenti» in Scadenze. Anche le categorie «Documenti», «Pagamento» e «Interna» sono parole da amministratore. Prova: `scad2.txt`, `h__.txt` | In Scadenze: «Bozze da completare», con la stessa riga d'aiuto della Dashboard; per l'operatore, niente categoria prima del punto |
| T3 | P3 | Registrare | Scheda di una bozza senza giustificativo | La scheda dice solo «Giustificativi · Nessun dato.»: non spiega che manca lo scontrino né come aggiungerlo (bisogna passare da «Modifica»). Prova: `bozza.png`, `bz.log` | «Nessun giustificativo: tocca «Modifica» per fotografarlo», oppure un pulsante «Aggiungi foto» direttamente nella scheda |
| T4 | P3 | Facilità | /rimborsi (operatore) · 375 IT e FR | Il riquadro «Da rimborsare a te» ha la barra «a chi» con una sola persona («Operatore · 1 spesa»). Sotto, la riga «OP Operatore Prova · 1 spesa del 21/11» è il resto della vista per persone dell'amministratore e ripete il riquadro. Prova: `fr__rimborsi_top.png`, `h__rimborsi.txt` | Per l'operatore: niente barra per persona; sotto, l'elenco delle sue spese (descrizione, data, importo) al posto della riga con il proprio nome |

Da verificare fuori da questa copia (non contato): nella scheda di MOV-2026-006 l'anteprima del giustificativo è un'immagine rotta, che mostra il testo alternativo in blu sottolineato (`scheda1.png`). Il file è servito come `multipart/form-data` dallo storage locale (`token=locale`), quindi è probabilmente un difetto della copia di sviluppo. «Apri» porta al PDF. Va controllato in produzione: se succede anche lì, è un P2.

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

Tutte le aree sono già ad almeno 9. Per portare anche il complessivo a 9 bastano due P3 aperti al massimo, quindi conviene chiuderne almeno due, in quest'ordine di effetto:

1. **T1**: Guida filtrata per ruolo nei capitoli Rimborsi e Conti. È quello che confonde di più chi legge la Guida.
2. **T2**: in Scadenze «Bozze da completare», senza categorie da amministratore.
3. **T4**: /rimborsi dell'operatore con l'elenco delle proprie spese al posto della barra e della riga per persona.
4. **T3**: nella scheda della bozza, un messaggio che dice come aggiungere il giustificativo.
5. Controllare l'anteprima del giustificativo in produzione.
6. Rifare la prova di N-2 tra le 00:00 e le 03:00 di Antananarivo.
