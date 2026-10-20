-- Contract line items and immutable stock/consumption movements.
create table public.contract_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid not null,
  group_number text,
  item_number text,
  description text not null,
  unit text,
  contracted_qty numeric(16,4) not null default 0,
  minimum_qty numeric(16,4),
  used_qty numeric(16,4) not null default 0,
  unit_price numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint contract_items_contract_fk
    foreign key (organization_id, contract_id)
    references public.contracts (organization_id, id)
    on delete restrict,
  constraint contract_items_description_not_blank check (btrim(description) <> ''),
  constraint contract_items_quantities_nonnegative check (
    contracted_qty >= 0
    and used_qty >= 0
    and (minimum_qty is null or minimum_qty >= 0)
    and used_qty <= contracted_qty
  ),
  constraint contract_items_unit_price_nonnegative check (unit_price >= 0),
  constraint contract_items_org_id_id_unique unique (organization_id, id)
);

create table public.item_withdrawals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid not null,
  contract_item_id uuid not null,
  service_order_number text,
  withdrawal_date date not null default current_date,
  quantity numeric(16,4) not null,
  notes text,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint item_withdrawals_contract_fk
    foreign key (organization_id, contract_id)
    references public.contracts (organization_id, id)
    on delete restrict,
  constraint item_withdrawals_item_fk
    foreign key (organization_id, contract_item_id)
    references public.contract_items (organization_id, id)
    on delete restrict,
  constraint item_withdrawals_quantity_positive check (quantity > 0)
);

create index contract_items_contract_idx
  on public.contract_items (organization_id, contract_id)
  where deleted_at is null;
create index item_withdrawals_item_idx
  on public.item_withdrawals (organization_id, contract_item_id, created_at desc);
create index item_withdrawals_contract_idx
  on public.item_withdrawals (organization_id, contract_id, withdrawal_date desc);
