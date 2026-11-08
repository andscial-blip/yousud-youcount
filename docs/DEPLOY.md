# Messa online di YouCount

## Stato (8 novembre 2026)

| Elemento | Stato |
|---|---|
| Supabase `youcount` (ref `uxzeonwmakanumlojfax`, eu-central-1) | online, piano **gratuito** (pausa dopo 7 giorni senza attività, nessun backup automatico) |
| Migrazioni 0100–1100, seed, Storage privato, accesso anonimo revocato | applicati |
| Dati del Gestionale (178 movimenti) | importati e verificati: saldi, rendiconto per codice, numerazione |
| Vercel `youcount` (fra1), deploy automatico da `main` | online: https://youcount-gold.vercel.app |
| Super amministratore | creato (Andrea) |
| Lettura IA (`ANTHROPIC_API_KEY`) | attiva, verificata su documenti reali |
| Coda offline, backup scaricabile, schermata d'apertura, scansione nuova | online |
| Email (inviti, reimpostazione password) | SMTP Gmail di Andrea attivo (limite 30/ora), testi IT/FR; reimpostazione password verificata l'8/11 (richiesta → link → nuova password) |

## Da fare prima del lancio al team

- Email: oggi partono dal Gmail di Andrea (SMTP smtp.gmail.com, password per le app). **Dopo i test completi: passare a un mittente con dominio yousud** (es. Resend con DNS di yousud.it, mittente no-reply@yousud.it).
- Piano Supabase gratuito: niente backup automatici → scaricare ogni settimana il backup da Impostazioni e salvarlo nel Drive condiviso di YouSud (la dashboard lo ricorda agli amministratori).

## Prove automatiche

`npm run test:db` (29) · `test:unit` (16) · `test:e2e` (24) · `test:offline` (6, build di produzione) ·
`test:layout` (30 pagine, IT/FR, 320–1280 px). Prima di `test:db` serve `npm run db:reset`.

## Variabili d'ambiente per Vercel

| Nome | Valore | Dove |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uxzeonwmakanumlojfax.supabase.co` | pubblica |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_tBG49rPgFVFJgPDJQmyPvQ_P74X-xRK` | pubblica (la sicurezza la fa la RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → secret key | **solo server**, mai `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | facoltativa: senza, la lettura IA resta spenta | solo server |

## Passi

1. GitHub: creare il repository privato vuoto `andscial-blip/yousud-youcount` (senza README).
2. Push del codice (lo fa Claude una volta collegato il repository).
3. Vercel: accesso con GitHub → Add New → Project → importare `yousud-youcount` → inserire le variabili qui sopra → Deploy.
4. Supabase → Authentication:
   - Sign In / Providers: disattivare "Allow new users to sign up".
   - URL Configuration: Site URL = indirizzo Vercel; Redirect URLs = `<indirizzo Vercel>/auth/confirm`.
   - Email Templates "Invite user" e "Reset password": link
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (per il reset `type=recovery`).
5. Supabase → Authentication → Users → Invite user con l'email del super amministratore; dopo l'invito:
   `update public.profiles set role = 'super_admin', all_projects = true where email = '<email>';`
6. Prova reale: accesso, nuovo movimento con foto, verifica da un secondo utente, rendiconto, esportazione.

## Non ancora verificato sull'ambiente reale

Invito di un collega via email, uso offline su un telefono reale.
