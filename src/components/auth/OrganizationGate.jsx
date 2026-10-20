import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOrganization } from '@/contexts/OrganizationContext';
import LoadingScreen from '@/components/auth/LoadingScreen';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

export default function OrganizationGate() {
  const [busy, setBusy] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const {
    hasOrganizations,
    isLoadingOrganizations,
    organizationError,
    refreshOrganizations,
    pendingInvitations,
    acceptInvitation,
  } = useOrganization();

  if (isLoadingOrganizations) {
    return <LoadingScreen message="Carregando sua organização..." />;
  }

  if (!hasOrganizations && pendingInvitations.length > 0) {
    return (<main className="mx-auto max-w-xl p-6 space-y-4"><h1 className="text-xl font-bold">Convites de organizações</h1><p>Revise e aceite o acesso oferecido à sua conta.</p>{inviteError && <p role="alert" className="text-red-600">{inviteError}</p>}{pendingInvitations.map(item => <Card key={item.id} className="p-4 flex justify-between items-center gap-4"><div><strong>{item.organization?.name}</strong><p className="text-xs text-muted-foreground">Perfil: {item.role}</p></div><Button disabled={busy !== null} onClick={async () => {setInviteError(null);setBusy(item.id);try{await acceptInvitation(item.organization_id);}catch(e){setInviteError(e.message);}finally{setBusy(null);}}}>{busy===item.id?'Aceitando…':'Aceitar convite'}</Button></Card>)}</main>);
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
