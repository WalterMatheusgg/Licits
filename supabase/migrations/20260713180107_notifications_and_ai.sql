-- User notifications and human-reviewed AI processing.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  priority public.notification_priority not null default 'media',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_message_not_blank check (btrim(message) <> '')
);

create table public.ai_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid,
  job_type text not null,
  status public.ai_job_status not null default 'pending',
  requested_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  model text,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost numeric(14,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_jobs_document_fk
    foreign key (organization_id, document_id)
    references public.documents (organization_id, id)
    on delete restrict,
  constraint ai_jobs_tokens_nonnegative check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  ),
  constraint ai_jobs_cost_nonnegative check (estimated_cost is null or estimated_cost >= 0),
  constraint ai_jobs_times_coherent check (
    started_at is null or finished_at is null or finished_at >= started_at
  ),
  constraint ai_jobs_org_id_id_unique unique (organization_id, id)
);

create table public.ai_analysis_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  document_id uuid,
  result jsonb not null,
  review_status public.ai_review_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_results_job_fk
    foreign key (organization_id, job_id)
    references public.ai_analysis_jobs (organization_id, id)
    on delete cascade,
  constraint ai_results_document_fk
    foreign key (organization_id, document_id)
    references public.documents (organization_id, id)
    on delete restrict,
  constraint ai_results_review_coherent check (
    review_status = 'pending'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create index notifications_user_unread_idx
  on public.notifications (target_user_id, created_at desc)
  where read_at is null;
create index notifications_org_idx
  on public.notifications (organization_id, created_at desc);
create index ai_jobs_status_idx
  on public.ai_analysis_jobs (organization_id, status, created_at desc);
create index ai_results_job_idx
  on public.ai_analysis_results (organization_id, job_id);
