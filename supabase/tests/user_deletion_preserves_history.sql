begin;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values('a3000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','delete-history@example.invalid',now(),now());
insert into public.organizations(id,name)
values('a3000000-0000-4000-8000-000000000002','Delete History CI Organization');
insert into public.suppliers(id,organization_id,legal_name,created_by)
values(
  'a3000000-0000-4000-8000-000000000005',
  'a3000000-0000-4000-8000-000000000002',
  'Historical supplier',
  'a3000000-0000-4000-8000-000000000001'
);
insert into public.contracts(
  id,organization_id,supplier_id,contract_number,object,created_by
) values (
  'a3000000-0000-4000-8000-000000000006',
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000005',
  'DELETE-HISTORY-001','Contract history must remain.',
  'a3000000-0000-4000-8000-000000000001'
);
insert into public.occurrences(
  id,organization_id,contract_id,title,content,registered_by
) values (
  'a3000000-0000-4000-8000-000000000007',
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000006',
  'Historical occurrence','Occurrence content must remain.',
  'a3000000-0000-4000-8000-000000000001'
);
insert into public.admin_requests(
  id,organization_id,requester_id,request_type,description
) values (
  'a3000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001',
  'outro','Historical request content must remain after its requester is removed.'
);
insert into public.audit_logs(
  organization_id,user_id,action,entity_type,entity_id,metadata
) values (
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001',
  'create','admin_requests','a3000000-0000-4000-8000-000000000003',
  '{"test":"user deletion preserves audit event"}'::jsonb
);
insert into public.integration_usage(
  organization_id,user_id,operation,usage_day,requests
) values (
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001',
  'invite-member',current_date,1
);

delete from auth.users where id='a3000000-0000-4000-8000-000000000001';

do $verify$
begin
  if exists(select 1 from auth.users where id='a3000000-0000-4000-8000-000000000001')
     or exists(select 1 from public.profiles where id='a3000000-0000-4000-8000-000000000001') then
    raise exception 'Deleted identity or profile still exists';
  end if;
  if not exists(
    select 1 from public.admin_requests
    where id='a3000000-0000-4000-8000-000000000003'
      and requester_id is null
      and description='Historical request content must remain after its requester is removed.'
  ) then
    raise exception 'Historical business request was not preserved';
  end if;
  if not exists(
    select 1 from public.contracts
    where id='a3000000-0000-4000-8000-000000000006'
      and object='Contract history must remain.'
      and created_by is null
  ) then
    raise exception 'Historical contract was not preserved';
  end if;
  if not exists(
    select 1 from public.occurrences
    where id='a3000000-0000-4000-8000-000000000007'
      and content='Occurrence content must remain.'
      and registered_by is null
  ) then
    raise exception 'Historical occurrence was not preserved';
  end if;
  if not exists(
    select 1 from public.audit_logs
    where entity_id='a3000000-0000-4000-8000-000000000003'
      and user_id is null
      and metadata->>'test'='user deletion preserves audit event'
  ) then
    raise exception 'Historical audit event was not preserved';
  end if;
  if not exists(
    select 1 from public.integration_usage
    where organization_id='a3000000-0000-4000-8000-000000000002'
      and user_id='a3000000-0000-4000-8000-000000000001'
      and operation='invite-member'
  ) then
    raise exception 'Integration usage history was not preserved';
  end if;
end;
$verify$;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values('a3000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','delete-history@example.invalid',now(),now());

do $verify_reinvite$
begin
  if not exists(
    select 1 from public.profiles
    where id='a3000000-0000-4000-8000-000000000004'
      and email='delete-history@example.invalid'
  ) then
    raise exception 'The deleted email could not be registered again';
  end if;
end;
$verify_reinvite$;

rollback;
