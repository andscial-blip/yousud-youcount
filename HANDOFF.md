# YouCount — passaggio di consegne (11/11/2026)

Documento per riprendere il lavoro in una nuova chat. Lo stato vero è il codice su `main`: questo file riassume decisioni, vincoli e cose aperte.

## Progetto

| Voce | Valore |
|---|---|
| App | YouCount, contabilità PWA di YouSud ODV (IT/FR, EUR + MGA) |
| Repository | `andscial-blip/yousud-youcount`, branch `main` (ultimo commit funzionale `02e619d`) |
| Produzione | https://youcount-gold.vercel.app — Vercel progetto `prj_FWRh77eoEqYHs9yAcvxJnrA7OxdQ`, team `team_ttKx7ir9hZ4R1rzHxfIezrw1`; il push su `main` pubblica da solo (se il deploy non parte: commit vuoto) |
| Database | Supabase progetto `uxzeonwmakanumlojfax`; migrazioni in `supabase/migrations`, ultima `20261114000100_counterparty_logos` (tutte applicate in produzione; questa il 14/11) |
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
- **Guida sempre aggiornata (regola del 12/11):** dopo ogni modifica aggiornare «Come funziona questa scheda» e la Guida (`src/lib/help.ts`, `src/lib/guide-tasks.ts`), in italiano e in francese; testi dettagliati, professionali, comprensibili a tutti, verificati sull'app (niente inventato: le etichette citate devono essere quelle a schermo).

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
| Preventivo › Preventivo analitico (`/preventivo`) | Fatta il 12/11: 4 riquadri `.kpis.dk.bqk` (entrate, uscite, saldo, destinato ai progetti); barra della versione senza filo colorato; «Composizione del preventivo» con selettore `?grafico=` (per progetto predefinita, per voce con due anelli, entrate e uscite, per controparte se c'è almeno una controparte); «Righe del preventivo» con numero di riga, codice, descrizione, progetto, donatore/fornitore, quantità, unità, costo unitario, totale (tabella `.bq-tab` a larghezze fisse; sotto 1400 px unità accanto alla quantità e controparte sotto il progetto; sul telefono schede). Aggiunta, modifica ed eliminazione in una scheda laterale (`?nuova=1`, `?riga=ID`, `?elimina=ID`, componente `BudgetRowForm` con totale calcolato mentre si scrive). Parti comuni in `preventivo/shared.tsx` |
| Preventivo › Riepilogo (`/preventivo/riepilogo`) | Fatta il 12/11: stessi riquadri e barra; due tabelle gemelle `.bqs` (uscite per voce, entrate per voce) e «Per progetto» a tutta larghezza (schede sul telefono); schema Mod. D a richiesta (`?schema=1`) |
| Confronto con il consuntivo | Tolto dal Preventivo il 12/11: sta in Analisi › «Preventivo e consuntivo» (`src/components/BudgetCompare.tsx`, schede sul telefono). I vecchi indirizzi `?vista=confronto` e `?vista=riepilogo|schema` reindirizzano |
| Intestazione di tutte le pagine | 12/11: freccia «indietro» (`.pback`, torna alla pagina precedente; alla prima pagina va alla scheda principale della sezione); «Come funziona questa scheda» come riga visibile accanto alle sotto-schede (`.subrow`, `.helpline`; sul telefono «Come si fa») al posto dell'icona; le sotto-schede conservano l'anno (e nel Preventivo la versione). Niente tasto Home: logo e «Dashboard» portano già alla pagina iniziale |
| Progetti (`/progetti`, `/progetti/[id]`) | Fatta il 14/11: riquadri `.kpis.dk.prk` (previsto, speso, residuo, entrate) con mini grafico; «Dove vanno i fondi» (anello con elenco) accanto a «Previsto e speso» (due barre per progetto) in `.prj-two`; schede dei progetti con anello giallo, tacca blu, salmone solo oltre il preventivo; nel dettaglio 4 riquadri e grafico mensile con i colori di Cairn (variabili `--c-in`, `--c-out`, `--c-net` ridefinite dentro `.prj`) |
| Finanziamenti (`/finanziamenti`, `/finanziamenti/[id]`) | Fatta il 14/11 dopo il parere del gruppo di esperti (agente indipendente): riquadri concesso, ricevuto, speso, disponibile in cassa; «Da chi arrivano i fondi» e «Ricevuto e speso»; schede con logo o iniziali del finanziatore (`DonorMark`), anello, barra del tempo, avvisi; dettaglio con grafico cumulato, budget per gruppo, qualità della rendicontazione, scadenze, modifica, chiusura e caricamento del logo (`DonorLogoUpload`, tabella `counterparty_logos`, migrazione `20261114000100`). Contano i movimenti registrati o verificati. Rimandati (proposti dagli esperti): piano delle tranche, scadenze di rendicontazione dedicate, controvalore in euro fissato per i finanziamenti in ariary, natura pubblico/privato del finanziatore (da verificare con il commercialista) |
| Scelte di Andrea del 14/11 | «Esporta in Excel» nel Registro resta sull'anno intero (non segue i filtri). Nel Preventivo il grafico che si apre è «Per voce». Conto generico «Anticipi al referente in Madagascar» disattivato in produzione |
| Analisi (`/analisi`, sei viste con `?vista=`) | Fatta il 14/11: riquadri `.kpis.dk.prk` (entrate, uscite, avanzo, preventivo usato), barra `.an-bar` con le viste (griglia 3×2 sotto 1100 px) e il filtro progetto; anelli con elenco, barre appaiate previsto/speso, linee cumulate con i colori di Cairn; tabella per gruppo e confronto per codice invariati nei contenuti |
| Altre pagine | Le pagine principali sono tutte nel disegno di Cairn. Restano con la grafica precedente: Documenti (rendiconto, report, documenti emessi), Guida, Impostazioni e le pagine admin, Verifica, Riconciliazione (solo schede), Controparti |

## Prove: come eseguirle senza falsi errori (14/11)

- Il server di sviluppo si degrada nelle esecuzioni lunghe: la prova di layout su tutte le pagine in un colpo solo (oltre 50 minuti) va in timeout. Si esegue a gruppi con `ONLY_PATHS` (una decina di pagine per gruppo, server nuovo a ogni gruppo).
- Nella suite e2e completa una o due prove sulle pagine admin possono fallire verso la fine per timeout o connessione chiusa; rieseguite da sole con `ONLY=` passano. Non sono regressioni: è lo stesso limite del server di sviluppo.
- Controllo del 14/11: layout a 0 problemi su tutte le pagine (IT e FR; 7 larghezze per le pagine rifatte, 5 per le altre); e2e 50 su 50 contando le due rieseguite da sole.

## Preventivo: dati (12/11)

- Migrazione `20261112000100_budget_lines.sql`: `budget_items.line_no` (numero progressivo nella versione, assegnato dal trigger, non cambia; la revisione copia i numeri) e `counterparty_id`; `budget_item_add(p, p_reason)` aggiunge una riga alla bozza o, con le regole delle modifiche puntuali (amministratore + motivo; DEMO: responsabile), alla versione in vigore, con traccia `op = 'insert'` in `budget_amendments`.
- L'esportazione Excel del preventivo ha le colonne N., Donatore / Fornitore e Note.

## Fatto di recente (10–11/11)

- Preventivo riga per riga: schede «Voci del preventivo», «Riepilogo» (per codice e per progetto, link al Mod. D), «Confronto con il consuntivo». Contiene entrate e uscite. La versione approvata non si modifica: «+ Aggiungi una riga» apre la bozza di revisione sulla riga nuova (`#nuova-riga`). Su telefono voci compatte.
- Anticipi «portafoglio della persona» (concetto B): richiesta in EUR o MGA con preventivo allegato, persona scelta fra utenti o scritta a mano, autorizzazione, ricevuta di consegna firmata su telefono/PC (PDF), ricevute, restituzione, chiusura automatica a saldo zero; super admin senza approvazioni e può eliminare richieste.
- Rimborsi semplificati: «A chi dobbiamo dei soldi» per persona e valuta, scheda con le spese da spuntare e un solo pulsante «Rimborsa X».
- Progetti con riquadri come la Dashboard e anelli verde YOU #00A060 + tacca blu ardesia.
- Logo su telefono: YOU sopra COUNT, allineati a sinistra.
- Dettaglio movimento: «Genera un documento» a pulsanti di larghezza uguale, storico modifiche come elenco.

## Revisione degli esperti (14/11) e correzioni

Il rapporto completo è nell'artefatto «YouCount — International Expert Review» (voto 7/10, nessun restyling; 2 P0, 23 P1, 29 P2, 14 P3). Decisioni prese: storno per tutti, riapertura ed eliminazione solo al super amministratore e mai nei mesi chiusi; anticipo in ritardo dopo 15 giorni (`src/lib/advance-late.ts`); euro in grande e valuta originale in piccolo a ogni larghezza; la prima riconciliazione parte senza spunte; il tema scuro resta.

Fatto: P0 (righe di storno bloccate, chiusura e riapertura dei mesi con conferma e motivo, «Zona di pericolo» in Dati e sicurezza); P1-1…P1-23 salvo quanto elencato sotto; P2-1 (avviso cassa sotto zero), P2-2 (conferme dopo Registra, modifica e storno), P2-3 (colonna «Valuta» negli Excel dei report), P2-6 in parte (pagina «non trovato» IT/FR, «Riprova» nella pagina senza connessione), P2-7 in parte (titolo della scheda del browser per pagina, `lang` su accesso e offline), P2-8 (bordo dei campi), P2-29.

Terzo blocco (14/11 sera): P2-4 (pagina «Menu» con nome e ruolo, titolo della scheda in Impostazioni su telefono), P2-5 (freccia solo nelle pagine di dettaglio, un solo «indietro»), P2-11 (tre indicatori in testa al Rendiconto, versioni approvate in fondo), P2-13 (`src/components/DialogKeys.tsx`: focus dentro la scheda, Tab trattenuto, Esc chiude, focus restituito), P2-14 (inserimento lasciato a metà conservato sul dispositivo: «Riprendi» / «Scarta»), P2-26 in parte (`aria-current` sulle viste di Analisi e Report, nome del pulsante di aiuto uguale al testo).

Quarto blocco (14/11 notte): P2-15 in parte («Crea la copia corretta» con `/nuovo?copia=<id>`, titolo «Storno di …»; restano lo storno fuori dal conteggio «senza giustificativo» e l'evento nello storico dell'originale), P2-12 in parte (titolo «Regole di controllo», via il riferimento a docs/API.md), P2-24 in parte («Da fare» ordinato per urgenza), P2-25 in parte (quattro voci nuove nella guida: chiudere il mese, finanziamento e rendiconto, scontrino mancante, Chiedi all'AI).

Da fare: P1-20 è fatto solo per «tiers», «extourne», «Nota di rimborso» e le etichette di pagamento (manca la passata completa su Comptabiliser/Enregistrer, pointer, codice/gruppo/voce, «Struttura e spese generali»); di P1-21 restano lente sopra il titolo e sfumatura delle schede di Impostazioni a 768 px; P2-9, P2-10, P2-12, P2-15…P2-25, P2-27, P2-28 e tutti i P3. Decisioni ancora aperte: cosa vede l'operatore (P2-28) e Analisi › Progetti come collegamento.

La prova di layout ora segnala anche le parole spezzate a metà e il contenuto che esce da una cella (`tests/e2e/layout.e2e.mjs`, controlli 5 e 6). Un testo su due righe voluto si marca con `data-two`.

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
