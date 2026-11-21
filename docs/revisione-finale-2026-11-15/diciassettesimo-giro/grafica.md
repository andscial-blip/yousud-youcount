# YouCount — Grafica, colori e design · diciassettesimo giro

Prove in `/tmp/yc-final/work/gr/` (prefissi: `a_` 1440, `t_` 768, `m_` 375 super_admin; `f_` 375 FR; `o_` operatore 375; `r_` responsabile 1440). Script: `snap.mjs`, `el.mjs`, `m1.mjs`, `m10.mjs`, `ov.mjs`, `contrast.mjs`, `col.py` (contrasto, ΔE00, simulazione deuteranopia).
Alle 19:51 il server si è riavviato e ha ripopolato i dati (id nuovi).

## A. Riverifica dei difetti aperti

| Id | Esito | Prova |
|---|---|---|
| M1 | CHIUSO | `m1.mjs`: a 768 IT e FR le intestazioni (x 549–632 / 642–725) coincidono con i numeri |
| M2 | CHIUSO | `m_scadenze_3`: titolo a tutta larghezza, importo sotto |
| M3 | CHIUSO | `f_rimborsi_1`: «la plus ancienne :» resta con il testo, «21/11,» a capo |
| M4 | CHIUSO | KPI Movimenti grigio #9DA6B4 (`a_movimenti_1`); /finanziamenti: Concesso #8497B0, Ricevuto #2E3D52 |
| M5 | APERTO | `a_movimenti_d543…_1`: «Correggi questo movimento…» 41 px sotto il riquadro (altrove 20 px), «Storna…» nella colonna destra |
| M6 | CHIUSO | «Nota di rimborso» ora a tutta larghezza sotto le altre due (`a_movimenti_28d9…_2`) |
| M7 | APERTO, parziale | (a) e (b) chiusi (scheda senza legenda vuota, tracce uguali). (c) titolo ancora troncato «…primaria in…» (`a_finanziamenti_1`) |
| M8 | CHIUSO | DEMO in colonna fissa x 414–470 (`a_cambi_2`) |
| M9 | APERTO, parziale | Preventivo chiuso («42 righe · / 4 gruppi di voci»). Analisi FR 375: «24 %» va ancora a capo in Excédent, non in Prévu utilisé (`f_analisi_1`) |
| M10 | APERTO, attenuato | `m10.mjs`: righe a +4 px dal titolo a 375, a −6 px a 1440 |
| L8 | APERTO, parziale | 05 #E6CFE0 contro Sport ora ΔE 20,7 (chiuso); contro Spese generali #FFB0BB ancora 14,1; 01 #F2D16A contro Uscite #E8BE5A ancora 5,0 (deut 3,8) |
| L9 | APERTO, parziale | Preventivo chiuso; Conti 375 «BNI» ancora solo sopra «Madagascar (banca)» (`m_conti_2`) |
| K7 | CHIUSO | Guida 1440 «Come funziona» a destra; Impostazioni 375 «i» nella riga del titolo (ma vedi N1) |
| J2 | CHIUSO | Note: simboli ora a contorno, tutti #556275 (`note_tool.png`, `j2.mjs`). Resta solo ☏, disegnato dal carattere di riserva |
| J6 | APERTO, attenuato | Sport ora pesca #F0C2A0 (ΔE 38 dal Madagascar). Piccolino #BE8088 contro corallo d'allarme #E2917F: ancora 12,4 |
| G16 | APERTO, parziale | Scheda progetto chiusa (schede compatte). Dashboard 1440 «Preventivo»: circa 95 px vuoti tra la barra Entrate e «tacca = …» (`a_home_2`, y 270–365) |

**Conteggio: 16 verificati · 8 CHIUSI · 8 APERTI (5 parziali o attenuati) · 0 PEGGIORATI.**

## B. Voti

| Area | Giro prec. | Voto | Difetti che contano | Motivo |
|---|---|---|---|---|
| Scelta delle tinte | 9,5 | **9,5** | nessuno | Palette blu notte e pastelli coerente, niente marrone; il selettore progetti non propone più tinte grigiastre. Resta da valutare solo il logo |
| Stesso significato, stesso colore | 8,5 | **9** | L8, J6 (P3) | Sale per M4 chiuso: il blu notte ora indica solo entrate e ricevuto |
| Coerenza tra pagine, ruoli e lingue | 9 | **9** | M5, N6 (P3) | IT e FR, i quattro ruoli e le tre larghezze sono allineati; schede e «i» sono uniformi |
| Accessibilità del colore | 9,5 | **9,5** | nessuno | `contrast.mjs` su 16 pagine a 1440: 0 testi sotto 4,5:1 (unico falso positivo: etichette sotto le tacche delle soglie). Daltonismo: vedi L8 |
| Grafici | 9,5 | **9,5** | N5 (P3) | Colori stabili, legende presenti, assi a 12 px; Previsto e speso allineato a ogni larghezza |
| Bellezza e design complessivo | 8,5 | **9** | G16, N4 (P3) | Più ordine (schede compatte, stati vuoti uguali, icone a linea); restano vuoti e fondi sfalsati |
| Impaginazione e tipografia | 8 | **8,5** | M7c, M9, M10, L9, N1, N2, N3 (P3) | Nessun P2 (M1 chiuso), ma 7 P3: troppi per il 9 |

Nessuna area scende rispetto al giro precedente.

## C. Difetti nuovi

| Id | Gr. | Area | Dove · larghezza | Descrizione | Prova | Correzione |
|---|---|---|---|---|---|---|
| N1 | P3 | Impaginazione | /admin/impostazioni · FR 375 | «Association et documents»: il testo finisce a x 329, mentre la «i» comincia a x 323. La «s» finale sta sotto il pulsante: sovrapposizione e parola tagliata. Le altre 9 pagine di Impostazioni FR rientrano | `ov.mjs`, `f_admin_impostazioni_1` | Dare a h1 `max-width: calc(100% - 52px)` con `text-wrap: balance` (va su due righe), oppure etichetta breve «Association et docs» |
| N2 | P3 | Impaginazione | Scadenze › soglie ETS · 375 | Parole spezzate: «art. 13 c.2- / bis CTS» e «100.000 / €» | `soglie375_1` | Spazio non separabile (U+00A0) prima di «€»; trattino non separabile (U+2011) in «c.2‑bis» |
| N3 | P3 | Tipografia | /rimborsi 1440 IT e 375 FR; progetto «Ultimi movimenti» 375; Analisi 1440 | Numero o segno staccato dalla sua parola: «0 con documento, 1 / con motivo dichiarato» («1 / avec motif déclaré»); «· nov» da solo su una riga; «E2 · Contributi / per progetti» va a capo mentre E1, E3 ed E4 no | `a_rimborsi_1`, `f_rimborsi_1`, `m10_375`, `a_analisi_2` | U+00A0 dopo i numeri e prima di «·»; `text-wrap: pretty` sulle didascalie |
| N4 | P3 | Bellezza | Dashboard 768; Analisi › Entrate e Progetti 1440 | Senza più altezza forzata, i fondi delle schede affiancate sono sfalsati: 54 e 97 px (Dashboard 768), 17 px (Entrate per gruppo e Donatori), 163 px (Dove vanno i fondi e Previsto e speso) | `t_home_2`, `a_analisi_anno_2026_vista_entrate_1`, `a_progetti_1` | Righe a altezza uguale, ma lo spazio va al grafico (`flex: 1` sul corpo, piede in basso), non a un vuoto. In alternativa, abbinare schede di altezza simile |
| N5 | P3 | Grafici | Cambi e Analisi · 375 | Si mostrano mesi alterni, ma scelti diversamente: Cambi «Feb Apr … Dic», Analisi e progetti «Gen Mar … Nov» | `m_cambi_2`, `f_analisi_2`, `pic375_1` | Stessa regola dappertutto: Gen, Mar, …, Nov, più l'ultimo mese con dati |
| N6 | P3 | Coerenza | /rimborsi operatore · 375 | KPI vuoti in due stili: «In attesa da —» senza traccia accanto a «Da rimborsare a te» con la traccia. È il caso M7(b), rimasto in questa pagina | `o_rimborsi_1` | Traccia #F2F5F9 vuota anche in «In attesa da» |

Non segnalati: dicembre in Cambi (tasso DEMO in tabella); «11/21/2026» e «November» (selettore nativo del browser); crash «enqueueModel» su Andamento una sola volta in compilazione, poi corretto.

## D. Cosa funziona
Palette sobria e stabile; allarmi solo corallo; KPI uguali in tutte le pagine; Report 3×3; «Previsto e speso» allineato a 375, 768 e 1440; schede a 375 in griglia; stati vuoti uniformi; responsabile e operatore con la stessa grafica.

## Ordine di intervento per arrivare ad almeno 9 in ogni area

L'unica area sotto 9 è Impaginazione e tipografia: per salire deve scendere a ≤ 2 P3.

| # | Intervento | Chiude | Effetto |
|---|---|---|---|
| 1 | Regola tipografica globale: U+00A0 prima di «€» e «%» e dopo i numeri; U+2011 nei codici («c.2‑bis», «MOV‑», «DEMO‑»); `text-wrap: pretty` su didascalie e legende | N2, N3, L9, M9 | Impaginazione −4 P3 |
| 2 | Titolo di pagina a 375 con spazio riservato alla «i» (`max-width` più a capo bilanciato) | N1 | −1 P3 → Impaginazione 9 |
| 3 | Titolo nella scheda finanziamento su 2 righe senza troncamento, con `title` per l'intero; stesso rientro del titolo (16 px) per le righe di «Ultimi movimenti» | M7c, M10 | Impaginazione verso 9,5 |
| 4 | Schede affiancate: altezza uguale con lo spazio dato al corpo; «Preventivo» in Dashboard senza 95 px vuoti | N4, G16 | Bellezza 9,5 |
| 5 | Correggi e Storna in un solo blocco «Correzioni» nella colonna destra; traccia vuota anche in «In attesa da» | M5, N6 | Coerenza 9,5 |
| 6 | Gruppo 01 più distante dal giallo delle uscite (es. #F6DC8C → ΔE ≥ 10) oppure uscite in un'altra tinta; Piccolino lontano dal corallo (es. #C99AC0) | L8, J6 | Significato 9,5 |
| 7 | Stessa scelta dei mesi a 375 in tutti i grafici | N5 | Grafici 10 |

Voti finali: Tinte 9,5 · Significato 9 · Coerenza 9 · Accessibilità 9,5 · Grafici 9,5 · Bellezza 9 · Impaginazione 8,5.
