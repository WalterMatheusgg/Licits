import { useOrganization } from '@/contexts/OrganizationContext';

export default function PermissionGuard({
  permission,
  roles,
  fallback = null,
  children,
}) {
  const { can, hasRole } = useOrganization();
  const allowedByPermission = permission ? can(permission) : true;
  const allowedByRole = roles ? hasRole(roles) : true;

  return allowedByPermission && allowedByRole ? children : fallback;
}
