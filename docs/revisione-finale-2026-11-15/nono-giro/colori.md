# Colori: nono giro (revisore indipendente)

Metodo: schermate a pagina intera e inventario dei colori calcolati (fondi, riempimenti SVG, testo su fondo) con `work/col/audit.mjs`. ΔE è CIEDE2000; la deuteranopia è simulata con Machado 2009 (gravità 1); il contrasto segue WCAG. Ho controllato super_admin a 1440 e 375, admin_fr a 1440, responsabile a 768 e operatore a 375, su tutte le pagine minime. Le prove sono in `/tmp/yc-final/work/col/` (`a_|b_|c_|d_|e_<ruolo>_<larghezza>_<pagina>.png` e i `.json` corrispondenti).
Confronto automatico degli insiemi di colori: IT e FR sono identici su /, /progetti, /anticipi, /scadenze e /analisi; 375 e 1440 sono identici, a parte la barra di navigazione. Sul piano dei ruoli c'è una sola differenza (vedi N2).

## A. Riverifica dei difetti precedenti

| Difetto | Esito | Prova |
|---|---|---|
| 6-D1 l'icona colora il tipo | CHIUSO | Ogni progetto ha la sua tessera tinta (Antanetibe #A0ACBC, Bonne Semence #9BC9DF…): `a_…admin_progetti.png`, `b_…progetti.png`. Restano vicine Anjazafohy/Ambohitsiroa (ΔE 6,1) e Agricoltura/Sport (ΔE 6,4), ma il nome è accanto |
| 6-D2 tre gialli nella riga | CHIUSO | Uscita #F6E6C0, «Da verificare» neutro #E9EDF3, DEMO neutro: `a_…movimenti.png` |
| 6-D3 ciambelle con colori doppi | CHIUSO | Le entrate usano sfumature di blu notte (#1E2B3C…#C2C8D1). Residuo: E2 #4C5A6E e Antanetibe #5B6F8C, nelle due ciambelle affiancate, hanno ΔE 8,2: `b_…analisi.png` |
| 6-D4 pastiglia Entrata neutra | CHIUSO | Fondo #1E2B3C |
| 6-D5 giroconto lilla | CHIUSO | #DDE8E8 |
| 6-D6 backup segnato come allarme | CHIUSO | Non è più nel «Da fare» |
| 6-D7 negativi rossi nel Report | CHIUSO | Rosso coerente con le altre pagine: `b_…report.png` |
| 6-D8 progetti e gruppi tutti gialli | CHIUSO (residuo) | Dashboard e Riepilogo sono colorati. In Riepilogo, la tabella «Per progetto» ha però tutte le barre gialle: `a_…preventivo_riepilogo.png` |
| 6-D9 sfumature dei conti | APERTO, parziale | Ora c'è il quadratino-legenda per ogni conto. Il quadratino di Cassa Italia #D6E3F3 su bianco ha contrasto 1,30: `a_…conti.png` |
| 6-D10 critica/fatta con la deuteranopia | PEGGIORATO | Critica/fatta: ΔE deut 7,7 (come prima). «Alta (finanziatori)» #E8B4A8 contro «fatta» #A8C3A1: ΔE deut **2,8** |
| 6-D11 previsto: traccia o barra | APERTO | Vedi 7-2 |
| 6-D12 giallo per «attenzione» | APERTO (riapparso) | /anticipi, riquadro «Da autorizzare»: barra #E8BE5A, cioè il giallo delle uscite: `a_…anticipi.png` |
| 6-D13 gruppo 04 uguale ad «Altri» | CHIUSO | #C9DDB4 contro #E3E8EF, ΔE 20,4 |
| 6-D14 logo saturo | APERTO | Impressione, non conta (marchio) |
| 7-1 gruppi con gli RGB dei progetti | CHIUSO | Le due palette non hanno colori in comune |
| 7-2 previsto che cambia colore | APERTO | /progetti «Previsto e speso»: barra blu #5B8FD6. Dashboard, /analisi?vista=budget e /progetti/<id>: tacca su traccia #D8E4F5 |
| 7-3 salmone per stati normali | APERTO | Dashboard: «Richieste di anticipo da autorizzare» con striscia corallo e icona #A3362E, come i ritardi. «Oggi» con testo #8A3B2C (vedi N1) |
| 7-4 Madagascar e anticipi | CHIUSO per gli anticipi, APERTO altrove | Anticipi ora ardesia #8497B0. Il lilla del Madagascar #A596E6 indica però anche «Applicato ai movimenti» in /cambi, e Ambohitsiroa è #D6B8D9 |
| 7-5 Cassa Madagascar senza quadratino | CHIUSO | #6E62A8 |
| 7-6 Anjazafohy e Piccolino uguali | CHIUSO | Vedi 6-D1 |
| 7-7 progetti poco distinguibili | PEGGIORATO | Nuova palette. Spese generali #A7D3DE contro Ambohitsiroa #D6B8D9: ΔE deut **1,5**. Antanetibe contro Piccolino: deut 3,6 (prima il caso peggiore era 5) |
| 7-8 sforamento indicato solo col colore | CHIUSO | Triangolo e testo rosso: `b_…progetti.png` |
| 7-9 icone del «Da fare» tutte su rosa | CHIUSO | Le voci ordinarie sono su #E9EDF3 |
| 7-10 negativi del Report non rossi | CHIUSO | |
| 7-11 Italia/Madagascar senza colori; barra in Media 2026 | APERTO | Il Report non usa i colori dei paesi. In «Media 2026» c'è una barra blu notte senza spiegazione: `b_…cambi.png` |
| 7-12 giallo per «da seguire» | CHIUSO nella legenda | La legenda ora è ardesia. Il giallo è tornato nel riquadro (6-D12) |
| 8-N1…N6 | non verificabili alla lettera | DIFETTI_PRECEDENTI non ne riporta la descrizione. Sulle pagine indicate ho visto: gruppi con gli stessi RGB su /, /preventivo e /progetti/<id> (coerenti); Liquidità IT/MG coerente tra Dashboard e /conti; Soglie ETS con «superata» neutro e percentuali in verde |

Conteggio sui 26 difetti con descrizione: **CHIUSO 16 · APERTO 8 · PEGGIORATO 2** (6-D10 e 7-7). Più 6 non verificabili (8-N1…N6).

## B. Difetti nuovi

| # | Grav. | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| N1 | P2 | /scadenze, /anticipi (operatore) · tutte | Il fondo di «Oggi», «Tra 8 gg» e «da autorizzare» è neutro (#EEF1F5), ma il testo è #8A3B2C: un rosso-marrone (ruggine) a ΔE 8,2 dallo «Scaduta» #B23B32. Così lo stato normale sembra ancora un allarme, e la tinta tocca il marrone escluso dal committente | `a_…scadenze.png` (inventario fg); `c_operatore_375__anticipi.png` |
| N2 | P2 | /, /anticipi, /scadenze · tutte | Lo stesso stato, «anticipo da autorizzare», ha quattro colori. Dashboard amministratore: corallo d'allarme. /anticipi: barra gialla delle uscite. Scadenze: «Oggi» ruggine. Dashboard operatore: striscia blu notte | `b_…1440__.png`, `a_…anticipi.png`, `c_operatore_375__.png` |
| N3 | P3 | /progetti/<id>, /preventivo/riepilogo | Il gruppo 09 «Oneri finanziari» è #E07F4F (terracotta), a ΔE 10 dal corallo degli sforamenti #E2917F, nella stessa scheda: sembra un allarme | `b_…progetti_9bb8….png` |
| N4 | P3 | /preventivo, /, /progetti/<id> | Il gruppo 05 #C9A227 è una senape satura che su area grande (44 % della ciambella) vira all'ocra. È l'unico colore non pastello della palette. Impressione | `b_…preventivo.png` |
| N5 | P3 | /progetti/<id>, Riepilogo | Il gruppo 08 #FBEFC4 ha contrasto 1,15 su bianco e 1,05 sulla traccia: la barra è invisibile | stesso |
| N6 | P3 | /preventivo, /preventivo/riepilogo | «Destinato ai progetti» (quota delle uscite) è in blu notte, che è il colore delle entrate | `b_…preventivo.png` |
| N7 | P3 | /anticipi · 1440 | L'importo di Fanomezantsoa, che ha le ricevute in ritardo (icona corallo), è in verde #23735F, il colore dell'avanzo e di «in regola» | `a_…anticipi.png` |
| N8 | P3 | /cambi | «Applicato ai movimenti» è tratteggiato nel lilla del Madagascar | `b_…cambi.png` |
| N9 | P3 | /progetti · 1440 | Il previsto blu #5B8FD6 e Bonne Semence #53A1C8 hanno ΔE deut 6,1, in due grafici affiancati | `b_…progetti.png` |

Positivi verificati:
- Testo sempre ≥ 4,5:1. Valori misurati: #646F82 su bianco 5,07; «Scaduta» 5,02; pastiglia verde 4,92; «automatica» 5,71.
- Entrate in blu notte, uscite in giallo e saldo in verde acqua, uguali in tutti i grafici.
- Legende presenti ovunque; «Altri» sempre grigio.
- Ardesia degli anticipi (#8497B0) ben separata dal giallo (ΔE 39).

## Voti

| Area | Giro 8 | Giro 9 | Motivo |
|---|---|---|---|
| Scelta delle tinte | 9 | **8,5** | Tre P3 (N1 in parte, N3, N4), oltre il limite di due. Peggioramento reale: arrivano con la nuova palette dei gruppi e con il nuovo testo di «Oggi» |
| Stesso significato, stesso colore | 7 | **7** | Due P2 (7-2, N2) più vari P3 (7-3, 7-4, N6, N7, N8) |
| Coerenza tra pagine, ruoli e lingue | 9 | **9** | IT/FR e le tre larghezze usano gli stessi colori (confronto degli inventari). Un solo P3 (barre gialle in «Per progetto») |
| Accessibilità del colore | 8 | **8** | Testo a norma. Un P2: progetti indistinguibili con la deuteranopia (7-7, ΔE 1,5), attenuato da etichette e percentuali. P3: 6-D10, 6-D9, N5 |
| Grafici | 8 | **8,5** | Ciambelle IT/EN non più doppie (6-D3 chiuso) e legende complete. Restano solo P3 (7-11, N9, residuo E2/Antanetibe) |

Calo in «Scelta delle tinte»: è un peggioramento reale. #C9A227 ed #E07F4F fanno parte della nuova palette dei gruppi, e il testo #8A3B2C del nuovo fondo neutro di «Oggi»: sono tutte correzioni successive all'ottavo giro, quindi non sono difetti sfuggiti prima.

Interventi in ordine di effetto:
1. «Da autorizzare», «Oggi» e «Tra N gg»: un solo stile neutro con testo #4A5B73. Corallo e rosso restano solo per scaduto e sforato.
2. Previsto: sempre una tacca su traccia, togliendo la barra blu da /progetti.
3. Gruppo 09: da terracotta ad albicocca chiaro. Gruppo 05: senape più chiara (circa #DDBF5E). Gruppo 08: più scuro (circa #EBD58F).
4. Progetti: dare a Spese generali o ad Ambohitsiroa una luminosità diversa (ΔL ≥ 20), così da separarli anche con la deuteranopia.
5. Usare il lilla solo per il Madagascar (cambiare il colore della linea «Applicato» in /cambi).
