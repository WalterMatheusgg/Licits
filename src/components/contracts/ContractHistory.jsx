import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { History, Loader2 } from 'lucide-react';
import { dataClient } from '@/api/dataClient';
import { contractStatusLabel } from '@/lib/contractStatus';

const entityNames = {
  contracts: 'Contrato', contract_items: 'Item do contrato',
  documents: 'Documento', fiscal_records: 'Fiscalização',
  occurrences: 'Ocorrência', item_withdrawals: 'Baixa de item',
};
const fieldNames = {
  status: 'status', contract_number: 'número', object: 'objeto',
  total_value: 'valor total', end_date: 'término da vigência',
  start_date: 'início da vigência', supplier_id: 'fornecedor',
  fiscal_user_id: 'fiscal responsável', item_number: 'número do item',
  contracted_qty: 'quantidade contratada', unit_price: 'valor unitário',
  deleted_at: 'arquivamento', signed_at: 'assinatura',
  read_at: 'leitura', used_value: 'valor utilizado', used_qty: 'quantidade utilizada',
};
function summary(entry) {
  const entity = entityNames[entry.entity_type] || 'Registro';
  if (entry.event_action === 'withdrawal') {
    return `Baixa de ${Number(entry.quantity || 0).toLocaleString('pt-BR')} unidade(s)${entry.item_label ? ` do item ${entry.item_label}` : ''}`;
  }
  if (entry.event_action === 'archive' || entry.event_action === 'delete') return `${entity} arquivado/excluído`;
  if (entry.event_action === 'create') return `${entity} cadastrado`;
  if (entry.entity_type === 'contracts' && entry.status_before !== entry.status_after) {
    return `Status: ${contractStatusLabel(entry.status_before)} → ${contractStatusLabel(entry.status_after)}`;
  }
  return `${entity} atualizado`;
}
function details(entry) {
  if (entry.event_action === 'withdrawal') return 'Movimentação registrada no sistema';
  const fields = Array.isArray(entry.changed_fields) ? entry.changed_fields : [];
  const visible = fields.filter(field => !['updated_at','updated_by','created_at','created_by'].includes(field))
    .map(field => fieldNames[field] || field.replaceAll('_', ' '));
  return visible.length ? `Campos alterados: ${visible.join(', ')}` : 'Alteração registrada automaticamente';
}

export default function ContractHistory({ contractId }) {
  const { data, isLoading, isError, error, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['contract-history', contractId],
    initialPageParam: 0,
    queryFn: ({pageParam}) => dataClient.contracts.history(contractId, pageParam),
    getNextPageParam: (page, pages) => page.length === 50 ? pages.length * 50 : undefined,
    enabled: !!contractId,
    staleTime: 10000,
  });
  const entries = data?.pages.flat() || [];
  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Histórico e alterações</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Registro automático de alterações no contrato, itens, documentos, fiscalização, ocorrências e baixas,
          incluindo eventos de arquivamento. Os dados sensíveis da auditoria permanecem ocultos.
        </p>
      </div>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...</p>}
      {isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico: {error?.message}</p>}
      {!isLoading && !isError && !entries.length && <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Nenhuma movimentação registrada até o momento.</p>}
      <ol className="space-y-3" aria-label="Linha do tempo do contrato">
        {entries.map(entry => (
          <li key={entry.event_id} className="flex gap-3 border-b border-border/70 pb-3 last:border-0">
            <span aria-hidden="true" className="mt-2 h-2 w-2 flex-none rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{summary(entry)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{details(entry)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.event_at ? new Date(entry.event_at).toLocaleString('pt-BR') : 'Data indisponível'}
                {' · '}{entry.actor_name || 'Sistema'}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {hasNextPage && <Button variant="outline" className="w-full sm:w-auto" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
        {isFetchingNextPage ? 'Carregando...' : 'Carregar histórico anterior'}
      </Button>}
    </Card>
  );
}
