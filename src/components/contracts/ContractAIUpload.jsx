import React, { useState } from 'react';
import { dataClient } from '@/api/dataClient';
import { Button } from '@/components/ui/button';
import { Upload, Sparkles, Loader2, CheckCircle, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function ContractAIUpload({ onSave, isLoading }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setExtracting(true);
    const { file_url } = await dataClient.integrations.Core.UploadFile({ file });

    const result = await dataClient.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          contract_number: { type: "string" },
          object: { type: "string" },
          supplier_name: { type: "string" },
          supplier_cnpj: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
          total_value: { type: "number" },
          modality: { type: "string" },
          items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" }, unit: { type: "string" } } } }
        }
      }
    });

    if (result.status === 'success' && result.output) {
      const summary = await dataClient.integrations.Core.InvokeLLM({
        prompt: `Analise os dados extraídos deste contrato e gere: 1) Um resumo executivo breve. 2) Principais riscos identificados. 3) Cláusulas críticas. Dados: ${JSON.stringify(result.output)}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            risks: { type: "string" },
            critical_clauses: { type: "string" }
          }
        }
      });

      setExtracted({
        ...result.output,
        file_url,
        ai_summary: summary.summary,
        ai_risks: summary.risks,
        clauses: summary.critical_clauses,
        status: 'em_analise'
      });
    }
    setExtracting(false);
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

      {file && !extracted && (
        <Button onClick={handleUpload} disabled={extracting} className="w-full gap-2">
          {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando com IA...</> : <><Sparkles className="w-4 h-4" /> Analisar com IA</>}
        </Button>
      )}

      {extracted && (
        <div className="space-y-4">
          <Card className="p-4 bg-accent/5 border-accent/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-accent">Dados extraídos com sucesso</span>
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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Resumo IA</h4>
              <p className="text-sm">{extracted.ai_summary}</p>
            </Card>
          )}

          {extracted.ai_risks && (
            <Card className="p-4 border-amber-500/20 bg-amber-500/5">
              <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2">Riscos Identificados</h4>
              <p className="text-sm">{extracted.ai_risks}</p>
            </Card>
          )}

          <Button onClick={() => onSave(extracted)} disabled={isLoading} className="w-full gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Salvar Contrato
          </Button>
        </div>
      )}
    </div>
  );
}
