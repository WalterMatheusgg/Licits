-- CI ONLY: durable, deduplicated 30/7/1/0-day expiry alerts and worker claims.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values ('b1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','expiry-ci@example.invalid',now(),now());
insert into public.organizations(id,name)
values ('b1000000-0000-4000-8000-000000000002','LICITS EXPIRY CI');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values ('b1000000-0000-4000-8000-000000000002',
 'b1000000-0000-4000-8000-000000000001','organization_admin','active',now());
insert into public.suppliers(id,organization_id,legal_name)
values ('b1000000-0000-4000-8000-000000000003',
 'b1000000-0000-4000-8000-000000000002','Fornecedor fictício de expiração');
insert into public.contracts(
 id,organization_id,supplier_id,contract_number,object,status,total_value,end_date
) values
 ('b1000000-0000-4000-8000-000000000010','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','EXP-30','Teste 30 dias','ativo',1000,current_date+30),
 ('b1000000-0000-4000-8000-000000000011','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','EXP-7','Teste 7 dias','ativo',1000,current_date+7),
 ('b1000000-0000-4000-8000-000000000012','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','EXP-1','Teste 1 dia','ativo',1000,current_date+1),
 ('b1000000-0000-4000-8000-000000000013','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','EXP-0','Teste vencimento hoje','ativo',1000,current_date);

do $check$
declare inserted integer;
begin
 inserted:=public.enqueue_contract_expiry_alerts();
 if inserted<>4 then raise exception 'Expected 4 expiry alerts, got %',inserted; end if;
 if (select count(*) from public.contract_expiry_alerts where organization_id='b1000000-0000-4000-8000-000000000002')<>4
 then raise exception 'Expected one expiry alert at each threshold'; end if;
 if public.enqueue_contract_expiry_alerts()<>0 then raise exception 'Expiry alerts were not deduplicated'; end if;
end
$check$;

set local role service_role;
do $claim$
declare claimed integer;
begin
 select count(*) into claimed from public.claim_contract_expiry_alerts(20);
 if claimed<>4 then raise exception 'Expected 4 worker claims, got %',claimed; end if;
 if (select count(*) from public.claim_contract_expiry_alerts(20))<>0
 then raise exception 'Processing expiry alerts were claimed twice'; end if;
end
$claim$;
rollback;