-- Corresponde a migração 20261024084913 aplicada remotamente no projeto Licits2.0.
-- Cacheia o resultado de auth.uid() no escopo da instrução sem alterar os predicados de permissão.
-- Idempotente quando pg_get_expr já serializa a expressão como (SELECT auth.uid()).
DO $migration$
DECLARE r record; expr_using text; expr_check text; stmt text;
BEGIN
  FOR r IN SELECT * FROM pg_policies
    WHERE schemaname='public'
      AND (coalesce(qual,'') LIKE '%auth.uid()%' OR coalesce(with_check,'') LIKE '%auth.uid()%')
  LOOP
    expr_using := replace(replace(r.qual, '(SELECT auth.uid())', '__ALREADY_CACHED_UID__'),
      'auth.uid()', '(select auth.uid())');
    expr_check := replace(replace(r.with_check, '(SELECT auth.uid())', '__ALREADY_CACHED_UID__'),
      'auth.uid()', '(select auth.uid())');
    expr_using := replace(expr_using, '__ALREADY_CACHED_UID__', '(SELECT auth.uid())');
    expr_check := replace(expr_check, '__ALREADY_CACHED_UID__', '(SELECT auth.uid())');
    stmt := format('ALTER POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename);
    IF r.qual IS NOT NULL THEN stmt := stmt || format(' USING (%s)',expr_using); END IF;
    IF r.with_check IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)',expr_check); END IF;
    EXECUTE stmt;
  END LOOP;
END $migration$;
