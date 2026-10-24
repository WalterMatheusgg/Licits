import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Building2, Calendar, DollarSign, FileText, AlertTriangle, Sparkles, BarChart3, History, RefreshCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ContractHistory from '@/components/contracts/ContractHistory';
import { contractStatuses, contractStatusLabel, contractStatusDescription, contractStatusStyle } from '@/lib/contractStatus';
import TechnicalCapabilityButton from '../components/contracts/TechnicalCapabilityButton';
import { differenceInDays, format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import ContractForm from '../components/contracts/ContractForm';
import ContractItemsTab from '../components/contracts/ContractItemsTab';
import FiscalTab from '../components/contracts/FiscalTab';
import OccurrenceTab from '../components/contracts/OccurrenceTab';
import { logAudit } from '@/lib/audit';
import { LoadingState } from '@/components/common/StateView';

export default function ContractDetail() {
  const contractId = window.location.pathname.split('/').pop();
  const [showEdit, setShowEdit] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['contracts-user'], queryFn: () => dataClient.auth.me() });
  const isManager = ['admin','gestor'].includes(currentUser?.role);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const list = await dataClient.entities.Contract.filter({ id: contractId });
      return list[0];
    },
    enabled: !!contractId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['contract-items', contractId],
    queryFn: () => dataClient.entities.ContractItem.filter({ contract_id: contractId }),
    enabled: !!contractId,
    initialData: [],
  });

  const { data: fiscalRecords = [] } = useQuery({
    queryKey: ['fiscal-records', contractId],
    queryFn: () => dataClient.entities.FiscalRecord.filter({ contract_id: contractId }, '-created_date'),
    enabled: !!contractId,
    initialData: [],
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ['occurrences', contractId],
    queryFn: () => dataClient.entities.Occurrence.filter({ contract_id: contractId }, '-created_date'),
    enabled: !!contractId,
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: (data) => dataClient.entities.Contract.update(contractId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ['contract-history', contractId] });
      logAudit('alteracao', 'Contract', contractId, 'Contrato editado');
    }
  });

  const statusMutation = useMutation({
    mutationFn: status => dataClient.entities.Contract.update(contractId, { status }),
    onSuccess: () => {
      setShowStatus(false);
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-history', contractId] });
    },
  });

  if (isLoading) {
    return <LoadingState message="Carregando contrato..." />;
  }

  if (!contract) {
    return <LoadingState message="Carregando contrato..." />;
  }

  const safeDate = (d) => { try { const dt = new Date(d); return isNaN(dt.getTime()) ? '—' : format(dt, 'dd/MM/yyyy'); } catch { return '—'; } };
  const daysLeft = contract.end_date ? (() => { try { return differenceInDays(new Date(contract.end_date), new Date()); } catch { return null; } })() : null;
  const usedPercent = contract.total_value ? ((contract.used_value || 0) / contract.total_value) * 100 : 0;
  const availableBudget = Number(contract.total_value || 0) - Number(contract.used_value || 0);
  const money = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

  const fiscalColor = { adequada: 'text-emerald-600', regular: 'text-amber-600', baixa: 'text-red-600' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Link to="/contracts"><Button variant="ghost" size="icon" className="flex-shrink-0"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold truncate">{contract.contract_number}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{contract.object}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to={`/contracts/${contractId}/analytics`}>
            <Button variant="outline" size="sm" className="gap-2"><BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">Análise</span></Button>
          </Link>
          <TechnicalCapabilityButton contract={contract} contractId={contractId} />
          {isManager && (
            <Dialog open={showEdit} onOpenChange={setShowEdit}>
              <DialogTrigger asChild><Button variant="outline" size="sm">Editar informações</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
                <DialogHeader><DialogTitle>Editar informações do contrato</DialogTitle></DialogHeader>
                <ContractForm initialData={contract} onSave={data => updateMutation.mutate(data)} isLoading={updateMutation.isPending} />
                {updateMutation.isError && <p role="alert" className="text-sm text-destructive">{updateMutation.error?.message}</p>}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isManager && (
        <Card className="flex flex-col gap-3 border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Situação atual do contrato</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={contractStatusStyle(contract.status)}>{contractStatusLabel(contract.status)}</Badge>
              <span className="text-xs text-muted-foreground">{contractStatusDescription(contract.status)}</span>
            </div>
          </div>
          <Button variant="outline" className="gap-2 sm:shrink-0" onClick={() => {
            setNextStatus(contract.status || 'em_analise');
            setShowStatus(true);
          }}><RefreshCcw className="h-4 w-4" /> Alterar situação</Button>
        </Card>
      )}
      {!isManager && (
        <p className="text-sm text-muted-foreground">Situação: <strong>{contractStatusLabel(contract.status)}</strong></p>
      )}
      <Dialog open={showStatus} onOpenChange={setShowStatus}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Alterar situação do contrato</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            A mudança fica registrada automaticamente no histórico, com data e responsável.
          </p>
          <Select value={nextStatus} onValueChange={setNextStatus}>
            <SelectTrigger aria-label="Nova situação do contrato"><SelectValue placeholder="Escolha a situação" /></SelectTrigger>
            <SelectContent>
              {contractStatuses.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{contractStatusDescription(nextStatus)}</p>
          {statusMutation.isError && <p role="alert" className="text-sm text-destructive">{statusMutation.error?.message}</p>}
          <Button disabled={!nextStatus || nextStatus===contract.status || statusMutation.isPending}
            onClick={() => statusMutation.mutate(nextStatus)} className="w-full">
            {statusMutation.isPending ? 'Salvando...' : 'Confirmar alteração'}
          </Button>
        </DialogContent>
      </Dialog>

      {usedPercent >= 80 && (
        <Card className={`p-4 border-l-4 ${usedPercent >= 100 ? 'border-l-red-600 bg-red-50' : 'border-l-amber-500 bg-amber-50'}`}>
          <div className="flex gap-2 items-start"><AlertTriangle className="w-5 h-5 shrink-0 text-amber-700"/>
            <div><p className="font-semibold">Atenção ao teto orçamentário — {usedPercent.toFixed(1)}% utilizado</p>
              <p className="text-sm">Já foram utilizados {money(contract.used_value)} de {money(contract.total_value)}. Saldo: <strong>{money(availableBudget)}</strong>. Verifique novas compras antes de autorizar.</p>
            </div>
          </div>
        </Card>
      )}
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Building2 className="w-4 h-4 text-primary" /></div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Fornecedor</p>
              <p className="text-sm font-semibold truncate">{contract.supplier_name}</p>
              <p className="text-[10px] text-muted-foreground">{contract.supplier_cnpj}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><DollarSign className="w-4 h-4 text-accent" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Valor / Saldo</p>
              <p className="text-sm font-semibold">{(contract.total_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <Progress value={Math.min(usedPercent, 100)} className="h-1.5 mt-1" />
              <p className="text-[10px] text-muted-foreground mt-0.5">{usedPercent.toFixed(1)}% utilizado · Saldo: {money(availableBudget)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Calendar className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Vigência</p>
              <p className={`text-sm font-semibold ${daysLeft !== null && daysLeft < 30 ? 'text-red-600' : ''}`}>
                {daysLeft !== null ? `${daysLeft} dias restantes` : 'Sem data'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {contract.start_date ? safeDate(contract.start_date) : '—'} — {contract.end_date ? safeDate(contract.end_date) : '—'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10"><FileText className="w-4 h-4 text-violet-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline" className={contractStatusStyle(contract.status)}>{contractStatusLabel(contract.status)}</Badge>
              <p className={`text-[10px] capitalize ${fiscalColor[contract.fiscal_status]}`}>Fiscalização: {contract.fiscal_status}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Summary */}
      {contract.ai_summary && (
        <Card className="p-4 border-0 shadow-sm bg-primary/5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-primary uppercase mb-1">Análise IA</p>
              <p className="text-sm">{contract.ai_summary}</p>
              {contract.ai_risks && <p className="text-sm text-amber-600 mt-2"><AlertTriangle className="w-3 h-3 inline mr-1" />{contract.ai_risks}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="h-auto gap-1">
          <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscalização ({fiscalRecords.length})</TabsTrigger>
          <TabsTrigger value="occurrences">Ocorrências ({occurrences.length})</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <ContractItemsTab contractId={contractId} contract={contract} />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4">
          <FiscalTab contractId={contractId} contract={contract} />
        </TabsContent>

        <TabsContent value="occurrences" className="mt-4">
          <OccurrenceTab contractId={contractId} contract={contract} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ContractHistory contractId={contractId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}