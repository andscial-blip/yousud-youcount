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

Quinto blocco (15/11): P2-21 in parte (conto, progetto e modalità proposti dall'ultima spesa della stessa persona, «Usati di recente» nel Codice contabile, quattro motivi pronti per «Perché manca»; restano valuta nel campo importo e ricerca nel codice), P2-16 in parte (ZIP che salta i file mancanti con FILE_MANCANTI.txt, «già allegato a MOV-… del gg/mm: è la stessa spesa?»; restano anteprima con precedente/successivo nell'archivio e «Aggiungi giustificativo» nella scheda).

Sesto blocco (15/11): P2-9 in parte («Contanti che ho in mano» per l'operatore con data per le ricevute, «autorizzati X su Y richiesti»; restano «Chiedi un anticipo» dal «+» e la tappa «Rendiconto»), P2-22 in parte (su telefono durante lo scorrimento restano titolo e schede: `html[data-scrolled]`, impostato in `Shell.tsx`; restano i comandi a 40–44 px e il selettore di Analisi prima degli indicatori).

Settimo blocco (15/11): P2-10 in parte (spazio non divisibile nella punteggiatura francese di dizionario, aiuti e guida con `frTypo`; «comptabiliser» per i movimenti; «tiers» ovunque), P2-20 in parte (Analisi › Progetti è un collegamento alla pagina Progetti; via il grafico mensile ripetuto in Andamento), P2-22 (selettore delle viste di Analisi prima degli indicatori), P2-23 in parte (chiusura del finanziamento con conferma), P3-1 (niente blu predefinito nei collegamenti di testo), P3-5 in parte (anno a quattro cifre nelle date con ora), P3-10 in parte («Mostra» la password, focus sulla password dopo un errore), P3-11 (colori del manifest; la traduzione automatica non viene richiamata dopo un rifiuto), P3-12 (prime schede «Saldi» e «Grafici»; «Documenti emessi»), P3-13.

Ottavo blocco (15/11): P2-19 in parte (tabelle dei Report su telefono e tablet in «riga compatta»: classe `cmp` sulla tabella, `cmp2` quando ci sono importi in ariary; restano Emessi e il dettaglio progetto).

Nono blocco (15/11): scelta «Dopo la registrazione prepara l’autocertificazione da firmare» nelle spese senza giustificativo (`?aut=1` sulla scheda del movimento); P2-28 fatto a livello di visualizzazione (l'operatore vede le casse in contanti e i propri anticipi in Dashboard e Conti; i permessi del database non cambiano); P2-17 in parte (niente valuta e cambio nelle dichiarazioni senza importo, importo anche per le bozze a righe); nella barra laterale nome su una riga e ruolo sotto.

Da fare dopo le prove su telefono: archiviazione automatica di giustificativi e documenti emessi nel Drive condiviso di YouSud (struttura delle cartelle da far definire agli esperti); punteggio finale degli esperti, anche grafico.

Prova sull'iPhone vero (15/11, Duplicazione iPhone, app di produzione): registrata una spesa di prova senza giustificativo con autocertificazione proposta. Corretti dopo la prova: campi data dentro il riquadro su iOS; cursore dei campi importo (`src/lib/use-caret.ts`); barra in basso nascosta e intestazione non fissa mentre la tastiera è aperta; messaggio di errore che spariva tardi; pulsante «Vai al giustificativo»; «Campo obbligatorio» sotto il campo giusto. Limiti: in sottofondo la digitazione non arriva al telefono (serve il controllo a tutto schermo) e la digitazione sintetica perde o raddoppia lettere, quindi i testi scritti così non sono una prova affidabile. Non provati sul telefono: emissione di un documento, riga di preventivo, anticipo, riconciliazione, fuori rete. Resta in produzione MOV-2026-020 «PROV taxii…» da 12.000 MGA: va eliminato dall'utente (serve la sua password). Dato da controllare: nel Preventivo 2026 le uscite previste sono 24.231.107 € contro 223.619 € di entrate.

Non fatti, da decidere se servono: P2-17 (documenti emessi), P2-18 (regole dei grafici), P2-19 (riga compatta unica nelle tabelle su telefono), P2-27 (rete lenta), il resto di P2-20 e P2-23, P3-2, 3, 4, 6, 7, 8, 9, 14; cambio password con la password attuale (P3-10).

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

## Prova su iPhone del 15/11 (seconda parte) e correzioni
Provato dal telefono, in produzione, con «Duplica iPhone»: ricevuta di prova emessa e annullata; revisione 2 del preventivo creata, riga di prova salvata, bozza eliminata (nessun dato di prova rimasto, a parte la ricevuta annullata che resta nello storico come previsto).
Correzioni nate dalla prova:
- Preventivo › «Versioni» › «Elimina la bozza» ora chiede conferma («Conferma: elimina la bozza») e poi dice «Bozza eliminata…».
- Preventivo: dopo il salvataggio la riga viene portata in vista ed evidenziata (`RowReveal`, `tr[data-ln]`).
- Documento emesso: «Emetti e genera il PDF» mostra «Emissione in corso…» (`PendingButton`).
- Ciambelle: il valore al centro si rimpicciolisce se lungo (`viz.ts`, `vfs`).
- Movimento: «Modifica / Verifica» vengono prima di «Correggi questo movimento…» ed «Elimina definitivamente…».
Ancora da fare, viste sul telefono: «Prepara una revisione» senza conferma (reversibile); striscia dei suggerimenti iOS sopra la barra di stato; due «indietro» nel dettaglio del documento emesso.
Limite della prova: la digitazione sintetica attraverso «Duplica iPhone» altera le lettere (PROVA→PROAA); gli importi vanno riprovati a mano.

## Archivio su Google Drive (da fare, in attesa di decisioni del proprietario)
Pareri raccolti il 15/11 (contabile ETS + archivi/Drive API). Scelte proposte: Drive condiviso YouSud (mai quello di Altromercato); account di servizio «Gestore dei contenuti»; copia dal server (Supabase Storage → Drive) con coda `drive_outbox`, ID Drive pre-generati; albero `AAAA/01_Giustificativi/AAAA-MM`, `AAAA/02_Documenti-emessi/<TIPO>`, `03_Banca-e-cassa`, `04_Bilancio`, riservati in un secondo Drive; anno = data del movimento (cassa) e serie di numerazione per gli emessi; niente bozze; mai eliminare. Serve: migrazione (approvazione), progetto Google Cloud, variabili su Vercel.

## Archivio su Google Drive: realizzato il 15/11 (codice), da collegare
Il Drive di YouSud è un Gmail normale (yousudodv@gmail.com), quindi niente Drive condiviso né account di servizio: OAuth dell'account con permesso `drive.file` (l'app vede solo ciò che crea).
- Migrazione `20261115000100_drive_archive.sql`: `drive_link` (autorizzazione, solo server), `drive_folders`, `drive_files`, funzione `drive_targets(org)` (solo `service_role`).
- `src/lib/drive-naming.ts` (regole di cartelle e nomi, test unitari), `src/lib/drive.ts` (OAuth, cartelle con ID pre-generati, caricamento, rinomina/spostamento, `syncDrive`).
- Rotte `/api/v1/drive/connect`, `/callback`, `/sync` (GET con `CRON_SECRET` per Vercel Cron alle 01:17 UTC, POST «Sincronizza ora»). Scheda `DriveCard` in Impostazioni.
- Variabili su Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CRON_SECRET` (oltre a `SUPABASE_SERVICE_ROLE_KEY`). URI di reindirizzamento: `https://youcount-gold.vercel.app/api/v1/drive/callback`. La schermata di consenso va messa «In produzione», altrimenti l'autorizzazione scade dopo 7 giorni.
- NON ancora provato con Google vero: la copia è verificata solo nelle parti locali (nomi, cartelle, funzione SQL, permessi). Da provare al primo collegamento: `drive.file` con ID pre-generati, spostamento della cartella radice dentro la cartella esistente.
- Non fatto: estratti conto, riconciliazioni, preventivo e rendiconto (cartelle 03 e 04), «Apri in Drive» sul singolo documento, registro CSV, controllo periodico degli hash.
Account: l'accesso di Andrea è passato a andrea.scialabba@yousud.it (15/11, senza email di conferma).

## 15/11 pomeriggio
- Drive: collegamento sospeso su richiesta di Andrea. Google Cloud rifiuta yousudodv@gmail.com senza verifica in due passaggi (che Andrea non vuole attivare). Alternative lasciate aperte: progetto tecnico su andscial@gmail.com, oppure Google Apps Script dentro l'account YouSud. Il codice resta pubblicato, la scheda dice «Da configurare».
- «Uscite senza giustificativo» (cruscotto e filtro dei Movimenti): esclusi storni e movimenti stornati.
- Documento emesso: tolto il secondo «← Documenti emessi» (resta la freccia in alto).
- Voci di revisione chiuse nel pomeriggio: schede secondarie che vanno a capo (768 px e francese); una sola freccia «indietro» nelle pagine di Impostazioni a ogni larghezza (su desktop ne comparivano due); barra azioni fissa nel dettaglio del documento emesso su telefono (`.doc-bar`); cambio password con «Password attuale» e «Annulla» quando la sessione è nata da un accesso con password (`amr`), non da link email; «Chiedi un anticipo →» in testa al nuovo movimento; testo minimo 11 px nei grafici. Stub e2e: la sessione da `token_hash` ora ha `amr` «otp».
- P2-18 (regole dei grafici) resta in gran parte da fare: colore fisso per gruppo in tutte le pagine, scale, legenda dei Tassi, contorni.
- Regole dei grafici (P2-18), 15/11: `--c-in` blu notte, `--c-out` giallo, `--c-net` verde in tutta l'app (prima verde/rosso); rosso solo per sforamenti. `fixedColors()` in `Charts.tsx`: colore fisso per gruppo di voci (dal codice) e per progetto (dal nome), usato in Dashboard, Preventivo, Analisi, Progetti e dettaglio progetto; tavolozza delle voci senza blu notte, giallo e verde (`PAL` = lilla, azzurro, corallo, oliva, rosa, ardesia). Barre del Preventivo scalate sul totale. Report: barre gialle (uscite) o blu notte (entrate). Tassi: linee con gli stessi colori della legenda. Non fatto: scala sull'asse del grafico principale del cruscotto, contorno sulle forme chiare, Finanziamenti ancora con colori per posizione.

## Revisione finale indipendente del 15/11 (rapporti in docs/revisione-finale-2026-11-15/)
Tre revisori (grafica e UI; percorsi d'uso; lingua e accessibilità) sulla copia locale, senza leggere il codice. Voti nei rapporti.
Corretto subito dopo la revisione:
- P1 importi: «1.250» digitato un carattere alla volta diventava 1,25. Ora il punto digitato resta in attesa finché non si vede cosa segue (3 cifre = migliaia, 1-2 = decimali) e all'uscita dal campo diventa virgola (`formatTyping`, `settleAmount`, test unitari).
- P1 ricevuta annullata scaricabile senza dicitura: `/api/v1/emesso/[id]` aggiunge «ANNULLATO · ANNULÉ» e il motivo su ogni pagina allo scarico; il file archiviato resta intatto.
- P1 colori con doppio significato: uscite per progetto in giallo, paesi in azzurro e lilla, tavolozza delle voci senza ardesia, barra del preventivo in giallo, Progetti e Finanziamenti con colore fisso.
- P1 Conti a 375 px: Iniziale / Entrate / Uscite su tre righe.
- Calendario delle Scadenze senza `role="grid"` (50 nodi critici per axe); schede dei report a capo; «Storna questo movimento…» come pulsante; nomi di colonna tecnici tolti dallo storico; quattro frasi di aiuto riallineate alle etichette.
- Test: il rendiconto tiene conto della spesa della prova sull'autocertificazione; il backup esclude di proposito le tabelle `drive_*`.
NON ancora fatto dai rilievi dei revisori: assi del grafico mensile che scalano con l'immagine (22 px a 1440, ~8 px a 375); intestazioni fuori asse in /admin/utenti; ariary grande ed euro piccolo nei KPI di Conti e Anticipi; nove altezze di pulsante; «comptabilisé/enregistré» in francese; testi francesi troncati a 375 px; bersagli sotto 44 px; `aria-invalid` sui campi in errore; 404 generale solo in italiano; conteggio «38 da verificare» contro 40 nel Registro filtrato; l'operatore non può correggere un proprio movimento registrato e nessun testo dice a chi rivolgersi; ricerca nel selettore del codice contabile; ocra dei testi di avviso vicino al marrone.

## 15/11 sera: rilievi rimasti della revisione finale
Chiusi: grafici mensili in quattro disegni scelti dalla larghezza del riquadro (`.chart-wrap` con container query; testo fra 10 e 13 px a ogni larghezza); euro in grande e ariary in piccolo nei riquadri di Conti e Anticipi; nota all'operatore sul movimento registrato che non può più modificare; «Cerca una voce…» nel selettore del codice contabile; «da verificare» del Registro che conta anche i giroconti; un solo verbo francese per lo stato registrato («comptabilisé»); 404 generale nella lingua del profilo; `aria-invalid` sui campi obbligatori del movimento; bersagli a 44 px su telefono (campi, schede, freccia); intestazioni della tabella Utenti in asse; testo degli avvisi in blu notte invece dell'ocra #8A6100.
Lasciati così, per scelta: etichette brevi sotto le barre dei riquadri troncate con i puntini (tenute su una riga per la simmetria dei riquadri); pulsanti piccoli e «Come funziona» a 40 px. Non fatto: uniformare tutte le altezze dei pulsanti; avviso sulle spese in contanti di importo alto; ricontrollo dei revisori dopo le correzioni.
Prove: 53/53 end-to-end, 34 unitari, impaginazione 0 problemi a 375 (IT e FR), 768 e 1440 (IT).

## Secondo giro dei revisori (15/11 notte, rapporti in docs/revisione-finale-2026-11-15/secondo-giro/)
Voti: Identità 8 · Design system 7 · UI 7,5 · Grafici 6,5 · Desktop 8 · Tablet 7 · Mobile 7,5 · Coerenza visiva 7,5 · Professionalità 8 · UX 8 · Facilità operatore 7,5 · Completezza 8,5 · Affidabilità dati 8 · Navigazione 8 · Qualità complessiva 8 · Italiano 8,5 · Francese 8 · Coerenza terminologica 7,5 · Guida 8 · Accessibilità 8.
Confermati dai revisori: importi corretti in tutti i formati italiani, PDF annullato con dicitura, conteggi «da verificare» uguali (40) in quattro pagine, una sola freccia indietro, cambio password con password attuale.
Corretto dopo il secondo giro: cambio stampato sull'autocertificazione (ora quello del movimento, non il rapporto fra importi arrotondati); barre della tabella «per codice» in Analisi con i colori del resto dell'app; intestazioni del calendario senza ruolo ARIA errato; `lang` della 404; «Jun/Jul» sugli assi francesi.
Aperto (da decidere o da fare): colori di entrate/uscite/saldo ancora usati per altro in Conti (barra dei conti Italia), Riconciliazione, Progetti/Finanziamenti; pallini rossi del saldo negativo nel grafico della Dashboard; testi troncati con «…» nei riquadri (scelta per la simmetria); tabella mensile dei Report a 375 px; tabelle impilate a 768 px (Cambi, Preventivo/consuntivo); scala fissa ±50k; 22 corpi di testo, 11 raggi, 9 altezze di pulsante; movimento registrabile senza descrizione; campi mancanti segnalati a tappe; emissione del documento senza conferma; Dashboard dell'operatore con il compito «da verificare» che non può aprire; «1,250.50» (formato inglese) letto 1,25 senza avviso; cinque nomi francesi per il rendiconto; due punti senza spazio in francese nei testi composti; contrasto del ruolo nella barra laterale (4,23:1); aiuto mancante su /chiedi e /altro.

## 16/11: tutto ciò che restava dei due giri di revisione
Regole: descrizione obbligatoria per registrare (almeno 3 caratteri, solo nel modulo: nessuna migrazione); giustificativo mancante segnalato insieme agli altri campi (`requireDoc` nei dati di riferimento); emissione del documento in due passi («Conferma: emetti il documento», `?emetti=1#emetti` dalla barra del telefono); il compito «da verificare» in Dashboard solo a chi può verificare.
Grafica: un solo blu per le entrate (`--c-in: var(--vz-real)`), giallo uscite, verde saldo anche nei pallini del grafico del cruscotto; conti, anticipi, rimborsi, riconciliazione e donatori con la tavolozza delle voci; «previsto» e tassi nel blu del piano (`--vz-plan`); grafico mensile con altezza divisa in proporzione ai massimi (prima ±scala uguale); nessun testo troncato con «…» (riquadri, legende, nomi dei finanziamenti, ricerca a tutta larghezza su telefono); tabelle vere da 701 px (prima 900): Cambi, Preventivo/consuntivo e Report non sono più schede a 768 px; Report su telefono con due importi per riga e saldo su riga intera; euro in grande anche in Rimborsi; filtri delle Scadenze a capo; anteprima del documento dentro la larghezza con intestazioni bilingui su due righe; archivio Giustificativi a schede su telefono.
Design system: corpi di testo riportati alla scala 12 · 13 · 14 · 16 · 20 · 24 · 28 (prima 20 valori, ora 7 misurati su 20 pagine), raggi a 4 · 8 · 10 · 14 + pillola (prima 15 valori), tre altezze di pulsante (32, 38, 44).
Francese e accessibilità: «compte rendu de caisse» ovunque; spazio prima dei due punti nei testi composti citati; `lang` della 404; contrasto del ruolo nella barra laterale; grafici interattivi con `role="group"`; etichetta della ricerca uguale al testo visibile.
Scartato: correzione tipografica nel browser (`FrTypo`): rompeva l'idratazione delle pagine francesi.
Prove: 34 unitari; end-to-end 52/53 nella prova completa (il fallito era una caduta del server, ripassato da solo); impaginazione 0 problemi a 375 (IT; FR sulle pagine toccate), 768 (IT; FR sulle pagine toccate dopo l'ultima correzione) e 1440 (IT).
Non fatto: terzo giro dei revisori; avviso sulle spese in contanti di importo alto; «1,250.50» in formato inglese; aiuto su /chiedi e /altro; Drive.

## Terzo giro dei revisori (16/11, rapporti in docs/revisione-finale-2026-11-15/terzo-giro/)
Voti: Identità 8,5 · Design system 7,5 · UI 8 · Grafici 7,5 · Desktop 8,5 · Tablet 7,5 · Mobile 8 · Coerenza visiva 8 · Professionalità 8,5 · UX 7,5 · Facilità operatore 7,5 · Completezza 8,5 · Affidabilità dati 8 · Navigazione 8 · Qualità complessiva 8 · Italiano 8,5 · Francese 8 · Coerenza terminologica 7,5 · Guida 8,5 · Accessibilità 8,5. Nessun P0 o P1.
Da fare (i più pesanti): colori delle voci che cambiano fra italiano e francese (chiave = nome tradotto: usare codice o id); ariary ancora in grande in alcuni riquadri di Rimborsi/Anticipi; Cambi a 768 px che scorre e colonna «Fonte» stretta; barre «per codice» illeggibili a 768 px; titolo del finanziamento ancora troncato; calendario delle Scadenze (etichette troncate, bersagli piccoli); 8 altezze di pulsante e campi 34–54 px; lista di Verifica e bozza del Preventivo che non si aggiornano subito dopo l'azione; Dashboard dell'operatore con «Da verificare 40»; tasso mostrato arrotondato (5.340 invece di 5.339,63); terza cifra decimale scartata senza avviso; titolo della scheda in italiano su login/offline/404 francesi; quattro nomi per «codice contabile»; aiuto vuoto su /chiedi e /altro; `aria-invalid` incompleto.

## 16/11 — chiusura dei rilievi del terzo giro
- Colori: chiave di colore = id/codice (non più il nome tradotto); palette categoriale senza i colori con significato fisso
  (blu notte entrate, giallo uscite, verde acqua saldo, blu preventivo, corallo sforamento): PAL = lilla, cielo, oliva, rosa, ardesia, nebbia.
  Italia = cielo, Madagascar = lilla ovunque. Cambi: tasso blu, applicato lilla tratteggiato. Tinte dei tipi di progetto senza marrone/ocra. Tolto src/lib/palette.ts (inutilizzato).
- Una sola barra di preventivo (BudgetBar = cb-bar): traccia = previsto, riempimento = speso, tutta corallo oltre il previsto, tacca tratteggiata = anno trascorso.
  Pastiglie: verde nei tempi, gialla oltre il ritmo, rossa oltre il preventivo. Tablet: colonna Residuo nascosta (cb-res).
- Euro grande / ariary piccolo anche nelle schede per persona di Anticipi e Rimborsi.
- Tablet: tabella dei cambi a schede fino a 1023 px; calendario a trattini fino a 1023 px; intestazione con «Nuovo»/«Nouveau», AI a icona, «Accueil» nella colonna di icone.
- Telefono: aiuto (i) sulla stessa riga delle sotto-schede (che scorrono con sfumatura); filtri rapidi con molte voci in griglia a due colonne; «Emetti» a tutta riga con icona; righe del Registro più basse.
- Scala altezze: pulsanti 32/38/44, campi 40 (eccezione: importo di Nuovo movimento 54). Testo dei grafici 13, ciambella ≥14.
- Niente puntini di troncamento nei testi di contenuto.
- Non grafici: «Verifica» conserva il filtro; PendingButton su Verifica ed Elimina la bozza; Dashboard operatore («In attesa di verifica» = propri movimenti; autocertificazioni da firmare in Da fare);
  tasso mostrato e stampato con i decimali (format.rate); avviso sulla terza cifra decimale (extraDecimals); titolo della scheda del browser in francese su login/offline/404;
  francese: «justificatif» ovunque, «Codes comptables»; «Codici contabili» al posto di «Categorie»; un solo codice trovato = scelto; aiuto per Chiedi all'AI e Altro;
  campi obbligatori con asterisco, aria-required, aria-describedby e fuoco sul primo errore; pastiglia «automatica» nelle scadenze ricavate dai dati.
- Verifiche: unit 35/35, db 52/52, e2e 52/53 nel giro completo (la prova dei documenti emessi è passata da sola: riavvio del server), layout 0 problemi IT 375/768/1440 e FR 768; FR 375 «Remboursements» spezzato corretto dopo.

## 16/11 — velocità
- Causa principale: regole di accesso (RLS) che chiamavano app.me_org()/app.has_role()/app.can_see_movement() a ogni riga.
  Migrazione `20261116000100_rls_speed.sql`: (select …) attorno alle funzioni sull'utente (calcolate una volta per interrogazione),
  movements_select riscritta in linea, collegamenti ai movimenti senza ripetere can_see_movement (lo fa già la regola di movements).
  Stessi permessi: test:db 52/52. Locale: count(*) su 1.017 movimenti 154 ms → 2 ms. Applicata in produzione il 16/11 con il via libera di Andrea: impronta delle 58 regole identica a quella locale prima e dopo; count(*) di 1.206 movimenti da 426 ms a 5,6 ms, stesse righe visibili.
- Registro: conteggio «da verificare» in parallelo. Scheda movimento: storno d'origine, traduzione e collegamenti dei file in parallelo.
- e2e completo: 51/53, i due falliti (riconciliazione, documenti emessi) passano da soli o con le prove che li precedono (server di sviluppo riavviato per memoria).

## 16/11 — revisione dei colori e dell'operatore (quarto giro: due esperti)
- Rapporti: /tmp/yc-final/out (copiati in docs/revisione-finale-2026-11-15/quarto-giro). Colori: palette giusta ma coerenza 5,5–6; operatore 7/10.
- Colori: colore fisso per progetto (`projectColorMap` in lib/palette.ts, ordine per id su tutti i progetti); IT cielo e MG lilla anche nelle pastiglie
  (.cmark, .place); Registro: entrate blu notte, uscite gialle (icone e importi); icone dei tipi di progetto in tinte senza significato;
  «Altri» in --c-soft; «Oggi» e rimborsi non più rossi; importanza nel calendario: critica corallo, alta rosa, normale cielo, promemoria lilla, fatta oliva; Cambi senza blu acceso.
- Operatore: Dashboard propria (OperatorHome.tsx: Registra una spesa, Contanti in mano, Da rimborsare a te, In attesa di verifica, Bozze,
  Le mie ultime spese, Da fare); Registro «I miei/Tutti» (parametro mie; per l'operatore «I miei» è la scelta iniziale);
  messaggio dopo il salvataggio chiaro e stato «In attesa di rimborso»; spiegazione «Da firmare»; nota interna del Gestionale solo ai responsabili;
  codici frequenti (6 pulsanti) e parole comuni IT/FR nella ricerca dei codici (lib/cat-keywords.ts); data controllata mentre si scrive;
  errori senza «invalid:»; anticipo proprio scelto per primo (RefData.myAdvances) con «Hai in mano»; scansione con «Usa» in un tocco («Ritocca» per i bordi);
  anteprima dell'immagine originale; Guida: «Ho sbagliato una spesa» per l'operatore, voci da responsabile nascoste; sottotitolo di Impostazioni «Il tuo account e la sincronizzazione»;
  motivi rapidi senza giustificativo mostrati nella lingua di chi legge. loadRefData: letture tutte in parallelo.
- Da fare ancora (non fatti): separatore delle migliaia con lo spazio nel campo importo in francese; «Registra» immediato con invio in sottofondo; conti del modulo ridotti per l'operatore.
- Verifiche: unit 35/35, db 52/52, e2e 51/53 nel giro completo con i 2 falliti passati da soli (server riavviato), layout 0 problemi IT 375/768/1440 e FR 375.

## 16/11 — quinto giro (colori 8,5/6,5/5/7/8,5 · operatore 8) e correzioni
- Colori: palette degli elementi a 9 tinte senza significato (lib/palette.ts ITEM_PAL): gruppo di voci = colore dal codice (01…09, E1…E4), progetti in ordine di creazione,
  nessuno spostamento per evitare doppioni; conti in sfumature del paese (COUNTRY_SHADES); finanziatori e icone dei progetti in tinte senza significato;
  riconciliazione ardesia/grigio; un solo blu notte per le entrate (.prj); importanza scadenze corallo/prugna/acciaio/nebbia/salvia; variazione del tasso neutra; Cambi senza blu extra.
- Operatore: «Segnala al responsabile» sui movimenti registrati (crea una scadenza di oggi, priorità alta, collegata al movimento: reportErrorAction);
  modulo con «Uscita» già scelta e «Altro tipo…»; date future o di anni precedenti bloccate per l'operatore; valuta di tasca propria proposta in ariary e avviso oltre 1.000 €;
  tasso non modificabile per l'operatore; avviso cassa sotto zero solo ai responsabili; bozza con solo importo e conto senza campi rossi; documenti dal movimento nascosti all'operatore;
  Dashboard: anticipo autorizzato da ritirare, tasso unico (fx_rate_for); Registro dell'operatore senza riquadri contabili; scansione con pulsanti simmetrici su telefono.
- Non fatto: «Registra» con invio in sottofondo immediato; separatore delle migliaia con spazio nel campo importo in francese.
- Verifiche: unit 35/35, layout 0 problemi IT 375/768/1440 e FR 375; e2e: 14/14 operatore; giro completo 42/53 con 11 cadute per crash del browser (memoria),
  tutte superate rilanciate in gruppi piccoli (una richiedeva la prova che crea la controparte).

## 16/11 — sesto giro (colori 8/7/8,5/7/8,5 · operatore 8) e correzioni
Rapporti in `docs/revisione-finale-2026-11-15/sesto-giro/`.
- **Colori**: icona del progetto = colore del progetto nei grafici (`ProjectIcon color=`, `loadProjectColors` in `lib/palette.ts`, ordine di creazione); gruppi di entrata E1…E4 = toni del blu notte (`INCOME_SHADES`), mai uguali ai progetti; Riepilogo del preventivo e «Uscite per progetto» in Dashboard con i colori di gruppo/progetto; «attenzione» (`--warn-bg`) = corallo chiaro, il giallo resta solo alle uscite; pastiglia «Entrata» blu notte pieno, «Giroconto» petrolio (il lilla resta al Madagascar); DEMO grigia tratteggiata (`.chip.demo`); backup non scaricato = «da fare» neutro, non allarme; negativi del Report in inchiostro normale (`td.neg-n`); striscia «Da fare» corallo invece del rosso mattone; previsto della barra preventivo in blu chiaro; nebbia (gruppo 04) più scura per distinguerla da «Altri»; sfumature dei conti più distanti + quadratino-legenda nell'elenco Conti (`BalancesTable swatch`). Non fatto: D10 (critica/fatta con deuteranopia, rischio non verificato), D14 (logo, è il marchio).
- **Operatore**: bozze salvabili, solo casse MG, solo anticipi propri, autocertificazioni da preparare nella Dashboard, «Hai trovato un errore?» sul movimento (scadenza automatica chiusa solo dai responsabili), aiuto breve per l'operatore (`OP_HELP`), PDF in francese corretto, ricerca codici con parole comuni.
- **Senza rete e rete lenta** (`public/sw.js` v5): pagina con copia salvata → se la rete non risponde in 3 s si mostra la copia (dopo una volta lenta, per 15 s quasi subito); richieste RSC lente → la pagina intera si ricarica dalla copia. Ogni copia porta `<!--yc-cached-at:…-->` prima del doctype: `StaleNote` (NetStatus.tsx) mostra «Senza rete · dati salvati il …» o «Rete lenta» con «Aggiorna»/«Dati nuovi · Aggiorna». Pagine salvate: elenco `WARM` (anche `/`, `/rimborsi`, `/anticipi`, `/altro`, `/account`) ogni 2 ore, rinnovo forzato ogni 12 ore e dopo un invio della coda, più ogni pagina aperta con la navigazione interna (se la copia ha più di 30 minuti). «Registra» con server muto per 6 s mette in coda (stesso client_uuid: nessun doppione; non con controparte nuova né per le modifiche). `/login`, `/auth`, `/api` mai in cache; all'uscita le cache si cancellano (`SignOut`).
- Prove: `npm run test:offline` 9/9 (nuove: pagine principali senza rete < 2,5 s con avviso, navigazione interna senza rete, rete lenta con copia entro 4,5 s e «Dati nuovi · Aggiorna», Registra lento in coda < 8 s e un solo movimento).
- Anticipi dell'operatore (corretto dopo l'e2e): nel modulo e nella richiesta vede i propri anticipi e quelli di persone **senza account** (personale locale per cui registra o chiede), mai quelli di un altro utente dell'app (`userNames` in `movement-ref.ts`; filtro in `anticipi/page.tsx`).
- Verifiche 16/11 sera: unit 35/35, db 52/52, e2e 53/53 (in tre gruppi: i fallimenti del giro intero erano lentezza del server di sviluppo e due test da aggiornare: «Altri dettagli» chiuso per l'operatore, anticipi di persone senza account), offline 9/9, layout 0 problemi a 375 IT/FR, 768 e 1440 IT, build ok.

## 19/11 — settimo giro (colori 8,5/6,5/8,5/7,5/7,5 · operatore 7,5) e nuovo metodo contro i voti che scendono
Rapporti in `docs/revisione-finale-2026-11-15/settimo-giro/`. Due voti erano scesi per regressioni introdotte nel giro prima
(gruppi di spesa con gli stessi colori dei progetti; stati dell'operatore incoerenti). Metodo da qui in avanti:
1. prima di ogni giro si riverificano tutti i difetti dei giri precedenti (`/tmp/yc-final/regr.mjs`, elenco in `DIFETTI_PRECEDENTI.md`);
2. ogni revisore riceve quell'elenco (CHIUSO/APERTO/PEGGIORATO) e una griglia di voto fissa (`GRIGLIA.md`: definizione di 7, 8, 9, 10
   per numero e gravità dei difetti, stessi compiti in ogni giro);
3. un'area che scende non si chiude: si corregge e si fa riverificare.
Guardia permanente: `tests/unit/palette.test.ts` (progetti e gruppi non condividono colori, nessun colore di progetto con significato fisso,
12 progetti senza doppioni, gruppi tutti diversi).
- **Colori**: progetti = 12 tinte fredde e rosate (`ITEM_PAL`); gruppi di spesa = gialli e ocra (`EXPENSE_SHADES`); entrate = blu notte;
  «Da verificare», «Da rimborsare», «da seguire» e il pallino «da fare» neutri grigio-azzurri (`.chip.pend`, `.dot.do`), il rosa resta ad allarmi
  e scadenze; Madagascar: il conto più grande nel lilla esatto del paese, anticipi in ardesia (`ADV_SHADES` in Conti); quadratino anche
  per i conti in negativo; Cambi senza il blu del previsto (tasso del mese in blu notte); negativi del Report di nuovo rossi come altrove;
  sforamento in «Previsto e speso» scritto anche nel numero (▲, rosso).
- **Operatore**: ricerca codici con risultati come pulsanti, avviso visibile se non trova nulla, nessuna scelta automatica e codice
  precedente tolto se non è tra i risultati, gruppo solo se nient'altro («riso» non dà più 101–108), «pane» e altri cibi; «Pagato da» =
  titolare dell'anticipo in ogni modo di scelta; spesa di tasca propria = «Da rimborsare» ovunque (titolo, etichetta, fuori dal filtro
  Bozze, «Elimina la spesa»); Anticipi: «Contanti che ho in mano» solo propri, a parte «Contanti consegnati ad altre persone» con il nome;
  Dashboard senza «anticipo ricevuto» a zero; conta di cassa con differenza grande (> 5% e > 50.000 MGA o 10 €) da confermare;
  aiuto con gli stati veri; errori dei moduli nello stile dell'app (`FormValidation`, nessun fumetto del browser); in modifica solo conti
  del Madagascar; nessun doppione della segnalazione nel «Da fare»; titolo «Errore segnalato» tradotto in FR; niente anno futuro
  per l'operatore; Guida filtrata per ruolo; «Apri il PDF da stampare» nel riquadro dell'autocertificazione; niente conti tecnici
  senza titolare tra le persone.
- La differenza di 11 € segnalata tra Report e Analisi non è un errore: le due schermate erano state fatte prima e dopo la spesa di prova
  MOV-2026-006 (10,67 €) registrata dall'altro revisore.
- Verifiche 19/11: unit 39/39, db 52/52, e2e tutti superati (in tre gruppi; un solo fallimento per lentezza del server, ripetuto e superato), offline 9/9, layout 0 problemi a 375 IT/FR, 768 e 1440 IT, build ok; ripasso dei difetti dei giri 6 e 7: 21/21.

## 20/11 — ottavo giro (colori 9/7/9/8/8 · operatore 8, nessun voto sceso) e correzioni
Rapporti in `docs/revisione-finale-2026-11-15/ottavo-giro/`; riverifica: colori 15 chiusi/11 aperti, operatore 26 chiusi/6 aperti, 0 peggiorati.
- **Doppio invio**: `FormValidation` intercetta le azioni del server (POST con intestazione Next-Action): il modulo diventa `data-busy`,
  il pulsante si spegne con la rotellina e un secondo invio è ignorato (anche entro 700 ms). Vale per tutti i moduli. Verificato: una sola richiesta.
- **Operatore**: Conti senza riquadro e sezione Italia, «da verificare» solo dei propri movimenti; data del documento futura blocca «Registra»;
  Scadenze senza «Nuova scadenza», modifica, «Da pagare/incassare», fine finanziamenti e tasso mancante; Da rimborsare con i soli rimborsi propri
  («Rimborsato a te»); messaggio della bozza con il pulsante «Modifica»; Guida con domande proprie («Ho pagato di tasca mia», «Chiedere contanti
  in anticipo») e frasi corrette; filtri di Movimenti senza conti italiani, conti tecnici e «Dati», con «Da rimborsare» nello stato;
  richieste di anticipo in attesa nel «Da fare» (contanti in mano solo come beneficiario); «Hery ha in mano» per l'anticipo di un altro;
  conta con differenza grande: motivo obbligatorio; niente doppione del movimento appena salvato; «Ritaglia» con righe alte uguali e maniglie
  non tagliate; numeri MOV senza a capo al trattino.
- **Colori**: gruppi di spesa in due famiglie alternate (gialli-albicocca e salvia, ΔE minimo 9 contro 6); progetti senza verdi né #8497B0
  (ardesia, usato da priorità e anticipi), 12 tinte, distanza minima 8,2 (prima 7,7); priorità «alta» corallo chiaro; anticipi in ardesia
  anche in /anticipi; resto del preventivo sempre blu chiaro (`--plan-soft`); «oggi/tra N gg/vicino al limite» su fondo neutro con testo
  corallo scuro, distinto dallo scaduto rosa; icone di progetto più sature; conti italiani più distinti; saldi positivi in nero ovunque;
  soglie ETS in blu notte con stima tratteggiata; legenda senza «Previsto» se non c'è preventivo; spiegazione della barra blu notte in Cambi.
- Verifiche 20/11: unit 39/39, db 52/52, e2e tutti superati (in gruppi; i fallimenti del primo giro erano dipendenze tra test e due test da
  aggiornare: tre riquadri in Conti per l'operatore, motivo obbligatorio nella conta), offline 9/9, layout 0 problemi a 375 IT/FR, 768 e 1440 IT,
  build ok; ripasso difetti giri 6–8: 24/24.

## 20–21/11 — nono giro (colori 8,5/7/9/8/8,5 · operatore 8) e correzioni
Rapporti in `docs/revisione-finale-2026-11-15/nono-giro/`. Due aree scese: «Scelta delle tinte» (9 → 8,5, peggioramento reale: senape, terracotta
e testo ruggine introdotti da me) e «Facilità» dell'operatore (8 → 7, difetti già presenti ma non visti). Corretti:
- **Colori**: progetti con 12 tinte tenui scelte per distanza anche in deuteranopia (min ΔE 10,6 / deut 6,4; prima 8,2 / 1,5); «oggi», «tra N gg»,
  «da autorizzare» neutri grigio-azzurri (niente ruggine); «anticipo da autorizzare» neutro in Dashboard e Anticipi; priorità «alta» malva
  (#D9A6C9, distinta da «fatta» anche in deuteranopia); previsto in /progetti come traccia blu chiara riempita dallo speso (come altrove);
  «Destinato ai progetti» in giallo uscite; importi delle persone negli Anticipi in nero; «Applicato ai movimenti» in Cambi in ardesia;
  filo sottile sulle barre chiare. Gruppi di spesa invariati (min ΔE 9,2): le alternative senza senape e terracotta scendevano a ΔE 4–6.
- **Operatore**: «Tutti» in Movimenti mostra solo i movimenti delle casse/mobile del Madagascar e i propri (niente banche e Italia);
  Conti senza colonna «da verificare» e con la nota «la cassa è comune»; avviso della foto doppia intero e «spesa da rimborsare»;
  «data del documento (nel futuro)»; storico conte compatto su telefono e tablet; testi FR («payées de sa poche», spazio prima dei due punti);
  aiuto in pagina scaricato in anticipo; «più grande: …» negli anticipi aperti; pulsanti del ritaglio alti uguali; Guida «Vedere cosa scade» per l'operatore.
- Verifiche: unit 39/39, db 52/52, e2e tutti superati (un test del rendiconto fallito per lentezza, ripetuto e superato), offline 9/9,
  layout 0 problemi a 375 IT/FR, 768 e 1440 IT, build ok.

## 21/11 — decimo giro (colori 8,5/8/9/8/8,5 · operatore 8, nessuna area scesa per peggioramento reale)
Rapporti in `docs/revisione-finale-2026-11-15/decimo-giro/`. Riverifica: colori 26 chiusi/9 aperti, operatore 40 chiusi/11 aperti, 0 peggiorati.
- **«Oggi» con l'ora di Antananarivo** (`src/lib/today.ts`: `todayYmd()`, `orgNow()`, `orgYear()`), in tutte le pagine, azioni e API (40 file).
  Prima il server online (UTC) e alcune pagine (UTC) davano il giorno prima tra le 00:00 e le 03:00 malgasce. Test: `tests/unit/today.test.ts`
  (eseguito anche con TZ=UTC). Le due librerie caricate dai test unitari (`ai/schema.ts`, `demo/build.ts`) hanno la funzione scritta per intero.
  Resta: nel database `current_date` è UTC (17 usi nelle migrazioni, soprattutto valori predefiniti): per allinearlo serve una migrazione
  (fuso del database su Indian/Antananarivo), da approvare.
- Operatore: data delle ricevute in Dashboard solo dagli anticipi consegnati (come in Anticipi); anticipi autorizzati da ritirare anche per altre
  persone; autocertificazione solo su spese registrate proprie (o del responsabile); aiuto breve di Scadenze; «tessuti/tissu» trovano il codice 405;
  casella grande nella conferma della conta; «Lieu et date :»; plurale «richieste in corso»; segnalazioni d'errore con priorità normale.
- Colori: previsto più riconoscibile (`--plan-soft` al 34%).
- **Database**: migrazione `20261121000100_org_timezone.sql` (fuso del database su Indian/Antananarivo, come consigliato dalla documentazione Supabase)
  provata in locale: senza, tra le 00:00 e le 03:00 malgasce il database rifiutava come «futura» la data di oggi dell'app (conta, rimborso,
  riconciliazione). Anche i test usano «oggi» di Antananarivo. **Codice e migrazione vanno pubblicati insieme.**
- Verifiche 21/11 notte: unit 41/41 (anche con TZ=UTC), db 52/52, e2e tutti superati (rendiconto fallito nel giro lungo per lentezza, superato
  ripetendolo insieme al test precedente), offline 9/9, layout 0 problemi a 375 IT/FR, 768 e 1440 IT, build ok.
  Migrazione approvata e applicata in produzione il 21/11 alle 05:27; codice pubblicato con il commit 3596685.

## 21/11 — undicesimo giro (grafica 8/8,5/8,5/8,5/8,5/8/7) e correzioni chieste da Andrea
Rapporto in `docs/revisione-finale-2026-11-15/undicesimo-giro/grafica.md` (area allargata: colori, design, bellezza, coerenza, impaginazione).
- **Precompilati (richiesta di Andrea)**: nuovo movimento senza progetto ripreso dall'ultimo movimento (si sceglie ogni volta; resta solo
  quello dell'anticipo da cui si spende); descrizione tra i primi campi del giustificativo, con i codici suggeriti dalle sue parole;
  riga di preventivo con progetto obbligatorio («Scegli il progetto…», «Generale (struttura)»), quantità vuota (segnaposto 1) e nota quando codice e
  progetto sono ripresi dalla riga appena salvata; documenti emessi senza causale, ritenuta e nota sulle agevolazioni precompilate.
- **Colori fissi dei progetti (G4)**: colonna `projects.color` (migrazione `20261121000200_project_color.sql`, riempie i progetti esistenti con il
  colore che avevano finora), scelta in Impostazioni › Progetti («Colore del progetto nei grafici», punto = colore già usato). `loadProjectColors`
  legge `select('*')`, quindi il codice funziona anche prima della migrazione (colore per ordine di creazione). **La migrazione va approvata**:
  finché non c'è, salvare un progetto da Impostazioni dà errore perché il modulo invia `color`.
- Tavolozza progetti: niente talpa, niente celeste simile al previsto, niente due rosa vicini (min ΔE 11,2). Gruppi di spesa senza terracotta,
  senape e crema invisibile (min ΔE 8,3). Sfumature dell'Italia più distanti (ΔE 9,4). «Fatta» più chiara (ΔE deut 15 dal corallo «critica»).
- Previsto con un solo aspetto (traccia celeste, tacca tratteggiata blu notte) anche nella scheda «Preventivo» della Dashboard e nel confronto.
- «Previsto» come nome unico della colonna (FR «Prévu»); la vista «Preventivo e consuntivo» ora si chiama «Previsto e speso».
- Impaginazione: Guida a sinistra senza parole spezzate; coppie di pulsanti larghe uguali (`.pair2`); collegamenti in blu notte (`a.lnk`);
  sotto-schede a capo sul telefono (niente etichette tagliate dalla «i»); schede del Report in griglia 3 × 3; 4 colonne di schede progetto a 1440;
  scadenze con colonna fissa per le pastiglie ed euro grande/ariary piccolo; riquadri KPI con il piede sempre in fondo; pannelli all'altezza del
  contenuto; «Versioni» del Preventivo nel flusso sul telefono; riferimenti (DEMO-…) che non vanno a capo; segnaposto «Nome o n. MOV».
- Grafici: una variante ogni ~150 px (etichette 11–13 px ovunque); niente anelli che ripetono la barra; intestazioni «Previsto/Speso» in Progetti;
  didascalia della tacca; importo prima della percentuale; «+» sulle entrate nella scheda progetto; stesso arrotondamento ovunque (`eurShort`:
  centesimi sotto 1.000 €); filo più scuro su barre, fette e quadratini chiari (`lightEdge`); report mensile con «Uscite per paese».
- Stati vuoti con la stessa illustrazione (`EmptyArt`, piccola nei pannelli); icona portafoglio su «Da rimborsare».
- 21/11 07:55: migrazione `project_color` approvata da Andrea e applicata in produzione: 10 progetti con il colore che avevano già
  (ordine di creazione). La scelta del colore in Impostazioni › Progetti ora compare anche online. Nessun errore di runtime nelle 2 ore precedenti.

## 21/11 — dodicesimo giro (grafica 9/8,5/8/8,5/9/8,5/8 · operatore 8) e correzioni
Rapporti in `docs/revisione-finale-2026-11-15/dodicesimo-giro/`. Riverifica: grafica 19 chiusi/16 aperti (tutti P3), operatore quasi tutti chiusi.
- Operatore: chi ha in mano i contanti di un solo anticipo parte da «Anticipo» (O1); il progetto preso dall'anticipo torna da scegliere se si
  cambia modo di pagamento (O4); autocertificazione anche dopo «Salva da rimborsare» e conteggio in Dashboard (O2); «Codice suggerito» subito
  sotto la descrizione, senza parole vuote, al massimo due proposte e mai doppie (O3); tessuti/filo/aghi su 401 (O6); «Salvataggio…» sul pulsante
  premuto (O8); data delle ricevute in Dashboard dalla stessa fonte di /anticipi (O5); Guida con le parole dei pulsanti (O7); «Frais généraux» nel
  PDF francese (N-6); «de votre poche» (N9-5); «Tutti» senza stipendi e compensi altrui e senza la query dei totali (N9-1).
- Grafica: tabella per codice con ▲ e numero rosso anche sul telefono (H2); un solo segno meno (H4); «77 %» con lo spazio (H5); una sola icona nel
  titolo (H7); rimborsi in ardesia (H8); finanziatori nei blu delle entrate (H9); sotto-schede in griglia 2 × 2 sul telefono (H10/G5); segnaposti
  corti (H12); codici di gruppo non separati (H13); righe della Guida ≤ 75 caratteri (H14); promemoria e fatta più distinti (H16); niente anello
  doppio nei rimborsi (H17); stesso segno in euro e valuta (H18); stati con icona in Dashboard operatore (H19); «Filtri» ed «Esporta» larghi uguali
  (G3); stesso arrotondamento nei Conti (G10); «previsto» nel finanziamento (G12, 6-D11/7-2: stessa barra di Progetti); pastiglie di Scadenze
  larghe uguali (G19); traccia vuota e piede in fondo nei riquadri (G20); riferimenti indivisibili nei Report (G23); filo sotto contrasto 1,8 (G25);
  gruppo 03 albicocca lontano dal corallo (9-N3); nuova tavolozza dei progetti (7-7, migrazione `20261121000300_project_palette_v2.sql` che
  cambia solo i colori ancora automatici; approvata da Andrea e applicata in produzione il 21/11 alle 10:10); colori stabili anche con i dati dimostrativi ricaricati.

## 21/11 — tredicesimo giro (grafica 9/9/9/8,5/8,5/8,5/8 · operatore 8,5, nessuna area scesa salvo Grafici per J4)
Rapporti in `docs/revisione-finale-2026-11-15/tredicesimo-giro/`. Nessun P0/P1/P2 in nessuna area; restano solo P3.
- Impaginazione: colonna azioni di Scadenze più larga e matita come icona (J1/J2); «Modifica»/«Verifica» larghi uguali (G3); traccia vuota nei
  riquadri a zero (G20, anche grafici a colonne senza valori); bordo continuo nelle righe delle tabelle (H6); codice legato alla prima parola (H13);
  Impostazioni in due righe da 5 (J3); «Rimborsato nel 2026» (J9); «Esporta» solo icona fino a 1100 px (J10); Versioni ancorato sotto i pulsanti,
  titolo senza «· DEMO» (J13); cinque filtri di Scadenze larghi uguali (J14).
- Grafici/colori: gruppo 08 acqua #A8DADC e 09 ardesia #A7B3C4 (J4/J5); previsto anche nelle entrate cumulate (J12); pallino «fatta» con bordo (J11);
  finanziamenti con tacca e barra blu notte (J7); icone dei titoli per autocertificazione e storno (J8); Dashboard senza schede stirate (G16);
  «oltre il previsto» / «del previsto» ovunque (G12).
- Operatore: progetto dell'anticipo davvero tolto quando si cambia modo di pagamento (O4: il valore veniva letto dopo l'azzeramento); «1 codice
  trovato: toccalo qui sopra» (Q1); «perché manca il giustificativo» e «Per salvare mancano» (Q2); modulo dell'autocertificazione anche dopo
  «Salva da rimborsare» (Q3); Rimborsi dell'operatore con tre riquadri, senza «Da documentare» (Q4); «Contanti in mano» ovunque, euro grande (Q5);
  «da rimborsare» sotto la data (Q7); francese «Payée personnellement» al posto di «de sa poche» (N9-5); ruolo del firmatario e «Frais généraux»
  tradotti (N-6).

## 21/11 — quattordicesimo giro (grafica 9/9/8,5/8,5/8,5/8,5/8 · operatore 9 in ogni area, complessivo 8,5)
Rapporti in `docs/revisione-finale-2026-11-15/quattordicesimo-giro/`. Un solo P2 (K1), il resto P3.
- Grafica: tabella per codice che sta nel telefono, importi interi (K1); «previsto» anche nelle Analisi (G12) e stessa regola d'arrotondamento
  (K4); giorni fuori mese leggibili (K10); «fatta» #B9D7B0 (J11); «Da documentare» mostra solo ciò che manca (H17); gruppo 05 rosa tenue
  #E6CFE0 (J4); tavolozza senza oliva né grigi (J5/K5, StreetFood in produzione resta col colore salvato: cambiabile da Impostazioni);
  entrata blu notte con «+» e avanzo verde (K3); «Correggi» non rosso e pulsanti da 38 px (K9); stato dei gruppi in colonna (K6); «Fatta»
  sempre a destra sul telefono (K8); Excel/Stampa e Apri la bozza/Versioni larghi uguali (G3); schede affiancate senza bianchi (K2);
  simboli delle note a linea (J2); storno con freccia circolare (J8).
- Operatore: Guida con i nomi esatti («Registra una spesa», «Come è stata pagata», «toccalo per sceglierlo») (R2/R6); «Da verificare» in
  Dashboard (R3); con zero risultati il menu mostra tutti i codici (R1); Scadenze e Rimborsi con le parole dell'operatore (R4/Q4); modulo di
  segnalazione chiuso se ce n'è già una aperta (R5); «Frais généraux» anche nell'intestazione del PDF (N-6).

## 21/11 — quindicesimo giro (grafica 9/9/9/9/9,5/8,5/8,5 · operatore tutte ≥ 9, complessivo 8,5)
Rapporti in `docs/revisione-finale-2026-11-15/quindicesimo-giro/`. Solo P3.
- Grafica: colonne del Rendiconto allineate (L1); etichette a destra dei titoli che vanno a capo (L2); Impostazioni in griglia 5 × 2 anche a 768
  (L3); titoli dei riquadri a capo sul telefono e riquadro solo a tutta riga (L4); segnaposto «Cerca nella Guida» (L5); un solo stile per eliminare
  (L6); icone della Guida (L7); tavolozza: Sport in pesca #F0C2A0 (L8/J6, in produzione resta il colore salvato); niente parole sole (L9); bordi
  delle righe di un solo tono (H6); schede della Dashboard alte quanto il contenuto anche su tablet (G16); simboli delle note più uniformi (J2).
- Operatore: Guida senza frasi rotte e con «Come è stata pagata» (R6/S2); «da verificare» anche in Movimenti (S1); «Frais généraux» in tutta
  l'app in francese (S4); «Mostra 1 movimento» e solo il proprio anticipo nei filtri (S5); messaggi di errore dei campi sempre nella lingua
  dell'app (S6); rimborsi vuoti senza didascalie doppie (S3).

## 21/11 — sedicesimo giro (grafica 9,5/8,5/9/9,5/9,5/8,5/8 · operatore aree ≥ 9, complessivo 8)
Rapporti in `docs/revisione-finale-2026-11-15/sedicesimo-giro/`. Un P2 (M1), il resto P3.
- Grafica: «Previsto e speso» con intestazioni nella stessa griglia dei numeri fino a 1099 px (M1); Scadenze sul telefono con titolo a tutta
  larghezza (M2); due punti non separabili in francese (M3); conteggi in grigio e concesso in ardesia, il blu notte solo per le entrate (M4);
  terzo pulsante di «Genera un documento» a tutta riga (M6); finanziamenti: legenda solo con il grafico, stato vuoto uguale, titoli su due righe
  (M7); DEMO in colonna nei Cambi (M8); percentuali in riga e «4 gruppi di voci» non separati (M9); rientro di «Ultimi movimenti» (M10);
  nomi dei conti senza parole sole (L9); «Come funziona» a destra dove non ci sono sotto-schede e nella riga del titolo sul telefono (K7).
- Operatore: la Guida mostra all'operatore i testi scritti per lui (T1); «Bozze da completare» anche in Scadenze, senza categorie da
  amministratore (T2); scheda della bozza senza scontrino con «tocca Modifica e fotografa lo scontrino» (T3); Rimborsi dell'operatore con
  l'elenco delle sue spese al posto della vista per persona (T4).

## 21/11 — diciassettesimo giro (grafica 9,5/9/9/9,5/9,5/9/8,5 · operatore aree ≥ 9, complessivo 8)
Rapporti in `docs/revisione-finale-2026-11-15/diciassettesimo-giro/`. Solo P3 (più N-2 dell'operatore, verificabile solo 00–03 EAT).
- Grafica: spazi e trattini non separabili nelle soglie ETS e nei testi con numeri, helper `nbText` per « · » e cifre (N2/N3); titolo di pagina
  che lascia posto alla «i» sul telefono (N1); titoli dei finanziamenti mai troncati (M7c); percentuale FR in riga in Analisi (M9); nome del
  conto intero, saldo sotto se serve (L9); legenda della ciambella più larga (N3); schede affiancate con fondi allineati e Dashboard tablet
  allineata; nella scheda Preventivo della Dashboard i due codici più oltre il previsto al posto del vuoto (N4/G16); «Correzioni» unico nel
  dettaglio del movimento con Storna e Correggi (M5); traccia vuota anche in «In attesa da» (N6); stessi mesi alterni in tutti i grafici (N5);
  gruppo 01 delle uscite in #F4E3A1, più lontano dal giallo «Uscite» (L8). J6 (Piccolino vicino al corallo) resta: è un colore salvato,
  si cambia da Impostazioni › Progetti.
- Operatore: niente paragrafo doppio «chiedi a un responsabile» (U1); l'operatore non vede i conti bancari nel riepilogo del movimento (U2);
  «comptabilisés» e «Erreur signalée :» in francese (U3); titoli degli anticipi propri con importo, «automatica» solo per lo staff (U4).
- Dopo la segnalazione del committente (21/11 sera: riquadri vuoti e schede non allineate) controllo automatico su tutte le pagine a 1440,
  768 e 375, super_admin, FR e operatore (`/tmp/aud/audit.mjs`: differenze di altezza nelle righe di schede e vuoti interni > 56 px).
  Corretti: nelle coppie la ciambella sta sopra e la legenda sotto, le liste a barre più corte distribuiscono le righe; grafici a fianco di
  elenchi centrati; Riepilogo del preventivo con Uscite ed Entrate una sotto l'altra; finanziamenti con un solo elemento senza i due grafici
  ridondanti; scheda finanziamento con Periodo e Rendiconto nella colonna destra (operatore: in colonna unica); traccia vuota uguale in tutti
  i riquadri senza dati; nome dei progetti tradotto (Frais généraux) in titoli e menu. Esito finale: nessuna riga sfalsata; restano solo i
  giorni vuoti del calendario (normali) e 56 px sopra il grafico Entrate e uscite della Dashboard a 768.

## 22/11 — diciottesimo giro (grafica: Grafici 7, Impaginazione 7, altre 9–9,5 · operatore complessivo 7)
Rapporti in `docs/revisione-finale-2026-11-15/diciottesimo-giro/`. Nuova prova obbligatoria: `/tmp/yc-final/audit.mjs` (altezze nelle righe
di schede, colonne affiancate anche in griglie diverse, vuoti interni). Correzioni:
- N7: scheda progetto con Scadenze, Documenti emessi e Finanziamenti in una riga da tre e «Ultimi movimenti» a tutta larghezza sotto.
- N8: Andamento mensile e Voci di spesa alti uguali, grafico centrato e voci distribuite. G16: colonna destra della Dashboard fino in fondo,
  Note come foglio a righe. N9: le barre delle entrate in Analisi › Previsto e speso prendevano lo stile dei campi (classe «in»): ora 8 px.
- N1: il selettore della regola del titolo su telefono conteneva :has annidati (non validi), riscritto. N10: Uscita/Entrata/Giroconto uguali.
  M9: la cifra a destra delle didascalie non va più a capo. M10: rientri di «Ultimi movimenti» uguali all'intestazione. N3: altri spazi
  non separabili. L8: gruppo 03 in lilla #D2B9FF (prima arancio vicino al giallo «Uscite»).
- Operatore: V2 l'operatore emette da solo solo quietanze e autocertificazioni; gli altri documenti restano in bozza per un responsabile
  (controllo nell'interfaccia + migrazione `20261122000100_operator_doc_issue.sql`, DA APPLICARE IN PRODUZIONE con l'ok del committente).
  V3 Conti dell'operatore con due riquadri e tabella a tutta larghezza; V4 niente conti bancari nel filtro; V5 Guida: sul telefono il
  pulsante ⓘ. V1 (codice vuoto nella conferma, 2 volte su 9) non riprodotto: resta aperto.
