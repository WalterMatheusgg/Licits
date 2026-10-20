import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, ExternalLink, ArrowUpDown, FileText } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { motion } from 'framer-motion';
import { LoadingState, EmptyState } from '@/components/common/StateView';
import { exportToCSV } from '@/lib/export';

const safeFormat = (dateStr, fmt) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, fmt);
  } catch {
    return '—';
  }
};

const safeDiff = (dateStr) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return differenceInDays(d, new Date());
  } catch {
    return null;
  }
};

const vigenciaIndicator = (daysLeft) => {
  if (daysLeft === null) return { color: 'bg-gray-400', label: '—' };
  if (daysLeft < 0) return { color: 'bg-red-500', label: 'Vencido' };
  if (daysLeft <= 30) return { color: 'bg-amber-500', label: `${daysLeft}d` };
  return { color: 'bg-emerald-500', label: `${daysLeft}d` };
};

const extendIndicator = (val) => {
  if (val === 'sim') return { color: 'bg-emerald-500', label: 'Sim' };
  if (val === 'nao') return { color: 'bg-red-500', label: 'Não' };
  return { color: 'bg-gray-400', label: 'Pendente' };
};

const fiscalIndicator = (val) => {
  if (val === 'adequada') return { color: 'bg-emerald-500', label: 'Adequada' };
  if (val === 'regular') return { color: 'bg-amber-500', label: 'Regular' };
  return { color: 'bg-red-500', label: 'Baixa' };
};

const csvColumns = [
  { label: 'Contrato', value: 'contract_number' },
  { label: 'Objeto', value: 'object' },
  { label: 'Empresa', value: 'supplier_name' },
  { label: 'CNPJ', value: 'supplier_cnpj' },
  { label: 'Setor', value: 'responsible_sector' },
  { label: 'Início', value: 'start_date' },
  { label: 'Vigência', value: 'end_date' },
  { label: 'Status', value: 'status' },
  { label: 'Valor Total', value: c => (c.total_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  { label: 'Valor Utilizado', value: c => (c.used_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  { label: 'Saldo', value: c => ((c.total_value || 0) - (c.used_value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  { label: 'Prorrogação', value: c => `${c.extensions_done || 0}/${c.max_extensions || 5}` },
  { label: 'Fiscalização', value: 'fiscal_status' },
];

export default function ContractTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [sortField, setSortField] = useState('end_date');
  const [sortDir, setSortDir] = useState(1);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
    initialData: [],
  });

  const filtered = contracts
    .filter(c => {
      const matchSearch = !search || [c.contract_number, c.supplier_name, c.object, c.supplier_cnpj].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchState = stateFilter === 'all' || c.supplier_state === stateFilter;
      return matchSearch && matchStatus && matchState;
    })
    .sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      return sortDir * (aVal > bVal ? 1 : -1);
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(-sortDir);
    else { setSortField(field); setSortDir(1); }
  };

  const states = [...new Set(contracts.map(c => c.supplier_state).filter(Boolean))].sort();

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quadro Resumido de Contratos</h1>
          <p className="text-sm text-muted-foreground">Visão gerencial de todos os contratos</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => exportToCSV(`contratos_${new Date().toISOString().slice(0,10)}.csv`, filtered, csvColumns)}
          disabled={filtered.length === 0}
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos UF</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState message="Carregando contratos..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum contrato encontrado"
            message="Ajuste os filtros de busca ou cadastre um novo contrato para vê-lo aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort('contract_number')}>
                    <div className="flex items-center gap-1">Contrato<ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                  </TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort('supplier_name')}>
                    <div className="flex items-center gap-1">Empresa<ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Setor</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort('end_date')}>
                    <div className="flex items-center gap-1">Vigência<ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                  </TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Prorrog.</TableHead>
                  <TableHead className="hidden md:table-cell">Fiscal.</TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort('total_value')}>
                    <div className="flex items-center gap-1">Saldo<ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const daysLeft = safeDiff(c.end_date);
                  const vig = vigenciaIndicator(daysLeft);
                  const ext = extendIndicator(c.can_extend);
                  const fisc = fiscalIndicator(c.fiscal_status);
                  const usedPct = c.total_value ? ((c.used_value || 0) / c.total_value * 100) : 0;

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm whitespace-nowrap">{c.contract_number || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate" title={c.object}>{c.object || '—'}</TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[150px]" title={c.supplier_name}>{c.supplier_name || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{c.supplier_cnpj || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">{c.responsible_sector || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {safeFormat(c.start_date, 'dd/MM/yy')} — {safeFormat(c.end_date, 'dd/MM/yy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${vig.color}`} />
                          <span className="text-xs font-medium whitespace-nowrap">{vig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize whitespace-nowrap">{c.status?.replace('_',' ') || '—'}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${ext.color}`} />
                          <span className="text-xs whitespace-nowrap">{ext.label}</span>
                          <span className="text-[10px] text-muted-foreground">({c.extensions_done || 0}/{c.max_extensions || 5})</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${fisc.color}`} />
                          <span className="text-xs whitespace-nowrap">{fisc.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs whitespace-nowrap">
                          <span className="font-medium">R$ {((c.total_value || 0) - (c.used_value || 0)).toLocaleString('pt-BR')}</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full mt-1">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(usedPct, 100)}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/contracts/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ver detalhes"><ExternalLink className="w-3 h-3" /></Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">{filtered.length} de {contracts.length} contratos</p>
    </div>
  );
}