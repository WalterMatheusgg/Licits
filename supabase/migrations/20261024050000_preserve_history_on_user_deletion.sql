-- Remove user identity without deleting historical business and audit records.
alter table public.contracts
  drop constraint contracts_fiscal_user_id_fkey,
  add constraint contracts_fiscal_user_id_fkey
    foreign key (fiscal_user_id) references auth.users(id) on delete set null;

alter table public.occurrences
  alter column registered_by drop not null,
  drop constraint occurrences_registered_by_fkey,
  add constraint occurrences_registered_by_fkey
    foreign key (registered_by) references auth.users(id) on delete set null,
  drop constraint occurrences_resolution_coherent,
  add constraint occurrences_resolution_coherent check (
    status <> 'resolvida' or resolved_at is not null
  );

alter table public.admin_requests
  alter column requester_id drop not null,
  drop constraint admin_requests_requester_id_fkey,
  add constraint admin_requests_requester_id_fkey
    foreign key (requester_id) references auth.users(id) on delete set null,
  drop constraint admin_requests_resolution_coherent,
  add constraint admin_requests_resolution_coherent check (
    status not in ('aprovado', 'recusado') or resolved_at is not null
  );

alter table public.item_withdrawals
  alter column user_id drop not null,
  drop constraint item_withdrawals_user_id_fkey,
  add constraint item_withdrawals_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

alter table public.ai_analysis_jobs
  alter column requested_by drop not null,
  drop constraint ai_analysis_jobs_requested_by_fkey,
  add constraint ai_analysis_jobs_requested_by_fkey
    foreign key (requested_by) references auth.users(id) on delete set null;

alter table public.ai_analysis_results
  drop constraint ai_results_review_coherent,
  add constraint ai_results_review_coherent check (
    review_status = 'pending' or reviewed_at is not null
  );

alter table public.integration_credentials
  alter column created_by drop not null,
  drop constraint integration_credentials_created_by_fkey,
  add constraint integration_credentials_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

-- Keep rate-limit history and its composite key even after the user is removed.
alter table public.integration_usage
  drop constraint integration_usage_user_id_fkey;

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
  if v_user_id is not null and not exists(select 1 from auth.users where id=v_user_id) then
    v_user_id := null;
  end if;
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

create or replace function public.prevent_last_organization_admin_deletion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $guard$
declare
  other_admins integer;
begin
  if old.status = 'active' and old.role = 'organization_admin' then
    perform 1 from public.organizations where id=old.organization_id for update;
    if not found then return old; end if;
    select count(*) into other_admins from public.organization_members
      where organization_id=old.organization_id
        and user_id<>old.user_id
        and role='organization_admin'
        and status='active';
    if other_admins=0 then
      raise exception 'An organization must retain at least one active administrator';
    end if;
  end if;
  return old;
end;
$guard$;

create trigger organization_members_preserve_admin_before_delete
before delete on public.organization_members
for each row execute function public.prevent_last_organization_admin_deletion();

revoke all on function public.prevent_last_organization_admin_deletion() from public;
