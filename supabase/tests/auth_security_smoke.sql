-- Run after applying 20260713180115_auth_security_hardening.sql.

-- Confirm tenant-reassignment triggers exist.
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name like '%prevent%reassignment%'
order by event_object_table, trigger_name;

-- Confirm the authenticated role has only approved profile update columns.
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('profiles', 'notifications')
  and privilege_type = 'UPDATE'
order by table_name, column_name;

-- Expected profile columns:
-- avatar_path, full_name, last_access_at, phone, updated_at
-- Expected notification column:
-- read_at
