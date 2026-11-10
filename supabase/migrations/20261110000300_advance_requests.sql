-- Anticipi: la procedura in 5 passi (scelta 8 del 10/11, proposta dell'esperto di amministrazione ETS).
-- 1 Richiesta (chiunque registra) → 2 Autorizzazione (responsabile o amministratore secondo l'importo, mai chi
-- riceve o chi ha chiesto) → 3 Consegna (giroconto cassa → anticipi, collegato) → 4 Rendiconto (le spese
-- registrate sul conto anticipi; si segna «in verifica») → 5 Chiusura (responsabile o amministratore, dopo la
-- restituzione del residuo o il rimborso dell'eccedenza). L'anticipo non è una spesa finché non è giustificato:
-- le spese restano i movimenti registrati sul conto anticipi della persona.

create table if not exists public.advance_requests (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete restrict,
  account_id       uuid not null references public.accounts(id),            -- conto anticipi della persona
  beneficiary_id   uuid references public.profiles(id),                     -- utente che riceve, se ha un account
  role_kind        text not null default 'volunteer' check (role_kind in ('volunteer','employee','contact','other')),
  amount           numeric(16,2) not null check (amount > 0),
  currency         char(3) not null check (currency in ('EUR','MGA')),
  amount_eur       numeric(16,2),                                           -- per le soglie di autorizzazione
  purpose          text not null check (length(trim(purpose)) between 3 and 500),
  project_id       uuid references public.projects(id) on delete set null,
  category_id      uuid references public.categories(id),
  use_date         date not null,
  report_by        date not null,                                           -- entro quando giustificare (15 gg, massimo 30)
  status           text not null default 'requested'
                   check (status in ('requested','authorized','rejected','delivered','reported','closed','cancelled')),
  requested_by     uuid not null references public.profiles(id),
  requested_at     timestamptz not null default now(),
  authorized_by    uuid references public.profiles(id),
  authorized_at    timestamptz,
  authorized_amount numeric(16,2) check (authorized_amount is null or authorized_amount > 0),
  board_ref        text check (board_ref is null or length(board_ref) <= 300), -- delibera del Consiglio oltre la soglia
  decision_note    text check (decision_note is null or length(decision_note) <= 500),
  delivery_movement_id uuid references public.movements(id) on delete set null,
  delivered_at     date,
  reported_at      timestamptz,
  closed_by        uuid references public.profiles(id),
  closed_at        timestamptz,
  close_note       text check (close_note is null or length(close_note) <= 500),
  updated_at       timestamptz not null default now(),
  check (report_by >= use_date and report_by <= use_date + 30)
);
create index if not exists advance_requests_org_status_idx on public.advance_requests(org_id, status);
create index if not exists advance_requests_account_idx on public.advance_requests(account_id);
create index if not exists advance_requests_requested_by_idx on public.advance_requests(requested_by);
create index if not exists advance_requests_beneficiary_idx on public.advance_requests(beneficiary_id) where beneficiary_id is not null;
create index if not exists advance_requests_authorized_by_idx on public.advance_requests(authorized_by) where authorized_by is not null;
create index if not exists advance_requests_closed_by_idx on public.advance_requests(closed_by) where closed_by is not null;
create index if not exists advance_requests_project_idx on public.advance_requests(project_id) where project_id is not null;
create index if not exists advance_requests_category_idx on public.advance_requests(category_id) where category_id is not null;
create index if not exists advance_requests_movement_idx on public.advance_requests(delivery_movement_id) where delivery_movement_id is not null;

alter table public.advance_requests enable row level security;
drop policy if exists advance_requests_select on public.advance_requests;
create policy advance_requests_select on public.advance_requests for select to authenticated
  using (org_id = (select app.me_org()) and ((select app.is_staff()) or requested_by = (select auth.uid()) or beneficiary_id = (select auth.uid())));
grant select on public.advance_requests to authenticated;
drop trigger if exists advance_requests_audit on public.advance_requests;
create trigger advance_requests_audit after insert or update or delete on public.advance_requests for each row execute function app.audit();

-- Soglie di autorizzazione in euro (impostazioni, chiave adv_limits: {"resp": n, "admin": n}); vuote = nessun limite.
create or replace function app.adv_limit(p_key text) returns numeric
language sql stable security definer set search_path = '' as $$
  select nullif(s.value->>p_key, '')::numeric from public.settings s where s.org_id = app.me_org() and s.key = 'adv_limits'
$$;
revoke execute on function app.adv_limit(text) from public, anon, authenticated;

-- Passo 1: richiesta.
create or replace function public.advance_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_acc public.accounts; v_r public.advance_requests; v_amt numeric := (p->>'amount')::numeric;
  v_use date := coalesce(nullif(p->>'use_date', '')::date, current_date); v_by date; v_rate numeric;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_acc from public.accounts where id = nullif(p->>'account_id', '')::uuid and org_id = v_org and kind = 'advance' and active;
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
  values (v_org, v_acc.id, nullif(p->>'beneficiary_id', '')::uuid, coalesce(nullif(p->>'role_kind', ''), 'volunteer'), v_amt, v_acc.currency,
          case when v_acc.currency = 'EUR' then v_amt when v_rate > 0 then round(v_amt / v_rate, 2) end,
          trim(p->>'purpose'), nullif(p->>'project_id', '')::uuid, nullif(p->>'category_id', '')::uuid, v_use, v_by, auth.uid())
  returning * into v_r;
  return to_jsonb(v_r);
end $$;

-- Passi 2–5: autorizza o respingi, consegna (con il giroconto già registrato), rendiconto, chiusura, annullamento.
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
    if auth.uid() = v_r.requested_by or auth.uid() = v_r.beneficiary_id then perform app.fail('four_eyes', 'chi autorizza non può essere chi chiede o chi riceve'); end if;
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
    if v_eur is not null and app.adv_limit('admin') is not null and v_eur > app.adv_limit('admin') and length(trim(coalesce(p->>'board_ref', ''))) < 3 then
      perform app.fail('board_needed', 'oltre la soglia serve la delibera del Consiglio');
    end if;
    update public.advance_requests set status = 'authorized', authorized_by = auth.uid(), authorized_at = now(), authorized_amount = v_amt,
      board_ref = nullif(trim(coalesce(p->>'board_ref', '')), ''), decision_note = nullif(trim(coalesce(p->>'note', '')), ''), updated_at = now()
    where id = v_r.id returning * into v_r;

  elsif v_step = 'deliver' then
    if v_r.status <> 'authorized' then perform app.fail('invalid_state', v_r.status); end if;
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
    if auth.uid() = v_r.beneficiary_id then perform app.fail('four_eyes', 'chi consegna non può essere chi riceve'); end if;
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
    if auth.uid() = v_r.beneficiary_id then perform app.fail('four_eyes', 'chi chiude non può essere chi ha ricevuto'); end if;
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

revoke all on function public.advance_request(jsonb), public.advance_step(jsonb) from public, anon;
grant execute on function public.advance_request(jsonb), public.advance_step(jsonb) to authenticated;
