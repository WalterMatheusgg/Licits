create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (btrim(name) <> '' and length(name) <= 100),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) > 0 and scopes <@ array['contracts:read', 'contracts:write']::text[]
  ),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index integration_credentials_org_idx
  on public.integration_credentials (organization_id, created_at desc);
alter table public.integration_credentials enable row level security;
revoke all on public.integration_credentials from public, anon, authenticated;
grant all on public.integration_credentials to service_role;

create or replace function public.create_integrated_contract(
  p_organization_id uuid,
  p_user_id uuid,
  p_contract_number text,
  p_object text,
  p_supplier_name text,
  p_supplier_cnpj text,
  p_total_value numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $create_contract$
declare
  v_supplier_id uuid;
  v_cnpj text;
  v_contract public.contracts%rowtype;
begin
  if p_contract_number is null or btrim(p_contract_number) = '' or length(p_contract_number) > 100
     or p_object is null or btrim(p_object) = '' or length(p_object) > 10000
     or p_supplier_name is null or btrim(p_supplier_name) = '' or length(p_supplier_name) > 250
     or p_total_value is null or p_total_value < 0 then
    raise exception 'Invalid contract fields';
  end if;
  v_cnpj := nullif(regexp_replace(coalesce(p_supplier_cnpj, ''), '[^0-9]', '', 'g'), '');
  if v_cnpj is not null and length(v_cnpj) <> 14 then raise exception 'Invalid supplier CNPJ'; end if;

  if p_user_id is not null then
    if not exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      join public.profiles p on p.id = m.user_id
      where m.organization_id = p_organization_id and m.user_id = p_user_id
        and m.status = 'active' and m.role in ('organization_admin', 'gestor')
        and p.status = 'active' and o.status = 'active' and o.deleted_at is null
    ) then raise exception 'Active contract manager required'; end if;
  elsif not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active' and o.deleted_at is null
  ) then
    raise exception 'Active organization required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':supplier:' || coalesce(v_cnpj, lower(btrim(p_supplier_name))), 0
  ));
  if v_cnpj is not null then
    select id into v_supplier_id from public.suppliers
    where organization_id = p_organization_id and cnpj = v_cnpj and deleted_at is null limit 1;
  else
    select id into v_supplier_id from public.suppliers
    where organization_id = p_organization_id and legal_name = btrim(p_supplier_name) and deleted_at is null limit 1;
  end if;
  if v_supplier_id is null then
    insert into public.suppliers (organization_id, created_by, legal_name, cnpj)
    values (p_organization_id, p_user_id, btrim(p_supplier_name), v_cnpj)
    returning id into v_supplier_id;
  end if;

  insert into public.contracts (
    organization_id, created_by, supplier_id, contract_number, object, total_value, status
  ) values (
    p_organization_id, p_user_id, v_supplier_id, btrim(p_contract_number), btrim(p_object), p_total_value, 'em_analise'
  ) returning * into v_contract;

  return jsonb_build_object(
    'id', v_contract.id,
    'contract_number', v_contract.contract_number,
    'status', v_contract.status,
    'total_value', v_contract.total_value
  );
end;
$create_contract$;
revoke all on function public.create_integrated_contract(uuid, uuid, text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.create_integrated_contract(uuid, uuid, text, text, text, text, numeric) to service_role;

create or replace function public.create_integration_credential(
  p_organization_id uuid,
  p_user_id uuid,
  p_name text,
  p_token_hash text,
  p_scopes text[],
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $create_credential$
declare v_credential public.integration_credentials%rowtype;
begin
  if not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id and m.user_id = p_user_id
      and m.status = 'active' and m.role in ('organization_admin', 'gestor')
      and p.status = 'active' and o.status = 'active' and o.deleted_at is null
  ) then raise exception 'Active contract manager required'; end if;

  insert into public.integration_credentials (
    organization_id, name, token_hash, scopes, expires_at, created_by
  ) values (
    p_organization_id, btrim(p_name), p_token_hash, p_scopes, p_expires_at, p_user_id
  ) returning * into v_credential;

  return jsonb_build_object(
    'id', v_credential.id, 'name', v_credential.name, 'scopes', v_credential.scopes,
    'expires_at', v_credential.expires_at, 'created_at', v_credential.created_at
  );
end;
$create_credential$;
revoke all on function public.create_integration_credential(uuid, uuid, text, text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.create_integration_credential(uuid, uuid, text, text, text[], timestamptz) to service_role;

create or replace function public.revoke_integration_credential(
  p_organization_id uuid,
  p_user_id uuid,
  p_credential_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $revoke_credential$
declare v_credential public.integration_credentials%rowtype;
begin
  if not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id and m.user_id = p_user_id
      and m.status = 'active' and m.role in ('organization_admin', 'gestor')
      and p.status = 'active' and o.status = 'active' and o.deleted_at is null
  ) then raise exception 'Active contract manager required'; end if;

  select * into v_credential from public.integration_credentials
  where organization_id = p_organization_id and id = p_credential_id and revoked_at is null
  for update;
  if not found then raise exception 'Credential not found'; end if;
  update public.integration_credentials set revoked_at = now() where id = v_credential.id;
  return jsonb_build_object('id', v_credential.id, 'revoked', true);
end;
$revoke_credential$;
revoke all on function public.revoke_integration_credential(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_integration_credential(uuid, uuid, uuid) to service_role;

create or replace function public.update_integrated_contract(
  p_organization_id uuid,
  p_user_id uuid,
  p_contract_id uuid,
  p_updates jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $update_contract$
declare
  v_current public.contracts%rowtype;
  v_updated public.contracts%rowtype;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' or p_updates = '{}'::jsonb
     or exists (
       select 1 from jsonb_object_keys(p_updates) as field(key)
       where key not in (
         'contract_number','sei_number','auction_number','object','status','start_date','end_date',
         'total_value','modality','contract_type','responsible_sector','can_extend','extensions_done',
         'max_extensions','fiscal_status','notes'
       )
     ) then raise exception 'Invalid contract update fields'; end if;
  if p_user_id is not null then
    if not exists (
      select 1 from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      join public.profiles p on p.id = m.user_id
      where m.organization_id = p_organization_id and m.user_id = p_user_id
        and m.status = 'active' and m.role in ('organization_admin', 'gestor')
        and p.status = 'active' and o.status = 'active' and o.deleted_at is null
    ) then raise exception 'Active contract manager required'; end if;
  elsif not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.status = 'active' and o.deleted_at is null
  ) then
    raise exception 'Active organization required';
  end if;

  select * into v_current from public.contracts
  where organization_id = p_organization_id and id = p_contract_id and deleted_at is null
  for update;
  if not found then raise exception 'Contract not found'; end if;
  v_updated := jsonb_populate_record(v_current,p_updates);
  if v_updated.total_value < v_updated.used_value then raise exception 'Total value below used value'; end if;
  if v_updated.start_date is not null and v_updated.end_date is not null
     and v_updated.end_date < v_updated.start_date then raise exception 'Invalid contract dates'; end if;

  update public.contracts set
    contract_number=v_updated.contract_number, sei_number=v_updated.sei_number,
    auction_number=v_updated.auction_number, object=v_updated.object,
    status=v_updated.status, start_date=v_updated.start_date, end_date=v_updated.end_date,
    total_value=v_updated.total_value, modality=v_updated.modality,
    contract_type=v_updated.contract_type, responsible_sector=v_updated.responsible_sector,
    can_extend=v_updated.can_extend, extensions_done=v_updated.extensions_done,
    max_extensions=v_updated.max_extensions, fiscal_status=v_updated.fiscal_status,
    notes=v_updated.notes, updated_by=p_user_id
  where organization_id=p_organization_id and id=p_contract_id
  returning * into v_updated;

  return jsonb_build_object(
    'id',v_updated.id,'contract_number',v_updated.contract_number,'object',v_updated.object,
    'status',v_updated.status,'start_date',v_updated.start_date,'end_date',v_updated.end_date,
    'total_value',v_updated.total_value,'used_value',v_updated.used_value,'updated_at',v_updated.updated_at
  );
end;
$update_contract$;
revoke all on function public.update_integrated_contract(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_integrated_contract(uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.audit_business_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $audit$
declare
  v_old jsonb;
  v_new jsonb;
  v_organization_id uuid;
  v_entity_id uuid;
  v_user_id uuid;
  v_action text;
  v_changed text[] := array[]::text[];
  v_key text;
  v_redacted constant text[] := array[
    'token_hash','email','phone','address','postal_code','contact_name','cnpj',
    'attachment_path','storage_path','signed_by','created_by','updated_by',
    'notes','description','content','comments','resolution','ai_summary','ai_risks','clauses'
  ];
begin
  if tg_op = 'INSERT' then
    v_old := '{}'::jsonb;
    v_new := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := '{}'::jsonb;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  v_organization_id := coalesce(v_new->>'organization_id',v_old->>'organization_id')::uuid;
  if v_organization_id is null and tg_table_name = 'organizations' then
    v_organization_id := coalesce(v_new->>'id',v_old->>'id')::uuid;
  end if;
  v_entity_id := coalesce(v_new->>'id',v_old->>'id',v_new->>'user_id',v_old->>'user_id')::uuid;
  v_user_id := coalesce(auth.uid(),(v_new->>'updated_by')::uuid,(v_new->>'created_by')::uuid);
  v_action := case
    when tg_op = 'INSERT' then 'create'
    when tg_op = 'DELETE' then 'delete'
    when v_new->>'deleted_at' is distinct from v_old->>'deleted_at' and v_new->>'deleted_at' is not null then 'archive'
    else 'update'
  end;

  for v_key in select key from jsonb_object_keys(v_old || v_new) as keys(key) loop
    if v_old->v_key is distinct from v_new->v_key then
      v_changed := array_append(v_changed,v_key);
    end if;
  end loop;
  if tg_op = 'UPDATE' and cardinality(v_changed) = 0 then return new; end if;
  if tg_table_name = 'integration_credentials' and v_changed = array['last_used_at'] then return new; end if;

  insert into public.audit_logs (
    organization_id,user_id,action,entity_type,entity_id,old_data,new_data,metadata
  ) values (
    v_organization_id,v_user_id,v_action,tg_table_name,v_entity_id,
    v_old-v_redacted,v_new-v_redacted,jsonb_build_object('changed_fields',v_changed)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$audit$;

do $audit_triggers$
declare v_table text;
begin
  foreach v_table in array array[
    'organizations','organization_members','suppliers','contracts','contract_items',
    'documents','fiscal_records','occurrences','price_registrations',
    'price_registration_groups','admin_requests','integration_credentials'
  ] loop
    execute format('create trigger %I_audit_changes after insert or update or delete on public.%I for each row execute function public.audit_business_change()',v_table,v_table);
  end loop;
end
$audit_triggers$;
revoke all on function public.audit_business_change() from public, anon, authenticated;