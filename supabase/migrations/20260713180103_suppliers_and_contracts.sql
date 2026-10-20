-- Suppliers and contracts.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_name text not null,
  trade_name text,
  cnpj text,
  address text,
  city text,
  state text,
  postal_code text,
  phone text,
  email text,
  contact_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint suppliers_legal_name_not_blank check (btrim(legal_name) <> ''),
  constraint suppliers_cnpj_digits check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  constraint suppliers_state_format check (state is null or state ~ '^[A-Z]{2}$'),
  constraint suppliers_org_id_id_unique unique (organization_id, id)
);

create unique index suppliers_org_cnpj_unique
  on public.suppliers (organization_id, cnpj)
  where cnpj is not null and deleted_at is null;

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  supplier_id uuid not null,
  contract_number text not null,
  sei_number text,
  auction_number text,
  object text not null,
  modality public.contract_modality,
  contract_type text,
  status public.contract_status not null default 'em_analise',
  responsible_sector text,
  start_date date,
  end_date date,
  total_value numeric(14,2) not null default 0,
  used_value numeric(14,2) not null default 0,
  can_extend public.extension_status not null default 'analise_pendente',
  extensions_done integer not null default 0,
  max_extensions integer not null default 5,
  fiscal_status public.fiscal_health not null default 'baixa',
  source_document_id uuid,
  ai_summary text,
  ai_risks text,
  clauses text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint contracts_number_not_blank check (btrim(contract_number) <> ''),
  constraint contracts_object_not_blank check (btrim(object) <> ''),
  constraint contracts_dates_coherent check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint contracts_values_nonnegative check (
    total_value >= 0 and used_value >= 0 and used_value <= total_value
  ),
  constraint contracts_extensions_nonnegative check (
    extensions_done >= 0 and max_extensions >= 0 and extensions_done <= max_extensions
  ),
  constraint contracts_supplier_same_org_fk
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete restrict,
  constraint contracts_org_id_id_unique unique (organization_id, id)
);

create unique index contracts_org_number_unique
  on public.contracts (organization_id, contract_number)
  where deleted_at is null;

create index contracts_org_status_idx
  on public.contracts (organization_id, status)
  where deleted_at is null;
create index contracts_org_end_date_idx
  on public.contracts (organization_id, end_date)
  where deleted_at is null;
create index contracts_supplier_idx
  on public.contracts (organization_id, supplier_id)
  where deleted_at is null;
create index contracts_created_at_idx
  on public.contracts (organization_id, created_at desc);
