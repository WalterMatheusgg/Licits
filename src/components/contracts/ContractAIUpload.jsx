import React, { useState } from 'react';
import { dataClient } from '@/api/dataClient';
import { extractContractDocument } from '@/lib/documentExtraction';
import { Button } from '@/components/ui/button';
import { Upload, Sparkles, Loader2, CheckCircle, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function ContractAIUpload({ onSave, isLoading }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    if (file.size === 0 || file.size > 15 * 1024 * 1024) {
      setErrorText('O documento deve ter entre 1 byte e 15 MB.');
      return;
    }
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name || '')) {
      setErrorText('Escolha um documento PDF, PNG ou JPG.');
      return;
    }
    const mimeType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg');
    setErrorText('');
    setExtracting(true);
    try {
      const uploaded = await dataClient.integrations.Core.UploadFile({ file });
      try {
        const fields = await extractContractDocument(file, setProgress);
        setExtracted({ ...fields, ...uploaded, original_filename: file.name, mime_type: mimeType, file_size: file.size, status: 'em_analise' });
      } catch (error) {
        setErrorText(`Documento armazenado. Extração indisponível: ${error.message} Preencha os dados manualmente.`);
        setExtracted({ ...uploaded, original_filename: file.name, mime_type: mimeType, file_size: file.size, contract_number: '', object: '', supplier_name: '', supplier_cnpj: '', total_value: 0, start_date: '', end_date: '', clauses: [], items: [], status: 'em_analise' });
      }
    } catch (error) {
      setErrorText('Falha ao enviar arquivo: ' + error.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    setErrorText('');
    setSaving(true);
    try {
      await onSave({ ...extracted, clauses: (extracted.clauses || []).join('\n') });
    } catch (error) {
      setErrorText('Não foi possível salvar todos os dados: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          id="ai-upload"
          onChange={e => { setFile(e.target.files?.[0] || null); setExtracted(null); setProgress(0); setErrorText(''); }}
        />
        <label htmlFor="ai-upload" className="cursor-pointer">
          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">{file ? file.name : 'Clique para enviar o contrato'}</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, PNG ou JPG</p>
        </label>
      </div>

      {errorText && <p role="alert" className="text-sm text-destructive">{errorText}</p>}
      {file && !extracted && (
        <Button onClick={handleUpload} disabled={extracting} className="w-full gap-2">
          {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> {progress ? `Lendo documento ${progress}%...` : 'Enviando documento...'}</> : <><Sparkles className="w-4 h-4" /> Enviar documento</>}
        </Button>
      )}

      {extracted && (
        <div className="space-y-4">
          <Card className="p-4 bg-accent/5 border-accent/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-accent">{extracted.extraction_method || 'Extração manual'} · revise os dados antes de salvar</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Nº:</span> <strong>{extracted.contract_number}</strong></div>
              <div><span className="text-muted-foreground">Empresa:</span> <strong>{extracted.supplier_name}</strong></div>
              <div><span className="text-muted-foreground">CNPJ:</span> <strong>{extracted.supplier_cnpj}</strong></div>
              <div><span className="text-muted-foreground">Valor:</span> <strong>R$ {extracted.total_value?.toLocaleString('pt-BR')}</strong></div>
              <div><span className="text-muted-foreground">Vigência:</span> <strong>{extracted.start_date || '—'} a {extracted.end_date || '—'}</strong></div>
            </div>
          </Card>

          {!!extracted.clauses?.length && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Trechos de cláusulas para revisão</h4>
              <ul className="list-disc pl-5 space-y-1">{extracted.clauses.map((clause, index) => <li key={index} className="text-sm">{clause}</li>)}</ul>
            </Card>
          )}

          {!!extracted.items?.length && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Itens identificados para conferência</h4>
              <ul className="space-y-1">{extracted.items.map(item => <li key={item.item_number} className="text-sm">{item.item_number}. {item.description} · {item.quantity} {item.unit} · R$ {item.unit_price.toLocaleString('pt-BR')}</li>)}</ul>
            </Card>
          )}

          <div className="space-y-3">
            <label className="block text-sm">Número do contrato <input className="w-full border rounded-lg p-2 bg-background" value={extracted.contract_number} onChange={e=>setExtracted(p=>({...p,contract_number:e.target.value}))} /></label>
            <label className="block text-sm">Objeto <textarea className="w-full border rounded-lg p-2 bg-background" value={extracted.object} onChange={e=>setExtracted(p=>({...p,object:e.target.value}))} /></label>
            <label className="block text-sm">Fornecedor <input className="w-full border rounded-lg p-2 bg-background" value={extracted.supplier_name} onChange={e=>setExtracted(p=>({...p,supplier_name:e.target.value}))} /></label>
            <label className="block text-sm">CNPJ <input className="w-full border rounded-lg p-2 bg-background" value={extracted.supplier_cnpj} onChange={e=>setExtracted(p=>({...p,supplier_cnpj:e.target.value}))} /></label>
            <label className="block text-sm">Valor total (R$) <input type="number" min="0" step="0.01" className="w-full border rounded-lg p-2 bg-background" value={extracted.total_value} onChange={e=>setExtracted(p=>({...p,total_value:Number(e.target.value)}))} /></label>
            <label className="block text-sm">Início da vigência <input type="date" className="w-full border rounded-lg p-2 bg-background" value={extracted.start_date || ''} onChange={e=>setExtracted(p=>({...p,start_date:e.target.value}))} /></label>
            <label className="block text-sm">Fim da vigência <input type="date" className="w-full border rounded-lg p-2 bg-background" value={extracted.end_date || ''} onChange={e=>setExtracted(p=>({...p,end_date:e.target.value}))} /></label>
          </div>
          <Button onClick={handleSave} disabled={isLoading || saving} className="w-full gap-2">
            {isLoading || saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Salvar Contrato
          </Button>
        </div>
      )}
    </div>
  );
}
