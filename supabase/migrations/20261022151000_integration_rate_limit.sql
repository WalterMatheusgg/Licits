-- Per-credential fixed-window rate limit: 60 requests per UTC minute.
-- Called by the authenticated integration Edge Function using service_role only.
create table if not exists public.integration_request_counters (
  credential_id uuid not null references public.integration_credentials(id) on delete cascade,
  minute_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key(credential_id, minute_start)
);
alter table public.integration_request_counters enable row level security;
revoke all on public.integration_request_counters from public, anon, authenticated;
grant all on public.integration_request_counters to service_role;

create or replace function public.claim_integration_request(p_credential_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_count integer;
  v_minute timestamptz:=date_trunc('minute',now());
begin
  if not exists (
    select 1 from public.integration_credentials
    where id=p_credential_id and revoked_at is null
      and (expires_at is null or expires_at>now())
  ) then return false; end if;
  delete from public.integration_request_counters
    where credential_id=p_credential_id and minute_start < now()-interval '1 day';
  insert into public.integration_request_counters(credential_id,minute_start,request_count)
  values (p_credential_id,v_minute,1)
  on conflict(credential_id,minute_start) do update
    set request_count=public.integration_request_counters.request_count+1
    where public.integration_request_counters.request_count<60
  returning request_count into v_count;
  return v_count is not null and v_count<=60;
end;
$$;
revoke all on function public.claim_integration_request(uuid) from public, anon, authenticated;
grant execute on function public.claim_integration_request(uuid) to service_role;
