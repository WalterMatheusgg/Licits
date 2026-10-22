-- Fiscal-centric money control: every contract withdrawal updates budget, records an event
-- and generates a durable warning for threshold crossings. No live data is seeded here.
alter table public.contracts add column if not exists fiscal_user_id uuid references auth.users(id);
create index if not exists contracts_fiscal_user_idx
  on public.contracts(organization_id,fiscal_user_id) where deleted_at is null;

create table public.contract_budget_alerts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 contract_id uuid not null,
 threshold_percent integer not null check(threshold_percent in (80,90,100)),
 amount_used numeric(14,2) not null,
 budget_total numeric(14,2) not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0,
 retry_at timestamptz not null default now(),
 claimed_at timestamptz,
 sent_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 unique(organization_id,contract_id,threshold_percent),
 foreign key (organization_id,contract_id) references public.contracts(organization_id,id)
);
create index contract_budget_alert_queue_idx on public.contract_budget_alerts(status,retry_at);
alter table public.contract_budget_alerts enable row level security;
create policy contract_budget_alert_read on public.contract_budget_alerts
 for select to authenticated using(public.is_organization_member(organization_id));
revoke all on public.contract_budget_alerts from anon,authenticated;
grant select on public.contract_budget_alerts to authenticated;
grant all on public.contract_budget_alerts to service_role;

-- The contract fiscal must be an active member of its organization, and only managers may change assignments.
create or replace function public.validate_contract_fiscal()
returns trigger language plpgsql set search_path=public,pg_temp as $fiscal$
begin
 if new.fiscal_user_id is not null and not exists(
   select 1 from public.organization_members m where
    m.organization_id=new.organization_id and m.user_id=new.fiscal_user_id
    and m.status='active' and m.role in ('fiscal','gestor','organization_admin')
 ) then raise exception 'Assigned fiscal must be an active member with fiscal or managerial role'; end if;
 if tg_op='UPDATE' and new.fiscal_user_id is distinct from old.fiscal_user_id
     and auth.uid() is not null and not public.can_manage_contracts(new.organization_id)
 then raise exception 'Only contract managers may reassign the fiscal'; end if;
 return new;
end;
$fiscal$;
create trigger contract_fiscal_assignment_guard
before insert or update on public.contracts for each row execute function public.validate_contract_fiscal();

-- Previews use server data, not browser-calculated authority. Authenticated organization members may view.
create or replace function public.preview_contract_purchase(
 p_organization_id uuid,p_contract_item_id uuid,p_quantity numeric
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $preview$
declare v_item public.contract_items%rowtype; v_contract public.contracts%rowtype;
declare v_cost numeric(14,2); v_qty numeric; v_balance numeric;
begin
 if auth.uid() is null or not public.is_organization_member(p_organization_id)
 then raise exception 'Unauthorized organization'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be positive'; end if;
 select * into v_item from public.contract_items
 where organization_id=p_organization_id and id=p_contract_item_id and deleted_at is null;
 if not found or v_item.contract_id is null then raise exception 'Contract item not found'; end if;
 select * into v_contract from public.contracts
 where organization_id=p_organization_id and id=v_item.contract_id and deleted_at is null;
 if not found then raise exception 'Contract not found'; end if;
 v_cost:=round(p_quantity*v_item.unit_price,2);
 v_qty:=v_item.contracted_qty-v_item.used_qty;
 v_balance:=v_contract.total_value-v_contract.used_value;
 return jsonb_build_object(
  'contract_number',v_contract.contract_number,'budget_total',v_contract.total_value,
  'budget_used',v_contract.used_value,'budget_available',v_balance,
  'item_description',v_item.description,'unit_price',v_item.unit_price,
  'quantity_available',v_qty,'requested_quantity',p_quantity,'requested_amount',v_cost,
  'projected_amount',v_contract.used_value+v_cost,
  'projected_percent',case when v_contract.total_value>0 then round((v_contract.used_value+v_cost)*100/v_contract.total_value,2) else 0 end,
  'permitted',v_cost>0 and v_qty>=p_quantity and v_balance>=v_cost
    and v_contract.status='ativo' and (v_contract.end_date is null or v_contract.end_date>=current_date),
  'reason',case
    when v_contract.status<>'ativo' then 'Contrato não está ativo'
    when v_contract.end_date<current_date then 'Contrato vencido'
    when v_cost<=0 then 'Item sem valor unitário positivo'
    when v_qty<p_quantity then 'Quantidade acima do saldo do item'
    when v_balance<v_cost then 'Valor ultrapassa o orçamento disponível'
    else 'Dentro da quantidade e do orçamento' end
 );
end;
$preview$;
revoke all on function public.preview_contract_purchase(uuid,uuid,numeric) from public,anon;
grant execute on function public.preview_contract_purchase(uuid,uuid,numeric) to authenticated;

-- One locked transaction prevents simultaneous requisitions from overspending.
create or replace function public.register_item_withdrawal(
 p_organization_id uuid,p_contract_item_id uuid,p_quantity numeric,
 p_service_order_number text default null,p_withdrawal_date date default current_date,
 p_notes text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $withdraw$
declare v_item public.contract_items%rowtype;
declare v_contract public.contracts%rowtype;
declare v_withdrawal public.item_withdrawals%rowtype;
declare v_updated_item public.contract_items%rowtype;
declare v_cost numeric(14,2); v_percent numeric;
declare v_threshold integer;
begin
 if auth.uid() is null or not public.can_write_operational_data(p_organization_id)
 then raise exception 'Sem permissão para registrar compras'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantidade deve ser maior que zero'; end if;

 -- Lock the budget FIRST, before locking the item, for consistent concurrent ordering.
 select * into v_item from public.contract_items
 where organization_id=p_organization_id and id=p_contract_item_id and deleted_at is null;
 if not found then raise exception 'Item não encontrado'; end if;
 if v_item.contract_id is not null then
   select * into v_contract from public.contracts
   where id=v_item.contract_id and organization_id=p_organization_id and deleted_at is null
   for update;
   if not found then raise exception 'Contrato não encontrado'; end if;
   if v_contract.status<>'ativo' or (v_contract.end_date is not null and v_contract.end_date<current_date)
   then raise exception 'Contrato não está ativo ou está vencido'; end if;
 end if;
 select * into v_item from public.contract_items
 where organization_id=p_organization_id and id=p_contract_item_id and deleted_at is null for update;
 if v_item.used_qty+p_quantity>v_item.contracted_qty
 then raise exception 'Quantidade solicitada excede o saldo disponível do item'; end if;
 v_cost:=round(p_quantity*v_item.unit_price,2);
 if v_item.contract_id is not null then
   if v_item.unit_price<=0 then raise exception 'Cadastre um preço unitário válido antes da compra'; end if;
   if v_contract.used_value+v_cost>v_contract.total_value then
     raise exception 'Compra bloqueada: ultrapassaria o valor global do contrato';
   end if;
 end if;

 insert into public.item_withdrawals(
  organization_id,contract_id,price_registration_group_id,contract_item_id,
  service_order_number,withdrawal_date,quantity,notes,user_id
 ) values (
  p_organization_id,v_item.contract_id,v_item.price_registration_group_id,
  v_item.id,nullif(btrim(p_service_order_number),''),
  coalesce(p_withdrawal_date,current_date),p_quantity,p_notes,auth.uid()
 ) returning * into v_withdrawal;
 update public.contract_items set used_qty=used_qty+p_quantity,
  updated_at=now(),updated_by=auth.uid()
 where id=v_item.id and organization_id=p_organization_id returning * into v_updated_item;

 if v_item.contract_id is not null then
  update public.contracts set used_value=used_value+v_cost,updated_at=now(),updated_by=auth.uid()
  where id=v_contract.id and organization_id=p_organization_id;
  v_percent:=(v_contract.used_value+v_cost)*100/v_contract.total_value;
  foreach v_threshold in array array[80,90,100] loop
   if v_percent >= v_threshold and v_contract.used_value*100/v_contract.total_value < v_threshold then
    insert into public.contract_budget_alerts(
      organization_id,contract_id,threshold_percent,amount_used,budget_total
    ) values (p_organization_id,v_contract.id,v_threshold,v_contract.used_value+v_cost,v_contract.total_value)
    on conflict(organization_id,contract_id,threshold_percent) do nothing;
    insert into public.notifications(
      organization_id,target_user_id,title,message,type,priority,entity_type,entity_id
    ) values (
      p_organization_id,v_contract.fiscal_user_id,
      'Contrato '||v_contract.contract_number||' chegou a '||v_threshold||'% do teto',
      'Utilizado R$ '||(v_contract.used_value+v_cost)::text||' de R$ '||v_contract.total_value::text||
        '. Saldo R$ '||(v_contract.total_value-v_contract.used_value-v_cost)::text||
        '. Verifique novas requisições e a vigência.',
      'orcamento',case when v_threshold=100 then 'critica'::public.notification_priority else 'alta'::public.notification_priority end,
      'contract',v_contract.id
    );
   end if;
  end loop;
 end if;
 return jsonb_build_object(
  'withdrawal',to_jsonb(v_withdrawal),'item',to_jsonb(v_updated_item),
  'cost',v_cost,'budget_used_after',case when v_item.contract_id is not null then v_contract.used_value+v_cost else null end
 );
end;
$withdraw$;
revoke all on function public.register_item_withdrawal(uuid,uuid,numeric,text,date,text) from public,anon;
grant execute on function public.register_item_withdrawal(uuid,uuid,numeric,text,date,text) to authenticated;

-- Browser can never manually falsify consumed monetary amount after contract creation.
create or replace function public.protect_contract_budget_totals()
returns trigger language plpgsql set search_path=public,pg_temp as $protect$
begin
 if tg_op='UPDATE' and current_user='authenticated' and
   new.used_value is distinct from old.used_value
 then raise exception 'Use registered purchases to change utilized budget'; end if;
 return new;
end;
$protect$;
create trigger contracts_protect_budget_totals
before update on public.contracts for each row execute function public.protect_contract_budget_totals();

-- Worker claims pending notifications without sending directly from the browser.
create or replace function public.claim_contract_budget_alerts(p_limit integer default 20)
returns setof public.contract_budget_alerts
language plpgsql security definer set search_path=public,pg_temp as $claim$
begin
 return query with candidates as (
  select id from public.contract_budget_alerts
  where ((status in ('pending','failed') and retry_at<=now()) or
         (status='processing' and claimed_at<now()-interval '10 minutes'))
    and attempts<5
  order by created_at asc limit least(greatest(p_limit,1),50)
  for update skip locked
 ) update public.contract_budget_alerts a
 set status='processing',attempts=attempts+1,claimed_at=now()
 from candidates c where a.id=c.id returning a.*;
end;
$claim$;
revoke all on function public.claim_contract_budget_alerts(integer) from public,anon,authenticated;
grant execute on function public.claim_contract_budget_alerts(integer) to service_role;
