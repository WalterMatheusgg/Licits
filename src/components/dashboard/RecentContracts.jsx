import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { differenceInDays } from 'date-fns';
import { ArrowRight } from 'lucide-react';

const statusBadge = {
  ativo: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  vencido: 'bg-red-500/10 text-red-600 border-red-500/20',
  encerrado: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  suspenso: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  em_analise: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  cancelado: 'bg-red-700/10 text-red-700 border-red-700/20'
};

export default function RecentContracts({ contracts }) {
  const recent = contracts.slice(0, 5);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">Contratos Recentes</CardTitle>
        <Link to="/contracts" className="text-xs text-primary hover:underline flex items-center gap-1">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum contrato cadastrado</p>
        )}
        {recent.map(c => {
          const daysLeft = c.end_date ? differenceInDays(new Date(c.end_date), new Date()) : null;
          return (
            <Link key={c.id} to={`/contracts/${c.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{c.contract_number}</p>
                <p className="text-xs text-muted-foreground truncate">{c.supplier_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                  <span className="text-[10px] text-amber-600 font-medium">{daysLeft}d</span>
                )}
                <Badge variant="outline" className={statusBadge[c.status] || ''}>
                  {c.status?.replace('_', ' ')}
                </Badge>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}