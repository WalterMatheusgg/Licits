-- Read-only audit controls. Safe for a connected staging database: no writes.
-- A passing check verifies deployed triggers, not delivery/restore or complete production readiness.
begin transaction read only;

do $verify_audit$
declare
  name text;
  count_safe integer;
  count_legacy integer;
begin
  foreach name in array array[
    'organizations', 'organization_members', 'suppliers', 'contracts',
    'contract_items', 'documents', 'fiscal_records', 'occurrences',
    'price_registrations', 'price_registration_groups', 'admin_requests',
    'integration_credentials'
  ] loop
    select count(*) filter (where t.tgname = name || '_audit_changes'),
           count(*) filter (where t.tgname = name || '_audit')
      into count_safe, count_legacy
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = name and not t.tgisinternal;
    if count_safe <> 1 then
      raise exception 'Expected one protected audit trigger on public.%, found %', name, count_safe;
    end if;
    if count_legacy <> 0 then
      raise exception 'Legacy audit trigger still present on public.%', name;
    end if;
  end loop;
  raise notice 'Protected audit triggers verified for 12 tables; no legacy audit triggers.';
end;
$verify_audit$;

-- Report count only: existing legacy rows may have been created before redaction.
-- Never print the historical old_data/new_data values in CI logs.
select count(*) as historical_audit_rows_with_sensitive_keys
  from public.audit_logs
 where coalesce(old_data, '{}'::jsonb) ?| array[
         'token_hash','email','phone','address','cnpj','notes','content','description'
       ]
    or coalesce(new_data, '{}'::jsonb) ?| array[
         'token_hash','email','phone','address','cnpj','notes','content','description'
       ];

rollback;
