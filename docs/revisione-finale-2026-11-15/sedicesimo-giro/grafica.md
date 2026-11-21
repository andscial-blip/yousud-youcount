# YouCount — Grafica, colori e design · sedicesimo giro

Metodo: schermate a tutta pagina con controlli automatici (`work/audit.mjs`), misure sul DOM (`m1`–`m6.mjs`), ΔE00 e deuteranopia (`work/py/col.py`). Ruoli: super_admin e admin_fr (375, 768, 1440), responsabile (1440), operatore (375, IT). Nessun corsivo, nessuna sillabazione, nessuno scorrimento orizzontale, nessun testo sotto 4,5:1. Due errori transitori del server di sviluppo: pagine rifatte, non è un difetto.

## A. Riverifica

| Id | Esito | Prova |
|---|---|---|
| L1 | CHIUSO | Rendiconto 1440: le colonne «2026» delle due tabelle vanno entrambe da 1067 a 1237 (m1.mjs) |
| L2 | CHIUSO | Dashboard FR 768: «par groupe de dépense» finisce a 725, la scheda a 744. Margine di 19 px, uguale a sinistra (m3.mjs) |
| L3 | CHIUSO | Impostazioni FR 768: griglia 5×2, «Synchronisation» nella 2ª riga con le altre (m3.mjs) |
| L4 | CHIUSO in IT · FR non verificato | Operatore 375 IT: terza scheda a tutta larghezza, etichetta intera (`o__conti.png`). FR non provato: l'utente operatore è in uso da un altro revisore |
| L5 | CHIUSO | Il segnaposto ora è «Cerca nella Guida» (`m__guida_p0`) |
| L6 | CHIUSO | Lo stile per eliminare è uno solo: pulsante con bordo rosso, alto 38 px, testo a 14 px seminegrassetto, sia per DEMO sia per «Elimina bozza» (`bozza2_c.png`) |
| L7 | CHIUSO | «Correggere un errore» ha la matita; il cambio ha «€» (`a_guida_top.png`) |
| L8 | **APERTO** | Gruppo 01 #F2D16A contro il giallo «Uscite» #E8BE5A: ΔE00 5,0 (deut 3,8). Il gruppo 05 #E6CFE0 dista 14,1 da Spese generali; da Sport ora 20,7 |
| L9 | **APERTO** | Conti 375: «BNI» resta solo sopra «Madagascar (banca)» (`m__conti_p0`). In Preventivo il caso è migliorato |
| K5 | CHIUSO | Colori liberi proposti: #4A9D9F e #BB71A0. Distanza minima ΔE 9,7 (#BB71A0 da Anjazafohy) e 10,1 (#4A9D9F da Ambohitsiroa); niente più grigi. Resta sotto il traguardo di 15 |
| K7 | **APERTO** | Guida 1440: «Come funziona» sta ancora a sinistra sotto il titolo. Guida e Impostazioni 375: la «i» occupa da sola una fascia di circa 45 px (`a_guida_top`, `m_imp_top`) |
| J2 | **APERTO** (attenuato) | In Scadenze ✎ ora è un'icona SVG. La barra delle Note ha ancora 8 glifi Unicode come testo: ☐ ✓ ☆ ⚐ ! € ☏ @ (m2.mjs) |
| J6 | **APERTO** (attenuato) | Sport è diventato pesca #F0C2A0, quindi il lilla è sparito. Piccolino #BE8088 contro il corallo d'allarme #E2917F resta a 12,4 |
| J11 | CHIUSO | Pallino «fatta» #B9D7B0 su bianco: 1,57 (prima 1,20), accompagnato dall'etichetta |
| G16 | **APERTO** (trasformato) | Altezze non più forzate, ma restano buchi a 1440. Dashboard: 118 px sotto «Preventivo». Progetti: 160 px. Analisi › Uscite: 183 px. Scheda finanziamento: 237 px. **Riepilogo del preventivo: circa 1.470 px vuoti sotto «Entrate per voce»** (`a__preventivo_riepilogo_c0/c1900`) |
| H6 | CHIUSO | /preventivo con tutti i gruppi aperti: celle a filo (264/313…, tutte `static`). Budget: bordi a 1161/1203/1245 su ogni x |
| 6-D9 | CHIUSO | I quadratini dei conti fanno da legenda. I due conti malgasci visibili distano ΔE 15,9; il segmento chiaro ha contrasto 1,35, con un separatore |
| 7-7 | CHIUSO | Fra i 10 progetti il ΔE00 minimo è 12,6 (StreetFood–Piccolino); in deuteranopia il minimo è 8,2, su coppie di luminosità molto diversa |

**Conteggio:** 11 chiusi, più L4 chiuso solo in IT; 6 aperti (L8, L9, K7, J2, J6, G16); nessuno peggiorato.

## B. Difetti nuovi

| Id | Gravità | Area | Dove · larghezza | Descrizione e prova | Correzione |
|---|---|---|---|---|---|
| M1 | **P2** | Impaginazione | /progetti «Previsto e speso» · 768, IT e FR | Le intestazioni «Previsto» e «Speso» stanno a x 529–725, i numeri a x 309–517: sono spostati di circa 208 px e nessun numero sta sotto la sua intestazione. A 375 e 1440 sono allineati (m4.mjs, `f_prog.png`) | Intestazioni e valori nella stessa griglia, `grid-template-columns: 1fr 96px 96px`, con la barra sotto il nome |
| M2 | P3 | Impaginazione | /scadenze · 375 IT e FR | La colonna dell'importo resta riservata anche quando è vuota. Il titolo ha così circa 150 px e va su 5–7 righe (`m__scadenze_p1`) | Importo sotto il titolo; colonna a destra solo se c'è un importo |
| M3 | P3 | Tipografia | /rimborsi FR · 375 | «la plus ancienne / : 21/11,»: i due punti vanno a inizio riga (`g_combo`) | Spazio fine non separabile (U+202F) prima di «:» in FR |
| M4 | P3 | Stesso significato | /movimenti KPI «Movimenti»; /finanziamenti | Il blu notte delle entrate è usato anche per il numero dei movimenti, per «Concesso» (ciambella e barra) e per «Ricevuto», nella stessa pagina (`a__movimenti`, `a__finanziamenti`) | Conteggi in grigio ardesia #9DA6B4; «Concesso» in ardesia, «Ricevuto» in blu notte |
| M5 | P3 | Coerenza | scheda di un movimento verificato · 1440 | «Correggi questo movimento…» e «Storna questo movimento…» sono due ingressi quasi uguali. Il primo sta 42 px sotto il riquadro; nelle altre schede lo spazio è di 21 px (`d__movimenti_e707…`) | Un solo ingresso, nella scheda Storna |
| M6 | P3 | Bellezza | scheda movimento «Genera un documento» · 1440 | Tre pulsanti su 2 colonne: «Nota di rimborso» resta da solo a metà larghezza (`d__movimenti_6c09…`, `bozza2_c`) | 3 colonne, oppure il terzo a tutta riga |
| M7 | P3 | Grafici | scheda finanziamento e /finanziamenti · 1440 | (a) Legenda «Previsto/Speso» mostrata senza alcun grafico. (b) KPI vuoti in due stili diversi: filo grigio in Ricevuto e Speso, traccia in Disponibile. (c) Titolo della scheda in elenco troncato: «…primaria in…» | Nascondere la legenda se non c'è il grafico; un solo stato vuoto; titolo su 2 righe senza puntini |
| M8 | P3 | Impaginazione | /cambi · 1440 | Le pastiglie DEMO sono attaccate al nome del mese, quindi il bordo sinistro è irregolare (x 383–441) (`a__cambi`) | Colonna fissa per la pastiglia |
| M9 | P3 | Impaginazione | Analisi FR 375; Preventivo 375 | «24 %» va a capo in «Excédent» ma resta in riga in «Prévu utilisé». «42 righe · 4 / gruppi di voci» è spezzato a metà (`g_combo`, `m__preventivo_p0`) | Percentuale sempre in riga con l'etichetta; spazio non separabile in «4 gruppi» |
| M10 | P3 | Impaginazione | scheda progetto «Ultimi movimenti» · 375 | Le righe hanno un rientro di circa 25 px, il titolo della scheda di 31 px (misurato sulla schermata `m__progetti_b2c0…_p1`) | Stesso rientro della scheda |

## C. Voti

| Area | Prec. | Voto | Motivo (difetti contati) |
|---|---|---|---|
| Scelta delle tinte | 9 | **9,5** | Nessun difetto aperto. Palette tenue; Sport pesca è sobrio. Resta un ΔE di 9,7 fra i colori liberi proposti |
| Stesso significato, stesso colore | 9 | **8,5** | L8, J6, M4: tre P3, uno in più di quanti ne ammette il 9 |
| Coerenza tra pagine, ruoli e lingue | 9 | **9** | K7, M5 |
| Accessibilità del colore | 9 | **9,5** | Nessun testo sotto 4,5:1. Etichette sempre accanto ai colori; lo sforamento ha anche ▲ |
| Grafici | 9,5 | **9,5** | M7 |
| Bellezza e design complessivo | 8,5 | **8,5** | G16, J2, M6 |
| Impaginazione e tipografia | 8,5 | **8** | M1 (P2), più L9, M2, M3, M8, M9, M10 |

Aree più basse del giro precedente:
- **Stesso significato** (8,5 contro 9): L8 e J6 erano già aperti; M4 è un difetto vecchio non visto. Non è un peggioramento.
- **Impaginazione** (8 contro 8,5): pesa M1, un P2 a 768, larghezza poco esaminata prima. Probabilmente vecchio non visto; non posso provare un peggioramento.

## D. Ordine di intervento per arrivare ad almeno 9 in ogni area

1. **M1**: allineare intestazioni e valori di «Previsto e speso» a 768. Toglie l'unico P2 (Impaginazione).
2. **Impaginazione, per scendere a due P3 al massimo**: L9 e M9 (spazi non separabili «BNI Madagascar», «4 gruppi»), M3 (U+202F prima di «:» in francese), M2 (colonna dell'importo solo se c'è un importo), M8, M10.
3. **Stesso significato**:
   - L8: gruppo 01 in giallo molto più chiaro, #F7E3A1 (ΔE 11,1 dalle Uscite), oppure un'altra tinta.
   - M4: conteggi e «Concesso» in ardesia.
   - J6: spostare Piccolino verso un malva freddo, con ΔE di almeno 15 dal corallo e da Anjazafohy.
4. **Bellezza**:
   - G16: colonne indipendenti (due flex in colonna) al posto delle righe di griglia. Priorità al Riepilogo, che ha circa 1.470 px vuoti.
   - J2: icone SVG a linea nella barra delle Note.
   - M6: 3 colonne in «Genera un documento».
5. **Coerenza**: K7 («Come funziona» a destra anche in Guida; a 375 nella riga del titolo) e M5 (un solo ingresso per stornare).
6. **Rifinitura** (per le aree già a 9 o più): M7, e colori liberi del selettore con ΔE di almeno 15.
