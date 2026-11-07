-- 0500 · Tassi di cambio mensili, progetto obbligatorio sulle uscite, archivio file
-- Tasso MGA per 1 EUR per mese: proposto in automatico nei movimenti in ariary, sempre modificabile.

create table public.fx_rates (
  org_id     uuid not null references public.organizations(id) on delete restrict,
  year       integer not null check (year between 2000 and 2100),
  month      integer not null check (month between 1 and 12),
  rate       numeric(14,4) not null check (rate > 0),
  source     text check (source is null or length(source) <= 200),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (org_id, year, month)
);
alter table public.fx_rates enable row level security;
create policy fx_select on public.fx_rates for select to authenticated using (org_id = app.me_org());
create policy fx_insert on public.fx_rates for insert to authenticated
  with check (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'));
create policy fx_update on public.fx_rates for update to authenticated
  using (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile'))
  with check (org_id = app.me_org());
revoke all on public.fx_rates from anon, authenticated;
grant select, insert, update on public.fx_rates to authenticated;
create trigger fx_rates_audit after insert or update or delete on public.fx_rates
  for each row execute function app.audit();

-- tasso del mese della data, o in mancanza l'ultimo precedente
create or replace function public.fx_rate_for(p_date date) returns numeric
language sql stable security invoker set search_path = '' as $$
  select r.rate from public.fx_rates r
  where r.org_id = app.me_org() and (r.year, r.month) <= (extract(year from p_date)::int, extract(month from p_date)::int)
  order by r.year desc, r.month desc limit 1
$$;
grant execute on function public.fx_rate_for(date) to authenticated;
revoke execute on function public.fx_rate_for(date) from public, anon;

-- le uscite registrate hanno sempre un progetto o il centro di costo «Spese generali»:
-- serve al rendiconto (sezione A oppure E) e al controllo per progetto
alter table public.movements add constraint movements_expense_project
  check (status = 'draft' or kind <> 'expense' or project_id is not null);

-- Archivio file su Supabase Storage: contenitore privato "documents", cartella = id dell'ente.
-- Chi può vedere il documento nel database può scaricare il file (link firmati di breve durata).
-- Il blocco si applica solo dove esiste lo schema storage (Supabase); nei test locali viene saltato.
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage assente: politiche dei file non create (ambiente di test)';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 20971520,
          array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
  on conflict (id) do nothing;

  execute $p$
    create policy documents_upload on storage.objects for insert to authenticated
    with check (bucket_id = 'documents'
                and (storage.foldername(name))[1] = app.me_org()::text
                and app.has_role('super_admin','admin','responsabile','operator'))
  $p$;
  execute $p$
    create policy documents_read on storage.objects for select to authenticated
    using (bucket_id = 'documents' and exists (
      select 1 from public.documents d
      where d.org_id = app.me_org()
        and storage.objects.name in (d.original_path, d.enhanced_path, d.pdf_path)))
  $p$;
  -- nessuna policy di modifica o cancellazione: i file caricati non si sostituiscono
end
$storage$;
