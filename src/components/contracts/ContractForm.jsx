import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const MODALITIES = [
  { value: 'pregao_eletronico', label: 'Pregão Eletrônico' },
  { value: 'dispensa', label: 'Dispensa de Licitação' },
  { value: 'dispensa_com_disputa', label: 'Dispensa de Licitação com Disputa' },
  { value: 'inexigibilidade', label: 'Inexigibilidade' },
  { value: 'concorrencia', label: 'Concorrência' },
  { value: 'tomada_precos', label: 'Tomada de Preços' },
  { value: 'convite', label: 'Convite' },
  { value: 'registro_precos', label: 'Registro de Preços' },
  { value: 'outro', label: 'Outro' },
];

const TYPES = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'servicos_terceirizados', label: 'Serviços Terceirizados' },
  { value: 'limpeza', label: 'Prestação de Serviço de Limpeza' },
  { value: 'servicos_graficos', label: 'Serviços Gráficos' },
  { value: 'tecnologia', label: 'Implementação de Ferramenta Tecnológica' },
  { value: 'locacao_veiculos', label: 'Locação de Veículos' },
  { value: 'itens_escritorio', label: 'Itens de Escritório' },
  { value: 'copa_cozinha', label: 'Copa e Cozinha' },
  { value: 'generos_alimenticios', label: 'Gêneros Alimentícios' },
  { value: 'mobiliario', label: 'Mobiliário' },
  { value: 'material_consumo', label: 'Material de Consumo' },
  { value: 'engenharia', label: 'Engenharia' },
  { value: 'arquitetura', label: 'Arquitetura' },
  { value: 'material_informatica', label: 'Material de Informática' },
  { value: 'material_expediente', label: 'Material de Expediente' },
  { value: 'eletrica_hidraulica', label: 'Insumos de Elétrica e Hidráulica' },
  { value: 'eletrodomesticos', label: 'Eletrodomésticos' },
  { value: 'alarme_seguranca', label: 'Alarme e Segurança' },
  { value: 'registro_precos', label: 'Registro de Preços' },
  { value: 'fornecimento', label: 'Fornecimento' },
  { value: 'obra', label: 'Obra' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'outro', label: 'Outro' },
];

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function ContractForm({ onSave, isLoading, initialData }) {
  const [form, setForm] = useState(initialData || {
    contract_number: '', sei_number: '', auction_number: '', object: '', modality: '', contract_type: '', status: 'em_analise',
    supplier_name: '', supplier_cnpj: '', supplier_address: '', supplier_city: '',
    supplier_state: '', supplier_cep: '', supplier_phone: '', supplier_email: '', supplier_contact: '',
    responsible_sector: '', start_date: '', end_date: '', total_value: 0, notes: '',
    can_extend: 'analise_pendente', max_extensions: 5, extensions_done: 0
  });
  const [errors, setErrors] = useState({});

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.contract_number?.trim()) e.contract_number = 'Informe o número do contrato';
    if (!form.object?.trim()) e.object = 'Informe o objeto do contrato';
    if (!form.supplier_name?.trim()) e.supplier_name = 'Informe o nome da empresa';
    if (form.supplier_cnpj && form.supplier_cnpj.replace(/\D/g, '').length !== 14) e.supplier_cnpj = 'CNPJ deve ter 14 dígitos';
    if (form.supplier_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supplier_email)) e.supplier_email = 'E-mail inválido';
    if (form.end_date && form.start_date && new Date(form.end_date) < new Date(form.start_date)) e.end_date = 'Vigência anterior à data de início';
    if (form.total_value < 0) e.total_value = 'Valor não pode ser negativo';
    if (form.extensions_done > form.max_extensions) e.extensions_done = 'Excede o limite de prorrogações';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const err = (field) => errors[field] ? <p className="text-[10px] text-red-500 mt-1">{errors[field]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Contrato</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nº do Contrato/ARP *</Label><Input value={form.contract_number} onChange={e => update('contract_number', e.target.value)} required placeholder="Ex: 001/2025" />{err('contract_number')}</div>
          <div><Label>Nº do Processo SEI</Label><Input value={form.sei_number} onChange={e => update('sei_number', e.target.value)} placeholder="Ex: 08219.000001/2025-01" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nº do Pregão Eletrônico</Label><Input value={form.auction_number} onChange={e => update('auction_number', e.target.value)} placeholder="Ex: 001/2024" /></div>
          <div><Label>Setor Responsável</Label><Input value={form.responsible_sector} onChange={e => update('responsible_sector', e.target.value)} /></div>
        </div>
        <div><Label>Objeto *</Label><Textarea value={form.object} onChange={e => update('object', e.target.value)} required />{err('object')}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Modalidade</Label>
            <Select value={form.modality} onValueChange={v => update('modality', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Tipo de Contrato</Label><Input value={form.contract_type} onChange={e => update('contract_type', e.target.value)} placeholder="Ex: Serviços de Limpeza, Fornecimento de Material..." /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => update('status', v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="em_analise_slic">Providências no SLIC</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Data de Início</Label><Input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} /></div>
          <div><Label>Data de Vigência</Label><Input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} /></div>
          <div><Label>Valor Total (R$)</Label><Input type="number" step="0.01" value={form.total_value} onChange={e => update('total_value', parseFloat(e.target.value) || 0)} />{err('total_value')}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Fornecedor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Empresa *</Label><Input value={form.supplier_name} onChange={e => update('supplier_name', e.target.value)} required />{err('supplier_name')}</div>
          <div><Label>CNPJ</Label><Input value={form.supplier_cnpj} onChange={e => update('supplier_cnpj', e.target.value)} placeholder="00.000.000/0000-00" />{err('supplier_cnpj')}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.supplier_address} onChange={e => update('supplier_address', e.target.value)} /></div>
          <div><Label>CEP</Label><Input value={form.supplier_cep} onChange={e => update('supplier_cep', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Cidade</Label><Input value={form.supplier_city} onChange={e => update('supplier_city', e.target.value)} /></div>
          <div><Label>Estado</Label>
            <Select value={form.supplier_state} onValueChange={v => update('supplier_state', v)}><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Telefone</Label><Input value={form.supplier_phone} onChange={e => update('supplier_phone', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>E-mail</Label><Input type="email" value={form.supplier_email} onChange={e => update('supplier_email', e.target.value)} />{err('supplier_email')}</div>
          <div><Label>Responsável</Label><Input value={form.supplier_contact} onChange={e => update('supplier_contact', e.target.value)} /></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Prorrogação</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Possibilidade</Label>
            <Select value={form.can_extend} onValueChange={v => update('can_extend', v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="analise_pendente">Análise Pendente</SelectItem></SelectContent></Select></div>
          <div><Label>Prorrogações Realizadas</Label><Input type="number" min="0" value={form.extensions_done} onChange={e => update('extensions_done', parseInt(e.target.value) || 0)} />{err('extensions_done')}</div>
          <div><Label>Limite de Prorrogações</Label><Input type="number" min="0" value={form.max_extensions} onChange={e => update('max_extensions', parseInt(e.target.value) || 0)} /></div>
        </div>
      </div>

      <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} /></div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Contrato'}
      </Button>
    </form>
  );
}
