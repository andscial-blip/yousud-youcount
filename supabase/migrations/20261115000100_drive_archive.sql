-- Archivio su Google Drive (15/11/2026): copia consultabile di giustificativi e documenti emessi
-- nel Drive dell'associazione. La fonte di verità resta il database; nel Drive non si elimina mai nulla.
-- Le tre tabelle sono lette e scritte solo dal server con la chiave di servizio: RLS attiva, nessuna politica.

create table if not exists public.drive_link (
  org_id         uuid primary key references public.organizations(id) on delete cascade,
  google_email   text,
  refresh_token  text not null,           -- gettone di rinnovo dell'autorizzazione Google (solo server)
  root_folder_id text,                    -- cartella «Archivio contabile» creata dall'app
  connected_by   uuid references public.profiles(id),
  connected_at   timestamptz not null default now(),
  last_sync_at   timestamptz,
  last_error     text
);
alter table public.drive_link enable row level security;

create table if not exists public.drive_folders (
  org_id   uuid not null references public.organizations(id) on delete cascade,
  path_key text not null,                 -- es. 2026/01_Giustificativi/2026-03
  drive_id text not null,
  primary key (org_id, path_key)
);
alter table public.drive_folders enable row level security;

create table if not exists public.drive_files (
  document_id     uuid primary key references public.documents(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  status          text not null default 'queued' check (status in ('queued','done','failed')),
  drive_file_id   text,
  folder_key      text,
  name            text,
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  synced_at       timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists drive_files_queue on public.drive_files (org_id, status, next_attempt_at);
alter table public.drive_files enable row level security;

revoke all on public.drive_link, public.drive_folders, public.drive_files from anon, authenticated;
grant all on public.drive_link, public.drive_folders, public.drive_files to service_role;

-- Che cosa va copiato e dove: un file per documento.
--  · documento emesso (emesso o annullato): anno della serie di numerazione, cartella del tipo;
--  · giustificativo di un movimento registrato o verificato: anno e mese della data del movimento (cassa);
--    se è collegato a più movimenti vale il primo; le autocertificazioni hanno la loro cartella.
-- Bozze e file non collegati non vengono copiati.
create or replace function public.drive_targets(p_org uuid)
returns table (document_id uuid, kind text, code text, ref text, on_date date, seq integer,
               party text, total numeric, currency text, cancelled boolean,
               path text, mime text, file_name text)
language sql stable security definer set search_path = public as $$
  with iss as (
    select distinct on (i.document_id) i.document_id, i.type, i.number, i.doc_date, i.status,
           coalesce(c.name, i.party_name) as party, i.amount, i.currency
    from issued_docs i left join counterparties c on c.id = i.counterparty_id
    where i.org_id = p_org and i.document_id is not null and i.status in ('issued','cancelled') and i.number is not null
    order by i.document_id, i.issued_at
  ), mov as (
    select md.document_id, m.ref, m.op_date, m.created_at,
           row_number() over (partition by md.document_id order by m.op_date, m.created_at) as rn
    from movement_documents md join movements m on m.id = md.movement_id
    where md.org_id = p_org and m.status <> 'draft' and m.ref is not null
  ), first_mov as (select * from mov where rn = 1),
  att as (
    select f.document_id, f.ref, f.op_date,
           row_number() over (partition by f.ref order by d.created_at, d.id)::int as seq
    from first_mov f join documents d on d.id = f.document_id
  )
  select d.id, 'issued', i.type, i.number, i.doc_date, 1, i.party, i.amount, i.currency::text, i.status = 'cancelled',
         coalesce(d.pdf_path, d.original_path), case when d.pdf_path is not null then 'application/pdf' else d.mime end, d.file_name
  from documents d join iss i on i.document_id = d.id where d.org_id = p_org
  union all
  select d.id, 'receipt',
         case d.doc_type when 'invoice' then 'FAT' when 'receipt' then 'RIC' when 'till_receipt' then 'SCO' when 'self_cert' then 'AUT'
                         when 'bank_statement' then 'EC' when 'contract' then 'CON' else 'ALT' end,
         a.ref, a.op_date, a.seq, c.name, d.total, d.currency::text, false,
         coalesce(d.pdf_path, d.original_path), case when d.pdf_path is not null then 'application/pdf' else d.mime end, d.file_name
  from documents d join att a on a.document_id = d.id left join counterparties c on c.id = d.counterparty_id
  where d.org_id = p_org and not exists (select 1 from iss i where i.document_id = d.id);
$$;
revoke all on function public.drive_targets(uuid) from public, anon, authenticated;
grant execute on function public.drive_targets(uuid) to service_role;
