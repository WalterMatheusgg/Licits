import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, AlertOctagon, Plus, Download, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const severityColors = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-blue-500/10 text-blue-600',
  alta: 'bg-amber-500/10 text-amber-600',
  critica: 'bg-red-500/10 text-red-600',
};

const statusColors = {
  aberta: 'bg-amber-500/10 text-amber-600',
  em_analise: 'bg-blue-500/10 text-blue-600',
  resolvida: 'bg-emerald-500/10 text-emerald-600',
  arquivada: 'bg-muted text-muted-foreground',
};

export default function Documents() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form, setForm] = useState({
    contract_id: '', contract_number: '', supplier_name: '', supplier_cnpj: '',
    title: '', content: '', severity: 'media',
    occurrence_date: new Date().toISOString().split('T')[0],
  });
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ['occurrences-all'],
    queryFn: () => base44.entities.Occurrence.list('-created_date', 100),
    initialData: [],
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
    initialData: [],
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Occurrence.create({
      ...data,
      registered_by: currentUser?.email || '',
      registered_by_name: currentUser?.full_name || currentUser?.email || '',
      status: 'aberta',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences-all'] });
      setShowAdd(false);
      setForm({ contract_id: '', contract_number: '', supplier_name: '', supplier_cnpj: '', title: '', content: '', severity: 'media', occurrence_date: new Date().toISOString().split('T')[0] });
    }
  });

  const filtered = occurrences.filter(o => {
    const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.contract_number?.toLowerCase().includes(search.toLowerCase()) || o.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === 'all' || o.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const downloadOccurrence = (occ) => {
    const dateStr = occ.occurrence_date ? format(new Date(occ.occurrence_date), 'dd/MM/yyyy', { locale: ptBR }) : '';
    const registeredStr = occ.created_date ? format(new Date(occ.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
    const htmlContent = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ocorrência - ${occ.title}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#222}.header{border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:24px}.header h1{font-size:18px;color:#1e40af;margin:0}.content-box{border:1px solid #ddd;padding:16px;border-radius:6px;min-height:120px;white-space:pre-wrap}table{width:100%;border-collapse:collapse}td{padding:6px 12px;border:1px solid #ddd}td:first-child{font-weight:bold;background:#f5f5f5;width:30%}.signature{border-top:1px solid #222;width:200px;text-align:center;padding-top:8px;margin-top:40px}</style>
</head><body>
<div class="header"><h1>REGISTRO DE OCORRÊNCIA</h1><p>Sistema ContratoIA - Gestão de Contratos</p></div>
<table>
<tr><td>Nº do Contrato</td><td>${occ.contract_number||''}</td></tr>
<tr><td>Empresa</td><td>${occ.supplier_name||''}</td></tr>
<tr><td>CNPJ</td><td>${occ.supplier_cnpj||''}</td></tr>
<tr><td>Data da Ocorrência</td><td>${dateStr}</td></tr>
<tr><td>Título</td><td>${occ.title}</td></tr>
<tr><td>Severidade</td><td>${occ.severity?.toUpperCase()||''}</td></tr>
<tr><td>Status</td><td>${occ.status?.replace('_',' ')||''}</td></tr>
<tr><td>Registrado por</td><td>${occ.registered_by_name||occ.registered_by||''}</td></tr>
<tr><td>Data do Registro</td><td>${registeredStr}</td></tr>
</table>
<div style="margin-top:24px"><strong style="text-transform:uppercase;font-size:11px;color:#555">Descrição da Ocorrência</strong>
<div class="content-box" style="margin-top:8px">${occ.content}</div></div>
<div style="margin-top:60px;display:flex;gap:40px">
<div><div class="signature"></div><p>Responsável pelo Registro</p><p>${occ.registered_by_name||occ.registered_by||''}</p></div>
<div><div class="signature"></div><p>Fiscal do Contrato</p></div>
</div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ocorrencia_${occ.contract_number}_${occ.title.replace(/\s+/g,'_')}.html`; a.click(); URL.revokeObjectURL(url);
  };

  const handleContractSelect = (contractId) => {
    const c = contracts.find(x => x.id === contractId);
    setForm(prev => ({ ...prev, contract_id: contractId, contract_number: c?.contract_number || '', supplier_name: c?.supplier_name || '', supplier_cnpj: c?.supplier_cnpj || '' }));
  };

  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Registro de Ocorrências</h1>
            <p className="text-sm text-muted-foreground">{occurrences.length} ocorrência(s) registrada(s)</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Nova Ocorrência</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar Nova Ocorrência</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); addMutation.mutate(form); }} className="space-y-4">
                <div>
                  <Label>Contrato</Label>
                  <Select value={form.contract_id} onValueChange={handleContractSelect}>
                    <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                    <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contract_number} — {c.supplier_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.contract_id && (
                  <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                    <p><span className="font-semibold">Empresa:</span> {form.supplier_name}</p>
                    <p><span className="font-semibold">CNPJ:</span> {form.supplier_cnpj}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Data da Ocorrência</Label><Input type="date" value={form.occurrence_date} onChange={e => update('occurrence_date', e.target.value)} /></div>
                  <div><Label>Severidade</Label>
                    <Select value={form.severity} onValueChange={v => update('severity', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Título *</Label><Input value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Ex: Irregularidade na entrega" /></div>
                <div><Label>Descrição da Ocorrência *</Label><Textarea value={form.content} onChange={e => update('content', e.target.value)} required rows={8} placeholder="Descreva detalhadamente..." /></div>
                {currentUser && <p className="text-xs text-muted-foreground">Registrado por: <strong>{currentUser.full_name || currentUser.email}</strong></p>}
                <Button type="submit" disabled={addMutation.isPending} className="w-full">
                  {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Ocorrência'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar ocorrências..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((occ, i) => (
            <motion.div key={occ.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="p-4 border-0 shadow-sm flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={`${severityColors[occ.severity]} border-0 text-[10px]`}>{occ.severity}</Badge>
                    <Badge className={`${statusColors[occ.status]} border-0 text-[10px]`}>{occ.status?.replace('_', ' ')}</Badge>
                    {occ.contract_number && <span className="text-[10px] text-muted-foreground font-medium">{occ.contract_number}</span>}
                    {occ.occurrence_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{format(new Date(occ.occurrence_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{occ.title}</p>
                  {occ.supplier_name && <p className="text-xs text-muted-foreground">{occ.supplier_name}</p>}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{occ.content}</p>
                </div>
                <Button variant="outline" size="sm" className="flex-shrink-0 gap-1 text-xs" onClick={() => downloadOccurrence(occ)}>
                  <Download className="w-3 h-3" /> Baixar
                </Button>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <AlertOctagon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma ocorrência encontrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}