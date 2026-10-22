-- Resolve administration requests atomically, under the caller's organization permissions.
create or replace function public.resolve_admin_request(
 p_request_id uuid,
 p_status public.admin_request_status,
 p_response text default null
) returns public.admin_requests
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
 r public.admin_requests%rowtype;
 v_table text;
 v_allowed boolean;
 v_changed integer;
begin
 if auth.uid() is null then raise exception 'Faça login para continuar'; end if;
 if p_status not in ('aprovado','recusado') then raise exception 'Status final inválido'; end if;
 select * into r from public.admin_requests where id=p_request_id for update;
 if not found then raise exception 'Solicitação não encontrada'; end if;
 if r.status not in ('pendente','em_analise') then raise exception 'Solicitação já resolvida'; end if;
 if not public.can_manage_members(r.organization_id) then raise exception 'Sem permissão para resolver solicitações'; end if;
 if p_status='aprovado' and r.request_type='exclusao' then
   if r.entity_id is null then raise exception 'Solicitação sem ID de registro; não é seguro arquivar'; end if;
   v_table:=case lower(coalesce(r.entity_type,''))
     when 'contrato' then 'contracts'
     when 'contract' then 'contracts'
     when 'fiscalização' then 'fiscal_records'
     when 'fiscalizacao' then 'fiscal_records'
     when 'fiscalrecord' then 'fiscal_records'
     when 'documento' then 'documents'
     when 'document' then 'documents'
     when 'ocorrência' then 'occurrences'
     when 'ocorrencia' then 'occurrences'
     when 'occurrence' then 'occurrences'
     when 'item' then 'contract_items'
     when 'contractitem' then 'contract_items'
     when 'registro de preços' then 'price_registrations'
     when 'priceregistration' then 'price_registrations'
     else null end;
   if v_table is null then raise exception 'Tipo de registro não autorizado para arquivamento'; end if;
   v_allowed:=case
     when v_table in ('fiscal_records','occurrences') then public.can_write_fiscal_data(r.organization_id)
     when v_table='documents' then public.can_write_operational_data(r.organization_id)
     else public.can_manage_contracts(r.organization_id)
   end;
   if not coalesce(v_allowed,false) then raise exception 'Permissão insuficiente para arquivamento'; end if;
   execute format('update public.%I set deleted_at=now(), deleted_by=$3
     where id=$1 and organization_id=$2 and deleted_at is null',v_table)
     using r.entity_id,r.organization_id,auth.uid();
   get diagnostics v_changed=row_count;
   if v_changed<>1 then raise exception 'Registro não encontrado, já arquivado ou fora da organização'; end if;
 end if;
 update public.admin_requests
 set status=p_status, admin_response=nullif(btrim(coalesce(p_response,'')),''),
 resolved_by=auth.uid(), resolved_at=now()
 where id=r.id returning * into r;
 return r;
end;
$$;
revoke all on function public.resolve_admin_request(uuid, public.admin_request_status, text) from public,anon;
grant execute on function public.resolve_admin_request(uuid, public.admin_request_status, text) to authenticated;
