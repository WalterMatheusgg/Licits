import { Outlet } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import AccessDenied from '@/pages/auth/AccessDenied';

export default function RequirePermission({ permission, roles }) {
  const { can, hasRole } = useOrganization();
  const allowed = (permission ? can(permission) : true)
    && (roles ? hasRole(roles) : true);

  return allowed ? <Outlet /> : <AccessDenied />;
}
