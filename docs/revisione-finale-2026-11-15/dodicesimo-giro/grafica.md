# YouCount, dodicesimo giro: Grafica, colori e design

Revisore indipendente. App su localhost:3313, 21/11/2026, dalle 07:45 alle 08:20. Ruoli usati: super_admin, admin_fr, responsabile e operatore. Larghezze: 375, 768 e 1440. Schermate e script sono in `/tmp/yc-final/work`. I prefissi dei file indicano la serie: `a_`/`b_`/`c_` 1440 IT · `m_`/`m2_` 375 IT · `t_` 768 · `f_` 375 FR · `g_` 1440 FR · `o_` operatore 375 · `r_` responsabile 1440.
Misure fatte con script: colori campionati dal DOM con `colors.mjs`; ΔE2000 e deuteranopia (Machado) con `col.py`; contrasto del testo con `contrast.mjs`, che non ha trovato **nessun testo sotto 4,5:1** su 23 pagine; corpi delle etichette dei grafici con `svgfs.mjs`; larghezze dei pulsanti con `btnpairs.mjs`.
Nota: il server si è riavviato alle 07:59 e alle 08:11. A ogni riavvio i dati vengono ricaricati: gli id cambiano e cambiano anche i colori assegnati ai progetti (vedi G4).

## A. Riverifica dei difetti precedenti

| Id | Stato | Prova |
|---|---|---|
| G1 Guida sillabata e giustificata | CHIUSO | Paragrafi `text-align:start; hyphens:manual` (375 IT, 1440 FR). Nessuna sillabazione automatica (`guida.mjs`). |
| G2 Link al bando #0000EE | CHIUSO | Ora è blu notte, sottolineato (`b_…progetti_0b5c…__2.png`). |
| G3 Coppie di pulsanti diseguali | APERTO, attenuato | Uguali: Excel/Stampa, Autorizza/Respingi, Apri la bozza/Versioni, Foto/File a 375. Restano a 1440 «Filtri» 140 / «Esporta tutto il 2026» 175 e «Filtri» 140 / «Esporta in Excel» 148. |
| G4 Colori dei progetti non fissi, talpa, nessuna scelta | CHIUSO | Impostazioni › Progetti ha 12 campioni con il segno «già usato». Il colore è lo stesso su /, /progetti e /analisi (`projmap.mjs`). La talpa non c'è più. Nota: a ogni ricaricamento dei dati dimostrativi i colori si rimescolano (3 assegnazioni diverse in 30 minuti). In uso reale non si può verificare. |
| G5 Schede tagliate dalla «i» | CHIUSO | Nessuna etichetta tagliata. Ora le schede vanno a capo: vedi H10. |
| G6 Etichette degli assi di corpo diverso | APERTO | A 1440: Dashboard 11,1 px, Analisi e Report 12,8 px, Cambi e scheda progetto 14,5 px. |
| G7 Previsto e speso senza intestazioni | CHIUSO | Colonne «Previsto» e «Speso» (`a_…progetti__1.png`). |
| G8 Tacca senza spiegazione | CHIUSO | «tacca sulla ciambella = anno trascorso (89 %)». |
| G9 Anello e barra con lo stesso dato | CHIUSO | Preventivo, Analisi e progetto mostrano solo la barra. Un caso residuo è H17. |
| G10 Arrotondamenti diversi | APERTO | /conti 1440 nella stessa fila: «53.090 €» e «52.000,10 €». |
| G11 Ordine importo/percentuale | CHIUSO | «68.176 € 39 %» ovunque. |
| G12 Budget/Preventivo/Previsto | APERTO, attenuato | Le colonne dicono «Previsto», ma la scheda del finanziamento ha ancora «Imposta il budget» e «Nessun budget…». |
| G13 «Da rimborsare» senza icona | APERTO | `m_…375_movimenti__2.png` |
| G14 «+» sulle entrate | CHIUSO | «+8.157,37 €», «+12.500,50 €». |
| G15 Stati vuoti diversi | CHIUSO | Stessa illustrazione in Anticipi dell'operatore, Documenti e Movimenti collegati. |
| G16 Vuoti da altezza forzata | APERTO | Dashboard › Preventivo: circa 70 px vuoti a 1440 e circa 95 px a 768. «Note»: circa 150 px. Altri casi in H1. |
| G17 Versioni a 375 | CHIUSO | Il pannello si apre subito sotto il pulsante e sposta il contenuto (`ver375_full.png`). |
| G18 Riga totale tagliata | CHIUSO | Il fondo #E3EAF4 occupa tutta la riga. Resta la giunzione di H6. |
| G19 Pastiglie di Scadenze | APERTO, attenuato | «Oggi» e «Tra 7 gg» sono centrate a 84 px, ma «Scaduta da 21 gg» (116 px) e «da 6 gg» (109 px) restano fuori colonna. «Fatta» è larga 55 px, «automatica» 83 px. Il problema MGA è chiuso. |
| G20 Piede vuoto nelle schede KPI | APERTO, attenuato | Analisi è risolta. Restano senza barra «Da consegnare» (/anticipi), «Rimborsato nel 2026» (/rimborsi), «Ricevuto», «Speso» e «Disponibile» (/finanziamenti). |
| G21 Schede del Report su due righe | APERTO, attenuato | Report in griglia 3 × 3 (risolto). In FR a 375 «Prévu et dépensé» va a capo e le altre no (`f_…analisi__1.png`). |
| G23 DEMO a capo al trattino | APERTO, spostato | La scheda è a posto. In Report › «Senza giustificativo» a 1440 tutti i riferimenti vanno a capo: «DEMO-/2026-005», 60 righe (`c_…nodoc__1.png`). |
| G22 Ultima riga di Progetti | CHIUSO | Due schede larghe, riga piena. |
| G24 Segnaposto tagliato in /documenti | CHIUSO | «Nome o n. MOV». A 375 lo stesso difetto compare in Preventivo: H12. |
| G25 Barre chiare sulla traccia | APERTO, attenuato | Sulla traccia #F2F5F9: #FFBAC4 1,47 e #C8BCDC 1,64. Obiettivo 1,8, nessun bordo. |
| G26 Icona di Spese generali disallineata | CHIUSO | `a_…admin_progetti__1.png` |
| 6-D9 Sfumature dei conti | APERTO, attenuato | Ora ci sono quadratini di legenda e i conti malgasci distano ΔE ≥ 15,9. Restano Banca Italia #8FAFD6 e Satispay #6F90BE a ΔE 9,6, e Cassa Italia #C3D6EF a 1,35 sulla traccia. |
| 6-D10 Critica/fatta con la deuteranopia | CHIUSO | ΔE deut 17,6. Un caso nuovo è H16. |
| 6-D11/7-2 Previsto di colore diverso | APERTO (ora P3) | Azzurro tenue nella traccia di /progetti, /analisi e Dashboard; #5B8FD6 saturo nella legenda e nella tacca di /finanziamenti. |
| 7-7 Progetti poco distinguibili | APERTO | Assegnazione attuale: 5 coppie con ΔE deut < 10, per esempio #4A6F9C/#6B5B8E 3,4 e #2F869F/#4A6F9C 5,4. Nella tavolozza di 12 colori, 20 coppie su 66 non arrivano a ΔE 15 o a deut 10. |
| 7-11 Italia/Madagascar senza colori | CHIUSO | Report «Uscite per paese» in blu e lilla con legenda. «Media 2026» ha la legenda «mese in corso». |
| 9-N3 Gruppo simile al corallo | APERTO, spostato | Il gruppo 09 è risolto. Ora il gruppo 03 #F0A273 dista ΔE 10,3 dal corallo #E2917F, nella stessa scheda progetto. |
| 9-N4 Senape #C9A227 | CHIUSO | Gruppo 01 #F2D16A, pastello. |
| 9-N5 Barra invisibile | APERTO, spostato | Il gruppo 08 è risolto. Ora il gruppo 05 #F7E5A4 ha 1,15 e il 04 #D6E8BE 1,19 sulla traccia (`a_…riepilogo__2.png`). |
| 9-N9 Previsto e Bonne Semence | CHIUSO | In /progetti il previsto ora è tenue. |

**Conteggio: 35 difetti verificati. 19 CHIUSI, 16 APERTI (di cui 8 attenuati o spostati), 0 PEGGIORATI.** Tutti gli aperti valgono ora P3.

## B. Voti

| Area | Prec. | Voto | Difetti che contano |
|---|---|---|---|
| Scelta delle tinte | 8 | **9** | 9-N3 (P3) |
| Stesso significato, stesso colore | 8,5 | **8,5** | 7-2, H8, H9 (3 P3) |
| Coerenza tra pagine, ruoli e lingue | 8,5 | **8** | H2 (P2); G10, G12, G13, H4, H5, H18, H19 (P3) |
| Accessibilità del colore | 8,5 | **8,5** | 7-7, G25, 9-N5, 6-D9, H16 (5 P3) |
| Grafici | 8,5 | **9** | G6, H17 (P3) |
| Bellezza e design complessivo | 8 | **8,5** | G16, H1, H7 (3 P3) |
| Impaginazione e tipografia | 7 | **8** | G3, G19, G20, G21, G23, H6, H10, H12, H13, H14 (10 P3) |

Quando un'area non ha P2 ma ha più di due P3, ho dato 8,5: per il 9 la griglia ammette al massimo due P3.

**Coerenza: da 8,5 a 8.** Pesa H2, un P2: a 375 la tabella del progetto nasconde gli sforamenti. È probabilmente un difetto vecchio non visto prima (impressione: la tabella stretta non sembra nuova), non un peggioramento verificato.

## C. Difetti nuovi

| Id | Grav. | Area | Dove · larghezza | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| H1 | P3 | Bellezza | /preventivo/riepilogo 1440; scheda del finanziamento | «Entrate per voce» viene stirata all'altezza delle Uscite: circa 2.000 px di bianco (`a_…riepilogo__2-3.png`). In «Periodo e scadenze» il contenuto sta in fondo, con circa 140 px vuoti sopra. | `align-items:start` nella griglia; contenuto in alto |
| H2 | **P2** | Coerenza | /progetti/<id> · 375 | «Previsto e speso per codice» perde la colonna Residuo e le barre. Così 02 (305 → 4.398 €) e 05 non hanno alcun segnale di sforamento, mentre a 1440 sono rossi (`m_…progetti_0b5c…__2.png`) | Terza riga «Residuo −4.093,10 €» in #B23B32 con ▲, oppure barra di 4 px in corallo #E2917F |
| H4 | P3 | Coerenza | Movimenti, scheda progetto | Due segni meno diversi: «−» (U+2212) in «Ultimi movimenti», «-» nelle tabelle, nei KPI e in /movimenti (prova: conteggio sul testo della scheda progetto) | U+2212 ovunque |
| H5 | P3 | Coerenza | ciambelle dei progetti, /analisi?vista=budget | «77%» senza spazio; altrove «75 %» | «77 %» con spazio sottile |
| H6 | P3 | Impaginazione | /preventivo 1440 (x≈660), /analisi?vista=budget (x≈848) | Bordi e fondo delle righe sfalsati di 1 px dove finisce la colonna fissa (`crop_prev_rows.png`) | Stesso `border-bottom` e stesso fondo sulla cella fissa |
| H7 | P3 | Bellezza | scheda di Spese generali, IT e FR | Due icone nel titolo: il progetto più un grafico #C9D6EA. Gli altri progetti ne hanno una (`b_…c31e…__1.png`) | Togliere l'icona del grafico |
| H8 | P3 | Significato | /rimborsi | La barra «Da rimborsare» è #A596E6, cioè il lilla del Madagascar | Ardesia #8497B0, come gli anticipi |
| H9 | P3 | Significato | /finanziamenti | La ciambella dei finanziatori e la barra «Concesso» usano #2F869F, che è il colore di un progetto | Scala delle entrate: #1E2B3C, #4A5B73, #8497B0, #B7C2D1 |
| H10 | P3 | Impaginazione | Movimenti e Conti IT, Documenti FR · 375 | Le schede vanno a capo su 2 righe. La scheda attiva può stare nella seconda riga e la «i» non è allineata (`fr_tabs375.png`) | Una riga scorrevole con `scroll-padding`, oppure «i» nella riga del titolo |
| H12 | P3 | Impaginazione | /preventivo · 375 | Segnaposto tagliato: «Numero, codice o descrizic» | «N., codice o testo» |
| H13 | P3 | Impaginazione | tabella del progetto · 375 | «05 ·» e «08 ·» restano soli su una riga | Spazio non separabile dopo «·» |
| H14 | P3 | Tipografia | /guida · 1440 | Righe di 1.048 px, circa 150 caratteri | `max-width: 70ch` |
| H16 | P3 | Accessibilità | /scadenze, legenda | «fatta» #CFE0C8 e «promemoria» #C9D6EA: ΔE deut 5,1, contrasto 1,06 | «fatta» #A8D5B5 con spunta ✓ |
| H17 | P3 | Grafici | /rimborsi «Da documentare» | Anello e barra pieni di verde per lo stesso dato, che è 0 | Tenere solo la barra; a 0 lasciare la sola traccia |
| H18 | P3 | Coerenza | /movimenti · 375 | Riga dell'anticipo: «-28,09 €» ma «150.000 MGA» senza segno (`m_…375_movimenti__1.png`) | Stesso segno su € e MGA |
| H19 | P3 | Coerenza | Dashboard dell'operatore · 375 | «Da verificare» senza l'orologio che ha in Movimenti (`o_…home__1.png`) | Un solo componente per le pastiglie |

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

| # | Intervento | Aree che sale |
|---|---|---|
| 1 | H2: segnalare gli sforamenti a 375; poi G10 e H4/H5 (un'unica regola per numeri, segni e %); G12 «Previsto»; G13 e H19 (pastiglie con icona) | Coerenza → 9 |
| 2 | Tavolozza dei progetti con 10 colori a ΔE ≥ 15 e deut ≥ 10, contrasto ≥ 1,8 sulla traccia o bordo di 1 px (7-7, G25). Gruppi 04 e 05 più scuri o con bordo (9-N5). Satispay #4F6F9A al posto di #6F90BE (6-D9). H16 | Accessibilità → 9 |
| 3 | Previsto sempre azzurro tenue #C9D6EA anche in /finanziamenti (7-2). Finanziatori nella scala delle entrate (H9). «Da rimborsare» in ardesia (H8) | Significato → 9 |
| 4 | Gruppo 03 in pesca chiara #F5C6A5, lontano dal corallo (9-N3) | Tinte (consolida il 9) |
| 5 | Griglie con `align-items:start` (G16, H1); togliere l'icona doppia (H7) | Bellezza → 9 |
| 6 | Codici DEMO con trattino non separabile (G23); schede su una riga (H10); pastiglie di Scadenze a larghezza fissa (G19); giunzione delle colonne fisse (H6); 70ch nella Guida (H14); segnaposto a 375 (H12, H13); «Filtri» ed «Esporta» di uguale larghezza (G3); piede in tutte le schede KPI (G20) | Impaginazione → 9 |
| 7 | Etichette degli assi a 12 px fissi (G6); H17 | Grafici (consolida il 9) |

Non verificato: PWA installata, telefoni veri, uso senza rete.
