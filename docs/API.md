# YouCount · API per le app collegate (v1)

Serve al futuro gestionale centrale di YouSud («app madre») per leggere i dati contabili di YouCount senza copiarli a mano.
È solo in lettura. Le scritture, cioè movimenti creati da un'altra app, arriveranno con una versione 2, da progettare insieme all'app madre.

## Accesso

1. Un amministratore crea una chiave in **Impostazioni → Collegamento con altre app**. La chiave (`yc_…`) si vede una sola volta. Nel database resta solo la sua impronta SHA-256.
2. Ogni richiesta porta l'intestazione `Authorization: Bearer yc_…`.
3. La chiave vede solo i dati del suo ente. Non vede le bozze e non vede i dati personali delle controparti: codice fiscale, IBAN e contatti restano in YouCount.
4. Una chiave revocata smette di funzionare subito. Ogni creazione e ogni revoca resta nel Registro attività.

## Richieste

```
GET https://youcount-gold.vercel.app/api/v1/integrazione/{entità}?since={ISO}&after={uuid}&limit={1–1000}
```

| Entità | Contenuto |
| --- | --- |
| `movements` | entrate, uscite, giroconti registrati o verificati: importi in valuta originale e in EUR, `sign` (−1 = storno), conto, codice (`category_code`), progetto, finanziamento, controparte, `paid_by`, stato del rimborso, `document_ids` |
| `documents` | giustificativi: tipo, data, numero, importo, nome del file, impronta `sha256`, percorso nell'archivio |
| `accounts` | conti finanziari (EUR/MGA, Italia/Madagascar) con saldo iniziale |
| `categories` | piano dei conti: codice, nomi IT/FR, gruppo, riga del rendiconto Mod. D |
| `projects` | progetti e centri di costo |
| `grants` | finanziamenti: finanziatore, progetto, importo, periodo, stato |
| `counterparties` | fornitori, donatori, beneficiari: solo nome, tipo, P.IVA/NIF, paese |

## Risposta e lettura incrementale

```json
{ "api_version": 1, "entity": "movements", "org_id": "…", "count": 500,
  "items": [ { "id": "…", "ref": "MOV-2026-001", "updated_at": "2026-11-08T09:14:42.767+00:00", "…": "…" } ],
  "next": { "since": "2026-11-08T09:14:42.767+00:00", "after": "…" } }
```

- Le righe arrivano in ordine di `updated_at`, poi di `id`.
- Se c'è `next`, la pagina successiva si chiede passando `since=next.since&after=next.after`. Se `next` è `null`, i dati sono finiti.
- Sincronizzazione: l'app madre conserva l'ultimo `next` e la volta dopo riparte da lì. Riceve solo ciò che è cambiato, comprese le modifiche: per esempio un movimento passato da registrato a verificato.
- Un movimento non si cancella mai. Un errore si corregge con uno storno: un nuovo movimento con `reverses_id` uguale all'originale e `sign` = −1.
- Identificativi: ogni riga ha un `id` UUID stabile e l'`org_id` dell'ente. Sono le chiavi da usare per i collegamenti nell'app madre.

## Errori

| Stato | `error` | Quando |
| --- | --- | --- |
| 401 | `unauthorized` | chiave mancante, sbagliata o revocata |
| 403 | `forbidden` | la chiave non ha il permesso di lettura |
| 400 | `invalid` | `since` non è una data o `after` non è un UUID |
| 404 | `invalid` | entità sconosciuta (la risposta elenca quelle valide) |

## Cosa resta da decidere con l'app madre

- Scritture: quali dati l'app madre potrà creare in YouCount (per esempio spese da un'app mobile) e con quali controlli. Le regole contabili restano comunque nel database di YouCount.
- File dei giustificativi: per ora l'API dà il percorso. Il download dei file richiederà link temporanei firmati.
- Notifiche: se all'app madre serve sapere subito di una modifica, si aggiunge un webhook. Altrimenti basta leggere a intervalli regolari con `since`.
