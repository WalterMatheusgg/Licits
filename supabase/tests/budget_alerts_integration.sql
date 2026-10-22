-- CI ONLY: monetary controls, 50% use, 80/90/100 alerts, budget ceiling.
-- All changes are rolled back. Run with psql against disposable local Supabase.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values ('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','fiscal-demo-ci@example.invalid',now(),now());
insert into public.organizations(id,name) values
 ('a1000000-0000-4000-8000-000000000002','LICITS CI DEMO');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values ('a1000000-0000-4000-8000-000000000002',
'a1000000-0000-4000-8000-000000000001','organization_admin','active',now());
insert into public.suppliers(id,organization_id,legal_name)
values('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','Fornecedor Ficticio');
insert into public.contracts(
  id,organization_id,supplier_id,contract_number,object,status,total_value,fiscal_user_id,
  start_date,end_date
) values(
 'a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000003','014/2026-LICITS-DEMO','Materiais de TI',
 'ativo',100000,'a1000000-0000-4000-8000-000000000001','2026-10-01','2027-09-30'
);
insert into public.contract_items(
 id,organization_id,contract_id,description,contracted_qty,unit_price
) values(
 'a1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000004','Kit de suporte de TI',100,1000
),(
 'a1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000004','Item adicional para testar orçamento',10,5000
);
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
-- Pre-existing 50 kits = 50% used, without warnings yet.
select public.register_item_withdrawal('a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000005',50,'OS-HIST-DEMO');
do $check$
declare f jsonb;
begin
 f:=public.preview_contract_purchase('a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000005',30);
 if (f->>'budget_used')::numeric <> 50000
 or (f->>'budget_available')::numeric <> 50000
 or (f->>'projected_percent')::numeric <> 80 or f->>'permitted'<>'true'
 then raise exception 'Preview from 50%% to 80%% incorrect: %',f; end if;
end
$check$;
-- Reach 80%, queue a single fiscal warning.
select public.register_item_withdrawal('a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000005',30,'OS-80-DEMO');
do $check$
declare f jsonb; denied boolean:=false;
begin
 f:=public.preview_contract_purchase('a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000006',5);
 if f->>'permitted'<>'false' or f->>'reason'<>'Valor ultrapassa o orçamento disponível'
 then raise exception 'Budget-only preview should be denied: %',f; end if;
 begin
  perform public.register_item_withdrawal('a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000006',5,'OS-OVER-BUDGET-DEMO');
 exception when others then
  denied:=sqlerrm like '%ultrapassaria o valor global%';
 end;
 if not denied then raise exception 'Global contract overspending was allowed'; end if;
 if (select count(*) from public.contract_budget_alerts where threshold_percent=80)<>1
 then raise exception '80 percent alert was not queued'; end if;
end
$check$;
-- Reach 90% and 100% without duplicating warnings.
select public.register_item_withdrawal('a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000005',10,'OS-90-DEMO');
select public.register_item_withdrawal('a1000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000005',10,'OS-100-DEMO');
do $check$
begin
 if (select used_value from public.contracts
   where id='a1000000-0000-4000-8000-000000000004')<>100000
 then raise exception 'Contract balance ledger incorrect'; end if;
 if (select used_qty from public.contract_items
   where id='a1000000-0000-4000-8000-000000000005')<>100
 then raise exception 'Item quantity ledger incorrect'; end if;
 if (select count(*) from public.contract_budget_alerts where
   contract_id='a1000000-0000-4000-8000-000000000004')<>3
 then raise exception 'Expected exactly one notification for each threshold'; end if;
 if (select count(*) from public.notifications where
   entity_id='a1000000-0000-4000-8000-000000000004' and type='orcamento')<>3
 then raise exception 'Fiscal in-app notifications missing'; end if;
end
$check$;
rollback;
