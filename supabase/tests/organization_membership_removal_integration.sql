-- Integration test for removing one organization's access, never deleting
-- the global Auth account, other organizations' memberships, or work history.
-- Run only in disposable local Supabase. Every row rolls back.
begin;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
 ('e7000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-admin-ci@example.invalid',now(),now()),
 ('e7000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-target-ci@example.invalid',now(),now()),
 ('e7000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-outsider-ci@example.invalid',now(),now());

insert into public.organizations(id,name) values
 ('e7000000-0000-4000-8000-000000000004','Primary Organization CI'),
 ('e7000000-0000-4000-8000-000000000005','Secondary Organization CI');

insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values
 ('e7000000-0000-4000-8000-000000000004','e7000000-0000-4000-8000-000000000001','organization_admin','active',now()),
 ('e7000000-0000-4000-8000-000000000004','e7000000-0000-4000-8000-000000000002','gestor','active',now()),
 ('e7000000-0000-4000-8000-000000000005','e7000000-0000-4000-8000-000000000001','organization_admin','active',now()),
 ('e7000000-0000-4000-8000-000000000005','e7000000-0000-4000-8000-000000000002','gestor','active',now());

insert into public.suppliers(id,organization_id,legal_name,created_by)
values ('e7000000-0000-4000-8000-000000000006','e7000000-0000-4000-8000-000000000004','Supplier owned by retained history','e7000000-0000-4000-8000-000000000002');

insert into public.contracts(id,organization_id,supplier_id,contract_number,object,created_by,status,total_value)
values ('e7000000-0000-4000-8000-000000000007','e7000000-0000-4000-8000-000000000004','e7000000-0000-4000-8000-000000000006','PRESERVE-CI-001','Historical contract','e7000000-0000-4000-8000-000000000002','ativo',1000);

-- Only admins from the appropriate organization can view blocked members'
-- profiles; no stale access should remain after deletion of the membership.
set local role authenticated;
select set_config('request.jwt.claim.sub','e7000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.organization_members set status='suspended'
where organization_id='e7000000-0000-4000-8000-000000000004'
  and user_id='e7000000-0000-4000-8000-000000000002';

do $verify$
begin
  if not exists(
    select 1 from public.profiles where id='e7000000-0000-4000-8000-000000000002'
      and email='member-target-ci@example.invalid'
  ) then raise exception 'Admin cannot see blocked member contact'; end if;
end;
$verify$;

delete from public.organization_members
where organization_id='e7000000-0000-4000-8000-000000000004'
  and user_id='e7000000-0000-4000-8000-000000000002';

do $verify$
begin
  if exists(select 1 from public.organization_members
    where organization_id='e7000000-0000-4000-8000-000000000004'
      and user_id='e7000000-0000-4000-8000-000000000002')
  then raise exception 'Removed user still listed as active, invited or blocked'; end if;
  if not exists(select 1 from public.organization_members
    where organization_id='e7000000-0000-4000-8000-000000000005'
      and user_id='e7000000-0000-4000-8000-000000000002'
      and status='active')
  then raise exception 'Membership in another organization was removed'; end if;
  if not exists(select 1 from public.profiles
    where id='e7000000-0000-4000-8000-000000000002')
  then raise exception 'Global profile was deleted'; end if;
  if not exists(select 1 from public.contracts
    where id='e7000000-0000-4000-8000-000000000007'
      and created_by='e7000000-0000-4000-8000-000000000002')
  then raise exception 'Historical contract or author attribution lost'; end if;
  if not exists(select 1 from public.audit_logs
    where entity_type='contracts' and entity_id='e7000000-0000-4000-8000-000000000007')
  then raise exception 'Historical audit entries were lost'; end if;
end;
$verify$;

-- An invited record can be re-created for the same Auth ID and email.
insert into public.organization_members(organization_id,user_id,role,status)
values ('e7000000-0000-4000-8000-000000000004','e7000000-0000-4000-8000-000000000002','gestor','invited');

do $verify$
declare blocked boolean := false;
begin
  if not exists(select 1 from public.organization_members
    where organization_id='e7000000-0000-4000-8000-000000000004'
      and user_id='e7000000-0000-4000-8000-000000000002'
      and status='invited')
  then raise exception 'Same email cannot be reinvited'; end if;
  begin
    delete from public.organization_members
    where organization_id='e7000000-0000-4000-8000-000000000004'
      and user_id='e7000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Last active administrator could be removed'; end if;
end;
$verify$;

reset role;
rollback;
