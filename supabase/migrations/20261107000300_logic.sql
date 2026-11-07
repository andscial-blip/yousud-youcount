-- 0300 · Trigger e funzioni contabili
-- Tutte le funzioni pubbliche sono SECURITY DEFINER con search_path vuoto e controllano ruolo ed ente.
-- Esito restituito come jsonb: {outcome: applied|duplicate|conflict, id, version, ref, status}.
-- Gli errori sono eccezioni con messaggio "codice: dettaglio" (codici: forbidden, not_found, immutable,
-- invalid, invalid_transition, currency_mismatch, period_closed, document_required, four_eyes,
-- already_reversed, unverified_movements, last_super_admin).

-- ================================================================ trigger generici
create or replace function app.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'version' then new.version := old.version + 1; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','accounts','categories','projects','counterparties','documents'] loop
    execute format('create trigger %1$s_touch before update on public.%1$I for each row execute function app.touch()', t);
  end loop;
end $$;
create trigger counterparty_private_touch before update on public.counterparty_private
  for each row execute function app.touch();

-- ---------------------------------------------------------------- registro delle modifiche
create or replace function app.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb; v_new jsonb; v_any jsonb; v_id text; v_org uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and v_old = v_new then return null; end if;
  v_any := coalesce(v_new, v_old);
  v_id := case tg_table_name
            when 'counterparty_private' then v_any->>'counterparty_id'
            when 'movement_documents'   then (v_any->>'movement_id') || '/' || (v_any->>'document_id')
            when 'project_members'      then (v_any->>'project_id') || '/' || (v_any->>'user_id')
            when 'periods'              then (v_any->>'year') || '-' || lpad(v_any->>'month', 2, '0')
            when 'settings'             then v_any->>'key'
            else v_any->>'id' end;
  v_org := case when tg_table_name = 'organizations' then (v_any->>'id')::uuid else (v_any->>'org_id')::uuid end;
  insert into public.audit_log(org_id, table_name, row_id, action, actor, old_row, new_row)
  values (v_org, tg_table_name, v_id, lower(tg_op), auth.uid(), v_old, v_new);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','settings','profiles','accounts','report_lines','category_groups',
                           'categories','projects','project_members','payment_methods','counterparties',
                           'counterparty_private','documents','movements','movement_documents','periods'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I
                    for each row execute function app.audit()', t);
  end loop;
end $$;

create or replace function app.append_only() returns trigger language plpgsql as $$
begin
  perform app.fail('immutable', tg_table_name || ' non si modifica né si cancella');
  return null;
end $$;
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.append_only();
create trigger sync_log_append_only before update or delete on public.sync_log
  for each row execute function app.append_only();

-- ---------------------------------------------------------------- profili
create or replace function app.profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon')
     and (new.role is distinct from old.role or new.active is distinct from old.active
          or new.org_id is distinct from old.org_id or new.all_projects is distinct from old.all_projects
          or new.email is distinct from old.email) then
    perform app.fail('forbidden', 'campo del profilo non modificabile dall''utente');
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function app.profiles_guard();

-- profilo creato all'invito. Ruolo ed ente arrivano da raw_app_meta_data, che solo il server
-- (chiave di servizio) può scrivere. super_admin solo se l'ente non ne ha ancora uno.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_role public.app_role;
begin
  v_org := coalesce(nullif(new.raw_app_meta_data->>'org_id', '')::uuid,
                    (select o.id from public.organizations o order by o.created_at limit 1));
  if v_org is null then return new; end if;
  v_role := coalesce(nullif(new.raw_app_meta_data->>'role', '')::public.app_role, 'read_only');
  if v_role = 'super_admin' and exists (select 1 from public.profiles p where p.org_id = v_org and p.role = 'super_admin') then
    v_role := 'read_only';
  end if;
  insert into public.profiles(id, org_id, full_name, email, role)
  values (new.id, v_org, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, v_role)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------- documenti
create or replace function app.documents_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then perform app.fail('immutable', 'i documenti non si cancellano'); end if;
  if new.original_path <> old.original_path or new.sha256 <> old.sha256 or new.org_id <> old.org_id
     or new.uploaded_by <> old.uploaded_by or new.client_uuid <> old.client_uuid then
    perform app.fail('immutable', 'il file originale non si sostituisce');
  end if;
  return new;
end $$;
create trigger documents_guard before update or delete on public.documents
  for each row execute function app.documents_guard();

-- ================================================================ movimenti: regole
create or replace function app.period_open(p_org uuid, p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.periods pr
                     where pr.org_id = p_org and pr.year = extract(year from p_date)::int
                       and pr.month = extract(month from p_date)::int and pr.closed_at is not null)
$$;

create or replace function app.next_ref(p_org uuid, p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare v_year int := extract(year from p_date)::int; v_n int;
begin
  insert into app.ref_counters(org_id, year, last) values (p_org, v_year, 1)
  on conflict (org_id, year) do update set last = app.ref_counters.last + 1
  returning last into v_n;
  return 'MOV-' || v_year || '-' || lpad(v_n::text, 3, '0');
end $$;

-- coerenza con conti, categorie, progetti dello stesso ente
create or replace function app.movements_validate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.accounts; ta public.accounts; c public.categories; v_org uuid;
begin
  select * into a from public.accounts where id = new.account_id;
  if a.org_id <> new.org_id then perform app.fail('invalid', 'conto di un altro ente'); end if;
  if a.currency <> new.currency then
    perform app.fail('currency_mismatch', format('il conto %s è in %s, il movimento in %s', a.code, a.currency, new.currency));
  end if;
  if not a.active and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
    perform app.fail('invalid', 'conto disattivato');
  end if;

  if new.kind = 'transfer' then
    select * into ta from public.accounts where id = new.to_account_id;
    if ta.org_id <> new.org_id then perform app.fail('invalid', 'conto di destinazione di un altro ente'); end if;
    if ta.currency = a.currency and new.to_amount <> new.amount then
      perform app.fail('invalid', 'giroconto nella stessa valuta: importo uscito e importo entrato devono coincidere');
    end if;
  end if;

  if new.category_id is not null then
    select * into c from public.categories where id = new.category_id;
    if c.org_id <> new.org_id then perform app.fail('invalid', 'categoria di un altro ente'); end if;
    if (new.kind = 'expense' and c.direction <> 'out') or (new.kind = 'income' and c.direction <> 'in') then
      perform app.fail('invalid', format('il codice %s non è un codice di %s', c.code,
                                         case new.kind when 'expense' then 'uscita' else 'entrata' end));
    end if;
    if not c.active and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
      perform app.fail('invalid', 'codice contabile disattivato');
    end if;
  end if;

  foreach v_org in array array[
      (select p.org_id from public.projects p where p.id = new.project_id),
      (select g.org_id from public.grants g where g.id = new.grant_id),
      (select x.org_id from public.counterparties x where x.id = new.counterparty_id),
      (select m.org_id from public.payment_methods m where m.id = new.payment_method_id)] loop
    if v_org is not null and v_org <> new.org_id then perform app.fail('invalid', 'riferimento di un altro ente'); end if;
  end loop;

  if new.op_date > current_date + 60 then perform app.fail('invalid', 'data operazione troppo nel futuro'); end if;
  return new;
end $$;
create trigger movements_validate before insert or update on public.movements
  for each row execute function app.movements_validate();

-- immutabilità e periodi chiusi (valgono anche per chi usa la chiave di servizio)
create or replace function app.movements_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
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
     or new.reverses_id is distinct from old.reverses_id
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
create trigger movements_guard before insert or update or delete on public.movements
  for each row execute function app.movements_guard();

-- movement_documents: non si scollega un documento da un movimento registrato
create or replace function app.movement_documents_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.movements m where m.id = old.movement_id and m.status <> 'draft') then
    perform app.fail('immutable', 'documento collegato a un movimento registrato');
  end if;
  return old;
end $$;
create trigger movement_documents_guard before delete on public.movement_documents
  for each row execute function app.movement_documents_guard();

create or replace function app.log_sync(p_org uuid, p_device text, p_client uuid, p_op text, p_outcome text, p_detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.sync_log(org_id, user_id, device_id, client_uuid, operation, outcome, detail)
  values (p_org, auth.uid(), left(p_device, 100), p_client, p_op, p_outcome, p_detail)
$$;

create or replace function app.result(m public.movements, p_outcome text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('outcome', p_outcome, 'id', m.id, 'version', m.version,
                            'ref', m.ref, 'status', m.status)
$$;

-- ================================================================ API contabile
-- Crea o modifica un movimento. Campi accettati in p:
--   client_uuid (obbligatorio alla creazione), id + expected_version (per modificare), op_uuid (id della
--   modifica, per reinvii senza effetti doppi), status ('draft' | 'recorded'), device_id, document_ids[],
--   kind, op_date, doc_date, description, amount, currency, fx_rate, account_id, to_account_id, to_amount,
--   category_id, project_id, grant_id, counterparty_id, payment_method_id, notes, ai_extracted, no_doc_reason.
-- In modifica, i campi assenti restano invariati; per svuotare un campo si invia null.
create or replace function public.save_movement(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_role   public.app_role := app.me_role();
  v_org    uuid := app.me_org();
  v_id     uuid := nullif(p->>'id', '')::uuid;
  v_client uuid := nullif(p->>'client_uuid', '')::uuid;
  v_op     uuid := nullif(p->>'op_uuid', '')::uuid;
  v_device text := p->>'device_id';
  v_fields jsonb;
  v_old    public.movements;
  v_new    public.movements;
  v_status public.mov_status;
  v_doc    uuid;
  v_out    text := 'applied';
begin
  if v_role is null then perform app.fail('forbidden', 'utente non attivo'); end if;
  if v_role = 'read_only' then perform app.fail('forbidden', 'ruolo di sola lettura'); end if;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_fields
  from jsonb_each(p)
  where key = any (array['kind','op_date','doc_date','description','amount','currency','fx_rate','account_id',
                         'to_account_id','to_amount','category_id','project_id','grant_id','counterparty_id',
                         'payment_method_id','notes','ai_extracted','no_doc_reason']);

  if v_id is null then
    -- ------------------------------------------------------------ creazione
    if v_client is null then perform app.fail('invalid', 'client_uuid mancante'); end if;
    select * into v_old from public.movements where org_id = v_org and client_uuid = v_client;
    if found then
      perform app.log_sync(v_org, v_device, v_client, 'save_movement', 'duplicate', jsonb_build_object('id', v_old.id));
      return app.result(v_old, 'duplicate');
    end if;
    v_status := coalesce(nullif(p->>'status', ''), 'draft')::public.mov_status;
    if v_status = 'verified' then perform app.fail('invalid_transition', 'la verifica si fa con verify_movement'); end if;

    v_new := jsonb_populate_record(null::public.movements, v_fields);
    if v_role = 'operator' and v_new.project_id is not null and not app.can_see_project(v_new.project_id) then
      perform app.fail('forbidden', 'progetto non assegnato');
    end if;

    insert into public.movements(org_id, client_uuid, last_op_uuid, kind, status, op_date, doc_date, description,
                                 amount, currency, fx_rate, account_id, to_account_id, to_amount, category_id,
                                 project_id, grant_id, counterparty_id, payment_method_id, notes, ai_extracted, no_doc_reason,
                                 created_by, updated_by, recorded_by, recorded_at, ref)
    values (v_org, v_client, v_op, v_new.kind, v_status, v_new.op_date, v_new.doc_date, coalesce(v_new.description, ''),
            v_new.amount, v_new.currency, v_new.fx_rate, v_new.account_id, v_new.to_account_id, v_new.to_amount,
            v_new.category_id, v_new.project_id, v_new.grant_id, v_new.counterparty_id, v_new.payment_method_id, v_new.notes,
            coalesce(v_new.ai_extracted, false), v_new.no_doc_reason,
            v_uid, v_uid,
            case when v_status = 'recorded' then v_uid end,
            case when v_status = 'recorded' then now() end,
            case when v_status = 'recorded' then app.next_ref(v_org, v_new.op_date) end)
    returning * into v_new;
  else
    -- ------------------------------------------------------------ modifica
    select * into v_old from public.movements where id = v_id and org_id = v_org for update;
    if not found or not app.can_see_movement(v_old) then perform app.fail('not_found', 'movimento'); end if;
    if v_op is not null and v_old.last_op_uuid = v_op then
      perform app.log_sync(v_org, v_device, v_old.client_uuid, 'save_movement', 'duplicate', jsonb_build_object('id', v_id));
      return app.result(v_old, 'duplicate');
    end if;
    if v_old.status = 'verified' then perform app.fail('immutable', 'movimento verificato: usare lo storno'); end if;
    if v_old.status = 'draft' and v_old.created_by <> v_uid and v_role not in ('super_admin','admin','responsabile') then
      perform app.fail('forbidden', 'bozza di un altro utente');
    end if;
    if v_old.status = 'recorded' and v_role not in ('super_admin','admin','responsabile') then
      perform app.fail('forbidden', 'solo un responsabile modifica un movimento registrato');
    end if;
    if (p->>'expected_version') is null or (p->>'expected_version')::int <> v_old.version then
      perform app.log_sync(v_org, v_device, v_old.client_uuid, 'save_movement', 'conflict',
                           jsonb_build_object('id', v_id, 'expected', p->>'expected_version', 'current', v_old.version));
      return app.result(v_old, 'conflict') || jsonb_build_object('current', to_jsonb(v_old));
    end if;

    v_status := coalesce(nullif(p->>'status', '')::public.mov_status, v_old.status);
    if v_status = 'verified' then perform app.fail('invalid_transition', 'la verifica si fa con verify_movement'); end if;
    v_new := jsonb_populate_record(v_old, v_fields);
    if v_role = 'operator' and v_new.project_id is distinct from v_old.project_id
       and v_new.project_id is not null and not app.can_see_project(v_new.project_id) then
      perform app.fail('forbidden', 'progetto non assegnato');
    end if;

    update public.movements m set
      kind = v_new.kind, status = v_status, op_date = v_new.op_date, doc_date = v_new.doc_date,
      description = coalesce(v_new.description, ''), amount = v_new.amount, currency = v_new.currency,
      fx_rate = v_new.fx_rate, account_id = v_new.account_id, to_account_id = v_new.to_account_id,
      to_amount = v_new.to_amount, category_id = v_new.category_id, project_id = v_new.project_id, grant_id = v_new.grant_id,
      counterparty_id = v_new.counterparty_id, payment_method_id = v_new.payment_method_id, notes = v_new.notes,
      ai_extracted = coalesce(v_new.ai_extracted, false), no_doc_reason = v_new.no_doc_reason,
      last_op_uuid = v_op, updated_by = v_uid,
      recorded_by = case when v_old.status = 'draft' and v_status = 'recorded' then v_uid else m.recorded_by end,
      recorded_at = case when v_old.status = 'draft' and v_status = 'recorded' then now() else m.recorded_at end,
      ref = case when m.ref is null and v_status = 'recorded' then app.next_ref(v_org, v_new.op_date) else m.ref end
    where m.id = v_id
    returning * into v_new;
  end if;

  -- documenti collegati
  if jsonb_typeof(p->'document_ids') = 'array' then
    for v_doc in select (jsonb_array_elements_text(p->'document_ids'))::uuid loop
      if not exists (select 1 from public.documents d where d.id = v_doc and d.org_id = v_org) then
        perform app.fail('not_found', 'documento');
      end if;
      insert into public.movement_documents(movement_id, document_id, org_id, created_by)
      values (v_new.id, v_doc, v_org, v_uid) on conflict do nothing;
    end loop;
  end if;

  -- alla registrazione serve il giustificativo (o il motivo per cui manca)
  if v_new.status = 'recorded' and v_new.kind <> 'transfer' and v_new.no_doc_reason is null
     and (app.setting(v_org, 'require_document', 'true'::jsonb))::text = 'true'
     and not exists (select 1 from public.movement_documents md where md.movement_id = v_new.id) then
    perform app.fail('document_required', 'allegare il giustificativo o indicare perché manca');
  end if;

  perform app.log_sync(v_org, v_device, v_new.client_uuid, 'save_movement', v_out,
                       jsonb_build_object('id', v_new.id, 'status', v_new.status));
  return app.result(v_new, v_out);
end $$;

-- Verifica (quattro occhi: chi ha creato o registrato non verifica, se l'impostazione è attiva)
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
     and (v_m.created_by = v_uid or v_m.recorded_by = v_uid) then
    perform app.fail('four_eyes', 'chi ha inserito il movimento non può verificarlo');
  end if;
  update public.movements set status = 'verified', verified_by = v_uid, verified_at = now(), updated_by = v_uid
  where id = p_id returning * into v_m;
  return app.result(v_m, 'applied');
end $$;

-- Storno: crea un movimento uguale e contrario collegato all'originale. L'originale non cambia.
create or replace function public.reverse_movement(p_id uuid, p_reason text, p_client_uuid uuid, p_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid := app.me_org(); v_m public.movements; v_r public.movements;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'serve un responsabile'); end if;
  if p_client_uuid is null then perform app.fail('invalid', 'client_uuid mancante'); end if;
  select * into v_r from public.movements where org_id = v_org and client_uuid = p_client_uuid;
  if found then return app.result(v_r, 'duplicate'); end if;
  if length(coalesce(trim(p_reason), '')) < 5 then perform app.fail('invalid', 'motivo dello storno obbligatorio'); end if;

  select * into v_m from public.movements where id = p_id and org_id = v_org for update;
  if not found then perform app.fail('not_found', 'movimento'); end if;
  if v_m.status = 'draft' then perform app.fail('invalid_transition', 'una bozza si elimina, non si storna'); end if;
  if v_m.reverses_id is not null then perform app.fail('invalid_transition', 'uno storno non si storna'); end if;
  if exists (select 1 from public.movements r where r.reverses_id = p_id) then
    perform app.fail('already_reversed', coalesce(v_m.ref, ''));
  end if;

  insert into public.movements(org_id, client_uuid, kind, status, op_date, doc_date, description, amount, currency,
                               fx_rate, account_id, to_account_id, to_amount, category_id, project_id, grant_id, counterparty_id,
                               payment_method_id, notes, reverses_id, reversal_reason,
                               created_by, updated_by, recorded_by, recorded_at, ref)
  values (v_org, p_client_uuid, v_m.kind, 'recorded', coalesce(p_date, current_date), v_m.doc_date,
          left('Storno ' || v_m.ref || ' · ' || v_m.description, 500), v_m.amount, v_m.currency, v_m.fx_rate,
          v_m.account_id, v_m.to_account_id, v_m.to_amount, v_m.category_id, v_m.project_id, v_m.grant_id, v_m.counterparty_id,
          v_m.payment_method_id, v_m.notes, v_m.id, trim(p_reason),
          v_uid, v_uid, v_uid, now(), app.next_ref(v_org, coalesce(p_date, current_date)))
  returning * into v_r;
  return app.result(v_r, 'applied');
end $$;

-- Elimina una bozza (solo bozze; resta traccia nel registro delle modifiche)
create or replace function public.discard_draft(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid := app.me_org(); v_m public.movements;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_m from public.movements where id = p_id and org_id = v_org for update;
  if not found then return jsonb_build_object('outcome', 'duplicate', 'id', p_id); end if;   -- già eliminata
  if v_m.status <> 'draft' then perform app.fail('immutable', 'solo le bozze si eliminano'); end if;
  if v_m.created_by <> v_uid and not app.has_role('super_admin','admin','responsabile') then
    perform app.fail('forbidden', 'bozza di un altro utente');
  end if;
  delete from public.movements where id = p_id;
  return jsonb_build_object('outcome', 'applied', 'id', p_id);
end $$;

-- Possibili doppioni: stesso importo e valuta, date vicine, stesso conto o stessa controparte.
-- SECURITY INVOKER: l'utente vede solo ciò che la RLS gli consente.
create or replace function public.find_duplicates(p jsonb)
returns table (id uuid, ref text, op_date date, amount numeric, currency char(3), description text,
               status public.mov_status, same_account boolean, same_counterparty boolean)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.ref, m.op_date, m.amount, m.currency, m.description, m.status,
         m.account_id = nullif(p->>'account_id', '')::uuid,
         m.counterparty_id is not null and m.counterparty_id = nullif(p->>'counterparty_id', '')::uuid
  from public.movements m
  where m.org_id = app.me_org()
    and m.amount = (p->>'amount')::numeric
    and m.currency = p->>'currency'
    and m.op_date between (p->>'op_date')::date - coalesce((p->>'days')::int, 3)
                      and (p->>'op_date')::date + coalesce((p->>'days')::int, 3)
    and m.id is distinct from nullif(p->>'exclude_id', '')::uuid
    and m.reverses_id is null
    and not exists (select 1 from public.movements r where r.reverses_id = m.id)
    and (m.account_id = nullif(p->>'account_id', '')::uuid
         or (m.counterparty_id is not null and m.counterparty_id = nullif(p->>'counterparty_id', '')::uuid))
  order by abs(m.op_date - (p->>'op_date')::date), m.created_at
  limit 10
$$;

-- ================================================================ documenti
-- Registra un file già caricato nello Storage (percorso <org_id>/...). Stesso file = stesso SHA-256:
-- non si crea un secondo documento, si restituisce quello esistente.
create or replace function public.register_document(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid := app.me_org(); v_d public.documents; v_n int;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  if nullif(p->>'client_uuid', '') is null then perform app.fail('invalid', 'client_uuid mancante'); end if;
  select * into v_d from public.documents where org_id = v_org and client_uuid = (p->>'client_uuid')::uuid;
  if found then return jsonb_build_object('outcome', 'duplicate', 'id', v_d.id); end if;
  select * into v_d from public.documents where org_id = v_org and sha256 = lower(p->>'sha256');
  if found then
    select count(*) into v_n from public.movement_documents md where md.document_id = v_d.id;
    return jsonb_build_object('outcome', 'duplicate_file', 'id', v_d.id, 'linked_movements', v_n,
                              'uploaded_at', v_d.created_at);
  end if;
  if coalesce(p->>'original_path', '') not like v_org::text || '/%' then
    perform app.fail('invalid', 'percorso del file fuori dalla cartella dell''ente');
  end if;
  insert into public.documents(org_id, client_uuid, doc_type, doc_date, doc_number, total, currency, counterparty_id,
                               original_path, enhanced_path, pdf_path, sha256, mime, file_name, size_bytes, pages, uploaded_by)
  values (v_org, (p->>'client_uuid')::uuid, coalesce(nullif(p->>'doc_type', ''), 'receipt'),
          nullif(p->>'doc_date', '')::date, nullif(p->>'doc_number', ''), nullif(p->>'total', '')::numeric,
          nullif(p->>'currency', ''), nullif(p->>'counterparty_id', '')::uuid,
          p->>'original_path', nullif(p->>'enhanced_path', ''), nullif(p->>'pdf_path', ''),
          lower(p->>'sha256'), coalesce(nullif(p->>'mime', ''), 'application/octet-stream'), left(nullif(p->>'file_name', ''), 255),
          nullif(p->>'size_bytes', '')::bigint, nullif(p->>'pages', '')::int, v_uid)
  returning * into v_d;
  return jsonb_build_object('outcome', 'applied', 'id', v_d.id, 'version', v_d.version);
end $$;

-- Aggiorna dati descrittivi, file derivati ed estrazione IA di un documento.
create or replace function public.update_document(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid := app.me_org(); v_d public.documents; v_n public.documents; v_f jsonb;
begin
  select * into v_d from public.documents where id = nullif(p->>'id', '')::uuid and org_id = v_org for update;
  if not found then perform app.fail('not_found', 'documento'); end if;
  if not (app.has_role('super_admin','admin','responsabile')
          or (v_d.uploaded_by = v_uid and not app.has_role('read_only')
              and not exists (select 1 from public.movement_documents md join public.movements m on m.id = md.movement_id
                              where md.document_id = v_d.id and m.status <> 'draft'))) then
    perform app.fail('forbidden', 'documento già usato in un movimento registrato');
  end if;
  if (p->>'expected_version') is not null and (p->>'expected_version')::int <> v_d.version then
    return jsonb_build_object('outcome', 'conflict', 'id', v_d.id, 'version', v_d.version);
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_f from jsonb_each(p)
  where key = any (array['doc_type','doc_date','doc_number','total','currency','counterparty_id',
                         'enhanced_path','pdf_path','extraction','extraction_model']);
  v_n := jsonb_populate_record(v_d, v_f);
  update public.documents set doc_type = v_n.doc_type, doc_date = v_n.doc_date, doc_number = v_n.doc_number,
    total = v_n.total, currency = v_n.currency, counterparty_id = v_n.counterparty_id,
    enhanced_path = v_n.enhanced_path, pdf_path = v_n.pdf_path, extraction = v_n.extraction,
    extraction_model = v_n.extraction_model,
    extraction_at = case when v_f ? 'extraction' then now() else extraction_at end
  where id = v_d.id returning * into v_n;
  return jsonb_build_object('outcome', 'applied', 'id', v_n.id, 'version', v_n.version);
end $$;

-- ================================================================ periodi
create or replace function public.close_period(p_year int, p_month int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_n int;
begin
  if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'serve un amministratore'); end if;
  select count(*) into v_n from public.movements
  where org_id = v_org and status = 'recorded'
    and extract(year from op_date) = p_year and extract(month from op_date) = p_month
    and not exists (select 1 from public.movements r where r.reverses_id = movements.id);
  if v_n > 0 then perform app.fail('unverified_movements', v_n || ' movimenti da verificare'); end if;
  insert into public.periods(org_id, year, month, closed_at, closed_by)
  values (v_org, p_year, p_month, now(), auth.uid())
  on conflict (org_id, year, month) do update set closed_at = now(), closed_by = auth.uid();
  return jsonb_build_object('outcome', 'applied', 'year', p_year, 'month', p_month);
end $$;

create or replace function public.reopen_period(p_year int, p_month int) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin') then perform app.fail('forbidden', 'serve il super amministratore'); end if;
  update public.periods set closed_at = null, closed_by = auth.uid()
  where org_id = app.me_org() and year = p_year and month = p_month;
  return jsonb_build_object('outcome', 'applied', 'year', p_year, 'month', p_month);
end $$;

-- ================================================================ utenti
create or replace function app.check_admin_target(p_user uuid) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare t public.profiles;
begin
  if not app.has_role('super_admin','admin') then perform app.fail('forbidden', 'serve un amministratore'); end if;
  if p_user = auth.uid() then perform app.fail('forbidden', 'non si modifica il proprio accesso'); end if;
  select * into t from public.profiles where id = p_user and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'utente'); end if;
  if t.role = 'super_admin' and not app.has_role('super_admin') then
    perform app.fail('forbidden', 'solo un super amministratore modifica un super amministratore');
  end if;
  return t;
end $$;

create or replace function app.ensure_super_admin(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where org_id = p_org and role = 'super_admin' and active) then
    perform app.fail('last_super_admin', 'deve restare almeno un super amministratore attivo');
  end if;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.app_role) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.profiles := app.check_admin_target(p_user);
begin
  if p_role = 'super_admin' and not app.has_role('super_admin') then
    perform app.fail('forbidden', 'solo un super amministratore assegna questo ruolo');
  end if;
  update public.profiles set role = p_role where id = p_user;
  perform app.ensure_super_admin(t.org_id);
  return jsonb_build_object('outcome', 'applied', 'id', p_user, 'role', p_role);
end $$;

create or replace function public.admin_set_active(p_user uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.profiles := app.check_admin_target(p_user);
begin
  update public.profiles set active = p_active where id = p_user;
  perform app.ensure_super_admin(t.org_id);
  return jsonb_build_object('outcome', 'applied', 'id', p_user, 'active', p_active);
end $$;

create or replace function public.admin_set_projects(p_user uuid, p_all boolean, p_projects uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.profiles := app.check_admin_target(p_user);
begin
  if exists (select 1 from unnest(coalesce(p_projects, '{}')) x
             where not exists (select 1 from public.projects pr where pr.id = x and pr.org_id = t.org_id)) then
    perform app.fail('invalid', 'progetto di un altro ente');
  end if;
  update public.profiles set all_projects = coalesce(p_all, false) where id = p_user;
  delete from public.project_members where user_id = p_user and project_id <> all (coalesce(p_projects, '{}'));
  insert into public.project_members(org_id, project_id, user_id)
  select t.org_id, x, p_user from unnest(coalesce(p_projects, '{}')) x on conflict do nothing;
  return jsonb_build_object('outcome', 'applied', 'id', p_user);
end $$;

-- Nomi degli utenti dell'ente (per mostrare chi ha inserito un movimento). Email solo agli amministratori.
create or replace function public.user_directory()
returns table (id uuid, full_name text, role public.app_role, active boolean, email text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.role, p.active,
         case when app.has_role('super_admin','admin') then p.email end
  from public.profiles p
  where p.org_id = app.me_org() and app.me_role() is not null
  order by p.full_name
$$;

-- Storico di un movimento per chi può vederlo
create or replace function public.movement_history(p_id uuid)
returns table (at timestamptz, action text, actor uuid, old_row jsonb, new_row jsonb)
language sql stable security definer set search_path = '' as $$
  select a.at, a.action, a.actor, a.old_row, a.new_row
  from public.audit_log a
  where a.table_name = 'movements' and a.row_id = p_id::text
    and exists (select 1 from public.movements m where m.id = p_id and app.can_see_movement(m))
  order by a.at, a.id
$$;

-- ================================================================ privilegi sulle funzioni
revoke execute on all functions in schema public from public, anon;
grant execute on function public.save_movement(jsonb), public.verify_movement(uuid, int),
  public.reverse_movement(uuid, text, uuid, date), public.discard_draft(uuid), public.find_duplicates(jsonb),
  public.register_document(jsonb), public.update_document(jsonb), public.close_period(int, int),
  public.reopen_period(int, int), public.admin_set_role(uuid, public.app_role),
  public.admin_set_active(uuid, boolean), public.admin_set_projects(uuid, boolean, uuid[]),
  public.user_directory(), public.movement_history(uuid)
  to authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
-- solo le funzioni usate nelle policy RLS e nei trigger eseguiti con i diritti dell'utente
grant execute on function app.me_role(), app.me_org(), app.has_role(public.app_role[]), app.is_staff(),
  app.can_see_project(uuid), app.can_see_movement(public.movements), app.fail(text, text), app.touch()
  to authenticated;
