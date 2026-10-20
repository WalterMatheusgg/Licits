-- Preserve private attachments for fiscal records and occurrences.
alter table public.fiscal_records
  add column if not exists attachment_bucket text,
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;
alter table public.occurrences
  add column if not exists attachment_bucket text,
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

alter table public.fiscal_records
  add constraint fiscal_attachment_bucket_valid check (attachment_bucket is null or attachment_bucket = 'fiscal-records');
alter table public.occurrences
  add constraint occurrence_attachment_bucket_valid check (attachment_bucket is null or attachment_bucket = 'occurrences');

-- Do not allow direct browser updates of inventory consumption.
-- Security-definer RPC register_item_withdrawal executes as its database owner,
-- serializes the item with FOR UPDATE and atomically inserts the withdrawal.
create or replace function public.prevent_direct_stock_consumption_change()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user = 'authenticated' and new.used_qty is distinct from old.used_qty then
    raise exception 'Use register_item_withdrawal to change used_qty';
  end if;
  return new;
end;
$$;
create trigger contract_items_protect_consumption
before update on public.contract_items
for each row execute function public.prevent_direct_stock_consumption_change();
