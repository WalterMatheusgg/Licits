import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Download, AlertOctagon, Loader2, Calendar, Upload, Paperclip, Lock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function OccurrenceTab({ contractId, contract }) {
  const [showAdd, setShowAdd] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState({
    title: '', content: '', severity: 'media',
    occurrence_date: new Date().toISOString().split('T')[0],
    signature_name: '', file_url: '', file_name: '',
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    dataClient.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: occurrences = [] } = useQuery({
    queryKey: ['occurrences', contractId],
    queryFn: () => dataClient.entities.Occurrence.filter({ contract_id: contractId }, '-created_date'),
    enabled: !!contractId,
    initialData: [],
  });

  const isAdmin = currentUser?.role === 'admin';

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.Occurrence.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['occurrences', contractId] })
  });

  const addMutation = useMutation({
    mutationFn: (data) => dataClient.entities.Occurrence.create({
      ...data, contract_id: contractId,
      contract_number: contract?.contract_number || '',
      supplier_name: contract?.supplier_name || '',
      supplier_cnpj: contract?.supplier_cnpj || '',
      registered_by: currentUser?.email || '',
      registered_by_name: currentUser?.full_name || currentUser?.email || '',
      status: 'aberta',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences', contractId] });
      setShowAdd(false);
      setForm({ title: '', content: '', severity: 'media', occurrence_date: new Date().toISOString().split('T')[0], signature_name: '', file_url: '', file_name: '' });
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const result = await dataClient.integrations.Core.UploadFile({ file, bucket: 'occurrences' });
    setForm(prev => ({ ...prev, file_url: result.file_url, file_name: file.name }));
    setUploadingFile(false);
  };

  const downloadOccurrence = (occ) => {
    const dateStr = occ.occurrence_date ? format(new Date(occ.occurrence_date), 'dd/MM/yyyy', { locale: ptBR }) : '';
    const registeredStr = occ.created_date ? format(new Date(occ.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ocorrência - ${occ.title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #222; }
  .header { border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; text-align:center; }
  .header h1 { font-size: 16px; color: #1e40af; margin: 0; }
  .header p { margin: 2px 0; color: #555; }
  .section { margin-bottom: 20px; }
  .label { font-weight: bold; color: #555; font-size: 11px; text-transform: uppercase; }
  .content-box { border: 1px solid #ddd; padding: 16px; border-radius: 6px; min-height: 120px; white-space: pre-wrap; margin-top:8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 12px; border: 1px solid #ddd; }
  td:first-child { font-weight: bold; background: #f5f5f5; width: 30%; }
  .sig-area { margin-top: 60px; display: flex; gap: 60px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #222; width: 220px; padding-top: 6px; margin-top: 50px; }
  ${occ.file_url ? '.attachment { margin-top:16px; padding:10px; border:1px solid #ddd; border-radius:6px; }' : ''}
</style>
</head>
<body>
<div class="header">
  <h1>ÓRGÃO CONTRATANTE</h1>
  <p style="font-size:13px;font-weight:bold;margin-top:8px">REGISTRO DE OCORRÊNCIA</p>
</div>
<table>
  <tr><td>Nº do Contrato</td><td>${occ.contract_number || ''}</td></tr>
  <tr><td>Empresa</td><td>${occ.supplier_name || ''}</td></tr>
  <tr><td>CNPJ</td><td>${occ.supplier_cnpj || ''}</td></tr>
  <tr><td>Data da Ocorrência</td><td>${dateStr}</td></tr>
  <tr><td>Título</td><td>${occ.title}</td></tr>
  <tr><td>Severidade</td><td>${occ.severity?.toUpperCase() || ''}</td></tr>
  <tr><td>Status</td><td>${occ.status?.replace('_', ' ') || ''}</td></tr>
  <tr><td>Registrado por</td><td>${occ.registered_by_name || occ.registered_by || ''}</td></tr>
  <tr><td>Data do Registro</td><td>${registeredStr}</td></tr>
  ${occ.file_url ? `<tr><td>Documento Anexo</td><td><a href="${occ.file_url}">${occ.file_name || 'Ver arquivo'}</a></td></tr>` : ''}
</table>
<div class="section" style="margin-top:24px">
  <div class="label">Descrição da Ocorrência</div>
  <div class="content-box">${occ.content}</div>
</div>
<div class="sig-area">
  <div class="sig-box">
    <div class="sig-line"></div>
    <strong>${occ.signature_name || occ.registered_by_name || occ.registered_by || '_________________________'}</strong>
    <p style="margin:2px 0;font-size:11px">Responsável pelo Registro</p>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <p style="margin:2px 0;font-size:11px">Fiscal do Contrato</p>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ocorrencia_${occ.contract_number}_${occ.title.replace(/\s+/g, '_')}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{occurrences.length} ocorrência(s)</p>
        {isAdmin ? (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nova Ocorrência</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar Ocorrência</DialogTitle></DialogHeader>

              {contract && (
                <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                  <p><span className="font-semibold">Contrato:</span> {contract.contract_number}</p>
                  <p><span className="font-semibold">Empresa:</span> {contract.supplier_name} {contract.supplier_cnpj && `— ${contract.supplier_cnpj}`}</p>
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); addMutation.mutate(form); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data da Ocorrência</Label>
                    <Input type="date" value={form.occurrence_date} onChange={e => update('occurrence_date', e.target.value)} />
                  </div>
                  <div>
                    <Label>Severidade</Label>
                    <Select value={form.severity} onValueChange={v => update('severity', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Título da Ocorrência *</Label><Input value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Ex: Irregularidade na entrega do serviço" /></div>
                <div>
                  <Label>Descrição da Ocorrência *</Label>
                  <Textarea value={form.content} onChange={e => update('content', e.target.value)} required rows={6} placeholder="Descreva detalhadamente a ocorrência identificada..." />
                </div>

                {/* File upload */}
                <div>
                  <Label>Anexar Documento (opcional)</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                      {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingFile ? 'Enviando...' : 'Selecionar arquivo'}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                    </label>
                    {form.file_name && <span className="text-xs text-emerald-600 flex items-center gap-1"><Paperclip className="w-3 h-3" />{form.file_name}</span>}
                  </div>
                </div>

                {/* Signature */}
                <div>
                  <Label>Nome para Assinatura</Label>
                  <Input value={form.signature_name} onChange={e => update('signature_name', e.target.value)} placeholder={currentUser?.full_name || 'Nome do responsável'} />
                  <p className="text-[10px] text-muted-foreground mt-1">Este nome aparecerá na linha de assinatura do documento</p>
                </div>

                {currentUser && <p className="text-xs text-muted-foreground">Registrado por: <strong>{currentUser.full_name || currentUser.email}</strong></p>}
                <Button type="submit" disabled={addMutation.isPending} className="w-full">
                  {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Ocorrência'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            <Lock className="w-3 h-3" /> Apenas usuários Nível 1 (Admin) podem registrar ocorrências
          </div>
        )}
      </div>

      {occurrences.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <AlertOctagon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma ocorrência registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {occurrences.map(occ => (
            <Card key={occ.id} className="p-4 border-0 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={`${severityColors[occ.severity]} border-0 text-[10px]`}>{occ.severity}</Badge>
                    <Badge className={`${statusColors[occ.status]} border-0 text-[10px]`}>{occ.status?.replace('_', ' ')}</Badge>
                    {occ.occurrence_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{format(new Date(occ.occurrence_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{occ.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{occ.content}</p>
                  {occ.file_url && (
                    <a href={occ.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                      <Paperclip className="w-3 h-3" />{occ.file_name || 'Ver arquivo anexo'}
                    </a>
                  )}
                  {occ.registered_by_name && <p className="text-[10px] text-muted-foreground mt-1">Por: {occ.registered_by_name}</p>}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => downloadOccurrence(occ)}>
                    <Download className="w-3 h-3" /> Baixar
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-red-500 hover:bg-red-50" onClick={() => { if(confirm('Excluir esta ocorrência?')) deleteMutation.mutate(occ.id); }}>
                      <Trash2 className="w-3 h-3" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
