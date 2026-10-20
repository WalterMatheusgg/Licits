import React, { useState } from 'react';
import { dataClient } from '@/api/dataClient';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2 } from 'lucide-react';

const DOC_TYPES = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'aditivo', label: 'Aditivo' },
  { value: 'holerite', label: 'Holerite' },
  { value: 'gfip', label: 'GFIP' },
  { value: 'fgts', label: 'FGTS' },
  { value: 'inss', label: 'INSS' },
  { value: 'certidao', label: 'Certidão' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'notificacao', label: 'Notificação' },
  { value: 'oficio', label: 'Ofício' },
  { value: 'parecer', label: 'Parecer' },
  { value: 'termo', label: 'Termo' },
  { value: 'outro', label: 'Outro' },
];

export default function DocumentUpload({ contractId, onComplete }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const { file_url } = await dataClient.integrations.Core.UploadFile({ file });
      await dataClient.entities.Document.create({
        contract_id: contractId,
        title,
        document_type: docType,
        file_url,
        status: 'pendente'
      });
    },
    onSuccess: onComplete,
  });

  return (
    <div className="space-y-4">
      <div><Label>Título do Documento</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Nota Fiscal Janeiro" /></div>
      <div><Label>Tipo</Label>
        <Select value={docType} onValueChange={setDocType}><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
          <SelectContent>{DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="border-2 border-dashed rounded-lg p-6 text-center">
        <input type="file" className="hidden" id="doc-upload" onChange={e => setFile(e.target.files[0])} />
        <label htmlFor="doc-upload" className="cursor-pointer">
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm">{file ? file.name : 'Selecione um arquivo'}</p>
        </label>
      </div>
      <Button onClick={() => uploadMutation.mutate()} disabled={!title || !docType || !file || uploadMutation.isPending} className="w-full gap-2">
        {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Enviar Documento
      </Button>
    </div>
  );
}
