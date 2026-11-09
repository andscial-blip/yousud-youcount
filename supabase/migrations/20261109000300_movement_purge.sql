-- Eliminazione definitiva di movimenti (uno, alcuni o tutti), su richiesta esplicita del super amministratore.
-- In contabilità un movimento registrato si corregge con lo storno; questa è la via d'uscita per ripulire prove ed errori
-- prima dell'avvio o in casi eccezionali, con queste garanzie:
--  · solo super amministratore o amministratore;
--  · password appena reinserita (accesso con password negli ultimi 5 minuti, letto dal token: l'app la chiede ogni volta);
--  · motivo scritto; mesi chiusi esclusi; uno storno si elimina insieme al movimento stornato;
--  · ogni riga eliminata resta nel registro modifiche (audit_log) con tutti i suoi dati;
--  · per eliminare tutto: backup completo delle ultime 24 ore e numero di movimenti confermato.

create or replace function app.recent_password(p_secs int default 300) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'amr', '[]'::jsonb)) x
     where x ->> 'method' = 'password' and (x ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_secs)
$$;
revoke execute on function app.recent_password(int) from public, anon;
grant execute on function app.recent_password(int) to authenticated;

-- cancella gli id indicati e ciò che dipende da loro (abbinamenti, collegamenti a documenti); chiamata solo dalle funzioni sotto
create or replace function app.purge_movements(p_org uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  select count(*) into v_n from public.movements where org_id = p_org and id = any(p_ids);
  perform set_config('app.bypass', 'on', true);
  perform set_config('app.reset', 'on', true);
  update public.issued_docs set movement_id = null where org_id = p_org and movement_id = any(p_ids);
  update public.deadlines set movement_id = null where org_id = p_org and movement_id = any(p_ids);
  delete from public.self_certs where org_id = p_org and movement_id = any(p_ids);
  delete from public.reconciliation_items where movement_id = any(p_ids);
  delete from public.movement_documents where org_id = p_org and movement_id = any(p_ids);
  delete from public.movements where org_id = p_org and id = any(p_ids) and reverses_id is not null;
  delete from public.movements where org_id = p_org and id = any(p_ids);
  perform set_config('app.reset', 'off', true);
  perform set_config('app.bypass', 'off', true);
  return v_n;
end $$;
revoke execute on function app.purge_movements(uuid, uuid[]) from public, anon, authenticated;

create or replace function app.purge_check(p_reason text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_role('super_admin', 'admin') then perform app.fail('forbidden', 'solo un amministratore elimina definitivamente'); end if;
  if not app.recent_password() then perform app.fail('reauth', 'reinserisci la password per confermare'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform app.fail('invalid', 'indica il motivo (almeno 5 caratteri)'); end if;
end $$;
revoke execute on function app.purge_check(text) from public, anon, authenticated;

-- Uno o più movimenti scelti
create or replace function public.movement_purge(p_ids uuid[], p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_ids uuid[]; v_closed text; v_n int;
begin
  perform app.purge_check(p_reason);
  if coalesce(array_length(p_ids, 1), 0) = 0 then perform app.fail('invalid', 'nessun movimento scelto'); end if;
  -- gli storni dei movimenti scelti se ne vanno con loro (altrimenti resterebbe uno storno di un movimento che non c'è)
  select array_agg(distinct m.id) into v_ids from public.movements m
   where m.org_id = v_org and (m.id = any(p_ids) or m.reverses_id = any(p_ids));
  if v_ids is null or (select count(*) from public.movements where org_id = v_org and id = any(p_ids)) <> (select count(distinct x) from unnest(p_ids) x) then
    perform app.fail('not_found', 'movimento');
  end if;
  select string_agg(distinct to_char(m.op_date, 'MM/YYYY'), ', ') into v_closed from public.movements m
   where m.id = any(v_ids) and not app.period_open(v_org, m.op_date);
  if v_closed is not null then perform app.fail('immutable', 'mese chiuso (' || v_closed || '): riaprilo prima di eliminare'); end if;
  v_n := app.purge_movements(v_org, v_ids);
  return jsonb_build_object('outcome', 'deleted', 'deleted', v_n);
end $$;

-- Tutti i movimenti dell'ente (i preventivi restano)
create or replace function public.movement_purge_all(p_expected int, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_ids uuid[]; v_bk timestamptz; v_n int;
begin
  perform app.purge_check(p_reason);
  select nullif(value ->> 'at', '')::timestamptz into v_bk from public.settings where org_id = v_org and key = 'last_backup';
  if v_bk is null or v_bk < now() - interval '24 hours' then
    perform app.fail('invalid', 'scarica prima il backup completo (serve un backup delle ultime 24 ore)');
  end if;
  select array_agg(id) into v_ids from public.movements where org_id = v_org;
  if coalesce(array_length(v_ids, 1), 0) <> coalesce(p_expected, -1) then
    perform app.fail('invalid', format('il numero dei movimenti è cambiato (%s): ricarica la pagina', coalesce(array_length(v_ids, 1), 0)));
  end if;
  if exists (select 1 from public.periods where org_id = v_org and closed_at is not null) then
    perform app.fail('immutable', 'ci sono mesi chiusi: riaprili prima di eliminare tutti i movimenti');
  end if;
  v_n := app.purge_movements(v_org, v_ids);
  delete from app.ref_counters where org_id = v_org;
  return jsonb_build_object('outcome', 'deleted', 'deleted', v_n);
end $$;

revoke all on function public.movement_purge(uuid[], text), public.movement_purge_all(int, text) from public, anon;
grant execute on function public.movement_purge(uuid[], text), public.movement_purge_all(int, text) to authenticated;


-- ---------------------------------------------------------------- riapertura della verifica
-- Un movimento verificato non si modifica (controllo a quattro occhi). Un amministratore può riaprirne la verifica,
-- con il motivo, finché il mese è aperto e il movimento non è stornato: torna «registrato», si corregge e si verifica di nuovo.
create or replace function app.movements_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create or replace function public.movement_unverify(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_m public.movements;
begin
  if not app.has_role('super_admin', 'admin') then perform app.fail('forbidden', 'solo un amministratore riapre la verifica'); end if;
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
revoke all on function public.movement_unverify(uuid, text) from public, anon;
grant execute on function public.movement_unverify(uuid, text) to authenticated;
