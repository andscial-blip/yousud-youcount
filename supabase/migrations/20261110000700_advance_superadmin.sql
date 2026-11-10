-- Anticipi (richiesta del 10/11): il super amministratore non ha bisogno dell'approvazione di altri — la sua richiesta
-- nasce autorizzata, può autorizzare, consegnare e chiudere anche quando è lui a chiedere o a ricevere, senza i limiti delle
-- soglie — e può eliminare una richiesta (resta traccia nel registro modifiche; un'eventuale consegna già registrata resta
-- come movimento e va gestita a parte).

create or replace function public.advance_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_acc public.accounts; v_r public.advance_requests; v_amt numeric := (p->>'amount')::numeric;
  v_use date := coalesce(nullif(p->>'use_date', '')::date, current_date); v_by date; v_rate numeric;
  v_ben uuid := nullif(p->>'beneficiary_id', '')::uuid; v_name text; v_acc_id uuid := nullif(p->>'account_id', '')::uuid;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  if v_ben is not null and not exists (select 1 from public.profiles where id = v_ben and org_id = v_org) then
    perform app.fail('not_found', 'utente');
  end if;
  if v_acc_id is null then
    if v_ben is not null then select full_name into v_name from public.profiles where id = v_ben;
    else v_name := p->>'holder'; end if;
    if v_amt is null or v_amt <= 0 then perform app.fail('invalid', 'importo'); end if;
    v_acc_id := app.advance_account_for(v_name, coalesce(nullif(p->>'currency', ''), 'MGA'), p->>'location');
  end if;
  select * into v_acc from public.accounts where id = v_acc_id and org_id = v_org and kind = 'advance' and active;
  if not found then perform app.fail('not_found', 'persona'); end if;
  if v_amt is null or v_amt <= 0 then perform app.fail('invalid', 'importo'); end if;
  -- niente nuovo anticipo a chi ne ha uno da giustificare oltre la scadenza
  if exists (select 1 from public.advance_requests r where r.account_id = v_acc.id and r.status = 'delivered' and r.report_by < current_date) then
    perform app.fail('advance_overdue', 'c''è un anticipo da giustificare oltre la scadenza');
  end if;
  v_by := least(coalesce(nullif(p->>'report_by', '')::date, v_use + 15), v_use + 30);
  if v_by < v_use then v_by := v_use + 15; end if;
  if v_acc.currency = 'MGA' then select public.fx_rate_for(v_use) into v_rate; end if;
  insert into public.advance_requests(org_id, account_id, beneficiary_id, role_kind, amount, currency, amount_eur, purpose, project_id, category_id,
                                      use_date, report_by, requested_by)
  values (v_org, v_acc.id, v_ben, coalesce(nullif(p->>'role_kind', ''), 'volunteer'), v_amt, v_acc.currency,
          case when v_acc.currency = 'EUR' then v_amt when v_rate > 0 then round(v_amt / v_rate, 2) end,
          trim(p->>'purpose'), nullif(p->>'project_id', '')::uuid, nullif(p->>'category_id', '')::uuid, v_use, v_by, auth.uid())
  returning * into v_r;
  -- il super amministratore non ha bisogno dell'autorizzazione di altri: la sua richiesta nasce già autorizzata
  if app.has_role('super_admin') then
    update public.advance_requests set status = 'authorized', authorized_by = auth.uid(), authorized_at = now(), authorized_amount = v_r.amount,
      decision_note = 'autorizzata dal super amministratore', updated_at = now() where id = v_r.id returning * into v_r;
  end if;
  return to_jsonb(v_r);
end $$;
revoke all on function public.advance_request(jsonb) from public, anon;
grant execute on function public.advance_request(jsonb) to authenticated;

create or replace function public.advance_step(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_r public.advance_requests; v_step text := p->>'step'; v_amt numeric; v_eur numeric; v_m public.movements;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_r from public.advance_requests where id = nullif(p->>'id', '')::uuid and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'richiesta'); end if;

  if v_step in ('authorize', 'reject') then
    if v_r.status <> 'requested' then perform app.fail('invalid_state', v_r.status); end if;
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
    if not app.has_role('super_admin') and (auth.uid() = v_r.requested_by or auth.uid() = v_r.beneficiary_id) then perform app.fail('four_eyes', 'chi autorizza non può essere chi chiede o chi riceve'); end if;
    if v_step = 'reject' then
      update public.advance_requests set status = 'rejected', authorized_by = auth.uid(), authorized_at = now(),
        decision_note = nullif(trim(coalesce(p->>'note', '')), ''), updated_at = now() where id = v_r.id returning * into v_r;
      return to_jsonb(v_r);
    end if;
    v_amt := coalesce(nullif(p->>'amount', '')::numeric, v_r.amount);
    if v_amt <= 0 or v_amt > v_r.amount then perform app.fail('invalid', 'importo autorizzato'); end if;
    v_eur := case when v_r.amount_eur is null then null else round(v_r.amount_eur * v_amt / v_r.amount, 2) end;
    if v_eur is not null and app.has_role('responsabile') and app.adv_limit('resp') is not null and v_eur > app.adv_limit('resp') then
      perform app.fail('over_limit', 'serve un amministratore');
    end if;
    if not app.has_role('super_admin') and v_eur is not null and app.adv_limit('admin') is not null and v_eur > app.adv_limit('admin') and length(trim(coalesce(p->>'board_ref', ''))) < 3 then
      perform app.fail('board_needed', 'oltre la soglia serve la delibera del Consiglio');
    end if;
    update public.advance_requests set status = 'authorized', authorized_by = auth.uid(), authorized_at = now(), authorized_amount = v_amt,
      board_ref = nullif(trim(coalesce(p->>'board_ref', '')), ''), decision_note = nullif(trim(coalesce(p->>'note', '')), ''), updated_at = now()
    where id = v_r.id returning * into v_r;

  elsif v_step = 'deliver' then
    if v_r.status <> 'authorized' then perform app.fail('invalid_state', v_r.status); end if;
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
    if not app.has_role('super_admin') and auth.uid() = v_r.beneficiary_id then perform app.fail('four_eyes', 'chi consegna non può essere chi riceve'); end if;
    select * into v_m from public.movements where id = nullif(p->>'movement_id', '')::uuid and org_id = v_r.org_id;
    if not found or v_m.kind <> 'transfer' or v_m.to_account_id <> v_r.account_id then perform app.fail('invalid', 'giroconto di consegna'); end if;
    update public.advance_requests set status = 'delivered', delivery_movement_id = v_m.id, delivered_at = v_m.op_date, updated_at = now()
    where id = v_r.id returning * into v_r;

  elsif v_step = 'report' then
    if v_r.status <> 'delivered' then perform app.fail('invalid_state', v_r.status); end if;
    if not (app.has_role('super_admin','admin','responsabile') or auth.uid() in (v_r.requested_by, v_r.beneficiary_id)) then perform app.fail('forbidden'); end if;
    update public.advance_requests set status = 'reported', reported_at = now(), updated_at = now() where id = v_r.id returning * into v_r;

  elsif v_step = 'close' then
    if v_r.status not in ('delivered', 'reported') then perform app.fail('invalid_state', v_r.status); end if;
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
    if not app.has_role('super_admin') and auth.uid() = v_r.beneficiary_id then perform app.fail('four_eyes', 'chi chiude non può essere chi ha ricevuto'); end if;
    update public.advance_requests set status = 'closed', closed_by = auth.uid(), closed_at = now(),
      close_note = nullif(trim(coalesce(p->>'note', '')), ''), updated_at = now() where id = v_r.id returning * into v_r;

  elsif v_step = 'cancel' then
    if v_r.status not in ('requested', 'authorized') then perform app.fail('invalid_state', v_r.status); end if;
    if not (app.has_role('super_admin','admin','responsabile') or auth.uid() = v_r.requested_by) then perform app.fail('forbidden'); end if;
    update public.advance_requests set status = 'cancelled', updated_at = now(), decision_note = coalesce(nullif(trim(coalesce(p->>'note', '')), ''), decision_note)
    where id = v_r.id returning * into v_r;
  else
    perform app.fail('invalid', 'passo');
  end if;
  return to_jsonb(v_r);
end $$;
revoke all on function public.advance_step(jsonb) from public, anon;
grant execute on function public.advance_step(jsonb) to authenticated;

create or replace function public.advance_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_r public.advance_requests;
begin
  if not app.has_role('super_admin') then perform app.fail('forbidden', 'solo il super amministratore'); end if;
  select * into v_r from public.advance_requests where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'richiesta'); end if;
  delete from public.advance_requests where id = v_r.id;
  return jsonb_build_object('outcome', 'deleted', 'had_delivery', v_r.delivery_movement_id is not null);
end $$;
revoke all on function public.advance_delete(uuid) from public, anon;
grant execute on function public.advance_delete(uuid) to authenticated;
