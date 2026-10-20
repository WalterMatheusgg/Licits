import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <ShieldX className="w-8 h-8 text-amber-700" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Acesso não autorizado</h1>
        <p className="text-muted-foreground mb-6">
          Seu papel nesta organização não permite abrir esta página.
        </p>
        <Button asChild><Link to="/">Voltar ao dashboard</Link></Button>
      </div>
    </div>
  );
}
