-- CI only: archived contracts and child events remain available to authorized staff.
-- All records are fictitious and rolled back.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,created_at,updated_at) VALUES
 ('f2000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','history-a@example.invalid',now(),now()),
 ('f2000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','history-b@example.invalid',now(),now());
INSERT INTO public.organizations(id,name) VALUES
 ('f2000000-0000-4000-8000-000000000003','History A'),
 ('f2000000-0000-4000-8000-000000000004','History B');
INSERT INTO public.organization_members(organization_id,user_id,role,status,accepted_at) VALUES
 ('f2000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','organization_admin','active',now()),
 ('f2000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000002','organization_admin','active',now());
INSERT INTO public.suppliers(id,organization_id,legal_name,created_by) VALUES
 ('f2000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000003','History Supplier','f2000000-0000-4000-8000-000000000001');
INSERT INTO public.contracts(id,organization_id,supplier_id,contract_number,object,created_by,status,total_value) VALUES
 ('f2000000-0000-4000-8000-000000000006','f2000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000005','HISTORY-2026','Testing immutable history','f2000000-0000-4000-8000-000000000001','em_analise',1000);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
INSERT INTO public.contract_items(id,organization_id,contract_id,item_number,description,contracted_qty,unit_price)
VALUES ('f2000000-0000-4000-8000-000000000007','f2000000-0000-4000-8000-000000000003',
'f2000000-0000-4000-8000-000000000006','01','Removed test item',10,20);
UPDATE public.contracts SET status='ativo' WHERE id='f2000000-0000-4000-8000-000000000006';
SELECT public.archive_business_record('contract_items','f2000000-0000-4000-8000-000000000007','f2000000-0000-4000-8000-000000000003');
DO $verify$
DECLARE found_status boolean; found_archive boolean;
BEGIN
 SELECT exists(select 1 from public.get_contract_history(
 'f2000000-0000-4000-8000-000000000003',
 'f2000000-0000-4000-8000-000000000006',50,0)
 where entity_type='contracts' and status_before='em_analise' and status_after='ativo') INTO found_status;
 SELECT exists(select 1 from public.get_contract_history(
 'f2000000-0000-4000-8000-000000000003',
 'f2000000-0000-4000-8000-000000000006',50,0)
 where entity_type='contract_items' and event_action='archive') INTO found_archive;
 IF NOT found_status OR NOT found_archive THEN
   RAISE EXCEPTION 'Contract timeline missing status change or archived child event';
 END IF;
 IF EXISTS(select 1 from public.list_archived_contracts('f2000000-0000-4000-8000-000000000003'))
 THEN RAISE EXCEPTION 'Active contract incorrectly returned as archived'; END IF;
END $verify$;
SELECT public.archive_business_record('contracts','f2000000-0000-4000-8000-000000000006','f2000000-0000-4000-8000-000000000003');
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.list_archived_contracts('f2000000-0000-4000-8000-000000000003'))<>1
 THEN RAISE EXCEPTION 'Archived contract missing for organization admin'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.get_contract_history(
 'f2000000-0000-4000-8000-000000000003',
 'f2000000-0000-4000-8000-000000000006',50,0)
 WHERE entity_type='contracts' AND event_action='archive')
 THEN RAISE EXCEPTION 'Contract archive absent from history'; END IF;
END $verify$;
SELECT set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
DO $verify$
BEGIN
 IF EXISTS(select 1 from public.list_archived_contracts('f2000000-0000-4000-8000-000000000003'))
 OR EXISTS(select 1 from public.get_contract_history(
 'f2000000-0000-4000-8000-000000000003',
 'f2000000-0000-4000-8000-000000000006',50,0))
 THEN RAISE EXCEPTION 'Cross-organization access to contract history permitted'; END IF;
END $verify$;
RESET ROLE;
ROLLBACK;
