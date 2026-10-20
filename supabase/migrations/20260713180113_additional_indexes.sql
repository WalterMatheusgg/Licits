-- Additional indexes for common filters and reporting.
create index suppliers_org_name_idx
  on public.suppliers (organization_id, legal_name)
  where deleted_at is null;

create index contracts_org_sei_idx
  on public.contracts (organization_id, sei_number)
  where sei_number is not null and deleted_at is null;

create index contracts_org_auction_idx
  on public.contracts (organization_id, auction_number)
  where auction_number is not null and deleted_at is null;

create index contract_items_low_balance_idx
  on public.contract_items (organization_id, contract_id, minimum_qty)
  where deleted_at is null and minimum_qty is not null;

create index documents_org_type_status_idx
  on public.documents (organization_id, document_type, status)
  where deleted_at is null;

create index fiscal_records_org_status_idx
  on public.fiscal_records (organization_id, status, fiscal_date)
  where deleted_at is null;

create index price_registrations_org_status_idx
  on public.price_registrations (organization_id, status)
  where deleted_at is null;

create index ai_jobs_requested_by_idx
  on public.ai_analysis_jobs (requested_by, created_at desc);
