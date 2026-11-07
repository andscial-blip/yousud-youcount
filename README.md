# YouCount · Contabilità YouSud ODV

Ogni spesa, il suo giustificativo · Chaque dépense, sa pièce justificative

App web installabile (PWA) per registrare entrate e uscite di YouSud ODV in Italia e in Madagascar,
archiviare i giustificativi e preparare in bozza il rendiconto per cassa ETS.
Interfaccia in italiano e francese (lingua scelta da ogni utente). Marchio: mappamondo del logo YouSud con un distintivo contabile (`scripts/gen_icons.py`).

Stato: tappe 4a e 4b (fondamenta, inserimento manuale, verifica, storni, budget, finanziamenti, conta di cassa, esportazioni Excel) con tutte le sezioni dell'app: Dashboard, Movimenti, Nuovo, Da verificare, Documenti, Progetti, Conti, Rendiconto, Fornitori e donatori, Sincronizzazione, Guida, Il mio account e, per gli amministratori, Utenti e ruoli, Conti finanziari, Piano dei conti, Progetti e centri di costo, Chiusure mensili, Impostazioni, Registro attività. Non ancora pubblicata: serve creare gli account Supabase e Vercel.

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `supabase/migrations/` | Schema del database: tabelle, RLS, funzioni contabili, rendiconto |
| `supabase/seed.sql` | Piano dei conti del Gestionale (generato da `scripts/gen_seed.py`, non modificare a mano) |
| `supabase/tests/` | Test del database (`db.test.mjs`) e stub locale di Supabase (solo per i test) |
| `tests/e2e/` | Test end-to-end: app + PostgREST + database di prova + Playwright |
| `src/app/` | Pagine Next.js: login, cruscotto, movimenti, documenti, rendiconto, altro |
| `public/sw.js` | Service worker: pagine consultabili offline, nessun dato in cache |

## Regole contabili applicate dal database

- Identificativi UUID; `client_uuid` generato sul dispositivo: un reinvio non crea doppioni.
- Stati: bozza → registrato (riceve il numero `MOV-AAAA-NNN`) → verificato.
- Alla registrazione serve un giustificativo collegato oppure il motivo per cui manca.
- Il movimento verificato non si modifica né si cancella, nemmeno con accesso diretto al database:
  si corregge con uno storno (`reverse_movement`), movimento uguale e contrario collegato all'originale.
- Quattro occhi (impostazione `four_eyes`): chi inserisce non verifica.
- Mese chiuso (`close_period`): nessuna nuova registrazione in quel periodo; riapre solo il super amministratore.
- Ogni modifica finisce in `audit_log`, che non si può alterare.
- Uscite del centro di costo «Spese generali (fuori progetto)»: righe A1-A5 portate in E1-E5.

## Ruoli

| Azione | Super admin | Admin | Responsabile | Operatore | Sola lettura |
| --- | --- | --- | --- | --- | --- |
| Vedere movimenti | tutti | tutti | tutti | propri e dei progetti assegnati | tutti tranne bozze |
| Bozze e registrazione | sì | sì | sì | sì | no |
| Modificare un registrato, verificare, stornare | sì | sì | sì | no | no |
| Chiudere un mese, conti e codici | sì | sì | no | no | no |
| Utenti e ruoli | sì | sì, tranne i super admin | no | no | no |

## Sviluppo e test locali

Richiede Node 22 e PostgreSQL 16.

```bash
npm install
npm run db:reset      # crea il DB di prova: stub Supabase + migrazioni + seed
npm run test:db       # test del database
npm run test:unit     # test delle funzioni (es. lettura degli importi)
npm run test:e2e      # app + PostgREST (POSTGREST_BIN) + Playwright
npm run build
```

Il test end-to-end usa PostgREST (lo stesso motore delle API di Supabase) e un finto servizio di accesso
con password di prova: verifica pagine, permessi e calcoli, non il vero Supabase Auth.

## Pubblicazione (da fare quando esistono gli account)

1. Creare il progetto Supabase; eseguire in ordine i file di `supabase/migrations/`, poi `supabase/seed.sql`.
   Non eseguire `supabase/tests/stub_supabase.sql`.
2. In Supabase Auth disattivare le registrazioni pubbliche.
3. Creare il primo utente da Supabase Auth, poi nell'editor SQL:
   `update public.profiles set role = 'super_admin' where email = '<email>';`
4. Su Vercel: collegare il repository e impostare le variabili di `.env.example`
   (la chiave di servizio e la chiave Anthropic solo come variabili server).
