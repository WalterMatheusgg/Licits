import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, CheckCheck, AlertTriangle, FileText, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { LoadingState, EmptyState } from '@/components/common/StateView';
import { logAudit } from '@/lib/audit';

const typeIcons = {
  vencimento: Clock,
  documento_pendente: FileText,
  consumo_alto: AlertTriangle,
  risco: Shield,
  fiscal: Shield,
  geral: Bell,
};

const priorityBadge = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-blue-500/10 text-blue-600',
  alta: 'bg-amber-500/10 text-amber-600',
  critica: 'bg-red-500/10 text-red-600',
};

export default function Notifications() {
  const [typeFilter, setTypeFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => dataClient.entities.Notification.list('-created_date', 100),
    initialData: [],
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => dataClient.entities.Notification.update(id, { read: true }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      logAudit('visualizacao', 'Notification', id, 'Notificação marcada como lida');
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await dataClient.entities.Notification.update(n.id, { read: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      logAudit('visualizacao', 'Notification', '', 'Todas as notificações marcadas como lidas');
    },
  });

  const filtered = notifications.filter(n => typeFilter === 'all' || n.type === typeFilter);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
            <p className="text-sm text-muted-foreground">{unreadCount} não lida(s)</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending} className="gap-2 text-sm">
              <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
            </Button>
          )}
        </div>
      </motion.div>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="vencimento">Vencimento</SelectItem>
          <SelectItem value="documento_pendente">Documento Pendente</SelectItem>
          <SelectItem value="consumo_alto">Consumo Alto</SelectItem>
          <SelectItem value="risco">Risco</SelectItem>
          <SelectItem value="fiscal">Fiscalização</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <LoadingState message="Carregando notificações..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhuma notificação"
          message="Você está em dia! Novos alertas sobre vencimentos, documentos e riscos aparecerão aqui automaticamente."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((n, i) => {
            const IconComp = typeIcons[n.type] || Bell;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`p-4 border-0 shadow-sm flex items-start justify-between gap-4 ${!n.read ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                      <IconComp className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={`${priorityBadge[n.priority]} border-0 text-[10px]`}>{n.priority}</Badge>
                        {n.created_date && <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_date), 'dd/MM/yy HH:mm')}</span>}
                      </div>
                    </div>
                  </div>
                  {!n.read && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 flex-shrink-0" onClick={() => markReadMutation.mutate(n.id)}>
                      Marcar lida
                    </Button>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}