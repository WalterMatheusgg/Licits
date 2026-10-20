import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const FISCAL_COLORS = { adequada: '#22c55e', regular: '#f59e0b', baixa: '#ef4444' };

export default function Fiscal() {
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
    initialData: [],
  });

  const { data: fiscalRecords = [] } = useQuery({
    queryKey: ['fiscal-records-all'],
    queryFn: () => dataClient.entities.FiscalRecord.list('-created_date', 50),
    initialData: [],
  });

  const active = contracts.filter(c => c.status === 'ativo');
  const adequate = active.filter(c => c.fiscal_status === 'adequada');
  const regular = active.filter(c => c.fiscal_status === 'regular');
  const low = active.filter(c => c.fiscal_status === 'baixa');

  const pieData = [
    { name: 'Adequada', value: adequate.length, color: FISCAL_COLORS.adequada },
    { name: 'Regular', value: regular.length, color: FISCAL_COLORS.regular },
    { name: 'Baixa', value: low.length, color: FISCAL_COLORS.baixa },
  ].filter(d => d.value > 0);

  const getFiscalIcon = (status) => {
    if (status === 'adequada') return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    if (status === 'regular') return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">Mapa de Fiscalização</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento do nível de fiscalização dos contratos</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Fiscalização Adequada', count: adequate.length, total: active.length, color: 'emerald', icon: ShieldCheck },
          { label: 'Fiscalização Regular', count: regular.length, total: active.length, color: 'amber', icon: AlertTriangle },
          { label: 'Fiscalização Baixa', count: low.length, total: active.length, color: 'red', icon: XCircle },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="p-5 border-0 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <item.icon className={`w-5 h-5 text-${item.color}-600`} />
              </div>
              <p className="text-3xl font-bold">{item.count}</p>
              <Progress value={item.total ? (item.count / item.total) * 100 : 0} className="h-1.5 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{item.total ? ((item.count / item.total) * 100).toFixed(0) : 0}% dos contratos ativos</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição da Fiscalização</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contratos que Necessitam Atenção</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...low, ...regular].slice(0, 8).map(c => (
              <Link key={c.id} to={`/contracts/${c.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-3">
                  {getFiscalIcon(c.fiscal_status)}
                  <div>
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{c.contract_number}</p>
                    <p className="text-xs text-muted-foreground">{c.supplier_name}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{c.fiscal_status}</Badge>
              </Link>
            ))}
            {low.length === 0 && regular.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Todos os contratos com fiscalização adequada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent fiscal records */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Últimos Registros de Fiscalização</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {fiscalRecords.slice(0, 10).map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.record_type?.replace('_',' ')}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
            </div>
          ))}
          {fiscalRecords.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado</p>}
        </CardContent>
      </Card>
    </div>
  );
}