-- 0700 · Chiusura finale dei privilegi
-- Su Supabase le nuove tabelle, viste e funzioni di "public" ricevono per default i privilegi anche per "anon".
-- Nessuna parte dell'app è accessibile senza accesso: si tolgono tutti i privilegi ad anon.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
revoke all on schema app from anon, public;
-- le funzioni dell'API restano eseguibili solo dagli utenti autenticati (i permessi veri li controllano le funzioni stesse)
grant execute on all functions in schema public to authenticated;
-- per gli oggetti creati in futuro da queste migrazioni
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
