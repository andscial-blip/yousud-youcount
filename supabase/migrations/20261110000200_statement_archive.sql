-- Documenti › Rendiconti (scelta 7B del 10/11): archivio delle versioni approvate e firmate del rendiconto.
-- Il PDF firmato si carica come documento (tipo «statement», così non compare fra i giustificativi) e si annota
-- qui con l'anno a cui si riferisce, la data e gli estremi dell'approvazione. Solo gli amministratori archiviano.

alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('invoice','receipt','till_receipt','self_cert','bank_statement','contract','other','statement'));

create table if not exists public.statement_archive (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete restrict,
  year         integer not null check (year between 2000 and 2100),
  kind         text not null default 'cash' check (kind in ('cash','model_e','social','other')),
  approved_on  date not null,
  approval_ref text not null check (length(trim(approval_ref)) between 3 and 300),
  document_id  uuid not null references public.documents(id) on delete restrict,
  notes        text check (notes is null or length(notes) <= 500),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  unique (document_id)
);
create index if not exists statement_archive_org_year_idx on public.statement_archive(org_id, year);
create index if not exists statement_archive_created_by_idx on public.statement_archive(created_by);

alter table public.statement_archive enable row level security;
drop policy if exists statement_archive_select on public.statement_archive;
create policy statement_archive_select on public.statement_archive for select to authenticated
  using (org_id = (select app.me_org()) and (select app.is_staff()));
grant select on public.statement_archive to authenticated;
drop trigger if exists statement_archive_audit on public.statement_archive;
create trigger statement_archive_audit after insert or update or delete on public.statement_archive for each row execute function app.audit();

-- Archivia: il documento deve essere dell'ente e di tipo «statement» (caricato con register_document).
create or replace function public.archive_statement(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_doc uuid := nullif(p->>'document_id', '')::uuid; v_r public.statement_archive;
begin
  if not app.has_role('super_admin', 'admin') then perform app.fail('forbidden'); end if;
  if not exists (select 1 from public.documents where id = v_doc and org_id = v_org and doc_type = 'statement') then
    perform app.fail('not_found', 'documento');
  end if;
  insert into public.statement_archive(org_id, year, kind, approved_on, approval_ref, document_id, notes, created_by)
  values (v_org, (p->>'year')::integer, coalesce(nullif(p->>'kind', ''), 'cash'), (p->>'approved_on')::date,
          trim(p->>'approval_ref'), v_doc, nullif(trim(coalesce(p->>'notes', '')), ''), auth.uid())
  on conflict (document_id) do update set year = excluded.year, kind = excluded.kind, approved_on = excluded.approved_on,
    approval_ref = excluded.approval_ref, notes = excluded.notes
  returning * into v_r;
  return to_jsonb(v_r);
end $$;
revoke all on function public.archive_statement(jsonb) from public, anon;
grant execute on function public.archive_statement(jsonb) to authenticated;
