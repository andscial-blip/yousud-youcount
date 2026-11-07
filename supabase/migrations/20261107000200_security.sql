-- 0200 · Funzioni di autorizzazione, RLS, privilegi
-- Le scritture sui movimenti e sui documenti passano solo dalle funzioni contabili (0300);
-- gli utenti dell'API non hanno INSERT/UPDATE/DELETE diretti su quelle tabelle.

-- ---------------------------------------------------------------- helper (schema app, non esposto dall'API)
create or replace function app.me_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function app.me_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.org_id from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function app.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = any(roles) from public.profiles p where p.id = auth.uid() and p.active), false)
$$;

create or replace function app.is_staff() returns boolean            -- vede tutto in sola lettura
language sql stable security definer set search_path = '' as $$
  select app.has_role('super_admin','admin','responsabile','read_only')
$$;

create or replace function app.can_see_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_staff()
      or coalesce((select p.all_projects from public.profiles p where p.id = auth.uid() and p.active), false)
      or (p_project is not null and exists (
            select 1 from public.project_members m
            where m.project_id = p_project and m.user_id = auth.uid()))
$$;

create or replace function app.can_see_movement(m public.movements) returns boolean
language sql stable security definer set search_path = '' as $$
  select m.org_id = app.me_org() and (
       app.has_role('super_admin','admin','responsabile')
    or (app.has_role('read_only') and m.status <> 'draft')
    or (app.has_role('operator') and (m.created_by = auth.uid()
                                      or (m.status <> 'draft' and app.can_see_project(m.project_id))))
  )
$$;

create or replace function app.setting(p_org uuid, p_key text, p_default jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value from public.settings s where s.org_id = p_org and s.key = p_key), p_default)
$$;

-- errore applicativo con codice leggibile dal client: "codice: dettaglio"
create or replace function app.fail(p_code text, p_detail text default null) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code || coalesce(': ' || p_detail, ''), hint = p_code;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.organizations        enable row level security;
alter table public.settings             enable row level security;
alter table public.profiles             enable row level security;
alter table public.accounts             enable row level security;
alter table public.report_lines         enable row level security;
alter table public.category_groups      enable row level security;
alter table public.categories           enable row level security;
alter table public.projects             enable row level security;
alter table public.project_members      enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.counterparties       enable row level security;
alter table public.counterparty_private enable row level security;
alter table public.documents            enable row level security;
alter table public.movements            enable row level security;
alter table public.movement_documents   enable row level security;
alter table public.periods              enable row level security;
alter table public.audit_log            enable row level security;
alter table public.sync_log             enable row level security;

-- organizzazione e impostazioni
create policy org_select on public.organizations for select to authenticated using (id = app.me_org());
create policy settings_select on public.settings for select to authenticated using (org_id = app.me_org());
create policy settings_write on public.settings for all to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin'))
  with check (org_id = app.me_org() and app.has_role('super_admin','admin'));

-- profili: ognuno vede il proprio; responsabili e amministratori vedono quelli dell'ente.
create policy profiles_select on public.profiles for select to authenticated
  using (org_id = app.me_org() and (id = auth.uid() or app.has_role('super_admin','admin','responsabile')));
-- ognuno modifica solo nome e lingua (il trigger blocca gli altri campi)
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and active) with check (id = auth.uid());

-- dati di riferimento: lettura per tutti gli utenti attivi dell'ente, scrittura per gli amministratori.
-- Nessuna policy DELETE: si disattiva, non si cancella.
do $$
declare t text;
begin
  foreach t in array array['accounts','report_lines','category_groups','categories','projects','payment_methods'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (org_id = app.me_org())', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
                      with check (org_id = app.me_org() and app.has_role(''super_admin'',''admin''))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
                      using (org_id = app.me_org() and app.has_role(''super_admin'',''admin''))
                      with check (org_id = app.me_org() and app.has_role(''super_admin'',''admin''))', t);
  end loop;
end $$;

create policy project_members_select on public.project_members for select to authenticated
  using (org_id = app.me_org() and (user_id = auth.uid() or app.has_role('super_admin','admin','responsabile')));

-- controparti: tutti leggono il nome; inseriscono operatori e superiori; modificano responsabili e superiori.
create policy counterparties_select on public.counterparties for select to authenticated using (org_id = app.me_org());
create policy counterparties_insert on public.counterparties for insert to authenticated
  with check (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile','operator')
              and created_by = auth.uid());
create policy counterparties_update on public.counterparties for update to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'))
  with check (org_id = app.me_org());
-- dati personali delle controparti: solo responsabili e amministratori.
create policy cp_private_all on public.counterparty_private for all to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'))
  with check (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'));

-- movimenti: solo lettura via API, secondo ruolo e progetti assegnati.
create policy movements_select on public.movements for select to authenticated
  using (app.can_see_movement(movements));

create policy movement_documents_select on public.movement_documents for select to authenticated
  using (org_id = app.me_org() and exists (
    select 1 from public.movements m where m.id = movement_id and app.can_see_movement(m)));

create policy documents_select on public.documents for select to authenticated
  using (org_id = app.me_org() and (
       uploaded_by = auth.uid()
    or app.has_role('super_admin','admin','responsabile','read_only')
    or exists (select 1 from public.movement_documents md join public.movements m on m.id = md.movement_id
               where md.document_id = documents.id and app.can_see_movement(m))));

create policy periods_select on public.periods for select to authenticated using (org_id = app.me_org());

create policy audit_select on public.audit_log for select to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin'));

create policy sync_select on public.sync_log for select to authenticated
  using (org_id = app.me_org() and (user_id = auth.uid() or app.has_role('super_admin','admin')));

-- ---------------------------------------------------------------- privilegi
-- Su Supabase i ruoli anon/authenticated ricevono per default tutti i privilegi sulle tabelle di public:
-- qui li restringiamo esplicitamente (difesa in profondità oltre alla RLS).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema app to authenticated;
revoke all on app.ref_counters from anon, authenticated;

grant select on public.organizations, public.settings, public.profiles, public.accounts, public.report_lines,
                public.category_groups, public.categories, public.projects, public.project_members,
                public.payment_methods, public.counterparties, public.counterparty_private,
                public.documents, public.movements, public.movement_documents, public.periods,
                public.audit_log, public.sync_log
  to authenticated;
grant insert, update on public.settings, public.accounts, public.report_lines, public.category_groups,
                        public.categories, public.projects, public.payment_methods
  to authenticated;
grant insert, update on public.counterparties, public.counterparty_private to authenticated;
grant update (full_name, lang) on public.profiles to authenticated;
-- movements, documents, movement_documents, periods, audit_log, sync_log, project_members:
-- nessuna scrittura diretta; solo tramite le funzioni in 0300.
