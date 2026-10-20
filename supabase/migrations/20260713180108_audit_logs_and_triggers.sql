-- Immutable audit trail and common data-integrity triggers.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx
  on public.audit_logs (organization_id, entity_type, entity_id, created_at desc);
create index audit_logs_user_idx
  on public.audit_logs (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_updated_actor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_actor_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.set_occurrence_actor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.registered_by = auth.uid();
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.set_admin_request_actor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.requester_id = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_ai_job_actor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.requested_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.protect_notification_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'only read_at may be changed by an authenticated client';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_organization_id_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id then
    if new.status is distinct from old.status then
      raise exception 'profile status cannot be changed by the profile owner';
    end if;
    if new.email is distinct from old.email then
      raise exception 'profile email must be changed through the authentication provider';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'organization_members',
    'suppliers',
    'contracts',
    'contract_items',
    'documents',
    'fiscal_records',
    'price_registrations',
    'price_registration_groups'
  ]
  loop
    execute format(
      'create trigger %I_set_actor before insert on public.%I for each row execute function public.set_actor_fields()',
      table_name,
      table_name
    );
  end loop;
end
$$;

create trigger occurrences_set_actor
before insert on public.occurrences
for each row execute function public.set_occurrence_actor();

create trigger admin_requests_set_actor
before insert on public.admin_requests
for each row execute function public.set_admin_request_actor();

create trigger ai_jobs_set_actor
before insert on public.ai_analysis_jobs
for each row execute function public.set_ai_job_actor();

create trigger notifications_protect_update
before update on public.notifications
for each row execute function public.protect_notification_update();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'organization_members',
    'suppliers',
    'contracts',
    'contract_items',
    'documents',
    'fiscal_records',
    'occurrences',
    'price_registrations',
    'price_registration_groups'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_actor before update on public.%I for each row execute function public.set_updated_actor()',
      table_name,
      table_name
    );
  end loop;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'admin_requests',
    'ai_analysis_jobs',
    'ai_analysis_results'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organization_members',
    'suppliers',
    'contracts',
    'contract_items',
    'documents',
    'fiscal_records',
    'occurrences',
    'price_registrations',
    'price_registration_groups',
    'admin_requests',
    'notifications',
    'ai_analysis_jobs',
    'ai_analysis_results'
  ]
  loop
    execute format(
      'create trigger %I_prevent_org_change before update on public.%I for each row execute function public.prevent_organization_id_change()',
      table_name,
      table_name
    );
  end loop;
end
$$;

create trigger profiles_protect_system_fields
before update on public.profiles
for each row execute function public.protect_profile_system_fields();
