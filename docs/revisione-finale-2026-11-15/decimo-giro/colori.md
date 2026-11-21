# Colori: decimo giro (revisore indipendente)

Misure: inventario dei colori calcolati nel browser (`work/c10/inv.mjs`, `sw.mjs`). ΔE = CIEDE2000; «deut» = ΔE dopo simulazione della deuteranopia (Machado); CR = contrasto WCAG.
Schermate in `/tmp/yc-final/work/c10/`. Ruoli e larghezze: super_admin 1440 (17 pagine e /verifica), admin_fr 1440, responsabile 768, operatore 375.

## A. Riverifica dei difetti precedenti

| Difetto | Esito | Prova |
|---|---|---|
| 6-D1 icona colora il tipo | CHIUSO | Ora ogni progetto ha la sua tinta (8 tessere diverse, `adm_prog.png`). Resta una coppia vicina (vedi B5) |
| 6-D2 tre gialli in riga | CHIUSO | Uscita gialla; «Da verificare» #E9EDF3/#34445A; DEMO neutro (`mov_top.png`) |
| 6-D3 ciambelle con colori doppi | CHIUSO | /analisi: entrate nella scala blu notte, uscite nei colori dei progetti (`sa1440__analisi.png`) |
| 6-D4 Entrata neutra | CHIUSO | Pastiglia #1E2B3C con testo bianco |
| 6-D5 giroconto lilla | CHIUSO | #DEE8E8/#2F5557 (grigio-verde) |
| 6-D6 backup come allarme | CHIUSO | Nelle prime 7 righe di «Da fare» non compare. Le voci normali hanno la striscia blu notte, gli allarmi corallo |
| 6-D7 negativi rossi nel Report | CHIUSO | I saldi negativi sono rossi come altrove (`sa1440__report.png`) |
| 6-D8 progetti e gruppi gialli | CHIUSO | Dashboard e /progetti usano i colori dei progetti. In Riepilogo e «Per progetto» il giallo indica «uscite», non il progetto: è coerente |
| 6-D9 sfumature dei conti | APERTO, parziale | MG ora distinti (ΔE 15–19). Banca Italia #8FAFD6 e Satispay #ACC6E6 hanno ΔE 6,6. Cassa Italia #D6E3F3 sulla traccia ha CR 1,19 |
| 6-D10 critica/fatta in deuteranopia | APERTO | #E2917F contro #A8C3A1: ΔE deut 7,7 |
| 6-D11 previsto traccia o barra | CHIUSO, con un residuo | Azzurro #D8E4F5/#DBE6F6 in /progetti, nel progetto, in /analisi e nel budget. Residuo: la scheda «Preventivo» della Dashboard ha solo tacca nera e traccia grigia |
| 6-D12 giallo per «attenzione» | CHIUSO | «vicino al limite» #EEF1F5 neutro |
| 6-D13 gruppo 04 come «Altri» | CHIUSO | #C9DDB4 contro #E3E8EF: ΔE 20,4 |
| 6-D14 logo saturo | APERTO | Impressione invariata. Probabilmente è il marchio e va lasciato |
| 7-1 gruppi con gli RGB dei progetti | CHIUSO | Gruppi: gialli, verdi, arancio. Progetti: petrolio, rosa, lilla. Nessun RGB in comune |
| 7-2 previsto che cambia colore | CHIUSO | Vedi D11. /cambi non usa più il blu |
| 7-3 salmone per stati normali | CHIUSO | «Oggi» e «Tra N gg» su #EEF1F5/#34445A |
| 7-4 Madagascar e anticipi | CHIUSO | MG è lilla in Liquidità, nei conti e nel badge (#A596E6). Gli anticipi sono ardesia #8497B0 (`sa1440__conti.png`) |
| 7-5 Cassa MG senza quadratino | CHIUSO | #6E62A8 |
| 7-6 Anjazafohy come Piccolino | CHIUSO | #89BBB7 contro #FFD7DD |
| 7-7 progetti poco distinguibili | APERTO (cambiato) | Ora ci sono tre rosa: Ambohitsiroa #CC8990, Piccolino #FFBAC4, Sport #CDAEB3. Sport/Piccolino: ΔE 10,6, deut 7,4. Antanetibe/StreetFood: deut 7,1 |
| 7-8 sforamento solo col colore | CHIUSO | ▲, testo rosso, «oltre di 3.334 €» |
| 7-9 icone «Da fare» su rosa | CHIUSO | Icone grigie sulle voci ordinarie (`re_dash.png`) |
| 7-10 negativi del Report | CHIUSO | Rossi |
| 7-11 Italia/MG senza colori; barra in Media 2026 | APERTO | La tabella del Report non ha i colori dei paesi. In «Media 2026» la barra blu notte (novembre) non ha spiegazione (`sa1440__cambi.png`) |
| 7-12 giallo «da seguire» | CHIUSO | Legenda Anticipi: «da seguire» in ardesia |
| 8-N1…N6 | Senza descrizione: ho verificato solo le pagine | N1 (/, /preventivo, progetto): i colori dei gruppi restano, vedi 9-N3/N4. N2 (stati di attenzione): CHIUSO. N3 (gruppo 08): vedi 9-N5, APERTO. N4 (Soglie ETS): nessun difetto di colore visto. N5 (/progetti operatore 375): nessun difetto. N6 (/conti e Dashboard): la Liquidità MG è coerente |
| 9-N1 ruggine su stati normali | CHIUSO | Testo #34445A (CR 8,7) al posto di #8A3B2C |
| 9-N2 «da autorizzare» in 4 colori | CHIUSO | Neutro ovunque: striscia blu notte in Dashboard (amministratore e operatore), barra ardesia in /anticipi, «Oggi» neutro in Scadenze |
| 9-N3 gruppo 09 terracotta | APERTO | #E07F4F nella stessa scheda dello sforamento #E2917F (ΔE 10) (`…progetti_6d15….png`) |
| 9-N4 senape 05 | APERTO | #C9A227 (C* 64) nel 44 % della ciambella |
| 9-N5 gruppo 08 invisibile | APERTO | #FBEFC4: CR 1,15 su bianco |
| 9-N6 «Destinato» blu notte | CHIUSO | Ora giallo (uscite) |
| 9-N7 importo verde con ritardo | CHIUSO | Importo #1E2B3C |
| 9-N8 «Applicato» lilla | CHIUSO | Tratteggio ardesia |
| 9-N9 previsto contro Bonne Semence | CHIUSO | #D8E4F5 contro #C8BCDC: ΔE 14,8, deut 8,1 |

**Conteggio** (35 voci con esito; le 6 voci dell'ottavo giro senza descrizione non sono contate): CHIUSO 26 · APERTO 9 (D9, D10, D14, 7-7, 7-11, 9-N3, 9-N4, 9-N5; 8-N3 coincide con 9-N5) · PEGGIORATO 0.

## B. Esame libero: difetti nuovi

| # | Grav. | Pagina · larghezza | Descrizione | Prova |
|---|---|---|---|---|
| B1 | **P2** | / e /scadenze · tutte | La stessa scadenza ha due stati e due colori. «Rendicontazione intermedia… 20/11» è «scaduta da 1 g» con pastiglia corallo #FBE9E6/#A3362E in Dashboard, ma «Oggi» neutro in /scadenze. Anche il calendario segna il 20 come oggi, mentre la Dashboard dice «oggi 21/11/2026». Visto alle 01:15 ora del Madagascar. Il calcolo di «oggi» sembra diverso tra le due pagine, quindi un utente in Madagascar vede un allarme in una pagina e uno stato normale nell'altra | `text.mjs` su / e /scadenze; `sa1440__scadenze.png` |
| B2 | P3 | /scadenze · 375/1440 | «Errore segnalato: MOV-2026-006» porta la striscia #D9A6C9 e la pastiglia #F5E8F1, cioè il malva della priorità «alta (finanziatori)». Una segnalazione d'errore non è una scadenza di un finanziatore | pixel in `op375__scadenze.png` (y 1840) |
| B3 | P3 | /scadenze, /progetti | Lo stesso azzurro ha tre significati: «promemoria» #C9D6EA, previsto #D8E4F5 (ΔE 3,4) e il fondo delle icone di sezione #C9D6EA. Il previsto si distingue appena dalla traccia neutra #E3EAF4 (ΔE 3,3, CR 1,06). Il quadratino «Previsto» della legenda ha CR 1,29 su bianco | `sw.mjs` /scadenze, /progetti |
| B4 | P3 | /progetti, /admin/progetti, Dashboard | Il secondo piano della nuova palette dei progetti è sbilanciato. Le tessere hanno chiarezze diverse: Antanetibe, Anjazafohy e Sapone sono intorno a L* 72, Piccolino, Bonne Semence e Agricoltura intorno a L* 88–90. Ci sono quattro rosa o malva: Ambohitsiroa #E1BBBF, Piccolino #FFD7DD, Sport #E2D0D3, Sapone #BFAFB3, con ΔE 7,6–8,5 tra loro. Sapone #BFAFB3 (C* 6) è un grigio talpa che tende al marrone smorto (impressione). | `adm_prog.png`, `ce.py` |
| B5 | P3 | /admin/progetti, /progetti | Le tessere di Anjazafohy #89BBB7 e Antanetibe #86B9C7 hanno ΔE 7,7. La tessera di Antanetibe è quasi identica al colore di Spese generali nei grafici (#85BABB, ΔE 5,8), nella stessa pagina | `sa1440__progetti.png` |
| B6 | P3 | /analisi?vista=budget · 1440 | Nella stessa tabella le barre delle entrate sono blocchi alti circa 30 px, quelle delle uscite sono linee di 6 px: manca la simmetria. È anche l'unico punto in cui il blu notte pieno supera il 100 % senza segno | `crop_budget2.png` |
| B7 | P3 | /preventivo/riepilogo | «Per progetto»: i saldi negativi strutturali dei progetti senza entrate a preventivo (Antanetibe −27.833 €) sono in rosso allarme, come uno sforamento | `riep_small.png` |

Coerenza tra ruoli, lingue e larghezze: gli insiemi di colori di /, /scadenze, /progetti, /anticipi, /analisi e /conti sono identici tra super_admin IT, admin_fr, responsabile 768 e operatore 375. Le differenze trovate dipendono solo dai dati. Contrasto del testo: nessun testo reale sotto 4,5:1. I casi segnalati dallo script sono falsi positivi (etichette del righello ETS) e il logo.

## Voti

| Area | Giro 9 | Giro 10 | Motivo |
|---|---|---|---|
| Scelta delle tinte | 8,5 | **8,5** | Palette tenue e sobria. Restano tre P3: senape 05 (9-N4), tessere sbilanciate con Sapone talpa (B4), logo (D14) |
| Stesso significato, stesso colore | 7 | **8** | Chiusi 9-N1, N2, N6, N7, N8 e 7-2, 7-4. Resta un P2 (B1) e alcuni P3 (9-N3, B2, B3, 7-11, residuo D11) |
| Coerenza tra pagine, ruoli e lingue | 9 | **9** | Inventari identici in IT/FR, nei 4 ruoli e alle 3 larghezze |
| Accessibilità del colore | 8 | **8** | Nessun P2. P3: D9, D10, 9-N5 (CR 1,15), legenda del previsto (CR 1,29), progetti rosa in deuteranopia (7-7) |
| Grafici | 8,5 | **8,5** | Legende presenti e colori stabili; «Altri» distinto. P3: B5, B6, residuo D11 |

Nessuna area scende. «Stesso significato» sale di un punto perché i quattro P2 del nono giro sono chiusi. B1 era probabilmente presente anche prima ma non era stato visto: dipende dall'ora della prova, cioè dalla mezzanotte in Madagascar.

## Cosa impedisce il 10 (in ordine di effetto)
1. Calcolare «oggi» allo stesso modo in Dashboard e Scadenze (B1).
2. Dare alla segnalazione d'errore un colore proprio o neutro (B2).
3. Ammorbidire i gruppi 05 #C9A227 e 09 #E07F4F; scurire il gruppo 08 #FBEFC4 (9-N3/N4/N5).
4. Uniformare la chiarezza delle tessere dei progetti. Sostituire uno dei rosa (Sport o Sapone) con una tinta libera, per esempio un salvia chiaro o un azzurro polvere, e separare Anjazafohy da Antanetibe (B4, B5, 7-7).
5. Dare al previsto un azzurro un po' più deciso del neutro, per esempio #C3D5EE, e distinguerlo da «promemoria» (B3). Mostrarlo anche nella scheda «Preventivo» della Dashboard.
6. Usare barre di uguale spessore per entrate e uscite nella vista budget (B6).
