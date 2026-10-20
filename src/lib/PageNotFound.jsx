import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { can } = useOrganization();
  const pageName = location.pathname.substring(1) || location.pathname;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-muted-foreground/30">404</h1>
          <div className="h-0.5 w-16 bg-border mx-auto" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-medium text-foreground">Página não encontrada</h2>
          <p className="text-muted-foreground leading-relaxed">
            A página <span className="font-medium text-foreground">“{pageName}”</span> não existe ou foi movida.
          </p>
        </div>

        {isAuthenticated && can('members.manage') && (
          <div className="p-4 bg-card rounded-xl border text-left">
            <p className="text-sm font-medium text-foreground">Informação administrativa</p>
            <p className="text-sm text-muted-foreground mt-1">
              Verifique a rota no arquivo App.jsx antes de adicionar um novo item ao menu.
            </p>
          </div>
        )}

        <Button asChild>
          <Link to={isAuthenticated ? '/' : '/login'}>
            <Home className="w-4 h-4 mr-2" />
            {isAuthenticated ? 'Voltar ao início' : 'Ir para o login'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
