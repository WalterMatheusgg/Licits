// Respostas determinísticas com base nos contratos visíveis ao usuário.
// Este módulo não substitui uma IA generativa e não consulta documentos completos.
const money = value => Number(value || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const percent = contract => Number(contract.total_value) > 0 ? Number(contract.used_value || 0) / Number(contract.total_value) * 100 : 0;
const validDate = value => value && !Number.isNaN(new Date(value + 'T12:00:00').getTime());
const daysTo = value => Math.ceil((new Date(value + 'T12:00:00').getTime() - Date.now()) / 86400000);
export function fiscalAnswer(question, contracts) {
  const q = String(question || '').toLocaleLowerCase('pt-BR');
  const rows = Array.isArray(contracts) ? contracts : [];
  const named = rows.find(c => c.contract_number && q.includes(String(c.contract_number).toLocaleLowerCase('pt-BR')));
  if (named) return ['**Contrato ' + named.contract_number + '**', 'Objeto: ' + (named.object || 'não informado'), 'Situação: ' + (named.status || 'não informada'), 'Valor: ' + money(named.total_value), 'Utilizado: ' + money(named.used_value) + ' (' + percent(named).toFixed(1) + '%)', 'Saldo: ' + money(Number(named.total_value || 0) - Number(named.used_value || 0)), 'Vencimento: ' + (named.end_date || 'não informado')].join('\n\n');
  if (/venc|prazo|vig[eê]ncia/.test(q)) {
    const soon=rows.filter(c=>validDate(c.end_date)&&daysTo(c.end_date)>=0&&daysTo(c.end_date)<=30&&c.status==='ativo').sort((a,b)=>daysTo(a.end_date)-daysTo(b.end_date));
    return soon.length ? '**Contratos ativos vencendo em até 30 dias:**\n' + soon.slice(0,20).map(c=>'- '+c.contract_number+' — '+daysTo(c.end_date)+' dia(s) — '+(c.end_date||'')).join('\n') : 'Nenhum contrato ativo com vencimento nos próximos 30 dias entre os registros disponíveis.';
  }
  if (/teto|risco|80%|90%|or[çc]amento|saldo|consumo/.test(q)) {
    const risk=rows.filter(c=>Number(c.total_value)>0&&percent(c)>=80).sort((a,b)=>percent(b)-percent(a));
    const balance=rows.reduce((sum,c)=>sum+Number(c.total_value||0)-Number(c.used_value||0),0);
    return '**Saldo financeiro dos contratos visíveis:** '+money(balance)+'\n\n**Contratos com 80% ou mais utilizados:** '+(risk.length?'\n'+risk.slice(0,20).map(c=>'- '+c.contract_number+' — '+percent(c).toFixed(1)+'% — saldo '+money(Number(c.total_value||0)-Number(c.used_value||0))).join('\n'):'nenhum nos registros disponíveis.')+'\n\nAntes de comprar, use a prévia oficial de compra do contrato.';
  }
  if (/fiscaliz|pend[eê]ncia/.test(q)) {
    const low=rows.filter(c=>c.fiscal_status==='baixa');
    return '**Contratos com fiscalização baixa:** '+low.length+(low.length?'\n'+low.slice(0,20).map(c=>'- '+c.contract_number+' — '+(c.object||'sem objeto')).join('\n'):'\nNenhum encontrado nos registros disponíveis.');
  }
  if (/resumo|quantos|total|contratos/.test(q)) {
    return '**Resumo dos registros visíveis**\n\nContratos: '+rows.length+'\nAtivos: '+rows.filter(c=>c.status==='ativo').length+'\nValor total: '+money(rows.reduce((s,c)=>s+Number(c.total_value||0),0))+'\nValor utilizado: '+money(rows.reduce((s,c)=>s+Number(c.used_value||0),0));
  }
  return null;
}
