-- One transaction for contract, supplier, source document and recognized items.
-- The private file is already uploaded; SQL only commits database records after validation.
create or replace function public.import_contract_document_atomic(
  p_organization_id uuid,
  p_contract jsonb,
  p_storage_path text,
  p_original_filename text default null,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_items jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,storage,pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_supplier uuid;
  v_contract uuid;
  v_document uuid;
  v_number text := nullif(btrim(p_contract->>'contract_number'),'');
  v_object text := nullif(btrim(p_contract->>'object'),'');
  v_supplier_name text := nullif(btrim(p_contract->>'supplier_name'),'');
  v_cnpj text := nullif(regexp_replace(coalesce(p_contract->>'supplier_cnpj',''),'[^0-9]','','g'),'');
  v_total numeric;
  v_item jsonb;
  v_quantity numeric;
  v_unit_price numeric;
  v_items_count integer;
begin
  if v_actor is null then raise exception 'Faça login para importar documentos'; end if;
  if p_contract is null or jsonb_typeof(p_contract) <> 'object' then
    raise exception 'Dados do contrato inválidos';
  end if;
  if not exists (
    select 1 from public.organizations o
    join public.organization_members m on m.organization_id=o.id
    join public.profiles p on p.id=m.user_id
    where o.id=p_organization_id and o.status='active' and o.deleted_at is null
      and m.user_id=v_actor and m.status='active'
      and m.role in ('organization_admin','gestor') and p.status='active'
  ) then raise exception 'Sem permissão de cadastro nesta organização'; end if;
  if v_number is null or length(v_number)>100 or v_object is null or length(v_object)>10000
     or v_supplier_name is null or length(v_supplier_name)>250 then
    raise exception 'Informe número, objeto e fornecedor válidos';
  end if;
  if v_cnpj is not null and length(v_cnpj)<>14 then raise exception 'CNPJ inválido'; end if;
  if (p_contract->>'total_value') is null then raise exception 'Valor total obrigatório'; end if;
  v_total := (p_contract->>'total_value')::numeric;
  if v_total<0 or v_total>999999999999.99 then raise exception 'Valor total inválido'; end if;
  if p_storage_path is null or
     left(p_storage_path,length(p_organization_id::text)+1) <> p_organization_id::text||'/' then
    raise exception 'Arquivo fora da organização';
  end if;
  if p_mime_type is not null and p_mime_type not in ('application/pdf','image/jpeg','image/png') then
    raise exception 'Tipo de arquivo inválido';
  end if;
  if p_file_size is not null and (p_file_size<1 or p_file_size>15728640) then
    raise exception 'Arquivo excede 15 MB';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id='contracts' and name=p_storage_path and owner_id=v_actor::text
  ) then raise exception 'Arquivo privado não encontrado ou não pertence ao usuário'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then
    raise exception 'Lista de itens inválida ou excede 100 itens';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text||':supplier:'||coalesce(v_cnpj,lower(v_supplier_name)),0
  ));
  if v_cnpj is not null then
    select id into v_supplier from public.suppliers
    where organization_id=p_organization_id and cnpj=v_cnpj and deleted_at is null limit 1;
  else
    select id into v_supplier from public.suppliers
    where organization_id=p_organization_id and legal_name=v_supplier_name and deleted_at is null limit 1;
  end if;
  if v_supplier is null then
    insert into public.suppliers(organization_id,created_by,legal_name,cnpj)
    values(p_organization_id,v_actor,v_supplier_name,v_cnpj) returning id into v_supplier;
  end if;
  insert into public.contracts(
    organization_id,created_by,supplier_id,contract_number,object,total_value,
    start_date,end_date,clauses,status
  ) values(
    p_organization_id,v_actor,v_supplier,v_number,v_object,v_total,
    nullif(p_contract->>'start_date','')::date,
    nullif(p_contract->>'end_date','')::date,
    p_contract->>'clauses','em_analise'
  ) returning id into v_contract;
  insert into public.documents(
    organization_id,created_by,contract_id,title,document_type,storage_bucket,
    storage_path,original_filename,mime_type,file_size,status
  ) values(
    p_organization_id,v_actor,v_contract,
    coalesce(nullif(btrim(p_original_filename),''),'Contrato '||v_number),
    'contrato','contracts',p_storage_path,p_original_filename,p_mime_type,
    p_file_size,'pendente'
  ) returning id into v_document;
  update public.contracts set source_document_id=v_document where id=v_contract;
  v_items_count:=0;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item)<>'object' or
       nullif(btrim(v_item->>'description'),'') is null then
      raise exception 'Descrição de item obrigatória';
    end if;
    v_quantity:=(v_item->>'quantity')::numeric;
    v_unit_price:=(v_item->>'unit_price')::numeric;
    if v_quantity is null or v_quantity<=0 or v_unit_price is null or v_unit_price<0 then
      raise exception 'Quantidade ou preço de item inválido';
    end if;
    insert into public.contract_items(
      organization_id,created_by,contract_id,item_number,description,unit,
      contracted_qty,unit_price
    ) values (
      p_organization_id,v_actor,v_contract,nullif(v_item->>'item_number',''),
      btrim(v_item->>'description'),nullif(v_item->>'unit',''),
      v_quantity,v_unit_price
    );
    v_items_count:=v_items_count+1;
  end loop;
  return jsonb_build_object(
    'id',v_contract,'contract_number',v_number,'document_id',v_document,'items_created',v_items_count
  );
end;
$$;
revoke all on function public.import_contract_document_atomic(uuid,jsonb,text,text,text,bigint,jsonb)
from public, anon;
grant execute on function public.import_contract_document_atomic(uuid,jsonb,text,text,text,bigint,jsonb)
to authenticated;
