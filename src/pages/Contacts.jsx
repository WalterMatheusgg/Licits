import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Building2, Search, FileText, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Contacts() {
  const [search, setSearch] = useState('');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
    initialData: [],
  });

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.supplier_name?.toLowerCase().includes(q) ||
      c.contract_number?.toLowerCase().includes(q) ||
      c.supplier_email?.toLowerCase().includes(q) ||
      c.supplier_phone?.toLowerCase().includes(q) ||
      c.supplier_contact?.toLowerCase().includes(q)
    );
  });

  const downloadCSV = () => {
    const headers = ['Empresa', 'CNPJ', 'Responsável', 'Telefone', 'E-mail', 'Contrato', 'Status'];
    const rows = filtered.map(c => [
      c.supplier_name || '',
      c.supplier_cnpj || '',
      c.supplier_contact || '',
      c.supplier_phone || '',
      c.supplier_email || '',
      c.contract_number || '',
      c.status || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'contatos_fornecedores.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors = {
    ativo: 'bg-emerald-500/10 text-emerald-600',
    vencido: 'bg-red-500/10 text-red-600',
    encerrado: 'bg-gray-500/10 text-gray-600',
    suspenso: 'bg-amber-500/10 text-amber-600',
    em_analise: 'bg-blue-500/10 text-blue-600',
    cancelado: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="w-6 h-6" /> Contatos de Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground">Dados de contato das empresas contratadas</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por empresa, contrato, telefone ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contato encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{c.supplier_name}</p>
                    {c.supplier_cnpj && <p className="text-[10px] text-muted-foreground">{c.supplier_cnpj}</p>}
                  </div>
                  <Badge className={`${statusColors[c.status] || ''} border-0 text-[10px] flex-shrink-0`}>{c.status?.replace('_', ' ')}</Badge>
                </div>

                <div className="space-y-1.5">
                  {c.contract_number && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Link to={`/contracts/${c.id}`} className="text-primary hover:underline truncate">{c.contract_number}</Link>
                    </div>
                  )}
                  {c.supplier_contact && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{c.supplier_contact}</span>
                    </div>
                  )}
                  {c.supplier_phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${c.supplier_phone}`} className="hover:text-primary transition-colors">{c.supplier_phone}</a>
                    </div>
                  )}
                  {c.supplier_email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={`mailto:${c.supplier_email}`} className="hover:text-primary transition-colors truncate">{c.supplier_email}</a>
                    </div>
                  )}
                  {!c.supplier_phone && !c.supplier_email && (
                    <p className="text-[10px] text-muted-foreground italic">Sem dados de contato cadastrados</p>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}