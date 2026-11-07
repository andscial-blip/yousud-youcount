-- 0600 · Finanziamenti, budget, conta di cassa, soci
-- Classificazione per finanziatore distinta da quella contabile (codici) e da quella per progetto.

-- soci come controparti (quote associative, codice E104)
alter table public.counterparties drop constraint counterparties_kind_check;
alter table public.counterparties add constraint counterparties_kind_check
  check (kind in ('supplier','donor','beneficiary','staff','member','other'));

-- ---------------------------------------------------------------- budget: per progetto e anno, oppure per finanziamento,
-- su un gruppo di codici di uscita (01 Risorse umane, 02 Viaggi…). Importi in EUR.
create table public.budget_lines (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  project_id uuid references public.projects(id),
  grant_id   uuid references public.grants(id),
  year       integer check (year is null or year between 2000 and 2100),
  group_id   uuid not null references public.category_groups(id),
  amount_eur numeric(16,2) not null check (amount_eur >= 0),
  notes      text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check ((project_id is not null and year is not null and grant_id is null) or (grant_id is not null and project_id is null))
);
create unique index budget_lines_project_uq on public.budget_lines(project_id, year, group_id) where project_id is not null;
create unique index budget_lines_grant_uq on public.budget_lines(grant_id, group_id) where grant_id is not null;

-- ---------------------------------------------------------------- conta di cassa: contanti contati contro saldo dell'app
create table public.cash_counts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete restrict,
  account_id     uuid not null references public.accounts(id),
  count_date     date not null,
  counted        numeric(16,2) not null check (counted >= 0),
  system_balance numeric(16,2) not null,
  difference     numeric(16,2) generated always as (counted - system_balance) stored,
  denominations  jsonb,                  -- es. {"20000": 12, "10000": 5}
  notes          text check (notes is null or length(notes) <= 1000),
  counted_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index cash_counts_account_idx on public.cash_counts(account_id, count_date desc);

-- ---------------------------------------------------------------- regole di accesso
alter table public.grants enable row level security;
alter table public.budget_lines enable row level security;
alter table public.cash_counts enable row level security;

create policy grants_select on public.grants for select to authenticated using (org_id = app.me_org());
create policy grants_write on public.grants for insert to authenticated
  with check (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'));
create policy grants_update on public.grants for update to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile')) with check (org_id = app.me_org());

create policy budget_select on public.budget_lines for select to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile','read_only'));
create policy budget_insert on public.budget_lines for insert to authenticated
  with check (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'));
create policy budget_update on public.budget_lines for update to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile')) with check (org_id = app.me_org());
create policy budget_delete on public.budget_lines for delete to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'));

create policy cash_select on public.cash_counts for select to authenticated using (org_id = app.me_org());
-- inserimento solo tramite record_cash_count (calcola il saldo dell'app alla data)

revoke all on public.grants, public.budget_lines, public.cash_counts from anon, authenticated;
grant select, insert, update on public.grants to authenticated;
grant select, insert, update, delete on public.budget_lines to authenticated;
grant select on public.cash_counts to authenticated;

create trigger grants_touch before update on public.grants for each row execute function app.touch();
do $$
declare t text;
begin
  foreach t in array array['grants','budget_lines','cash_counts'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I
                    for each row execute function app.audit()', t);
  end loop;
end $$;
create trigger cash_counts_append_only before update or delete on public.cash_counts
  for each row execute function app.append_only();

-- ---------------------------------------------------------------- funzioni
-- Budget e speso per gruppo di codici. Progetto e anno, oppure un finanziamento (tutta la durata).
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
  )
  select g.id, g.code, g.name_it, g.name_fr, coalesce(bud.b, 0), coalesce(spent.s, 0), coalesce(spent.n, 0)::int
  from public.category_groups g
  left join bud on bud.group_id = g.id
  left join spent on spent.group_id = g.id
  where g.org_id = app.me_org() and g.direction = 'out'
    and app.has_role('super_admin','admin','responsabile','read_only')
  order by g.sort
$$;

-- Imposta il budget (progetto+anno oppure finanziamento) in un'unica transazione: le righe precedenti
-- restano nel registro delle modifiche. p_lines = [{"group_id": "...", "amount_eur": 1000}, ...]
create or replace function public.set_budget(p_project uuid, p_year int, p_grant uuid, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_n int;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
  if (p_grant is null) = (p_project is null) then perform app.fail('invalid', 'indicare un progetto con l''anno oppure un finanziamento'); end if;
  if p_project is not null and (p_year is null or not exists (select 1 from public.projects where id = p_project and org_id = v_org)) then
    perform app.fail('invalid', 'progetto o anno');
  end if;
  if p_grant is not null and not exists (select 1 from public.grants where id = p_grant and org_id = v_org) then
    perform app.fail('invalid', 'finanziamento');
  end if;
  delete from public.budget_lines
  where org_id = v_org and ((p_grant is not null and grant_id = p_grant) or (p_grant is null and project_id = p_project and year = p_year));
  insert into public.budget_lines(org_id, project_id, year, grant_id, group_id, amount_eur, updated_by)
  select v_org, p_project, case when p_grant is null then p_year end, p_grant, (l->>'group_id')::uuid, (l->>'amount_eur')::numeric, auth.uid()
  from jsonb_array_elements(coalesce(p_lines, '[]')) l
  where (l->>'amount_eur')::numeric > 0
    and exists (select 1 from public.category_groups g where g.id = (l->>'group_id')::uuid and g.org_id = v_org and g.direction = 'out');
  get diagnostics v_n = row_count;
  return jsonb_build_object('outcome', 'applied', 'lines', v_n);
end $$;

-- Conta di cassa: registra i contanti contati e il saldo dell'app alla stessa data (movimenti registrati e verificati).
create or replace function public.record_cash_count(p_account uuid, p_date date, p_counted numeric, p_notes text default null,
                                                    p_denominations jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_acc public.accounts; v_bal numeric; v_id uuid;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_acc from public.accounts where id = p_account and org_id = app.me_org();
  if not found then perform app.fail('not_found', 'conto'); end if;
  if v_acc.kind <> 'cash' then perform app.fail('invalid', 'la conta si fa sui conti di cassa'); end if;
  if p_date > current_date then perform app.fail('invalid', 'data futura'); end if;
  select b.balance into v_bal from public.account_balances(p_date) b where b.account_id = p_account;
  insert into public.cash_counts(org_id, account_id, count_date, counted, system_balance, denominations, notes, counted_by)
  values (v_acc.org_id, p_account, p_date, p_counted, coalesce(v_bal, 0), p_denominations, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('outcome', 'applied', 'id', v_id, 'system_balance', coalesce(v_bal, 0),
                            'difference', p_counted - coalesce(v_bal, 0));
end $$;

-- Quote associative per socio e anno (codice E104)
create or replace function public.member_fees(p_year int)
returns table (counterparty_id uuid, name text, amount_eur numeric, payments int, last_date date)
language sql stable security definer set search_path = '' as $$
  select x.id, x.name, sum(m.amount_eur * m.sign), count(*)::int, max(m.op_date)
  from public.movements m
  join public.categories c on c.id = m.category_id and c.code = 'E104'
  join public.counterparties x on x.id = m.counterparty_id
  where m.org_id = app.me_org() and m.status in ('recorded','verified') and extract(year from m.op_date) = p_year
    and app.has_role('super_admin','admin','responsabile','read_only')
  group by x.id, x.name
  order by x.name
$$;

revoke execute on function public.set_budget(uuid, int, uuid, jsonb), public.budget_vs_actual(uuid, int, uuid),
  public.record_cash_count(uuid, date, numeric, text, jsonb), public.member_fees(int) from public, anon;
grant execute on function public.set_budget(uuid, int, uuid, jsonb), public.budget_vs_actual(uuid, int, uuid),
  public.record_cash_count(uuid, date, numeric, text, jsonb), public.member_fees(int) to authenticated;
