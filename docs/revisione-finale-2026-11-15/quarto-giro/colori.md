# YouCount: revisione dei colori (palette, semantica, accessibilità)

Revisore indipendente, 16/11/2026. Ho misurato i colori calcolati dal browser (sfondi, riempimenti e tratti SVG, bordi, testo) su 36 pagine, a 1440 e a 375 px, con super_admin (IT) e admin_fr (FR).
- Misure: `/tmp/yc-final/work/colori_{super_admin,admin_fr}_{1440,375}.json`
- Script in `/tmp/yc-final/work/colori/`: `collect.mjs` raccoglie; `inv.py` fa l'inventario; `cons.py` collega nome e colore; `contrast.py` calcola WCAG; `cvd.py` simula le discromie (Machado, ΔE Lab); `stab.mjs` controlla la stabilità.
- Schermate: `/tmp/yc-final/work/c_*.png`
- admin_fr vede dati con id diversi: i confronti IT/FR sono fatti per nome.

## Risposta secca
**La palette è quella giusta, ma l'uso dei colori non è coerente ovunque.**

Cosa va bene:
- I colori di base (blu notte, giallo, verde acqua, lilla, cielo, oliva, rosa, ardesia) sono tenui, piatti e senza marrone.
- Le voci di spesa e le entrate E1–E4 hanno sempre lo stesso colore in tutte le pagine, a tutte le larghezze e in IT e FR.

Cosa non va:
1. **I progetti non hanno un colore fisso.** Lo stesso progetto ha cambiato colore più volte nella stessa giornata.
2. **Italia e Madagascar hanno due schemi diversi.** Sono cielo/lilla nelle barre della liquidità, ma blu notte/verde acqua nelle pastiglie IT/MG, anche sulla stessa pagina.
3. **Alcuni colori «riservati» sono usati con altri significati:**
   - corallo per l'icona di StreetFood e per «Oggi»;
   - verde per «Entrata» nel registro;
   - giallo per la priorità «alta».

## Inventario (dettaglio in `work/colori/inv_sa1440.txt`)
| Colore | Significati osservati |
|---|---|
| #1e2b3c blu notte | Entrate; «IT»/«Italia»; soglie ETS |
| #2e3d52 blu notte 2 | Pulsanti; Entrate nel grafico della Dashboard |
| #e8be5a giallo (croma 55, il più acceso) | Uscite; «alta», «da seguire» |
| #5fb8a3 verde acqua (+ #23735f testo) | Saldo; «MG»/«Madagascar»; stati «ok»; importi delle entrate |
| #5b8fd6 blu (+ #2f69c2 solo su /cambi) | Previsto, tasso del mese, concesso |
| #e2917f corallo (+ #fbe9e6, #a3362e) | Sforamento, ritardo; anche «Oggi» e StreetFood |
| #a596e6 lilla, #8fafd6 cielo, #b9c47a oliva, #e3a6c2 rosa, #5b6f8c ardesia, #c9d6ea nebbia, #d6dde6 altri | Voci, entrate E1–E4, progetti, conti, paesi (barre), calendario |

## Verifiche
**(b) Semantica.**
- Rispettati nei grafici: entrate in blu notte, uscite in giallo, saldo in verde acqua, previsto in blu, sforamento in corallo (schermate c_anal__1, c_prog__1, c_prog__2: l'anello di Piccolino al 128 % è corallo, gli altri sono gialli).
- Violazioni:
  - nel registro «Entrata» ha la pastiglia verde acqua (#e2f2ed) e l'importo verde (+8.157,37 €), mentre «Uscita» ha la pastiglia azzurra (#e3eaf4) (c_mov__1);
  - il verde acqua indica anche Madagascar e lo stato «tutto ok»;
  - il blu notte indica anche l'Italia;
  - il corallo compare su «Oggi» (non è un ritardo) e sull'icona di StreetFood, che è all'86 % (c_prog__2);
  - il giallo indica anche la priorità «alta» e le pastiglie d'attenzione.

**(c) Pagine e lingue.**
- Le voci sono coerenti nelle 4 combinazioni (cons.txt): Risorse umane = lilla, Viaggi = cielo, Attività = oliva, Investimenti = ardesia, Sede = nebbia, E1 = rosa, E2 = ardesia, E3 = nebbia, E4 = lilla.
- I progetti no, come mostra la tabella sotto.

| Ora / vista | Spese generali | École Antanetibe | École Ambohitsiroa |
|---|---|---|---|
| IT 1440, raccolta 1 (json) | ardesia | oliva | cielo |
| FR 1440 (json) | cielo | oliva | rosa |
| IT 375 /analisi (json) | ardesia | cielo | oliva |
| IT 1440 / FR 1440, stab.mjs e c_prog__1 | ardesia | cielo | oliva |
| IT 375 c_anal375__2, FR 375 c_progfr375__1 | **oliva** | **ardesia** | cielo |

- Entro un solo caricamento /progetti e /analisi coincidono: il colore segue la posizione o lo stato dei dati, non il progetto.
- Le icone dei progetti hanno un terzo schema, per tipo: le scuole in verde acqua, StreetFood in corallo, Sport in giallo.
- Le entrate sono #2e3d52 sulla Dashboard e #1e2b3c altrove (ΔE 8: si nota appena).

**(d) Contrasto.**
- Testo: nessun caso sotto AA in 4 × 36 pagine. Gli unici 4 casi segnalati dallo script sono falsi positivi (i segni di 2 px delle soglie ETS).
- Elementi grafici rispetto al bianco: giallo 1,76:1, verde acqua 2,37, lilla 2,59, cielo 2,27, nebbia 1,47, «altri» 1,37. Sono sotto 3:1, ma i valori sono anche scritti in legenda, quindi il problema è attenuato.

**(e) Discromie.**
- Entrate, uscite e saldo restano ben distinti (ΔE ≥ 45 anche in deuteranopia e protanopia).
- Coppie deboli:
  - nebbia #c9d6ea e «altri» #d6dde6: ΔE 7 per tutti, e stanno vicine nell'anello e nella barra a pila (c_dash__1);
  - cielo e lilla: ΔE 15 in deuteranopia (barra Italia/Madagascar; calendario normale/promemoria, dove conta solo il colore);
  - rosa e «altri»: ΔE 12 in deuteranopia;
  - verde acqua e corallo: ΔE 13 in protanopia.

## Voti
| Area | Voto | Funziona | Non funziona | Per arrivare a 10 |
|---|---|---|---|---|
| Aderenza alla palette | 8 | Pastelli piatti su fondo chiaro, blu notte forte, niente marrone | Giallo #e8be5a e blu #2f69c2 più accesi del resto; rossi delle icone | Giallo più tenue (es. #ecc977); togliere #2f69c2 e usare #5b8fd6 |
| Coerenza semantica | 6 | Grafici fedeli alla regola; corallo usato bene negli sforamenti | «Entrata» verde, «Uscita» azzurra; verde acqua e blu notte usati anche per i paesi; corallo su «Oggi» e su StreetFood; giallo per «alta» | Pastiglie: Entrata blu notte, Uscita gialla; paesi solo cielo/lilla; «Oggi» neutro o blu; icone dei progetti in tinte senza significato |
| Coerenza fra pagine e lingue | 5,5 | Voci ed entrate identiche ovunque, IT = FR | Colori dei progetti instabili (5 schemi visti); due schemi per i paesi; due blu notte per le entrate | Colore fisso salvato per ogni progetto e conto; un solo schema per i paesi; un solo blu notte nei grafici |
| Accessibilità del colore | 7,5 | Testo tutto AA; punti del saldo con bordo bianco; valori sempre scritti | nebbia ≈ «altri»; cielo/lilla deboli in deuteranopia; segmenti pastello < 3:1 | «Altri» grigio più scuro o tratteggiato; separatore bianco di 2 px fra i segmenti; icona o etichetta per la priorità nel calendario |
| Armonia complessiva | 8 | Insieme calmo e ordinato, schede simmetriche, legende allineate | Tre famiglie di colori per i progetti; colori di stato che si mescolano a quelli dei dati | Separare nettamente i colori dei dati da quelli di stato |

## Difetti
| # | Gr. | Pagina | Largh. | Colore | Prova |
|---|---|---|---|---|---|
| 1 | P1 | /progetti, /analisi | 1440, 375, IT e FR | #5b6f8c / #8fafd6 / #b9c47a … | Lo stesso progetto cambia colore fra un caricamento e l'altro (tabella in c; c_prog__1 rispetto a c_anal375__2 e c_progfr375__1) |
| 2 | P2 | /, /conti, /riconciliazione, /admin/impostazioni | tutte | #1e2b3c, #5fb8a3 | Pastiglie IT/MG in blu notte/verde acqua, mentre la barra della liquidità usa cielo/lilla (c_dash__2, c_conti__1) |
| 3 | P2 | /movimenti, /verifica | tutte | #e2f2ed, #23735f, #e3eaf4 | Entrata verde e Uscita azzurra, contrarie ai grafici (c_mov__1) |
| 4 | P2 | /progetti, /admin/progetti | tutte | #fbe9e6, #a3362e | Icona di StreetFood in corallo e rosso senza sforamento (c_prog__2) |
| 5 | P2 | /, /preventivo, /analisi, /progetti | tutte | #c9d6ea e #d6dde6 | ΔE 7, segmenti vicini quasi uguali (c_dash__1) |
| 6 | P3 | / | 1440, 375 | #2e3d52 e #1e2b3c | Le entrate hanno due blu notte diversi (json) |
| 7 | P3 | /scadenze, / | tutte | #fbe9e6, bordo rosso | «Oggi» e «1 spesa da rimborsare» in rosso senza ritardo (c_scad__2, c_dash__1) |
| 8 | P3 | /scadenze, /anticipi | tutte | #e8be5a | Il giallo delle uscite è usato per «alta» e «da seguire» |
| 9 | P3 | /scadenze, /conti | tutte | #8fafd6 e #a596e6 | ΔE 15 in deuteranopia, dove conta solo il colore |
| 10 | P3 | /cambi | 1440 | #2f69c2 | Blu acceso fuori dalla palette (json) |
