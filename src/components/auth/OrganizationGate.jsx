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

  if (isLoadingOrganizations) return <LoadingScreen message="Carregando sua organização..." />;

  const pendingPanel = pendingInvitations.length > 0 && (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-5" aria-label="Convites pendentes">
      <h1 className="text-xl font-bold">Convites de organizações</h1>
      <p className="text-sm text-muted-foreground">Revise e aceite o acesso oferecido à sua conta.</p>
      {inviteError && <p role="alert" className="text-red-600">{inviteError}</p>}
      {pendingInvitations.map(item => (
        <Card key={item.id} className="p-4 flex flex-wrap justify-between items-center gap-4">
          <div>
            <strong>{item.organization?.name}</strong>
            <p className="text-xs text-muted-foreground">Perfil: {item.role}</p>
          </div>
          <Button disabled={busy !== null} onClick={async () => {
            setInviteError(null);
            setBusy(item.id);
            try { await acceptInvitation(item.organization_id); }
            catch (error) { setInviteError(error.message); }
            finally { setBusy(null); }
          }}>
            {busy === item.id ? 'Aceitando…' : 'Aceitar convite'}
          </Button>
        </Card>
      ))}
    </section>
  );

  if (!hasOrganizations) {
    if (pendingInvitations.length > 0) return <main className="min-h-screen bg-background">{pendingPanel}</main>;
    return <UserNotRegisteredError errorMessage={organizationError} onRetry={refreshOrganizations} />;
  }

  // Accounts already belonging to an organization must also be able to accept
  // an invitation to a second organization. Do not silently hide those invites.
  return (
    <>
      {pendingPanel}
      <Outlet />
    </>
  );
}
