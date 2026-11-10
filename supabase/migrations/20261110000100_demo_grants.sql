-- Finanziamenti DEMO (10/11/2026): i finanziamenti di prova sono marcati come gli altri dati demo
-- e si eliminano insieme a loro con «Elimina i dati DEMO».
alter table public.grants add column if not exists demo boolean not null default false;

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
    'issued_docs', (select count(*) from public.issued_docs where org_id = app.me_org() and demo),
    'grants', (select count(*) from public.grants where org_id = app.me_org() and demo)) end
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
  update public.movements set grant_id = null where org_id = v_org and grant_id in (select id from public.grants where org_id = v_org and demo);
  delete from public.grants where org_id = v_org and demo;
  delete from public.counterparties c where c.org_id = v_org and c.demo and not exists (select 1 from public.movements m where m.counterparty_id = c.id)
    and not exists (select 1 from public.grants g where g.donor_id = c.id);
  delete from public.projects p where p.org_id = v_org and p.demo
    and not exists (select 1 from public.movements m where m.project_id = p.id)
    and not exists (select 1 from public.budget_items i where i.project_id = p.id)
    and not exists (select 1 from public.grants g where g.project_id = p.id);
  perform set_config('app.bypass', 'off', true);
  return jsonb_build_object('outcome', 'purged', 'deleted', v_before);
end $$;

