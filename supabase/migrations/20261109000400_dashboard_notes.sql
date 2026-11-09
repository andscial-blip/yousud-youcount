-- Note della Dashboard: un promemoria libero condiviso nell'ente (sotto «Saldo dei conti»).
-- Le legge chi è nell'ente; le scrive chiunque non sia in sola lettura. Ogni salvataggio resta nel registro modifiche.
create or replace function public.dashboard_notes_save(p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  if length(coalesce(p_text, '')) > 4000 then perform app.fail('invalid', 'note troppo lunghe (massimo 4000 caratteri)'); end if;
  v := jsonb_build_object('text', coalesce(p_text, ''), 'by', auth.uid(),
         'by_name', (select full_name from public.profiles where id = auth.uid()), 'at', now());
  insert into public.settings(org_id, key, value) values (app.me_org(), 'dashboard_notes', v)
  on conflict (org_id, key) do update set value = excluded.value;
  return v;
end $$;
revoke all on function public.dashboard_notes_save(text) from public, anon;
grant execute on function public.dashboard_notes_save(text) to authenticated;
