import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dataClient } from '@/api/dataClient';
import { buildFiscalQueue } from '@/lib/fiscalQueue';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, FileText, Loader2, Clock3 } from 'lucide-react';

const priorityStyles = {
  critica: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-blue-100 text-blue-800',
  baixa: 'bg-slate-100 text-slate-700',
};
const priorityLabels = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const dateLabel = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo';

export default function Fiscal() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [resolution, setResolution] = useState('');
  const contracts = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
  });
  const records = useQuery({
    queryKey: ['fiscal-records-all'],
    queryFn: () => dataClient.entities.FiscalRecord.list('-created_date', 1000),
  });
  const occurrences = useQuery({
    queryKey: ['occurrences-all'],
    queryFn: () => dataClient.entities.Occurrence.list('-created_date', 1000),
  });
  const queue = useMemo(() => buildFiscalQueue({
    contracts: contracts.data || [], records: records.data || [], occurrences: occurrences.data || [],
  }), [contracts.data, records.data, occurrences.data]);
  const updateStatus = useMutation({
    mutationFn: ({ task, status }) => dataClient.entities.FiscalRecord.update(task.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-records-all'] }),
  });
  const resolveTask = useMutation({
    mutationFn: async () => {
      if (!selectedTask || resolution.trim().length < 5) throw new Error('Descreva a resolução com pelo menos 5 caracteres.');
      if (selectedTask.source === 'occurrence') {
        return dataClient.entities.Occurrence.update(selectedTask.id, { status: 'resolvida', resolution: resolution.trim() });
      }
      const previous = selectedTask.history ? `${selectedTask.history}\n\n` : '';
      return dataClient.entities.FiscalRecord.update(selectedTask.id, {
        status: 'concluido', comments: `${previous}Resolução: ${resolution.trim()}`,
      });
    },
    onSuccess: async () => {
      setSelectedTask(null);
      setResolution('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fiscal-records-all'] }),
        queryClient.invalidateQueries({ queryKey: ['occurrences-all'] }),
      ]);
    },
  });

  const renderTask = task => (
    <Card key={`${task.source}-${task.id}`} className="rounded-md border-l-4 border-l-transparent p-4 shadow-none hover:border-l-amber-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${priorityStyles[task.priority] || priorityStyles.media} border-0`}>{priorityLabels[task.priority] || 'Média'}</Badge>
            <span className="text-xs text-muted-foreground">{task.contractNumber}</span>
            {task.status && <span className="text-xs text-muted-foreground">{task.status.replaceAll('_', ' ')}</span>}
          </div>
          <p className="mt-2 font-semibold">{task.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Prazo: {dateLabel(task.dueDate)}</span>
            {task.evidenceUrl && <a className="flex items-center gap-1 text-primary hover:underline" href={task.evidenceUrl} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />Comprovante</a>}
            {task.history && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Há registro associado</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col">
          {task.source === 'record' && task.status === 'pendente' && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ task, status: 'em_andamento' })} disabled={updateStatus.isPending}>
              <CircleDot className="mr-2 h-4 w-4" />Iniciar
            </Button>
          )}
          {task.source !== 'contract' && (
            <Button size="sm" onClick={() => { setSelectedTask(task); setResolution(''); }}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Registrar resolução
            </Button>
          )}
          <Button asChild size="sm" variant="ghost"><Link to={`/contracts/${task.contractId}`}>Abrir contrato</Link></Button>
        </div>
      </div>
    </Card>
  );

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Central de fiscalização</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pendências, prazos, ocorrências e alertas dos contratos da organização.</p>
      </header>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo da fila">
        <Card className="rounded-md p-4 shadow-none"><p className="text-xs text-muted-foreground">Tarefas abertas</p><p className="mt-1 text-2xl font-semibold">{queue.pending.length}</p></Card>
        <Card className="rounded-md p-4 shadow-none"><p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 text-red-600" />Prioridade crítica</p><p className="mt-1 text-2xl font-semibold">{queue.pending.filter(task => task.priority === 'critica').length}</p></Card>
        <Card className="rounded-md p-4 shadow-none"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4 text-orange-600" />Prazos vencidos</p><p className="mt-1 text-2xl font-semibold">{queue.pending.filter(task => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10)).length}</p></Card>
      </section>

      {(contracts.error || records.error || occurrences.error) && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a fila: {(contracts.error || records.error || occurrences.error).message}</p>}
      {contracts.isLoading || records.isLoading || occurrences.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando tarefas...</div>
      ) : (
        <Tabs defaultValue="open">
          <TabsList><TabsTrigger value="open">Fila aberta ({queue.pending.length})</TabsTrigger><TabsTrigger value="history">Histórico ({queue.resolved.length})</TabsTrigger></TabsList>
          <TabsContent value="open" className="mt-4 space-y-3">
            {queue.pending.map(renderTask)}
            {queue.pending.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa pendente.</p>}
          </TabsContent>
          <TabsContent value="history" className="mt-4 space-y-3">
            {queue.resolved.map(task => (
              <Card key={`${task.source}-${task.id}`} className="rounded-md p-4 shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-semibold">{task.title}</p><p className="text-xs text-muted-foreground">{task.contractNumber} · {dateLabel(task.resolvedAt)}</p></div>
                  <Badge variant="outline">Resolvida</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{task.history || task.description}</p>
                {task.evidenceUrl && <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={task.evidenceUrl} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />Comprovante</a>}
              </Card>
            ))}
            {queue.resolved.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma resolução registrada.</p>}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedTask} onOpenChange={open => { if (!open) setSelectedTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar resolução</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedTask?.contractNumber} · {selectedTask?.title}</p>
          <Textarea value={resolution} onChange={event => setResolution(event.target.value)} rows={5} placeholder="Descreva as providências e o resultado da verificação" />
          {resolveTask.error && <p role="alert" className="text-sm text-destructive">{resolveTask.error.message}</p>}
          <Button onClick={() => resolveTask.mutate()} disabled={resolveTask.isPending || resolution.trim().length < 5}>
            {resolveTask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Concluir tarefa
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}