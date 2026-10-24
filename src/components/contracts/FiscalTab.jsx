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
import { Plus, Upload, CheckCircle2, ClipboardList, Loader2, Calendar, Paperclip, Download, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const RECORD_TYPES = [
  { value: 'semanal', label: 'Fiscalização Semanal' },
  { value: 'mensal', label: 'Fiscalização Mensal' },
  { value: 'anual', label: 'Fiscalização Anual' },
  { value: 'por_escopo', label: 'Por Escopo' },
  { value: 'vistoria', label: 'Vistoria' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'medicao', label: 'Medição' },
];

const statusColors = {
  pendente: 'bg-amber-500/10 text-amber-600',
  em_andamento: 'bg-blue-500/10 text-blue-600',
  concluido: 'bg-emerald-500/10 text-emerald-600',
};
const priorityColors = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-blue-500/10 text-blue-600',
  alta: 'bg-amber-500/10 text-amber-600',
  critica: 'bg-red-500/10 text-red-600',
};

export default function FiscalTab({ contractId, contract }) {
  const [showAdd, setShowAdd] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState({
    record_type: '', title: '', description: '', comments: '',
    fiscal_date: new Date().toISOString().split('T')[0],
    due_date: '', priority: 'media',
    status: 'pendente', file_url: '', file_name: ''
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    dataClient.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: records = [] } = useQuery({
    queryKey: ['fiscal-records', contractId],
    queryFn: () => dataClient.entities.FiscalRecord.filter({ contract_id: contractId }, '-created_date'),
    enabled: !!contractId,
    initialData: [],
  });

  const addMutation = useMutation({
    mutationFn: (data) => dataClient.entities.FiscalRecord.create({ ...data, contract_id: contractId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-records', contractId] });
      setShowAdd(false);
      setForm({ record_type: '', title: '', description: '', comments: '', fiscal_date: new Date().toISOString().split('T')[0], due_date: '', priority: 'media', status: 'pendente', file_url: '', file_name: '' });
    }
  });

  const canWriteFiscal = ['admin', 'gestor'].includes(currentUser?.role);

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.FiscalRecord.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-records', contractId] })
  });

  const signMutation = useMutation({
    mutationFn: async (record) => {
      const user = await dataClient.auth.me();
      return dataClient.entities.FiscalRecord.update(record.id, {
        signed_by: user.email,
        signed_by_name: user.full_name || user.email,
        signed_at: new Date().toISOString(),
        status: 'concluido',
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-records', contractId] }),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const result = await dataClient.integrations.Core.UploadFile({ file, bucket: 'fiscal-records' });
    setForm(prev => ({ ...prev, file_url: result.file_url, file_name: file.name }));
    setUploadingFile(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addMutation.mutate({
      ...form,
      signed_by: form.status === 'concluido' ? currentUser?.email : '',
      signed_by_name: form.status === 'concluido' ? (currentUser?.full_name || currentUser?.email) : '',
      signed_at: form.status === 'concluido' ? new Date().toISOString() : '',
    });
  };

  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const downloadRecordPDF = (r) => {
    const dateStr = r.fiscal_date ? format(new Date(r.fiscal_date), "dd/MM/yyyy", { locale: ptBR }) : '';
    const signedStr = r.signed_at ? format(new Date(r.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
    const typLabel = RECORD_TYPES.find(t => t.value === r.record_type)?.label || r.record_type;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Fiscalização - ${r.title || typLabel}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#222;line-height:1.6}
  .header{border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:24px;text-align:center}
  .header h1{font-size:14px;color:#1e40af;margin:0;text-transform:uppercase;font-weight:bold}
  .header h2{font-size:13px;margin:4px 0 0;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  td{padding:6px 12px;border:1px solid #ddd}
  td:first-child{font-weight:bold;background:#f5f5f5;width:30%}
  .box{border:1px solid #ddd;padding:16px;border-radius:6px;min-height:80px;white-space:pre-wrap;margin-top:6px}
  .sig-area{margin-top:60px;display:flex;gap:60px}
  .sig-box{text-align:center}
  .sig-line{border-top:1px solid #222;width:220px;padding-top:6px;margin-top:50px}
  .footer{margin-top:30px;font-size:10px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="header">
  <h1>Órgão Contratante</h1>
  <h2>Relatório de Fiscalização</h2>
</div>
<table>
  <tr><td>Contrato</td><td>${contract?.contract_number || ''}</td></tr>
  <tr><td>Empresa</td><td>${contract?.supplier_name || ''}</td></tr>
  <tr><td>Tipo de Fiscalização</td><td>${typLabel}</td></tr>
  <tr><td>Título</td><td>${r.title || ''}</td></tr>
  <tr><td>Data da Fiscalização</td><td>${dateStr}</td></tr>
  <tr><td>Status</td><td>${r.status || ''}</td></tr>
  ${r.signed_by ? `<tr><td>Assinado por</td><td>${r.signed_by_name || r.signed_by} em ${signedStr}</td></tr>` : ''}
  ${r.file_url ? `<tr><td>Documento Alicits</td><td><a href="${r.file_url}">${r.file_name || 'Ver arquivo'}</a></td></tr>` : ''}
</table>
<div style="margin-bottom:16px"><strong>Descrição / Observações:</strong><div class="box">${r.description}</div></div>
${r.comments ? `<div style="margin-bottom:16px"><strong>Comentários:</strong><div class="box">${r.comments}</div></div>` : ''}
<div class="sig-area">
  <div class="sig-box"><div class="sig-line"></div><strong>${r.signed_by_name || '_________________________'}</strong><p style="font-size:11px">Fiscal Responsável</p></div>
</div>
<div class="footer">Gerado pelo sistema Licits em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fiscalizacao_${contract?.contract_number || contractId}_${r.title?.replace(/\s+/g,'_') || dateStr}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadGeneralReport = () => {
    const rows = records.map(r => {
      const typLabel = RECORD_TYPES.find(t => t.value === r.record_type)?.label || r.record_type;
      const dateStr = r.fiscal_date ? format(new Date(r.fiscal_date), 'dd/MM/yyyy', { locale: ptBR }) : '';
      const signedStr = r.signed_at ? format(new Date(r.signed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—';
      return `<tr>
        <td>${typLabel}</td>
        <td>${r.title || ''}</td>
        <td>${dateStr}</td>
        <td>${r.status}</td>
        <td>${r.signed_by_name || '—'}</td>
        <td>${signedStr}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório Geral de Fiscalização - ${contract?.contract_number}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#222}
  .header{border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:24px;text-align:center}
  h1{font-size:14px;color:#1e40af;margin:0;text-transform:uppercase}
  h2{font-size:13px;margin:4px 0 0}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#1e40af;color:#fff;padding:8px;text-align:left;font-size:11px}
  td{padding:6px 8px;border:1px solid #ddd;font-size:11px}
  tr:nth-child(even) td{background:#f5f8ff}
  .footer{margin-top:30px;font-size:10px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="header">
  <h1>Órgão Contratante</h1>
  <h2>Relatório Geral de Fiscalização</h2>
</div>
<table><tr><td><strong>Contrato:</strong></td><td>${contract?.contract_number || ''}</td><td><strong>Empresa:</strong></td><td>${contract?.supplier_name || ''}</td></tr>
<tr><td><strong>Objeto:</strong></td><td colspan="3">${contract?.object || ''}</td></tr>
<tr><td><strong>Total de Registros:</strong></td><td>${records.length}</td><td><strong>Gerado em:</strong></td><td>${new Date().toLocaleString('pt-BR')}</td></tr>
</table>
<table style="margin-top:24px">
  <thead><tr><th>Tipo</th><th>Título</th><th>Data</th><th>Status</th><th>Assinado por</th><th>Data Assinatura</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Gerado pelo sistema Licits em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio_geral_fiscalizacao_${contract?.contract_number || contractId}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{records.length} registro(s)</p>
        <div className="flex gap-2">
          {records.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadGeneralReport}>
              <Download className="w-4 h-4" /> Relatório Geral
            </Button>
          )}
        {!canWriteFiscal && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
            <Lock className="w-3 h-3" /> Somente admin pode criar rotinas
          </div>
        )}
        {canWriteFiscal && <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nova Rotina de Fiscalização</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Rotina de Fiscalização</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Fiscalização *</Label>
                  <Select value={form.record_type} onValueChange={v => update('record_type', v)} required>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{RECORD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data da Fiscalização</Label>
                  <Input type="date" value={form.fiscal_date} onChange={e => update('fiscal_date', e.target.value)} />
                </div>
                <div>
                  <Label>Prazo de conclusão</Label>
                  <Input type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={v => update('priority', v)}>
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
              <div><Label>Título</Label><Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="Ex: Vistoria mensal - março/2025" /></div>
              <div><Label>Descrição / Observações *</Label><Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={4} required placeholder="Descreva o que foi verificado, condições encontradas..." /></div>
              <div><Label>Comentários Adicionais</Label><Textarea value={form.comments} onChange={e => update('comments', e.target.value)} rows={2} placeholder="Pendências, recomendações..." /></div>

              {/* File upload */}
              <div>
                <Label>Anexar Documento</Label>
                <div className="mt-1 flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                    {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingFile ? 'Enviando...' : 'Selecionar arquivo'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                  </label>
                  {form.file_name && <span className="text-xs text-emerald-600 flex items-center gap-1"><Paperclip className="w-3 h-3" />{form.file_name}</span>}
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => update('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído (Assinar)</SelectItem>
                  </SelectContent>
                </Select>
                {form.status === 'concluido' && currentUser && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Será assinado por: <strong>{currentUser.full_name || currentUser.email}</strong>
                  </p>
                )}
              </div>

              <Button type="submit" disabled={addMutation.isPending || !form.record_type} className="w-full">
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Registro'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
        </div>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma rotina de fiscalização registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <Card key={r.id} className="p-4 border-0 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">{RECORD_TYPES.find(t => t.value === r.record_type)?.label || r.record_type}</Badge>
                    <Badge className={`${statusColors[r.status]} border-0 text-[10px]`}>{r.status}</Badge>
                    <Badge className={`${priorityColors[r.priority || 'media']} border-0 text-[10px]`}>{r.priority || 'media'}</Badge>
                    {r.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />Prazo {format(new Date(r.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  {r.title && <p className="text-sm font-semibold">{r.title}</p>}
                  <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
                  {r.comments && <p className="text-xs text-muted-foreground mt-1 italic">{r.comments}</p>}
                  {r.file_url && (
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                      <Paperclip className="w-3 h-3" />{r.file_name || 'Ver documento'}
                    </a>
                  )}
                  {r.signed_by && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Assinado por <strong>{r.signed_by_name || r.signed_by}</strong>{r.signed_at && ` em ${format(new Date(r.signed_at), 'dd/MM/yyyy HH:mm')}`}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {!r.signed_by && canWriteFiscal && (
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => signMutation.mutate(r)} disabled={signMutation.isPending}>
                      <CheckCircle2 className="w-3 h-3" /> Assinar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => downloadRecordPDF(r)}>
                    <Download className="w-3 h-3" /> Baixar
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-red-500 hover:bg-red-50" onClick={() => { if(confirm('Excluir este registro?')) deleteMutation.mutate(r.id); }}>
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
