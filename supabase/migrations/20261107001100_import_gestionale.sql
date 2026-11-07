-- 1100 · Importazione dal Gestionale (usata una volta, dallo script scripts/migrate/gestionale.mjs).
-- Riceve un blocco di movimenti in JSON e, nella stessa transazione, ricalcola un'impronta MD5 dei dati
-- effettivamente scritti: se non coincide con quella calcolata dallo script sul file del Gestionale,
-- annulla tutto il blocco. Così un errore di trasmissione non può entrare nel database.
-- Eseguibile solo dal proprietario del database (nessun permesso agli utenti dell'app).
create or replace function app.import_gestionale(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid; v_admin uuid; v_struct uuid; v_ids text[]; v_md5 text; v_n int; x jsonb; s jsonb;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  select id into v_admin from public.profiles where org_id = v_org and role = 'super_admin' and active order by created_at limit 1;
  if v_admin is null then raise exception 'manca il super amministratore'; end if;
  if exists (select 1 from public.movements where org_id = v_org and legacy_id is null) then
    raise exception 'ci sono già movimenti inseriti in YouCount: importazione fermata';
  end if;

  s := p->'setup';
  if s is not null then
    if (s->>'pocket')::boolean then
      insert into public.accounts(org_id, code, name_it, name_fr, currency, location, kind, sort)
      values (v_org, s->>'pocketCode', 'Anticipi in contanti al personale', 'Avances en espèces au personnel', 'MGA', 'MG', 'advance', 85)
      on conflict (org_id, code) do nothing;
    end if;
    for x in select * from jsonb_array_elements(coalesce(s->'openings', '[]')) loop
      update public.accounts set opening_balance = (x->>'v')::numeric, opening_date = nullif(x->>'d', '')::date
      where org_id = v_org and code = x->>'c';
      if not found then raise exception 'conto % mancante', x->>'c'; end if;
    end loop;
    for x in select * from jsonb_array_elements(coalesce(s->'projects', '[]')) loop
      if not exists (select 1 from public.projects where org_id = v_org and (legacy_name = x#>>'{}' or name = x#>>'{}')) then
        insert into public.projects(org_id, name, kind, legacy_name) values (v_org, x#>>'{}', 'project', x#>>'{}');
      end if;
    end loop;
    for x in select * from jsonb_array_elements(coalesce(s->'cps', '[]')) loop
      if not exists (select 1 from public.counterparties where org_id = v_org and lower(name) = lower(x->>'n')) then
        insert into public.counterparties(org_id, name, kind, created_by) values (v_org, x->>'n', x->>'k', v_admin);
      end if;
    end loop;
  end if;

  select id into v_struct from public.projects where org_id = v_org and kind = 'structure' order by created_at limit 1;
  for x in select * from jsonb_array_elements(coalesce(p->'movs', '[]')) loop
    insert into public.movements(id, org_id, client_uuid, ref, kind, status, op_date, doc_date, description, amount, currency, fx_rate,
      account_id, to_account_id, to_amount, category_id, project_id, counterparty_id, payment_method_id, notes, no_doc_reason, legacy_id,
      created_by, updated_by, recorded_by, recorded_at, verified_by, verified_at)
    values ((x->>'id')::uuid, v_org, (x->>'cu')::uuid, x->>'ref', (x->>'k')::public.mov_kind, (x->>'st')::public.mov_status,
      (x->>'d')::date, nullif(x->>'dd', '')::date, x->>'de', (x->>'a')::numeric, x->>'cur', nullif(x->>'r', '')::numeric,
      (select id from public.accounts where org_id = v_org and code = x->>'acc'),
      (select id from public.accounts where org_id = v_org and code = x->>'to'),
      nullif(x->>'ta', '')::numeric,
      (select id from public.categories where org_id = v_org and code = x->>'code'
         and direction = (case when x->>'k' = 'income' then 'in' else 'out' end)::public.flow_dir),
      case when x->>'prj' is null then null when (x->>'str')::boolean then v_struct
           else (select id from public.projects where org_id = v_org and (legacy_name = x->>'prj' or name = x->>'prj')
                 order by legacy_name nulls last limit 1) end,
      (select id from public.counterparties where org_id = v_org and lower(name) = lower(x->>'cp') order by created_at limit 1),
      (select id from public.payment_methods where org_id = v_org and code = x->>'pm'),
      x->>'no', x->>'nd', x->>'lid',
      v_admin, v_admin,
      case when x->>'st' <> 'draft' then v_admin end, case when x->>'st' <> 'draft' then now() end,
      case when x->>'st' = 'verified' then v_admin end, case when x->>'st' = 'verified' then now() end)
    on conflict (org_id, legacy_id) do nothing;
  end loop;

  -- impronta dei dati scritti, stessa forma calcolata dallo script
  select array_agg(e->>'lid') into v_ids from jsonb_array_elements(coalesce(p->'movs', '[]')) e;
  select md5(coalesce(string_agg(concat_ws('|', m.legacy_id, coalesce(m.ref, ''), m.kind::text, m.status::text, m.op_date::text,
            coalesce(m.doc_date::text, ''), m.description, m.amount::text, m.currency, coalesce(m.fx_rate::text, ''), a.code,
            coalesce(t.code, ''), coalesce(m.to_amount::text, ''), coalesce(c.code, ''), coalesce(pr.legacy_name, pr.name, ''),
            lower(coalesce(cp.name, '')), coalesce(pm.code, ''), coalesce(m.notes, ''), coalesce(m.no_doc_reason, '')),
            E'\n' order by m.legacy_id collate "C"), ''))
    into v_md5
  from public.movements m
  join public.accounts a on a.id = m.account_id
  left join public.accounts t on t.id = m.to_account_id
  left join public.categories c on c.id = m.category_id
  left join public.projects pr on pr.id = m.project_id
  left join public.counterparties cp on cp.id = m.counterparty_id
  left join public.payment_methods pm on pm.id = m.payment_method_id
  where m.org_id = v_org and m.legacy_id = any (coalesce(v_ids, '{}'));
  if v_md5 is distinct from p->>'md5' then
    raise exception 'impronta dei dati diversa (scritta %, attesa %): blocco annullato', v_md5, p->>'md5';
  end if;

  insert into app.ref_counters(org_id, year, last)
  select v_org, substr(ref, 5, 4)::int, max(substr(ref, 10)::int) from public.movements
  where org_id = v_org and ref ~ '^MOV-[0-9]{4}-[0-9]+$' group by 1, 2
  on conflict (org_id, year) do update set last = greatest(app.ref_counters.last, excluded.last);

  select count(*) into v_n from public.movements where org_id = v_org and legacy_id is not null;
  if p ? 'total' and v_n <> (p->>'total')::int then
    raise exception 'importati % movimenti invece di %', v_n, p->>'total';
  end if;
  return jsonb_build_object('ok', true, 'block', coalesce(jsonb_array_length(p->'movs'), 0), 'imported_total', v_n, 'md5', v_md5);
end $$;
revoke all on function app.import_gestionale(jsonb) from public, anon, authenticated;
