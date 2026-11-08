# YouCount · Design system

Regole e componenti dell'interfaccia. La fonte di verità del codice è `src/app/globals.css`, che usa le variabili qui sotto. Questo documento dice quando usare ogni elemento.

## 1. Principi

1. **Ogni elemento ha una funzione.** Niente decorazioni, niente colore senza significato. Questo segue il principio di Linear: non chiedere attenzione che non ti sei guadagnato.
2. **I numeri si leggono in colonna.** Gli importi sono allineati a destra e hanno cifre tabulari (`.num`). Il formato è unico, con `money()`: EUR con 2 decimali, MGA senza decimali, separatore delle migliaia sempre presente, formato italiano o francese secondo la lingua dell'utente.
3. **Lo stato è sempre visibile.** Bozza, da verificare, verificato, da rimborsare e spuntato sono etichette (`.chip`) con lo stesso colore in tutta l'app.
4. **Telefono prima di tutto.** Sotto i 640px le tabelle diventano schede (`TableCards`). I campi sono a 16px, i comandi principali sono in basso, la pagina non scorre mai in orizzontale (la prova `test:layout` lo controlla su 9 larghezze).
5. **Contrasto WCAG AA.** Il testo normale ha almeno 4,5:1, i bordi dei campi e il focus almeno 3:1, sia nel tema chiaro sia in quello scuro.

## 2. Colori

| Variabile | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--slate` | #44546A | #3A4A61 | barra superiore, pulsante scelto nei filtri |
| `--navy` | #16324F | #C9D6E8 | titoli e cifre principali |
| `--fg` | #1C2633 | #E7ECF2 | testo |
| `--muted` | #5E6B7C | #9AA7B6 | etichette, testo secondario (5,4:1) |
| `--faint` | #626E7F | #8A97A6 | testo terziario (≥ 4,5:1 su fondo e superficie) |
| `--bg` / `--surface` / `--surface-2` | #EEF1F5 / #FFF / #F3F4F6 | #12171E / #1A212B / #212A36 | fondo pagina, pannelli, zone secondarie |
| `--line` / `--line-2` | #D0D7DE / #E4E8ED | #334052 / #2A3442 | bordi forti e separatori leggeri |
| `--line-input` | #7A8597 | #6F7C8B | bordo dei campi (3,7:1) |
| `--amber-soft` | #E8BE5A | | pulsante principale «Nuovo movimento» |
| `--green` / `--ok-bg` / `--ok-fg` | | | entrate, esito positivo |
| `--red` / `--pink` / `--pink-fg` | | | errori, saldi negativi |
| `--amber` / `--warn-bg` | | | da fare, avvisi |
| `--sky` / `--sky-bg` | | | informazioni e azioni da compiere (`.note.info`) |
| `--aqua` / `--lilac` | | | paese: Italia (aqua), Madagascar (lilla) |
| `--c-in` / `--c-out` / `--c-budget` / `--c-over` | | | grafici: entrate, uscite, budget, sforamento |

Il corsivo non si usa mai: `em` e `i` sono resi in tondo.

## 3. Tipografia

| Ruolo | Carattere | Dimensione | Peso |
|---|---|---|---|
| Titolo pagina (`h1`) | IBM Plex Sans Condensed | 22px | 700 |
| Titolo pannello (`h2`) | IBM Plex Sans Condensed | 17px, colore ardesia | 700 |
| Testo | IBM Plex Sans | 14px (16px nei campi su telefono) | 400 |
| Etichette, intestazioni di tabella | IBM Plex Sans Condensed | 12,5–13px | 600 |
| Cifre principali (KPI, importo del movimento) | IBM Plex Sans Condensed | 24–28px | 700 |

Le cifre usano sempre `font-variant-numeric: tabular-nums`.

## 4. Spazi, angoli, ombre

- Gli spazi seguono multipli di 2px. Tra i pannelli di una pagina ci sono 18px (`.stack`). Il padding interno dei pannelli è 14–16px. Nelle celle di tabella è 8px × 10px.
- Il raggio degli angoli è uno solo, `--r` = 6px. Le etichette (`.chip`) sono a pillola.
- Le ombre non si usano sui pannelli, che hanno solo il bordo. Si usano solo per gli elementi sovrapposti: schermata d'apertura, collegamento «Vai al contenuto», menu.
- Larghezze:
  - contenuto fino a 1180px;
  - pagine di modulo e impostazioni fino a 920px;
  - dettaglio del movimento in due colonne sopra i 1000px (dati a sinistra; giustificativi, storno e storico a destra).

## 5. Componenti

| Componente | Classe / file | Regole |
|---|---|---|
| Intestazione pagina | `PageHead` | titolo a sinistra, azioni e filtri a destra; sotto i 760px vanno a capo |
| Pannello | `Panel`, `.panel` | titolo facoltativo, contenuto `pad` per testo, senza `pad` per tabelle |
| KPI | `.kpi` | etichetta + cifra + riga di spiegazione; se è un link porta alla vista con gli stessi dati |
| Cifre affiancate | `.figs`, `.rec-sum` | 2–4 valori con etichetta; esito colorato solo sull'ultimo (`.ok` / `.bad`) |
| Tabella | `table.t` | intestazioni brevi; importi in `td.num.r`; sul telefono diventa schede |
| Etichetta di stato | `.chip` (`.ok`, `.warn`) | non va mai a capo dentro una parola; `.wrap` solo per testi lunghi (persona) |
| Filtri | `.seg` (`.scroll` se le voci sono più di 4) | una sola scelta; la voce attiva ha fondo ardesia |
| Ricerca | `.search` | campo con icona; la ricerca resta nell'indirizzo, così si può condividere |
| Note | `.note` (avviso), `.note.info` (da fare), `.note.ok`, `.note.err` | una nota per messaggio, senza note impilate se si possono unire |
| Pulsanti | `.btn`, `.btn.primary`, `.btn.ghost` | un solo `primary` per vista; azioni distruttive in `ghost` rosso con conferma |
| Campi | `.field` + `.input` | etichetta sopra; suggerimento sotto (`.hint`); errore in rosso sotto il campo |
| Schermata vuota | `EmptyState` | spiega cosa manca e offre l'azione per riempirla; con un filtro attivo dice solo che non c'è nulla |

## 6. Grafici

- Barre verticali per i mesi (entrate e uscite affiancate), barre orizzontali per i confronti tra progetti, barre di avanzamento per budget e speso.
- Il preventivo è annuale: niente grafici mensili del preventivo.
- Ogni grafico ha la legenda con i totali e un'alternativa testuale per i lettori di schermo.
- I colori dei grafici sono quelli di `--c-*`, mai i colori di stato.

## 7. Accessibilità

- Lingua della pagina uguale a quella dell'utente (`<html lang>`).
- Collegamento «Vai al contenuto» come primo elemento raggiungibile con il tasto Tab.
- Focus visibile: bordo ciano di 2px, 3,45:1 sul bianco.
- Le icone senza testo hanno un'etichetta (`aria-label` o `.sr-only`).
- I comandi sul telefono sono alti almeno 44px (`.big-touch`, barra in basso).

## 8. Verifiche automatiche

| Prova | Cosa controlla |
|---|---|
| `npm run test:layout` | 33 pagine × 9 larghezze × IT/FR: niente fuori schermo, niente scorrimento orizzontale, niente errori di console. `DARK=1` per il tema scuro, `ONLY_PATHS` per una sezione, `SHOT_PATHS='*'` per gli screenshot |
| `npm run test:e2e` | flussi completi per ruolo |
| `npm run test:offline` | coda offline su build di produzione |
| `npm run test:db` | regole contabili e permessi nel database |
