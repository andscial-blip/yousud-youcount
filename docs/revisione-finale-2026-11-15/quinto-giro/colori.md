# YouCount · Revisione colori (16/11/2026)

**Risposta secca.** La palette è quella giusta: piatta, pastello su fondo chiaro, blu notte, niente marrone. Entrate, uscite, saldo e sforamenti hanno i colori giusti ovunque. Non è però coerente ovunque, perché i colori di progetti, voci e conti non restano legati all'elemento. Quando i dati cambiano, si spostano (verificato due volte). Due progetti hanno lo stesso rosa. Lilla e cielo vogliono dire sia «Madagascar/Italia» sia «una voce o un progetto qualsiasi».

**Metodo.** Playwright: colori calcolati su 26 pagine + dettagli; super_admin e admin_fr a 1440 e 375; pagine con progetti caricate 2 volte. Prove in `/tmp/yc-final/work/colori/`: `sa1440.json` (inventario completo), `leg_sa1440_run1.json` (1° giro), `leg_super_admin_1440.json` (2° giro, ~40 min dopo), `leg_admin_fr_1440.json`, `leg_super_admin_375.json`, schermate `super_admin_1440_*.png`. Altre schermate in `/tmp/yc-final/work/col_fr_prog__1.png`, `col375_home__1.png` e `col375_fr_conti__1.png`. Contrasto e discromie: `cvd.mjs`.

## Inventario (colore → dove → significato)

| Colore | Dove | Significato | Esito |
|---|---|---|---|
| #2e3d52 / #1e2b3c | barre entrate (dashboard, preventivo / progetti, analisi, report, finanziamenti) | entrate | ok, ma due toni (ΔE 8,5) |
| #e8be5a | barre uscite, anelli progetto, «Speso» | uscite | ok; usato anche come «da seguire» |
| #fff3d3 + bordo giallo | pastiglie «Da verificare», «Da fare» in dashboard, chip in Conti | attenzione | il giallo vuol dire anche questo |
| #5fb8a3 / testo #23735f | avanzo, saldo, residuo; anche «Verificato», «in regola», soglie ETS | saldo / esito positivo | ok, un po' sovraccarico |
| #5b8fd6 | «Previsto», «Tasso del mese»; anche KPI «Movimenti» e «Prossimi 14 gg» | previsto | uso improprio sui conteggi |
| #e2917f, #b23b32, #a3362e, #fbe9e6 | Piccolino oltre il preventivo, saldo previsto negativo, anticipi in ritardo, scadute | sforamento/ritardo | ok |
| #8fafd6 cielo / #a596e6 lilla | pastiglie IT/MG, barra Liquidità | Italia/Madagascar | ok, ma gli stessi colori sono usati anche per voci, progetti, conti, giroconto e riconciliazione |
| #5b6f8c, #b9c47a, #e3a6c2, #c9d6ea, #adb9ca | voci, progetti, conti, entrate E1–E4 | tinte delle voci | colore assegnato in base alla posizione, non all'elemento |
| #e5eef8/#2f5f9e, #f8e8f0, #eef2dc, #eeebfa | icone dei progetti (per tipo di attività) | categoria | non sono i colori dei grafici |

Lingue: allo stesso momento IT e FR hanno colori identici su tutte le 12 pagine controllate. Ricaricando, i colori restano uguali (2/2 su tutte le pagine, in entrambe le lingue). 375 px = 1440 px.

## Voti

| Area | Voto | Funziona | Non funziona | Per il 10 |
|---|---|---|---|---|
| Aderenza alla palette | 8,5 | Grafica piatta e pastello, blu notte, nessun marrone, fondi chiari | #5b8fd6 più saturo del resto; in /cambi tre blu fuori serie (#9dc3e6, #6f8fbf, #3f6491) | Schiarire il blu del previsto e ridurre /cambi alla palette base |
| Coerenza semantica | 6,5 | Entrate, uscite, saldo e sforamenti corretti in tutte le pagine; Registro: uscita giallo, entrata blu notte | Il giallo vuol dire anche «da verificare»; il blu del previsto è usato su conteggi; lilla e cielo sono usati anche per elementi; la regola stessa li mette in entrambe le liste | Togliere lilla e cielo dalle tinte di voci, progetti e conti; dare all'attenzione un colore che non sia il giallo |
| Coerenza fra pagine e lingue | 5 | IT=FR; stabile a ogni caricamento; stessa mappa su Dashboard, Preventivo, Analisi e Progetti nello stesso momento | I colori cambiano quando cambiano i dati; la stessa voce ha colori diversi tra le pagine; due progetti hanno lo stesso rosa; le icone hanno colori diversi da quelli dei grafici | Colore fisso salvato su ogni progetto, voce e conto, con colori tutti diversi |
| Accessibilità del colore | 7 | Tutti i testi colorati ≥ 4,9:1 (AA); importi e % sempre scritti accanto | Riempimenti pastello 1,5–2,6:1; importanza delle scadenze indicata solo col colore; corallo e oliva quasi uguali per i deuteranopi (ΔE 11,7) | Etichetta o icona per importanza; bordo scuro sulle tinte chiare; distanziare corallo e oliva |
| Armonia complessiva | 8,5 | Insieme calmo e ordinato, gerarchia chiara | Le ciambelle con 2 rosa uguali e i grigi #c9d6ea e #adb9ca accostati (ΔE 10,6) si confondono | Sette tinte davvero distinte, un solo grigio per «altri» |

## Difetti

| # | Grav. | Pagina · larghezza | Colore | Prova |
|---|---|---|---|---|
| 1 | P1 | /progetti, /analisi · tutte | #e3a6c2 | École Piccolino e École Bonne Semence hanno lo stesso rosa nella ciambella e in legenda (entrambi i giri, IT e FR; schermata `super_admin_1440__progetti.png`, `col_fr_prog__1.png`) |
| 2 | P1 | /progetti, /analisi, /conti · tutte | vari | Tra un giro e l'altro alcuni dati sono cambiati (la copia è condivisa). Effetti visti: Spese generali da #5b6f8c a #b9c47a, Ambohitsiroa da #b9c47a a #8fafd6, Banca Italia da #e3a6c2 a #8fafd6, BNI da #8fafd6 a #5b6f8c, Fanomezantsoa da #e3a6c2 a #a596e6 (`leg_sa1440_run1.json` vs `leg_super_admin_1440.json`; schermata `col375_fr_conti__1.png`) |
| 3 | P1 | /progetti/<Ambohitsiroa> vs / e /preventivo · 1440 | #e3a6c2 vs #b9c47a | «03 · Attività di progetto» è rosa nel progetto e oliva in dashboard e preventivo; «09 Oneri» è oliva nel progetto |
| 4 | P2 | /conti · 1440 (1° giro) | #a596e6, #8fafd6 | PayPal (conto italiano) è lilla, il colore del Madagascar; BNI Madagascar è cielo, il colore dell'Italia |
| 5 | P2 | / · tutte | #a596e6 | Nella stessa schermata il lilla indica «Madagascar» (Liquidità, MG) e «Risorse umane» (Dove vanno le spese); E4 e Antanetibe sono lilla altrove |
| 6 | P2 | /progetti, /admin/progetti · tutte | #e5eef8/#2f5f9e | Le icone hanno colori per categoria (scuole in blu, il colore del previsto), diversi da quelli della ciambella (Antanetibe è lilla) |
| 7 | P2 | /scadenze · 1440 | #e2917f vs #e3a6c2 | L'importanza è indicata solo dal bordo colorato; critica e alta si somigliano (ΔE 28, contrasto 2,4 e 2,0:1) |
| 8 | P2 | /, /movimenti, /conti, /anticipi | #fff3d3, #e8be5a | Il giallo delle uscite è usato anche per «da verificare», «da fare» e «da seguire» |
| 9 | P3 | /movimenti, /scadenze | #5b8fd6 | Il blu del previsto è usato per il numero di movimenti e per le scadenze dei prossimi 14 giorni |
| 10 | P3 | / e /preventivo vs /progetti, /analisi | #2e3d52 vs #1e2b3c | Le entrate hanno due toni di blu notte diversi |
| 11 | P3 | /cambi · 1440 | #9dc3e6, #6f8fbf, #3f6491 | Blu fuori dalla palette dichiarata |
| 12 | P3 | /, /preventivo | #c9d6ea vs #adb9ca | «Sede e funzionamento» e «Altre voci» sono quasi uguali (ΔE 10,6) e stanno affiancati |
| 13 | P3 | / · tutte | bordo #a3362e | «Nessun backup scaricato» è rosso, ma non è né uno sforamento né un ritardo (è discutibile) |

Non verificato: telefoni reali, PWA. La causa del difetto 2 (colore assegnato in base alla posizione nell'elenco) è un'impressione: ho visto solo l'effetto.
