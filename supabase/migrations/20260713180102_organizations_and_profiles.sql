-- Multi-tenant identity foundation.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cnpj text,
  email text,
  phone text,
  city text,
  state text,
  status public.organization_status not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint organizations_name_not_blank check (btrim(name) <> ''),
  constraint organizations_state_format check (state is null or state ~ '^[A-Z]{2}$'),
  constraint organizations_cnpj_digits check (cnpj is null or cnpj ~ '^[0-9]{14}$')
);

create unique index organizations_cnpj_unique
  on public.organizations (cnpj)
  where cnpj is not null and deleted_at is null;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_path text,
  status public.profile_status not null default 'active',
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (full_name is null or btrim(full_name) <> '')
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  notes text
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'visualizador',
  status public.membership_status not null default 'invited',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint organization_members_unique unique (organization_id, user_id),
  constraint active_membership_has_acceptance
    check (status <> 'active' or accepted_at is not null)
);

create index organization_members_user_idx
  on public.organization_members (user_id, status);
create index organization_members_org_idx
  on public.organization_members (organization_id, status, role);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public;
