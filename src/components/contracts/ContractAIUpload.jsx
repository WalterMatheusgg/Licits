import React, { useState } from 'react';
import { dataClient } from '@/api/dataClient';
import { Button } from '@/components/ui/button';
import { Upload, Sparkles, Loader2, CheckCircle, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function ContractAIUpload({ onSave, isLoading }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [errorText, setErrorText] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setErrorText('');
    setExtracting(true);
    try {
      const uploaded = await dataClient.integrations.Core.UploadFile({ file });
      setExtracted({
        file_url: uploaded.file_url,
        contract_number: '',
        object: '',
        supplier_name: '',
        total_value: 0,
        status: 'em_analise',
      });
    } catch (error) {
      setErrorText('Falha ao enviar arquivo: ' + error.message);
    } finally {
      setExtracting(false);
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
          onChange={e => setFile(e.target.files[0])}
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
          {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando documento...</> : <><Sparkles className="w-4 h-4" /> Enviar documento</>}
        </Button>
      )}

      {extracted && (
        <div className="space-y-4">
          <Card className="p-4 bg-accent/5 border-accent/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Documento enviado. Preencha os dados antes de salvar.</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Nº:</span> <strong>{extracted.contract_number}</strong></div>
              <div><span className="text-muted-foreground">Empresa:</span> <strong>{extracted.supplier_name}</strong></div>
              <div><span className="text-muted-foreground">CNPJ:</span> <strong>{extracted.supplier_cnpj}</strong></div>
              <div><span className="text-muted-foreground">Valor:</span> <strong>R$ {extracted.total_value?.toLocaleString('pt-BR')}</strong></div>
            </div>
          </Card>

          {extracted.ai_summary && (
            <Card className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Resumo</h4>
              <p className="text-sm">{extracted.ai_summary}</p>
            </Card>
          )}

          {extracted.ai_risks && (
            <Card className="p-4 border-amber-500/20 bg-amber-500/5">
              <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2">Riscos Identificados</h4>
              <p className="text-sm">{extracted.ai_risks}</p>
            </Card>
          )}

          <div className="space-y-3">
            <label className="block text-sm">Número do contrato <input className="w-full border rounded-lg p-2 bg-background" value={extracted.contract_number} onChange={e=>setExtracted(p=>({...p,contract_number:e.target.value}))} /></label>
            <label className="block text-sm">Objeto <textarea className="w-full border rounded-lg p-2 bg-background" value={extracted.object} onChange={e=>setExtracted(p=>({...p,object:e.target.value}))} /></label>
            <label className="block text-sm">Fornecedor <input className="w-full border rounded-lg p-2 bg-background" value={extracted.supplier_name} onChange={e=>setExtracted(p=>({...p,supplier_name:e.target.value}))} /></label>
            <label className="block text-sm">Valor total (R$) <input type="number" min="0" step="0.01" className="w-full border rounded-lg p-2 bg-background" value={extracted.total_value} onChange={e=>setExtracted(p=>({...p,total_value:Number(e.target.value)}))} /></label>
          </div>
          <Button onClick={() => {
            if (!extracted.contract_number.trim() || !extracted.object.trim() || !extracted.supplier_name.trim()) {
              setErrorText('Preencha número, objeto e fornecedor antes de salvar.');
              return;
            }
            onSave(extracted);
          }} disabled={isLoading} className="w-full gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Salvar Contrato
          </Button>
        </div>
      )}
    </div>
  );
}
