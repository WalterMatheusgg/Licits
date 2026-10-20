-- Soft archiving needs a privileged, explicitly authorized operation:
-- ordinary UPDATE cannot make a record invisible to its own RLS SELECT policy.
create or replace function public.archive_business_record(
  p_entity text, p_id uuid, p_organization_id uuid
) returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $archive$
declare allowed boolean;
declare changed integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_entity not in (
    'suppliers','contracts','contract_items','documents',
    'fiscal_records','occurrences','price_registrations','price_registration_groups'
 ) then raise exception 'Entity not eligible for archiving'; end if;
 if p_entity in ('fiscal_records','occurrences') then
    allowed := public.can_write_fiscal_data(p_organization_id);
 elsif p_entity = 'documents' then
    allowed := public.can_write_operational_data(p_organization_id);
 else
    allowed := public.can_manage_contracts(p_organization_id);
 end if;
 if not coalesce(allowed,false) then raise exception 'Insufficient permission'; end if;
 execute format(
  'update public.%I set deleted_at=now(), deleted_by=$3
   where id=$1 and organization_id=$2 and deleted_at is null',p_entity
 ) using p_id,p_organization_id,auth.uid();
 get diagnostics changed = row_count;
 if changed <> 1 then
    raise exception 'Record does not exist, is archived or is outside your organization';
 end if;
 return true;
end;
$archive$;

revoke all on function public.archive_business_record(text,uuid,uuid) from public,anon;
grant execute on function public.archive_business_record(text,uuid,uuid) to authenticated;
