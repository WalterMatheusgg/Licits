import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function AccountBlocked({ message }) {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <LockKeyhole className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-red-600 mb-2">Acesso indisponível</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {message || 'Sua conta não está liberada para acessar o sistema.'}
        </p>
        <Button variant="outline" onClick={logout}>Sair</Button>
      </div>
    </div>
  );
}
