create table public.contract_expiry_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contract_id uuid not null,
  threshold_days smallint not null check (threshold_days in (30, 7, 1, 0)),
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  retry_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (organization_id, contract_id, threshold_days),
  foreign key (organization_id, contract_id)
    references public.contracts (organization_id, id)
);

create index contract_expiry_alert_queue_idx
  on public.contract_expiry_alerts (status, retry_at);
alter table public.contract_expiry_alerts enable row level security;
create policy contract_expiry_alert_read on public.contract_expiry_alerts
  for select to authenticated using (public.is_organization_member(organization_id));
revoke all on public.contract_expiry_alerts from anon, authenticated;
grant select on public.contract_expiry_alerts to authenticated;
grant all on public.contract_expiry_alerts to service_role;

create or replace function public.enqueue_contract_expiry_alerts()
returns integer language plpgsql security definer set search_path = public, pg_temp as $enqueue$
declare v_count integer;
begin
  insert into public.contract_expiry_alerts (organization_id, contract_id, threshold_days, end_date)
  select c.organization_id, c.id, (c.end_date - current_date)::smallint, c.end_date
  from public.contracts c
  where c.deleted_at is null and c.status = 'ativo'
    and c.end_date in (current_date, current_date + 1, current_date + 7, current_date + 30)
  on conflict (organization_id, contract_id, threshold_days) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$enqueue$;
revoke all on function public.enqueue_contract_expiry_alerts() from public, anon, authenticated;
grant execute on function public.enqueue_contract_expiry_alerts() to service_role;

create or replace function public.claim_contract_expiry_alerts(p_limit integer default 20)
returns setof public.contract_expiry_alerts
language plpgsql security definer set search_path = public, pg_temp as $claim$
begin
  return query with candidates as (
    select id from public.contract_expiry_alerts
    where ((status in ('pending', 'failed') and retry_at <= now()) or
           (status = 'processing' and claimed_at < now() - interval '10 minutes'))
      and attempts < 5
    order by created_at asc limit least(greatest(p_limit, 1), 50)
    for update skip locked
  ) update public.contract_expiry_alerts a
    set status = 'processing', attempts = attempts + 1, claimed_at = now()
    from candidates c where a.id = c.id returning a.*;
end;
$claim$;
revoke all on function public.claim_contract_expiry_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_contract_expiry_alerts(integer) to service_role;