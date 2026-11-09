-- Eliminazione di un utente (solo super amministratore, password reinserita, motivo).
-- · Se l'utente non ha lasciato dati (movimenti, documenti, preventivi, …): si eliminano profilo e accesso.
-- · Se ha lasciato dati: il nome resta nello storico (chi ha registrato cosa), ma l'accesso viene eliminato:
--   niente più email né password, sessioni chiuse, accesso bloccato per sempre; il profilo è marcato «eliminato».
alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.user_delete(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.profiles; v_refs bigint := 0; r record; v_n bigint;
begin
  if not app.has_role('super_admin') then perform app.fail('forbidden', 'solo il super amministratore elimina un utente'); end if;
  if not app.recent_password() then perform app.fail('reauth', 'reinserisci la password per confermare'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo (almeno 5 caratteri)'); end if;
  if p_id = auth.uid() then perform app.fail('invalid', 'non puoi eliminare te stesso'); end if;
  select * into v_p from public.profiles where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'utente'); end if;
  if v_p.role = 'super_admin' then perform app.fail('forbidden', 'il super amministratore non si elimina'); end if;
  if v_p.deleted_at is not null then perform app.fail('invalid', 'utente già eliminato'); end if;

  -- quante righe dei dati puntano a questo profilo (tutte le chiavi esterne verso profiles, tranne i progetti assegnati)
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
     where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.conrelid <> 'public.project_members'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', r.tbl, r.col) into v_n using p_id;
    v_refs := v_refs + v_n;
  end loop;

  delete from public.project_members where user_id = p_id;
  if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id = $1' using p_id; end if;

  if v_refs = 0 then
    delete from public.profiles where id = p_id;
    delete from auth.users where id = p_id;
    return jsonb_build_object('outcome', 'deleted', 'name', v_p.full_name);
  end if;

  update public.profiles set active = false, email = null, deleted_at = now(), all_projects = false,
    full_name = left(v_p.full_name, 180) where id = p_id;
  update auth.users set email = null, encrypted_password = null, banned_until = 'infinity'::timestamptz,
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('deleted_reason', trim(p_reason), 'deleted_by', auth.uid())
   where id = p_id;
  return jsonb_build_object('outcome', 'disabled', 'name', v_p.full_name, 'references', v_refs);
end $$;
revoke all on function public.user_delete(uuid, text) from public, anon;
grant execute on function public.user_delete(uuid, text) to authenticated;

-- l'utente non può togliersi da solo il segno di eliminazione
create or replace function app.profiles_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon')
     and (new.role is distinct from old.role or new.active is distinct from old.active
          or new.org_id is distinct from old.org_id or new.all_projects is distinct from old.all_projects
          or new.email is distinct from old.email or new.deleted_at is distinct from old.deleted_at) then
    perform app.fail('forbidden', 'campo del profilo non modificabile dall''utente');
  end if;
  return new;
end $$;
