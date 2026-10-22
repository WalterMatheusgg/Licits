alter table public.fiscal_records
  add column due_date date,
  add column priority public.severity_level not null default 'media';

alter table public.occurrences
  add column due_date date;

create index fiscal_records_due_queue_idx
  on public.fiscal_records (organization_id, due_date, priority)
  where deleted_at is null and status <> 'concluido';

create index occurrences_due_queue_idx
  on public.occurrences (organization_id, due_date, severity)
  where deleted_at is null and status in ('aberta', 'em_analise');