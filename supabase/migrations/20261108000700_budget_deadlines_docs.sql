-- 0700 · Preventivo con versioni, scadenziario, documenti emessi
--
-- PREVENTIVO (come il Gestionale: righe per codice contabile e progetto, quantità × costo, EUR o MGA, entrate e uscite)
--  · un preventivo per anno, in versioni: la prima è l'originale, le successive sono revisioni;
--  · si modifica solo in bozza; «approvato» lo blocca (con estremi della delibera); una nuova revisione copia
--    l'ultima approvata, che resta in archivio come «superata»: la storia non si perde;
--  · il confronto con il consuntivo usa la versione approvata in vigore (o una scelta) e i movimenti registrati
--    e verificati dell'anno; le bozze di spesa (rimborsi da pagare, spese da completare) sono «impegnato».
-- SCADENZIARIO
--  · scadenze inserite a mano (pagamenti, incassi, adempimenti, rendicontazioni) con responsabile, priorità, stato;
--  · gli adempimenti ricorrenti per gli ETS sono regole nell'app: si salvano qui solo quando si segnano fatti
--    o si sposta la data (rule_key), così non si duplicano.
-- DOCUMENTI EMESSI
--  · ricevute, quietanze, notule di prestazione occasionale, note di rimborso spese, autorizzazioni di spesa,
--    note di debito (richieste di pagamento); numerazione TIPO-AAAA-NNN assegnata all'emissione, mai riusata;
--    un documento emesso non si modifica: si annulla con il motivo e il numero resta in elenco.
--  · le fatture NON si generano: per chi ha partita IVA vanno emesse elettroniche tramite SdI (da fare con il
--    commercialista o un software certificato); un'ODV senza partita IVA non emette fatture.

-- ---------------------------------------------------------------- preventivo
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete restrict,
  year         integer not null check (year between 2000 and 2100),
  version      integer not null check (version >= 1),
  status       text not null default 'draft' check (status in ('draft','approved','superseded')),
  title        text check (title is null or length(title) <= 120),
  approval_ref text check (approval_ref is null or length(approval_ref) <= 300),   -- es. delibera CdA del …
  notes        text check (notes is null or length(notes) <= 2000),
  based_on     uuid references public.budgets(id),
  approved_at  timestamptz,
  approved_by  uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, year, version),
  check ((status = 'draft') = (approved_at is null))
);
create unique index budgets_one_draft on public.budgets(org_id, year) where status = 'draft';
create unique index budgets_one_approved on public.budgets(org_id, year) where status = 'approved';
create index budgets_based_on_idx on public.budgets(based_on) where based_on is not null;
create index budgets_created_by_idx on public.budgets(created_by);
create index budgets_approved_by_idx on public.budgets(approved_by) where approved_by is not null;

create table public.budget_items (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references public.budgets(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete restrict,
  project_id  uuid references public.projects(id),          -- null = struttura / generale
  category_id uuid not null references public.categories(id),
  description text check (description is null or length(description) <= 300),
  qty         numeric(12,2) not null default 1 check (qty > 0),
  unit        text check (unit is null or length(unit) <= 30),
  unit_cost   numeric(16,2) not null check (unit_cost >= 0),
  currency    char(3) not null default 'EUR' check (currency in ('EUR','MGA')),
  fx_rate     numeric(12,4) check (fx_rate is null or fx_rate > 0),
  amount      numeric(16,2) generated always as (round(qty * unit_cost, 2)) stored,
  amount_eur  numeric(16,2) generated always as (
                case when currency = 'EUR' then round(qty * unit_cost, 2) else round(qty * unit_cost / fx_rate, 2) end) stored,
  notes       text check (notes is null or length(notes) <= 500),
  sort        integer not null default 0,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now(),
  check (currency = 'EUR' or fx_rate is not null)
);
create index budget_items_budget_idx on public.budget_items(budget_id);
create index budget_items_category_idx on public.budget_items(category_id);
create index budget_items_project_idx on public.budget_items(project_id) where project_id is not null;
create index budget_items_updated_by_idx on public.budget_items(updated_by) where updated_by is not null;

-- le righe si toccano solo finché il preventivo è in bozza
create or replace function app.budget_items_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_st text; v_b uuid := coalesce(new.budget_id, old.budget_id);
begin
  select status into v_st from public.budgets where id = v_b;
  if v_st is distinct from 'draft' then perform app.fail('immutable', 'preventivo approvato: crea una revisione'); end if;
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
create trigger budget_items_guard before insert or update or delete on public.budget_items
  for each row execute function app.budget_items_guard();

alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
create policy budgets_select on public.budgets for select to authenticated
  using (org_id = (select app.me_org()) and (select app.is_staff()));
create policy budget_items_select on public.budget_items for select to authenticated
  using (org_id = (select app.me_org()) and (select app.is_staff()));
grant select on public.budgets, public.budget_items to authenticated;
create trigger budgets_audit after insert or update or delete on public.budgets for each row execute function app.audit();
create trigger budget_items_audit after insert or update or delete on public.budget_items for each row execute function app.audit();

-- Bozza del preventivo di un anno: la crea vuota, copiando l'ultima versione approvata (revisione) o un altro anno.
-- p_from_year: copia le righe dell'ultima versione approvata di quell'anno (o, se manca, della sua bozza).
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
    insert into public.budget_items(budget_id, org_id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, notes, sort)
    select v_b.id, v_org, i.project_id, i.category_id, i.description, i.qty, i.unit, i.unit_cost, i.currency, i.fx_rate, i.notes, i.sort
    from public.budget_items i where i.budget_id = v_src;
    get diagnostics v_n = row_count;
  end if;
  return jsonb_build_object('id', v_b.id, 'version', v_b.version, 'outcome', 'created', 'copied', v_n);
end $$;

-- Salva una riga (nuova se p->>'id' manca). Solo in bozza (lo controlla il trigger).
create or replace function public.budget_item_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_i public.budget_items; v_b uuid := nullif(p->>'budget_id', '')::uuid; v_cur text;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if not exists (select 1 from public.budgets where id = v_b and org_id = v_org) then perform app.fail('not_found', 'preventivo'); end if;
  v_cur := coalesce(nullif(p->>'currency', ''), 'EUR');
  if v_cur = 'MGA' and coalesce(nullif(p->>'fx_rate', '')::numeric, 0) <= 0 then perform app.fail('invalid', 'tasso di cambio per gli ariary'); end if;
  if nullif(p->>'id', '') is null then
    insert into public.budget_items(budget_id, org_id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, notes, sort)
    values (v_b, v_org, nullif(p->>'project_id', '')::uuid, (p->>'category_id')::uuid, nullif(trim(coalesce(p->>'description', '')), ''),
            coalesce(nullif(p->>'qty', '')::numeric, 1), nullif(trim(coalesce(p->>'unit', '')), ''), (p->>'unit_cost')::numeric,
            v_cur, case when v_cur = 'MGA' then (p->>'fx_rate')::numeric end, nullif(trim(coalesce(p->>'notes', '')), ''),
            coalesce(nullif(p->>'sort', '')::int, 0))
    returning * into v_i;
  else
    update public.budget_items set project_id = nullif(p->>'project_id', '')::uuid, category_id = (p->>'category_id')::uuid,
      description = nullif(trim(coalesce(p->>'description', '')), ''), qty = coalesce(nullif(p->>'qty', '')::numeric, 1),
      unit = nullif(trim(coalesce(p->>'unit', '')), ''), unit_cost = (p->>'unit_cost')::numeric, currency = v_cur,
      fx_rate = case when v_cur = 'MGA' then (p->>'fx_rate')::numeric end, notes = nullif(trim(coalesce(p->>'notes', '')), '')
    where id = (p->>'id')::uuid and budget_id = v_b returning * into v_i;
    if not found then perform app.fail('not_found', 'riga'); end if;
  end if;
  return to_jsonb(v_i);
end $$;

create or replace function public.budget_item_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  delete from public.budget_items where id = p_id and org_id = app.me_org();
  if not found then perform app.fail('not_found', 'riga'); end if;
  return jsonb_build_object('outcome', 'deleted');
end $$;

-- Approva la bozza: diventa la versione in vigore; la precedente approvata resta come «superata».
create or replace function public.budget_approve(p_id uuid, p_ref text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.budgets;
begin
  if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'solo gli amministratori approvano'); end if;
  select * into v_b from public.budgets where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'preventivo'); end if;
  if v_b.status <> 'draft' then perform app.fail('invalid', 'solo una bozza si approva'); end if;
  if length(trim(coalesce(p_ref, ''))) < 3 then perform app.fail('invalid', 'indica la delibera o l''atto di approvazione'); end if;
  if not exists (select 1 from public.budget_items where budget_id = p_id) then perform app.fail('invalid', 'preventivo senza righe'); end if;
  update public.budgets set status = 'superseded', updated_at = now()
  where org_id = v_b.org_id and year = v_b.year and status = 'approved';
  update public.budgets set status = 'approved', approval_ref = trim(p_ref), approved_at = now(), approved_by = auth.uid(), updated_at = now()
  where id = p_id returning * into v_b;
  return to_jsonb(v_b);
end $$;

-- Elimina una bozza (mai una versione approvata o superata).
create or replace function public.budget_discard(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if not exists (select 1 from public.budgets where id = p_id and org_id = app.me_org() and status = 'draft') then
    perform app.fail('invalid', 'si elimina solo una bozza');
  end if;
  delete from public.budget_items where budget_id = p_id;
  delete from public.budgets where id = p_id;
  return jsonb_build_object('outcome', 'deleted');
end $$;

-- Versione approvata in vigore di un anno.
create or replace function app.current_budget(p_org uuid, p_year int) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.budgets where org_id = p_org and year = p_year and status = 'approved'
$$;
revoke execute on function app.current_budget(uuid, int) from public, anon, authenticated;

-- Preventivo e consuntivo per codice contabile e progetto.
-- p_budget: una versione precisa (anche bozza); se manca, l'approvata in vigore.
create or replace function public.budget_compare(p_year int, p_budget uuid default null)
returns table (direction text, group_id uuid, group_code text, category_id uuid, category_code text, cat_it text, cat_fr text,
               project_id uuid, project_name text, budget_eur numeric, actual_eur numeric, committed_eur numeric, movements int)
language sql stable security definer set search_path = '' as $$
  with b as (
    select coalesce(p_budget, app.current_budget(app.me_org(), p_year)) as id
  ),
  bud as (
    select i.category_id, i.project_id, sum(i.amount_eur) as eur
    from public.budget_items i join b on i.budget_id = b.id
    where i.org_id = app.me_org()
    group by i.category_id, i.project_id
  ),
  act as (
    select m.category_id, m.project_id,
           sum(m.amount_eur * m.sign) filter (where m.status in ('recorded','verified')) as eur,
           sum(m.amount_eur * m.sign) filter (where m.status = 'draft' and m.kind = 'expense') as com,
           count(*) filter (where m.status in ('recorded','verified'))::int as n
    from public.movements m
    where m.org_id = app.me_org() and m.kind in ('income','expense') and m.category_id is not null
      and extract(year from m.op_date) = p_year
    group by m.category_id, m.project_id
  ),
  k as (select category_id, project_id from bud union select category_id, project_id from act)
  select c.direction::text, g.id, g.code, c.id, c.code, c.name_it, c.name_fr, k.project_id, pr.name,
         coalesce(bud.eur, 0), coalesce(act.eur, 0), coalesce(act.com, 0), coalesce(act.n, 0)
  from k
  join public.categories c on c.id = k.category_id
  join public.category_groups g on g.id = c.group_id
  left join public.projects pr on pr.id = k.project_id
  left join bud on bud.category_id = k.category_id and bud.project_id is not distinct from k.project_id
  left join act on act.category_id = k.category_id and act.project_id is not distinct from k.project_id
  where app.is_staff()
  order by c.direction desc, g.sort, c.sort, c.code, pr.name nulls first
$$;

-- Il budget di progetto per anno (pagina progetto, analisi) viene ora dal preventivo approvato;
-- restano valide le righe dei finanziamenti (budget dell'accordo con il finanziatore).
create or replace function public.budget_vs_actual(p_project uuid default null, p_year int default null, p_grant uuid default null)
returns table (group_id uuid, group_code text, group_name_it text, group_name_fr text,
               budget_eur numeric, spent_eur numeric, movements int)
language sql stable security definer set search_path = '' as $$
  with spent as (
    select c.group_id, sum(m.amount_eur * m.sign) as s, count(*) as n
    from public.movements m join public.categories c on c.id = m.category_id
    where m.org_id = app.me_org() and m.status in ('recorded','verified') and m.kind = 'expense'
      and (p_grant is null or m.grant_id = p_grant)
      and (p_project is null or m.project_id = p_project)
      and (p_year is null or extract(year from m.op_date) = p_year)
    group by c.group_id
  ), bud as (
    select b.group_id, sum(b.amount_eur) as b from public.budget_lines b
    where b.org_id = app.me_org()
      and ((p_grant is not null and b.grant_id = p_grant)
        or (p_grant is null and b.project_id = p_project and b.year = p_year))
    group by b.group_id
    union all
    select c.group_id, sum(i.amount_eur) from public.budget_items i join public.categories c on c.id = i.category_id
    where p_grant is null and p_year is not null and i.budget_id = app.current_budget(app.me_org(), p_year)
      and c.direction = 'out' and (p_project is null or i.project_id = p_project)
    group by c.group_id
  ), budt as (select group_id, sum(b) as b from bud group by group_id)
  select g.id, g.code, g.name_it, g.name_fr, coalesce(budt.b, 0), coalesce(spent.s, 0), coalesce(spent.n, 0)::int
  from public.category_groups g
  left join budt on budt.group_id = g.id
  left join spent on spent.group_id = g.id
  where g.org_id = app.me_org() and g.direction = 'out'
    and app.has_role('super_admin','admin','responsabile','read_only')
  order by g.sort
$$;

-- ---------------------------------------------------------------- scadenziario
create table public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete restrict,
  rule_key    text,                         -- adempimento ricorrente dell'app (es. runts-2026): data spostata o fatto
  title       text not null check (length(trim(title)) between 2 and 200),
  category    text not null default 'altro' check (category in ('pay','inc','ets','fisc','int','prj','doc','altro')),
  due_date    date not null,
  amount      numeric(16,2) check (amount is null or amount >= 0),
  currency    char(3) check (currency is null or currency in ('EUR','MGA')),
  project_id  uuid references public.projects(id),
  grant_id    uuid references public.grants(id),
  movement_id uuid references public.movements(id),
  owner_id    uuid references public.profiles(id),
  priority    text not null default 'normal' check (priority in ('low','normal','high')),
  status      text not null default 'open' check (status in ('open','done','cancelled')),
  repeat      text not null default 'none' check (repeat in ('none','monthly','yearly')),
  notes       text check (notes is null or length(notes) <= 1000),
  done_at     timestamptz,
  done_by     uuid references public.profiles(id),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((status = 'done') = (done_at is not null))
);
create unique index deadlines_rule_uq on public.deadlines(org_id, rule_key) where rule_key is not null;
create index deadlines_due_idx on public.deadlines(org_id, due_date);
create index deadlines_project_idx on public.deadlines(project_id) where project_id is not null;
create index deadlines_grant_idx on public.deadlines(grant_id) where grant_id is not null;
create index deadlines_movement_idx on public.deadlines(movement_id) where movement_id is not null;
create index deadlines_owner_idx on public.deadlines(owner_id) where owner_id is not null;
create index deadlines_done_by_idx on public.deadlines(done_by) where done_by is not null;
create index deadlines_created_by_idx on public.deadlines(created_by);

alter table public.deadlines enable row level security;
-- lo staff vede tutto; un operatore vede le scadenze assegnate a lui o create da lui
create policy deadlines_select on public.deadlines for select to authenticated
  using (org_id = (select app.me_org()) and ((select app.is_staff()) or owner_id = (select auth.uid()) or created_by = (select auth.uid())));
grant select on public.deadlines to authenticated;
create trigger deadlines_audit after insert or update or delete on public.deadlines for each row execute function app.audit();

-- Crea o modifica una scadenza. Per un adempimento dell'app passa rule_key (crea la riga alla prima modifica).
create or replace function public.deadline_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_d public.deadlines; v_id uuid := nullif(p->>'id', '')::uuid; v_rk text := nullif(p->>'rule_key', '');
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  if v_id is null and v_rk is not null then
    select id into v_id from public.deadlines where org_id = v_org and rule_key = v_rk;
  end if;
  if v_id is not null then
    select * into v_d from public.deadlines where id = v_id and org_id = v_org for update;
    if not found then perform app.fail('not_found', 'scadenza'); end if;
    if not app.is_staff() and v_d.created_by <> auth.uid() and v_d.owner_id is distinct from auth.uid() then perform app.fail('forbidden'); end if;
    update public.deadlines set
      title = coalesce(nullif(trim(p->>'title'), ''), title),
      category = coalesce(nullif(p->>'category', ''), category),
      due_date = coalesce(nullif(p->>'due_date', '')::date, due_date),
      amount = case when p ? 'amount' then nullif(p->>'amount', '')::numeric else amount end,
      currency = case when p ? 'currency' then nullif(p->>'currency', '') else currency end,
      project_id = case when p ? 'project_id' then nullif(p->>'project_id', '')::uuid else project_id end,
      owner_id = case when p ? 'owner_id' then nullif(p->>'owner_id', '')::uuid else owner_id end,
      priority = coalesce(nullif(p->>'priority', ''), priority),
      repeat = coalesce(nullif(p->>'repeat', ''), repeat),
      notes = case when p ? 'notes' then nullif(trim(p->>'notes'), '') else notes end,
      updated_at = now()
    where id = v_id returning * into v_d;
  else
    insert into public.deadlines(org_id, rule_key, title, category, due_date, amount, currency, project_id, grant_id, movement_id,
                                 owner_id, priority, repeat, notes, created_by)
    values (v_org, v_rk, trim(p->>'title'), coalesce(nullif(p->>'category', ''), 'altro'), (p->>'due_date')::date,
            nullif(p->>'amount', '')::numeric, nullif(p->>'currency', ''), nullif(p->>'project_id', '')::uuid,
            nullif(p->>'grant_id', '')::uuid, nullif(p->>'movement_id', '')::uuid, nullif(p->>'owner_id', '')::uuid,
            coalesce(nullif(p->>'priority', ''), 'normal'), coalesce(nullif(p->>'repeat', ''), 'none'),
            nullif(trim(coalesce(p->>'notes', '')), ''), auth.uid())
    returning * into v_d;
  end if;
  if v_d.currency is null and v_d.amount is not null then update public.deadlines set currency = 'EUR' where id = v_d.id returning * into v_d; end if;
  return to_jsonb(v_d);
end $$;

-- Segna fatta (o riapre). Se ricorrente, crea la successiva.
create or replace function public.deadline_set_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.deadlines; v_next date;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  if p_status not in ('open','done','cancelled') then perform app.fail('invalid', 'stato'); end if;
  select * into v_d from public.deadlines where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'scadenza'); end if;
  if not app.is_staff() and v_d.created_by <> auth.uid() and v_d.owner_id is distinct from auth.uid() then perform app.fail('forbidden'); end if;
  update public.deadlines set status = p_status,
    done_at = case when p_status = 'done' then now() end, done_by = case when p_status = 'done' then auth.uid() end, updated_at = now()
  where id = p_id returning * into v_d;
  if p_status = 'done' and v_d.repeat <> 'none' and v_d.rule_key is null then
    v_next := case v_d.repeat when 'monthly' then (v_d.due_date + interval '1 month')::date else (v_d.due_date + interval '1 year')::date end;
    if not exists (select 1 from public.deadlines where org_id = v_d.org_id and title = v_d.title and due_date = v_next and status = 'open') then
      insert into public.deadlines(org_id, title, category, due_date, amount, currency, project_id, owner_id, priority, repeat, notes, created_by)
      values (v_d.org_id, v_d.title, v_d.category, v_next, v_d.amount, v_d.currency, v_d.project_id, v_d.owner_id, v_d.priority, v_d.repeat, v_d.notes, auth.uid());
    end if;
  end if;
  return to_jsonb(v_d);
end $$;

-- Per le soglie dell'esercizio (rendiconto per cassa, compensi, bilancio sociale): entrate registrate dell'anno.
create or replace function public.income_of_year(p_year int) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(m.amount_eur * m.sign), 0) from public.movements m
  where m.org_id = app.me_org() and m.kind = 'income' and m.status in ('recorded','verified')
    and extract(year from m.op_date) = p_year and app.is_staff()
$$;

-- ---------------------------------------------------------------- documenti emessi
create table public.issued_docs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete restrict,
  type          text not null check (type in ('RIC','QUI','NOT','NRS','ASP','NDD')),
  number        text,                                   -- assegnato all'emissione
  status        text not null default 'draft' check (status in ('draft','issued','cancelled')),
  lang          text not null default 'it' check (lang in ('it','fr','both')),
  doc_date      date not null default current_date,
  movement_id   uuid references public.movements(id),
  project_id    uuid references public.projects(id),
  counterparty_id uuid references public.counterparties(id),
  party_name    text check (party_name is null or length(party_name) <= 200),
  party_tax_id  text check (party_tax_id is null or length(party_tax_id) <= 40),
  party_address text check (party_address is null or length(party_address) <= 300),
  amount        numeric(16,2) check (amount is null or amount >= 0),
  currency      char(3) not null default 'EUR' check (currency in ('EUR','MGA')),
  data          jsonb not null default '{}'::jsonb,     -- campi propri del tipo (righe, causale, ritenuta, …)
  signer_name   text,
  signer_role   text,
  document_id   uuid references public.documents(id) on delete restrict,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300),
  issued_at     timestamptz,
  issued_by     uuid references public.profiles(id),
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, number),
  check ((status = 'draft') = (number is null)),
  check (status <> 'cancelled' or cancel_reason is not null)
);
create index issued_docs_list_idx on public.issued_docs(org_id, doc_date desc);
create index issued_docs_movement_idx on public.issued_docs(movement_id) where movement_id is not null;
create index issued_docs_project_idx on public.issued_docs(project_id) where project_id is not null;
create index issued_docs_cp_idx on public.issued_docs(counterparty_id) where counterparty_id is not null;
create index issued_docs_doc_idx on public.issued_docs(document_id) where document_id is not null;
create index issued_docs_created_by_idx on public.issued_docs(created_by);
create index issued_docs_issued_by_idx on public.issued_docs(issued_by) where issued_by is not null;

alter table public.issued_docs enable row level security;
-- dati di persone (codice fiscale, indirizzo): staff e chi ha creato il documento
create policy issued_docs_select on public.issued_docs for select to authenticated
  using (org_id = (select app.me_org()) and ((select app.is_staff()) or created_by = (select auth.uid())));
grant select on public.issued_docs to authenticated;
create trigger issued_docs_audit after insert or update or delete on public.issued_docs for each row execute function app.audit();

-- Salva una bozza (nuova o esistente). Un documento emesso non si modifica.
create or replace function public.issued_doc_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_d public.issued_docs; v_id uuid := nullif(p->>'id', '')::uuid; v_m public.movements;
        v_signer jsonb := app.setting(app.me_org(), 'doc_signer', '{}'::jsonb);
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  if coalesce(p->>'type', '') not in ('RIC','QUI','NOT','NRS','ASP','NDD') then perform app.fail('invalid', 'tipo di documento'); end if;
  if nullif(p->>'movement_id', '') is not null then
    select * into v_m from public.movements where id = (p->>'movement_id')::uuid and org_id = v_org;
    if not found or not app.can_see_movement(v_m) then perform app.fail('not_found', 'movimento'); end if;
  end if;
  if v_id is not null then
    select * into v_d from public.issued_docs where id = v_id and org_id = v_org for update;
    if not found then perform app.fail('not_found', 'documento'); end if;
    if v_d.status <> 'draft' then perform app.fail('immutable', 'documento già emesso: si può solo annullare'); end if;
    if not app.is_staff() and v_d.created_by <> auth.uid() then perform app.fail('forbidden'); end if;
    update public.issued_docs set lang = coalesce(nullif(p->>'lang', ''), lang), doc_date = coalesce(nullif(p->>'doc_date', '')::date, doc_date),
      movement_id = nullif(p->>'movement_id', '')::uuid, project_id = nullif(p->>'project_id', '')::uuid,
      counterparty_id = nullif(p->>'counterparty_id', '')::uuid,
      party_name = nullif(trim(coalesce(p->>'party_name', '')), ''), party_tax_id = nullif(trim(coalesce(p->>'party_tax_id', '')), ''),
      party_address = nullif(trim(coalesce(p->>'party_address', '')), ''), amount = nullif(p->>'amount', '')::numeric,
      currency = coalesce(nullif(p->>'currency', ''), currency), data = coalesce(p->'data', '{}'::jsonb),
      signer_name = nullif(v_signer->>'name', ''), signer_role = nullif(v_signer->>'role', ''), updated_at = now()
    where id = v_id returning * into v_d;
  else
    insert into public.issued_docs(org_id, type, lang, doc_date, movement_id, project_id, counterparty_id, party_name, party_tax_id,
                                   party_address, amount, currency, data, signer_name, signer_role, created_by)
    values (v_org, p->>'type', coalesce(nullif(p->>'lang', ''), 'it'), coalesce(nullif(p->>'doc_date', '')::date, current_date),
            nullif(p->>'movement_id', '')::uuid, nullif(p->>'project_id', '')::uuid, nullif(p->>'counterparty_id', '')::uuid,
            nullif(trim(coalesce(p->>'party_name', '')), ''), nullif(trim(coalesce(p->>'party_tax_id', '')), ''),
            nullif(trim(coalesce(p->>'party_address', '')), ''), nullif(p->>'amount', '')::numeric,
            coalesce(nullif(p->>'currency', ''), 'EUR'), coalesce(p->'data', '{}'::jsonb),
            nullif(v_signer->>'name', ''), nullif(v_signer->>'role', ''), auth.uid())
    returning * into v_d;
  end if;
  return to_jsonb(v_d);
end $$;

-- Emette: assegna il numero (TIPO-AAAA-NNN, anno della data del documento) e blocca il contenuto.
create or replace function public.issued_doc_issue(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.issued_docs; v_n int; v_y int;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_d from public.issued_docs where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'documento'); end if;
  if not app.is_staff() and v_d.created_by <> auth.uid() then perform app.fail('forbidden'); end if;
  if v_d.status <> 'draft' then return to_jsonb(v_d); end if;
  if v_d.party_name is null then perform app.fail('invalid', 'manca la controparte'); end if;
  if coalesce(v_d.amount, 0) <= 0 then perform app.fail('invalid', 'manca l''importo'); end if;
  v_y := extract(year from v_d.doc_date)::int;
  insert into app.doc_counters(org_id, kind, year, last) values (v_d.org_id, v_d.type, v_y, 1)
  on conflict (org_id, kind, year) do update set last = app.doc_counters.last + 1 returning last into v_n;
  update public.issued_docs set status = 'issued', number = v_d.type || '-' || v_y || '-' || lpad(v_n::text, 3, '0'),
    issued_at = now(), issued_by = auth.uid(), updated_at = now()
  where id = p_id returning * into v_d;
  return to_jsonb(v_d);
end $$;

-- Collega il PDF del documento emesso (e al movimento, se c'è).
create or replace function public.issued_doc_attach(p_id uuid, p_document_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.issued_docs; v_m public.movements;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_d from public.issued_docs where id = p_id and org_id = app.me_org() for update;
  if not found or v_d.status <> 'issued' then perform app.fail('invalid', 'documento non emesso'); end if;
  if not exists (select 1 from public.documents d where d.id = p_document_id and d.org_id = v_d.org_id) then perform app.fail('not_found', 'file'); end if;
  if v_d.document_id is not null and v_d.document_id <> p_document_id then perform app.fail('invalid', 'PDF già allegato'); end if;
  update public.issued_docs set document_id = p_document_id, updated_at = now() where id = p_id returning * into v_d;
  if v_d.movement_id is not null then
    select * into v_m from public.movements where id = v_d.movement_id;
    if app.can_see_movement(v_m) then
      insert into public.movement_documents(movement_id, document_id, org_id, created_by)
      values (v_d.movement_id, p_document_id, v_d.org_id, auth.uid()) on conflict do nothing;
    end if;
  end if;
  return to_jsonb(v_d);
end $$;

-- Annulla: il numero resta in elenco con il motivo. Una bozza si elimina.
create or replace function public.issued_doc_cancel(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.issued_docs;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_d from public.issued_docs where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'documento'); end if;
  if not app.is_staff() and v_d.created_by <> auth.uid() then perform app.fail('forbidden'); end if;
  if v_d.status = 'draft' then
    delete from public.issued_docs where id = p_id;
    return jsonb_build_object('outcome', 'deleted');
  end if;
  if v_d.status = 'cancelled' then return to_jsonb(v_d); end if;
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'annulla un responsabile'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo dell''annullamento'); end if;
  update public.issued_docs set status = 'cancelled', cancel_reason = trim(p_reason), updated_at = now() where id = p_id returning * into v_d;
  return to_jsonb(v_d);
end $$;

revoke all on function public.budget_draft(int, int, text), public.budget_item_save(jsonb), public.budget_item_delete(uuid),
  public.budget_approve(uuid, text), public.budget_discard(uuid), public.budget_compare(int, uuid),
  public.deadline_save(jsonb), public.deadline_set_status(uuid, text), public.income_of_year(int),
  public.issued_doc_save(jsonb), public.issued_doc_issue(uuid), public.issued_doc_attach(uuid, uuid), public.issued_doc_cancel(uuid, text)
  from public, anon;
grant execute on function public.budget_draft(int, int, text), public.budget_item_save(jsonb), public.budget_item_delete(uuid),
  public.budget_approve(uuid, text), public.budget_discard(uuid), public.budget_compare(int, uuid),
  public.deadline_save(jsonb), public.deadline_set_status(uuid, text), public.income_of_year(int),
  public.issued_doc_save(jsonb), public.issued_doc_issue(uuid), public.issued_doc_attach(uuid, uuid), public.issued_doc_cancel(uuid, text)
  to authenticated;
