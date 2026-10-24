-- Run ONLY against disposable LOCAL Supabase in CI. No real users/tenants.
-- Test matrix of org-admin, gestor, fiscal, operacional and visualizador for
-- two isolated organizations, plus an authenticated non-member.
BEGIN;

INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at)
VALUES
 ('a0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-admin-a@example.invalid',now(),now()),
 ('a0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-gestor-a@example.invalid',now(),now()),
 ('a0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-fiscal-a@example.invalid',now(),now()),
 ('a0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-operacional-a@example.invalid',now(),now()),
 ('a0000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-visualizador-a@example.invalid',now(),now()),
 ('a0000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-admin-b@example.invalid',now(),now()),
 ('a0000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-no-membership@example.invalid',now(),now());

INSERT INTO public.organizations(id,name) VALUES
 ('b0000000-0000-4000-8000-000000000001','RLS Tenant A CI'),
 ('b0000000-0000-4000-8000-000000000002','RLS Tenant B CI');

INSERT INTO public.organization_members(organization_id,user_id,role,status,accepted_at)
VALUES
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','organization_admin','active',now()),
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','gestor','active',now()),
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','fiscal','active',now()),
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','operacional','active',now()),
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','visualizador','active',now()),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000006','organization_admin','active',now());

INSERT INTO public.suppliers(id,organization_id,legal_name,created_by)
VALUES
 ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','RLS Supplier A','a0000000-0000-4000-8000-000000000001'),
 ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','RLS Supplier B','a0000000-0000-4000-8000-000000000006');
INSERT INTO public.contracts(id,organization_id,supplier_id,contract_number,object,created_by,status,total_value)
VALUES
 ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','RLS-A-CI','Tenant A contract','a0000000-0000-4000-8000-000000000001','ativo',1000),
 ('d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','RLS-B-CI','Tenant B contract','a0000000-0000-4000-8000-000000000006','ativo',2000);

-- Real PostgreSQL RLS evaluation, not a mock: switch away from postgres.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $matrix$
DECLARE
  person record;
  org_a uuid := 'b0000000-0000-4000-8000-000000000001';
  org_b uuid := 'b0000000-0000-4000-8000-000000000002';
  rejected boolean;
  affected integer;
BEGIN
  FOR person IN SELECT * FROM (VALUES
    ('a0000000-0000-4000-8000-000000000001'::uuid,'organization_admin'::text,true,true,true,true),
    ('a0000000-0000-4000-8000-000000000002'::uuid,'gestor'::text,false,true,true,true),
    ('a0000000-0000-4000-8000-000000000003'::uuid,'fiscal'::text,false,false,true,true),
    ('a0000000-0000-4000-8000-000000000004'::uuid,'operacional'::text,false,false,false,true),
    ('a0000000-0000-4000-8000-000000000005'::uuid,'visualizador'::text,false,false,false,false)
  ) AS roles(user_id,role_name,may_members,may_contracts,may_fiscal,may_operational)
  LOOP
    PERFORM set_config('request.jwt.claim.sub',person.user_id::text,true);
    IF auth.uid() IS DISTINCT FROM person.user_id THEN
      RAISE EXCEPTION 'JWT simulation failed for %',person.role_name;
    END IF;
    IF public.is_platform_admin() OR NOT public.is_organization_member(org_a)
       OR public.is_organization_member(org_b) THEN
      RAISE EXCEPTION 'Membership/tenant isolation failure for %',person.role_name;
    END IF;
    IF public.get_organization_role(org_a)::text IS DISTINCT FROM person.role_name
       OR public.get_organization_role(org_b) IS NOT NULL THEN
      RAISE EXCEPTION 'Role lookup leaked tenant B or failed for %',person.role_name;
    END IF;
    IF public.can_manage_members(org_a) IS DISTINCT FROM person.may_members
       OR public.can_manage_contracts(org_a) IS DISTINCT FROM person.may_contracts
       OR public.can_write_fiscal_data(org_a) IS DISTINCT FROM person.may_fiscal
       OR public.can_write_operational_data(org_a) IS DISTINCT FROM person.may_operational THEN
      RAISE EXCEPTION 'Authorization matrix mismatch for %',person.role_name;
    END IF;
    IF public.can_manage_members(org_b) OR public.can_manage_contracts(org_b)
       OR public.can_write_fiscal_data(org_b) OR public.can_write_operational_data(org_b) THEN
      RAISE EXCEPTION 'Cross-tenant permission grant for %',person.role_name;
    END IF;
    IF (SELECT count(*) FROM public.suppliers WHERE organization_id=org_a)<>1
       OR (SELECT count(*) FROM public.suppliers WHERE organization_id=org_b)<>0
       OR (SELECT count(*) FROM public.contracts WHERE organization_id=org_a)<>1
       OR (SELECT count(*) FROM public.contracts WHERE organization_id=org_b)<>0 THEN
      RAISE EXCEPTION 'Cross-tenant RLS row visibility for %',person.role_name;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id='a0000000-0000-4000-8000-000000000006') THEN
      RAISE EXCEPTION 'Cross-tenant profile visible for %',person.role_name;
    END IF;
    IF NOT public.storage_path_has_read_access(org_a::text||'/file.pdf')
       OR public.storage_path_has_read_access(org_b::text||'/file.pdf')
       OR public.storage_path_has_write_access('contracts',org_a::text||'/file.pdf') IS DISTINCT FROM person.may_contracts
       OR public.storage_path_has_write_access('contracts',org_b::text||'/file.pdf') THEN
      RAISE EXCEPTION 'Cross-tenant storage path access for %',person.role_name;
    END IF;
    -- Cross-tenant INSERT must fail even for admins of tenant A.
    rejected := false;
    BEGIN
      INSERT INTO public.suppliers(organization_id,legal_name,created_by)
      VALUES (org_b,'FORBIDDEN-'||person.role_name,person.user_id);
    EXCEPTION WHEN insufficient_privilege THEN rejected := true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Tenant B accepted supplier insert from %',person.role_name; END IF;

    -- Non-contract managers must also fail to create supplier records in tenant A.
    IF NOT person.may_contracts THEN
      rejected := false;
      BEGIN
        INSERT INTO public.suppliers(organization_id,legal_name,created_by)
        VALUES (org_a,'FORBIDDEN-LOCAL-'||person.role_name,person.user_id);
      EXCEPTION WHEN insufficient_privilege THEN rejected := true;
      END;
      IF NOT rejected THEN RAISE EXCEPTION 'Role % unexpectedly inserted supplier',person.role_name; END IF;
    ELSE
      -- Prevent created_by identity spoofing even by an authorized manager.
      rejected := false;
      BEGIN
        INSERT INTO public.suppliers(organization_id,legal_name,created_by)
        VALUES (org_a,'SPOOF-'||person.role_name,'a0000000-0000-4000-8000-000000000006');
      EXCEPTION WHEN insufficient_privilege THEN rejected := true;
      END;
      IF NOT rejected THEN RAISE EXCEPTION 'Created_by identity spoof permitted for %',person.role_name; END IF;
    END IF;

    -- Cross-tenant UPDATE is invisible to RLS, and DELETE has no client policy.
    UPDATE public.contracts SET object='CROSS-TENANT-INTRUSION'
    WHERE id='d0000000-0000-4000-8000-000000000002';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Cross-tenant UPDATE by %',person.role_name; END IF;

    DELETE FROM public.contracts WHERE id='d0000000-0000-4000-8000-000000000001';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Direct DELETE allowed for %',person.role_name; END IF;

    -- Privileged RPC must reject cross-tenant access before exposing item details.
    rejected := false;
    BEGIN
      PERFORM public.preview_contract_purchase(
        org_b,'d0000000-0000-4000-8000-000000000002',1);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%Unauthorized organization%' THEN rejected := true; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Cross-tenant preview RPC allowed for %',person.role_name; END IF;
  END LOOP;
END
$matrix$;

-- Tenant B admin: reverse-direction isolation.
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000006',true);
DO $reverse$
BEGIN
  IF NOT public.is_organization_member('b0000000-0000-4000-8000-000000000002')
     OR public.is_organization_member('b0000000-0000-4000-8000-000000000001')
     OR (SELECT count(*) FROM public.contracts)<>1
     OR (SELECT count(*) FROM public.suppliers)<>1 THEN
    RAISE EXCEPTION 'Reverse tenant B isolation failed';
  END IF;
END
$reverse$;

-- A valid authenticated session without a membership must see no tenant data.
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000007',true);
DO $outsider$
BEGIN
  IF EXISTS(SELECT 1 FROM public.organizations)
     OR EXISTS(SELECT 1 FROM public.contracts)
     OR EXISTS(SELECT 1 FROM public.suppliers)
     OR public.is_organization_member('b0000000-0000-4000-8000-000000000001')
     OR public.can_manage_contracts('b0000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Unaffiliated authenticated user gained organization data';
  END IF;
END
$outsider$;

RESET ROLE;
ROLLBACK;
