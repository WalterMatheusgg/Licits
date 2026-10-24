import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Archive, ArrowRight, FileText, History, Loader2, Plus, Search, Sparkles } from 'lucide-react';
import { dataClient } from '@/api/dataClient';
import { contractStatuses, contractStatusLabel, contractStatusStyle } from '@/lib/contractStatus';
import ContractHistory from '@/components/contracts/ContractHistory';
import ContractForm from '@/components/contracts/ContractForm';
import ContractAIUpload from '@/components/contracts/ContractAIUpload';

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = value => value ? new Date(value).toLocaleDateString('pt-BR') : '—';

export default function Contracts() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [historyId, setHistoryId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => { setSearch(searchParams.get('q') || ''); }, [searchParams]);

  const { data: currentUser } = useQuery({ queryKey: ['contracts-user'], queryFn: () => dataClient.auth.me() });
  const isManager = ['admin','gestor'].includes(currentUser?.role);

  const { data: active = [], isLoading, isError, error } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
  });
  const { data: archived = [], isLoading: loadingArchive, error: archiveError } = useQuery({
    queryKey: ['archived-contracts'],
    queryFn: () => dataClient.contracts.listArchived(),
    enabled: isManager && showArchived,
  });

  const createMutation = useMutation({
    mutationFn: data => dataClient.entities.Contract.create(data),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
    },
    onError: err => setErrorMessage(err.message || 'Não foi possível cadastrar o contrato.'),
  });
  const archiveMutation = useMutation({
    mutationFn: id => dataClient.entities.Contract.delete(id),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['archived-contracts'] });
    },
    onError: err => setErrorMessage(err.message || 'Não foi possível arquivar.'),
  });
  const createFromDocument = async data => {
    const result = await dataClient.documents.importContract(data);
    await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    setErrorMessage('');
    setShowAI(false);
    return result;
  };

  const rows = (showArchived ? archived : active).filter(item => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (!term || [item.contract_number,item.supplier_name,item.object].some(value =>
      String(value || '').toLocaleLowerCase('pt-BR').includes(term)))
      && (showArchived || statusFilter === 'all' || item.status === statusFilter);
  });

  const archiveContract = contract => {
    if (window.confirm(`Arquivar o contrato ${contract.contract_number}? Ele deixará de aparecer entre os contratos ativos, mas seus dados e histórico continuarão preservados.`)) {
      archiveMutation.mutate(contract.id);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Contratos</h1>
          <p className="text-sm text-muted-foreground">Consulte a execução, a vigência e o histórico de cada contrato.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isManager && (
            <Link to="/admin-requests"><Button variant="outline">Solicitar alteração</Button></Link>
          )}
          {isManager && (
            <>
              <Dialog open={showAI} onOpenChange={setShowAI}>
                <DialogTrigger asChild><Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> Importar documento</Button></DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Importar documento para cadastrar contrato</DialogTitle></DialogHeader>
                  <ContractAIUpload onSave={createFromDocument} isLoading={false} />
                </DialogContent>
              </Dialog>
              <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo contrato</Button></DialogTrigger>
                <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
                  <DialogHeader><DialogTitle>Cadastrar contrato</DialogTitle></DialogHeader>
                  <ContractForm onSave={data => createMutation.mutate(data)} isLoading={createMutation.isPending} />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button size="sm" variant={showArchived ? 'outline' : 'default'}
          onClick={() => setShowArchived(false)}>Em acompanhamento ({active.length})</Button>
        {isManager && (
          <Button size="sm" variant={showArchived ? 'default' : 'outline'} className="gap-1.5"
            onClick={() => setShowArchived(true)}><Archive className="h-4 w-4" /> Arquivados</Button>
        )}
        <Link to="/price-registrations" className="ml-auto text-sm text-primary underline-offset-2 hover:underline">
          Atas de registro de preços <ArrowRight className="inline h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar contratos" placeholder="Buscar número, objeto ou fornecedor"
            value={search} onChange={event => setSearch(event.target.value)} className="pl-9" />
        </div>
        {!showArchived && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filtrar por status" className="w-full sm:w-56">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {contractStatuses.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {errorMessage && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{errorMessage}</p>}
      {isError && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">Não foi possível carregar os contratos: {error?.message}</p>}
      {archiveError && showArchived && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">Não foi possível consultar arquivados: {archiveError.message}</p>}
      {(isLoading || (showArchived && loadingArchive)) ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {rows.map(contract => (
            <Card key={contract.id} className="flex flex-col gap-3 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/10">
                  {showArchived ? <Archive className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">Contrato {contract.contract_number}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{contract.object}</p>
                  <p className="text-xs text-muted-foreground">{contract.supplier_name || 'Fornecedor não informado'} · {money(contract.total_value)}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className={contractStatusStyle(contract.status)}>{contractStatusLabel(contract.status)}</Badge>
                    {showArchived && <span className="text-xs text-muted-foreground">Arquivado em {date(contract.deleted_at)}</span>}
                    {!showArchived && contract.end_date && <span className="text-xs text-muted-foreground">Vigência até {date(contract.end_date)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                {showArchived ? (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setHistoryId(contract.id)}>
                    <History className="h-4 w-4" /> Ver histórico
                  </Button>
                ) : (
                  <>
                    <Link to={`/contracts/${contract.id}`}><Button size="sm" className="gap-1.5">Abrir contrato <ArrowRight className="h-4 w-4" /></Button></Link>
                    {isManager && (
                      <Button variant="outline" size="sm" disabled={archiveMutation.isPending}
                        onClick={() => archiveContract(contract)} className="gap-1.5">
                        <Archive className="h-4 w-4" /> Arquivar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              {showArchived ? 'Nenhum contrato arquivado encontrado.' : 'Nenhum contrato encontrado com esses filtros.'}
            </div>
          )}
        </div>
      )}
      <Dialog open={!!historyId} onOpenChange={open => { if (!open) setHistoryId(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico do contrato arquivado</DialogTitle></DialogHeader>
          {historyId && <ContractHistory contractId={historyId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
