import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { useOrganization } from '@/contexts/OrganizationContext';
import DocumentUpload from '@/components/contracts/DocumentUpload';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, Search, Plus, Trash2, AlertCircle } from 'lucide-react';

const formatDate = (date) => date ? new Date(date).toLocaleDateString('pt-BR') : '—';
const fileSize = (bytes) => bytes ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : '—';

export default function Documents() {
  const { activeOrganizationId, can } = useOrganization();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [contractFilter, setContractFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const docs = useQuery({
    queryKey: ['documents', activeOrganizationId],
    queryFn: () => dataClient.entities.Document.list('-created_date'),
    enabled: !!activeOrganizationId,
  });
  const contracts = useQuery({
    queryKey: ['documents-contracts', activeOrganizationId],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
    enabled: !!activeOrganizationId,
  });

  const filtered = useMemo(() => (docs.data || []).filter((doc) => {
    if (contractFilter !== 'all' && (doc.contract_id || '') !== contractFilter) return false;
    const needle = query.toLocaleLowerCase('pt-BR');
    return !needle || [doc.title, doc.document_type, doc.original_filename].some(
      item => String(item || '').toLocaleLowerCase('pt-BR').includes(needle)
    );
  }), [docs.data, contractFilter, query]);

  const contractNames = useMemo(() => Object.fromEntries(
    (contracts.data || []).map(c => [c.id, c.contract_number])
  ), [contracts.data]);

  const remove = async (doc) => {
    if (!window.confirm('Arquivar o documento "' + doc.title + '"?')) return;
    setErrorMessage('');
    setDeleting(doc.id);
    try {
      await dataClient.entities.Document.delete(doc.id);
      await queryClient.invalidateQueries({ queryKey: ['documents', activeOrganizationId] });
    } catch (error) {
      setErrorMessage('Não foi possível arquivar o documento: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  const canUpload = can('operational.write');
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arquivos privados da organização, com acesso controlado pelo Supabase.
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo documento
          </Button>
        )}
      </div>
      <Card className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar título, tipo ou nome do arquivo" className="pl-9" />
        </div>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Todos os contratos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            {(contracts.data || []).map(c => <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>
      {errorMessage && <p role="alert" className="text-red-600 text-sm flex gap-2 items-center"><AlertCircle className="w-4 h-4" />{errorMessage}</p>}
      {(docs.error || contracts.error) && <p role="alert" className="text-red-600 text-sm">Erro na consulta: {docs.error?.message || contracts.error?.message}</p>}
      {(docs.isLoading || contracts.isLoading) ? (
        <p className="text-sm text-muted-foreground py-6">Carregando documentos…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          Nenhum documento encontrado para os filtros selecionados.
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(doc => (
            <Card key={doc.id} className="p-4 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-lg bg-primary/10 p-2"><FileText className="w-5 h-5 text-primary" /></div>
                <div className="min-w-0">
                  <p className="font-semibold break-words">{doc.title}</p>
                  <p className="text-xs text-muted-foreground break-all mt-1">{doc.original_filename || 'Arquivo sem nome'} · {fileSize(doc.file_size)} · {formatDate(doc.created_at)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doc.contract_id ? 'Contrato ' + (contractNames[doc.contract_id] || doc.contract_id) : 'Documento geral da organização'}
                  </p>
                  <Badge variant="secondary" className="mt-2">{doc.document_type}</Badge>
                </div>
              </div>
              <div className="flex gap-2 self-end lg:self-auto shrink-0">
                <Button variant="outline" size="sm" disabled={!doc.file_url} asChild={!!doc.file_url}>
                  {doc.file_url
                    ? <a href={doc.file_url} target="_blank" rel="noreferrer"><Download className="w-4 h-4 mr-2" /> Abrir</a>
                    : <span>Arquivo indisponível</span>}
                </Button>
                {canUpload && (
                  <Button variant="outline" size="sm" disabled={!!deleting} onClick={() => remove(doc)} title="Arquivar documento">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Adicionar documento</DialogTitle></DialogHeader>
          <DocumentUpload
            contractId={null}
            onComplete={async () => {
              setUploadOpen(false);
              await queryClient.invalidateQueries({ queryKey: ['documents', activeOrganizationId] });
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
