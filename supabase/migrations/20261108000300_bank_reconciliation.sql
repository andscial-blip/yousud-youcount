-- Riconciliazione bancaria (spunta dell'estratto conto).
-- Per un conto (banca, mobile money, altro) si indica data e saldo dell'estratto e si spuntano i movimenti
-- che compaiono sull'estratto. Si conferma solo se: saldo dell'ultima riconciliazione + movimenti spuntati = saldo
-- dell'estratto, al centesimo. I movimenti non spuntati (es. assegni non ancora incassati) restano per la volta dopo.
-- Un giroconto tocca due conti: ogni lato si spunta sul proprio conto (side = 'from' | 'to').
-- Un movimento spuntato non cambia più importo, conto, data né stato; si può annullare solo l'ultima riconciliazione.

create table public.bank_reconciliations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete restrict,
  account_id        uuid not null references public.accounts(id),
  client_uuid       uuid not null,
  statement_date    date not null,
  statement_balance numeric(16,2) not null,
  previous_balance  numeric(16,2) not null,          -- saldo riconciliato prima di questa
  items_count       integer not null,
  notes             text check (notes is null or length(notes) <= 1000),
  reconciled_by     uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles(id),
  cancel_reason     text check (cancel_reason is null or length(cancel_reason) between 5 and 500),
  check ((cancelled_at is null) = (cancelled_by is null) and (cancelled_at is null) = (cancel_reason is null)),
  unique (org_id, client_uuid)
);
create index bank_rec_account_idx on public.bank_reconciliations(account_id, statement_date desc) where cancelled_at is null;

create table public.reconciliation_items (
  reconciliation_id uuid not null references public.bank_reconciliations(id),
  movement_id       uuid not null references public.movements(id),
  side              text not null check (side in ('from', 'to')),
  org_id            uuid not null references public.organizations(id),
  amount            numeric(16,2) not null,          -- effetto sul conto, con segno
  primary key (movement_id, side)
);
create index rec_items_rec_idx on public.reconciliation_items(reconciliation_id);

alter table public.bank_reconciliations enable row level security;
alter table public.reconciliation_items enable row level security;
create policy bank_rec_select on public.bank_reconciliations for select to authenticated using (org_id = app.me_org());
create policy rec_items_select on public.reconciliation_items for select to authenticated using (org_id = app.me_org());
revoke all on public.bank_reconciliations, public.reconciliation_items from anon, authenticated;
grant select on public.bank_reconciliations, public.reconciliation_items to authenticated;
-- scrittura solo tramite reconcile_account / cancel_reconciliation

create trigger bank_reconciliations_audit after insert or update or delete on public.bank_reconciliations
  for each row execute function app.audit();

-- effetto di un lato di movimento sul conto (positivo = entra)
create or replace function app.leg_amount(m public.movements, p_side text) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when p_side = 'to' then m.to_amount * m.sign
    when m.kind = 'income' then m.amount * m.sign
    else -m.amount * m.sign end
$$;

-- movimenti con lato su un conto, con stato di spunta
create or replace function public.account_legs(p_account uuid)
returns table (movement_id uuid, side text, ref text, op_date date, description text, kind public.mov_kind,
               status public.mov_status, amount numeric, reconciliation_id uuid, statement_date date)
language sql stable security definer set search_path = '' as $$
  select m.id, l.side, m.ref, m.op_date, m.description, m.kind, m.status, app.leg_amount(m, l.side),
         ri.reconciliation_id, br.statement_date
  from public.movements m
  cross join lateral (values ('from'), ('to')) as l(side)
  left join public.reconciliation_items ri on ri.movement_id = m.id and ri.side = l.side
  left join public.bank_reconciliations br on br.id = ri.reconciliation_id
  where m.org_id = app.me_org() and m.status <> 'draft'
    and app.has_role('super_admin', 'admin', 'responsabile', 'read_only')
    and ((l.side = 'from' and m.account_id = p_account) or (l.side = 'to' and m.kind = 'transfer' and m.to_account_id = p_account))
  order by m.op_date, m.ref
$$;

-- saldo riconciliato di un conto: saldo iniziale + lati spuntati in riconciliazioni non annullate
create or replace function app.reconciled_balance(p_account uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select a.opening_balance + coalesce((
    select sum(ri.amount) from public.reconciliation_items ri
    join public.bank_reconciliations br on br.id = ri.reconciliation_id and br.cancelled_at is null
    where br.account_id = p_account), 0)
  from public.accounts a where a.id = p_account
$$;

-- p: account_id, statement_date, statement_balance, client_uuid, notes?, items: [{movement_id, side}]
create or replace function public.reconcile_account(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_org uuid := app.me_org();
  v_client uuid := nullif(p->>'client_uuid', '')::uuid;
  v_acc public.accounts; v_date date := nullif(p->>'statement_date', '')::date;
  v_stmt numeric := nullif(p->>'statement_balance', '')::numeric;
  v_prev numeric; v_last date; v_sum numeric := 0; v_n int := 0;
  v_it jsonb; v_m public.movements; v_side text; v_amt numeric; v_rec public.bank_reconciliations;
begin
  if not app.has_role('super_admin', 'admin', 'responsabile') then perform app.fail('forbidden', 'serve un responsabile'); end if;
  if v_client is null then perform app.fail('invalid', 'client_uuid mancante'); end if;
  select * into v_rec from public.bank_reconciliations where org_id = v_org and client_uuid = v_client;
  if found then
    return jsonb_build_object('outcome', 'duplicate', 'id', v_rec.id, 'count', v_rec.items_count);
  end if;
  select * into v_acc from public.accounts where id = nullif(p->>'account_id', '')::uuid and org_id = v_org for update;
  if not found then perform app.fail('not_found', 'conto'); end if;
  if v_acc.kind = 'cash' then perform app.fail('invalid', 'per la cassa si usa la conta di cassa'); end if;
  if v_date is null or v_stmt is null then perform app.fail('invalid', 'data e saldo dell''estratto sono obbligatori'); end if;
  if v_date > current_date then perform app.fail('invalid', 'data dell''estratto nel futuro'); end if;
  if v_stmt <> round(v_stmt, 2) then perform app.fail('invalid', 'saldo dell''estratto con più di due decimali'); end if;
  select max(statement_date) into v_last from public.bank_reconciliations
  where account_id = v_acc.id and cancelled_at is null;
  if v_last is not null and v_date < v_last then
    perform app.fail('invalid', format('esiste già una riconciliazione al %s: la data deve essere successiva', to_char(v_last, 'DD/MM/YYYY')));
  end if;
  v_prev := app.reconciled_balance(v_acc.id);

  insert into public.bank_reconciliations(org_id, account_id, client_uuid, statement_date, statement_balance,
                                          previous_balance, items_count, notes, reconciled_by)
  values (v_org, v_acc.id, v_client, v_date, v_stmt, v_prev, 0, nullif(trim(p->>'notes'), ''), v_uid)
  returning * into v_rec;

  if jsonb_typeof(p->'items') = 'array' then
    for v_it in select * from jsonb_array_elements(p->'items') loop
      v_side := coalesce(v_it->>'side', 'from');
      select * into v_m from public.movements where id = (v_it->>'movement_id')::uuid and org_id = v_org;
      if not found then perform app.fail('not_found', 'movimento'); end if;
      if v_m.status = 'draft' then perform app.fail('invalid', 'una bozza non si spunta'); end if;
      if not ((v_side = 'from' and v_m.account_id = v_acc.id)
              or (v_side = 'to' and v_m.kind = 'transfer' and v_m.to_account_id = v_acc.id)) then
        perform app.fail('invalid', format('%s non è un movimento di questo conto', coalesce(v_m.ref, 'movimento')));
      end if;
      if v_m.op_date > v_date then
        perform app.fail('invalid', format('%s ha data successiva all''estratto', v_m.ref));
      end if;
      if exists (select 1 from public.reconciliation_items ri where ri.movement_id = v_m.id and ri.side = v_side) then
        perform app.fail('invalid_transition', format('%s è già spuntato', v_m.ref));
      end if;
      v_amt := app.leg_amount(v_m, v_side);
      insert into public.reconciliation_items(reconciliation_id, movement_id, side, org_id, amount)
      values (v_rec.id, v_m.id, v_side, v_org, v_amt);
      v_sum := v_sum + v_amt; v_n := v_n + 1;
    end loop;
  end if;

  if v_prev + v_sum <> v_stmt then
    perform app.fail('unbalanced', format('saldo riconciliato %s + spuntati %s = %s, estratto %s: differenza %s',
      to_char(v_prev, 'FM999G999G999G990D00'), to_char(v_sum, 'FM999G999G999G990D00'),
      to_char(v_prev + v_sum, 'FM999G999G999G990D00'), to_char(v_stmt, 'FM999G999G999G990D00'),
      to_char(v_stmt - v_prev - v_sum, 'FM999G999G999G990D00')));
  end if;
  update public.bank_reconciliations set items_count = v_n where id = v_rec.id;
  perform app.log_sync(v_org, p->>'device_id', v_client, 'reconcile_account', 'applied',
                       jsonb_build_object('id', v_rec.id, 'account', v_acc.code, 'count', v_n));
  return jsonb_build_object('outcome', 'applied', 'id', v_rec.id, 'count', v_n, 'previous', v_prev, 'balance', v_stmt);
end $$;

-- Annulla l'ultima riconciliazione di un conto (resta nello storico come annullata). Solo amministratori.
create or replace function public.cancel_reconciliation(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rec public.bank_reconciliations;
begin
  if not app.has_role('super_admin', 'admin') then perform app.fail('forbidden', 'serve un amministratore'); end if;
  select * into v_rec from public.bank_reconciliations where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'riconciliazione'); end if;
  if v_rec.cancelled_at is not null then perform app.fail('invalid_transition', 'già annullata'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indicare il motivo (almeno 5 caratteri)'); end if;
  if exists (select 1 from public.bank_reconciliations b where b.account_id = v_rec.account_id and b.cancelled_at is null
             and (b.statement_date, b.created_at) > (v_rec.statement_date, v_rec.created_at)) then
    perform app.fail('invalid', 'si annulla solo l''ultima riconciliazione del conto');
  end if;
  delete from public.reconciliation_items where reconciliation_id = v_rec.id;
  update public.bank_reconciliations set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
  where id = v_rec.id;
  return jsonb_build_object('outcome', 'applied', 'id', v_rec.id);
end $$;

-- un movimento spuntato non cambia più ciò che l'estratto ha confermato
create or replace function app.movements_reconciled_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.amount, new.account_id, new.op_date, new.currency, new.kind, new.to_account_id, new.to_amount, new.status = 'draft')
     is distinct from (old.amount, old.account_id, old.op_date, old.currency, old.kind, old.to_account_id, old.to_amount, old.status = 'draft')
     and exists (select 1 from public.reconciliation_items ri where ri.movement_id = old.id) then
    perform app.fail('reconciled', 'movimento spuntato in una riconciliazione bancaria: importo, conto, data e stato non si modificano');
  end if;
  return new;
end $$;
create trigger movements_reconciled_guard before update on public.movements
  for each row execute function app.movements_reconciled_guard();

revoke all on function public.account_legs(uuid), public.reconcile_account(jsonb), public.cancel_reconciliation(uuid, text)
  from public, anon;
grant execute on function public.account_legs(uuid), public.reconcile_account(jsonb), public.cancel_reconciliation(uuid, text)
  to authenticated;
