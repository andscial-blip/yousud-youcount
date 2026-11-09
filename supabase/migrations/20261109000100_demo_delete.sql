-- 0900 · Dati dimostrativi separati dai dati reali, cancellazioni controllate
--
-- DATI DIMOSTRATIVI
--  · colonna «demo» su movimenti, progetti, controparti, preventivi, tassi, scadenze e documenti emessi;
--  · demo_load: carica in una sola transazione un insieme completo (solo amministratori, solo se non ce n'è già uno);
--    i movimenti hanno numero DEMO-AAAA-NNN, quindi non consumano la numerazione reale MOV-AAAA-NNN;
--  · demo_counts / demo_purge: mostrano ed eliminano SOLO le righe demo (mai quelle reali), con conferma del numero;
--    ogni riga eliminata resta nel registro delle modifiche (trigger di audit), da cui si può ricostruire.
-- CANCELLAZIONI
--  · movement_delete: una bozza si elimina (chi l'ha creata o un responsabile); un movimento demo si elimina;
--    un movimento reale registrato NON si elimina: si storna (resta traccia contabile), come già previsto;
--  · budget_delete: bozza o demo si eliminano; una versione approvata reale solo da un amministratore,
--    con il motivo, e resta nel registro delle modifiche.

alter table public.movements add column if not exists demo boolean not null default false;
alter table public.projects add column if not exists demo boolean not null default false;
alter table public.counterparties add column if not exists demo boolean not null default false;
alter table public.budgets add column if not exists demo boolean not null default false;
alter table public.fx_rates add column if not exists demo boolean not null default false;
alter table public.deadlines add column if not exists demo boolean not null default false;
alter table public.issued_docs add column if not exists demo boolean not null default false;
create index if not exists movements_demo_idx on public.movements(org_id) where demo;

-- permesso temporaneo (solo dentro la transazione) per le funzioni di eliminazione qui sotto
create or replace function app.bypass() returns boolean language sql stable as $$
  select coalesce(current_setting('app.bypass', true), '') = 'on'
$$;

create or replace function app.movements_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not (old.demo and app.bypass()) then
      perform app.fail('immutable', 'un movimento registrato non si cancella: usare lo storno');
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not app.period_open(new.org_id, new.op_date) then
      perform app.fail('period_closed', to_char(new.op_date, 'MM/YYYY'));
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'verified' then
    perform app.fail('immutable', 'movimento verificato: usare lo storno');
  end if;
  if exists (select 1 from public.movements r where r.reverses_id = old.id) then
    perform app.fail('immutable', 'movimento già stornato');
  end if;
  if new.org_id <> old.org_id or new.client_uuid <> old.client_uuid or new.created_by <> old.created_by
     or new.reverses_id is distinct from old.reverses_id or new.demo is distinct from old.demo
     or (old.ref is not null and new.ref is distinct from old.ref) then
    perform app.fail('immutable', 'campo non modificabile');
  end if;
  if old.status = 'recorded' and new.status = 'draft' then
    perform app.fail('invalid_transition', 'un movimento registrato non torna bozza');
  end if;
  if new.status <> 'draft' and not app.period_open(new.org_id, new.op_date) then
    perform app.fail('period_closed', to_char(new.op_date, 'MM/YYYY'));
  end if;
  if old.status <> 'draft' and not app.period_open(old.org_id, old.op_date) then
    perform app.fail('period_closed', to_char(old.op_date, 'MM/YYYY'));
  end if;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end $$;

create or replace function app.movement_documents_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if app.bypass() then return old; end if;
  if exists (select 1 from public.movements m where m.id = old.movement_id and m.status <> 'draft') then
    perform app.fail('immutable', 'documento collegato a un movimento registrato');
  end if;
  return old;
end $$;

create or replace function app.budget_items_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_st text; v_b uuid := coalesce(new.budget_id, old.budget_id);
begin
  if tg_op = 'DELETE' and app.bypass() then return old; end if;
  select status into v_st from public.budgets where id = v_b;
  -- eccezione interna: il caricamento dei dati dimostrativi scrive le righe di una versione già approvata
  if v_st is distinct from 'draft' and not (tg_op = 'INSERT' and app.bypass()) then perform app.fail('immutable', 'preventivo approvato: crea una revisione'); end if;
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

-- ---------------------------------------------------------------- eliminazioni puntuali
create or replace function public.movement_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_m public.movements;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_m from public.movements where id = p_id and org_id = app.me_org() for update;
  if not found or not app.can_see_movement(v_m) then perform app.fail('not_found', 'movimento'); end if;
  if v_m.status = 'draft' then
    if v_m.created_by <> auth.uid() and not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
  elsif v_m.demo then
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo un responsabile'); end if;
    if exists (select 1 from public.movements r where r.reverses_id = v_m.id) then perform app.fail('invalid', 'movimento stornato: elimina prima lo storno'); end if;
  else
    perform app.fail('immutable', 'un movimento registrato non si elimina: usa lo storno, così resta la traccia contabile');
  end if;
  perform set_config('app.bypass', 'on', true);
  delete from public.reconciliation_items where movement_id = p_id;
  delete from public.self_certs where movement_id = p_id and v_m.demo;
  update public.issued_docs set movement_id = null where movement_id = p_id;
  update public.deadlines set movement_id = null where movement_id = p_id;
  delete from public.movements where id = p_id;
  perform set_config('app.bypass', 'off', true);
  return jsonb_build_object('outcome', 'deleted', 'ref', v_m.ref);
end $$;

create or replace function public.budget_delete(p_id uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_b public.budgets; v_n int;
begin
  select * into v_b from public.budgets where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'preventivo'); end if;
  if v_b.status = 'draft' or v_b.demo then
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden'); end if;
  else
    if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'solo un amministratore elimina una versione approvata'); end if;
    if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo dell''eliminazione'); end if;
  end if;
  perform set_config('app.bypass', 'on', true);
  update public.budgets set based_on = null where based_on = p_id;
  delete from public.budget_items where budget_id = p_id;
  get diagnostics v_n = row_count;
  delete from public.budgets where id = p_id;
  -- se si elimina la versione in vigore, torna in vigore l'ultima superata (se c'è)
  if v_b.status = 'approved' then
    update public.budgets set status = 'approved' where id = (select id from public.budgets where org_id = v_b.org_id and year = v_b.year
      and status = 'superseded' order by version desc limit 1);
  end if;
  perform set_config('app.bypass', 'off', true);
  return jsonb_build_object('outcome', 'deleted', 'items', v_n, 'version', v_b.version);
end $$;

-- ---------------------------------------------------------------- dati dimostrativi
create or replace function public.demo_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when app.has_role('super_admin','admin') then jsonb_build_object(
    'movements', (select count(*) from public.movements where org_id = app.me_org() and demo),
    'budgets', (select count(*) from public.budgets where org_id = app.me_org() and demo),
    'budget_items', (select count(*) from public.budget_items i join public.budgets b on b.id = i.budget_id where b.org_id = app.me_org() and b.demo),
    'fx_rates', (select count(*) from public.fx_rates where org_id = app.me_org() and demo),
    'projects', (select count(*) from public.projects where org_id = app.me_org() and demo),
    'counterparties', (select count(*) from public.counterparties where org_id = app.me_org() and demo),
    'deadlines', (select count(*) from public.deadlines where org_id = app.me_org() and demo),
    'issued_docs', (select count(*) from public.issued_docs where org_id = app.me_org() and demo)) end
$$;

-- Elimina tutti e soli i dati demo. p_expected = numero di movimenti demo mostrato all'utente: se nel frattempo
-- è cambiato, non elimina nulla (la conferma deve riferirsi a ciò che viene davvero eliminato).
create or replace function public.demo_purge(p_expected int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_before jsonb;
begin
  if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'solo un amministratore'); end if;
  v_before := public.demo_counts();
  if (v_before->>'movements')::int <> coalesce(p_expected, -1) then
    perform app.fail('invalid', format('i movimenti demo sono %s, non %s: ricarica la pagina', v_before->>'movements', p_expected));
  end if;
  perform set_config('app.bypass', 'on', true);
  delete from public.issued_docs where org_id = v_org and (demo or movement_id in (select id from public.movements where org_id = v_org and demo));
  delete from public.deadlines where org_id = v_org and demo;
  update public.deadlines set movement_id = null where org_id = v_org and movement_id in (select id from public.movements where org_id = v_org and demo);
  delete from public.self_certs where movement_id in (select id from public.movements where org_id = v_org and demo);
  delete from public.reconciliation_items where movement_id in (select id from public.movements where org_id = v_org and demo);
  delete from public.movements where org_id = v_org and demo and reverses_id is not null;
  delete from public.movements where org_id = v_org and demo;
  update public.budgets set based_on = null where org_id = v_org and based_on in (select id from public.budgets where org_id = v_org and demo);
  delete from public.budget_items where budget_id in (select id from public.budgets where org_id = v_org and demo);
  delete from public.budgets where org_id = v_org and demo;
  delete from public.fx_rates where org_id = v_org and demo;
  delete from public.counterparties c where c.org_id = v_org and c.demo and not exists (select 1 from public.movements m where m.counterparty_id = c.id);
  delete from public.projects p where p.org_id = v_org and p.demo
    and not exists (select 1 from public.movements m where m.project_id = p.id)
    and not exists (select 1 from public.budget_items i where i.project_id = p.id)
    and not exists (select 1 from public.grants g where g.project_id = p.id);
  perform set_config('app.bypass', 'off', true);
  return jsonb_build_object('outcome', 'purged', 'deleted', v_before);
end $$;

-- Carica un insieme dimostrativo preparato dall'app (src/lib/demo). Tutto marcato demo, in una sola transazione.
create or replace function public.demo_load(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := app.me_org(); v_uid uuid := auth.uid(); x jsonb; v_b uuid; v_n int := 0; v_y int; v_prj uuid; v_cat uuid;
  v_acc uuid; v_to uuid; v_ref text; v_seq int := 0; v_st text;
begin
  if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'solo un amministratore'); end if;
  if exists (select 1 from public.movements where org_id = v_org and demo) then
    perform app.fail('invalid', 'ci sono già dati dimostrativi: svuotali prima di ricaricarli');
  end if;
  -- progetti (usa quelli esistenti con lo stesso nome)
  for x in select * from jsonb_array_elements(coalesce(p->'projects', '[]')) loop
    if not exists (select 1 from public.projects where org_id = v_org and lower(name) = lower(x->>'name')) then
      insert into public.projects(org_id, name, kind, demo) values (v_org, x->>'name', coalesce(x->>'kind', 'project'), true);
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'counterparties', '[]')) loop
    if not exists (select 1 from public.counterparties where org_id = v_org and lower(name) = lower(x->>'name')) then
      insert into public.counterparties(org_id, name, kind, created_by, demo) values (v_org, x->>'name', x->>'kind', v_uid, true);
    end if;
  end loop;
  -- tassi: mai sovrascritti; quelli reali (dal foglio Excel) entrano come dati reali solo se il mese è vuoto
  for x in select * from jsonb_array_elements(coalesce(p->'fx', '[]')) loop
    insert into public.fx_rates(org_id, year, month, rate, source, updated_by, demo)
    values (v_org, (x->>'year')::int, (x->>'month')::int, (x->>'rate')::numeric, x->>'source', v_uid, coalesce((x->>'demo')::boolean, true))
    on conflict (org_id, year, month) do nothing;
  end loop;
  -- preventivo: versione demo approvata, solo se per l'anno non c'è già un preventivo approvato reale
  if p ? 'budget' then
    v_y := (p#>>'{budget,year}')::int;
    if not exists (select 1 from public.budgets where org_id = v_org and year = v_y and status = 'approved' and not demo) then
      update public.budgets set status = 'superseded' where org_id = v_org and year = v_y and status = 'approved';
      -- direttamente approvato (una bozza reale dello stesso anno resta com'è)
      perform set_config('app.bypass', 'on', true);
      insert into public.budgets(org_id, year, version, status, title, approval_ref, demo, approved_at, approved_by, created_by)
      values (v_org, v_y, coalesce((select max(version) from public.budgets where org_id = v_org and year = v_y), 0) + 1, 'approved',
              p#>>'{budget,title}', p#>>'{budget,ref}', true, now(), v_uid, v_uid)
      returning id into v_b;
      for x in select * from jsonb_array_elements(p#>'{budget,items}') loop
        select id into v_prj from public.projects where org_id = v_org and lower(name) = lower(x->>'prj');
        select id into v_cat from public.categories where org_id = v_org and code = x->>'code';
        if v_cat is null then continue; end if;
        insert into public.budget_items(budget_id, org_id, project_id, category_id, description, qty, unit, unit_cost, currency, fx_rate, notes, sort)
        values (v_b, v_org, v_prj, v_cat, left(x->>'desc', 300), (x->>'qty')::numeric, left(x->>'unit', 30), (x->>'cost')::numeric,
                x->>'cur', nullif(x->>'rate', '')::numeric, left(x->>'note', 500), v_n);
        v_n := v_n + 1;
      end loop;
      perform set_config('app.bypass', 'off', true);
    end if;
  end if;
  -- movimenti
  for x in select * from jsonb_array_elements(coalesce(p->'movements', '[]')) loop
    select id into v_acc from public.accounts where org_id = v_org and code = x->>'acc';
    select id into v_to from public.accounts where org_id = v_org and code = x->>'to';
    if v_acc is null then continue; end if;
    v_st := coalesce(x->>'st', 'verified');
    if v_st <> 'draft' and not app.period_open(v_org, (x->>'d')::date) then continue; end if;
    v_seq := v_seq + 1;
    v_ref := case when v_st = 'draft' then null else 'DEMO-' || extract(year from (x->>'d')::date) || '-' || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0') end;
    insert into public.movements(org_id, client_uuid, ref, kind, status, op_date, description, amount, currency, fx_rate, account_id,
      to_account_id, to_amount, category_id, project_id, counterparty_id, payment_method_id, notes, no_doc_reason, demo,
      created_by, updated_by, recorded_by, recorded_at, verified_by, verified_at)
    values (v_org, gen_random_uuid(), v_ref, (x->>'k')::public.mov_kind, v_st::public.mov_status, (x->>'d')::date, left(x->>'de', 500),
      (x->>'a')::numeric, x->>'cur', nullif(x->>'r', '')::numeric, v_acc, v_to, nullif(x->>'ta', '')::numeric,
      case when x->>'k' = 'transfer' then null else (select id from public.categories where org_id = v_org and code = x->>'code') end,
      (select id from public.projects where org_id = v_org and lower(name) = lower(x->>'prj')),
      (select id from public.counterparties where org_id = v_org and lower(name) = lower(x->>'cp') order by created_at limit 1),
      (select id from public.payment_methods where org_id = v_org and code = x->>'pm'),
      'DEMO · dato dimostrativo, non reale', coalesce(x->>'nd', case when v_st <> 'draft' then 'DEMO: movimento dimostrativo senza giustificativo' end), true,
      v_uid, v_uid, case when v_st <> 'draft' then v_uid end, case when v_st <> 'draft' then now() end,
      case when v_st = 'verified' then v_uid end, case when v_st = 'verified' then now() end);
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'deadlines', '[]')) loop
    insert into public.deadlines(org_id, title, category, due_date, amount, currency, priority, status, done_at, done_by, notes, created_by, demo,
      project_id)
    values (v_org, x->>'title', coalesce(x->>'cat', 'altro'), (x->>'d')::date, nullif(x->>'a', '')::numeric, nullif(x->>'cur', ''),
      coalesce(x->>'prio', 'normal'), coalesce(x->>'st', 'open'), case when x->>'st' = 'done' then now() end,
      case when x->>'st' = 'done' then v_uid end, 'DEMO · scadenza dimostrativa', v_uid, true,
      (select id from public.projects where org_id = v_org and lower(name) = lower(x->>'prj')));
  end loop;
  return jsonb_build_object('outcome', 'loaded', 'counts', public.demo_counts());
end $$;

revoke all on function public.movement_delete(uuid), public.budget_delete(uuid, text), public.demo_counts(), public.demo_purge(int),
  public.demo_load(jsonb) from public, anon;
grant execute on function public.movement_delete(uuid), public.budget_delete(uuid, text), public.demo_counts(), public.demo_purge(int),
  public.demo_load(jsonb) to authenticated;
revoke execute on function app.bypass() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Documenti emessi: due nuovi tipi (Dichiarazione/attestazione, Buono d'ordine) e archiviazione.
-- Archiviare nasconde dall'elenco corrente senza toccare numero, contenuto o PDF; si può annullare l'archiviazione.
alter table public.issued_docs drop constraint if exists issued_docs_type_check;
alter table public.issued_docs add constraint issued_docs_type_check check (type in ('RIC','QUI','NOT','NRS','ASP','NDD','DIC','BDC'));
alter table public.issued_docs add column if not exists archived_at timestamptz;

do $$
declare v_src text;
begin
  select pg_get_functiondef('public.issued_doc_save(jsonb)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$not in ('RIC','QUI','NOT','NRS','ASP','NDD')$q$, $q$not in ('RIC','QUI','NOT','NRS','ASP','NDD','DIC','BDC')$q$);
  execute v_src;
  -- una dichiarazione può non avere importo (es. attestazione di volontariato)
  select pg_get_functiondef('public.issued_doc_issue(uuid)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$if coalesce(v_d.amount, 0) <= 0 then$q$, $q$if v_d.type <> 'DIC' and coalesce(v_d.amount, 0) <= 0 then$q$);
  execute v_src;
end $$;

create or replace function public.issued_doc_archive(p_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.issued_docs;
begin
  if not app.is_staff() then perform app.fail('forbidden'); end if;
  select * into v_d from public.issued_docs where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'documento'); end if;
  if v_d.status = 'draft' then perform app.fail('invalid', 'una bozza non si archivia: si elimina'); end if;
  update public.issued_docs set archived_at = case when p_on then now() end, updated_at = now() where id = p_id returning * into v_d;
  return to_jsonb(v_d);
end $$;
revoke all on function public.issued_doc_archive(uuid, boolean) from public, anon;
grant execute on function public.issued_doc_archive(uuid, boolean) to authenticated;

-- Numerazione: lpad(n, 3) tronca i numeri oltre 999 (1000 → «100»), quindi il millesimo movimento (o documento)
-- dell'anno avrebbe un numero già usato e la registrazione fallirebbe. Si mantiene il minimo di 3 cifre senza troncare.
do $$
declare f text; v_src text;
begin
  foreach f in array array['app.next_ref(uuid,date)', 'public.issued_doc_issue(uuid)', 'public.create_self_cert(jsonb)'] loop
    select pg_get_functiondef(f::regprocedure) into v_src;
    v_src := replace(v_src, $q$lpad(v_n::text, 3, '0')$q$, $q$lpad(v_n::text, greatest(3, length(v_n::text)), '0')$q$);
    if position('greatest(3, length(v_n::text))' in v_src) = 0 then raise exception 'numerazione non aggiornata in %', f; end if;
    execute v_src;
  end loop;
end $$;
