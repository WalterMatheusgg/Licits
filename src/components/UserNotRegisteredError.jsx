import { Building2, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function UserNotRegisteredError({ errorMessage, onRetry }) {
  const { logout, user } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/40 px-4">
      <div className="max-w-md w-full p-8 bg-card rounded-2xl shadow-lg border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <Building2 className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Organização não vinculada</h1>
          <p className="text-muted-foreground mb-2">
            Sua conta existe, mas ainda não possui acesso ativo a uma organização.
          </p>
          {user?.email && (
            <p className="text-xs text-muted-foreground mb-6">Conta: {user.email}</p>
          )}
          {errorMessage && (
            <div className="p-3 mb-5 rounded-lg bg-destructive/10 text-destructive text-sm">
              {errorMessage}
            </div>
          )}
          <div className="p-4 bg-muted/60 rounded-xl text-sm text-muted-foreground text-left mb-6">
            Solicite ao administrador que crie ou ative seu vínculo em
            <strong className="text-foreground"> organization_members</strong>.
          </div>
          <div className="flex gap-3 justify-center">
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Verificar novamente
              </Button>
            )}
            <Button variant="ghost" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
