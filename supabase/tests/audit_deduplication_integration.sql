-- CI-only audit regression test. Uses fictitious rows and rolls everything back.
begin;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values('a2000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','audit-ci@example.invalid',now(),now());
insert into public.organizations(id,name)
values('a2000000-0000-4000-8000-000000000002','Audit CI Organization');
insert into public.organization_members(organization_id,user_id,role,status,accepted_at)
values('a2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001',
  'organization_admin','active',now());

insert into public.suppliers(
  id,organization_id,legal_name,cnpj,email,phone,address,created_by
) values (
  'a2000000-0000-4000-8000-000000000003',
  'a2000000-0000-4000-8000-000000000002',
  'Fornecedor Fictício de Auditoria','12345678000195','audit@example.invalid',
  '+55 11 5555-0101','Rua de Teste, 10',
  'a2000000-0000-4000-8000-000000000001'
);
update public.suppliers set phone='+55 11 5555-0102'
where id='a2000000-0000-4000-8000-000000000003';

insert into public.contracts(
  id,organization_id,supplier_id,contract_number,object,total_value,notes,created_by
) values (
  'a2000000-0000-4000-8000-000000000004',
  'a2000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000003',
  'AUDIT-CI-001','Objeto fictício de homologação',1000,
  'conteúdo privado de teste','a2000000-0000-4000-8000-000000000001'
);
update public.contracts set notes='nova nota privada de teste'
where id='a2000000-0000-4000-8000-000000000004';

do $verify$
declare
  supplier_events integer;
  contract_events integer;
  unsafe_payloads integer;
  duplicate_triggers integer;
begin
  select count(*) into supplier_events from public.audit_logs
  where entity_type='suppliers' and entity_id='a2000000-0000-4000-8000-000000000003';
  select count(*) into contract_events from public.audit_logs
  where entity_type='contracts' and entity_id='a2000000-0000-4000-8000-000000000004';
  if supplier_events<>2 or contract_events<>2 then
    raise exception 'Expected one audit event per supplier/contract write; got %, %',
      supplier_events,contract_events;
  end if;

  select count(*) into unsafe_payloads from public.audit_logs
  where entity_id in (
    'a2000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000004'
  ) and (
    coalesce(old_data,'{}'::jsonb) ?| array[
      'email','phone','address','postal_code','contact_name','cnpj','token_hash',
      'signed_by','created_by','updated_by',
      'attachment_path','storage_path','notes','description','content','comments',
      'resolution','ai_summary','ai_risks','clauses'
    ] or coalesce(new_data,'{}'::jsonb) ?| array[
      'email','phone','address','postal_code','contact_name','cnpj','token_hash',
      'signed_by','created_by','updated_by',
      'attachment_path','storage_path','notes','description','content','comments',
      'resolution','ai_summary','ai_risks','clauses'
    ]
  );
  if unsafe_payloads<>0 then
    raise exception 'Audit payload contains fields that must be redacted';
  end if;

  select count(*) into duplicate_triggers
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('suppliers','contracts')
    and not t.tgisinternal
    and t.tgname in ('suppliers_audit','contracts_audit');
  if duplicate_triggers<>0 then
    raise exception 'Legacy duplicate audit triggers remain';
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='suppliers'
      and t.tgname='suppliers_audit_changes' and not t.tgisinternal
  ) or not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='contracts'
      and t.tgname='contracts_audit_changes' and not t.tgisinternal
  ) then
    raise exception 'Secure audit triggers are missing';
  end if;
end;
$verify$;

rollback;
