# YouCount · 19° giro · Grafica, colori e design

Le prove sono in /tmp/yc-final/work/gr: schermate a pagina intera `a_` (1440 IT), `t_` (768), `m_` (375 IT), `F_`/`f_` (FR 1440/375), `o_`/`p_` (operatore 1440/375). Script: snap.mjs, coll.mjs, m1.mjs, col.mjs.

## Prova di allineamento (audit.mjs)
| Esecuzione | Esito |
|---|---|
| 1440 super_admin | Segnala solo il calendario di Scadenze, che non conta |
| 768 super_admin | Dashboard «Entrate e uscite»: vuoto di 56 px, al limite della soglia. A occhio è accettabile (`t___p0`) |
| 375 super_admin | Nessuna segnalazione |
| 1440 admin_fr | Scheda progetto (Frais généraux), «Évolution mensuelle»: vuoto interno di **74 px**, vedi N8 |
| 1440 operatore | 1ª esecuzione: Dashboard, **COLONNE 352 px** («Le mie ultime spese» / «Da fare»), vedi Q3. 2ª esecuzione: /documenti-emessi «Filtri» 62 px, falso positivo a vista |

## A) Riverifica dei difetti aperti
| Id | Esito | Prova |
|---|---|---|
| G16 Grandi vuoti (Dashboard, scheda progetto) | **CHIUSO** | Le Note ora sono un quaderno a righe che riempie la colonna. Nella scheda progetto le tre schede brevi stanno in una riga (`a__.png`, `a__progetti_13f5…`) |
| N7 «Ultimi movimenti» accanto a schede brevi | **CHIUSO** | Scadenze, Documenti emessi e Finanziamenti stanno in una riga da 3 schede di uguale altezza; «Ultimi movimenti» è a tutta larghezza (`a__progetti_ca2a…`, `a__progetti_13f5…`) |
| N8 Vuoto in «Voci di spesa» / «Andamento» | **APERTO, attenuato (solo FR)** | In IT le righe si distribuiscono e non lasciano vuoti, anche con 4 voci (StreetFood). In FR, su Frais généraux, il grafico resta centrato in una scheda più alta: circa 60 px vuoti sopra e 65 px sotto la legenda (audit 74 px; `crop_F_proj0.png`) |
| N9 Barre delle entrate a blocchi | **CHIUSO** | E101–E401 hanno la stessa barra sottile con tacca delle uscite e righe di altezza uguale (`crop_budget_e.png`) |
| N10 Selettore Uscita/Entrata/Giroconto | **CHIUSO a 375, residuo a 1440** | A 375 i segmenti sono 108/108/108 px (seg.mjs). A 1440 sono 93/99/113 px, mentre «Come è stata pagata», nella stessa pagina, ha segmenti uguali (`crop_nuovo1440.png`) |
| M9 «24 %» a capo; «4 / gruppi» | **CHIUSO** | In FR a 375 «Excédent» tiene «24 %» in riga (`crop_fr_ana.png`). In Preventivo la riga va a capo dopo «·» e non a metà (`m__preventivo_p0`) |
| M10 Rientri in «Ultimi movimenti» a 375 | **CHIUSO** | Titolo e righe partono dallo stesso bordo (`m__progetti_13f5…_p1`) |
| N1 Titolo FR sotto la «i» | **CHIUSO** | «Association et documents» rientra e non tocca la «i» (`crop_fr_imp.png`) |
| N3 Numero staccato dalla sua parola | **APERTO, parziale** | Il caso di Rimborsi 1440 è risolto («1 con / motivo»). Resta «(2 / persone)» in «Ultimi movimenti» a 375 (`m__progetti_13f5…_p1`) |
| L8 Gruppi 01/05 vicini ad altri colori | **CHIUSO** | Gruppo 01 #F4E3A1 contro il giallo Uscite #E8BE5A: ΔE00 da 5,0 a 11,5. Gruppo 05 contro Spese generali: 14,1, sufficiente |
| J6 Progetti con colori di altri significati | **APERTO, attenuato** | Sport ora è pesca #F0C2A0 (non più lilla). Restano Piccolino #BE8088 contro il corallo d'allarme #E2917F (ΔE00 12,4), proprio il progetto sforato al 128 %, e il gruppo 03 #D2B9FF contro il Madagascar #A596E6 (10,7) nella stessa colonna della Dashboard |

## B) Voti
| Area | 18° | 19° | Motivo |
|---|---|---|---|
| Scelta delle tinte | 9,5 | **9,5** | Palette tenue e coerente, niente marrone né corsivo (snap: nessun CORSIVO). Il logo saturo resta |
| Stesso significato, stesso colore | 9 | **9** | Restano due P3: J6 e Q8 |
| Coerenza tra pagine, ruoli e lingue | 9 | **9** | IT e FR uguali; un P3 (Q7). L'operatore in FR non è verificato: non ho cambiato la sua lingua per non disturbare l'altro revisore |
| Accessibilità del colore | 9,5 | **9,5** | Nessun difetto nuovo. Le barre chiare sulla traccia restano deboli (Sport 1,49) ma sono affiancate da numeri |
| Grafici | 7 | **7** | Tre P2 chiusi (N7, N9, G16). Restano due P2: N8 (FR) e Q1, più il P3 Q6 |
| Bellezza e design complessivo | 9 | **9** | Un P3 (Q9) |
| Impaginazione e tipografia | 7 | **7** | Due P2 nuovi (Q2, Q3) e i P3 Q4, Q5, N3, N10 (1440) |


## C) Difetti nuovi
| Id | Gr. | Area | Pagina · larghezza | Descrizione | Prova | Correzione |
|---|---|---|---|---|---|---|
| Q1 | **P2** | Grafici | Analisi › Panoramica · 1440 IT | Le due ciambelle affiancate non sono allineate. La SVG di sinistra va da y 908 a 1118, quella di destra da 928 a 1138: 20 px di differenza. Le legende cominciano a y 1138 e 1179 (41 px) e finiscono a 1314 e 1293. La sinistra è allineata in alto, la destra centrata | m1.mjs, `a__analisi_anno_2026_vista_panoramica.png` | Stessa regola nelle due schede: ciambella in alto e legenda subito sotto, oppure entrambe centrate. Legende che partono alla stessa y |
| Q2 | **P2** | Impaginazione | Conti › Anticipi e Saldi, KPI «Anticipi in corso/aperti» · 375 IT e FR | Il nome della persona tocca «1 persona» (distanza −0,4 px) e in FR copre «1 personne» per 7 px: si legge «Fanomezantso1 personne» | coll.mjs, `crop_fr_ant.png`, `m__anticipi_p0.png` | Nome con puntini e `min-width: 0`, «1 persona» con `flex-shrink: 0` e almeno 8 px di distanza. In alternativa il nome su una riga propria |
| Q3 | **P2** | Impaginazione | Dashboard operatore · 1440 (operatore senza spese) | «Le mie ultime spese» è alta 109 px; accanto, «Da fare» e «Note» arrivano a 468 px. Sotto la scheda di sinistra restano circa 352 px vuoti. | audit (COLONNE 352 px), `o__.png` | Mettere «Note» sotto «Le mie ultime spese» nella colonna sinistra, oppure «Le mie ultime spese» a tutta larghezza |
| Q4 | P3 | Impaginazione | Scheda progetto «Previsto e speso per codice» · 375 | «modifica nel Preventivo →» va su due righe, centrato sotto il titolo, invece di stare a destra come «tutti →» | `m__progetti_13f5…_p0` | Link breve («modifica →») a destra nella riga del titolo, `white-space: nowrap` |
| Q5 | P3 | Tipografia | Rimborsi e Anticipi, KPI · 375 IT e FR | Nelle mini-legende sotto le barre l'etichetta di sinistra va a capo e quella di destra no: «con / documento 0» accanto a «da documentare 0»; «avec / justificatif 0»; «dans les / délais 0». Il risultato è asimmetrico | `m__rimborsi_p0`, `crop_fr_rimb.png`, `crop_fr_ant.png` | Su telefono una riga per voce, oppure etichette brevi («con doc. 0») con `white-space: nowrap` |
| Q6 | P3 | Grafici | Progetti «Previsto e speso» · 1440 | Le barre stanno in una colonna di circa 133 px dentro una scheda di 562 px, con righe stirate a 56 px. Con la scala lineare, 5 barre su 7 sono più corte di 30 px (Sport circa 3 px). | `a__progetti.png` | Barra a tutta larghezza sotto il nome, come già a 768 (`t__progetti_p0`), oppure barra in % del previsto di ogni progetto |
| Q7 | P3 | Coerenza | Conti dell'operatore · 1440 | I due KPI vuoti hanno stili diversi: «Contanti nelle casse» ha la traccia senza riga di legenda, «Anticipi aperti» ha la traccia con «–». Restano circa 40 px vuoti tra la barra e il piede | `o__conti.png` | Stessa struttura (traccia, riga legenda, piede) in entrambi |
| Q8 | P3 | Significato | Dashboard · 1440 | I gruppi 02 #90C39C e 06 #5D9883 hanno ΔE00 9,7 dal verde acqua «Saldo del mese» #5FB8A3 del grafico accanto | col.mjs | Spostare i verdi dei gruppi verso il salvia o il giallo-verde, con ΔE di almeno 15 dal colore del saldo |
| Q9 | P3 | Bellezza | /nuovo · 1440 | Le 6 pastiglie dei codici suggeriti, in una colonna di 340 px, hanno altezze di 46 e 95 px. «205 …» va su 5 righe, e solo «107» ha il numero su una riga propria | `a__nuovo.png` | Pastiglie su 2 colonne con testo su al massimo 2 righe e puntini, oppure a tutta larghezza del modulo |

## D) Ordine di intervento
1. **Q3**: operatore, Dashboard a 1440. «Note» nella colonna sinistra. È il primo schermo dell'utente più fragile.
2. **Q2**: collisione del nome nei KPI Anticipi a 375 (IT e FR).
3. **Q1**: allineare in alto le due ciambelle di Panoramica e i titoli delle loro legende.
4. **N8 (FR)**: il grafico «Évolution mensuelle» prende l'altezza della riga (`flex: 1` sulla SVG).
5. **Q6**: barre di «Previsto e speso» a tutta larghezza, come a 768.
6. P3 in un solo passaggio: Q4, Q5, N3 «(2 persone)» (U+00A0), N10 a 1440 (`repeat(3, 1fr)`), Q7, Q9.
7. Colori: Piccolino lontano dal corallo e gruppo 03 lontano dal lilla del Madagascar (J6); verdi dei gruppi lontani dal colore del saldo (Q8).
