-- Row Level Security policies.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organization_members enable row level security;
alter table public.suppliers enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_items enable row level security;
alter table public.item_withdrawals enable row level security;
alter table public.documents enable row level security;
alter table public.fiscal_records enable row level security;
alter table public.occurrences enable row level security;
alter table public.price_registrations enable row level security;
alter table public.price_registration_groups enable row level security;
alter table public.admin_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_analysis_jobs enable row level security;
alter table public.ai_analysis_results enable row level security;
alter table public.audit_logs enable row level security;

-- Organizations
create policy organizations_select
on public.organizations for select
to authenticated
using (public.is_platform_admin() or public.is_organization_member(id));

create policy organizations_insert
on public.organizations for insert
to authenticated
with check (public.is_platform_admin());

create policy organizations_update
on public.organizations for update
to authenticated
using (public.is_platform_admin() or public.can_manage_members(id))
with check (public.is_platform_admin() or public.can_manage_members(id));

-- Profiles
create policy profiles_select_self_or_shared_org
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = profiles.id
      and theirs.status = 'active'
  )
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_platform_admin())
with check (id = auth.uid() or public.is_platform_admin());

-- Platform admins: only platform admins may read; no direct client writes.
create policy platform_admins_select
on public.platform_admins for select
to authenticated
using (public.is_platform_admin());

-- Organization memberships
create policy organization_members_select
on public.organization_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.can_manage_members(organization_id)
);

create policy organization_members_insert
on public.organization_members for insert
to authenticated
with check (public.can_manage_members(organization_id));

create policy organization_members_update
on public.organization_members for update
to authenticated
using (public.can_manage_members(organization_id))
with check (public.can_manage_members(organization_id));

create policy organization_members_delete
on public.organization_members for delete
to authenticated
using (public.can_manage_members(organization_id));

-- Suppliers
create policy suppliers_select
on public.suppliers for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy suppliers_insert
on public.suppliers for insert
to authenticated
with check (public.can_manage_contracts(organization_id) and created_by = auth.uid());

create policy suppliers_update
on public.suppliers for update
to authenticated
using (deleted_at is null and public.can_manage_contracts(organization_id))
with check (public.can_manage_contracts(organization_id));

-- Contracts
create policy contracts_select
on public.contracts for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy contracts_insert
on public.contracts for insert
to authenticated
with check (public.can_manage_contracts(organization_id) and created_by = auth.uid());

create policy contracts_update
on public.contracts for update
to authenticated
using (deleted_at is null and public.can_manage_contracts(organization_id))
with check (public.can_manage_contracts(organization_id));

-- Contract items
create policy contract_items_select
on public.contract_items for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy contract_items_insert
on public.contract_items for insert
to authenticated
with check (public.can_manage_contracts(organization_id) and created_by = auth.uid());

create policy contract_items_update
on public.contract_items for update
to authenticated
using (deleted_at is null and public.can_manage_contracts(organization_id))
with check (public.can_manage_contracts(organization_id));

-- Withdrawals are append-only for clients.
create policy item_withdrawals_select
on public.item_withdrawals for select
to authenticated
using (public.is_organization_member(organization_id));

-- Documents
create policy documents_select
on public.documents for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy documents_insert
on public.documents for insert
to authenticated
with check (public.can_write_operational_data(organization_id) and created_by = auth.uid());

create policy documents_update
on public.documents for update
to authenticated
using (deleted_at is null and public.can_write_operational_data(organization_id))
with check (public.can_write_operational_data(organization_id));

-- Fiscal records
create policy fiscal_records_select
on public.fiscal_records for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy fiscal_records_insert
on public.fiscal_records for insert
to authenticated
with check (public.can_write_fiscal_data(organization_id) and created_by = auth.uid());

create policy fiscal_records_update
on public.fiscal_records for update
to authenticated
using (deleted_at is null and public.can_write_fiscal_data(organization_id))
with check (public.can_write_fiscal_data(organization_id));

-- Occurrences
create policy occurrences_select
on public.occurrences for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy occurrences_insert
on public.occurrences for insert
to authenticated
with check (
  public.can_write_fiscal_data(organization_id)
  and registered_by = auth.uid()
  and created_by = auth.uid()
);

create policy occurrences_update
on public.occurrences for update
to authenticated
using (deleted_at is null and public.can_write_fiscal_data(organization_id))
with check (public.can_write_fiscal_data(organization_id));

-- Price registrations
create policy price_registrations_select
on public.price_registrations for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy price_registrations_insert
on public.price_registrations for insert
to authenticated
with check (public.can_manage_contracts(organization_id) and created_by = auth.uid());

create policy price_registrations_update
on public.price_registrations for update
to authenticated
using (deleted_at is null and public.can_manage_contracts(organization_id))
with check (public.can_manage_contracts(organization_id));

create policy price_registration_groups_select
on public.price_registration_groups for select
to authenticated
using (deleted_at is null and public.is_organization_member(organization_id));

create policy price_registration_groups_insert
on public.price_registration_groups for insert
to authenticated
with check (public.can_manage_contracts(organization_id) and created_by = auth.uid());

create policy price_registration_groups_update
on public.price_registration_groups for update
to authenticated
using (deleted_at is null and public.can_manage_contracts(organization_id))
with check (public.can_manage_contracts(organization_id));

-- Admin requests
create policy admin_requests_select
on public.admin_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or public.can_manage_members(organization_id)
);

create policy admin_requests_insert
on public.admin_requests for insert
to authenticated
with check (
  public.is_organization_member(organization_id)
  and requester_id = auth.uid()
);

create policy admin_requests_update
on public.admin_requests for update
to authenticated
using (public.can_manage_members(organization_id))
with check (public.can_manage_members(organization_id));

-- Notifications
create policy notifications_select
on public.notifications for select
to authenticated
using (
  public.is_organization_member(organization_id)
  and (target_user_id is null or target_user_id = auth.uid())
);

create policy notifications_update_read
on public.notifications for update
to authenticated
using (target_user_id = auth.uid())
with check (target_user_id = auth.uid());

-- AI jobs/results: human users can request and review inside their organization.
create policy ai_jobs_select
on public.ai_analysis_jobs for select
to authenticated
using (public.is_organization_member(organization_id));

create policy ai_jobs_insert
on public.ai_analysis_jobs for insert
to authenticated
with check (
  public.can_write_operational_data(organization_id)
  and requested_by = auth.uid()
  and status = 'pending'
);

create policy ai_results_select
on public.ai_analysis_results for select
to authenticated
using (public.is_organization_member(organization_id));

create policy ai_results_update_review
on public.ai_analysis_results for update
to authenticated
using (public.can_manage_contracts(organization_id))
with check (public.can_manage_contracts(organization_id));

-- Audit is read-only for organization admins and platform admins.
create policy audit_logs_select
on public.audit_logs for select
to authenticated
using (
  public.is_platform_admin()
  or (organization_id is not null and public.can_manage_members(organization_id))
);


-- Data API privileges. RLS remains the authorization boundary.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
