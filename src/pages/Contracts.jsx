import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, FileText, Sparkles, Loader2, Trash2, ChevronDown, ClipboardList } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link as RouterLink } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import ContractForm from '../components/contracts/ContractForm';
import ContractAIUpload from '../components/contracts/ContractAIUpload';
import { logAudit } from '@/lib/audit';

const statusBadge = {
  ativo: 'bg-emerald-500/10 text-emerald-600',
  vencido: 'bg-red-500/10 text-red-600',
  encerrado: 'bg-gray-500/10 text-gray-600',
  suspenso: 'bg-amber-500/10 text-amber-600',
  em_analise: 'bg-blue-500/10 text-blue-600',
  em_analise_slic: 'bg-purple-500/10 text-purple-600',
  cancelado: 'bg-red-700/10 text-red-700'
};

const statusLabel = {
  ativo: 'Ativo', vencido: 'Vencido', encerrado: 'Encerrado',
  suspenso: 'Suspenso',     em_analise: 'Em Análise',
  em_analise_slic: 'Providências no SLIC', cancelado: 'Cancelado'
};

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Contracts() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'contract' | 'price_registration'
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => { dataClient.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
    initialData: [],
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'gestor';

  const createMutation = useMutation({
    mutationFn: (data) => dataClient.entities.Contract.create(data),
    onSuccess: (created) => {
      setSaveError('');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false); setShowAI(false);
      logAudit('cadastro', 'Contract', created.id, `Contrato ${created.contract_number} cadastrado`);
    },
    onError: (err) => setSaveError(err.message || 'Não foi possível cadastrar o contrato.')
  });

  const createFromDocument = async (data) => {
    if (!data.contract_number.trim() || !data.object.trim() || !data.supplier_name.trim()) {
      throw new Error('Preencha número, objeto e fornecedor antes de salvar.');
    }
    const document = await dataClient.entities.Document.create({
      title: data.original_filename || 'Contrato importado',
      document_type: 'contrato',
      storage_bucket: data.storage_bucket,
      storage_path: data.storage_path,
      original_filename: data.original_filename,
      mime_type: data.type,
      file_size: data.size,
      status: 'pendente',
    });
    const created = await dataClient.entities.Contract.create({
      ...data,
      source_document_id: document.id,
    });
    const items = (data.items || []).filter(item => item.description && item.quantity > 0 && item.unit_price > 0);
    await Promise.all(items.map(item => dataClient.entities.ContractItem.create({
      contract_id: created.id,
      item_number: item.item_number,
      description: item.description,
      unit: item.unit,
      contracted_qty: item.quantity,
      unit_price: item.unit_price,
    })));
    await dataClient.entities.Document.update(document.id, { contract_id: created.id });
    await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    setShowAI(false);
    logAudit('cadastro', 'Contract', created.id, `Contrato ${created.contract_number} importado de documento`);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.Contract.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      logAudit('exclusao', 'Contract', id, 'Contrato excluído');
    }
  });

  const filtered = contracts.filter(c => {
    const matchSearch = !search || 
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.object?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchType = typeFilter === 'all'
      || (typeFilter === 'price_registration' && (c.contract_type === 'registro_precos' || c.modality === 'registro_precos'))
      || (typeFilter === 'contract' && c.contract_type !== 'registro_precos' && c.modality !== 'registro_precos');
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">{contracts.length} contrato(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
        {!isAdmin && (
          <Link to="/admin-requests">
            <Button variant="outline" className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
              <FileText className="w-4 h-4" /> Solicitar ao Admin
            </Button>
          </Link>
        )}
        <Dialog open={showAI} onOpenChange={setShowAI}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Sparkles className="w-4 h-4" /> Importar Documento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Importar documento e cadastrar dados</DialogTitle></DialogHeader>
              <ContractAIUpload onSave={createFromDocument} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo <ChevronDown className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowForm(true)} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" /> Novo Contrato
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <RouterLink to="/price-registrations" className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Novo Registro de Preços
                </RouterLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Contrato</DialogTitle></DialogHeader>
              <ContractForm onSave={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {saveError && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{saveError}</div>}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar contratos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="contract">Contratos</SelectItem>
            <SelectItem value="price_registration">Registro de Preços</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="em_analise_slic">Providências no SLIC</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {filtered.map((c, i) => {
              const daysLeft = c.end_date ? differenceInDays(new Date(c.end_date), new Date()) : null;
              return (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link to={`/contracts/${c.id}`}>
                    <Card className="p-4 hover:shadow-md transition-all duration-200 border-0 shadow-sm cursor-pointer group">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{c.contract_number}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.supplier_name} — {c.object}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {c.total_value > 0 && (
                            <span className="text-xs font-medium text-muted-foreground hidden lg:block">{fmtBRL(c.total_value)}</span>
                          )}
                          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">{daysLeft}d restantes</Badge>
                          )}
                          {c.contract_type && (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 hidden sm:inline-flex max-w-[140px] truncate">{c.contract_type}</Badge>
                          )}
                          <Badge className={`${statusBadge[c.status]} border-0 text-[10px]`}>{statusLabel[c.status] || c.status?.replace('_',' ')}</Badge>
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(confirm('Excluir este contrato?')) deleteMutation.mutate(c.id); }}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum contrato encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}