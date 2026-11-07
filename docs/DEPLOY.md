# Messa online di YouCount

## Stato (7 novembre 2026)

| Elemento | Stato |
|---|---|
| Progetto Supabase `youcount` (ref `uxzeonwmakanumlojfax`, eu-central-1) | creato |
| Migrazioni 0100–0800 | applicate |
| Seed (piano dei conti del Gestionale) | caricato: 8 conti, 51 righe di rendiconto, 15 gruppi, 89 codici, 14 metodi, 10 progetti |
| Bucket `documents` privato + 2 policy | creati |
| Accesso anonimo a tabelle e funzioni | revocato (verificato con `has_table_privilege` / `has_function_privilege`) |
| Repository GitHub `andscial-blip/yousud-youcount` (privato) | creato, codice caricato |
| Progetto Vercel `youcount` (fra1), collegato al repository | online: https://youcount-gold.vercel.app (protezione Vercel solo sulle anteprime) |
| Configurazione Auth (Site URL, iscrizioni chiuse, modelli email) | da fare dal pannello Supabase |
| Primo super amministratore | da creare dopo il primo deploy |

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

Accesso e inviti via Supabase Auth, caricamento file nello Storage, lettura IA con chiave Anthropic vera.
In locale passano: database 29/29, unit 8/8, end-to-end 19/19 (con Auth e Storage simulati), build di produzione.
