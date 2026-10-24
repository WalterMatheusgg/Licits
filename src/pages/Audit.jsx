import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Search, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const actionLabels = {
  login: 'Login', logout: 'Logout', upload: 'Upload', download: 'Download',
  exclusao: 'Exclusão', alteracao: 'Alteração', assinatura: 'Assinatura',
  aprovacao: 'Aprovação', cadastro: 'Cadastro', visualizacao: 'Visualização'
};

const actionColors = {
  login: 'bg-emerald-500/10 text-emerald-600',
  logout: 'bg-gray-500/10 text-gray-600',
  upload: 'bg-blue-500/10 text-blue-600',
  download: 'bg-violet-500/10 text-violet-600',
  exclusao: 'bg-red-500/10 text-red-600',
  alteracao: 'bg-amber-500/10 text-amber-600',
  assinatura: 'bg-emerald-600/10 text-emerald-700',
  aprovacao: 'bg-primary/10 text-primary',
  cadastro: 'bg-accent/10 text-accent',
  visualizacao: 'bg-muted text-muted-foreground'
};

export default function Audit() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => dataClient.entities.AuditLog.list('-created_date', 100),
    initialData: [],
  });

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.user_email?.toLowerCase().includes(search.toLowerCase()) || l.details?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6" /> Auditoria
        </h1>
        <p className="text-sm text-muted-foreground">Registro de todas as movimentações do sistema</p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por usuário ou detalhe..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Ações</SelectItem>
            {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{log.user_name || log.user_email || 'Sistema'}</span>
                        <Badge className={`${actionColors[log.action]} border-0 text-[10px]`}>{actionLabels[log.action] || log.action}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{log.details}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{log.created_date && format(new Date(log.created_date), "dd/MM/yy HH:mm", { locale: ptBR })}</p>
                    {log.ip_address && <p className="text-[10px] text-muted-foreground/60">{log.ip_address}</p>}
                  </div>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum registro de auditoria</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}