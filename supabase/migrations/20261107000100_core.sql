-- YouCount – contabilità YouSud
-- 0100 · Tipi e tabelle
-- Regole: UUID ovunque, org_id su ogni riga, nessuna cancellazione dei movimenti registrati
-- (si correggono con uno storno), storico delle modifiche in audit_log.

create schema if not exists app;

-- ---------------------------------------------------------------- tipi
create type public.app_role   as enum ('super_admin','admin','responsabile','operator','read_only');
create type public.mov_kind   as enum ('income','expense','transfer');
create type public.mov_status as enum ('draft','recorded','verified');
create type public.flow_dir   as enum ('in','out');

-- ---------------------------------------------------------------- organizzazione e utenti
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 2 and 200),
  base_currency char(3) not null default 'EUR',
  created_at    timestamptz not null default now()
);

create table public.settings (
  org_id     uuid not null references public.organizations(id) on delete restrict,
  key        text not null check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (org_id, key)
);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete restrict,
  org_id       uuid not null references public.organizations(id) on delete restrict,
  full_name    text not null default '' check (length(full_name) <= 200),
  email        text,
  role         public.app_role not null default 'read_only',
  lang         text not null default 'it' check (lang in ('it','fr','en')),
  active       boolean not null default true,
  all_projects boolean not null default false,   -- se falso, un operatore vede solo i progetti assegnati
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1
);
create index profiles_org_idx on public.profiles(org_id);

-- ---------------------------------------------------------------- dati di riferimento
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete restrict,
  code            text not null check (length(code) between 1 and 60),
  name_it         text not null,
  name_fr         text not null default '',
  currency        char(3) not null check (currency in ('EUR','MGA')),
  location        text not null check (location in ('IT','MG')),
  kind            text not null check (kind in ('bank','cash','mobile','advance','other')),
  opening_balance numeric(16,2) not null default 0,
  opening_date    date,
  active          boolean not null default true,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  unique (org_id, code)
);

-- Righe del rendiconto per cassa (Mod. D, D.M. 5 marzo 2020) come usate nel Gestionale.
create table public.report_lines (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  direction  public.flow_dir not null,
  section    text not null,                 -- A, B, C, D, E, INV, DIS, TAX
  section_it text not null,
  section_fr text not null default '',
  key        text not null,                 -- es. A4, INV, TAX
  name_it    text not null,
  name_fr    text not null default '',
  sort       integer not null default 0,
  unique (org_id, direction, key)
);

create table public.category_groups (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references public.organizations(id) on delete restrict,
  direction public.flow_dir not null,
  code      text not null,
  name_it   text not null,
  name_fr   text not null default '',
  sort      integer not null default 0,
  unique (org_id, direction, code),
  unique (id, org_id, direction)
);

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete restrict,
  direction       public.flow_dir not null,
  code            text not null,
  group_id        uuid not null,
  name_it         text not null,
  name_fr         text not null default '',
  report_line_key text,                     -- null = da classificare (es. 999, E999)
  chart_version   integer not null default 1,
  active          boolean not null default true,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1,
  unique (org_id, direction, code),
  foreign key (group_id, org_id, direction) references public.category_groups(id, org_id, direction),
  foreign key (org_id, direction, report_line_key) references public.report_lines(org_id, direction, key)
);

-- Progetti e centri di costo. kind = 'structure' per le spese generali fuori progetto:
-- nel rendiconto le loro uscite A1-A5 vanno in E1-E5 (oneri di supporto generale).
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  code       text,
  name       text not null check (length(name) between 1 and 120),
  kind       text not null default 'project' check (kind in ('project','structure')),
  active     boolean not null default true,
  start_date date,
  end_date   date,
  legacy_name text,                          -- nome usato nel Gestionale, per la migrazione
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer not null default 1,
  unique (org_id, name),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.project_members (
  org_id     uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members(user_id);

create table public.payment_methods (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references public.organizations(id) on delete restrict,
  code    text not null,
  name_it text not null,
  name_fr text not null default '',
  active  boolean not null default true,
  sort    integer not null default 0,
  unique (org_id, code)
);

-- Fornitori, donatori, beneficiari. I dati personali stanno in counterparty_private.
create table public.counterparties (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  name       text not null check (length(name) between 1 and 200),
  kind       text not null default 'supplier' check (kind in ('supplier','donor','beneficiary','staff','other')),
  vat_number text,
  country    char(2),
  active     boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer not null default 1
);
create index counterparties_org_name_idx on public.counterparties(org_id, lower(name));

create table public.counterparty_private (
  counterparty_id uuid primary key references public.counterparties(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete restrict,
  tax_code        text,
  email           text,
  phone           text,
  address         text,
  iban            text,
  notes           text,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- finanziamenti (contributi, bandi, donazioni vincolate)
create table public.grants (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  code       text check (code is null or length(code) <= 60),
  title      text not null check (length(title) between 2 and 200),
  donor_id   uuid references public.counterparties(id),
  project_id uuid references public.projects(id),
  currency   char(3) not null default 'EUR' check (currency in ('EUR','MGA')),
  amount     numeric(16,2) check (amount is null or amount >= 0),
  start_date date,
  end_date   date,
  status     text not null default 'active' check (status in ('active','closed')),
  notes      text check (notes is null or length(notes) <= 2000),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer not null default 1,
  unique (org_id, code),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index grants_project_idx on public.grants(project_id);


-- ---------------------------------------------------------------- documenti
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete restrict,
  client_uuid      uuid not null,
  doc_type         text not null default 'receipt'
                   check (doc_type in ('invoice','receipt','till_receipt','self_cert','bank_statement','contract','other')),
  doc_date         date,
  doc_number       text,
  total            numeric(16,2),
  currency         char(3) check (currency is null or currency in ('EUR','MGA')),
  counterparty_id  uuid references public.counterparties(id),
  original_path    text not null,            -- file originale, mai sostituito
  enhanced_path    text,                     -- immagine migliorata (bordi, prospettiva, ombre)
  pdf_path         text,
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime             text not null,
  file_name        text check (file_name is null or length(file_name) <= 255),   -- nome del file caricato
  size_bytes       bigint check (size_bytes is null or size_bytes >= 0),
  pages            integer check (pages is null or pages > 0),
  extraction       jsonb,                    -- per campo: valore, fonte, confidenza, stato
  extraction_model text,
  extraction_at    timestamptz,
  uploaded_by      uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  unique (org_id, sha256),
  unique (org_id, client_uuid)
);
create index documents_org_date_idx on public.documents(org_id, doc_date);

-- ---------------------------------------------------------------- movimenti
create table public.movements (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete restrict,
  client_uuid       uuid not null,            -- generato sul dispositivo: reinvio senza doppioni
  last_op_uuid      uuid,                     -- ultima modifica applicata: modifica ripetuta = nessun effetto
  ref               text,                     -- MOV-AAAA-NNN, assegnato alla registrazione
  kind              public.mov_kind not null,
  status            public.mov_status not null default 'draft',
  op_date           date not null,
  doc_date          date,
  description       text not null default '' check (length(description) <= 500),
  amount            numeric(16,2) not null check (amount > 0),
  currency          char(3) not null check (currency in ('EUR','MGA')),
  fx_rate           numeric(14,4) check (fx_rate is null or fx_rate > 0),   -- MGA per 1 EUR
  amount_eur        numeric(16,2) generated always as (
                      case when currency = 'EUR' then amount
                           when fx_rate is null then null
                           else round(amount / fx_rate, 2) end) stored,
  account_id        uuid not null references public.accounts(id),
  to_account_id     uuid references public.accounts(id),
  to_amount         numeric(16,2) check (to_amount is null or to_amount > 0),
  category_id       uuid references public.categories(id),
  project_id        uuid references public.projects(id),
  grant_id          uuid references public.grants(id),        -- finanziamento a cui si imputa la spesa
  counterparty_id   uuid references public.counterparties(id),
  payment_method_id uuid references public.payment_methods(id),
  notes             text check (notes is null or length(notes) <= 2000),
  reverses_id       uuid unique references public.movements(id),
  reversal_reason   text,
  sign              smallint generated always as (case when reverses_id is null then 1 else -1 end) stored,
  ai_extracted      boolean not null default false,
  no_doc_reason     text check (no_doc_reason is null or length(no_doc_reason) between 5 and 500),
  legacy_id         text,                     -- id del Gestionale, per la migrazione
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles(id),
  updated_at        timestamptz not null default now(),
  recorded_by       uuid references public.profiles(id),
  recorded_at       timestamptz,
  verified_by       uuid references public.profiles(id),
  verified_at       timestamptz,
  version           integer not null default 1,
  unique (org_id, client_uuid),
  unique (org_id, ref),
  unique (org_id, legacy_id),
  check (status = 'draft' or currency = 'EUR' or fx_rate is not null),
  check (status = 'draft' or ref is not null),
  check (kind <> 'transfer' or (to_account_id is not null and to_account_id <> account_id
                                and to_amount is not null and category_id is null)),
  check (kind = 'transfer' or (to_account_id is null and to_amount is null)),
  check (status = 'draft' or kind = 'transfer' or category_id is not null),
  check ((reverses_id is null) = (reversal_reason is null)),
  check (reverses_id is null or status <> 'draft'),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null))
);
create index movements_org_date_idx    on public.movements(org_id, op_date desc);
create index movements_account_idx     on public.movements(account_id, op_date);
create index movements_to_account_idx  on public.movements(to_account_id) where to_account_id is not null;
create index movements_project_idx     on public.movements(project_id, op_date);
create index movements_grant_idx       on public.movements(grant_id) where grant_id is not null;
create index movements_category_idx    on public.movements(category_id);
create index movements_status_idx      on public.movements(org_id, status);
create index movements_created_by_idx  on public.movements(created_by);
create index movements_dup_idx         on public.movements(org_id, amount, currency, op_date);

create table public.movement_documents (
  movement_id uuid not null references public.movements(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  org_id      uuid not null references public.organizations(id) on delete restrict,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  primary key (movement_id, document_id)
);
create index movement_documents_doc_idx on public.movement_documents(document_id);

-- ---------------------------------------------------------------- periodi, numerazione, registri
create table public.periods (
  org_id    uuid not null references public.organizations(id) on delete restrict,
  year      integer not null check (year between 2000 and 2100),
  month     integer not null check (month between 1 and 12),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  primary key (org_id, year, month)
);

create table app.ref_counters (
  org_id uuid not null,
  year   integer not null,
  last   integer not null default 0,
  primary key (org_id, year)
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  org_id     uuid,
  table_name text not null,
  row_id     text,
  action     text not null check (action in ('insert','update','delete')),
  actor      uuid,
  at         timestamptz not null default now(),
  old_row    jsonb,
  new_row    jsonb
);
create index audit_log_row_idx on public.audit_log(table_name, row_id);
create index audit_log_org_at_idx on public.audit_log(org_id, at desc);

create table public.sync_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null,
  user_id     uuid,
  device_id   text,
  client_uuid uuid,
  operation   text not null,
  outcome     text not null check (outcome in ('applied','duplicate','conflict')),
  detail      jsonb,
  at          timestamptz not null default now()
);
create index sync_log_org_at_idx on public.sync_log(org_id, at desc);
create index sync_log_user_idx on public.sync_log(user_id, at desc);
