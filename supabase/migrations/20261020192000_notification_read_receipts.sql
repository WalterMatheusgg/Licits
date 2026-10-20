-- Per-user read receipts for organization-wide notifications.
-- A global notification must never be marked read for every employee by one employee.
create table public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  constraint notification_reads_once_per_user unique (notification_id,user_id)
);
create index notification_reads_user_org_idx on public.notification_reads (organization_id,user_id,read_at desc);
alter table public.notification_reads enable row level security;

create policy notification_reads_self_select on public.notification_reads
  for select to authenticated using (
    user_id=auth.uid() and public.is_organization_member(organization_id)
  );
create policy notification_reads_self_insert on public.notification_reads
  for insert to authenticated with check (
    user_id=auth.uid()
    and public.is_organization_member(organization_id)
    and exists (
      select 1 from public.notifications n
      where n.id=notification_id
        and n.organization_id=notification_reads.organization_id
        and (n.target_user_id is null or n.target_user_id=auth.uid())
    )
  );
create policy notification_reads_self_update on public.notification_reads
  for update to authenticated using (
    user_id=auth.uid() and public.is_organization_member(organization_id)
  ) with check (
    user_id=auth.uid() and public.is_organization_member(organization_id)
  );
create or replace function public.notification_read_identity_immutable()
returns trigger language plpgsql set search_path=public,pg_temp
as $$
begin
  if new.notification_id is distinct from old.notification_id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id then
    raise exception 'notification read identity is immutable';
  end if;
  return new;
end;
$$;
create trigger notification_reads_protect_identity before update on public.notification_reads
  for each row execute function public.notification_read_identity_immutable();
grant select,insert,update on public.notification_reads to authenticated;
