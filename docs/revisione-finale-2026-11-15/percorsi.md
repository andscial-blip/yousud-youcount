# YouCount — revisione finale dei percorsi d'uso

Revisore: ricercatore UX indipendente. Data: 15/11/2026. Metodo: script Playwright in `/tmp/yc-final/work` (`p1…p9e.mjs`), 375 px salvo dove indicato; nessuna lettura del codice. Dati di prova creati con l'app («PROVA UX …»). Il server di prova è caduto 4 volte (13:20, 13:32, 13:46, ~13:58) e ogni riavvio ha ripristinato i dati: è l'ambiente condiviso, non lo conto come difetto.

## 1. Esito dei percorsi

| # | Percorso | Esito | Passi | Cosa ho visto (prova) |
|---|---|---|---|---|
| 1 | Operatore: uscita MGA senza giustificativo + autocertificazione | Riuscito | 13 tocchi | Motivo con 4 scelte rapide; autocertificazione già spuntata; avviso «cassa sotto zero»; dopo: «Movimento registrato: MOV-…», «Registrane un altro», pagina portata sul modulo dell'autocertificazione; PDF AUT-2026-001 «Da firmare» (`p1.mjs`, `p2b.mjs`, `p1pdf_after.png`) |
| 2 | Operatore: uscita EUR con decimali + campo vuoto | Riuscito con riserva | 12 tocchi | «12,50» → -12,50 €; «1250» → -1.250,00 €. Errore: pagina portata sul campo, «Campo obbligatorio» in rosso + riepilogo «Per registrare mancano: …» (`p2_err_view.png`). Ma «1.250» → 1,25 € (D1) |
| 3 | Operatore: anticipo di contanti | Riuscito | 6 tocchi | «+» → Nuovo movimento → «Chiedi un anticipo»; conferma «Richiesta inviata: ora la autorizza il direttore o un responsabile»; stato «da autorizzare» + «Annulla». In Conti vede solo casse e «Anticipi aperti» (`p3_after.png`) |
| 4 | Responsabile: verifica + storno | Riuscito | 1 + 4 tocchi | Verifica dall'elenco con un tocco («Verificato. MOV-…»); storno con motivo obbligatorio; dopo: «Storno registrato … Va verificato da un'altra persona» + «Crea la copia corretta» (`p4.mjs`, `p4b.mjs`) |
| 5 | Super admin: ricevuta bozza → emessa → PDF → annullata | Riuscito con riserva | 5 + 1 + 1 + 2 | Anteprima fedele, RIC-2026-001, PDF corretto (`pdf/RIC.pdf`); annullamento con motivo. Il PDF scaricabile dopo l'annullamento è identico (D2) |
| 6 | Super admin: revisione preventivo, riga, elimina bozza | Riuscito | 1 + 6 + 3 | «Prepara una revisione» crea la copia; «Riga n. 345 salvata» e pagina portata sulla riga nuova (`p6_row_saved_375b.png`); eliminazione con conferma in pagina (`p6_delete_1440.png`) |
| 7 | Super admin: cambio password | Riuscito | – | Chiede la password attuale; «La password attuale non è corretta.»; «Le due password non coincidono.»; «Annulla» → Il mio account; password invariata (`p7b.mjs`) |
| 8 | Coerenza delle cifre 2026 | Coerente | – | Vedi tabella sotto (`p8_*.txt`) |
| 9 | Navigazione su telefono | Riuscito | – | «Altro» apre il foglio «Sezioni» (6 voci + Esci); una sola freccia indietro per pagina e funziona; titoli di Impostazioni corretti su 9 pagine; «Come si fa» apre la spiegazione della scheda; ricerca Guida immediata (`p9*.mjs`) |

### Cifre lette (percorso 8, ore 13:53)

| Dato | Dashboard | Analisi | Report mensile | Movimenti | Rendiconto |
|---|---|---|---|---|---|
| Entrate | 228.094 € | 228.094 € | 228.093,54 € | 228.093,54 € | 228.093,54 € |
| Uscite | 173.334 € | 173.334 € | 173.334,03 € | 173.334,03 € | 172.220,78 € |
| Saldo | 54.760 € | 54.760 € | 54.759,51 € | 54.759,51 € | 55.872,76 € |

Rendiconto: scarto di 1.113,25 € sulle uscite, uguale al centesimo all'avviso in pagina («18 movimenti con codici senza riga di rendiconto … 1.113,25 €»). Liquidità: Dashboard 53.090 € = Conti 53.090 € (Italia 52.000,10 € + 5.820.097 MGA ≈ 1.090 €); i 7 saldi dei conti coincidono.

## 2. Voti

| Area | Voto |
|---|---|
| UX | 7,5 |
| Facilità d'uso per un operatore poco esperto | 7 |
| Completezza delle funzionalità | 8,5 |
| Affidabilità e coerenza dei dati | 7,5 |
| Organizzazione dei contenuti e navigazione | 8 |
| Qualità complessiva | 7,5 |

**UX — 7,5.** Funziona: ogni azione ha una conferma con il passo successivo; errori vicino al campo; conferme in pagina per le azioni distruttive; recupero dell'inserimento non concluso (`p9e.mjs`). Non funziona: «Storna» è un titolo chiuso senza segno di azione (D3); etichette tecniche nello storico (D4); messaggi di validazione misti (D8). Per il 10: D1, D3, D4, D8.

**Operatore poco esperto — 7.** Funziona: motivi rapidi, «Importo letto: …» sotto il campo, avviso cassa negativa, anticipo in 6 tocchi. Non funziona: lettura del punto negli importi (D1); modulo lungo 2.100 px con 70 codici contabili in un elenco senza ricerca né «usati di recente» (D7); l'operatore non può correggere né annullare un proprio movimento appena registrato e nessun testo gli dice a chi rivolgersi (D6). Per il 10: D1, D7, D6.

**Completezza — 8,5.** Funziona: tutti i nove percorsi si chiudono, compresi autocertificazione, storno con copia corretta, documenti numerati, revisioni del preventivo. Manca: dicitura di annullamento sul PDF (D2); soglia di attenzione per spese in contanti senza giustificativo (D9). Per il 10: D2, D9.

**Affidabilità e coerenza — 7,5.** Funziona: totali identici al centesimo in cinque pagine; scarto del Rendiconto dichiarato. Non funziona: D1 può falsare un importo; D2; conteggio «da verificare» 40 e 38 nella stessa pagina (D5). Per il 10: D1, D2, D5.

**Organizzazione e navigazione — 8.** Funziona: 3 voci + «+» + «Altro»; una sola freccia; titoli coerenti; Guida per compiti con «Portami lì». Non funziona: la ricerca Guida non trova «cambio password» né «ricevuta persa» (D10); «Chiedi un anticipo» si raggiunge solo da un link di testo nel modulo o da Conti › Anticipi. Per il 10: D10, scelta «Spesa / Anticipo» sul «+».

**Qualità complessiva — 7,5.** Prodotto solido e coerente; due difetti P1 su dati e documenti impediscono un voto più alto.

## 3. Difetti

| ID | Gravità | Pagina · larghezza | Difetto | Prova |
|---|---|---|---|---|
| D1 | P1 | /nuovo · 375 | Il punto è letto come decimale: «1.250» → 1,25 €; «25.000» MGA → 25 MGA; «1.250.000» MGA → 1 MGA; «12,505» troncato a 12,50. Il campo stesso mostra le migliaia col punto. Unica difesa: la riga «Importo letto» | uscita di `p2.mjs`, `p2b.mjs` |
| D2 | P1 | /documenti-emessi/<id> · 375 | Dopo l'annullamento il pulsante principale «Scarica il PDF» dà lo stesso file, senza «ANNULLATO»; nel Registro manca data e autore dell'annullamento | `pdf/RIC2.pdf` (0 occorrenze di «annull»), `p5c.mjs` |
| D3 | P2 | /movimenti/<id> · 375 | «Storna» è una sezione chiusa che sembra un titolo: nessuna freccia, nessun pulsante | `p4_d2.png` |
| D4 | P2 | /movimenti/<id> · 375 | Storico: «modifica · Stato, verified_at, verified_by» | `p4_d2.png` |
| D5 | P2 | /movimenti?stato=recorded · 1440 | «Movimenti 40» e sotto «38 da verificare»; Dashboard, /verifica e Conti dicono 40 (i 2 giroconti non contati) | `p8b.mjs` |
| D6 | P2 | /movimenti/<id> · 375 | Operatore sul proprio movimento registrato: nessuna azione di correzione o annullamento e nessuna indicazione | `p4.mjs` («azioni operatore») |
| D7 | P2 | /nuovo · 375 | Codice contabile: elenco di 70 voci senza ricerca né recenti | `dump.mjs`, `dump_operatore__nuovo.png` |
| D8 | P3 | anticipi, storno, annullamento | Validazione del browser («Please fill out this field») invece dei messaggi dell'app usati in /nuovo | `p3_empty.png`, `p4b.mjs` |
| D9 | P2 | /nuovo · 375 | 1.250 € in contanti con motivo «Mancia o piccola spesa»: registrato senza alcun avviso | `p2b.mjs` (AVVISI vuoto) |
| D10 | P3 | /guida · 375 | Ricerca: «cambio password» e «ricevuta persa» → «Nessun argomento trovato» («manca ricevuta» invece trova) | `p9b.mjs`, `p9c.mjs` |
| D11 | P3 | vari | «Testo ripreso dal Gestionale: da far verificare al commercialista» mostrato all'operatore; «Salvato.» generico dopo «Prepara una revisione»; emissione del documento con un solo tocco; riga nuova del preventivo «Generale» mentre le altre dicono «Spese generali»; movimento stornato ancora solo «Verificato» nell'elenco | `p1pdf_after.png`, `p6_prep_1440.png`, `p5b.mjs`, `p6_row_saved_375b.png`, `p4b.mjs` |

## 4. Non verificato

- Foto o file del giustificativo e lettura AI; uso senza rete e sincronizzazione; PWA installata; tastiera di un telefono vero (quale separatore offre).
- Seguito dell'anticipo (autorizzazione, consegna, ricevute); verifica dello storno da una seconda persona; completamento di «Crea la copia corretta».
- Versione francese, 768 px, esportazioni Excel, mesi chiusi.
- Formato delle date nei campi (nel browser di prova appare mm/dd/yyyy: dipende dal browser).
- Causa delle cadute del server: una è avvenuta durante un salvataggio; un primo clic su «Genera il PDF» non ha dato esito in 25 s e al secondo tentativo ha funzionato. Non attribuibile con certezza all'app.
