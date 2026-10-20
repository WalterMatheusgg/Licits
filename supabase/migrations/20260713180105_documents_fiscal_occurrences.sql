-- Private documents, fiscal records, and contract occurrences.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid,
  title text not null,
  document_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  checksum text,
  status public.document_status not null default 'pendente',
  version integer not null default 1,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint documents_contract_fk
    foreign key (organization_id, contract_id)
    references public.contracts (organization_id, id)
    on delete restrict,
  constraint documents_title_not_blank check (btrim(title) <> ''),
  constraint documents_path_not_blank check (btrim(storage_path) <> ''),
  constraint documents_file_size_nonnegative check (file_size is null or file_size >= 0),
  constraint documents_version_positive check (version > 0),
  constraint documents_org_id_id_unique unique (organization_id, id)
);

create table public.fiscal_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid not null,
  record_type text not null,
  title text,
  description text not null,
  document_id uuid,
  comments text,
  status public.fiscal_record_status not null default 'pendente',
  fiscal_date date,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint fiscal_records_contract_fk
    foreign key (organization_id, contract_id)
    references public.contracts (organization_id, id)
    on delete restrict,
  constraint fiscal_records_document_fk
    foreign key (organization_id, document_id)
    references public.documents (organization_id, id)
    on delete restrict,
  constraint fiscal_records_description_not_blank check (btrim(description) <> ''),
  constraint fiscal_records_org_id_id_unique unique (organization_id, id)
);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid not null,
  title text not null,
  content text not null,
  occurrence_date date not null default current_date,
  severity public.severity_level not null default 'media',
  status public.occurrence_status not null default 'aberta',
  registered_by uuid not null references auth.users(id) on delete restrict,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution text,
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint occurrences_contract_fk
    foreign key (organization_id, contract_id)
    references public.contracts (organization_id, id)
    on delete restrict,
  constraint occurrences_document_fk
    foreign key (organization_id, document_id)
    references public.documents (organization_id, id)
    on delete restrict,
  constraint occurrences_title_not_blank check (btrim(title) <> ''),
  constraint occurrences_content_not_blank check (btrim(content) <> ''),
  constraint occurrences_resolution_coherent check (
    (status <> 'resolvida')
    or (resolved_by is not null and resolved_at is not null)
  ),
  constraint occurrences_org_id_id_unique unique (organization_id, id)
);

alter table public.contracts
  add constraint contracts_source_document_fk
  foreign key (organization_id, source_document_id)
  references public.documents (organization_id, id)
  on delete restrict;

create index documents_contract_idx
  on public.documents (organization_id, contract_id, created_at desc)
  where deleted_at is null;
create index fiscal_records_contract_idx
  on public.fiscal_records (organization_id, contract_id, fiscal_date desc)
  where deleted_at is null;
create index occurrences_contract_idx
  on public.occurrences (organization_id, contract_id, occurrence_date desc)
  where deleted_at is null;
create index occurrences_status_idx
  on public.occurrences (organization_id, status, severity)
  where deleted_at is null;
