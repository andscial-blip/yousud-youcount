-- Anticipi: la persona che riceve si sceglie tra gli utenti o si scrive (anche se non è utente dell'app).
-- Il conto anticipi della persona (uno per valuta) si trova o si crea da solo; prima serviva crearlo a parte.

create or replace function app.advance_account_for(p_name text, p_currency text, p_location text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_h text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); v_id uuid; v_code text; v_sort int;
begin
  if length(v_h) not between 2 and 120 then perform app.fail('invalid', 'nome della persona'); end if;
  if p_currency not in ('EUR','MGA') then perform app.fail('invalid', 'valuta'); end if;
  select id into v_id from public.accounts
   where org_id = v_org and kind = 'advance' and lower(holder) = lower(v_h) and currency = p_currency
   order by active desc limit 1;
  if v_id is not null then
    update public.accounts set active = true where id = v_id and not active;
    return v_id;
  end if;
  v_code := left('Anticipi ' || v_h || ' ' || p_currency, 60);
  if exists (select 1 from public.accounts where org_id = v_org and code = v_code) then
    v_code := left('Anticipi ' || v_h, 50) || ' ' || p_currency || ' ' || substr(md5(random()::text), 1, 4);
  end if;
  select coalesce(max(sort), 0) + 1 into v_sort from public.accounts where org_id = v_org;
  insert into public.accounts(org_id, code, name_it, name_fr, currency, location, kind, holder, sort)
  values (v_org, v_code, 'Anticipi – ' || v_h, 'Avances – ' || v_h, p_currency,
          case when p_location in ('IT','MG') then p_location else 'MG' end, 'advance', v_h, v_sort)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function app.advance_account_for(text, text, text) from public, anon, authenticated;

-- Conto anticipi per una persona (utente o no): per chi registra consegne e restituzioni senza richiesta.
create or replace function public.advance_account(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_name text := p->>'holder';
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if nullif(p->>'profile_id', '') is not null then
    select full_name into v_name from public.profiles where id = (p->>'profile_id')::uuid and org_id = app.me_org();
    if v_name is null then perform app.fail('not_found', 'utente'); end if;
  end if;
  return app.advance_account_for(v_name, coalesce(nullif(p->>'currency', ''), 'MGA'), p->>'location');
end $$;
revoke all on function public.advance_account(jsonb) from public, anon;
grant execute on function public.advance_account(jsonb) to authenticated;

-- Richiesta: oltre a un conto anticipi esistente (account_id) accetta un utente (beneficiary_id) o un nome (holder) con la valuta.
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
  return to_jsonb(v_r);
end $$;
revoke all on function public.advance_request(jsonb) from public, anon;
grant execute on function public.advance_request(jsonb) to authenticated;
