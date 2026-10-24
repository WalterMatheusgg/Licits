-- Guard tenant access after membership suspension/removal.
-- Harden notification updates to allow only marking a targeted message read.
-- Business data and authorization roles are unchanged.
ALTER POLICY admin_requests_select ON public.admin_requests
TO authenticated
USING (
  (public.is_organization_member(organization_id)
    AND requester_id = (SELECT auth.uid()))
  OR public.can_manage_members(organization_id)
);

ALTER POLICY notifications_update_read ON public.notifications
TO authenticated
USING (
  public.is_organization_member(organization_id)
  AND target_user_id = (SELECT auth.uid())
)
WITH CHECK (
  public.is_organization_member(organization_id)
  AND target_user_id = (SELECT auth.uid())
);

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
