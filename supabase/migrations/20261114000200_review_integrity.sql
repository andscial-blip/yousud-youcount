-- Revisione del 14/11/2026: integrità dei movimenti dopo la verifica.
--  · uno storno nasce bloccato: importo, conti, codice, progetto, data e descrizione non si modificano più;
--    copia l'originale per intero, quindi non c'è nulla da scegliere (un errore grave resta al super amministratore);
--  · la regola dichiarata «dopo la verifica si corregge con lo storno» vale per tutti: riaprire una verifica o
--    eliminare definitivamente un movimento numerato resta solo al super amministratore, mai in un mese chiuso;
--  · la riapertura di un mese chiuso chiede il motivo, che resta nella riga del periodo e nel registro attività.

-- ---------------------------------------------------------------- protezione dei movimenti
create or replace function app.movements_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_locked text[] := array['kind','amount','currency','fx_rate','amount_eur','account_id','to_account_id','to_amount',
  'category_id','project_id','grant_id','counterparty_id','op_date','description','payment_method_id','reimb_status'];
  v_k text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not (old.demo and app.bypass()) and not app.reset_mode() then
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
  -- riapertura della verifica (funzione movement_unverify): solo verificato → registrato, nient'altro cambia
  if old.status = 'verified' and new.status = 'recorded' and coalesce(current_setting('app.unverify', true), '') = 'on' then
    new.updated_at := now();
    new.version := old.version + 1;
    return new;
  end if;
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
  -- uno storno copia l'originale e lo annulla per intero: i suoi dati contabili non si toccano
  if old.reverses_id is not null then
    foreach v_k in array v_locked loop
      if (to_jsonb(new) -> v_k) is distinct from (to_jsonb(old) -> v_k) then
        perform app.fail('immutable', 'uno storno copia l''originale e non si modifica');
      end if;
    end loop;
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

-- ---------------------------------------------------------------- riapertura della verifica: solo super amministratore
create or replace function public.movement_unverify(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_m public.movements;
begin
  if not app.has_role('super_admin') then perform app.fail('forbidden', 'solo il super amministratore riapre una verifica: gli altri correggono con lo storno'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo (almeno 5 caratteri)'); end if;
  select * into v_m from public.movements where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'movimento'); end if;
  if v_m.status <> 'verified' then perform app.fail('invalid', 'il movimento non è verificato'); end if;
  if exists (select 1 from public.movements r where r.reverses_id = v_m.id) or v_m.reverses_id is not null then
    perform app.fail('immutable', 'movimento stornato o storno: non si riapre');
  end if;
  if not app.period_open(v_m.org_id, v_m.op_date) then perform app.fail('period_closed', to_char(v_m.op_date, 'MM/YYYY')); end if;
  perform set_config('app.unverify', 'on', true);
  update public.movements set status = 'recorded', verified_by = null, verified_at = null,
    notes = left(concat_ws(E'\n', nullif(notes, ''), 'Verifica riaperta il ' || to_char(now(), 'DD/MM/YYYY') || ': ' || trim(p_reason)), 2000)
   where id = p_id;
  perform set_config('app.unverify', '', true);
  return jsonb_build_object('outcome', 'reopened', 'ref', v_m.ref);
end $$;

-- ---------------------------------------------------------------- eliminazione definitiva: solo super amministratore
create or replace function app.purge_check(p_reason text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin') then perform app.fail('forbidden', 'solo il super amministratore elimina definitivamente'); end if;
  if not app.recent_password() then perform app.fail('reauth', 'reinserisci la password per confermare'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo (almeno 5 caratteri)'); end if;
end $$;
revoke execute on function app.purge_check(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- mesi: riapertura con motivo
alter table public.periods add column if not exists reopen_reason text check (reopen_reason is null or length(reopen_reason) <= 300);

create or replace function public.reopen_period(p_year int, p_month int, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin') then perform app.fail('forbidden', 'serve il super amministratore'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo della riapertura (almeno 5 caratteri)'); end if;
  update public.periods set closed_at = null, closed_by = auth.uid(), reopen_reason = trim(p_reason)
  where org_id = app.me_org() and year = p_year and month = p_month and closed_at is not null;
  if not found then perform app.fail('not_found', 'mese chiuso'); end if;
  return jsonb_build_object('outcome', 'applied', 'year', p_year, 'month', p_month);
end $$;
revoke all on function public.reopen_period(int, int, text) from public, anon;
grant execute on function public.reopen_period(int, int, text) to authenticated;
-- la vecchia firma senza motivo non si usa più
drop function if exists public.reopen_period(int, int);
