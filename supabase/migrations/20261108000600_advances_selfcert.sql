-- 0600 · Anticipi al personale (pocket money) e autocertificazioni di spesa (AUT)
--
-- Regola del Gestionale, riportata sul modello a conti di YouCount:
--  · ogni persona che riceve contanti ha un proprio conto di tipo «advance» (holder = nome della persona);
--  · consegna dell'anticipo = giroconto cassa/banca → conto anticipi (esce dalla cassa, non è una spesa);
--  · spesa pagata con l'anticipo = uscita dal conto anticipi: conta nel rendiconto alla data della spesa
--    e non riduce di nuovo la cassa (era già uscita alla consegna);
--  · restituzione = giroconto conto anticipi → cassa/banca;
--  · da giustificare = consegnato − speso − restituito (pocketBal del Gestionale).
--  · I conti anticipi restano fuori dai totali di liquidità del cruscotto (già così) e dalla riconciliazione.
-- Autocertificazione: dichiarazione di spesa senza giustificativo fiscale, numerata AUT-AAAA-NNN, con i dati
-- presi dal movimento (non dal dispositivo). Il PDF si firma a mano; l'app registra chi ha visto la copia firmata.
-- Il testo della dichiarazione (art. 76 DPR 445/2000) è quello del Gestionale: lo verifica il commercialista.

-- ---------------------------------------------------------------- conti anticipi per persona
alter table public.accounts add column holder text check (holder is null or length(trim(holder)) between 1 and 120);
alter table public.accounts add constraint accounts_holder_only_advance check (holder is null or kind = 'advance');

-- su un conto anticipi non si incassa: entra solo con un giroconto (consegna)
create or replace function app.movements_advance_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'income' and exists (select 1 from public.accounts a where a.id = new.account_id and a.kind = 'advance') then
    perform app.fail('invalid', 'su un conto anticipi non si registrano entrate: la consegna è un giroconto');
  end if;
  if new.reimb_status is not null and exists (select 1 from public.accounts a where a.id = new.account_id and a.kind = 'advance') then
    perform app.fail('invalid', 'un rimborso non si paga da un conto anticipi');
  end if;
  return new;
end $$;
revoke execute on function app.movements_advance_check() from public, anon, authenticated;
create trigger movements_advance_check before insert or update on public.movements
  for each row execute function app.movements_advance_check();

-- Nuova persona con anticipo: crea il suo conto (uno per valuta).
create or replace function public.create_advance_account(p_holder text, p_currency text, p_location text default 'MG')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_h text := trim(coalesce(p_holder, '')); v_code text; v_id uuid; v_sort int;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  if length(v_h) not between 1 and 120 then perform app.fail('invalid', 'nome della persona'); end if;
  if p_currency not in ('EUR','MGA') then perform app.fail('invalid', 'valuta'); end if;
  if coalesce(p_location, 'MG') not in ('IT','MG') then perform app.fail('invalid', 'luogo'); end if;
  v_code := left('Anticipi ' || v_h || ' ' || p_currency, 60);
  if exists (select 1 from public.accounts a where a.org_id = v_org and (a.code = v_code
             or (a.kind = 'advance' and lower(a.holder) = lower(v_h) and a.currency = p_currency))) then
    perform app.fail('invalid', 'esiste già un conto anticipi per questa persona in questa valuta');
  end if;
  select coalesce(max(sort), 0) + 1 into v_sort from public.accounts where org_id = v_org;
  insert into public.accounts(org_id, code, name_it, name_fr, currency, location, kind, holder, sort)
  values (v_org, v_code, 'Anticipi – ' || v_h, 'Avances – ' || v_h, p_currency, coalesce(p_location, 'MG'), 'advance', v_h, v_sort)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- ---------------------------------------------------------------- autocertificazioni
create table app.doc_counters (
  org_id uuid not null,
  kind   text not null,
  year   integer not null,
  last   integer not null default 0,
  primary key (org_id, kind, year)
);

create table public.self_certs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete restrict,
  movement_id    uuid not null unique references public.movements(id) on delete restrict,
  number         text not null,                        -- AUT-AAAA-NNN
  lang           text not null default 'it' check (lang in ('it','fr','both')),
  declarant      text not null check (length(trim(declarant)) between 1 and 120),
  declarant_role text check (declarant_role is null or length(declarant_role) <= 120),
  place          text check (place is null or length(place) <= 120),
  reason         text not null check (length(trim(reason)) between 5 and 500),
  -- dati copiati dal movimento al momento dell'emissione
  exp_date       date not null,
  amount         numeric(16,2) not null check (amount > 0),
  currency       char(3) not null check (currency in ('EUR','MGA')),
  amount_eur     numeric(16,2),
  supplier       text,
  description    text,
  category_code  text,
  category_fr    text,
  project_name   text,
  method         text,
  method_fr      text,
  signer_name    text,
  signer_role    text,
  document_id    uuid references public.documents(id) on delete restrict,
  signed_at      timestamptz,
  signed_by      uuid references public.profiles(id),
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, number),
  check ((signed_at is null) = (signed_by is null))
);
create index self_certs_doc_idx on public.self_certs(document_id) where document_id is not null;
create index self_certs_created_by_idx on public.self_certs(created_by);
create index self_certs_signed_by_idx on public.self_certs(signed_by) where signed_by is not null;

alter table public.self_certs enable row level security;
create policy self_certs_select on public.self_certs for select to authenticated
  using (org_id = (select app.me_org()) and exists (
    select 1 from public.movements m where m.id = movement_id and app.can_see_movement(m)));
grant select on public.self_certs to authenticated;

create trigger self_certs_audit after insert or update or delete on public.self_certs
  for each row execute function app.audit();

-- Emette (o, finché il PDF non è allegato, aggiorna) l'autocertificazione di una spesa.
-- p: movement_id, declarant, declarant_role, place, reason, lang.
create or replace function public.create_self_cert(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_org uuid := app.me_org();
  v_m public.movements; v_s public.self_certs; v_n int; v_year int;
  v_signer jsonb := app.setting(app.me_org(), 'doc_signer', '{}'::jsonb);
  v_sup text; v_cat text; v_cat_fr text; v_prj text; v_met text; v_met_fr text;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_m from public.movements where id = nullif(p->>'movement_id', '')::uuid and org_id = v_org for update;
  if not found or not app.can_see_movement(v_m) then perform app.fail('not_found', 'movimento'); end if;
  if v_m.kind <> 'expense' or v_m.reverses_id is not null then
    perform app.fail('invalid', 'l''autocertificazione si fa solo per una spesa');
  end if;
  if v_m.status = 'verified' then perform app.fail('immutable', 'movimento verificato'); end if;
  if length(trim(coalesce(p->>'declarant', ''))) = 0 then perform app.fail('invalid', 'manca il dichiarante'); end if;
  if length(trim(coalesce(p->>'reason', ''))) < 5 then perform app.fail('invalid', 'manca il motivo dell''assenza del giustificativo'); end if;

  select x.name into v_sup from public.counterparties x where x.id = v_m.counterparty_id;
  select c.code || ' ' || c.name_it, c.code || ' ' || coalesce(nullif(c.name_fr, ''), c.name_it) into v_cat, v_cat_fr
  from public.categories c where c.id = v_m.category_id;
  select pr.name into v_prj from public.projects pr where pr.id = v_m.project_id;
  select pm.name_it, coalesce(nullif(pm.name_fr, ''), pm.name_it) into v_met, v_met_fr
  from public.payment_methods pm where pm.id = v_m.payment_method_id;

  select * into v_s from public.self_certs where movement_id = v_m.id for update;
  if found and v_s.document_id is not null then
    perform app.fail('invalid', format('autocertificazione %s già emessa per questo movimento', v_s.number));
  end if;
  if not found then
    v_year := extract(year from v_m.op_date)::int;
    insert into app.doc_counters(org_id, kind, year, last) values (v_org, 'AUT', v_year, 1)
    on conflict (org_id, kind, year) do update set last = app.doc_counters.last + 1
    returning last into v_n;
    insert into public.self_certs(org_id, movement_id, number, declarant, reason, exp_date, amount, currency, created_by)
    values (v_org, v_m.id, 'AUT-' || v_year || '-' || lpad(v_n::text, 3, '0'), trim(p->>'declarant'), trim(p->>'reason'),
            v_m.op_date, v_m.amount, v_m.currency, v_uid)
    returning * into v_s;
  end if;

  update public.self_certs s set
    lang = coalesce(nullif(p->>'lang', ''), 'it'),
    declarant = trim(p->>'declarant'),
    declarant_role = nullif(trim(coalesce(p->>'declarant_role', '')), ''),
    place = nullif(trim(coalesce(p->>'place', '')), ''),
    reason = trim(p->>'reason'),
    exp_date = coalesce(v_m.doc_date, v_m.op_date), amount = v_m.amount, currency = v_m.currency,
    amount_eur = v_m.amount_eur, supplier = v_sup, description = nullif(v_m.description, ''),
    category_code = v_cat, category_fr = v_cat_fr, project_name = v_prj, method = v_met, method_fr = v_met_fr,
    signer_name = nullif(v_signer->>'name', ''), signer_role = nullif(v_signer->>'role', ''),
    updated_at = now()
  where s.id = v_s.id returning * into v_s;
  return to_jsonb(v_s);
end $$;

-- Collega il PDF caricato (register_document) all'autocertificazione e al movimento.
create or replace function public.attach_self_cert(p_id uuid, p_document_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_org uuid := app.me_org(); v_s public.self_certs; v_m public.movements;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_s from public.self_certs where id = p_id and org_id = v_org for update;
  if not found then perform app.fail('not_found', 'autocertificazione'); end if;
  select * into v_m from public.movements where id = v_s.movement_id;
  if not app.can_see_movement(v_m) then perform app.fail('not_found', 'movimento'); end if;
  if v_s.document_id is not null and v_s.document_id <> p_document_id then
    perform app.fail('invalid', 'autocertificazione già allegata');
  end if;
  if not exists (select 1 from public.documents d where d.id = p_document_id and d.org_id = v_org) then
    perform app.fail('not_found', 'documento');
  end if;
  update public.documents set doc_type = 'self_cert', doc_number = v_s.number, doc_date = v_s.exp_date,
         total = v_s.amount, currency = v_s.currency
  where id = p_document_id and doc_type is distinct from 'self_cert';
  update public.self_certs set document_id = p_document_id, updated_at = now() where id = v_s.id returning * into v_s;
  insert into public.movement_documents(movement_id, document_id, org_id, created_by)
  values (v_s.movement_id, p_document_id, v_org, v_uid) on conflict do nothing;
  return to_jsonb(v_s);
end $$;

-- Chi ha visto la copia firmata a mano dal dichiarante lo registra.
create or replace function public.sign_self_cert(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_s public.self_certs;
begin
  if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
  select * into v_s from public.self_certs where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'autocertificazione'); end if;
  if v_s.document_id is null then perform app.fail('invalid', 'prima si genera il PDF'); end if;
  if v_s.signed_at is null then
    update public.self_certs set signed_at = now(), signed_by = v_uid, updated_at = now() where id = p_id returning * into v_s;
  end if;
  return to_jsonb(v_s);
end $$;

-- Situazione degli anticipi per persona a una data.
-- open_since: data della consegna più vecchia non ancora coperta da spese e restituzioni (prima entrata, primo uscito).
create or replace function public.advance_summary(p_at date default current_date)
returns table (account_id uuid, code text, name_it text, name_fr text, holder text, currency char(3), active boolean,
               given numeric, spent numeric, returned numeric, balance numeric, open_since date, last_move date,
               spent_count int, spent_no_doc int, aut_to_sign int, unverified int)
language sql stable security definer set search_path = '' as $$
  with acc as (
    select a.* from public.accounts a
    where a.org_id = app.me_org() and a.kind = 'advance'
      and app.has_role('super_admin','admin','responsabile','read_only')
  ),
  mv as (
    select m.*, a.id as acc_id from public.movements m join acc a on a.id in (m.account_id, m.to_account_id)
    where m.status <> 'draft' and m.op_date <= p_at
  ),
  ins as (   -- entrate nel conto anticipi: saldo d'apertura e consegne (giroconti in arrivo)
    select a.id as acc_id, coalesce(a.opening_date, a.created_at::date) as d, a.opening_balance as amt, 0 as ord
    from acc a where a.opening_balance <> 0
    union all
    select acc_id, op_date, to_amount * sign, 1 from mv where kind = 'transfer' and to_account_id = acc_id
    union all
    select acc_id, op_date, amount * sign, 1 from mv where kind = 'income' and account_id = acc_id
  ),
  tot as (
    select a.id,
      coalesce((select sum(amount * sign) from mv where acc_id = a.id and kind = 'expense' and account_id = a.id), 0) as spent,
      coalesce((select sum(amount * sign) from mv where acc_id = a.id and kind = 'transfer' and account_id = a.id), 0) as returned,
      coalesce((select sum(to_amount * sign) from mv where acc_id = a.id and kind = 'transfer' and to_account_id = a.id), 0)
        + coalesce((select sum(amount * sign) from mv where acc_id = a.id and kind = 'income' and account_id = a.id), 0) as given
    from acc a
  ),
  cum as (
    select acc_id, d, sum(amt) over (partition by acc_id order by d, ord rows unbounded preceding) as c from ins
  )
  select a.id, a.code, a.name_it, a.name_fr, coalesce(a.holder, a.name_it), a.currency, a.active,
         t.given, t.spent, t.returned,
         a.opening_balance + t.given - t.spent - t.returned,
         case when a.opening_balance + t.given - t.spent - t.returned > 0
              then (select min(c.d) from cum c where c.acc_id = a.id and c.c > t.spent + t.returned) end,
         (select max(op_date) from mv where acc_id = a.id),
         (select count(*) from mv where acc_id = a.id and kind = 'expense' and account_id = a.id and sign = 1)::int,
         (select count(*) from mv where acc_id = a.id and kind = 'expense' and account_id = a.id and sign = 1
            and reverses_id is null and not exists (select 1 from public.movements r where r.reverses_id = mv.id)
            and not exists (select 1 from public.movement_documents md where md.movement_id = mv.id))::int,
         (select count(*) from public.self_certs s join public.movements m on m.id = s.movement_id
            where m.account_id = a.id and s.signed_at is null and s.document_id is not null)::int,
         (select count(*) from mv where acc_id = a.id and status = 'recorded')::int
  from acc a join tot t on t.id = a.id
  order by a.active desc, a.sort, a.code
$$;

revoke all on function public.create_advance_account(text, text, text), public.advance_summary(date),
  public.create_self_cert(jsonb), public.attach_self_cert(uuid, uuid), public.sign_self_cert(uuid) from public, anon;
grant execute on function public.create_advance_account(text, text, text), public.advance_summary(date),
  public.create_self_cert(jsonb), public.attach_self_cert(uuid, uuid), public.sign_self_cert(uuid) to authenticated;
