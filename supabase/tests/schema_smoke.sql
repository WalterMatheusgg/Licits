-- Execute after all migrations.
-- This script only inspects the schema. Authorization tests require real auth users.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'organizations', 'profiles', 'organization_members', 'suppliers',
    'contracts', 'contract_items', 'item_withdrawals', 'documents',
    'fiscal_records', 'occurrences', 'price_registrations',
    'price_registration_groups', 'admin_requests', 'notifications',
    'ai_analysis_jobs', 'ai_analysis_results', 'audit_logs',
    'contract_expiry_alerts', 'integration_credentials'
  )
order by tablename;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'is_platform_admin',
    'current_user_organization_ids',
    'is_organization_member',
    'has_organization_role',
    'register_item_withdrawal'
  )
order by routine_name;
