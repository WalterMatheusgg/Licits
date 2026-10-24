-- Read-only history of a contract, including events for archived children.
-- SECURITY DEFINER is required to read historical rows hidden by normal RLS.
-- The organization and archived-contract authorization checks run BEFORE any data is returned.
create or replace function public.list_archived_contracts(p_organization_id uuid)
returns table (
  id uuid, contract_number text, object text, status public.contract_status,
  total_value numeric, start_date date, end_date date,
  deleted_at timestamptz, supplier_name text
)
language sql stable security definer
set search_path=public, pg_temp
as $function$
  select c.id, c.contract_number, c.object, c.status,
         c.total_value, c.start_date, c.end_date,
         c.deleted_at, s.legal_name as supplier_name
  from public.contracts c
  left join public.suppliers s on s.id=c.supplier_id and s.organization_id=c.organization_id
  where auth.uid() is not null
    and c.organization_id=p_organization_id
    and c.deleted_at is not null
    and public.can_manage_contracts(p_organization_id)
  order by c.deleted_at desc, c.id desc;
$function$;

create or replace function public.get_contract_history(
  p_organization_id uuid, p_contract_id uuid,
  p_limit integer default 50, p_offset integer default 0
)
returns table (
  event_id uuid, event_at timestamptz,
  event_action text, entity_type text,
  actor_name text, changed_fields jsonb,
  status_before text, status_after text,
  item_label text, quantity numeric
)
language sql stable security definer
set search_path=public, pg_temp
as $function$
  with access as (
    select c.id
    from public.contracts c
    where c.id=p_contract_id
      and c.organization_id=p_organization_id
      and auth.uid() is not null
      and public.is_organization_member(p_organization_id)
      and (c.deleted_at is null or public.can_manage_contracts(p_organization_id))
  ),
  related as (
    select a.id as entity_id, 'contract_items'::text as kind
      from public.contract_items a join access c on a.contract_id=c.id
      where a.organization_id=p_organization_id
    union all
    select a.id, 'documents'::text
      from public.documents a join access c on a.contract_id=c.id
      where a.organization_id=p_organization_id
    union all
    select a.id, 'fiscal_records'::text
      from public.fiscal_records a join access c on a.contract_id=c.id
      where a.organization_id=p_organization_id
    union all
    select a.id, 'occurrences'::text
      from public.occurrences a join access c on a.contract_id=c.id
      where a.organization_id=p_organization_id
  ),
  events as (
    select a.id as event_id, a.created_at as event_at,
       a.action::text as event_action, a.entity_type::text,
       a.user_id, coalesce(a.metadata->'changed_fields','[]'::jsonb) changed_fields,
       a.old_data->>'status' as status_before,
       a.new_data->>'status' as status_after,
       coalesce(a.new_data->>'item_number',a.old_data->>'item_number',
                a.new_data->>'title',a.old_data->>'title') as item_label,
       null::numeric as quantity
    from public.audit_logs a
    where a.organization_id=p_organization_id
      and exists(select 1 from access)
      and (
        (a.entity_type='contracts' and a.entity_id=p_contract_id)
        or exists(select 1 from related r where r.entity_id=a.entity_id and r.kind=a.entity_type)
      )
    union all
    select w.id, w.created_at, 'withdrawal'::text, 'item_withdrawals'::text,
       w.user_id, '[]'::jsonb, null::text, null::text,
       ci.item_number::text, w.quantity
    from public.item_withdrawals w
    join access c on w.contract_id=c.id
    left join public.contract_items ci on ci.id=w.contract_item_id and ci.organization_id=w.organization_id
    where w.organization_id=p_organization_id
  )
  select e.event_id, e.event_at, e.event_action, e.entity_type,
         coalesce(nullif(p.full_name,''), 'Sistema')::text as actor_name,
         e.changed_fields, e.status_before, e.status_after,
         e.item_label, e.quantity
  from events e
  left join public.profiles p on p.id=e.user_id
  order by e.event_at desc, e.event_id desc
  limit greatest(1,least(coalesce(p_limit,50),100))
  offset greatest(0,coalesce(p_offset,0));
$function$;

revoke all on function public.list_archived_contracts(uuid) from public, anon;
revoke all on function public.get_contract_history(uuid,uuid,integer,integer) from public, anon;
grant execute on function public.list_archived_contracts(uuid) to authenticated;
grant execute on function public.get_contract_history(uuid,uuid,integer,integer) to authenticated;
