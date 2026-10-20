import { Outlet } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import LoadingScreen from '@/components/auth/LoadingScreen';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

export default function OrganizationGate() {
  const {
    hasOrganizations,
    isLoadingOrganizations,
    organizationError,
    refreshOrganizations,
  } = useOrganization();

  if (isLoadingOrganizations) {
    return <LoadingScreen message="Carregando sua organização..." />;
  }

  if (!hasOrganizations) {
    return (
      <UserNotRegisteredError
        errorMessage={organizationError}
        onRetry={refreshOrganizations}
      />
    );
  }

  return <Outlet />;
}
