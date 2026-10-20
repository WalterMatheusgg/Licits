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

insert into public.contracts(id,organization_id,supplier_id,contract_number,object,created_by)
values('d1111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','c1111111-1111-4111-8111-111111111111',
 'CI-CONTRACT-A','Contract A Test','11111111-1111-4111-8111-111111111111');

insert into public.price_registrations(id,organization_id,auction_number,object,created_by)
values('e1111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CI-ARP-001','ARP A Test','11111111-1111-4111-8111-111111111111');

insert into public.price_registration_groups(id,organization_id,price_registration_id,supplier_id,arp_number,created_by)
values('e2222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1111111-1111-4111-8111-111111111111',
 'c1111111-1111-4111-8111-111111111111','CI-ARP-GROUP-001',
 '11111111-1111-4111-8111-111111111111');

insert into public.contract_items(
  id,organization_id,contract_id,description,contracted_qty,created_by)
values('f1111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','d1111111-1111-4111-8111-111111111111',
 'Contract stock',10,'11111111-1111-4111-8111-111111111111');

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
   if sqlerrm like '%exceeds available balance%' then rejected := true; end if;
 end;
 if not rejected then raise exception 'Overconsumption not rejected'; end if;
end;
$$;
rollback;
