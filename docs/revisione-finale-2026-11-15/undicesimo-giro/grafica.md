# Grafica, colori e design: giro 11

Revisore indipendente. Non ho letto il codice né i rapporti precedenti. Ho usato un solo browser alla volta.
Prove in `/tmp/yc-final/work/g11/`. Per ogni pagina principale ci sono schermate a pagina intera:
- `a_<ruolo>_<larghezza>_<pagina>.png`: super_admin a 375, 768 e 1440; admin_fr a 375;
- `d_…`: operatore e responsabile a 375;
- `c_…`: 1440 dopo il ripopolamento dei dati.

Le misure automatiche sono nei file `a_*.json`, `c_*.json` e `d_*.json`: contrasto testo/fondo, corsivo, testo che esce, parole spezzate, testo tagliato. ΔE è CIEDE2000. Per la deuteranopia ho usato la simulazione di Machado 1.0 (`col.py`).

**Avvertenza.** Alle 05:55 il server è ripartito e ha ripopolato i dati (`watchdog.log`; nel registro attività, creazioni alle 05:55). Con il ripopolamento i colori dei progetti sono cambiati:
- prima: #348983, #CC8990… (`a_super_admin_1440__progetti.png`, 05:50);
- dopo: #CDAEB3, #90757C… (`c_prog2.png`, 05:58).

Dopo il cambio i colori restano stabili tra un caricamento e l'altro. I giudizi sui colori dei progetti valgono per lo stato dopo le 05:55.

**Misure di base.** Su più di 90 caricamenti (4 ruoli, IT/FR, 375/768/1440):
- 0 testi con contrasto sotto 4,5:1. (4 falsi positivi su /scadenze).
- 0 elementi in corsivo.
- 0 debordamenti orizzontali della pagina.
- Il marrone vero, la ruggine #8A3B2C, è sparito.

## A. Riverifica dei difetti precedenti

| Difetto | Stato | Prova |
|---|---|---|
| 6-D1 l'icona colora il tipo | CHIUSO | Ogni progetto ha la sua tinta di fondo (#86B9C7, #FFD7DD…). Prova: `c_adm.png`, `c_prog.png` |
| 6-D3 ciambelle con colori doppi | CHIUSO | In /analisi: progetti a sinistra, scala di blu notte e grigi (E1–E4) a destra, nessun colore in comune. Prova: `c_super_admin_1440__analisi.png` |
| 6-D9 sfumature dei conti | APERTO, parziale | La legenda ora c'è (quadratini in tabella). Banca Italia #8FAFD6 e Satispay #ACC6E6 hanno ΔE 6,6. Il quadratino di Cassa Italia #D6E3F3 ha contrasto 1,30 sul bianco |
| 6-D10 «critica» e «fatta» con la deuteranopia | APERTO | #E2917F e #A8C3A1 hanno ΔE deut 7,7 (normale 36,9) |
| 6-D11 previsto: traccia o barra | APERTO, attenuato | Il previsto è una traccia celeste #C7D9F1 in Budget e Progetti, ma una traccia grigia con tacca nera nella Dashboard «Preventivo» e nella scheda progetto «Preventivo uscite». Prova: `c_pd1.png` |
| 6-D14 logo saturo | APERTO (impressione) | `login.png` |
| 7-2 il previsto cambia colore | APERTO, attenuato | Come 6-D11. In Cambi il blu del previsto non c'è più |
| 7-3 salmone per stati normali | CHIUSO | «Oggi» e «Tra 7 gg» sono pastiglie neutre; «Da verificare» è grigia. Prova: `c_sc2.png`, `crop_mov.png` |
| 7-4 Madagascar e anticipi | CHIUSO | Il Madagascar è sempre nella famiglia lilla e viola (#A596E6, #6E62A8, #D4CCF4); gli anticipi sono sempre ardesia, in Conti e in Anticipi |
| 7-7 progetti poco distinguibili | APERTO | Spese generali #CDAEB3 e Piccolino #FFBAC4: ΔE 10,6, deut 7,4, vicini nella ciambella. Nelle icone ci sono quattro rosa (ΔE 6,8–8,5) e tre verde acqua (ΔE 7,7). Prova: `c_prog2.png`, `projcol.js` |
| 7-11 Report e «Media 2026» | APERTO | Il report «Italia / Madagascar» non usa i colori dei paesi. La barra blu notte del mese corrente non ha spiegazione. Prova: `c_super_admin_1440__report.png`, `c_cambi.png` |
| 8-N1…N6 | non riverificabili uno per uno | In DIFETTI_PRECEDENTI.md manca la descrizione. Le pagine indicate sono coperte dalle righe qui sopra e sotto |
| 9-N1 «Oggi» color ruggine | CHIUSO | Testo grigio-blu su #EEF1F5. Prova: `c_sc2.png` |
| 9-N2 «anticipo da autorizzare» in quattro colori | CHIUSO (amministratore) | Ho creato una richiesta come operatore: striscia blu notte in Dashboard, barra ardesia in /anticipi. Prova: `req_adm.png` |
| 9-N3 gruppo 09 terracotta | APERTO | #E07F4F, a ΔE 10 dal corallo degli sforamenti, nella stessa scheda. Prova: `c_pd1.png` |
| 9-N4 senape #C9A227 | APERTO | 44 % della ciambella del Preventivo. Prova: `c_preventivo.png` |
| 9-N5 gruppo 08 invisibile | APERTO | #FBEFC4: contrasto 1,15 sul bianco e 1,05 sulla traccia. Prova: `c_pd1.png` |
| 9-N6 «Destinato ai progetti» blu notte | CHIUSO | Ora è giallo, il colore delle uscite |
| 9-N7 importo di Fanomezantsoa verde | CHIUSO | Ora è blu notte |
| 9-N8 «Applicato» tratteggiato lilla | CHIUSO | Ora è ardesia |
| 9-N9 previsto e Bonne Semence | APERTO (si è spostato) | Bonne Semence è ora lavanda. Però il previsto #C7D9F1 e Sport & Inclusione #B7D3FE hanno ΔE 5,5 (deut 5,9): la barra di Sport sembra una traccia di previsto |
| Chiusi all'ottavo giro: 6-D2, D4, D5, D6, D7, D8, D12, D13, 7-1, 5, 6, 8, 9, 10, 12 | ancora CHIUSI | Nessuna ricomparsa nelle schermate. Gruppi e progetti non hanno più RGB in comune |

**Conteggio** (le 15 voci confermate chiuse sono a parte):
- CHIUSO: 9
- APERTO: 10
- PEGGIORATO: 0

## B. Voti

| Area | Giro prec. | Giro 11 | Motivo |
|---|---|---|---|
| Scelta delle tinte | 8,5 | **8** | Un P2 (G4: palette dei progetti con talpa #90757C e assegnazione che cambia con i dati) e tre P3 (senape, terracotta, logo). Il difetto c'era già, perché l'assegnazione è automatica, ed è emerso con i nuovi dati: non è un peggioramento del codice |
| Stesso significato, stesso colore | 8 | **8,5** | Nessun P2. Restano P3: il previsto in tre forme; Report senza colori dei paesi; previsto vicino a Sport; gruppi di spesa in toni del giallo delle uscite |
| Coerenza tra pagine, ruoli e lingue | 9 | **8,5** | Nessun P2, ma sei P3 di coerenza visiva (arrotondamenti, ordine € e %, termini, stati vuoti, «+», icone degli stati). C'erano già: li ho visti perché quest'area ora è più ampia |
| Accessibilità del colore | 8 | **8,5** | Tutto il testo arriva ad almeno 4,5:1. Restano P3: 6-D9, 6-D10, 9-N5, rosa con ΔE deut 7,4 |
| Grafici | 8,5 | **8,5** | Nessun P2. I P3 sono più di due: corpi degli assi diversi, «Previsto e speso» senza etichette, tacca nera senza spiegazione, anelli doppi |
| Bellezza e design complessivo (nuova) | – | **8** | Insieme elegante, piatto, tenue, senza corsivo. Un P2 (G2, link blu del browser) e diversi P3 (schede con grandi vuoti, stati vuoti disomogenei) |
| Impaginazione e tipografia (nuova) | – | **7** | Due P2: sillabazione giustificata in Guida (G1) e coppie di pulsanti di larghezza diversa (G3). Più vari P3 a 375 |

## Elenco dei difetti

| # | Gr. | Area | Pagina · larghezza | Difetto e prova | Correzione proposta |
|---|---|---|---|---|---|
| G1 | **P2** | Impaginazione | /guida · tutte, IT e FR | Paragrafi giustificati con sillabazione automatica (hyphens: auto): «milleduecen-/tocinquanta», «re-/gistrare», «movi-/mento». Trovate 30 parole spezzate in una sola pagina. Prova: `guida_open1440.png`, `a_super_admin_1440.json` | `text-align: left; hyphens: manual; overflow-wrap: normal` sui paragrafi della Guida; righe di al massimo 70 caratteri |
| G2 | **P2** | Bellezza | /progetti/<id> «Finanziamenti del progetto» · 1440 | Il link al bando è nel blu predefinito del browser #0000EE, sottolineato: unico elemento fuori palette. Prova: `c_pd2.png`, `blue.js` | Colore #2E3D52, peso 600, sottolineatura di 1 px con distanza di 3 px, come «tutti →» |
| G3 | **P2** | Impaginazione | varie · 375 e 1440 | Coppie di pulsanti affiancati di larghezza diversa. 1440: «Tutti i movimenti» 131 / «Emetti documento» 140; «Excel» 84 / «Stampa / PDF» 113; «Filtri» 81 / «Esporta tutto il 2026» 175; «Apri la bozza» / «Versioni · 2»; «Autorizza» / «Respingi». 375: «Scatta una foto» / «Carica un file» (`m375.png`) ed «Excel» / «Stampa» (`m375b.png`). Prova: `blue.js` | Coppie dello stesso rango in `display: grid; grid-template-columns: 1fr 1fr`. A 1440 larghezza minima comune di 140 px; a 375 i due pulsanti a tutta riga, metà ciascuno |
| G4 | **P2** | Tinte | /, /progetti, /analisi, /admin/progetti · tutte | I colori dei progetti sono cambiati col ripopolamento delle 05:55, quindi non sono fissi per progetto. Il gruppo attuale contiene una talpa grigio-marrone, Ambohitsiroa #90757C (S 11 %, L 51 %; icona #BFAFB3), e due rosa a ΔE 10,6 (Spese generali #CDAEB3, Piccolino #FFBAC4). In Impostazioni non si può scegliere il colore. Prova: `c_prog2.png`, `c_adm.png`, `bars.js` | Tavolozza fissa di 10 pastelli, salvata con il progetto e mai assegnata a caso. Esempio: Spese generali ardesia #A7B3C4; scuole petrolio, acqua e verde acqua chiaro #2F869F, #6FB7C4, #A8DADC; rosa #F2A7B8; pervinca #8D94D6; salvia #93C5A0; lavanda #C8BCDC. Escludere tinte calde con saturazione sotto il 30 %. Tra due progetti, ΔE almeno 15 (deut almeno 10) |
| G5 | P3 | Impaginazione | Movimenti, Conti, Documenti · 375, IT e FR | Etichette delle schede tagliate dal pulsante «i»: «Controparti» visibile 44/71 px, «Tassi di cambio» 87/94, «Taux de change» 68/95, «Comptes rendus» 76/100. Prova: `m375.png`, `tabs.js` | Spostare la «i» nella riga del titolo, oppure dare alle schede `scroll-padding` e mostrare intera l'ultima etichetta |
| G6 | P3 | Grafici | /cambi, /progetti/<id> · 1440 | Etichette degli assi a circa 17 px; in Analisi, Report e Dashboard sono a 12 px. Prova: `c_cambi.png`, `c_pd1.png` | Corpo fisso di 12 px #556275 (`font-size` in px, non in scala con il viewBox) |
| G7 | P3 | Grafici | /progetti «Previsto e speso» · tutte | I due importi a destra non dicono quale sia il previsto e quale lo speso; tra barra e numeri c'è un vuoto di circa 40 px. Prova: `c_prog2.png` | Due colonne con intestazione «Previsto» e «Speso», allineate a destra; barra larga fino alla colonna |
| G8 | P3 | Grafici | /progetti, schede progetto · tutte | La tacca nera sulla ciambella («anno trascorso») non ha spiegazione nella scheda. Prova: `c_prog.png` | Didascalia «tacca = anno trascorso 89 %» sotto la griglia, come nella Dashboard |
| G9 | P3 | Grafici | /preventivo, /analisi, /progetti/<id> · tutte | Anello e barra mostrano lo stesso dato nella stessa scheda («Destinato ai progetti», «Preventivo usato», «Residuo»). Prova: `c_preventivo.png` | Togliere l'anello in alto a destra e tenere la barra |
| G10 | P3 | Coerenza | Dashboard, Conti, Anticipi | Arrotondamenti diversi per lo stesso dato: «9 €» e «8,90 €»; «218 €» e «217,71 €». Prova: `a_super_admin_1440__.png`, `c_super_admin…anticipi` | Stessa regola dappertutto: decimali sotto 1.000 €, interi sopra |
| G11 | P3 | Coerenza | Dashboard e le altre pagine | Ordine invertito: in Dashboard «39 % 68.176 €», altrove «102.754 € 44 %». Prova: `fd_1.png`, `c_preventivo.png` | Sempre importo, poi percentuale grigia |
| G12 | P3 | Coerenza | progetto, Budget, Preventivo | Stessa colonna con tre nomi: «Budget», «Preventivo», «Previsto». Prova: `c_pd1.png`, `c_bud1.png` | «Previsto» ovunque (FR «Prévu») |
| G13 | P3 | Coerenza | Movimenti · tutte | La pastiglia «Da rimborsare» non ha icona; «Da verificare» e «Verificato» sì. Prova: `crop_mov.png` | Aggiungere un'icona (portafoglio) della stessa misura |
| G14 | P3 | Coerenza | progetto «Ultimi movimenti» | «12.500,50 €» senza «+»; nel registro «+8.157,37 €». Prova: `c_pd2.png` | Segno «+» sulle entrate ovunque |
| G15 | P3 | Bellezza | Anticipi e Movimenti dell'operatore · 375 | Stati vuoti diversi tra loro: illustrazione in Movimenti, icona «scarica» (significato sbagliato) in Anticipi. Prova: `op3.png` | Stessa illustrazione del marchio con un pittogramma per pagina |
| G16 | P3 | Bellezza | Dashboard e scheda progetto · 1440 | Grandi vuoti per l'altezza forzata: «Note» circa 440 px vuoti, «Preventivo» circa 90 px, «Documenti emessi» e «Scadenze» nella scheda progetto. Prova: `a_super_admin_1440__.png`, `c_pd2.png` | `align-items: start`, oppure riempire con i contenuti (prossime 3 scadenze); «Note» a tutta larghezza sotto |
| G17 | P3 | Bellezza | /preventivo · 375 | Il pannello «Versioni» si apre circa 200 px sotto il pulsante e copre il grafico. Prova: `ver375b.png` | Ancorarlo sotto il pulsante, oppure aprirlo come foglio dal basso |
| G18 | P3 | Impaginazione | /analisi?vista=budget · 1440 | Nella riga totale «Uscite» il fondo grigio comincia dalla colonna «Previsto»: la riga sembra tagliata. Prova: `c_bud1.png` | Fondo #E3EAF4 su tutta la riga |
| G19 | P3 | Impaginazione | /scadenze · 1440 | Pastiglie «Oggi» e «Tra 24 gg» allineate a destra con bordo sinistro irregolare, poi «Fatta» e «automatica» allineate a sinistra. «1.800.000 MGA» senza euro. Prova: `c_sc2.png` | Colonna a larghezza fissa di 84 px, pastiglie centrate. Importo «337 €» grande con «1.800.000 MGA» piccolo sotto |
| G20 | P3 | Impaginazione | Analisi, Anticipi · 1440 | Schede KPI con piede vuoto accanto a schede con barra e piede: altezze interne diverse. Prova: `c_super_admin_1440__analisi.png`, `c_super_admin…anticipi` | Riga di piede anche in Entrate e Uscite («35 movimenti», «media 15.758 €/mese») |
| G21 | P3 | Impaginazione | /report · 1440; /analisi FR · 375 | Schede del Report su due righe (7 + 2); in FR «Budget et réalisé» va a capo e le altre no. Prova: `c_super_admin_1440__report.png`, `m375b.png` | Menu a tendina «Tipo di report», oppure griglia 3 × 3. In FR «Budget/réalisé» |
| G22 | P3 | Impaginazione | /progetti · 1440 | 8 schede in 3 colonne: l'ultima riga ne ha 2 allineate a sinistra. Prova: `c_prog.png` | 4 colonne a 1440 (2 righe piene), oppure centrare l'ultima riga |
| G23 | P3 | Impaginazione | scheda movimento · 375 | «DEMO-2026-1010» va a capo al trattino («Confermo l'eliminazione di DEMO-»). Prova: `m375.png` | Trattino non separabile (U+2011) anche per i codici DEMO |
| G24 | P3 | Impaginazione | /documenti · 1440 | Segnaposto tagliato: «Nome, numero MOV o c». Prova: `c_doc.png` | Campo largo almeno 280 px, oppure testo «Nome o n. MOV» |
| G25 | P3 | Accessibilità | /progetti · tutte | Sport #B7D3FE contro la traccia #F2F5F9: 1,40; Piccolino 1,47. Prova: `col.py` | Bordo di 1 px più scuro del 25 % sulle barre chiare, oppure tinte con contrasto di almeno 1,8 sulla traccia |
| G26 | P3 | Impaginazione | /admin/progetti · 1440 | Nella riga «Spese generali» l'icona si sposta a sinistra per la pastiglia «Struttura…»: la colonna delle icone non è allineata. Prova: `c_adm.png` | Colonna dell'icona a larghezza fissa a destra; pastiglia prima del nome |

**Non verificato.** I campi data appaiono nel formato «mm/dd/yyyy» e «November 2026» (`c_cambi.png`, `m375.png`). Dipende dalla lingua del browser di prova (inglese): su un telefono in italiano o in francese va controllato.

**Ordine di intervento per arrivare a 9:** G1, G3, G4, G2; previsto unico celeste (6-D11/7-2); gruppi 09 #E07F4F → pervinca #9AA6D8, 05 #C9A227 → giallo burro #EBCB6B, 08 #FBEFC4 → #E9D58F con bordo; poi G5 e G6.
