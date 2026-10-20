-- Integration tests for member invitations, administrative continuity and usage quotas.
-- Safe only for a disposable Supabase local database; all test data is rolled back.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
 ('b1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','licits-admin@example.invalid',now(),now()),
 ('b2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','licits-invitee@example.invalid',now(),now());
insert into public.organizations(id,name)
values('b3333333-3333-4333-8333-333333333333','Invitation CI Organization');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values ('b3333333-3333-4333-8333-333333333333','b1111111-1111-4111-8111-111111111111','organization_admin','active',now()),
('b3333333-3333-4333-8333-333333333333','b2222222-2222-4222-8222-222222222222','visualizador','invited',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $check$
declare prevented boolean := false;
begin
 begin
   update public.organization_members
   set status='active',accepted_at=now()
   where organization_id='b3333333-3333-4333-8333-333333333333'
   and user_id='b2222222-2222-4222-8222-222222222222';
 exception when others then prevented := true;
 end;
 if not prevented then raise exception 'Admin prematurely activated another user'; end if;
end;
$check$;

do $check$
declare prevented boolean := false;
begin
 begin
   update public.organization_members set role='gestor'
   where organization_id='b3333333-3333-4333-8333-333333333333'
   and user_id='b1111111-1111-4111-8111-111111111111';
 exception when others then prevented := true;
 end;
 if not prevented then raise exception 'Final active admin was demoted'; end if;
end;
$check$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $check$
declare prevented boolean := false;
begin
 begin
   perform public.accept_organization_invitation('b3333333-3333-4333-8333-333333333333');
 exception when others then prevented := true;
 end;
 if not prevented then raise exception 'Unverified user accepted invitation'; end if;
end;
$check$;

reset role;
update auth.users set email_confirmed_at=now()
where id='b2222222-2222-4222-8222-222222222222';
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
select public.accept_organization_invitation('b3333333-3333-4333-8333-333333333333');
do $check$
begin
 if not public.is_organization_member('b3333333-3333-4333-8333-333333333333') then
   raise exception 'Verified invitee cannot access accepted org'; end if;
 if not exists (
   select 1 from public.organization_members where
   user_id='b2222222-2222-4222-8222-222222222222'
   and organization_id='b3333333-3333-4333-8333-333333333333'
   and status='active' and accepted_at is not null
 ) then raise exception 'Accept did not persist membership'; end if;
end;
$check$;
reset role;
set local role service_role;
do $check$
declare i integer;
declare prevented boolean := false;
begin
 for i in 1..5 loop
   perform public.reserve_integration_capacity(
   'b3333333-3333-4333-8333-333333333333',
   'b1111111-1111-4111-8111-111111111111',
   'extract-document');
 end loop;
 begin
   perform public.reserve_integration_capacity(
   'b3333333-3333-4333-8333-333333333333',
   'b1111111-1111-4111-8111-111111111111',
   'extract-document');
 exception when others then
   if sqlerrm like 'Daily integration quota reached%' then prevented := true; end if;
 end;
 if not prevented then raise exception 'Cost quota can be bypassed'; end if;
end;
$check$;
rollback;
