import { useOrganization } from '@/contexts/OrganizationContext';

export const usePermissions = () => {
  const { can, hasRole, role, isPlatformAdmin } = useOrganization();
  return { can, hasRole, role, isPlatformAdmin };
};
