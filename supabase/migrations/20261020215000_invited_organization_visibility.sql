-- Pending invitees can view only the organization name/settings needed to accept their invite.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select to authenticated
using (
  public.is_platform_admin()
  or public.is_organization_member(id)
  or exists (
    select 1 from public.organization_members om
    where om.organization_id=organizations.id and om.user_id=auth.uid() and om.status='invited'
  )
);
