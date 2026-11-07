-- 0800 · search_path fisso anche sulle funzioni di supporto (avviso Supabase 0011)
alter function app.fail(text, text) set search_path = '';
alter function app.touch() set search_path = '';
alter function app.result(public.movements, text) set search_path = '';
alter function app.append_only() set search_path = '';
alter function app.profiles_guard() set search_path = '';
alter function app.documents_guard() set search_path = '';
