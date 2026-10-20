-- ARP groups are not contracts: add a proper mutually-exclusive parent link.
-- Existing contract rows remain valid with their original contract_id.
alter table public.contract_items alter column contract_id drop not null;
alter table public.contract_items add column price_registration_group_id uuid;
alter table public.contract_items
  add constraint contract_items_arp_group_fk
  foreign key (organization_id, price_registration_group_id)
  references public.price_registration_groups(organization_id,id) on delete restrict;
alter table public.contract_items
  add constraint contract_items_exactly_one_parent
  check (num_nonnulls(contract_id,price_registration_group_id)=1);
create index contract_items_arp_group_idx
  on public.contract_items(organization_id,price_registration_group_id)
  where deleted_at is null;

alter table public.item_withdrawals alter column contract_id drop not null;
alter table public.item_withdrawals add column price_registration_group_id uuid;
alter table public.item_withdrawals
  add constraint item_withdrawals_arp_group_fk
  foreign key (organization_id,price_registration_group_id)
  references public.price_registration_groups(organization_id,id) on delete restrict;
alter table public.item_withdrawals
  add constraint item_withdrawals_exactly_one_parent
  check (num_nonnulls(contract_id,price_registration_group_id)=1);

alter table public.fiscal_records alter column contract_id drop not null;
alter table public.fiscal_records add column price_registration_group_id uuid;
alter table public.fiscal_records
  add constraint fiscal_records_arp_group_fk
  foreign key(organization_id,price_registration_group_id)
  references public.price_registration_groups(organization_id,id) on delete restrict;
alter table public.fiscal_records
  add constraint fiscal_records_exactly_one_parent
  check(num_nonnulls(contract_id,price_registration_group_id)=1);

alter table public.occurrences alter column contract_id drop not null;
alter table public.occurrences add column price_registration_group_id uuid;
alter table public.occurrences
  add constraint occurrences_arp_group_fk
  foreign key(organization_id,price_registration_group_id)
  references public.price_registration_groups(organization_id,id) on delete restrict;
alter table public.occurrences
  add constraint occurrences_exactly_one_parent
  check(num_nonnulls(contract_id,price_registration_group_id)=1);

-- Atomic withdrawal with explicit organization/parent consistency checks.
create or replace function public.register_item_withdrawal(
  p_organization_id uuid,
  p_contract_item_id uuid,
  p_quantity numeric,
  p_service_order_number text default null,
  p_withdrawal_date date default current_date,
  p_notes text default null
)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.contract_items%rowtype;
  v_withdrawal public.item_withdrawals%rowtype;
  v_updated_item public.contract_items%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.can_write_operational_data(p_organization_id) then
    raise exception 'insufficient permission';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;
  select * into v_item
  from public.contract_items
  where organization_id = p_organization_id
    and id = p_contract_item_id
    and deleted_at is null
  for update;
  if not found then raise exception 'contract item not found'; end if;
  if v_item.used_qty + p_quantity > v_item.contracted_qty then
    raise exception 'withdrawal exceeds available balance';
  end if;
  insert into public.item_withdrawals (
    organization_id, contract_id, price_registration_group_id,
    contract_item_id, service_order_number, withdrawal_date,
    quantity, notes, user_id
  ) values (
    p_organization_id, v_item.contract_id, v_item.price_registration_group_id,
    v_item.id, nullif(btrim(p_service_order_number),''),
    coalesce(p_withdrawal_date,current_date),
    p_quantity,p_notes,auth.uid()
  ) returning * into v_withdrawal;
  update public.contract_items
  set used_qty = used_qty + p_quantity, updated_at = now(), updated_by = auth.uid()
  where id = v_item.id and organization_id = p_organization_id
  returning * into v_updated_item;

  perform public.write_audit_log(
    p_organization_id,'withdrawal','contract_items',v_item.id,
    to_jsonb(v_item),to_jsonb(v_updated_item),
    jsonb_build_object('withdrawal_id',v_withdrawal.id,'quantity',p_quantity)
  );
  return jsonb_build_object('item',to_jsonb(v_updated_item),'withdrawal',to_jsonb(v_withdrawal));
end;
$$;
revoke all on function public.register_item_withdrawal(uuid,uuid,numeric,text,date,text) from public;
grant execute on function public.register_item_withdrawal(uuid,uuid,numeric,text,date,text) to authenticated;
