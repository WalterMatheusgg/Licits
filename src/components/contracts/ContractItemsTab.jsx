import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Download, Minus, Package, AlertTriangle, PlusCircle, History, Trash2, Pencil, Bell, Lock, Search, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ALERT_OPTIONS = [
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: '40', label: '40%' },
  { value: '50', label: '50%' },
];

export default function ContractItemsTab({ contractId, contract }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showConsume, setShowConsume] = useState(null);
  const [showAdjust, setShowAdjust] = useState(null);
  const [showWithdrawals, setShowWithdrawals] = useState(null); // item to show history
  const [showEdit, setShowEdit] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [alertThreshold, setAlertThreshold] = useState(() => localStorage.getItem('itemAlertThreshold') || '20');

  const [consumeForm, setConsumeForm] = useState({ os_number: '', withdrawal_date: new Date().toISOString().split('T')[0], quantity: '', notes: '' });
  const [itemSearch, setItemSearch] = useState('');
  const [sortByNumber, setSortByNumber] = useState(false);
  const [adjustQty, setAdjustQty] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [form, setForm] = useState({ group_number: '', item_number: '', description: '', unit: 'UN', contracted_qty: '', min_qty: '', unit_price: '' });
  const queryClient = useQueryClient();

  useEffect(() => { dataClient.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === 'admin';
  const previewQty = Number(consumeForm.quantity);
  const { data: purchasePreview, error: previewError, isFetching: previewLoading } = useQuery({
    queryKey: ['purchase-preview',showConsume?.id,previewQty],
    queryFn: () => dataClient.finance.preview(showConsume.id,previewQty),
    enabled: !!showConsume?.id && Number.isFinite(previewQty) && previewQty > 0 && !!(showConsume?.contract_id && !showConsume?.price_registration_group_id),
    retry: false,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['contract-items', contractId],
    queryFn: () => dataClient.entities.ContractItem.filter({ contract_id: contractId }),
    enabled: !!contractId, initialData: [],
  });

  const { data: allWithdrawals = [] } = useQuery({
    queryKey: ['withdrawals', contractId],
    queryFn: () => dataClient.entities.ItemWithdrawal.filter({ contract_id: contractId }, '-created_date'),
    enabled: !!contractId, initialData: [],
  });

  const addMutation = useMutation({
    mutationFn: (data) => dataClient.entities.ContractItem.create({ ...data, contract_id: contractId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contract-items', contractId] }); setShowAdd(false); setForm({ group_number: '', item_number: '', description: '', unit: 'UN', contracted_qty: '', min_qty: '', unit_price: '' }); }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => dataClient.entities.ContractItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contract-items', contractId] }); setShowEdit(null); setEditForm(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.ContractItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contract-items', contractId] })
  });

  const consumeMutation = useMutation({
    mutationFn: async ({ item, cf }) => {
      const qty = parseFloat(cf.quantity);
      // A função SQL register_item_withdrawal atualiza o saldo e grava a baixa em uma transação.
      await dataClient.entities.ItemWithdrawal.create({
        item_id: item.id, contract_id: contractId,
        os_number: cf.os_number, withdrawal_date: cf.withdrawal_date,
        quantity: qty, notes: cf.notes,
        user_email: currentUser?.email || '', user_name: currentUser?.full_name || currentUser?.email || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-items', contractId] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      setShowConsume(null);
      setConsumeForm({ os_number: '', withdrawal_date: new Date().toISOString().split('T')[0], quantity: '', notes: '' });
    },
    onError: (error) => window.alert('Compra não registrada: ' + error.message),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, qty }) => dataClient.entities.ContractItem.update(id, { contracted_qty: parseFloat(qty) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contract-items', contractId] }); setShowAdjust(null); setAdjustQty(''); }
  });

  const downloadCSV = () => {
    const headers = ['Nº Grupo','Nº Item','Especificação','Unidade','Qtd Contratada','Qtd Utilizada','Qtd Disponível','Valor Unitário','Valor Disponível'];
    const rows = items.map(i => [i.group_number||'',i.item_number||'',i.description,i.unit||'',i.contracted_qty||0,i.used_qty||0,(i.contracted_qty||0)-(i.used_qty||0),(i.unit_price||0).toFixed(2),(((i.contracted_qty||0)-(i.used_qty||0))*(i.unit_price||0)).toFixed(2)]);
    const csv = [headers,...rows].map(r=>r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`itens_${contract?.contract_number||contractId}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleAlertChange = (v) => { setAlertThreshold(v); localStorage.setItem('itemAlertThreshold', v); };

  const itemWithdrawals = (itemId) => allWithdrawals.filter(w => w.item_id === itemId);

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase().trim();
      result = result.filter(item => {
        const num = (item.item_number || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        // fuzzy: check if all chars of query appear in order, or simple includes
        const fuzzy = (str) => {
          if (str.includes(q)) return true;
          let si = 0;
          for (let ci = 0; ci < str.length && si < q.length; ci++) {
            if (str[ci] === q[si]) si++;
          }
          return si === q.length;
        };
        return fuzzy(num) || fuzzy(desc);
      });
    }
    if (sortByNumber) {
      result.sort((a, b) => {
        const na = parseFloat(a.item_number) || 0;
        const nb = parseFloat(b.item_number) || 0;
        return na !== nb ? na - nb : (a.item_number || '').localeCompare(b.item_number || '');
      });
    }
    return result;
  }, [items, itemSearch, sortByNumber]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{items.length} item(s)</p>
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">Alerta:</span>
            <Select value={alertThreshold} onValueChange={handleAlertChange}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{ALERT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">disponível</span>
          </div>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2"><Download className="w-4 h-4" />Exportar</Button>}
          {isAdmin ? (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Adicionar Item</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Cadastrar Item</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); addMutation.mutate({ ...form, contracted_qty: parseFloat(form.contracted_qty)||0, min_qty: parseFloat(form.min_qty)||0, unit_price: parseFloat(form.unit_price)||0 }); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nº do Grupo</Label><Input value={form.group_number} onChange={e => setForm(p=>({...p,group_number:e.target.value}))} placeholder="Ex: 01" /></div>
                    <div><Label>Nº do Item</Label><Input value={form.item_number} onChange={e => setForm(p=>({...p,item_number:e.target.value}))} placeholder="Ex: 001" /></div>
                  </div>
                  <div><Label>Especificação *</Label><Input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} required placeholder="Descreva o item" /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Unidade</Label><Input value={form.unit} onChange={e => setForm(p=>({...p,unit:e.target.value}))} placeholder="UN, KG..." /></div>
                    <div><Label>Qtd Total *</Label><Input type="number" min="0" step="0.01" value={form.contracted_qty} onChange={e => setForm(p=>({...p,contracted_qty:e.target.value}))} required /></div>
                    <div><Label>Qtd Mínima</Label><Input type="number" min="0" step="0.01" value={form.min_qty} onChange={e => setForm(p=>({...p,min_qty:e.target.value}))} /></div>
                  </div>
                  <div><Label>Valor Unitário (R$)</Label><Input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm(p=>({...p,unit_price:e.target.value}))} /></div>
                  <Button type="submit" disabled={addMutation.isPending} className="w-full">Salvar Item</Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
              <Lock className="w-3 h-3" /> Somente admin pode adicionar itens
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Saldo contratado</TabsTrigger>
          <TabsTrigger value="history">Registros de Baixa ({allWithdrawals.length})</TabsTrigger>
        </TabsList>

        {/* ESTOQUE TAB */}
        <TabsContent value="inventory" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Este saldo representa a quantidade ainda disponível no contrato, não o estoque físico no almoxarifado. Cada pedido registrado reduz o saldo contratual e atualiza o orçamento.</p>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Buscar por nº ou nome do item..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
              />
            </div>
            <Button
              variant={sortByNumber ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 h-8 text-xs whitespace-nowrap"
              onClick={() => setSortByNumber(p => !p)}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar por Nº
            </Button>
          </div>
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum item cadastrado</p></div>
          ) : (
            <div className="space-y-2">
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground"><Search className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum item encontrado para "{itemSearch}"</p></div>
              )}
              {filteredItems.map(item => {
                const available = (item.contracted_qty || 0) - (item.used_qty || 0);
                const pct = item.contracted_qty ? ((item.used_qty || 0) / item.contracted_qty) * 100 : 0;
                const availPct = item.contracted_qty ? (available / item.contracted_qty) * 100 : 100;
                const threshold = parseInt(alertThreshold);
                const isAlert = availPct <= threshold && item.contracted_qty > 0;
                const isCritical = available <= 0;

                return (
                  <Card key={item.id} className={`p-4 border-0 shadow-sm ${isCritical ? 'bg-red-50 border-l-4 border-l-red-400' : isAlert ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {item.group_number && <Badge variant="outline" className="text-[10px]">Grupo {item.group_number}</Badge>}
                          {item.item_number && <Badge variant="outline" className="text-[10px]">Item {item.item_number}</Badge>}
                          {isCritical && <Badge className="bg-red-500/10 text-red-600 border-0 text-[10px] gap-1"><AlertTriangle className="w-3 h-3" />Esgotado</Badge>}
                          {isAlert && !isCritical && <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px] gap-1"><Bell className="w-3 h-3" />Estoque Baixo ({availPct.toFixed(0)}%)</Badge>}
                        </div>
                        <p className="text-sm font-medium">{item.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{item.unit}</span>
                          {item.unit_price > 0 && <span>{fmtBRL(item.unit_price)}/un</span>}
                          <span className="font-medium text-foreground">Disponível: {available.toLocaleString('pt-BR')} / {(item.contracted_qty||0).toLocaleString('pt-BR')}</span>
                          {item.unit_price > 0 && <span className="text-emerald-600 font-medium">Saldo: {fmtBRL(available * item.unit_price)}</span>}
                        </div>
                        <Progress value={Math.min(pct,100)} className={`h-1.5 mt-2 ${pct>=100?'[&>div]:bg-red-500':pct>=80?'[&>div]:bg-amber-500':''}`} />
                      </div>

                      <div className="flex-shrink-0 flex flex-col gap-1.5">
                        {/* View history */}
                        <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowWithdrawals(showWithdrawals?.id === item.id ? null : item)}>
                          <History className="w-3 h-3" /> Histórico ({itemWithdrawals(item.id).length})
                        </Button>

                        {/* Consume */}
                        <Dialog open={showConsume?.id === item.id} onOpenChange={(open) => { if(!open){setShowConsume(null);setConsumeForm({os_number:'',withdrawal_date:new Date().toISOString().split('T')[0],quantity:'',notes:''})} }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setShowConsume(item)} disabled={isCritical} className="gap-1.5 text-xs h-7">
                              <Minus className="w-3 h-3" /> Registrar compra
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader><DialogTitle>Registrar aquisição / utilização contratual</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">{item.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Disponível: <span className="font-semibold text-foreground">{available.toLocaleString('pt-BR')} {item.unit}</span></p>
                              </div>
                              <div><Label>Nº da O.S. / Ordem de Serviço</Label><Input value={consumeForm.os_number} onChange={e => setConsumeForm(p=>({...p,os_number:e.target.value}))} placeholder="Ex: OS-001/2025" /></div>
                              <div><Label>Data da Baixa *</Label><Input type="date" value={consumeForm.withdrawal_date} onChange={e => setConsumeForm(p=>({...p,withdrawal_date:e.target.value}))} required /></div>
                              <div><Label>Quantidade *</Label><Input type="number" min="0.01" step="0.01" max={available} value={consumeForm.quantity} onChange={e => setConsumeForm(p=>({...p,quantity:e.target.value}))} placeholder="0" autoFocus /></div>
                              {(showConsume?.contract_id && !showConsume?.price_registration_group_id) && Number.isFinite(previewQty) && previewQty > 0 && (
                                <div className={`rounded-lg border p-3 space-y-1 text-sm ${purchasePreview?.permitted ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                                  {previewLoading ? <p>Calculando impacto no orçamento…</p> :
                                  previewError ? <p className="text-red-700">Prévia indisponível: {previewError.message}</p> :
                                  purchasePreview ? <>
                                    <p><strong>Esta compra:</strong> {fmtBRL(Number(purchasePreview.requested_amount))}</p>
                                    <p><strong>Saldo atual:</strong> {fmtBRL(Number(purchasePreview.budget_available))}</p>
                                    <p><strong>Utilização após registrar:</strong> {Number(purchasePreview.projected_percent).toFixed(1)}% do contrato</p>
                                    <p className={purchasePreview.permitted ? 'text-emerald-700' : 'text-red-700'}>
                                      {purchasePreview.permitted ? 'Dentro do orçamento e do estoque.' : purchasePreview.reason}
                                    </p>
                                    {purchasePreview.permitted && Number(purchasePreview.projected_percent)>=80 && <p className="font-semibold text-amber-700">Atenção: marco de 80%/90%/100% — aviso será colocado na fila de e-mails, caso cruze o marco.</p>}
                                  </> : null}
                                </div>
                              )}
                              <div><Label>Observações</Label><Input value={consumeForm.notes} onChange={e => setConsumeForm(p=>({...p,notes:e.target.value}))} placeholder="Opcional" /></div>
                              <Button onClick={() => consumeMutation.mutate({ item, cf: consumeForm })} disabled={!consumeForm.quantity || parseFloat(consumeForm.quantity)<=0 || parseFloat(consumeForm.quantity)>available || consumeMutation.isPending || ((showConsume?.contract_id && !showConsume?.price_registration_group_id) && (!purchasePreview?.permitted || previewLoading))} className="w-full">
                                Confirmar registro
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Admin: adjust + edit + delete */}
                        {isAdmin && (
                          <>
                            <Dialog open={showAdjust?.id === item.id} onOpenChange={(open) => { if(!open){setShowAdjust(null);setAdjustQty('')} }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => { setShowAdjust(item); setAdjustQty(String(item.contracted_qty||'')); }} className="gap-1.5 text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50">
                                  <PlusCircle className="w-3 h-3" /> Ajustar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader><DialogTitle>Ajustar Qtd Contratada</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-sm font-medium">{item.description}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Atual: <strong>{(item.contracted_qty||0).toLocaleString('pt-BR')} {item.unit}</strong></p>
                                  </div>
                                  <div><Label>Nova Quantidade Total</Label><Input type="number" min="0" step="0.01" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} autoFocus /></div>
                                  <Button onClick={() => adjustMutation.mutate({ id: item.id, qty: adjustQty })} disabled={!adjustQty||adjustMutation.isPending} className="w-full">Confirmar</Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Dialog open={showEdit?.id === item.id} onOpenChange={(open) => { if(!open){setShowEdit(null);setEditForm(null)} }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => { setShowEdit(item); setEditForm({...item}); }}>
                                  <Pencil className="w-3 h-3" /> Editar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader><DialogTitle>Editar Item</DialogTitle></DialogHeader>
                                {editForm && (
                                  <form onSubmit={e => { e.preventDefault(); editMutation.mutate({ id: item.id, data: { ...editForm, contracted_qty: parseFloat(editForm.contracted_qty)||0, min_qty: parseFloat(editForm.min_qty)||0, unit_price: parseFloat(editForm.unit_price)||0 }}); }} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div><Label>Nº do Grupo</Label><Input value={editForm.group_number||''} onChange={e => setEditForm(p=>({...p,group_number:e.target.value}))} /></div>
                                      <div><Label>Nº do Item</Label><Input value={editForm.item_number||''} onChange={e => setEditForm(p=>({...p,item_number:e.target.value}))} /></div>
                                    </div>
                                    <div><Label>Especificação *</Label><Input value={editForm.description||''} onChange={e => setEditForm(p=>({...p,description:e.target.value}))} required /></div>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div><Label>Unidade</Label><Input value={editForm.unit||''} onChange={e => setEditForm(p=>({...p,unit:e.target.value}))} /></div>
                                      <div><Label>Qtd Total</Label><Input type="number" min="0" step="0.01" value={editForm.contracted_qty||''} onChange={e => setEditForm(p=>({...p,contracted_qty:e.target.value}))} /></div>
                                      <div><Label>Qtd Mínima</Label><Input type="number" min="0" step="0.01" value={editForm.min_qty||''} onChange={e => setEditForm(p=>({...p,min_qty:e.target.value}))} /></div>
                                    </div>
                                    <div><Label>Valor Unitário (R$)</Label><Input type="number" min="0" step="0.01" value={editForm.unit_price||''} onChange={e => setEditForm(p=>({...p,unit_price:e.target.value}))} /></div>
                                    <Button type="submit" disabled={editMutation.isPending} className="w-full">Salvar Alterações</Button>
                                  </form>
                                )}
                              </DialogContent>
                            </Dialog>

                            <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-red-500 hover:bg-red-50" onClick={() => { if(confirm('Excluir este item?')) deleteMutation.mutate(item.id); }}>
                              <Trash2 className="w-3 h-3" /> Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline withdrawal history */}
                    {showWithdrawals?.id === item.id && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Registros de Baixa:</p>
                        {itemWithdrawals(item.id).length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma baixa registrada</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {itemWithdrawals(item.id).map(w => (
                              <div key={w.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-3 py-1.5 gap-4">
                                <span className="font-medium">{w.os_number ? `OS: ${w.os_number}` : '—'}</span>
                                <span>{w.withdrawal_date ? format(new Date(w.withdrawal_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</span>
                                <span className="font-semibold">{(w.quantity||0).toLocaleString('pt-BR')} {item.unit}</span>
                                <span className="text-muted-foreground truncate max-w-[120px]">{w.user_name || w.user_email || '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="mt-4">
          {allWithdrawals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><History className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma baixa registrada</p></div>
          ) : (
            <div className="space-y-2">
              {allWithdrawals.map(w => {
                const item = items.find(i => i.id === w.item_id);
                return (
                  <Card key={w.id} className="p-3 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowWithdrawals(item || null)}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item?.description || 'Item não encontrado'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.os_number ? `OS: ${w.os_number} — ` : ''}{w.user_name || w.user_email || 'Usuário não identificado'}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                        <span className="font-semibold text-primary">{(w.quantity||0).toLocaleString('pt-BR')} {item?.unit || ''}</span>
                        <span className="text-muted-foreground">{w.withdrawal_date ? format(new Date(w.withdrawal_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</span>
                        {item?.unit_price > 0 && <span className="text-emerald-600 font-medium">{fmtBRL((w.quantity||0) * item.unit_price)}</span>}
                      </div>
                    </div>
                    {w.notes && <p className="text-xs text-muted-foreground mt-1 italic">{w.notes}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
