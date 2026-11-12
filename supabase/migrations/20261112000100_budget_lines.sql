-- Righe del preventivo (richiesta del 12/11): ogni riga ha un numero identificativo che non cambia più e, se serve,
-- la controparte (donatore per le entrate, fornitore per le uscite). Alla versione in vigore si può aggiungere una riga
-- senza aprire una revisione, con le stesse regole di modifica ed eliminazione: amministratore e motivo (DEMO: responsabile),
-- e la traccia resta in budget_amendments.

alter table public.budget_items
  add column line_no integer,
  add column counterparty_id uuid references public.counterparties(id);
create index budget_items_counterparty_idx on public.budget_items(counterparty_id) where counterparty_id is not null;

-- numerazione delle righe esistenti: per versione, uscite prima delle entrate, poi per codice.
-- I trigger restano fermi solo per questo passaggio: non è una modifica del preventivo e non deve cambiare «aggiornato da/il» né riempire il registro.
alter table public.budget_items disable trigger budget_items_guard;
alter table public.budget_items disable trigger budget_items_audit;
with n as (
  select i.id, row_number() over (partition by i.budget_id order by (c.direction = 'in'), c.code, i.sort, i.updated_at, i.id) as rn
  from public.budget_items i join public.categories c on c.id = i.category_id)
update public.budget_items i set line_no = n.rn from n where n.id = i.id;
alter table public.budget_items enable trigger budget_items_guard;
alter table public.budget_items enable trigger budget_items_audit;
alter table public.budget_items alter column line_no set not null;
create unique index budget_items_line_idx on public.budget_items(budget_id, line_no);

-- traccia delle modifiche alla versione in vigore: ora anche le righe aggiunte
alter table public.budget_amendments drop constraint budget_amendments_op_check;
alter table public.budget_amendments add constraint budget_amendments_op_check check (op in ('insert', 'update', 'delete'));
alter table public.budget_amendments alter column old_row drop not null;

create or replace function app.budget_items_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_st text; v_b uuid := coalesce(new.budget_id, old.budget_id);
begin
  if tg_op = 'DELETE' and (app.bypass() or app.amend_mode()) then return old; end if;
  select status into v_st from public.budgets where id = v_b;
  -- eccezioni interne: caricamento dei dati dimostrativi (inserimento) e modifica autorizzata della versione approvata (inserimento o modifica)
  if v_st is distinct from 'draft' and not (tg_op = 'INSERT' and (app.bypass() or app.amend_mode())) and not (tg_op = 'UPDATE' and app.amend_mode()) then
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
    if new.counterparty_id is not null and not exists (select 1 from public.counterparties k where k.id = new.counterparty_id and k.org_id = new.org_id) then
      perform app.fail('invalid', 'controparte');
    end if;
    -- numero della riga: il successivo nella versione; una volta assegnato non cambia
    if tg_op = 'INSERT' then
      if new.line_no is null then
        new.line_no := coalesce((select max(i.line_no) from public.budget_items i where i.budget_id = new.budget_id), 0) + 1;
      end if;
    else
      new.line_no := old.line_no;
    end if;
    new.updated_by := auth.uid(); new.updated_at := now();
    return new;
  end if;
  return old;
end $$;
revoke execute on function app.budget_items_guard() from public, anon, authenticated;

-- Nuova bozza: la revisione copia le righe con il loro numero e la loro controparte.
create or replace function public.budget_draft(p_year int, p_from_year int default null, p_title text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_b public.budgets; v_src uuid; v_ver int; v_n int := 0;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if p_year not between 2000 and 2100 then perform app.fail('invalid', 'anno'); end if;
  select * into v_b from public.budgets where org_id = v_org and year = p_year and status = 'draft';
  if found then return jsonb_build_object('id', v_b.id, 'version', v_b.version, 'outcome', 'exists'); end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.budgets where org_id = v_org and year = p_year;
  if p_from_year is null then
    select id into v_src from public.budgets where org_id = v_org and year = p_year and status = 'approved';
  else
    select id into v_src from public.budgets where org_id = v_org and year = p_from_year
      order by (status = 'approved') desc, (status = 'draft') desc, version desc limit 1;
    if v_src is null then perform app.fail('not_found', format('nessun preventivo %s da copiare', p_from_year)); end if;
  end if;
  insert into public.budgets(org_id, year, version, title, based_on, created_by)
  values (v_org, p_year, v_ver, nullif(trim(coalesce(p_title, '')), ''), v_src, auth.uid())
  returning * into v_b;
  if v_src is not null then
    insert into public.budget_items(budget_id, org_id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, notes, sort, line_no, counterparty_id)
    select v_b.id, v_org, i.project_id, i.category_id, i.description, i.qty, i.unit, i.unit_cost, i.currency, i.fx_rate, i.notes, i.sort, i.line_no, i.counterparty_id
    from public.budget_items i where i.budget_id = v_src;
    get diagnostics v_n = row_count;
  end if;
  return jsonb_build_object('id', v_b.id, 'version', v_b.version, 'outcome', 'created', 'copied', v_n);
end $$;

-- Salva una riga (nuova se p->>'id' manca). Solo in bozza, salvo modifica autorizzata (lo controlla il trigger).
create or replace function public.budget_item_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_i public.budget_items; v_b uuid := nullif(p->>'budget_id', '')::uuid; v_cur text;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if not exists (select 1 from public.budgets where id = v_b and org_id = v_org) then perform app.fail('not_found', 'preventivo'); end if;
  v_cur := coalesce(nullif(p->>'currency', ''), 'EUR');
  if v_cur = 'MGA' and coalesce(nullif(p->>'fx_rate', '')::numeric, 0) <= 0 then perform app.fail('invalid', 'tasso di cambio per gli ariary'); end if;
  if nullif(p->>'id', '') is null then
    insert into public.budget_items(budget_id, org_id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, notes, sort, counterparty_id)
    values (v_b, v_org, nullif(p->>'project_id', '')::uuid, (p->>'category_id')::uuid, nullif(trim(coalesce(p->>'description', '')), ''),
            coalesce(nullif(p->>'qty', '')::numeric, 1), nullif(trim(coalesce(p->>'unit', '')), ''), (p->>'unit_cost')::numeric,
            v_cur, case when v_cur = 'MGA' then (p->>'fx_rate')::numeric end, nullif(trim(coalesce(p->>'notes', '')), ''),
            coalesce(nullif(p->>'sort', '')::int, 0), nullif(p->>'counterparty_id', '')::uuid)
    returning * into v_i;
  else
    update public.budget_items set project_id = nullif(p->>'project_id', '')::uuid, category_id = (p->>'category_id')::uuid,
      description = nullif(trim(coalesce(p->>'description', '')), ''), qty = coalesce(nullif(p->>'qty', '')::numeric, 1),
      unit = nullif(trim(coalesce(p->>'unit', '')), ''), unit_cost = (p->>'unit_cost')::numeric, currency = v_cur,
      fx_rate = case when v_cur = 'MGA' then (p->>'fx_rate')::numeric end, notes = nullif(trim(coalesce(p->>'notes', '')), ''),
      counterparty_id = nullif(p->>'counterparty_id', '')::uuid
    where id = (p->>'id')::uuid and budget_id = v_b returning * into v_i;
    if not found then perform app.fail('not_found', 'riga'); end if;
  end if;
  return to_jsonb(v_i);
end $$;

-- Aggiunge una riga: liberamente alla bozza; alla versione in vigore con le regole delle modifiche puntuali
-- (amministratore e motivo di almeno 5 caratteri; versione DEMO: basta un responsabile). Mai a una versione superata.
create or replace function public.budget_item_add(p jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.budgets; v_new jsonb;
begin
  select * into v_b from public.budgets where id = nullif(p->>'budget_id', '')::uuid and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'preventivo'); end if;
  if v_b.status = 'superseded' then perform app.fail('immutable', 'versione superata: si modifica solo la versione in vigore o la bozza'); end if;
  if v_b.status = 'approved' then
    if coalesce(v_b.demo, false) then
      if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
    else
      if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'solo un amministratore modifica il preventivo approvato'); end if;
      if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo della modifica (almeno 5 caratteri)'); end if;
    end if;
    perform set_config('app.amend', 'on', true);
  end if;
  v_new := public.budget_item_save(p - 'id');
  perform set_config('app.amend', '', true);
  if v_b.status = 'approved' then
    insert into public.budget_amendments(org_id, budget_id, item_id, op, reason, old_row, new_row, actor)
    values (v_b.org_id, v_b.id, (v_new->>'id')::uuid, 'insert', nullif(trim(coalesce(p_reason, '')), ''), null, v_new, auth.uid());
  end if;
  return v_new;
end $$;
revoke execute on function public.budget_item_add(jsonb, text) from public, anon;
grant execute on function public.budget_item_add(jsonb, text) to authenticated;
