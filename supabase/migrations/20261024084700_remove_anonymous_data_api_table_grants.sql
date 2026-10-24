-- Licits is invite-only. All existing RLS policies in public target authenticated.
-- Revoke direct Data API access for the anon role as defense in depth.
-- Leaves authenticated/service_role privileges, Auth endpoints and RLS unchanged.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM anon;
