-- Collegamento con altre app (il futuro gestionale centrale «app madre»).
-- Un'app esterna legge i dati di YouCount con una chiave d'accesso creata da un amministratore:
-- - la chiave si vede una sola volta; nel database resta solo la sua impronta SHA-256;
-- - sola lettura, solo l'ente della chiave, niente bozze, niente dati personali delle controparti;
-- - lettura a pagine in ordine di ultima modifica (updated_at, id): l'altra app scarica solo ciò che è cambiato.

create table public.api_clients (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete restrict,
  name         text not null check (length(name) between 2 and 80),
  key_prefix   text not null,                        -- primi caratteri, per riconoscerla nell'elenco
  key_hash     text not null unique,                 -- sha256 esadecimale della chiave
  scopes       text[] not null default '{read}',
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  revoked_by   uuid references public.profiles(id)
);
alter table public.api_clients enable row level security;
create policy api_clients_select on public.api_clients for select to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin', 'admin'));
revoke all on public.api_clients from anon, authenticated;
grant select (id, org_id, name, key_prefix, scopes, created_by, created_at, last_used_at, revoked_at, revoked_by)
  on public.api_clients to authenticated;
create trigger api_clients_audit after insert or update or delete on public.api_clients
  for each row execute function app.audit();

create or replace function app.key_hash(p_key text) returns text
language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(p_key, 'UTF8')), 'hex')
$$;

-- Nuova chiave (solo amministratori). Restituita una volta sola.
create or replace function public.create_api_client(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_key text; v_id uuid;
begin
  if not app.has_role('super_admin', 'admin') then perform app.fail('forbidden', 'serve un amministratore'); end if;
  if length(trim(coalesce(p_name, ''))) < 2 then perform app.fail('invalid', 'nome della chiave mancante'); end if;
  v_key := 'yc_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.api_clients(org_id, name, key_prefix, key_hash, created_by)
  values (app.me_org(), trim(p_name), left(v_key, 10), app.key_hash(v_key), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'key', v_key);
end $$;

create or replace function public.revoke_api_client(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin', 'admin') then perform app.fail('forbidden', 'serve un amministratore'); end if;
  update public.api_clients set revoked_at = now(), revoked_by = auth.uid()
  where id = p_id and org_id = app.me_org() and revoked_at is null;
  if not found then perform app.fail('not_found', 'chiave'); end if;
end $$;

-- Lettura per le app collegate. p_entity: movements | documents | accounts | categories | projects | grants | counterparties.
-- Pagina successiva: p_since = next.since, p_after = next.after della risposta precedente.
create or replace function public.api_read(p_key text, p_entity text, p_since timestamptz default null,
                                           p_after uuid default null, p_limit int default 500) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.api_clients; v_lim int := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  v_after uuid := coalesce(p_after, '00000000-0000-0000-0000-000000000000'::uuid);
  v_items jsonb;
begin
  select * into v_c from public.api_clients where key_hash = app.key_hash(coalesce(p_key, '')) and revoked_at is null;
  if not found then perform app.fail('unauthorized', 'chiave non valida o revocata'); end if;
  if not ('read' = any (v_c.scopes)) then perform app.fail('forbidden', 'chiave senza permesso di lettura'); end if;
  update public.api_clients set last_used_at = now() where id = v_c.id and (last_used_at is null or last_used_at < now() - interval '5 minutes');

  if p_entity = 'movements' then
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select m.id, m.ref, m.kind, m.status, m.op_date, m.doc_date, m.description, m.amount, m.currency, m.fx_rate, m.amount_eur,
             m.sign, m.account_id, m.to_account_id, m.to_amount, m.category_id, c.code as category_code, m.project_id, m.grant_id,
             m.counterparty_id, m.payment_method_id, m.paid_by, m.reimb_status, m.reverses_id, m.reversal_reason, m.no_doc_reason,
             (select coalesce(jsonb_agg(md.document_id order by md.seq), '[]') from public.movement_documents md where md.movement_id = m.id) as document_ids,
             m.created_at, m.recorded_at, m.verified_at, m.updated_at
      from public.movements m left join public.categories c on c.id = m.category_id
      where m.org_id = v_c.org_id and m.status <> 'draft' and (m.updated_at, m.id) > (v_since, v_after)
      order by m.updated_at, m.id limit v_lim) x;
  elsif p_entity = 'documents' then
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select d.id, d.doc_type, d.doc_date, d.doc_number, d.total, d.currency, d.counterparty_id, d.file_name, d.mime, d.size_bytes,
             d.pages, d.sha256, d.original_path, d.pdf_path, d.created_at, d.updated_at
      from public.documents d where d.org_id = v_c.org_id and (d.updated_at, d.id) > (v_since, v_after)
      order by d.updated_at, d.id limit v_lim) x;
  elsif p_entity = 'accounts' then
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select a.id, a.code, a.name_it, a.name_fr, a.currency, a.location, a.kind, a.opening_balance, a.opening_date, a.active, a.updated_at
      from public.accounts a where a.org_id = v_c.org_id and (a.updated_at, a.id) > (v_since, v_after)
      order by a.updated_at, a.id limit v_lim) x;
  elsif p_entity = 'categories' then
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select c.id, c.code, c.name_it, c.name_fr, c.direction, c.group_id, c.report_line_key, c.active, c.updated_at
      from public.categories c where c.org_id = v_c.org_id and (c.updated_at, c.id) > (v_since, v_after)
      order by c.updated_at, c.id limit v_lim) x;
  elsif p_entity = 'projects' then
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select p.id, p.code, p.name, p.kind, p.active, p.start_date, p.end_date, p.updated_at
      from public.projects p where p.org_id = v_c.org_id and (p.updated_at, p.id) > (v_since, v_after)
      order by p.updated_at, p.id limit v_lim) x;
  elsif p_entity = 'grants' then
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select g.id, g.title, g.code, g.donor_id, g.project_id, g.amount, g.currency, g.start_date, g.end_date, g.status, g.updated_at
      from public.grants g where g.org_id = v_c.org_id and (g.updated_at, g.id) > (v_since, v_after)
      order by g.updated_at, g.id limit v_lim) x;
  elsif p_entity = 'counterparties' then
    -- solo i dati pubblici: codice fiscale, IBAN, contatti restano in YouCount
    select coalesce(jsonb_agg(x order by x.updated_at, x.id), '[]') into v_items from (
      select k.id, k.name, k.kind, k.vat_number, k.country, k.active, k.updated_at
      from public.counterparties k where k.org_id = v_c.org_id and (k.updated_at, k.id) > (v_since, v_after)
      order by k.updated_at, k.id limit v_lim) x;
  else
    perform app.fail('invalid', 'entità sconosciuta');
  end if;

  return jsonb_build_object('entity', p_entity, 'org_id', v_c.org_id, 'count', jsonb_array_length(v_items), 'items', v_items,
    'next', case when jsonb_array_length(v_items) = v_lim
      then jsonb_build_object('since', v_items -> -1 ->> 'updated_at', 'after', v_items -> -1 ->> 'id') end);
end $$;

revoke all on function public.create_api_client(text), public.revoke_api_client(uuid), public.api_read(text, text, timestamptz, uuid, int)
  from public, anon;
grant execute on function public.create_api_client(text), public.revoke_api_client(uuid) to authenticated;
-- l'app collegata non ha un utente: si identifica solo con la chiave
grant execute on function public.api_read(text, text, timestamptz, uuid, int) to anon, authenticated;
