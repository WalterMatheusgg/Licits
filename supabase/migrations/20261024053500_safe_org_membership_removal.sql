-- Deleting access means removing exactly one organization membership.
-- Keep auth.users, profiles and every historical business/audit record intact.
-- Separate 'suspended' from deletion: deleted members have NO membership row.
-- Direct client deletions must not remove the final active org administrator.
create or replace function public.protect_last_active_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $guard$
begin
  if old.status='active' and old.role='organization_admin' then
    -- Serialize concurrent deletions/role changes within this organization.
    perform 1 from public.organizations where id=old.organization_id for update;
    if not exists(
      select 1 from public.organization_members om
      where om.organization_id=old.organization_id
        and om.user_id<>old.user_id
        and om.role='organization_admin'
        and om.status='active'
    ) then
      raise exception 'An organization must retain at least one active administrator';
    end if;
  end if;
  return old;
end;
$guard$;

drop trigger if exists organization_members_protect_last_admin_delete
  on public.organization_members;
create trigger organization_members_protect_last_admin_delete
before delete on public.organization_members
for each row execute function public.protect_last_active_admin_delete();

revoke all on function public.protect_last_active_admin_delete()
  from public, anon, authenticated;

-- Organization admins need to see the contact data of pending/blocked users
-- in THEIR organization only. 'revoked' members are intentionally excluded.
create policy profiles_select_organization_invitees_for_admin
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.user_id=profiles.id
      and om.status in ('invited','suspended')
      and public.can_manage_members(om.organization_id)
  )
);
