-- Il super amministratore può verificare anche i movimenti che ha inserito o registrato lui
-- (richiesta di Andrea, 09/11/2026). Per tutti gli altri resta la regola «quattro occhi».
-- Chi ha verificato resta comunque scritto sul movimento (verified_by) e nel registro delle modifiche.
create or replace function public.verify_movement(p_id uuid, p_expected_version int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid := app.me_org(); v_m public.movements;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'serve un responsabile'); end if;
  select * into v_m from public.movements where id = p_id and org_id = v_org for update;
  if not found then perform app.fail('not_found', 'movimento'); end if;
  if v_m.status = 'verified' then return app.result(v_m, 'duplicate'); end if;
  if v_m.status <> 'recorded' then perform app.fail('invalid_transition', 'si verifica solo un movimento registrato'); end if;
  if p_expected_version is distinct from v_m.version then
    return app.result(v_m, 'conflict') || jsonb_build_object('current', to_jsonb(v_m));
  end if;
  if (app.setting(v_org, 'four_eyes', 'true'::jsonb))::text = 'true'
     and (v_m.created_by = v_uid or v_m.recorded_by = v_uid)
     and not app.has_role('super_admin') then
    perform app.fail('four_eyes', 'chi ha inserito il movimento non può verificarlo');
  end if;
  update public.movements set status = 'verified', verified_by = v_uid, verified_at = now(), updated_by = v_uid
  where id = p_id returning * into v_m;
  return app.result(v_m, 'applied');
end $$;
