-- Local Supabase integration test. All data rolls back.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values('e1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','import-ci@example.invalid',now(),now());
insert into public.organizations(id,name)
values('e1000000-0000-4000-8000-000000000002','Document import CI');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values('e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',
'organization_admin','active',now());
insert into storage.objects(bucket_id,name,owner_id)
values('contracts','e1000000-0000-4000-8000-000000000002/ci-contract.pdf',
'e1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.import_contract_document_atomic(
'e1000000-0000-4000-8000-000000000002',
'{"contract_number":"IMP-CI-001","object":"Material de expediente","supplier_name":"Fornecedor CI","total_value":1500,"start_date":"2026-10-01","end_date":"2027-10-01"}'::jsonb,
'e1000000-0000-4000-8000-000000000002/ci-contract.pdf',
'ci-contract.pdf','application/pdf',1200,
'[{"item_number":"1","description":"Resma A4","unit":"un","quantity":10,"unit_price":20}]'::jsonb);

do $check$
declare
  v_id uuid;
  rejected boolean := false;
begin
  select id into v_id from public.contracts where contract_number='IMP-CI-001';
  if v_id is null then raise exception 'Atomic contract was not inserted'; end if;
  if (select count(*) from public.documents where contract_id=v_id)<>1 then
    raise exception 'Document was not attached'; end if;
  if (select count(*) from public.contract_items where contract_id=v_id)<>1 then
    raise exception 'Item was not inserted'; end if;
  if not exists(select 1 from public.contracts
    where id=v_id and source_document_id in(select id from public.documents where contract_id=v_id)) then
    raise exception 'Source document link is missing'; end if;

  begin
    perform public.import_contract_document_atomic(
    'e1000000-0000-4000-8000-000000000002',
    '{"contract_number":"IMP-CI-ROLLBACK","object":"Teste rollback","supplier_name":"Fornecedor Rollback","total_value":200}'::jsonb,
    'e1000000-0000-4000-8000-000000000002/ci-contract.pdf',
    'ci-contract.pdf','application/pdf',1200,
    '[{"description":"Quantidade inválida","quantity":-1,"unit_price":10}]'::jsonb);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Invalid import unexpectedly succeeded'; end if;
  if exists(select 1 from public.contracts where contract_number='IMP-CI-ROLLBACK')
     or exists(select 1 from public.suppliers where legal_name='Fornecedor Rollback') then
    raise exception 'Failed import left a partial contract or supplier'; end if;
  if has_function_privilege('anon',
    'public.import_contract_document_atomic(uuid,jsonb,text,text,text,bigint,jsonb)','EXECUTE') then
    raise exception 'Anonymous role can import contracts'; end if;
end;
$check$;
rollback;
