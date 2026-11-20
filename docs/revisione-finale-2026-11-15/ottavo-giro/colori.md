# Colori: revisione indipendente, 8° giro (20/11/2026)

Metodo: 40 visite di pagina con Playwright, sempre un solo browser. Ruoli e larghezze: super_admin 1440; admin_fr 1440 e 375; operatore 375; responsabile 768.
Per ogni pagina ho fatto la schermata intera e ho raccolto i colori calcolati (fondi, fill e stroke SVG). Ho misurato anche il contrasto di ogni testo sul suo fondo reale.
Le distanze tra colori sono ΔE2000. La simulazione di deuteranopia e protanopia usa Machado 2009 a gravità 1.
Prove in `/tmp/yc-final/work/col/`: schermate `a_*` (1440 IT), `b_*` (scheda progetto e movimento), `c_*` e `d_*` (FR, operatore, responsabile), ritagli `v_*.png`, inventari `*.json`, script `py/de.py`.

Contrasto del testo: 0 testi sotto 4,5:1 (3:1 per i testi grandi) in tutte le visite. Fanno eccezione 4 etichette dell'asse in /scadenze, che sono falsi positivi: testo nascosto con lo stesso colore del fondo.
Lingua e ruolo: gli inventari dei colori FR e IT sono identici pagina per pagina (`c_admin_fr_1440.json` contro `a_super_admin_1440.json`). Operatore e responsabile non introducono tinte nuove.

## A. Riverifica dei difetti precedenti

| # | Gr. | Esito | Prova |
|---|---|---|---|
| 6-D1 icona colora il tipo | P2 | APERTO, attenuato (ora P3) | Ogni icona ha la tinta del suo progetto (`v_admin_progetti_0.png`), ma le tinte sono quasi uguali. ΔE: Ambohitsiroa/Sport 3,4, Piccolino/Bonne Semence 3,4, Agricoltura/Sapone 3,9 (deut 0,6). |
| 6-D2 tre gialli nella riga | P2 | CHIUSO | `crop_mov.png`: «Da verificare» grigio #e9edf3, DEMO #f2f5f9. Resta giallo solo la tessera delle uscite. |
| 6-D3 ciambelle con colori doppi | P2 | APERTO, attenuato (ora P3) | `v_analisi_0.png`: nessun colore identico tra le due ciambelle, ma E3 #8a94a3 e Bonne Semence #8497b0 sono affiancati con ΔE 4,1. |
| 6-D4 pastiglia Entrata neutra | P3 | CHIUSO | Tessera entrata blu notte #1e2b3c. |
| 6-D5 giroconto lilla | P3 | CHIUSO | Fondo #dee8e8 e icona #2f5557 (`v_ver.png`). |
| 6-D6 backup segnato come allarme | P3 | CHIUSO | Striscia blu notte, icona grigia (`a_super_admin_1440__.png`). |
| 6-D7 negativi rossi nel Report | P3 | CHIUSO (superato) | Scelta unica: negativi rossi ovunque (Report, Conti, Residui), coerente con 7-#10. |
| 6-D8 progetti e gruppi tutti gialli | P3 | CHIUSO | Dashboard «Uscite per progetto» ha i colori dei progetti. Il Riepilogo ha le barre nel colore del gruppo (`v_preventivo_riepilogo_0.png`). |
| 6-D9 sfumature dei conti | P3 | APERTO, parziale | Ora c'è la legenda a quadratini e i conti malgasci sono distinti. Restano Cassa Italia #c3d5ec e Satispay #b0c7e4 con ΔE 4,1, e il segmento #c3d5ec sulla traccia con contrasto 1,37 (`v_conti.png`). |
| 6-D10 critica/fatta con la deuteranopia | P3 | APERTO | #e2917f contro #a8c3a1: deut ΔE 7,7, invariato. |
| 6-D11 previsto: traccia o barra | P3 | APERTO | Vedi 7-#2. |
| 6-D12 giallo per «attenzione» | P3 | CHIUSO | Non è più giallo. Il problema si è spostato sul pesca (7-#3). |
| 6-D13 gruppo 04 uguale ad «Altri» | P3 | CHIUSO | #f7edcb contro #e3e8ef: ΔE 17,3. |
| 6-D14 logo saturo | P3 | APERTO | Impressione. Probabilmente è il marchio e va lasciato. |
| 7-1 gruppi con gli RGB dei progetti | P2 | CHIUSO | I gruppi sono ora nella banda giallo-ocra. Nessun RGB in comune con i progetti. |
| 7-2 previsto che cambia colore | P2 | APERTO | In /progetti è una barra blu #5b8fd6 (`v_progetti_0.png`). Nella scheda progetto è una traccia grigia (`v_prog1_0.png`), in Dashboard e /analisi?vista=budget una tacca. Il blu in Cambi è sparito. |
| 7-3 salmone per stati normali | P2 | APERTO, attenuato (ora P3) | «Da verificare» e «Da rimborsare» sono ora grigi. Restano «Oggi», «Tra 9 gg», «vicino al limite» e «oggi» (errore segnalato) su #fbe7e0, contro lo scaduto #fbe9e6: ΔE 1,9. Li distingue solo il colore del testo (`v_scad_low.png`, `v_resp768.png`). |
| 7-4 Madagascar e anticipi | P2 | APERTO | Il Madagascar è ora coerente (#a596e6 in Liquidità e nei conti). Gli anticipi però sono lilla #a596e6 in /anticipi e grigio-blu #8497b0 nella tessera «Anticipi aperti» di /conti: stesso dato, 218 €. |
| 7-5 Cassa Madagascar senza quadratino | P3 | CHIUSO | Quadratino #6e62a8. |
| 7-6 Anjazafohy e Piccolino uguali | P3 | CHIUSO | Rosa #e7ced9 contro ardesia #c7ced8. |
| 7-7 progetti poco distinguibili | P3 | APERTO | Visione normale ≥ 13,5. Con la deuteranopia Antanetibe/Bonne Semence 3,2, Antanetibe/Sport 4,6, Ambohitsiroa/Piccolino 6,2. |
| 7-8 sforamento indicato solo col colore | P3 | CHIUSO | Ora c'è «▲» con l'importo in rosso. |
| 7-9 icone del «Da fare» tutte su rosa | P3 | CHIUSO | Voci ordinarie con icona grigia e striscia blu notte. |
| 7-10 negativi del Report non rossi | P3 | CHIUSO | `v_report_0.png`. |
| 7-11 Italia/Madagascar senza colori; barra in Media 2026 | P3 | APERTO | Le colonne del Report non hanno i colori dei paesi. La barra blu notte in «Media 2026» non ha spiegazione (`v_cambi.png`). |
| 7-12 giallo per «da seguire» | P3 | CHIUSO | Ora grigio #8497b0 (`v_anticipi.png`). |

**Totale: 15 CHIUSO · 11 APERTO · 0 PEGGIORATO.**

## B. Difetti nuovi

| # | Gr. | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| N1 | P2 | /, /preventivo, /progetti/<id> · tutte | Introdotto dalla correzione 7-1: gli 8 gruppi di spesa stanno tutti in H 40–50° (tranne 03, arancio). Coppie troppo vicine: 05/06 ΔE 7,1 (deut 3,3), 02/09 6,8, 04/09 6,0, 01/08 9,1 (deut 5,0). La barra del gruppo 04 #f7edcb sulla traccia ha contrasto 1,07: quasi invisibile. | `v_prog1_0.png` (Voci di spesa), `grp.txt` |
| N2 | P2 | /progetti, /scadenze, /conti, /anticipi | Una tinta, più significati. #8497b0 è insieme Bonne Semence, la priorità «normale», «da seguire» e «Anticipi aperti». #9c8aa5 è Antanetibe e la priorità «alta». #e8be5a è le Uscite e il gruppo 05. | `a_super_admin_1440.json`, `v_scadenze.png` |
| N3 | P3 | /progetti/<id>, /preventivo | Ocra #c1952f (H42 S61 L47) e kaki #a99a4e (H50 S37 L48) vanno verso il marrone e il fango: vicini al divieto. Impressione, con misura. | `v_prog1_0.png` |
| N4 | P3 | /scadenze, Soglie ETS · 1440 | Le entrate sono in verde acqua #5fb8a3 (colore del saldo) e non in blu notte. Il testo dice «tacca lilla», ma la tacca è #c9d6ea, azzurrina, con contrasto 1,34. | `v_scad_low.png` |
| N5 | P3 | /progetti · 375 operatore | La legenda mostra «Previsto» in blu, ma non c'è nessuna barra blu: l'operatore non ha preventivo. | `op_combo2.png` |
| N6 | P3 | /conti e Dashboard | Saldi positivi verdi in /conti, neri in «Saldo dei conti» della Dashboard. | `v_conti.png`, `a_super_admin_1440__.png` |

## Voti

| Area | 7° | 8° | Cosa conta (griglia) |
|---|---|---|---|
| Scelta delle tinte | 8,5 | **9** | N3 e D14 (due P3). La palette resta tenue: blu notte, pastelli, sfondo #f2f5f9. |
| Stesso significato, stesso colore | 6,5 | **7** | Tre P2: 7-2, 7-4, N2. Più i P3 7-3 e N6. |
| Coerenza tra pagine, ruoli e lingue | 8,5 | **9** | FR identico all'IT. Operatore e responsabile senza tinte nuove. Un P3 (N5). |
| Accessibilità del colore | 7,5 | **8** | Contrasto del testo sempre ≥ 4,5. Lo sforamento ha anche un simbolo. P3: D10, D9, D1, 7-3. |
| Grafici | 7,5 | **8** | Un P2 (N1). P3: D3, 7-7, 7-11, N4. |

Nessuna area scende rispetto al 7° giro.

## Cosa impedisce il 10 (in ordine di effetto)
1. Il previsto con un'unica grafica in tutta l'app: traccia più tacca, da usare anche in /progetti al posto del blu.
2. Allargare i gruppi di spesa a due famiglie, per esempio giallo e verde-salvia, con distanza ΔE ≥ 12 e un passo di luminosità, e il gruppo 04 almeno al 3:1 sulla traccia. Se possibile, toglierli dalla banda kaki.
3. Un colore per gli anticipi, uguale in /conti e /anticipi, che non sia né lilla (Madagascar) né il colore di un progetto. Tinte di priorità che non coincidano con quelle dei progetti.
4. «Oggi», «Tra N gg» e «vicino al limite» su un fondo neutro o giallo pallido, distinti dallo scaduto non solo per il testo.
5. Tinte delle icone di progetto più sature; Cassa Italia e Satispay da separare.
