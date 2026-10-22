insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values ('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','concurrent-ci@example.invalid',now(),now());
insert into public.organizations(id,name)
values ('d1000000-0000-4000-8000-000000000002','LICITS CONCURRENCY CI');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values ('d1000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000001','organization_admin','active',now());
insert into public.suppliers(id,organization_id,legal_name)
values ('d1000000-0000-4000-8000-000000000003',
 'd1000000-0000-4000-8000-000000000002','Fornecedor fictício concorrente');
insert into public.contracts(
 id,organization_id,supplier_id,contract_number,object,status,total_value,start_date,end_date
) values (
 'd1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000003','CONCURRENT-CI','Teste de compra concorrente',
 'ativo',1000,current_date-1,current_date+365
);
insert into public.contract_items(
 id,organization_id,contract_id,item_number,description,unit,contracted_qty,unit_price
) values (
 'd1000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000004','1','Item concorrente','UN',100,10
);