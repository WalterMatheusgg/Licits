-- Limit cost and abuse of third-party integrations across users and tenants.
-- Only server-side Supabase service_role may reserve capacity.
create table public.integration_usage (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  operation text not null check (operation in ('invite-member','send-email','analyze-contract','extract-document')),
  usage_day date not null default current_date,
  requests integer not null default 0 check (requests >= 0),
  last_attempt_at timestamptz not null default now(),
  primary key(organization_id,user_id,operation,usage_day)
);
create index integration_usage_date_idx on public.integration_usage(organization_id,usage_day);
alter table public.integration_usage enable row level security;
-- No direct browser policies by design.

create or replace function public.reserve_integration_capacity(
  p_organization_id uuid,p_user_id uuid,p_operation text
) returns integer language plpgsql security definer
set search_path=public,pg_temp
as $limit$
declare max_user integer;
declare max_org integer;
declare org_requests integer;
declare user_requests integer;
begin
 if p_operation not in ('invite-member','send-email','analyze-contract','extract-document')
 then raise exception 'Unknown integration'; end if;
 if not exists (
   select 1 from public.organization_members m
   join public.organizations o on o.id=m.organization_id
   join public.profiles p on p.id=m.user_id
   where m.organization_id=p_organization_id and m.user_id=p_user_id
     and m.status='active' and p.status='active'
     and o.status='active' and o.deleted_at is null
 ) then raise exception 'No active organization membership'; end if;
 max_user := case p_operation
   when 'invite-member' then 12
   when 'send-email' then 30
   when 'analyze-contract' then 10
   when 'extract-document' then 5
 end;
 max_org := case p_operation
   when 'invite-member' then 40
   when 'send-email' then 150
   when 'analyze-contract' then 50
   when 'extract-document' then 25
 end;
 perform pg_advisory_xact_lock(hashtextextended(
   p_organization_id::text || ':' || p_operation || ':' || current_date::text,0
 ));
 select coalesce(sum(requests),0)::integer into org_requests
 from public.integration_usage where organization_id=p_organization_id
   and operation=p_operation and usage_day=current_date;
 select coalesce(requests,0) into user_requests from public.integration_usage
   where organization_id=p_organization_id and user_id=p_user_id
     and operation=p_operation and usage_day=current_date;
 user_requests:=coalesce(user_requests,0);
 if org_requests>=max_org or user_requests>=max_user
 then raise exception 'Daily integration quota reached for %',p_operation; end if;
 insert into public.integration_usage(
   organization_id,user_id,operation,usage_day,requests,last_attempt_at
 ) values(p_organization_id,p_user_id,p_operation,current_date,1,now())
 on conflict(organization_id,user_id,operation,usage_day)
 do update set requests=public.integration_usage.requests+1,last_attempt_at=now();
 return user_requests+1;
end;
$limit$;
revoke all on table public.integration_usage from public,anon,authenticated;
grant select on public.integration_usage to service_role;
revoke all on function public.reserve_integration_capacity(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_integration_capacity(uuid,uuid,text) to service_role;
