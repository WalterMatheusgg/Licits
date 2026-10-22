-- CI ONLY: supplier and contract creation is atomic and duplicate-safe.
begin;
insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values ('c1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','integration-ci@example.invalid',now(),now());
insert into public.organizations(id,name)
values ('c1000000-0000-4000-8000-000000000002','LICITS INTEGRATION CI');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values ('c1000000-0000-4000-8000-000000000002',
 'c1000000-0000-4000-8000-000000000001','organization_admin','active',now());

select public.create_integrated_contract(
 'c1000000-0000-4000-8000-000000000002',
 'c1000000-0000-4000-8000-000000000001',
 'API-CI-001','Contrato de integração atômica','Fornecedor válido','12345678000190',2500
);

do $check$
declare duplicate_rejected boolean:=false; credential jsonb; credential_id uuid;
 contract_id uuid; updated jsonb;
begin
 begin
  perform public.create_integrated_contract(
   'c1000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000001',
   'API-CI-001','Número duplicado','Fornecedor que não deve persistir','98765432000190',1000
  );
 exception when unique_violation then duplicate_rejected:=true;
 end;
 if not duplicate_rejected then raise exception 'Duplicate contract number was accepted'; end if;
 if (select count(*) from public.contracts where organization_id='c1000000-0000-4000-8000-000000000002')<>1
 then raise exception 'Unexpected contract persisted'; end if;
 if (select count(*) from public.suppliers where organization_id='c1000000-0000-4000-8000-000000000002')<>1
 then raise exception 'Supplier insert was not rolled back with failed contract'; end if;
 select id into contract_id from public.contracts
 where organization_id='c1000000-0000-4000-8000-000000000002' and contract_number='API-CI-001';
 updated:=public.update_integrated_contract(
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',contract_id,
  '{"notes":"Atualização auditada"}'::jsonb
 );
 if updated->>'id'<>contract_id::text or
   (select notes from public.contracts where id=contract_id)<>'Atualização auditada'
 then raise exception 'Contract update was not applied'; end if;
 if (select count(*) from public.audit_logs where entity_id=contract_id and entity_type='contract'
   and action in ('create','update'))<>2
 then raise exception 'Contract create/update was not audited'; end if;
 if not exists (select 1 from public.audit_logs where entity_id=contract_id and action='update'
   and metadata->'changed_fields' ? 'notes'
   and not (old_data ? 'notes') and not (new_data ? 'notes'))
 then raise exception 'Update audit must record changed fields without storing sensitive notes'; end if;
 if has_function_privilege('authenticated',
   'public.create_integrated_contract(uuid,uuid,text,text,text,text,numeric)','EXECUTE')
 then raise exception 'Authenticated role can bypass the integration gateway'; end if;
 credential:=public.create_integration_credential(
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'ERP CI',repeat('a',64),array['contracts:read'],null
 );
 credential_id:=(credential->>'id')::uuid;
 perform public.revoke_integration_credential(
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',credential_id
 );
 if (select count(*) from public.audit_logs where entity_id=credential_id
   and entity_type='integration_credential')<>2
 then raise exception 'Credential lifecycle was not audited'; end if;
 if has_table_privilege('authenticated','public.integration_credentials','SELECT')
 then raise exception 'Authenticated role can read integration credential hashes'; end if;
end
$check$;
rollback;