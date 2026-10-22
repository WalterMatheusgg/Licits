import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquarePlus, Clock, CheckCircle2, XCircle, Loader2, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  pendente: 'bg-amber-500/10 text-amber-600',
  em_analise: 'bg-blue-500/10 text-blue-600',
  aprovado: 'bg-emerald-500/10 text-emerald-600',
  recusado: 'bg-red-500/10 text-red-600',
};

const typeLabels = {
  edicao: 'Solicitação de Edição',
  exclusao: 'Solicitação de Exclusão',
  ajuste: 'Ajuste de Dados',
  outro: 'Outro',
};

export default function AdminRequests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [form, setForm] = useState({ request_type: 'edicao', entity_type: '', entity_label: '', description: '' });
  const queryClient = useQueryClient();

  useEffect(() => { dataClient.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === 'admin';

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: () => dataClient.entities.AdminRequest.list('-created_date'),
    initialData: [],
  });

  const myRequests = requests.filter(r => r.requester_id === currentUser?.id);
  const pending = requests.filter(r => r.status === 'pendente' || r.status === 'em_analise');

  const createMutation = useMutation({
    mutationFn: (data) => dataClient.entities.AdminRequest.create({
      ...data,
      status: 'pendente',
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-requests'] }); setShowNew(false); setForm({ request_type: 'edicao', entity_type: '', entity_label: '', description: '' }); }
  });

  const respondMutation = useMutation({
    mutationFn: ({ request, status }) => dataClient.admin.resolveRequest(request.id, status, responseText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setRespondingId(null);
      setResponseText('');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => dataClient.entities.AdminRequest.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-requests'] }),
  });

  const RequestCard = ({ r }) => (
    <Card className="p-4 border-0 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={`${statusColors[r.status]} border-0 text-[10px]`}>{r.status}</Badge>
            <Badge variant="outline" className="text-[10px]">{typeLabels[r.request_type] || r.request_type}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {r.created_date ? format(new Date(r.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
            </span>
          </div>
          {r.entity_type && <p className="text-xs text-muted-foreground">{r.entity_type}{r.entity_label ? ` — ${r.entity_label}` : ''}</p>}
          <p className="text-sm mt-1">{r.description}</p>
          {!isAdmin && <p className="text-xs text-muted-foreground mt-1">Solicitado por: <strong>{r.requester_name || r.requester_email}</strong></p>}
          {isAdmin && <p className="text-xs text-muted-foreground mt-1">De: <strong>{r.requester_name || r.requester_email}</strong></p>}
          {respondMutation.isError && respondingId === r.id && <p role="alert" className="text-sm text-destructive">{respondMutation.error?.message}</p>}
          {r.admin_response && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
              <span className="font-semibold">Resposta: </span>{r.admin_response}
              {r.resolved_by && <span className="text-muted-foreground ml-1">— {r.resolved_by}</span>}
            </div>
          )}
        </div>

        {isAdmin && (r.status === 'pendente' || r.status === 'em_analise') && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            {r.status === 'pendente' && (
              <Button variant="outline" size="sm" className="text-xs gap-1 text-blue-600" onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'em_analise' })}>
                <Clock className="w-3 h-3" /> Em Análise
              </Button>
            )}
            <Dialog open={respondingId === r.id} onOpenChange={(open) => { if(!open){setRespondingId(null);setResponseText('')} }}>
              <DialogTrigger asChild>
                <Button size="sm" className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setRespondingId(r.id)}>
                  <CheckCircle2 className="w-3 h-3" /> Responder
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Responder Solicitação</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded text-sm">{r.description}</div>
                  <div><Label>Resposta / Observação</Label><Textarea value={responseText} onChange={e => setResponseText(e.target.value)} rows={3} placeholder="Descreva o que foi feito ou o motivo da recusa..." /></div>
                  <div className="flex gap-2">
                          <Button onClick={() => respondMutation.mutate({ request: r, status: 'aprovado' })} disabled={respondMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1">
                            {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Aprovar
                          </Button>
                          <Button onClick={() => respondMutation.mutate({ request: r, status: 'recusado' })} disabled={respondMutation.isPending} variant="destructive" className="flex-1 gap-1">
                            <XCircle className="w-4 h-4" /> Recusar
                          </Button>
                          </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Solicitações ao Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? `${pending.length} solicitação(ões) pendente(s)` : 'Envie pedidos de edição ou exclusão para o administrador'}
          </p>
        </div>
        {!isAdmin && (
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button className="gap-2"><MessageSquarePlus className="w-4 h-4" /> Nova Solicitação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova Solicitação ao Admin</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
                <div><Label>Tipo de Solicitação *</Label>
                  <Select value={form.request_type} onValueChange={v => setForm(p=>({...p,request_type:v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="edicao">Solicitação de Edição</SelectItem>
                      <SelectItem value="exclusao">Solicitação de Exclusão</SelectItem>
                      <SelectItem value="ajuste">Ajuste de Dados</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Tipo de Registro</Label><Input value={form.entity_type} onChange={e => setForm(p=>({...p,entity_type:e.target.value}))} placeholder="Ex: Contrato, Fiscalização, Item..." /></div>
                <div><Label>Identificação do Registro</Label><Input value={form.entity_label} onChange={e => setForm(p=>({...p,entity_label:e.target.value}))} placeholder="Ex: Contrato 001/2025, Item Papel A4..." /></div>
                <div><Label>Descrição detalhada *</Label>
                  <Textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} required rows={4} placeholder="Descreva detalhadamente o que precisa ser alterado ou excluído e o motivo..." />
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Solicitação'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <Tabs defaultValue={isAdmin ? 'pending' : 'mine'}>
          <TabsList>
            {isAdmin && <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>}
            {isAdmin && <TabsTrigger value="all">Todas ({requests.length})</TabsTrigger>}
            {!isAdmin && <TabsTrigger value="mine">Minhas Solicitações ({myRequests.length})</TabsTrigger>}
          </TabsList>

          {isAdmin && (
            <TabsContent value="pending" className="mt-4 space-y-3">
              {pending.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma solicitação pendente</p></div>
              ) : pending.map(r => <RequestCard key={r.id} r={r} />)}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="all" className="mt-4 space-y-3">
              {requests.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground"><Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma solicitação</p></div>
              ) : requests.map(r => <RequestCard key={r.id} r={r} />)}
            </TabsContent>
          )}

          {!isAdmin && (
            <TabsContent value="mine" className="mt-4 space-y-3">
              {myRequests.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageSquarePlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Você ainda não fez nenhuma solicitação</p>
                  <p className="text-xs mt-1">Use o botão acima para solicitar edições ou exclusões ao administrador</p>
                </div>
              ) : myRequests.map(r => <RequestCard key={r.id} r={r} />)}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}