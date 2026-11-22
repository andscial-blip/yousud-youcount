# YouCount, 18° giro: Grafica, colori e design

Schermate e misure in `/tmp/yc-final/work/gr`. Nota di metodo: durante il giro il server si è riavviato più volte e ha ricaricato i dati. Gli id di progetti e movimenti sono cambiati, quindi i percorsi con l'id vecchio davano «Pagina non trovata». Ho ripetuto le misure con gli id nuovi (`progids.txt`, `projshot.mjs`).

## Prova di allineamento

**audit.mjs** (`audit_*.txt`, esclusi i giorni vuoti di Scadenze):

| Larghezza · ruolo | Segnalato | Esito a vista |
|---|---|---|
| 1440 super_admin | nulla (i progetti avevano l'id vecchio) | ripetuto con gli id nuovi: vuoti in fondo a «Voci di spesa» di 95, 187 e 141 px (Bonne Semence, StreetFood, Sport) → **N8** |
| 768 super_admin | Dashboard «Entrate e uscite», vuoto di 56 px | margine sopra il grafico, non è un difetto (`t7_home_p1.png`) |
| 375 super_admin | Analisi › Budget, vuoto di 68 px | non è un vuoto: è una barra delle entrate alta 38 px → **N9** |
| 1440 admin_fr | «Évolution mensuelle 2026», 98 px in fondo | confermato; anche «Postes de dépense» con 155 e 109 px → **N8** |
| 1440 operatore | «Filtri» in Documenti emessi, 62 px | stato vuoto centrato, accettabile (`o14_documenti_emessi.png`) |

**Mio script `cols.mjs`**: misura le colonne affiancate anche quando le schede stanno in griglie diverse, cosa che audit.mjs non vede.
- Dashboard 1440: differenza di 337 px in IT, 300 px in FR e circa 359 px per l'operatore → **G16**.
- Tutte le 7 schede progetto a 1440, IT e FR: differenza di 429–485 px → **N7**.
- A 768 nessuna differenza.

## A) Riverifica dei difetti aperti

| Id | Esito | Prova |
|---|---|---|
| M5 Correggi/Storna | **CHIUSO** | Ora stanno entrambi nella scheda «Correzioni», con la stessa larghezza e un passo regolare. Anche «Nota di rimborso» è a tutta larghezza (`s14_movimenti_0779…png`) |
| M7c titolo troncato | **CHIUSO** | Il titolo va a capo su 3 righe senza puntini (`s14_finanziamenti.png`). Anche M7a e M7b risultano risolti: al posto del grafico c'è un messaggio, e i tre KPI vuoti hanno la stessa traccia |
| M9 «%» a capo in modo incoerente | **APERTO** (P3) | A 375 «E1 · Donazioni e quote / 49 %» e «uscite coperte 97 %» si comportano diversamente (`m3_prev_top.png`). In FR: «recettes – dépenses / 24 %» contro «année écoulée 89 %» (`f3_an_p1.png`) |
| M10 rientri di «Ultimi movimenti» a 375 | **APERTO, attenuato** (P3) | Le righe partono a x 35 contro il titolo a x 31. A destra gli importi arrivano a x 350 contro «tutti →» a x 344 (`m3_streetfood_p2.png`). A 768 lo scarto è di 6 px (`t7_streetfood_p2.png`) |
| L8 colori dei gruppi | **APERTO, attenuato** (P3) | Gruppo 01 #F4E3A1 contro il giallo delle uscite #E8BE5A: ΔE00 da 5,0 a 11,5, quindi risolto. Gruppo 05 #E6CFE0 contro Spese generali #FFB0BB resta a 14,1. Nuova coppia vicina: gruppo 03 #F5B86B contro le uscite, ΔE00 7,7 (`col.py` su `s14_home.png`) |
| L9 parole sole a capo | **CHIUSO** | «BNI Madagascar (banca)» sta su una riga; «42 righe · / 4 gruppi di voci» va a capo al punto (`m3_conti_p1.png`, `m3_prev_top.png`) |
| J6 colori dei progetti contro Madagascar | **APERTO, parziale** (P3) | Sport ora è pesca #F0C2A0, quindi il conflitto lilla/viola non c'è più. Piccolino #BE8088 contro il corallo d'allarme #E2917F resta a ΔE00 12,4, nella stessa Dashboard |
| G16 vuoti in Dashboard | **APERTO, peggiorato in gravità** (ora P2) | La «Note» non è più stirata, però la terza colonna finisce 337 px prima delle altre due (Dashboard 1440 IT; FR 300 px; operatore 359 px) e lascia un'area vuota in basso a destra (`s14_home.png`, `o14_home.png`, `cols_1440.txt`) |
| N1 titolo sotto la «i» | **APERTO** (P3) | «Association et documents»: il testo finisce a x 329, il pulsante comincia a x 323 (`ov.mjs`, `f3_imp_top.png`). Le altre 7 pagine di Impostazioni rientrano |
| N2 parole spezzate in Soglie ETS | **CHIUSO** | «c.2‑bis» e «100.000 €» restano interi (`m3_scadenze_p4.png`) |
| N3 numero o segno staccato | **APERTO, in altre pagine** (P3) | Rimborsi e la legenda E2 sono risolti. Restano: «Bilancio sociale (oltre 1 / milione» (`m3_scadenze_p4`); «usa «+ / Nuova richiesta»» (`o3_anticipi.png`); «· / École Piccolino» nella scheda del finanziamento (`s14_finanziamenti.png`); «ott» da solo (`m3_streetfood_p2`) |
| N4 fondi sfalsati | **CHIUSO** nei punti segnalati | Dashboard 768, Analisi › Entrate e Progetti ora finiscono alla stessa altezza (`t7_home_p1`, `s14_analisi_vista_entrate`, `s14_analisi_vista_progetti`). Il problema resta altrove → N7, N8 |
| N5 mesi alterni | **CHIUSO** | Cambi mostra Jan, Mar … Nov, come Analisi (`f3_cambi_p1.png`) |
| N6 KPI vuoti in stili diversi | **CHIUSO** | «In attesa da –» ha la traccia, come le altre (`o3_rimborsi.png`) |

## B) Voti

| Area | 17° giro | 18° giro | Motivo |
|---|---|---|---|
| Scelta delle tinte | 9,5 | **9,5** | Nessun corsivo e nessuna tinta marrone in 31 pagine controllate, IT 375 e FR 1440 (`scan.mjs`). Palette tenue coerente |
| Stesso significato, stesso colore | 9 | **9** | Due P3: L8 e J6 residuo |
| Coerenza tra pagine, ruoli e lingue | 9 | **9** | IT, FR e operatore danno lo stesso quadro. I difetti specifici sono contati in Impaginazione |
| Accessibilità del colore | 9,5 | **9,5** | Nessun difetto nuovo; non ho rimisurato a tappeto i contrasti |
| Grafici | 9,5 | **7** | Due P2: N8 e N9. È un calo con prova: N9 non era mai stato segnalato e non so se fosse già presente; N8 è l'effetto della nuova altezza uguale delle righe |
| Bellezza e design complessivo | 9 | **9** | Impressione d'insieme curata e piatta. Le cadute stanno nelle righe di Impaginazione e Grafici |
| Impaginazione e tipografia | 8,5 | **7** | Due P2 (G16, N7) e P3 (M9, M10, N1, N3, N10). Calo dovuto alla regola del 18° giro (ogni vuoto visibile vale almeno P2) e a N7, che lo script non vedeva |

## C) Difetti nuovi

| Id | Gr. | Area | Pagina · larghezza | Descrizione | Prova | Correzione |
|---|---|---|---|---|---|---|
| N7 | **P2** | Impaginazione | Scheda progetto · 1440, IT e FR, tutti i 7 progetti | In fondo, «Ultimi movimenti» (circa 800 px) sta accanto a Scadenze, Documenti emessi e Finanziamenti (circa 370 px): la colonna destra finisce 429–485 px prima e lascia un grande vuoto. | `cols_1440.txt`, `s14_progetti_f438…png`, `f14_progetti_b6f8…png` | Mettere le tre schede brevi in una riga da 3 colonne sopra, e «Ultimi movimenti» a tutta larghezza sotto. |
| N8 | **P2** | Grafici | Scheda progetto · 1440 IT e FR | La riga «Andamento mensile» + «Voci di spesa» ha altezza uguale, ma non c'è contenuto che riempia: con poche voci rimangono 95–187 px vuoti in fondo a «Voci di spesa» (IT StreetFood 187, Sport 141, Bonne Semence 95; FR 155 e 109). Con le etichette lunghe del francese il vuoto passa sotto il grafico (98 px in Frais généraux e Piccolino) | audit con gli id nuovi; `crop_fr_streetfood.png` | Il grafico prende l'altezza della riga (`flex: 1` sull'SVG). Con meno di 6 voci, «Voci di spesa» va sotto a tutta larghezza, oppure il grafico occupa tutta la riga |
| N9 | **P2** | Grafici | Analisi › Previsto e speso · 1440 e 375 | Nella tabella per codice le barre delle **entrate** (E101–E401) sono blocchi alti circa 38 px con bordo. Quelle delle uscite, sopra, sono alte 8 px. Le righe passano da 42 a 61 px | `s14_analisi_vista_budget_p3.png`, `b375_gap.png` contro `m3_analisi_vista_budget_p4.png` | Stessa barra di 8 px con la tacca per entrate e uscite |
| N10 | P3 | Impaginazione | /nuovo · 375 | Il selettore Uscita, Entrata e Giroconto ha segmenti di 99, 106 e 120 px | `btn.mjs`, `m3_nuovo__1.png` | `grid-template-columns: repeat(3, 1fr)` |

Senza difetti: pulsanti affiancati uguali in 27 pagine (`btn.mjs`); niente corsivo, sillabazione o testo fuori pagina (`scan.mjs`).

## D) Ordine di intervento

1. **N7 e G16**: colonne della scheda progetto e della Dashboard a 1440 (la terza colonna è troppo corta: spostare «Note» a tutta larghezza sotto, oppure bilanciare le colonne). Sono i vuoti più grandi, quelli che il committente vede subito.
2. **N8**: grafico che riempie la riga, oppure «Voci di spesa» sotto quando le voci sono poche.
3. **N9**: barre delle entrate in Previsto e speso.
4. **N1, M9 e N3**: spazi non separabili e una regola unica per il «%».
5. **M10, N10, L8 e J6**: rifiniture.
