-- Restrict public SECURITY DEFINER RPCs; keep authenticated policy helpers callable.
-- Applied to production on 2026-10-24 and verified with Supabase security advisors.
DO $lockdown$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, p.prorettype::regtype::text AS result_type
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND has_function_privilege('anon',p.oid,'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon',fn.oid::regprocedure);
    IF fn.result_type='trigger' OR fn.proname='write_audit_log' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated',fn.oid::regprocedure);
    END IF;
  END LOOP;
END;
$lockdown$;
