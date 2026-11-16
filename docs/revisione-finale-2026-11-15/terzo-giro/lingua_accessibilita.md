# YouCount — testi, francese, accessibilità (revisione finale indipendente)

Copia locale, 16/11/2026. Prove in `/tmp/yc-final/work/la/`.

## Cosa ho fatto

| Controllo | Quantità |
|---|---|
| Testo letto, italiano e francese | 37 + 37 pagine, più 404, login, offline |
| Aiuto in linea aperto | 35 pagine per lingua |
| Etichette citate nell'aiuto confrontate con la pagina | IT 25 pagine, 172 etichette · FR 16 pagine, 122 |
| Francese in schermata | 9 pagine a 375 e 2 a 1440 guardate; misure automatiche su 16 pagine a 375 e a 1440 |
| axe-core (WCAG 2.0–2.2 A/AA e buone pratiche) | 18 pagine a 1440, 6 a 375 |

## Voti

| Area | Voto |
|---|---|
| Chiarezza dei testi (italiano) | 8,5 |
| Francese | 8 |
| Coerenza terminologica | 7,5 |
| Guida e aiuto in linea | 8,5 |
| Accessibilità | 8,5 |

### Chiarezza (italiano) — 8,5
- Funziona: frasi brevi e concrete; le regole sono spiegate dove servono; l'errore di invio elenca i campi mancanti («Per registrare mancano: importo, codice contabile, descrizione, giustificativo»); nessun messaggio tecnico visto.
- Non funziona: gergo interno («Gestionale», «foglio documents», «impronta», «nel progetto del codice»); etichetta «dai dati» poco chiara; «Nessun dato.» per i giustificativi assenti; campi obbligatori non segnati prima dell'invio.
- Per il 10: D3, D7, D23, D29.

### Francese — 8
- Funziona: corretto e naturale; termini giusti (extourne, rapprochement, relevé, tiers, expert-comptable, bailleur, brouillon); virgolette con spazio insecabile 236 su 240; due punti 124 insecabili, 25 con spazio normale, 15 senza spazio; a 375 e 1440 nessun testo fuori schermo né parola spezzata (larghezza contenuto = schermo su 16 pagine).
- Non funziona: calchi («des données», «compte rendu de caisse»); resti italiani («Gestionale», titolo della scheda, parola «AZZERA»); mesi abbreviati in modi diversi; refusi tipografici sparsi.
- Per il 10: D1–D6, D12–D17.

### Coerenza terminologica — 7,5
- Funziona: menu, titolo della scheda del browser e linguette coincidono; stati (bozza, registrato, verificato) coerenti.
- Non funziona: lo stesso concetto ha più nomi (D8–D13), in francese più che in italiano.
- Per il 10: un nome solo per concetto, uguale in menu, pagina, aiuto e Guida.

### Guida e aiuto — 8,5
- Funziona: aiuto specifico su 35 pagine su 37; la Guida ha 22 «Come fare per…» con collegamento diretto; le etichette citate esistono quasi tutte (non trovate 44 IT e 34 FR, in gran parte comandi che compaiono solo dopo un'azione).
- Non funziona: 2 pagine senza spiegazione; 2 etichette citate sbagliate; aiuti molto lunghi (Preventivo circa 4.900 caratteri); italiano e francese divergono in un punto.
- Per il 10: D18–D21.

### Accessibilità — 8,5
- Funziona: axe senza violazioni WCAG su 23 controlli su 24; `lang` corretto ovunque (it o fr, login compreso); «Vai al contenuto»; 16 campi su 16 con etichetta nel nuovo movimento; ordine di tabulazione logico (giustificativo, tipo, importo, data, pagatore, conto, codice, progetto, controparte, modalità, descrizione, note, pulsanti); fuoco visibile (contorno 2 px; nei campi bordo blu e alone); aiuto e ricerca sono modali e trattengono il fuoco; Esc chiude aiuto, filtri e ricerca e riporta il fuoco sul pulsante.
- Non funziona: errori dei campi incompleti per i lettori di schermo (D22, D23); bersagli piccoli a 375 (D24, D25); titoli della scheda non specifici (D26).
- Per il 10: D22–D27.

## Numeri di axe

| Pagina | Critiche / serie / moderate / lievi | Regola ed elemento | Contrasto «non determinabile» |
|---|---|---|---|
| /login, /offline | 0/0/0/0 | – | 0 |
| / | 0/0/0/0 | – | 20 |
| /movimenti, /movimenti/id | 0/0/0/0 | – | 0 |
| /nuovo | 0/0/0/0 | – | 5 |
| /conti | 0/0/0/0 | – | 1 |
| /preventivo | 0/0/0/0 | – | 17 |
| /analisi | 0/0/0/0 | – | 22 |
| /report | 0/0/0/0 | – | 17 |
| /documenti-emessi | 0/0/1/0 | landmark-unique: `nav.side-nav` (più `nav` con lo stesso nome «Sezioni») | 1 |
| /scadenze | 0/3/0/0 | target-size: voci del calendario `a.cal-i`, 150×20 px | 21 |
| /guida | 0/0/1/0 | landmark-unique: `nav.side-nav` | 0 |
| /admin/impostazioni, /anticipi, /riconciliazione | 0/0/0/0 | – | 0 |
| /rendiconto, /progetti | 0/0/0/0 | – | 1 e 10 |
| A 375: /altro, /, /nuovo, /movimenti, /login, /offline | 0/0/0/0 | – | 1, 21, 5, 1, 0, 0 |

Altre misure:
- Contrasto, misura mia su 8 pagine a 1440: 0 testi sotto 4,5:1 (2 falsi positivi nei grafici di /scadenze). Carattere minimo 12 px; 11 px in /preventivo (2 elementi) e /analisi (18).
- Invio a vuoto del nuovo movimento: in italiano `aria-invalid` su 3 campi su 4 mancanti; in francese su 4 su 6. Avviso con `role="alert"`. Nessun `aria-describedby`. Il fuoco resta sul pulsante.
- Bersagli a 375 (16 pagine, 772 comandi): 429 (56 %) almeno 44 px; 247 tra 24 e 43 px; 96 sotto 24 px (quasi tutti collegamenti di testo negli elenchi, alti 18–21 px). Comandi principali: «+» 52×52; icone in alto 34×44; «Mode d'emploi» 134×40; anno 71×34; tipo di movimento alto 40; «Filtres» 42×44.

## Difetti

| N. | Gravità | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| D1 | P2 | /login, /offline, 404 · FR | Titolo della scheda in italiano («YouCount · Contabilità YouSud») con testo francese e `lang="fr"` | `misc.mjs`, `admin_fr__pagina-che-non-esiste.txt` |
| D2 | P2 | /scadenze · FR | Etichetta «des données» (calco di «dai dati»): non dice che la scadenza è calcolata dall'app | `sheet_C.png` |
| D3 | P2 | /rendiconto, dettaglio movimento, /admin/piano-conti · IT e FR | «Gestionale» usato come nome proprio, non spiegato; in francese resta in italiano | `admin_fr__rendiconto.txt`, `v1440_movimenti_ID.png` |
| D4 | P3 | /rendiconto, /rimborsi, /report · FR | «Compte rendu de caisse» per «rendiconto per cassa»: calco; in /anticipi lo stesso concetto è «rapport» | `admin_fr__rimborsi.txt`, `admin_fr__anticipi.txt` |
| D5 | P3 | /cambi · FR | Mesi «Jui» e «Jui» (giugno e luglio uguali); altrove «Janv/Févr/Juil» e «janv» | `admin_fr__cambi.txt` |
| D6 | P3 | /admin/conti, /cambi, /rendiconto, /scadenze · FR | Due punti senza spazio: «Solde initial: », «Octobre: », «2025: –», «à ce jour: » (15 casi) | controllo tipografico sui testi FR |
| D7 | P2 | /nuovo · IT e FR | Aiuto: «Un movimento registrato non si modifica più»; sotto i pulsanti: «Poi lo modifica solo un responsabile» | `super_admin__nuovo.txt` |
| D8 | P2 | /nuovo, /admin/piano-conti, Dashboard · IT e FR | Un concetto, quattro nomi: «Categorie», «Codice contabile», «voce» («Cerca una voce…»), «codici oltre il preventivo» (FR: Catégories, Code comptable, poste, codes) | testi delle pagine |
| D9 | P2 | Movimenti, Documenti · FR | «justificatif», «pièce justificative», «pièce» alternati: menu «Justificatifs», modulo «Pièce justificative», filtro «Sans justificatif», elenco «Sans pièce» | conteggio dei termini, `last.mjs` |
| D10 | P3 | dettaglio movimento, /documenti-emessi, /documenti · FR | Lo stesso documento AUT è «Attestation de dépense», «Attestation», «Attestation sur l'honneur» | testi FR |
| D11 | P3 | Impostazioni · IT e FR | Titolo dell'aiuto diverso dalla linguetta: «Il mio account» / «Il tuo account»; «Conti finanziari» / «Conti (amministrazione)»; FR «Association et documents» / «Organisme et documents» | confronto titoli |
| D12 | P3 | barra in basso e laterale · FR | «Accueil» in basso, «Tableau de bord» nel menu; «Déconnexion» nella barra laterale, «Se déconnecter» altrove | `sheet_A.png`, `v1440_nuovo.png` |
| D13 | P3 | /riconciliazione · FR | «pointés / à pointer», «À cocher», «cochez» per la stessa azione | `admin_fr__riconciliazione.txt` |
| D14 | P3 | /analisi, /progetti · FR | «77%» senza spazio accanto a «77 %» | `admin_fr__analisi_vista_budget.txt` |
| D15 | P3 | tutta l'app · IT e FR | Apostrofi misti (FR: 319 dritti, 143 tipografici) | conteggio |
| D16 | P3 | /admin/impostazioni, /admin/registro · FR | «Email» accanto a «E-mail»; tassi «4883.54» con punto decimale; tabella «Fournisseurs et donateurs» invece di «Tiers» | testi FR |
| D17 | P3 | /nuovo · FR 1440 | «Argent de YouSud» va a capo su due righe nel selettore | `v1440_nuovo.png` |
| D18 | P2 | /chiedi, /altro · IT e FR | Aiuto vuoto: «Per questa pagina non c'è ancora una spiegazione specifica» | `super_admin__chiedi.txt` |
| D19 | P2 | /anticipi, /nuovo · IT e FR | L'aiuto cita «Con l'anticipo» / «Avec l'avance»; il pulsante è «Anticipo» / «Avance» | `labels_it.txt`, `super_admin__nuovo.txt` |
| D20 | P3 | Dashboard · FR | L'aiuto cita il filtro «Sans pièce»; il filtro si chiama «Sans justificatif (motif indiqué)» | `last.mjs` |
| D21 | P3 | /anticipi · IT e FR | Aiuto diverso nelle due lingue (FR «Fiche et impression», IT «estratto nel portafoglio») | testi |
| D22 | P2 | /nuovo · tutte | Errori: `aria-invalid` solo su parte dei campi mancanti (progetto e giustificativo esclusi); «Campo obbligatorio» non collegato al campo; il fuoco non va al primo errore | `a11y1.json`, `nuovo_err_it_1440.png` |
| D23 | P2 | /nuovo · tutte | Campi obbligatori non segnalati prima dell'invio, né a vista né nel codice | `v1440_nuovo.png`, `a11y1.json` |
| D24 | P2 | /scadenze · 375 e 1440 | Voci del calendario troppo piccole: 42×6 px a 375, 150×20 a 1440 | `fr_admin_fr_375.json`, axe |
| D25 | P3 | barra in alto e modulo · 375 | Icone 34×44, «Mode d'emploi» alto 40, anno 71×34, selettore del tipo alto 40 | `fr_admin_fr_375.json` |
| D26 | P3 | /nuovo, dettaglio movimento, dettaglio progetto, password · IT e FR | Titolo della scheda uguale a quello della sezione («Movimenti · YouCount») | confronto titoli |
| D27 | P3 | /movimenti · 1440 | Pannello filtri: `role="dialog"` senza `aria-modal`; il fuoco non entra all'apertura | `misc.mjs` |
| D28 | P3 | /movimenti, /preventivo · FR 375 | Segnaposto di ricerca troncato («Rechercher par descripti») | `sheet_B.png`, `sheet_D.png` |
| D29 | P3 | /admin/dati · IT e FR | «foglio documents», «impronta», «nel progetto del codice» | `super_admin__admin_dati.txt` |

Nessun P0 né P1.

## Non verificato
- Conferme di storno, chiusura mese, eliminazione, emissione di documenti: finestre non aperte.
- Etichette dell'aiuto che compaiono solo dopo un'azione (44 IT, 34 FR): non provate una per una. Il controllo francese si è fermato a 16 pagine per una caduta del server.
- Lettore di schermo reale, zoom al 200 %, PWA installata, telefoni veri.
- 143 nodi di contrasto che axe non sa giudicare (testi su grafici e sfumature).
- Nome accessibile del gruppo «Come è stata pagata» e dei grafici.
- Il server si è riavviato più volte ricaricando i dati: alcune cifre differiscono tra le due lingue per questo, non per un difetto.
