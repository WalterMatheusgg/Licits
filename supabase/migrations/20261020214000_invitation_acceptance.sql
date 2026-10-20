-- Membership invitations require acceptance by the intended, verified account.
-- Prevent a premature grant of access and guard against leaving a tenant with no administrator.
create or replace function public.validate_membership_transition()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $membership$
declare other_admins integer;
begin
 if old.status = 'invited' and new.status = 'active'
   and auth.uid() is distinct from new.user_id then
   raise exception 'Only the invited account can accept an invitation';
 end if;
 if old.status = 'active' and old.role = 'organization_admin'
   and (new.status <> 'active' or new.role <> 'organization_admin') then
   perform 1 from public.organizations where id=old.organization_id for update;
   select count(*) into other_admins from public.organization_members
     where organization_id=old.organization_id and user_id<>old.user_id
       and role='organization_admin' and status='active';
   if other_admins=0 then
     raise exception 'An organization must retain at least one active administrator';
   end if;
 end if;
 return new;
end;
$membership$;

create trigger membership_validate_transition
before update on public.organization_members
for each row execute function public.validate_membership_transition();

create or replace function public.accept_organization_invitation(p_organization_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp
as $accept$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(
    select 1 from auth.users u join public.profiles p on p.id=u.id
    where u.id=auth.uid() and u.email_confirmed_at is not null and p.status='active'
 ) then
   raise exception 'Confirm your email and activate your profile before accepting';
 end if;
 if not exists(select 1 from public.organizations o where
    o.id=p_organization_id and o.status='active' and o.deleted_at is null) then
   raise exception 'Organization not available';
 end if;
 update public.organization_members
 set status='active',accepted_at=now()
 where organization_id=p_organization_id and user_id=auth.uid() and status='invited';
 if not found then raise exception 'No pending invitation for this account'; end if;
end;
$accept$;

revoke all on function public.validate_membership_transition() from public;
revoke all on function public.accept_organization_invitation(uuid) from public, anon;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;
