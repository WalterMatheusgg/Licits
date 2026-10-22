-- Security and correctness: do not register each business change twice.
-- 20260713180112 installed the legacy <table>_audit trigger, which copies full row
-- contents including potentially sensitive fields into audit_logs.
-- 20261022140000 installs <table>_audit_changes with redaction and changed_fields.
-- Preserve the latter and retire only the legacy trigger; do not rewrite old migrations.
do $audit_cleanup$
declare table_name text;
begin
  foreach table_name in array array[
    'suppliers','contracts','contract_items','documents','fiscal_records',
    'occurrences','price_registrations','price_registration_groups','admin_requests'
  ] loop
    execute format('drop trigger if exists %I_audit on public.%I',table_name,table_name);
    if not exists(
      select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name
        and t.tgname=table_name||'_audit_changes' and not t.tgisinternal
    ) then
      raise exception 'Missing secure audit trigger for table %',table_name;
    end if;
  end loop;
end
$audit_cleanup$;
