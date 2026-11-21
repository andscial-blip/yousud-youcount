# YouCount: Grafica, colori e design (quindicesimo giro)

Ho controllato 21 pagine con 4 ruoli, in IT e FR, a 375, 768 e 1440 px. Le schermate sono in /tmp/yc-final/work. Prefissi: `a_` = 1440 IT, `m_` = 375, `t_` = 768 FR, `i_` = 768 IT, `o_` = operatore 375 (in FR), `r_` = responsabile.
I ΔE00 sono calcolati con py/col.py («deut» = simulazione di deuteranopia di Machado). I colori vengono dal DOM.
Il server ha ripopolato i dati due volte durante la prova: gli id li ho ripresi ogni volta dalla pagina.

## A. Riverifica dei difetti precedenti

| Id | Esito | Prova |
|---|---|---|
| K1 | CHIUSO | `m_picc__3`: Gruppo, Previsto e Speso stanno nella larghezza; lo sforamento è rosso con ▲ |
| K2 | CHIUSO | Schede non più stirate (`a_analisi_vista_uscite__1`, `a_progetti__1`, finanziamento) |
| K3 | CHIUSO | Entrata «+12.500,50 €» in blu notte; Avanzo del Rendiconto in verde |
| K4 | CHIUSO | 62.572 € in entrambe le tabelle |
| K5 | APERTO, attenuato | Colori liberi: #4A9D9F (ΔE 10,1 da Ambohitsiroa #3AA8C5) e #BB71A0 (9,7 da Anjazafohy #CF93BE). Prima: 3,5 |
| K6 | CHIUSO | Colonna «Stato» centrata |
| K7 | APERTO | «Come funziona»: in Guida a 1440 sta a sinistra; a 375 (Guida e Impostazioni) occupa una fascia propria di circa 65 px; in FR 768 (Comptes) scende su una riga a sé |
| K8 | CHIUSO | `m_scadenze__3`: «Fatta» sempre a x 403–481 |
| K9 | CHIUSO | Modifica e Verifica misurano 132×37 px; il rosso è rimasto solo su «Elimina» |
| K10 | CHIUSO | #556275 su #F2F5F9: 5,66 |
| J2 | APERTO, attenuato | In Scadenze l'icona è ora a linea; nelle «Note» restano glifi di peso diverso (☏ fine, ✉ pieno: `crop_note.png`) |
| J4 | CHIUSO | 05 #E6CFE0, 09 #A7B3C4; verdi alla distanza minima di 13,0 |
| J5 | CHIUSO | 08 #A8DADC, Sapone #1D7954 |
| J6 | APERTO | Sport #CAC0F0 contro Mvola #D4CCF4: ΔE 3,5; contro Madagascar: 12,5. Piccolino contro il corallo: 12,4 |
| J8 | CHIUSO | Autocertificazione con icona documento, Storna con frecce circolari |
| J11 | APERTO, attenuato | Pallino «fatta» #B9D7B0 su bianco: 1,57 (prima 1,20) |
| G3 | CHIUSO | Coppie uguali: 183/183, 131/131, 80/80 px; a 375 pulsanti-icona da 52 px |
| G12 | CHIUSO | «Previsto» ovunque (resta Speso/Uscite per l'altra colonna) |
| G16 | APERTO a 768 | A 1440 è chiuso. A 768 restano circa 110 px vuoti nella scheda Preventivo (`i_home__2`) e circa 130 nella scheda Budget in FR (`t_home__2`) |
| H6 | APERTO, attenuato | Lo sfalsamento di 1 px è sparito, ma il bordo cambia tono (#D6DDE6 → #E7EBF0) a x 660 (Preventivo) e x 845 (Analisi) |
| H17 | CHIUSO | `a_rimborsi__1`: traccia vuota |
| 6-D9 | APERTO, quasi chiuso | Legenda presente; i conti malgasci distano almeno 15,9; Banca Italia/Satispay solo 9,6 |
| 7-7 | APERTO, attenuato | Distanza minima 12,6 (StreetFood/Piccolino); deut 8,1 (Sapone/StreetFood); 5 coppie sotto 15 |

**Conteggio: 23 voci. 14 CHIUSE, 9 APERTE (tutte P3), 0 PEGGIORATE.**

## B. Voti

| Area | Prec. | Voto | Difetti | Nota |
|---|---|---|---|---|
| Scelta delle tinte | 9 | **9** | K5, 7-7 | Palette tenue, niente marrone |
| Stesso significato, stesso colore | 9 | **9** | J6, L8 | Entrate, uscite, avanzo, previsto, Italia/Madagascar e allarmi sono stabili |
| Coerenza tra pagine, ruoli e lingue | 8,5 | **9** | K7, L6 | Il responsabile vede lo stesso disegno (`r_*`); IT e FR sono allineati |
| Accessibilità del colore | 8,5 | **9** | J11, 6-D9 | Nessun testo sotto 4,5:1 nelle oltre 60 pagine controllate a 375 e 768 (batch.mjs) |
| Grafici | 8,5 | **9,5** | nessuno | Colori stabili, legende ovunque, tacca spiegata, ▲ anche a 375. Non do 10 per L8 |
| Bellezza e design complessivo | 8,5 | **8,5** | J2, G16, L7 | Insieme elegante e piatto; tre rifiniture |
| Impaginazione e tipografia | 8 | **8,5** | H6, L1–L5, L9 | Nessun P2 (K1 è chiuso), ma sette P3 |

Nessuna area ha un voto più basso del giro precedente.

## C. Difetti nuovi

| Id | Grav. | Area | Dove | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| L1 | P3 | Impaginazione | Rendiconto · 1440 | Le colonne «2026» delle due tabelle impilate sono sfalsate di 20 px: Uscite x 1113–1299, Entrate x 1062–1279 (rend.mjs) | `table-layout: fixed` con le stesse larghezze di colonna nelle due tabelle |
| L2 | P3 | Impaginazione | Dashboard FR · 768 | «par groupe de dépense» finisce a 1,4 px dal bordo destro, contro 18 px di margine a sinistra (chk.mjs) | Margine minimo di 18 px; se non ci sta, il testo va sotto il titolo |
| L3 | P3 | Impaginazione | Impostazioni · 768 IT e FR | Schede 6+4 (IT) e 5+4+1 (FR, «Synchronisation» da sola), più «Come funziona» su una riga propria: circa 150 px. A 1440 la griglia è 5×2 | Griglia 5×2 anche a 768, oppure menu a tendina |
| L4 | P3 | Impaginazione | Conti dell'operatore · FR 375 | «Espèces dans les cai…» troncato con i puntini; terza scheda sola a metà larghezza (in Rimborsi la terza è a tutta larghezza) | Titolo su due righe; `grid-column: span 2` |
| L5 | P3 | Impaginazione | Guida · 375 | Segnaposto tagliato dopo «cambio,» | «Cerca nella Guida» |
| L6 | P3 | Coerenza | Scheda movimento | Due stili per eliminare: link da 13 px sotto i pulsanti, oppure testo da 16 px seminegrassetto accanto a Modifica | Un solo stile: pulsante fantasma rosso da 38 px |
| L7 | P3 | Bellezza | Guida | «Correggere un errore» ha la freccia «<», che sembra «indietro»; la stessa icona a frecce circolari serve per cambio e uso senza rete | Freccia a U per lo storno; nuvola barrata per l'uso senza rete |
| L8 | P3 | Significato | Dashboard | Il gruppo 05 #E6CFE0 dista 11,3 da Sport e 14,1 da Spese generali, due schede più sotto; il gruppo 01 #F2D16A ha ΔE 5,0 dal giallo «Uscite» del grafico accanto | Sport in pesca #F0C2A0 (almeno 10,1 da tutti i colori in uso; chiude anche J6) |
| L9 | P3 | Impaginazione | Conti e Preventivo · 375 | Parole sole a capo: «BNI» sopra «Madagascar (banca)», «…gruppi di / voci», «struttura / 134.158 €» | Nome del conto su una riga propria; `text-wrap: balance` nei piedi delle schede KPI |

Verificato: niente corsivo, nessuna parola spezzata (0 elementi con hyphens:auto), nessuno sbordo orizzontale a 375 e 768.

## Ordine di intervento per arrivare ad almeno 9 in ogni area

1. **Impaginazione** (da 7 P3 a 2 o meno): L1, L3, L4, L5, L9 e L2 si correggono con regole CSS comuni. Poi H6: un solo colore di bordo, #E7EBF0.
2. **Bellezza** (da 3 P3 a 2 o meno): G16 a 768 (`align-items: start`); J2 con icone a linea da 1,5 px nelle Note.
3. Per salire oltre il 9 nelle altre aree:
   - Sport in pesca (chiude J6 e L8); colori liberi a ΔE di almeno 15 da quelli in uso (K5, 7-7).
   - K7: «Come funziona» sempre nella riga delle schede; L6.
   - J11: bordo #6E8E6A sul pallino (3,66:1).
   - 6-D9: i quattro blu italiani a #3F5A82 / #6A8BC0 / #9DB9DF / #D2E0F3 (distanza minima 11,7).
4. Facoltativo: L7.
