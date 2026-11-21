# YouCount, quattordicesimo giro: Grafica, colori e design

Prove in /tmp/yc-final/work (a_ 1440 IT, m_ 375, t_ 768, f_/fm_ FR, o_ operatore, r_ responsabile). Misure: DOM (probe.mjs + sw/btns/axis/contrast/projcol.js), pixel, col.py (WCAG, ΔE00, deuteranopia). Dati ripopolati verso le 12:10: dettagli a 375 rifatti con id nuovi.

## A. Riverifica

| Id | Esito | Prova |
|---|---|---|
| J1 ✎ fuori scheda | CHIUSO | matita a linea a x≈1370, scheda fino a 1408 (`c_sc2`) |
| J2 glifi neri | APERTO, attenuato | Scadenze risolto; Note: ★ ⚑ ⚠ ☎ pieni accanto a ☐ ✓ a linea (`a_home`, `m_home_s3`) |
| J3 Impostazioni 10 schede | CHIUSO | griglia 2 × 5 allineata, IT e FR (`a_admin_progetti`, `c_fimp`) |
| J4 gialli e verdi dei gruppi | APERTO a metà | 09 ora #A7B3C4 (risolto); 01 #F2D16A e 05 #F7E5A4 adiacenti: ΔE00 8,3 (`z_donut`) |
| J5 kaki e oliva | APERTO, attenuato | 08 ora #A8DADC; Sapone #658552 resta oliva; contorni fette #B88A50 (H33 S42) e #B9AC7B, marroncino/kaki |
| J6 progetti lilla come il Madagascar | APERTO | Sport #CAC0F0–MG #A596E6 12,5; –Mvola #D4CCF4 3,5; Piccolino–corallo 12,4 |
| J7 Concesso e tempo | CHIUSO | blu notte/ardesia ovunque (`a_finanziamenti`, `c_fin`) |
| J8 icone dei comandi | APERTO, attenuato | Storna ora usa la «‹» di Indietro, come «Correggere un errore» in Guida (`c_g1`) |
| J9 testo tagliato in Rimborsi a 375 | CHIUSO | `m_rimborsi` |
| J10 Esporta solo a 768 | CHIUSO | icona accanto a Filtri (`c_tmov`) |
| J11 pallino «fatta» | APERTO | #E3EDDF su bianco 1,20 (sw.js) |
| J12 previsto nelle entrate | CHIUSO | previsto anche in «Entrate cumulate» (`a_analisi_vista_andamento`) |
| J13 Versioni a 375 | CHIUSO | DEMO su riga propria, pulsanti stabili (`m_ver`) |
| J14 pillole delle Scadenze | CHIUSO | 5 pillole uguali (`m_scadenze_s2`) |
| G3 coppie di pulsanti | APERTO | Rendiconto 1440: Excel 84 / «Stampa o PDF» 114; Preventivo 375: «Apri la bozza» 166 / «Versioni · 2» 140. Altrove uguali (btns.js) |
| G6 corpo delle etichette degli assi | CHIUSO | 13 px ovunque (axis.js) |
| G12 Previsto, Preventivo, Budget | APERTO | nella stessa pagina «oltre il preventivo» e «oltre il previsto»; FR «au-delà du budget/du prévu» (`c_bud1`, `c_fbud`) |
| G16 vuoti per altezze forzate | APERTO, attenuato | scheda progetto risolta; Dashboard 1440: ~100 px vuoti sotto «Preventivo»; 768: ~80 px vuoti dentro (`t_`) |
| G20 piedi delle schede KPI | CHIUSO | `a_analisi` |
| H6 bordo sfalsato di 1 px | APERTO | Analisi › Previsto e speso, x≈846 (`z_h6`) |
| H13 «05 ·» solo su una riga | CHIUSO | `m_picc_s2` |
| H17 «Da documentare» | APERTO | valore 0 con barra verde piena (`a_rimborsi`, `m_rimborsi`) |
| 6-D9 sfumature dei conti | APERTO, attenuato | legenda presente; Banca Italia–Satispay ΔE 9,6; Cassa Italia su traccia 1,35 |
| 7-7 progetti distinguibili | APERTO | StreetFood–Piccolino 12,6; deut Agricoltura–Bonne Semence 9,2; quattro rosa/malva |
| 9-N5 gruppo 08 invisibile | CHIUSO | 08 acqua; barre chiare con contorno #D8CA94 |

**Conteggio: 25 voci. 12 CHIUSI, 13 APERTI (6 attenuati), 0 PEGGIORATI.**

## B. Voti

| Area | Giro 13 | Giro 14 | Difetti che contano | Motivo |
|---|---|---|---|---|
| Scelta delle tinte | 9 | **9** | J5, K5 (2 P3) | palette tenue e coerente; resta il fondo oliva-kaki |
| Stesso significato, stesso colore | 9 | **9** | J6, K3 (2 P3) | entrate, uscite, saldo e paesi stabili |
| Coerenza tra pagine, ruoli e lingue | 9 | **8,5** | G12, K4, K7 (3 P3) | vedi sotto |
| Accessibilità del colore | 8,5 | **8,5** | J11, 6-D9, K10 (3 P3) | testi controllati su 15 pagine: tutti ≥ 4,5 tranne K10 |
| Grafici | 8,5 | **8,5** | J4, 7-7, H17 (3 P3) | assi uniformi, previsto completo, legende presenti |
| Bellezza e design complessivo | 8,5 | **8,5** | J2, J8, G16, K2, K9 (5 P3) | elegante e piatto; restano vuoti e dettagli d'icona |
| Impaginazione e tipografia | 8 | **8** | K1 (P2); G3, H6, K6, K8 (P3) | un P2 a 375 |

Coerenza 9 → 8,5: nessun peggioramento reale; K4 e K7 sono difetti vecchi non visti, G12 era aperto. Tre P3 escludono il 9.

## C. Difetti nuovi

| Id | Grav. | Area | Dove · larghezza | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| K1 | **P2** | Impaginazione | scheda progetto «Previsto e speso per codice» · 375 | La tabella è larga 364 px in un riquadro di 341: la colonna Speso è tagliata a metà cifra («1.195,87» senza €, intestazione «Spe»). Residuo e barre sono fuori vista e nulla segnala lo scorrimento (`m_picc_s2`, picc.mjs) | Sotto 480 px: importi interi, due colonne (Previsto, Speso) e Residuo con barra sotto il nome; in alternativa righe a scheda |
| K2 | P3 | Bellezza | 1440: Analisi › Uscite «Uscite per voce»; Progetti «Dove vanno i fondi»; finanziamento «Periodo e scadenze» e «Ricevuto e speso» | Schede stirate all'altezza della vicina, con 140–230 px bianchi (`a_analisi_vista_uscite`, `a_progetti`, `c_fin`) | `align-items: start`, oppure riempire (per esempio le 3 voci successive) |
| K3 | P3 | Significato | scheda movimento (entrata); Rendiconto | Nella scheda l'importo di un'entrata è nel verde dell'avanzo, senza «+»; nell'elenco è blu notte con «+». Nel Rendiconto «Avanzo» è grigio scuro, altrove è verde (`a_movimenti_3eea…`, `c_rend`) | Entrata: blu notte con «+». Avanzo: sempre verde |
| K4 | P3 | Coerenza | Analisi › Previsto e speso · tutte | Lo stesso dato appare come «62.571,87 €» (gruppi) e «62.572 €» (codici) nella stessa pagina; in Scadenze «125.000,00 €» (`c_bud1`, `c_sc2`) | Un'unica regola: interi sopra 1.000 € |
| K5 | P3 | Tinte | Impostazioni › Progetti · tutte | Il selettore propone come libero #95779C, a ΔE 3,5 (deut 3,3) da Agricoltura #8A739D; anche #789790 è grigiastro (S 13 %) (projcol.js) | Togliere i colori liberi a meno di 15 ΔE da quelli usati |
| K6 | P3 | Impaginazione | Analisi gruppi · 1440 IT e FR | Le pastiglie «nei tempi» e «oltre il preventivo» sono attaccate al nome: bordo sinistro irregolare (`a_analisi_vista_uscite`) | Colonna stato fissa e centrata, come in Scadenze |
| K7 | P3 | Coerenza | Guida 1440; Impostazioni FR 375 | In Guida «Come funziona» sta a sinistra sotto il titolo, altrove a destra nella riga delle schede. In Impostazioni a 375 occupa da sola una fascia di circa 70 px (`c_g1`, `c_fmimp`) | Stessa posizione ovunque; a 375 accanto al titolo |
| K8 | P3 | Impaginazione | Scadenze · 375 | Nelle righe con ✎ il pulsante «Fatta» si sposta a sinistra: non forma una colonna (`m_scadenze_s2`) | Spazio dell'icona riservato anche quando manca |
| K9 | P3 | Bellezza | scheda movimento · 1440 | «Correggi questo movimento…» è rosso (colore distruttivo) e sta da solo sotto le schede. Modifica e Verifica sono alti 48 px contro i 38 del resto dell'app (`a_movimenti_8065…`, `…3eea…`) | Correggi in blu notte e dentro la scheda Storna; pulsanti da 38 px |
| K10 | P3 | Accessibilità | calendario Scadenze · 1440 | I giorni fuori mese sono #647182 su #F2F5F9: contrasto 4,20 a 12 px (contrast.js) | #556275 (5,66) |

Non verificato: PWA, telefoni veri.

## Ordine di intervento per arrivare ad almeno 9 in ogni area

| # | Intervento | Chiude | Aree che arrivano a 9 |
|---|---|---|---|
| 1 | Tabella del progetto a 375 senza tagli (K1) | P2 | Impaginazione (serve anche il punto 5) |
| 2 | Termine unico «Previsto/Prévu» in pastiglie e KPI (G12); stessa regola di arrotondamento (K4) | 2 P3 | Coerenza → 9 |
| 3 | Pallino «fatta» con bordo #9DBF92 (J11); giorni fuori mese #556275 (K10) | 2 P3 | Accessibilità → 9 (resta 6-D9) |
| 4 | Barra a 0 neutra in «Da documentare» (H17); 05 più distante da 01, per esempio #FBF0C9 con contorno, oppure ordine 01–06–05 (J4) | 2 P3 | Grafici → 9 (resta 7-7) |
| 5 | G3 (Rendiconto, Preventivo 375), H6, K6 | 3 P3 | Impaginazione → 9 (resta K8) |
| 6 | Schede `align-items: start` (G16, K2); simboli a linea nelle Note (J2); icona propria per Storna (J8) | 4 P3 | Bellezza → 9 (resta K9) |
| 7 | Facoltativo, per tenere il 9 con margine: Sport lontano dal lilla del Madagascar (J6); 4 rosa ridotti a 2 (7-7); contorni delle fette non marroni (J5) | | Significato, Grafici, Tinte |
