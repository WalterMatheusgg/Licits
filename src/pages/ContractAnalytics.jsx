import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3, Loader2, TrendingUp, Package, ClipboardCheck, AlertOctagon } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];

export default function ContractAnalytics() {
  const { id } = useParams();
  const contractId = id;

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => { const list = await base44.entities.Contract.filter({ id: contractId }); return list[0]; },
    enabled: !!contractId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['contract-items', contractId],
    queryFn: () => base44.entities.ContractItem.filter({ contract_id: contractId }),
    enabled: !!contractId, initialData: [],
  });

  const { data: fiscalRecords = [] } = useQuery({
    queryKey: ['fiscal-records', contractId],
    queryFn: () => base44.entities.FiscalRecord.filter({ contract_id: contractId }, '-fiscal_date'),
    enabled: !!contractId, initialData: [],
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ['occurrences', contractId],
    queryFn: () => base44.entities.Occurrence.filter({ contract_id: contractId }),
    enabled: !!contractId, initialData: [],
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['withdrawals', contractId],
    queryFn: () => base44.entities.ItemWithdrawal.filter({ contract_id: contractId }, '-withdrawal_date'),
    enabled: !!contractId, initialData: [],
  });

  if (isLoading || !contract) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  // -- Charts data --
  // Items consumption
  const itemsChartData = items.slice(0, 10).map(i => ({
    name: i.description?.substring(0, 20) + (i.description?.length > 20 ? '...' : ''),
    contratado: i.contracted_qty || 0,
    utilizado: i.used_qty || 0,
    saldo: Math.max(0, (i.contracted_qty || 0) - (i.used_qty || 0)),
  }));

  // Fiscal records by type
  const fiscalByType = fiscalRecords.reduce((acc, r) => {
    acc[r.record_type] = (acc[r.record_type] || 0) + 1;
    return acc;
  }, {});
  const fiscalPieData = Object.entries(fiscalByType).map(([name, value]) => ({ name, value }));

  // Fiscal records by month
  const fiscalByMonth = fiscalRecords.reduce((acc, r) => {
    if (!r.fiscal_date) return acc;
    const month = format(new Date(r.fiscal_date), 'MMM/yy', { locale: ptBR });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const fiscalLineData = Object.entries(fiscalByMonth).slice(-12).map(([month, count]) => ({ month, registros: count }));

  // Occurrences by severity
  const occBySeverity = [
    { name: 'Crítica', value: occurrences.filter(o => o.severity === 'critica').length, color: '#ef4444' },
    { name: 'Alta', value: occurrences.filter(o => o.severity === 'alta').length, color: '#f97316' },
    { name: 'Média', value: occurrences.filter(o => o.severity === 'media').length, color: '#f59e0b' },
    { name: 'Baixa', value: occurrences.filter(o => o.severity === 'baixa').length, color: '#22c55e' },
  ].filter(o => o.value > 0);

  // Withdrawals by month
  const wdByMonth = withdrawals.reduce((acc, w) => {
    if (!w.withdrawal_date) return acc;
    const month = format(new Date(w.withdrawal_date), 'MMM/yy', { locale: ptBR });
    acc[month] = (acc[month] || 0) + (w.quantity || 0);
    return acc;
  }, {});
  const wdLineData = Object.entries(wdByMonth).slice(-12).map(([month, qty]) => ({ month, baixas: qty }));

  const daysLeft = contract.end_date ? differenceInDays(new Date(contract.end_date), new Date()) : null;
  const usedPercent = contract.total_value ? Math.min(100, ((contract.used_value || 0) / contract.total_value) * 100) : 0;
  const totalUsedItems = items.reduce((s, i) => s + (i.used_qty || 0), 0);
  const totalContractedItems = items.reduce((s, i) => s + (i.contracted_qty || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/contracts/${contractId}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold truncate">Análise — {contract.contract_number}</h1>
          </div>
          <p className="text-sm text-muted-foreground truncate">{contract.supplier_name} · {contract.object}</p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Valor Total', value: fmtBRL(contract.total_value), sub: `${usedPercent.toFixed(0)}% utilizado`, color: 'bg-blue-500' },
          { label: 'Dias Restantes', value: daysLeft !== null ? `${daysLeft}d` : '—', sub: contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : '—', color: daysLeft !== null && daysLeft < 30 ? 'bg-red-500' : 'bg-emerald-500' },
          { label: 'Rotinas de Fiscalização', value: fiscalRecords.length, sub: `${fiscalRecords.filter(r=>r.status==='concluido').length} concluídas`, color: 'bg-violet-500' },
          { label: 'Ocorrências', value: occurrences.length, sub: `${occurrences.filter(o=>o.severity==='critica'||o.severity==='alta').length} graves`, color: 'bg-amber-500' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4 border-0 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${kpi.color} mb-2`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Items consumption chart */}
      {itemsChartData.length > 0 && (
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Consumo de Itens</h3>
            <span className="text-xs text-muted-foreground ml-auto">{totalUsedItems}/{totalContractedItems} unidades utilizadas</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={itemsChartData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, n) => [v, n === 'contratado' ? 'Contratado' : n === 'utilizado' ? 'Utilizado' : 'Saldo']} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="contratado" fill="#e0e7ff" radius={[3,3,0,0]} />
              <Bar dataKey="utilizado" fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="saldo" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Withdrawals over time */}
      {wdLineData.length > 0 && (
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">Histórico de Baixas (por mês)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={wdLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="baixas" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Qtd. Baixas" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fiscal by type */}
        {fiscalPieData.length > 0 && (
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck className="w-4 h-4 text-violet-600" />
              <h3 className="font-semibold text-sm">Fiscalização por Tipo</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={fiscalPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {fiscalPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Occurrences by severity */}
        {occBySeverity.length > 0 && (
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertOctagon className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-sm">Ocorrências por Severidade</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={occBySeverity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                <Tooltip />
                <Bar dataKey="value" radius={[0,4,4,0]} name="Ocorrências">
                  {occBySeverity.map((o, i) => <Cell key={i} fill={o.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Fiscal over time */}
      {fiscalLineData.length > 0 && (
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-sm">Registros de Fiscalização por Mês</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={fiscalLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="registros" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Registros" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {(itemsChartData.length === 0 && fiscalPieData.length === 0 && occBySeverity.length === 0) && (
        <Card className="p-10 border-0 shadow-sm text-center text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum dado registrado ainda para gerar análises.</p>
          <p className="text-xs mt-1">Adicione itens, rotinas de fiscalização ou ocorrências ao contrato.</p>
        </Card>
      )}
    </div>
  );
}