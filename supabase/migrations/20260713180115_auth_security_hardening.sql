-- Tighten client-side update privileges before enabling Supabase Auth screens.

create or replace function public.prevent_tenant_reassignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed after creation';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_membership_identity_reassignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'membership organization_id and user_id are immutable';
  end if;
  return new;
end;
$$;

create trigger organization_members_prevent_identity_reassignment
before update on public.organization_members
for each row execute function public.prevent_membership_identity_reassignment();

create trigger suppliers_prevent_tenant_reassignment
before update on public.suppliers
for each row execute function public.prevent_tenant_reassignment();

create trigger contracts_prevent_tenant_reassignment
before update on public.contracts
for each row execute function public.prevent_tenant_reassignment();

create trigger contract_items_prevent_tenant_reassignment
before update on public.contract_items
for each row execute function public.prevent_tenant_reassignment();

create trigger documents_prevent_tenant_reassignment
before update on public.documents
for each row execute function public.prevent_tenant_reassignment();

create trigger fiscal_records_prevent_tenant_reassignment
before update on public.fiscal_records
for each row execute function public.prevent_tenant_reassignment();

create trigger occurrences_prevent_tenant_reassignment
before update on public.occurrences
for each row execute function public.prevent_tenant_reassignment();

create trigger price_registrations_prevent_tenant_reassignment
before update on public.price_registrations
for each row execute function public.prevent_tenant_reassignment();

create trigger price_registration_groups_prevent_tenant_reassignment
before update on public.price_registration_groups
for each row execute function public.prevent_tenant_reassignment();

create trigger admin_requests_prevent_tenant_reassignment
before update on public.admin_requests
for each row execute function public.prevent_tenant_reassignment();

create trigger notifications_prevent_tenant_reassignment
before update on public.notifications
for each row execute function public.prevent_tenant_reassignment();

create trigger ai_analysis_jobs_prevent_tenant_reassignment
before update on public.ai_analysis_jobs
for each row execute function public.prevent_tenant_reassignment();

create trigger ai_analysis_results_prevent_tenant_reassignment
before update on public.ai_analysis_results
for each row execute function public.prevent_tenant_reassignment();

-- A user may update only benign profile fields through the browser.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_path, last_access_at, updated_at)
  on public.profiles to authenticated;

-- Browser users may only mark their own notifications as read.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on function public.prevent_tenant_reassignment() from public;
revoke all on function public.prevent_membership_identity_reassignment() from public;
