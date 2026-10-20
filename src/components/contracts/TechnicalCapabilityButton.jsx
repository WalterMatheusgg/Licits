import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Award } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TechnicalCapabilityButton({ contract, contractId }) {
  const [open, setOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: items = [] } = useQuery({
    queryKey: ['contract-items', contractId],
    queryFn: () => base44.entities.ContractItem.filter({ contract_id: contractId }),
    enabled: !!contractId && open,
    initialData: [],
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ['occurrences', contractId],
    queryFn: () => base44.entities.Occurrence.filter({ contract_id: contractId }),
    enabled: !!contractId && open,
    initialData: [],
  });

  const hasSevereOccurrences = occurrences.some(o => o.severity === 'alta' || o.severity === 'critica');

  const generatePDF = () => {
    const dateFormatted = docDate ? format(new Date(docDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '___/___/______';

    const itemsTableRows = items.length > 0
      ? items.map(i => `
        <tr>
          <td>${i.group_number ? `Grupo ${i.group_number} - ` : ''}${i.item_number ? `Item ${i.item_number}: ` : ''}${i.description}</td>
          <td style="text-align:center">${i.unit || ''}</td>
          <td style="text-align:center">${(i.contracted_qty || 0).toLocaleString('pt-BR')}</td>
          <td style="text-align:center">${(i.used_qty || 0).toLocaleString('pt-BR')}</td>
          <td style="text-align:right">R$ ${(i.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#999">Nenhum item cadastrado</td></tr>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Atestado de Capacidade Técnica - ${contract.contract_number}</title>
<style>
  @page { margin: 2.5cm; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; line-height: 1.7; }
  .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 30px; }
  .header h1 { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #1e40af; margin: 0 0 4px; }
  .header h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #222; margin: 4px 0 0; }
  .body-text { text-align: justify; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 11px; }
  th { background: #1e40af; color: #fff; padding: 8px; text-align: left; }
  td { padding: 6px 8px; border: 1px solid #ccc; }
  tr:nth-child(even) td { background: #f5f8ff; }
  .signature-area { margin-top: 60px; display: flex; justify-content: center; }
  .sig-box { text-align: center; width: 320px; }
  .sig-line { border-top: 1px solid #222; margin-bottom: 6px; padding-top: 6px; }
  .footer { margin-top: 40px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <h1>Órgão Contratante</h1>
  <h2>Atestado de Capacidade Técnica</h2>
</div>

<div class="body-text">
<p>O <strong>ÓRGÃO CONTRATANTE</strong>, inscrito no CNPJ ______________, com sede ______________; atesta para os devidos fins, que a empresa <strong>${contract.supplier_name || '_________________________'}</strong>, inscrita no CNPJ sob o nº <strong>${contract.supplier_cnpj || '_________________________'}</strong>, sediada no <strong>${contract.supplier_address || '_________________________'}, ${contract.supplier_city || '_______'}/${contract.supplier_state || '__'}, CEP ${contract.supplier_cep || '_________'}</strong>, prestou serviços especializados em <strong>${contract.object || '_________________________'}</strong> para o Órgão Contratante, especificações e condições estabelecidas no Termo de Referência, Anexo I do Edital do Pregão Eletrônico nº ${contract.auction_number || '___/____'}, que é parte integrante do(a) Contrato / Ata de Registro de Preços nº <strong>${contract.contract_number || '____/____'}</strong>.</p>

<p>Registramos que a empresa prestou serviços/entregou produtos, que constituem objeto do(a) Contrato / Ata de Registro de Preços nº <strong>${contract.contract_number || '____/____'}</strong>, conforme especificações abaixo:</p>
</div>

<table>
  <thead>
    <tr>
      <th>Especificação</th>
      <th style="width:80px;text-align:center">Unidade</th>
      <th style="width:100px;text-align:center">Qtd Contratada</th>
      <th style="width:100px;text-align:center">Qtd Fornecida</th>
      <th style="width:120px;text-align:right">Valor Unitário</th>
    </tr>
  </thead>
  <tbody>
    ${itemsTableRows}
    <tr>
      <td colspan="4" style="text-align:right;font-weight:bold">Valor Global do Contrato:</td>
      <td style="text-align:right;font-weight:bold;color:#1e40af">R$ ${(contract.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    </tr>
  </tbody>
</table>

<div class="body-text">
<p>Informamos ainda que as prestações dos serviços/entrega dos materiais acima referidos apresentaram bom desempenho operacional, tendo a empresa cumprido fielmente com suas obrigações, nada constando que a desabone técnica e comercialmente, até a presente data.</p>
${hasSevereOccurrences ? `<p style="margin-top:16px;padding:12px;border-left:4px solid #dc2626;background:#fef2f2;color:#991b1b"><strong>RESSALVA:</strong> Consta nos Registros de Fiscalização desta Autarquia, ocorrência de falha na execução do Contrato de severidade alta e crítica, onde falha na execução dos serviços afetou diretamente na execução do contrato.</p>` : ''}
</div>

<p style="text-align:center;margin-top:20px">Brasília/DF, ${dateFormatted}.</p>

<div class="signature-area">
  <div class="sig-box">
    <br/><br/><br/>
    <div class="sig-line"></div>
    <strong>${signerName || '_________________________'}</strong>
    ${signerRole ? `<br/><span style="font-size:11px">${signerRole}</span>` : ''}
    <br/><span style="font-size:11px">Órgão Contratante</span>
  </div>
</div>

<div class="footer">Documento gerado pelo sistema ContratoIA em ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `atestado_${contract.contract_number?.replace(/\//g, '-')}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Award className="w-4 h-4" /> Atestado de Capacidade Técnica
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Gerar Atestado de Capacidade Técnica</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
            <p><span className="font-semibold">Contrato:</span> {contract.contract_number}</p>
            <p><span className="font-semibold">Empresa:</span> {contract.supplier_name}</p>
            <p><span className="font-semibold">Valor Global:</span> R$ {(contract.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <Label>Data do Documento</Label>
            <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
          </div>
          <div>
            <Label>Nome do Signatário</Label>
            <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Nome completo do responsável" />
          </div>
          <div>
            <Label>Cargo / Função</Label>
            <Input value={signerRole} onChange={e => setSignerRole(e.target.value)} placeholder="Ex: Presidente, Fiscal de Contrato..." />
          </div>
          <Button onClick={generatePDF} className="w-full gap-2">
            <Award className="w-4 h-4" /> Gerar Atestado (HTML)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}