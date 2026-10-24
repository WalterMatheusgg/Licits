export const contractStatuses = [
  { value: 'em_analise', label: 'Em análise', description: 'Em preparação ou aguardando aprovação.' },
  { value: 'ativo', label: 'Em execução', description: 'Contrato vigente, com execução permitida.' },
  { value: 'suspenso', label: 'Suspenso', description: 'Execução temporariamente interrompida.' },
  { value: 'em_analise_slic', label: 'Pendência administrativa (SLIC)', description: 'Aguardando providências no SLIC.' },
  { value: 'vencido', label: 'Prazo vencido', description: 'A data de término passou; verifique prorrogação ou encerramento.' },
  { value: 'encerrado', label: 'Encerrado', description: 'Execução finalizada e formalmente encerrada.' },
  { value: 'cancelado', label: 'Cancelado', description: 'Contrato cancelado formalmente.' },
];
export const contractStatusLabel = (value) => contractStatuses.find(option => option.value === value)?.label || value || 'Não informado';
export const contractStatusDescription = (value) => contractStatuses.find(option => option.value === value)?.description || '';
export const contractStatusStyle = (value) => ({
  ativo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  em_analise: 'border-blue-200 bg-blue-50 text-blue-800',
  em_analise_slic: 'border-violet-200 bg-violet-50 text-violet-800',
  suspenso: 'border-amber-200 bg-amber-50 text-amber-800',
  vencido: 'border-rose-200 bg-rose-50 text-rose-800',
  cancelado: 'border-red-200 bg-red-50 text-red-800',
  encerrado: 'border-slate-200 bg-slate-100 text-slate-700',
}[value] || 'border-border bg-muted text-foreground');
