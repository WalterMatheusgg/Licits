import React from 'react';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';

export function LoadingState({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary/50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nada por aqui', message = '', action = null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {message && <p className="text-sm text-muted-foreground max-w-md mb-4">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Ocorreu um erro ao carregar os dados.', onRetry = null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Algo deu errado</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-primary hover:underline">
          Tentar novamente
        </button>
      )}
    </div>
  );
}
