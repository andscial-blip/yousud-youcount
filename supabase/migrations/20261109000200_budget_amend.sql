-- Righe del preventivo approvato: modifica ed eliminazione puntuali, con motivo e traccia.
-- La bozza si modifica liberamente come prima. Sulla versione in vigore (approvata) una riga si corregge o si toglie
-- senza aprire una revisione: lo fa un amministratore indicando il motivo (o un responsabile, se la versione è DEMO).
-- Ogni modifica resta in budget_amendments (riga prima e dopo, motivo, chi e quando) oltre che nel registro modifiche.

create table public.budget_amendments (
  id        bigint generated always as identity primary key,
  org_id    uuid not null references public.organizations(id) on delete restrict,
  budget_id uuid not null,
  item_id   uuid not null,
  op        text not null check (op in ('update', 'delete')),
  reason    text check (reason is null or length(reason) <= 500),
  old_row   jsonb not null,
  new_row   jsonb,
  actor     uuid,
  at        timestamptz not null default now()
);
create index budget_amendments_budget_idx on public.budget_amendments(budget_id, at desc);
alter table public.budget_amendments enable row level security;
create policy budget_amendments_select on public.budget_amendments for select to authenticated
  using (org_id = (select app.me_org()) and (select app.is_staff()));
grant select on public.budget_amendments to authenticated;
create trigger budget_amendments_append_only before update on public.budget_amendments
  for each row execute function app.append_only();

-- flag interno di transazione: modifica autorizzata di una riga di versione approvata
create or replace function app.amend_mode() returns boolean language sql stable as $$
  select coalesce(current_setting('app.amend', true), '') = 'on'
$$;
revoke execute on function app.amend_mode() from public, anon, authenticated;

create or replace function app.budget_items_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_st text; v_b uuid := coalesce(new.budget_id, old.budget_id);
begin
  if tg_op = 'DELETE' and (app.bypass() or app.amend_mode()) then return old; end if;
  select status into v_st from public.budgets where id = v_b;
  -- eccezioni interne: caricamento dei dati dimostrativi (inserimento) e modifica autorizzata di una riga approvata
  if v_st is distinct from 'draft' and not (tg_op = 'INSERT' and app.bypass()) and not (tg_op = 'UPDATE' and app.amend_mode()) then
    perform app.fail('immutable', 'preventivo approvato: crea una revisione');
  end if;
  if tg_op <> 'DELETE' then
    new.org_id := (select org_id from public.budgets where id = new.budget_id);
    if not exists (select 1 from public.categories c where c.id = new.category_id and c.org_id = new.org_id) then
      perform app.fail('invalid', 'codice contabile');
    end if;
    if new.project_id is not null and not exists (select 1 from public.projects p where p.id = new.project_id and p.org_id = new.org_id) then
      perform app.fail('invalid', 'progetto');
    end if;
    new.updated_by := auth.uid(); new.updated_at := now();
    return new;
  end if;
  return old;
end $$;
revoke execute on function app.budget_items_guard() from public, anon, authenticated;

-- controlli comuni: la riga, la sua versione e chi può toccarla
create or replace function app.budget_amend_check(p_item uuid, p_reason text) returns public.budgets
language plpgsql security definer set search_path = '' as $$
declare v_b public.budgets;
begin
  select b.* into v_b from public.budget_items i join public.budgets b on b.id = i.budget_id
   where i.id = p_item and i.org_id = app.me_org() for update of b;
  if not found then perform app.fail('not_found', 'riga'); end if;
  if v_b.status = 'superseded' then perform app.fail('immutable', 'versione superata: si modifica solo la versione in vigore o la bozza'); end if;
  if v_b.status = 'approved' then
    if coalesce(v_b.demo, false) then
      if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
    else
      if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'solo un amministratore modifica il preventivo approvato'); end if;
      if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo della modifica (almeno 5 caratteri)'); end if;
    end if;
  elsif not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile');
  end if;
  return v_b;
end $$;
revoke execute on function app.budget_amend_check(uuid, text) from public, anon, authenticated;

-- Modifica di una riga (bozza o versione in vigore)
create or replace function public.budget_item_amend(p jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.budgets; v_old public.budget_items; v_new jsonb; v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if v_id is null then perform app.fail('invalid', 'riga'); end if;
  v_b := app.budget_amend_check(v_id, p_reason);
  select * into v_old from public.budget_items where id = v_id;
  if v_b.status = 'approved' then perform set_config('app.amend', 'on', true); end if;
  v_new := public.budget_item_save(p || jsonb_build_object('budget_id', v_b.id));
  perform set_config('app.amend', '', true);
  if v_b.status = 'approved' then
    insert into public.budget_amendments(org_id, budget_id, item_id, op, reason, old_row, new_row, actor)
    values (v_b.org_id, v_b.id, v_id, 'update', nullif(trim(coalesce(p_reason, '')), ''), to_jsonb(v_old), v_new, auth.uid());
  end if;
  return v_new;
end $$;

-- Eliminazione di una riga (bozza o versione in vigore). Una versione approvata non resta senza righe.
create or replace function public.budget_item_remove(p_id uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.budgets; v_old public.budget_items;
begin
  v_b := app.budget_amend_check(p_id, p_reason);
  select * into v_old from public.budget_items where id = p_id;
  if v_b.status = 'approved' and (select count(*) from public.budget_items where budget_id = v_b.id) <= 1 then
    perform app.fail('invalid', 'è l''ultima riga: per togliere tutto elimina la versione');
  end if;
  if v_b.status = 'approved' then perform set_config('app.amend', 'on', true); end if;
  delete from public.budget_items where id = p_id;
  perform set_config('app.amend', '', true);
  if v_b.status = 'approved' then
    insert into public.budget_amendments(org_id, budget_id, item_id, op, reason, old_row, new_row, actor)
    values (v_b.org_id, v_b.id, p_id, 'delete', nullif(trim(coalesce(p_reason, '')), ''), to_jsonb(v_old), null, auth.uid());
  end if;
  return jsonb_build_object('outcome', 'deleted');
end $$;

revoke execute on function public.budget_item_amend(jsonb, text), public.budget_item_remove(uuid, text) from public, anon;
grant execute on function public.budget_item_amend(jsonb, text), public.budget_item_remove(uuid, text) to authenticated;
