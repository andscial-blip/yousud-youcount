-- Rimborso: messaggi chiari invece degli errori di vincolo quando alla spesa manca qualcosa
-- (codice contabile, progetto, tasso). Il tasso mancante di una spesa in ariary si prende dal mese del rimborso.
create or replace function public.reimburse_expenses(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_org uuid := app.me_org();
  v_batch uuid := nullif(p->>'client_batch', '')::uuid;
  v_acc public.accounts; v_date date := nullif(p->>'date', '')::date;
  v_id uuid; v_m public.movements; v_n int := 0; v_total numeric := 0; v_refs text[] := '{}';
  v_label text; v_rate numeric;
begin
  if not app.has_role('super_admin', 'admin', 'responsabile') then perform app.fail('forbidden', 'serve un responsabile'); end if;
  if v_batch is null then perform app.fail('invalid', 'client_batch mancante'); end if;
  if exists (select 1 from public.movements where org_id = v_org and reimb_batch = v_batch) then
    select count(*), coalesce(sum(amount), 0), array_agg(ref order by ref) into v_n, v_total, v_refs
    from public.movements where org_id = v_org and reimb_batch = v_batch;
    return jsonb_build_object('outcome', 'duplicate', 'batch', v_batch, 'count', v_n, 'total', v_total, 'refs', v_refs);
  end if;
  if v_date is null then perform app.fail('invalid', 'data del rimborso mancante'); end if;
  if v_date > current_date + 60 then perform app.fail('invalid', 'data del rimborso troppo nel futuro'); end if;
  select * into v_acc from public.accounts where id = nullif(p->>'account_id', '')::uuid and org_id = v_org;
  if not found then perform app.fail('not_found', 'conto'); end if;
  if jsonb_typeof(p->'ids') is distinct from 'array' or jsonb_array_length(p->'ids') = 0 then
    perform app.fail('invalid', 'nessuna spesa scelta');
  end if;

  for v_id in select (jsonb_array_elements_text(p->'ids'))::uuid order by 1 loop
    select * into v_m from public.movements where id = v_id and org_id = v_org for update;
    if not found then perform app.fail('not_found', 'spesa da rimborsare'); end if;
    v_label := coalesce(nullif(v_m.description, ''), 'spesa') || coalesce(' (' || v_m.paid_by || ')', '');
    if v_m.reimb_status is distinct from 'due' then perform app.fail('invalid_transition', v_label || ': non è da rimborsare o è già rimborsata'); end if;
    if v_m.currency <> v_acc.currency then
      perform app.fail('currency_mismatch', format('%s: la spesa è in %s, il conto %s in %s', v_label, v_m.currency, v_acc.code, v_acc.currency));
    end if;
    if v_m.category_id is null then perform app.fail('invalid', v_label || ': manca il codice contabile, completare la spesa'); end if;
    if v_m.project_id is null then perform app.fail('invalid', v_label || ': manca il progetto, completare la spesa'); end if;
    v_rate := v_m.fx_rate;
    if v_m.currency = 'MGA' and v_rate is null then
      select r.rate into v_rate from public.fx_rates r
      where r.org_id = v_org and (r.year, r.month) <= (extract(year from v_date)::int, extract(month from v_date)::int)
      order by r.year desc, r.month desc limit 1;
      if v_rate is null then perform app.fail('invalid', v_label || ': manca il tasso di cambio, inserirlo nella spesa o nei tassi'); end if;
    end if;

    update public.movements m set
      account_id = v_acc.id, op_date = v_date, status = 'recorded', reimb_status = 'paid', fx_rate = v_rate,
      payment_method_id = coalesce(nullif(p->>'payment_method_id', '')::uuid, m.payment_method_id),
      reimbursed_at = now(), reimbursed_by = v_uid, reimb_batch = v_batch, updated_by = v_uid,
      recorded_by = v_uid, recorded_at = now(), ref = app.next_ref(v_org, v_date)
    where m.id = v_id returning * into v_m;
    -- come alla registrazione: serve il giustificativo o il motivo per cui manca
    if v_m.no_doc_reason is null and (app.setting(v_org, 'require_document', 'true'::jsonb))::text = 'true'
       and not exists (select 1 from public.movement_documents md where md.movement_id = v_m.id) then
      perform app.fail('document_required', v_label || ': allegare il giustificativo o indicare perché manca');
    end if;
    v_n := v_n + 1; v_total := v_total + v_m.amount; v_refs := v_refs || v_m.ref;
  end loop;
  perform app.log_sync(v_org, p->>'device_id', v_batch, 'reimburse_expenses', 'applied',
                       jsonb_build_object('count', v_n, 'total', v_total, 'account', v_acc.code));
  return jsonb_build_object('outcome', 'applied', 'batch', v_batch, 'count', v_n, 'total', v_total, 'refs', v_refs);
end $$;
revoke all on function public.reimburse_expenses(jsonb) from public, anon;
grant execute on function public.reimburse_expenses(jsonb) to authenticated;
