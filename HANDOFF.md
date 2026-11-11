# YouCount — passaggio di consegne (11/11/2026)

Documento per riprendere il lavoro in una nuova chat. Lo stato vero è il codice su `main`: questo file riassume decisioni, vincoli e cose aperte.

## Progetto

| Voce | Valore |
|---|---|
| App | YouCount, contabilità PWA di YouSud ODV (IT/FR, EUR + MGA) |
| Repository | `andscial-blip/yousud-youcount`, branch `main` (ultimo commit funzionale `02e619d`) |
| Produzione | https://youcount-gold.vercel.app — Vercel progetto `prj_FWRh77eoEqYHs9yAcvxJnrA7OxdQ`, team `team_ttKx7ir9hZ4R1rzHxfIezrw1`; il push su `main` pubblica da solo (se il deploy non parte: commit vuoto) |
| Database | Supabase progetto `uxzeonwmakanumlojfax`; migrazioni in `supabase/migrations`, ultima `20261110000700_advance_superadmin` (tutte applicate in produzione) |
| Stack | Next.js 15 (server components + server actions), Supabase Postgres con RLS e RPC SECURITY DEFINER (`app.fail`, `app.has_role`, `app.me_org`), pdf-lib lato server |
| Canvas proposte | artifact `9c2c9df2-c096-40fc-8894-1ad7a8d920d5` |

## Regole di lavoro (da rispettare sempre)

- Rispondere in italiano, conciso, con tabelle. Niente entusiasmo, niente formule vuote.
- Non inventare credenziali, dati, autorizzazioni. Non dichiarare pubblicato, collegato, testato o completato ciò che non lo è davvero; non dichiarare superato un test non eseguito.
- Nessuna chiave privilegiata nel frontend. Password e chiave Anthropic le inserisce solo Andrea.
- Mai cancellare dati senza backup. Chiedere prima di modifiche in produzione e di cancellazioni di massa.
- `apply_migration` su Supabase richiede l'approvazione di Andrea nell'app: avvisarlo prima.
- Punti normativi/fiscali: rimandare al commercialista.
- Il Google Drive di Altromercato non va mai collegato né usato; il materiale YouSud va nel Drive condiviso di YouSud.
- Grafica: palette pastello tenue, niente corsivo, niente marrone; **simmetria e allineamento ovunque** (telefono, desktop, IT e FR). Controllare sempre la versione telefono (375 px): niente pulsanti di larghezze diverse, niente parole spezzate a metà (Andrea lo considera inaccettabile).
- Preventivo solo annuale.
- Finire le richieste precedenti prima delle nuove; l'elenco attività deve riflettere lo stato reale.

## Attività aperte

| # | Attività | Stato |
|---|---|---|
| 136 | **PDF del rendiconto per cassa come modello ufficiale ETS** (Mod. D del DM 5/3/2020 e versione aggregata Mod. E), sia consuntivo (pagina Rendiconto) sia preventivo (Preventivo › Riepilogo), con intestazione dell'ente e numeri già compilati | Da fare — è il prossimo |
| 127 | Alternative scelte: restano check grafico Analisi, Guida + FR (attesa scelta 9f), Progetti minimal (attesa conferma), soglie anticipi (da delibera del Consiglio) | Parziale, in attesa di Andrea |
| 130 | Rifiniture 10/11: resta solo il ricontrollo su iPhone | Da verificare |
| 67 | A fine lavoro: invio email dal dominio yousud (serve Andrea per DNS/SMTP) e togliere il tasso di prova 5000 di novembre | Ultimo passo |
| 89 | Vecchio Gestionale (artifact): fasi sospese | Solo se Andrea lo chiede |

Altro in sospeso: nota art. 17 con il commercialista; ratifica soglie da parte del Consiglio; pulizia dati DEMO in produzione (la fa Andrea).

### Indicazioni per #136

- Struttura Mod. D: due colonne affiancate USCITE | es. t | es. t-1 || ENTRATE | es. t | es. t-1. Sezioni A–E con righe numerate (chiavi `report_lines` A1…E5 uscite, A1…E2 entrate), ogni sezione con Totale e «Avanzo/disavanzo attività …»; poi Totale gestione, Avanzo/disavanzo prima delle imposte, Imposte (TAX), Avanzo/disavanzo prima di investimenti e disinvestimenti; sezione investimenti/disinvestimenti 1–4 (chiave INV), avanzo da investimenti, avanzo complessivo; Cassa e banca (Cassa, Depositi bancari e postali, da `account_balances(p_at)`, MGA convertiti con `fx_rate_for` al 31/12); Costi e proventi figurativi 1–2.
- Mod. E = totali per sezione.
- Dati: `report_cash_statement(p_year)` (`amount_eur`, `amount_eur_prev`), `budget_statement(p_year, p_budget)`, `loadOrg` per l'intestazione.
- Proposta: route `/api/v1/rendiconto-pdf?anno=&tipo=consuntivo|preventivo&modello=D|E` con pdf-lib (Helvetica, testo pulito WinAnsi come in `src/lib/delivery-pdf.ts`), pulsanti nelle due pagine.

## Revisione pagina per pagina (dall'11/11)

Andrea vuole rivedere l'app una pagina alla volta fino alla versione definitiva, con grafica e colori di Cairn (repository `andscial-blip/cairn`, CSS già copiato in `src/app/cairn-*.css`).

| Pagina | Stato |
|---|---|
| Dashboard | Fatta l'11/11: riquadri `.kpis.dk` con mini grafico (niente fili colorati né icone), layout `.home.v2.yc` (schede a coppie a sinistra, Da fare e Note a destra). Colori: blu notte = entrate, giallo = uscite, verde = avanzo. Tolta la riga dei 4 riquadri piccoli: rimborsi dovuti e tasso di cambio sono in «Cassa e autonomia», verifiche e scadenze in «Da fare» |
| Dashboard › Scadenze | Parte alta fatta l'11/11: 4 riquadri `.kpis.dk` (scadute per importanza, prossimi 14 gg, da pagare e da incassare in 30 gg con una barra per giorno; un clic filtra l'elenco `#elenco`); «Calendario (.ics)» e «Nuova scadenza» nella testata del calendario (`.cal-nav`, `.cal-act`) |
| Movimenti › Registro | Parte alta fatta l'11/11: riquadri `.kpis.dk.mvk` (movimenti, entrate, uscite, saldo dei movimenti filtrati, una barra per mese del periodo); ricerca, Filtri ed «Esporta in Excel» su una riga (prop `after` di `FilterBar`), tabella nello stesso pannello. L'esportazione scarica ancora l'anno intero, non l'elenco filtrato: proposto ad Andrea di farle seguire i filtri |
| Movimenti › Da rimborsare | Fatta l'11/11: 4 riquadri `.kpis.dk.rbk` (dovuto con barra per persona, giorni di attesa per fasce, giustificativi mancanti con anello, rimborsato nell'anno), elenco per persona con sigla e tasto «Rimborsa», «Ultimi rimborsi» in `.rb-recent` |
| Conti | Fatta l'11/11: riquadri (liquidità, Italia, Madagascar, anticipi aperti); conti di anticipo fuori dalle tabelle (scelta 1 di Andrea); nome del conto → scheda di dettaglio `?conto=` con ultimi movimenti e saldo progressivo (`account_legs`, solo staff); «da verificare» → Registro filtrato; saldo verde/rosso; conta di cassa in ariary senza monete |
| Segno del paese | Scelta A di Andrea: sigla in cerchio (`CountryMark`, `.cmark`), IT blu notte e MG verde acqua; stessi colori in `.place` e nelle barre Italia/Madagascar |
| Conti › Anticipi | Fatta l'11/11: riquadri («Anticipi in corso», da autorizzare, da consegnare, giustificativi in ritardo); elenco «Anticipi aperti per persona» con icona di stato `.pst` verde/arancione/rossa e legenda |
| Conti › Riconciliazione | Fatta l'11/11: schede senza filo colorato, barra spuntati/da spuntare, segno del paese nuovo |
| Conti › Tassi di cambio | Fatta l'11/11: riquadri `.kpis.dk` con mini grafici a scala allargata; «inserito il gg/mm/aaaa» nel tasso corrente; tabella che non sborda su tablet |
| Altre pagine | Da fare, nell'ordine che indica Andrea. Analisi, Progetti, Preventivo usano ancora verde = entrate e salmone = uscite (`--c-in`, `--c-out`) e i riquadri `.k4` con filo colorato: da allineare quando ci si arriva |

## Fatto di recente (10–11/11)

- Preventivo riga per riga: schede «Voci del preventivo», «Riepilogo» (per codice e per progetto, link al Mod. D), «Confronto con il consuntivo». Contiene entrate e uscite. La versione approvata non si modifica: «+ Aggiungi una riga» apre la bozza di revisione sulla riga nuova (`#nuova-riga`). Su telefono voci compatte.
- Anticipi «portafoglio della persona» (concetto B): richiesta in EUR o MGA con preventivo allegato, persona scelta fra utenti o scritta a mano, autorizzazione, ricevuta di consegna firmata su telefono/PC (PDF), ricevute, restituzione, chiusura automatica a saldo zero; super admin senza approvazioni e può eliminare richieste.
- Rimborsi semplificati: «A chi dobbiamo dei soldi» per persona e valuta, scheda con le spese da spuntare e un solo pulsante «Rimborsa X».
- Progetti con riquadri come la Dashboard e anelli verde YOU #00A060 + tacca blu ardesia.
- Logo su telefono: YOU sopra COUNT, allineati a sinistra.
- Dettaglio movimento: «Genera un documento» a pulsanti di larghezza uguale, storico modifiche come elenco.

## Prove (ambiente locale)

```bash
npm install
npm run db:reset && npm run test:db                         # DB locale postgres://tester:tester@localhost:5432/mizana_test (serve Postgres 16)
npm run test:e2e                                            # completo ~17 min, risultati solo alla fine
ONLY="anticipi|preventivo" npm run test:e2e                 # sottoinsieme; alcuni test dipendono da test precedenti
WIDTHS=375 LANGS=it,fr DEMO=1 npm run test:layout           # controllo allineamenti
H=812 node tests/e2e/shot.mjs "/percorso" 375 prefisso      # screenshot (con anteprima avviata da test:layout SERVE=1 DEMO=1)
```

Note: dopo `tsc` ripristinare `tsconfig.json` (`git checkout -- tsconfig.json`); nei test sostituire gli spazi non separabili con `.replace(/[  ]/g, ' ')`. Un "Page crashed" a catena nei test completi è instabilità del browser: rilanciare i test falliti con `ONLY`.

iPhone: Andrea condivide lo schermo con iPhone Mirroring sul Mac (clic funzionano, scorrimento poco affidabile, digitazione no).
