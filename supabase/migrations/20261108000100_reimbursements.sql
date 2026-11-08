-- Chi ha pagato e rimborsi.
-- paid_by: chi ha speso materialmente (persona), distinto da chi registra (created_by).
-- Spesa pagata di tasca propria: reimb_status = 'due', resta bozza senza conto (non tocca saldi né rendiconto).
-- Il rimborso (reimburse_expenses) sceglie conto e data: la spesa diventa registrata alla data del rimborso,
-- cioè alla data di cassa (rendiconto per cassa), riceve il numero MOV e da lì segue il percorso normale.
-- È la regola del Gestionale: rimborso dovuto → bozza; rimborso pagato → data di cassa = data del rimborso.

alter table public.movements
  add column paid_by       text check (paid_by is null or length(paid_by) between 1 and 120),
  add column reimb_status  text check (reimb_status in ('due', 'paid')),
  add column reimbursed_at timestamptz,
  add column reimbursed_by uuid references public.profiles(id),
  add column reimb_batch   uuid;
alter table public.movements alter column account_id drop not null;
alter table public.movements add constraint movements_account_or_due
  check (account_id is not null or (status = 'draft' and reimb_status = 'due'));
alter table public.movements add constraint movements_due_is_expense_draft
  check (reimb_status is distinct from 'due' or (kind = 'expense' and status = 'draft'));
create index movements_reimb_due on public.movements(org_id, paid_by) where reimb_status = 'due';
create index movements_reimb_batch on public.movements(reimb_batch) where reimb_batch is not null;

create or replace function app.movements_validate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.accounts; ta public.accounts; c public.categories; v_org uuid;
begin
  -- spesa pagata di tasca propria, in attesa di rimborso: nessun conto finché non si rimborsa
  if new.account_id is not null then
    select * into a from public.accounts where id = new.account_id;
    if a.org_id <> new.org_id then perform app.fail('invalid', 'conto di un altro ente'); end if;
    if a.currency <> new.currency then
      perform app.fail('currency_mismatch', format('il conto %s è in %s, il movimento in %s', a.code, a.currency, new.currency));
    end if;
    if not a.active and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
      perform app.fail('invalid', 'conto disattivato');
    end if;
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

-- Campi accettati in p: come prima, più paid_by e reimb_status ('due' per una spesa da rimborsare).
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
                         'payment_method_id','notes','ai_extracted','no_doc_reason','paid_by','reimb_status']);
  if (v_fields->>'reimb_status') is not null and v_fields->>'reimb_status' <> 'due' then
    perform app.fail('invalid', 'il rimborso si registra con reimburse_expenses');
  end if;

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
                                 paid_by, reimb_status, created_by, updated_by, recorded_by, recorded_at, ref)
    values (v_org, v_client, v_op, v_new.kind, v_status, v_new.op_date, v_new.doc_date, coalesce(v_new.description, ''),
            v_new.amount, v_new.currency, v_new.fx_rate, v_new.account_id, v_new.to_account_id, v_new.to_amount,
            v_new.category_id, v_new.project_id, v_new.grant_id, v_new.counterparty_id, v_new.payment_method_id, v_new.notes,
            coalesce(v_new.ai_extracted, false), v_new.no_doc_reason,
            nullif(trim(v_new.paid_by), ''), v_new.reimb_status, v_uid, v_uid,
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
      paid_by = nullif(trim(v_new.paid_by), ''),
      reimb_status = case when m.reimb_status = 'paid' then 'paid' else v_new.reimb_status end,
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

-- Rimborso di una o più spese pagate di tasca propria (anche di persone diverse; una valuta per volta,
-- quella del conto da cui si paga). p: ids[] (spese da rimborsare), account_id, date, client_batch (uuid generato sul
-- dispositivo: un reinvio non rimborsa due volte), payment_method_id (facoltativo).
-- Solo responsabili e amministratori. Ogni spesa diventa registrata con data = data del rimborso.
create or replace function public.reimburse_expenses(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_org uuid := app.me_org();
  v_batch uuid := nullif(p->>'client_batch', '')::uuid;
  v_acc public.accounts; v_date date := nullif(p->>'date', '')::date;
  v_id uuid; v_m public.movements; v_n int := 0; v_total numeric := 0; v_refs text[] := '{}';
begin
  if not app.has_role('super_admin', 'admin', 'responsabile') then perform app.fail('forbidden', 'serve un responsabile'); end if;
  if v_batch is null then perform app.fail('invalid', 'client_batch mancante'); end if;
  if exists (select 1 from public.movements where org_id = v_org and reimb_batch = v_batch) then
    select count(*), coalesce(sum(amount), 0), array_agg(ref order by ref) into v_n, v_total, v_refs
    from public.movements where org_id = v_org and reimb_batch = v_batch;
    return jsonb_build_object('outcome', 'duplicate', 'batch', v_batch, 'count', v_n, 'total', v_total, 'refs', v_refs);
  end if;
  if v_date is null then perform app.fail('invalid', 'data del rimborso mancante'); end if;
  select * into v_acc from public.accounts where id = nullif(p->>'account_id', '')::uuid and org_id = v_org;
  if not found then perform app.fail('not_found', 'conto'); end if;
  if jsonb_typeof(p->'ids') <> 'array' or jsonb_array_length(p->'ids') = 0 then perform app.fail('invalid', 'nessuna spesa scelta'); end if;

  for v_id in select (jsonb_array_elements_text(p->'ids'))::uuid order by 1 loop
    select * into v_m from public.movements where id = v_id and org_id = v_org for update;
    if not found then perform app.fail('not_found', 'spesa da rimborsare'); end if;
    if v_m.reimb_status is distinct from 'due' then perform app.fail('invalid_transition', 'spesa non da rimborsare o già rimborsata'); end if;
    if v_m.currency <> v_acc.currency then
      perform app.fail('currency_mismatch', format('la spesa è in %s, il conto %s in %s', v_m.currency, v_acc.code, v_acc.currency));
    end if;
    update public.movements m set
      account_id = v_acc.id, op_date = v_date, status = 'recorded', reimb_status = 'paid',
      payment_method_id = coalesce(nullif(p->>'payment_method_id', '')::uuid, m.payment_method_id),
      reimbursed_at = now(), reimbursed_by = v_uid, reimb_batch = v_batch, updated_by = v_uid,
      recorded_by = v_uid, recorded_at = now(), ref = app.next_ref(v_org, v_date)
    where m.id = v_id returning * into v_m;
    -- come alla registrazione: serve il giustificativo o il motivo per cui manca
    if v_m.no_doc_reason is null and (app.setting(v_org, 'require_document', 'true'::jsonb))::text = 'true'
       and not exists (select 1 from public.movement_documents md where md.movement_id = v_m.id) then
      perform app.fail('document_required', format('%s: allegare il giustificativo o indicare perché manca', coalesce(nullif(v_m.description, ''), 'spesa')));
    end if;
    v_n := v_n + 1; v_total := v_total + v_m.amount; v_refs := v_refs || v_m.ref;
  end loop;
  perform app.log_sync(v_org, p->>'device_id', v_batch, 'reimburse_expenses', 'applied',
                       jsonb_build_object('count', v_n, 'total', v_total, 'account', v_acc.code));
  return jsonb_build_object('outcome', 'applied', 'batch', v_batch, 'count', v_n, 'total', v_total, 'refs', v_refs);
end $$;
revoke all on function public.reimburse_expenses(jsonb) from public, anon;
grant execute on function public.reimburse_expenses(jsonb) to authenticated;
