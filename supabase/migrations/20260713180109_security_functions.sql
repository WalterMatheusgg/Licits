-- Authorization helpers. SECURITY DEFINER functions use a fixed search_path.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = auth.uid()
    );
$$;

create or replace function public.current_user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select om.organization_id
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.status = 'active'
    and o.status = 'active'
    and o.deleted_at is null;
$$;

create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and o.status = 'active'
        and o.deleted_at is null
    );
$$;

create or replace function public.get_organization_role(p_organization_id uuid)
returns public.organization_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

create or replace function public.has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role = any(p_roles)
    );
$$;

create or replace function public.can_manage_members(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
    or public.has_organization_role(
      p_organization_id,
      array['organization_admin']::public.organization_role[]
    );
$$;

create or replace function public.can_manage_contracts(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
    or public.has_organization_role(
      p_organization_id,
      array['organization_admin', 'gestor']::public.organization_role[]
    );
$$;

create or replace function public.can_write_operational_data(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
    or public.has_organization_role(
      p_organization_id,
      array['organization_admin', 'gestor', 'fiscal', 'operacional']::public.organization_role[]
    );
$$;

create or replace function public.can_write_fiscal_data(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin()
    or public.has_organization_role(
      p_organization_id,
      array['organization_admin', 'gestor', 'fiscal']::public.organization_role[]
    );
$$;

create or replace function public.storage_path_has_read_access(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.current_user_organization_ids() org_id
      where org_id::text = (storage.foldername(p_name))[1]
    );
$$;

create or replace function public.storage_path_has_write_access(
  p_bucket_id text,
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.current_user_organization_ids() org_id
      where org_id::text = (storage.foldername(p_name))[1]
        and (
          (
            p_bucket_id = 'contracts'
            and public.can_manage_contracts(org_id)
          )
          or (
            p_bucket_id in ('fiscal-records', 'occurrences')
            and public.can_write_fiscal_data(org_id)
          )
          or (
            p_bucket_id = 'generated-documents'
            and public.can_write_operational_data(org_id)
          )
          or (
            p_bucket_id = 'organization-assets'
            and public.can_manage_members(org_id)
          )
        )
    );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.current_user_organization_ids() from public;
revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.get_organization_role(uuid) from public;
revoke all on function public.has_organization_role(uuid, public.organization_role[]) from public;
revoke all on function public.can_manage_members(uuid) from public;
revoke all on function public.can_manage_contracts(uuid) from public;
revoke all on function public.can_write_operational_data(uuid) from public;
revoke all on function public.can_write_fiscal_data(uuid) from public;
revoke all on function public.storage_path_has_read_access(text) from public;
revoke all on function public.storage_path_has_write_access(text, text) from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_user_organization_ids() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.get_organization_role(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.organization_role[]) to authenticated;
grant execute on function public.can_manage_members(uuid) to authenticated;
grant execute on function public.can_manage_contracts(uuid) to authenticated;
grant execute on function public.can_write_operational_data(uuid) to authenticated;
grant execute on function public.can_write_fiscal_data(uuid) to authenticated;
grant execute on function public.storage_path_has_read_access(text) to authenticated;
grant execute on function public.storage_path_has_write_access(text, text) to authenticated;
