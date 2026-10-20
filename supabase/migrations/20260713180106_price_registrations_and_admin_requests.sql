-- Price registrations and controlled administrative change requests.
create table public.price_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  auction_number text not null,
  sei_number text,
  object text not null,
  registration_type public.price_registration_type not null default 'srp_cfp',
  adhesion_organization text,
  adhesion_auction_number text,
  status public.price_registration_status not null default 'em_analise',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint price_registrations_auction_not_blank check (btrim(auction_number) <> ''),
  constraint price_registrations_object_not_blank check (btrim(object) <> ''),
  constraint price_registrations_org_id_id_unique unique (organization_id, id)
);

create table public.price_registration_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  price_registration_id uuid not null,
  supplier_id uuid not null,
  arp_number text not null,
  group_number text,
  start_date date,
  end_date date,
  total_value numeric(14,2) not null default 0,
  can_extend boolean not null default false,
  status public.price_group_status not null default 'ativo',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint price_groups_registration_fk
    foreign key (organization_id, price_registration_id)
    references public.price_registrations (organization_id, id)
    on delete restrict,
  constraint price_groups_supplier_fk
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete restrict,
  constraint price_groups_arp_not_blank check (btrim(arp_number) <> ''),
  constraint price_groups_dates_coherent check (
    start_date is null or end_date is null or end_date >= start_date
  ),
  constraint price_groups_value_nonnegative check (total_value >= 0),
  constraint price_groups_org_id_id_unique unique (organization_id, id)
);

create table public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  requester_id uuid not null references auth.users(id) on delete restrict,
  entity_type text,
  entity_id uuid,
  entity_label text,
  request_type public.admin_request_type not null,
  description text not null,
  status public.admin_request_status not null default 'pendente',
  admin_response text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_requests_description_not_blank check (btrim(description) <> ''),
  constraint admin_requests_resolution_coherent check (
    status not in ('aprovado', 'recusado')
    or (resolved_by is not null and resolved_at is not null)
  )
);

create unique index price_registrations_org_auction_unique
  on public.price_registrations (organization_id, auction_number)
  where deleted_at is null;
create index price_groups_registration_idx
  on public.price_registration_groups (organization_id, price_registration_id)
  where deleted_at is null;
create index price_groups_end_date_idx
  on public.price_registration_groups (organization_id, end_date)
  where deleted_at is null;
create index admin_requests_status_idx
  on public.admin_requests (organization_id, status, created_at desc);
