\set ON_ERROR_STOP on
-- Run manually ONLY in a Supabase developer organization whose name includes DEMO or TESTE.
-- psql -v org_id=UUID -v fiscal_id=UUID -f supabase/demo/contrato_50_porcento.sql "$DATABASE_URL"
-- The initial 50% is coherent across contracts, contract_items and item_withdrawals.
\if :{?org_id}
\else
\echo 'Missing -v org_id=UUID'
\quit
\endif
\if :{?fiscal_id}
\else
\echo 'Missing -v fiscal_id=UUID'
\quit
\endif
begin;
select set_config('licits_demo.org_id',:'org_id',true);
select set_config('licits_demo.fiscal_id',:'fiscal_id',true);
do $seed$
declare
  v_org uuid := current_setting('licits_demo.org_id')::uuid;
  v_fiscal uuid := current_setting('licits_demo.fiscal_id')::uuid;
  v_supplier uuid;
  v_contract uuid;
  v_item uuid;
  v_name text;
begin
  select name into v_name from public.organizations
    where id=v_org and status='active' and deleted_at is null;
  if v_name is null or v_name !~* '(demo|teste)' then
    raise exception 'Safety: target must be an active DEMO/TESTE organization';
  end if;
  if not exists(select 1 from public.organization_members where
    organization_id=v_org and user_id=v_fiscal and status='active'
    and role in ('fiscal','gestor','organization_admin')) then
    raise exception 'Fiscal must already be a verified active tenant member';
  end if;
  if exists(select 1 from public.contracts where organization_id=v_org and
    contract_number='014/2026-LICITS-DEMO' and deleted_at is null) then
    raise notice 'Contract DEMO already exists. No existing data changed.';
    return;
  end if;
  insert into public.suppliers(organization_id,legal_name,created_by)
  values(v_org,'Fornecedor Exemplo de Tecnologia Ltda. (FICTÍCIO)',v_fiscal)
  returning id into v_supplier;
  insert into public.contracts(
    organization_id,supplier_id,contract_number,auction_number,sei_number,
    object,modality,contract_type,status,responsible_sector,start_date,end_date,
    total_value,used_value,fiscal_user_id,created_by,notes
  ) values(
    v_org,v_supplier,'014/2026-LICITS-DEMO','PE-DEMO-014/2026','DEMO-SEI-2026-000014',
    'Fornecimento parcelado de kits de suprimentos para manutencao de equipamentos de TI',
    'pregao_eletronico','material_informatica','ativo','Fiscalizacao de TI',
    '2026-10-01','2027-09-30',100000,50000,v_fiscal,v_fiscal,
    '[DEMONSTRACAO] Dados inteiramente ficticios. Jamais utilizar como contrato real.'
  ) returning id into v_contract;
  insert into public.contract_items(
    organization_id,contract_id,item_number,group_number,description,unit,
    contracted_qty,used_qty,unit_price,created_by
  ) values(
    v_org,v_contract,'001','01','Kit de suprimentos de TI - demonstracao',
    'UN',100,50,1000,v_fiscal
  ) returning id into v_item;
  insert into public.item_withdrawals(
    organization_id,contract_id,contract_item_id,quantity,
    service_order_number,withdrawal_date,notes,user_id
  ) values(
    v_org,v_contract,v_item,50,'OS-DEMO-INICIAL-50','2026-10-20',
    '[DEMO] Consumo anterior simulado para iniciar teste em 50 por cento.',
    v_fiscal
  );
  raise notice 'Created contract 014/2026-LICITS-DEMO, used R$50k, 50/100 units.';
end
$seed$;
commit;
