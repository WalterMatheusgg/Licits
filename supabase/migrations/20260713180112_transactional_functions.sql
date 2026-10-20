-- Controlled auditing and transactional item withdrawal.

create or replace function public.protect_ai_result_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    if (to_jsonb(new) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['review_status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at']) then
      raise exception 'AI result payload and ownership fields are immutable during review';
    end if;

    if new.review_status is distinct from old.review_status then
      new.reviewed_by = auth.uid();
      new.reviewed_at = now();
    end if;
  end if;

  return new;
end;
$$;

create trigger ai_results_protect_review
before update on public.ai_analysis_results
for each row execute function public.protect_ai_result_review();

create or replace function public.write_audit_log(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, jsonb) from public;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    v_org_id := new.organization_id;
    v_entity_id := new.id;
    v_new := to_jsonb(new) - array['token', 'password', 'secret', 'checksum'];
    perform public.write_audit_log(v_org_id, 'insert', tg_table_name, v_entity_id, null, v_new);
    return new;
  elsif tg_op = 'UPDATE' then
    v_org_id := new.organization_id;
    v_entity_id := new.id;
    v_old := to_jsonb(old) - array['token', 'password', 'secret', 'checksum'];
    v_new := to_jsonb(new) - array['token', 'password', 'secret', 'checksum'];
    perform public.write_audit_log(v_org_id, 'update', tg_table_name, v_entity_id, v_old, v_new);
    return new;
  elsif tg_op = 'DELETE' then
    v_org_id := old.organization_id;
    v_entity_id := old.id;
    v_old := to_jsonb(old) - array['token', 'password', 'secret', 'checksum'];
    perform public.write_audit_log(v_org_id, 'delete', tg_table_name, v_entity_id, v_old, null);
    return old;
  end if;

  return null;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'suppliers',
    'contracts',
    'contract_items',
    'documents',
    'fiscal_records',
    'occurrences',
    'price_registrations',
    'price_registration_groups',
    'admin_requests'
  ]
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      table_name,
      table_name
    );
  end loop;
end
$$;

create or replace function public.register_item_withdrawal(
  p_organization_id uuid,
  p_contract_item_id uuid,
  p_quantity numeric,
  p_service_order_number text default null,
  p_withdrawal_date date default current_date,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.contract_items%rowtype;
  v_withdrawal public.item_withdrawals%rowtype;
  v_updated_item public.contract_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.can_write_operational_data(p_organization_id) then
    raise exception 'insufficient permission';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;

  select *
  into v_item
  from public.contract_items
  where organization_id = p_organization_id
    and id = p_contract_item_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'contract item not found';
  end if;

  if v_item.used_qty + p_quantity > v_item.contracted_qty then
    raise exception 'withdrawal exceeds available balance';
  end if;

  insert into public.item_withdrawals (
    organization_id,
    contract_id,
    contract_item_id,
    service_order_number,
    withdrawal_date,
    quantity,
    notes,
    user_id
  )
  values (
    p_organization_id,
    v_item.contract_id,
    v_item.id,
    nullif(btrim(p_service_order_number), ''),
    coalesce(p_withdrawal_date, current_date),
    p_quantity,
    p_notes,
    auth.uid()
  )
  returning * into v_withdrawal;

  update public.contract_items
  set used_qty = used_qty + p_quantity,
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_item.id
    and organization_id = p_organization_id
  returning * into v_updated_item;

  perform public.write_audit_log(
    p_organization_id,
    'withdrawal',
    'contract_items',
    v_item.id,
    to_jsonb(v_item),
    to_jsonb(v_updated_item),
    jsonb_build_object(
      'withdrawal_id', v_withdrawal.id,
      'quantity', p_quantity,
      'service_order_number', p_service_order_number
    )
  );

  return jsonb_build_object(
    'item', to_jsonb(v_updated_item),
    'withdrawal', to_jsonb(v_withdrawal)
  );
end;
$$;

revoke all on function public.register_item_withdrawal(uuid, uuid, numeric, text, date, text) from public;
grant execute on function public.register_item_withdrawal(uuid, uuid, numeric, text, date, text) to authenticated;
