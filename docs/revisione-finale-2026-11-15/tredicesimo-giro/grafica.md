# YouCount · Grafica, colori e design · tredicesimo giro

Prove in `/tmp/yc-final/work/`: schermate `a_*` 1440, `M_t_*` 768, `M_m_*` 375, `M_f_*` FR, `M_o_*` operatore, `r_*` responsabile; misure con `colors/sem/grp/meas.mjs`, `de.py` (ΔE00 = CIEDE2000; deut = deuteranopia simulata).
**Riavvio delle 10:18:** i colori dei 10 progetti sono identici prima e dopo, quindi stabili.

## A. Riverifica

| Id | Stato | Prova |
|---|---|---|
| H1 | CHIUSO | Entrate per voce non stirata; Periodo e scadenze in alto (`a_riep__2`, `a_find__1`) |
| H2 | CHIUSO | A 375, 02 è in rosso con ▲ (`M_m_pr1`) |
| H4 | CHIUSO | importi solo «-»; «−» resta solo nell'asse «−25k» |
| H5 | CHIUSO | «77 %», «128 %» (`a_prog__2`) |
| H6 | APERTO | bordo sfalsato 1 px a x≈660 e x≈848 (`crop_h6.png`) |
| H7 | CHIUSO | Una sola icona nel titolo di Spese generali (`a_pr1__1`) |
| H8 | CHIUSO | La barra di Rimborsi è grigio-blu (`a_rimborsi__1`) |
| H9 | CHIUSO | Ciambella e «Concesso» sono blu notte #1E2B3C (`a_fin__1`) |
| H10 | CHIUSO | griglia 2×2 voluta; FR su una riga (`M_f_doc`) |
| H12 | CHIUSO | «Codice o descrizione» si legge intero (`M_m_prev`) |
| H13 | APERTO | «05 ·» e «08 ·» restano soli su una riga (`M_m_pr1`, terzo riquadro) |
| H14 | CHIUSO | colonna ≈500 px, ≈70 caratteri |
| H16 | CHIUSO | «fatta» #E3EDDF contro «promemoria» #A9BDE0: ΔE00 23,4, deut 22,9 |
| H17 | APERTO | barra verde piena per «0 / 0» (`M_o_rimb`) |
| H18 | CHIUSO | «-5,62 € / -30.000 MGA» (`M_m_mov`) |
| H19 | CHIUSO | «Da verificare» ha l'orologio nella Dashboard dell'operatore (`M_o_home`) |
| G3 | APERTO | scheda movimento: Modifica 101 / Verifica ≈117 px (1440), 214/116 (375). Le altre coppie ora sono uguali |
| G6 | APERTO, attenuato | assi: 12 px Dashboard, 13 px Analisi; ≈14,5 px in Cambi e progetto (scala del viewBox) |
| G10 | CHIUSO | «8,90 €» e «217,71 €» sono uguali in Dashboard, Conti e Anticipi |
| G12 | APERTO | colonne ok, ma in Dashboard «del previsto» accanto a «del preventivo»; in Analisi «oltre il previsto» e «oltre il preventivo» |
| G13 | CHIUSO | «Da rimborsare» ha il portafoglio (`a_mov__1`) |
| G16 | APERTO | vuoto di 106 px nella scheda Preventivo della Dashboard; ≈185 px in «Dove vanno i fondi» (`a_prog__1`) |
| G19 | CHIUSO | Pastiglie da 118 px centrate; «337,10 € / 1.800.000 MGA» (`a_scad__3`) |
| G20 | APERTO | Finanziamenti: «Ricevuto» e «Speso» senza barra, didascalie 38 px più alte di «Concesso» (`a_fin__1`) |
| G21 | CHIUSO | griglia 3×3, anche in FR |
| G23 | CHIUSO | «DEMO-2026-1010» va a capo intero (`M_m_movd`) |
| G25 | CHIUSO | bordo interno 1 px; Sport sulla traccia 1,98 |
| 6-D9 | APERTO, attenuato | legenda presente; Banca #8FAFD6 / Satispay #6F90BE ΔE00 9,6 |
| 6-D11/7-2 | CHIUSO | previsto sempre blu (#C7D9F1 / #5B8FD6) |
| 7-7 | APERTO | StreetFood e Piccolino: ΔE00 12,6. Agricoltura e Bonne Semence: deut 9,1 |
| 9-N3 | CHIUSO | Il gruppo 09 è ora #B3D58C |
| 9-N5 | APERTO (spostato) | 08 ora va bene; ma 05 #F7E5A4 = 1,15 e 04 #D6E8BE = 1,19 sulla traccia, senza bordo |

H3, H11 e H15 non sono descritti in DIFETTI_PRECEDENTI, quindi non li ho riverificati.
**Conteggio:** 32 voci; 21 chiuse, 11 aperte (tutte P3), nessuna peggiorata.

## B. Voti (alla lettera; 8,5 = nessun P2 e 3–4 P3)

| Area | Prec. | Ora | Difetti nell'area |
|---|---|---|---|
| Scelta delle tinte | 9 | **9** | J5 |
| Stesso significato, stesso colore | 8,5 | **9** | J6, J7 |
| Coerenza tra pagine, ruoli e lingue | 8 | **9** | G12 |
| Accessibilità del colore | 8,5 | **8,5** | 6-D9, 7-7, 9-N5, J11 |
| Grafici | 9 | **8,5** | G6, H17, J4, J12 |
| Bellezza e design complessivo | 8,5 | **8,5** | G16, J2, J8 |
| Impaginazione e tipografia | 8 | **8** | G3, G20, H6, H13, J1, J3, J9, J10, J13, J14 (10 P3) |

**Grafici, da 9 a 8,5.** J4 è un peggioramento reale (correggendo 9-N4, il gruppo 05 è diventato #F7E5A4, accanto a 01 #F2D16A). G6 e H17 erano già aperti; J12 c'era ma non era stato visto.

Nessuna area ha P0, P1 o P2. A 375, 768 e 1440 non c'è nessuna pagina che deborda (scrollWidth = larghezza in tutti i 40 rilievi).

## C. Difetti nuovi

| Id | Grav. | Area | Dove · larghezza | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| J1 | P3 | Impaginazione | /scadenze · 1440 | ✎ a x 1383–1419, scheda fino a 1408: esce di 11 px (`a_scad__2`) | slot fissi 118 / 96 / 32 px dentro padding 20 px |
| J2 | P3 | Bellezza | Scadenze; «Note» in Dashboard · tutte | glifi Unicode neri (✎ ★ ⚑ ⚠ ☎ ✉) tra icone a linea (`M_o_home`) | Icone a linea dello stesso set, 16 px, tratto 1,5, #556275 |
| J3 | P3 | Impaginazione | Impostazioni · 1440 | 10 schede: «Sincronizzazione» sola in 2ª riga (`a_adp__1`) | riga scorrevole, o 7 schede |
| J4 | P3 | Grafici | ciambelle e barre dei gruppi · tutte | 01 #F2D16A e 05 #F7E5A4, adiacenti: ΔE00 8,3. Quattro verdi: 04 #D6E8BE e 09 #B3D58C hanno ΔE00 9,1 | 09 → ardesia #A7B3C4 (ΔE 27,3 da 04). 05 con contorno di 1 px #D9C37A nell'anello e nelle barre |
| J5 | P3 (impressione) | Tinte | gruppo 08, Sapone | 08 #B9B27A (H53 S31 L60) e Sapone #658552 virano al kaki e all'oliva, vicino al marrone escluso dal committente | 08 → #A8DADC (ΔE ≥15 dagli altri verdi e dal saldo). Sapone → salvia #93C5A0 |
| J6 | P3 | Significato | Dashboard «Uscite per progetto» accanto a «Saldo dei conti» | Sport #CAC0F0 e Agricoltura #8A739D sono lilla e viola come il Madagascar #A596E6 (ΔE00 12,5 e 15,9). Sport contro Mvola #D4CCF4: 3,5. Piccolino #BE8088 contro il corallo d'allarme #E2917F: 12,4 | escludere tinte 250–290° e a ΔE <15 dal corallo |
| J7 | P3 | Significato | /finanziamenti, scheda | «Concesso» e «tempo» blu notte nei KPI, #5B8FD6 in tacca e barra della scheda in elenco (`M_t_fin`) | Usare #2E3D52 per tutti e due |
| J8 | P3 | Bellezza | scheda movimento | Autocertificazione con icona a barre; Storna con matita (`a_movd__1`) | Icona documento con firma; per lo storno, una freccia circolare |
| J9 | P3 | Impaginazione | /rimborsi · 375 | «Rimborsato a te nel 2…» è tagliato con i puntini (`M_o_rimb`) | «Rimborsato nel 2026» oppure due righe (`text-overflow` → `normal`) |
| J10 | P3 | Impaginazione | /movimenti · 768 | «Esporta tutto il 2026» resta da solo su una seconda riga, a sinistra (`M_t_mov`) | Riga sola con ricerca `1fr` e due pulsanti da 140 px, oppure solo icone come a 375 |
| J11 | P3 | Accessibilità | Scadenze, legenda | Il pallino «fatta» #E3EDDF su bianco vale 1,20: quasi invisibile | Pallino #E3EDDF con bordo di 1 px #9DBF94, oppure tinta #B9D7B0 |
| J12 | P3 | Grafici | Analisi › Andamento | previsto solo in «Uscite cumulate», non nelle entrate (223.619 € previsti) (`a_ana__1`) | Stessa linea #5B8FD6 tratteggiata anche nelle entrate |
| J13 | P3 | Impaginazione | Versioni · 375 | «· DEMO» a inizio riga; all'apertura i pulsanti passano da affiancati a impilati (`M_ver.png`) | Pastiglia DEMO al posto del «·». Lasciare i pulsanti fermi |
| J14 | P3 | Impaginazione | /scadenze filtri · 375 | Tre pillole da circa 113 px, poi «90 giorni» e «Tutte» da circa 175 px (`M_m_scad`) | Griglia 3 + 2 con colonne uguali, oppure una riga scorrevole |

## Ordine di intervento per arrivare ad almeno 9 in ogni area

1. **Impaginazione (8 → 9, la più lontana):** J1, G3 (`grid 1fr 1fr` per Modifica e Verifica), G20 (riga della barra anche a 0: una traccia vuota di 8 px), H6 (un solo bordo #E3EAF4 su tutta la riga), H13 (trattino non separabile tra codice e nome), J3, J9, J10, J13, J14. Ne possono restare al massimo due.
2. **Grafici (8,5 → 9):** J4, J12, H17 (con 0 su 0, traccia vuota e testo «nessuna spesa da documentare»), G6 (`font-size: 12px` fisso, fuori dal viewBox).
3. **Accessibilità (8,5 → 9):** J11 e 9-N5 (bordo interno di 1 px rgba(30,43,60,.14) anche sulle barre dei gruppi, come già si fa sui progetti). Così restano solo 6-D9 e 7-7.
4. **Bellezza (8,5 → 9):** J2 e J8. Poi G16: `align-items: start`, oppure le prossime 3 scadenze dentro il vuoto della scheda Preventivo.
5. **Per non scendere sotto 9:** in Significato J6 e J7, in Coerenza G12 («Previsto» ovunque), in Tinte J5. Sono rifiniture a costo basso.
