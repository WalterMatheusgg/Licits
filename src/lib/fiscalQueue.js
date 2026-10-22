const priorityRank = { critica: 0, alta: 1, media: 2, baixa: 3 };

function sortTasks(tasks, today) {
  return tasks.sort((left, right) => {
    const leftOverdue = left.dueDate && left.dueDate < today;
    const rightOverdue = right.dueDate && right.dueDate < today;
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
    const priorityDiff = (priorityRank[left.priority] ?? 2) - (priorityRank[right.priority] ?? 2);
    if (priorityDiff) return priorityDiff;
    return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31');
  });
}

export function buildFiscalQueue({ contracts = [], records = [], occurrences = [], today = new Date().toISOString().slice(0, 10) }) {
  const contractsById = new Map(contracts.map(contract => [contract.id, contract]));
  const pending = [
    ...records.filter(record => record.status !== 'concluido').map(record => {
      const contract = contractsById.get(record.contract_id);
      return {
        id: record.id, source: 'record', contractId: record.contract_id,
        contractNumber: contract?.contract_number || 'Contrato',
        title: record.title || record.record_type?.replaceAll('_', ' ') || 'Fiscalização',
        description: record.description, dueDate: record.due_date || null,
        priority: record.priority || 'media', status: record.status,
        evidenceUrl: record.file_url, history: record.comments,
      };
    }),
    ...occurrences.filter(occurrence => ['aberta', 'em_analise'].includes(occurrence.status)).map(occurrence => {
      const contract = contractsById.get(occurrence.contract_id);
      return {
        id: occurrence.id, source: 'occurrence', contractId: occurrence.contract_id,
        contractNumber: contract?.contract_number || 'Contrato', title: occurrence.title,
        description: occurrence.content, dueDate: occurrence.due_date || null,
        priority: occurrence.severity || 'media', status: occurrence.status,
        evidenceUrl: occurrence.file_url, history: occurrence.resolution,
      };
    }),
  ];

  for (const contract of contracts) {
    if (contract.status !== 'ativo') continue;
    const utilization = Number(contract.total_value) > 0
      ? Number(contract.used_value || 0) * 100 / Number(contract.total_value)
      : 0;
    if (contract.end_date) {
      const days = Math.ceil((Date.parse(`${contract.end_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
      if (days <= 30) pending.push({
        id: `${contract.id}-expiry`, source: 'contract', contractId: contract.id,
        contractNumber: contract.contract_number, title: 'Vigência do contrato',
        description: days < 0 ? `Contrato vencido há ${Math.abs(days)} dia(s).` : `Contrato vence em ${days} dia(s).`,
        dueDate: contract.end_date, priority: days <= 7 ? 'critica' : 'alta', status: 'pendente',
      });
    }
    if (utilization >= 80) pending.push({
      id: `${contract.id}-budget`, source: 'contract', contractId: contract.id,
      contractNumber: contract.contract_number, title: `Consumo orçamentário em ${Math.floor(utilization)}%`,
      description: `Saldo: R$ ${(Number(contract.total_value) - Number(contract.used_value || 0)).toLocaleString('pt-BR')}.`,
      dueDate: null, priority: utilization >= 100 ? 'critica' : utilization >= 90 ? 'alta' : 'media', status: 'pendente',
    });
  }

  const resolved = [
    ...records.filter(record => record.status === 'concluido').map(record => ({
      id: record.id, source: 'record', contractNumber: contractsById.get(record.contract_id)?.contract_number || 'Contrato',
      title: record.title || record.record_type?.replaceAll('_', ' ') || 'Fiscalização',
      description: record.description, resolvedAt: record.signed_at || record.updated_at,
      history: record.comments, evidenceUrl: record.file_url,
    })),
    ...occurrences.filter(occurrence => ['resolvida', 'arquivada'].includes(occurrence.status)).map(occurrence => ({
      id: occurrence.id, source: 'occurrence', contractNumber: contractsById.get(occurrence.contract_id)?.contract_number || 'Contrato',
      title: occurrence.title, description: occurrence.content,
      resolvedAt: occurrence.resolved_at || occurrence.updated_at,
      history: occurrence.resolution, evidenceUrl: occurrence.file_url,
    })),
  ].sort((left, right) => String(right.resolvedAt || '').localeCompare(String(left.resolvedAt || '')));

  return { pending: sortTasks(pending, today), resolved };
}