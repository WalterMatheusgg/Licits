-- Integration smoke test. Run ONLY against an isolated local Supabase database.
-- Everything is rolled back. No real users or secrets are involved.
begin;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','licits-a-test@example.invalid',now(),now()),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','licits-b-test@example.invalid',now(),now());

insert into public.organizations(id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CI Organization A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','CI Organization B');

insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','organization_admin','active',now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','organization_admin','active',now());

insert into public.suppliers(id,organization_id,legal_name,created_by)
values
 ('c1111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Supplier A','11111111-1111-4111-8111-111111111111'),
 ('c2222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Supplier B','22222222-2222-4222-8222-222222222222');

insert into public.contracts(id,organization_id,supplier_id,contract_number,object,created_by,status,total_value)
values('d1111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','c1111111-1111-4111-8111-111111111111',
 'CI-CONTRACT-A','Contract A Test','11111111-1111-4111-8111-111111111111','ativo',1000);

insert into public.price_registrations(id,organization_id,auction_number,object,created_by)
values('e1111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CI-ARP-001','ARP A Test','11111111-1111-4111-8111-111111111111');

insert into public.price_registration_groups(id,organization_id,price_registration_id,supplier_id,arp_number,created_by)
values('e2222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1111111-1111-4111-8111-111111111111',
 'c1111111-1111-4111-8111-111111111111','CI-ARP-GROUP-001',
 '11111111-1111-4111-8111-111111111111');

insert into public.contract_items(
  id,organization_id,contract_id,description,contracted_qty,created_by,unit_price)
values('f1111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','d1111111-1111-4111-8111-111111111111',
 'Contract stock',10,'11111111-1111-4111-8111-111111111111',100);

insert into public.contract_items(
  id,organization_id,price_registration_group_id,description,contracted_qty,created_by)
values('f2222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e2222222-2222-4222-8222-222222222222',
 'ARP stock',10,'11111111-1111-4111-8111-111111111111');

-- Simulate the JWT of user A, without any service-role bypass.
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
begin
 if (select count(*) from public.suppliers) <> 1 then
   raise exception 'Tenant isolation failure: user A sees suppliers outside A';
 end if;
 if public.is_organization_member('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
   raise exception 'Tenant isolation failure: user A has access to B';
 end if;
end;
$$;

-- RLS must reject cross-tenant insert.
do $$
declare rejected boolean := false;
begin
 begin
  insert into public.suppliers(organization_id,legal_name,created_by)
  values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Unauthorized Supplier',
   '11111111-1111-4111-8111-111111111111');
 exception when insufficient_privilege then rejected := true;
 end;
 if not rejected then raise exception 'Tenant B accepted write from user A'; end if;
end;
$$;

-- Both normal contract and price registration inventory use one atomic RPC.
select public.register_item_withdrawal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'f1111111-1111-4111-8111-111111111111',3,'OS-CI','2026-10-20','test');
select public.register_item_withdrawal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'f2222222-2222-4222-8222-222222222222',2,'OS-CI-ARP','2026-10-20','test');

do $$
begin
 if (select used_qty from public.contract_items where id='f1111111-1111-4111-8111-111111111111') <> 3 then
   raise exception 'Contract stock withdrawal failed';
 end if;
 if (select used_qty from public.contract_items where id='f2222222-2222-4222-8222-222222222222') <> 2 then
   raise exception 'ARP stock withdrawal failed';
 end if;
 if not exists(select 1 from public.item_withdrawals where
   price_registration_group_id='e2222222-2222-4222-8222-222222222222' and contract_id is null) then
   raise exception 'ARP withdrawal is linked to wrong parent';
 end if;
end;
$$;

do $$
declare rejected boolean := false;
begin
 begin
  perform public.register_item_withdrawal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'f1111111-1111-4111-8111-111111111111',999,'OS-OVER');
 exception when others then
   if sqlerrm like '%excede o saldo%' then rejected := true; end if;
 end;
 if not rejected then raise exception 'Overconsumption not rejected'; end if;
end;
$$;

-- Functional CRUD: create, update, read and soft-delete business records.
-- All changes remain isolated in this transaction.
insert into public.contracts(id,organization_id,supplier_id,contract_number,object,total_value)
values ('d3333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'c1111111-1111-4111-8111-111111111111','CI-CRUD-001','Initial contract',500);
update public.contracts set object='Updated contract', status='ativo'
where id='d3333333-3333-4333-8333-333333333333';
do $verify$ begin
 if not exists (select 1 from public.contracts where
  id='d3333333-3333-4333-8333-333333333333'
  and object='Updated contract' and status='ativo')
 then raise exception 'Contract create/update/read failed'; end if;
end $verify$;

insert into public.documents(id,organization_id,contract_id,title,document_type,storage_bucket,storage_path)
values ('d4444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'd3333333-3333-4333-8333-333333333333',
  'Document original','contrato','generated-documents',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ci-test.pdf');
update public.documents set title='Document updated'
 where id='d4444444-4444-4444-8444-444444444444';

insert into public.fiscal_records(id,organization_id,contract_id,record_type,title,description,document_id)
values('d5555555-5555-4555-8555-555555555555',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'd3333333-3333-4333-8333-333333333333','vistoria',
 'Fiscal record','Inspection started','d4444444-4444-4444-8444-444444444444');
update public.fiscal_records set status='concluido',description='Inspection completed'
 where id='d5555555-5555-4555-8555-555555555555';

insert into public.occurrences(id,organization_id,contract_id,title,content,severity)
values('d6666666-6666-4666-8666-666666666666',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'd3333333-3333-4333-8333-333333333333',
 'Late delivery','Delivery was delayed','alta');
update public.occurrences
 set status='resolvida',resolved_by=auth.uid(),resolved_at=now(),resolution='Delivered'
 where id='d6666666-6666-4666-8666-666666666666';

update public.price_registrations set object='Updated ARP'
 where id='e1111111-1111-4111-8111-111111111111';
update public.price_registration_groups set notes='Supplier verified'
 where id='e2222222-2222-4222-8222-222222222222';

insert into public.admin_requests(id,organization_id,request_type,description,entity_type,entity_id)
values('d7777777-7777-4777-8777-777777777777',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ajuste','Correct contract object','contrato','d3333333-3333-4333-8333-333333333333');
update public.admin_requests
 set status='aprovado', resolved_by=auth.uid(),resolved_at=now(),
 admin_response='Verified'
 where id='d7777777-7777-4777-8777-777777777777';

do $verify$ begin
 if not exists (select 1 from public.documents where id='d4444444-4444-4444-8444-444444444444' and title='Document updated')
 then raise exception 'Document CRUD failed'; end if;
 if not exists (select 1 from public.fiscal_records where id='d5555555-5555-4555-8555-555555555555' and status='concluido')
 then raise exception 'Fiscal CRUD failed'; end if;
 if not exists (select 1 from public.occurrences where id='d6666666-6666-4666-8666-666666666666' and status='resolvida')
 then raise exception 'Occurrence CRUD failed'; end if;
 if not exists (select 1 from public.price_registrations where id='e1111111-1111-4111-8111-111111111111' and object='Updated ARP')
 then raise exception 'Price registration CRUD failed'; end if;
 if not exists (select 1 from public.price_registration_groups where id='e2222222-2222-4222-8222-222222222222' and notes='Supplier verified')
 then raise exception 'ARP group update failed'; end if;
 if not exists (select 1 from public.admin_requests where id='d7777777-7777-4777-8777-777777777777' and status='aprovado')
 then raise exception 'Administrative request workflow failed'; end if;
end $verify$;

-- Soft deletion, audit trail and tenant visibility.
select public.archive_business_record('contracts','d3333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.archive_business_record('documents','d4444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.archive_business_record('fiscal_records','d5555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.archive_business_record('occurrences','d6666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

do $verify$ begin
 if exists(select 1 from public.contracts where id='d3333333-3333-4333-8333-333333333333')
 then raise exception 'Contract soft delete still visible under RLS'; end if;
 if exists(select 1 from public.documents where id='d4444444-4444-4444-8444-444444444444')
 then raise exception 'Document soft delete still visible under RLS'; end if;
 if exists(select 1 from public.fiscal_records where id='d5555555-5555-4555-8555-555555555555')
 then raise exception 'Fiscal soft delete still visible under RLS'; end if;
 if exists(select 1 from public.occurrences where id='d6666666-6666-4666-8666-666666666666')
 then raise exception 'Occurrence soft delete still visible under RLS'; end if;
 if not exists (select 1 from public.audit_logs where entity_id='d3333333-3333-4333-8333-333333333333' and action='update')
 then raise exception 'Audit event missing for contract'; end if;
end $verify$;

-- User B must never access User A's business rows via read or write.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $verify$ begin
 if exists(select 1 from public.price_registrations where id='e1111111-1111-4111-8111-111111111111')
 then raise exception 'Cross-tenant ARP read permitted'; end if;
 if exists(select 1 from public.admin_requests where id='d7777777-7777-4777-8777-777777777777')
 then raise exception 'Cross-tenant admin request leak'; end if;
end $verify$;
do $verify$ begin
 update public.price_registration_groups set notes='Unauthorized cross-tenant update'
 where id='e2222222-2222-4222-8222-222222222222';
 if found then raise exception 'Cross-tenant group update permitted'; end if;
end $verify$;
-- Functional validation: rejected inputs must not mutate valid business rows.
-- Existing fixtures use tenant A and authenticated user B at this point.
-- Switch back to user A to verify same-tenant integrity and failures.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $functional_negative$
declare rejected boolean; rows_affected integer;
begin
 -- Contract dates: invalid end date is blocked.
 rejected := false;
 begin
   update public.contracts set start_date='2026-10-20', end_date='2026-10-19'
   where id='d1111111-1111-4111-8111-111111111111';
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Contract accepted end_date before start_date'; end if;

 -- Contract values: budget must never be negative.
 rejected := false;
 begin
   update public.contracts set total_value=-1
   where id='d1111111-1111-4111-8111-111111111111';
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Contract accepted negative budget'; end if;

 -- Item quantities: no negative contracted quantities.
 rejected := false;
 begin
   update public.contract_items set contracted_qty=-1
   where id='f1111111-1111-4111-8111-111111111111';
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Contract item accepted negative quantity'; end if;

 -- Direct consumption editing cannot bypass the atomic withdrawal procedure.
 rejected := false;
 begin
   update public.contract_items set used_qty=used_qty+1
   where id='f1111111-1111-4111-8111-111111111111';
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception 'Direct stock consumption mutation permitted'; end if;

 -- Contract cannot link an external organization's supplier.
 rejected := false;
 begin
   update public.contracts
   set supplier_id='c2222222-2222-4222-8222-222222222222'
   where id='d1111111-1111-4111-8111-111111111111';
 exception when foreign_key_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Contract accepted cross-organization supplier'; end if;

 -- A document must reference a contract in the same organization.
 rejected := false;
 begin
   insert into public.documents(organization_id,contract_id,title,document_type,storage_bucket,storage_path)
   values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'd1111111-1111-4111-8111-111111111111',
          'Invalid reference','contrato','generated-documents','blocked/test.pdf');
 exception when foreign_key_violation or insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'Cross-tenant document attachment accepted'; end if;

 -- An inventory item cannot belong to both a contract and an ARP group.
 rejected := false;
 begin
   insert into public.contract_items(organization_id,contract_id,price_registration_group_id,description,contracted_qty)
   values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'd1111111-1111-4111-8111-111111111111',
          'e2222222-2222-4222-8222-222222222222',
          'Invalid dual parent',1);
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Contract/ARP item accepted two parent records'; end if;

 -- Zero-unit withdrawal is never acceptable.
 rejected := false;
 begin
   perform public.register_item_withdrawal(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
     'f1111111-1111-4111-8111-111111111111',
     0,'OS-ZERO','2026-10-20','Invalid input');
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception 'Zero-quantity withdrawal accepted'; end if;

 -- Existing valid fixtures remain unchanged after all rejected inputs.
 if (select used_qty from public.contract_items
     where id='f1111111-1111-4111-8111-111111111111') <> 3 then
   raise exception 'Rejected input changed consumption';
 end if;
 if (select supplier_id from public.contracts
     where id='d1111111-1111-4111-8111-111111111111')
     is distinct from 'c1111111-1111-4111-8111-111111111111'::uuid then
   raise exception 'Rejected input changed contract supplier';
 end if;
end $functional_negative$;

rollback;
