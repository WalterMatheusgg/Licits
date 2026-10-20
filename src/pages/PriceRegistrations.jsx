import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ChevronRight, Building2, Package, Pencil, Trash2, Lock, Loader2, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { differenceInDays, format } from 'date-fns';
import ContractItemsTab from '../components/contracts/ContractItemsTab';
import FiscalTab from '../components/contracts/FiscalTab';
import OccurrenceTab from '../components/contracts/OccurrenceTab';
import TechnicalCapabilityButton from '../components/contracts/TechnicalCapabilityButton';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const statusColors = {
  ativo: 'bg-emerald-500/10 text-emerald-600',
  encerrado: 'bg-gray-500/10 text-gray-600',
  suspenso: 'bg-amber-500/10 text-amber-600',
  em_analise: 'bg-blue-500/10 text-blue-600',
  vencido: 'bg-red-500/10 text-red-600',
};

export default function PriceRegistrations() {
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // selected PriceRegistration
  const [selectedGroup, setSelectedGroup] = useState(null); // selected group
  const [showNewPR, setShowNewPR] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editPR, setEditPR] = useState(null);
  const [editGroup, setEditGroup] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { dataClient.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === 'admin';

  const [prForm, setPrForm] = useState({ auction_number: '', sei_number: '', object: '', registration_type: 'srp_cfp', adhesion_organ: '', adhesion_auction_number: '', status: 'em_analise', notes: '' });
  const [groupForm, setGroupForm] = useState({
    arp_number: '', group_number: '', supplier_name: '', supplier_cnpj: '', supplier_address: '',
    supplier_city: '', supplier_state: '', supplier_cep: '', supplier_phone: '', supplier_email: '',
    supplier_contact: '', start_date: '', end_date: '', total_value: '', can_extend: false,
    status: 'ativo', notes: ''
  });

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ['price-registrations'],
    queryFn: () => dataClient.entities.PriceRegistration.list('-created_date'),
    initialData: [],
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['price-registration-groups', selected?.id],
    queryFn: () => dataClient.entities.PriceRegistrationGroup.filter({ price_registration_id: selected?.id }),
    enabled: !!selected?.id,
    initialData: [],
  });

  const createPR = useMutation({
    mutationFn: (d) => dataClient.entities.PriceRegistration.create(d),
    onSuccess: () => { queryClient.invalidateQueries(['price-registrations']); setShowNewPR(false); setPrForm({ auction_number:'',sei_number:'',object:'',status:'em_analise',notes:'' }); }
  });
  const updatePR = useMutation({
    mutationFn: ({ id, d }) => dataClient.entities.PriceRegistration.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries(['price-registrations']); setEditPR(null); }
  });
  const deletePR = useMutation({
    mutationFn: (id) => dataClient.entities.PriceRegistration.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['price-registrations']); if(selected?.id === editPR?.id) setSelected(null); }
  });

  const createGroup = useMutation({
    mutationFn: (d) => dataClient.entities.PriceRegistrationGroup.create({ ...d, price_registration_id: selected?.id }),
    onSuccess: () => { queryClient.invalidateQueries(['price-registration-groups', selected?.id]); setShowNewGroup(false); resetGroupForm(); }
  });
  const updateGroup = useMutation({
    mutationFn: ({ id, d }) => dataClient.entities.PriceRegistrationGroup.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries(['price-registration-groups', selected?.id]); setEditGroup(null); }
  });
  const deleteGroup = useMutation({
    mutationFn: (id) => dataClient.entities.PriceRegistrationGroup.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['price-registration-groups', selected?.id])
  });

  const resetGroupForm = () => setGroupForm({ arp_number:'',group_number:'',supplier_name:'',supplier_cnpj:'',supplier_address:'',supplier_city:'',supplier_state:'',supplier_cep:'',supplier_phone:'',supplier_email:'',supplier_contact:'',start_date:'',end_date:'',total_value:'',can_extend:false,status:'ativo',notes:'' });

  const filtered = registrations.filter(r => !search || r.auction_number?.toLowerCase().includes(search.toLowerCase()) || r.object?.toLowerCase().includes(search.toLowerCase()));

  const PRForm = ({ initial, onSave, isEdit }) => {
    const [f, setF] = useState(initial);
    return (
      <form onSubmit={e => { e.preventDefault(); onSave(f); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Nº do Pregão Eletrônico *</Label><Input value={f.auction_number} onChange={e => setF(p=>({...p,auction_number:e.target.value}))} required placeholder="Ex: 001/2024" /></div>
          <div><Label>Nº do Processo SEI</Label><Input value={f.sei_number} onChange={e => setF(p=>({...p,sei_number:e.target.value}))} placeholder="Ex: 08219.000001/2025-01" /></div>
        </div>
        <div><Label>Objeto do Pregão *</Label><Textarea value={f.object} onChange={e => setF(p=>({...p,object:e.target.value}))} required rows={3} /></div>

        <div>
          <Label>Tipo de Registro</Label>
          <Select value={f.registration_type || 'srp_cfp'} onValueChange={v => setF(p=>({...p,registration_type:v}))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="srp_cfp">SRP do CFP</SelectItem>
              <SelectItem value="adesao">Adesão de Outro Órgão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {f.registration_type === 'adesao' && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div><Label>Nome do Órgão *</Label><Input value={f.adhesion_organ} onChange={e => setF(p=>({...p,adhesion_organ:e.target.value}))} required placeholder="Ex: Ministério da Saúde" /></div>
            <div><Label>Nº do Pregão do Órgão *</Label><Input value={f.adhesion_auction_number} onChange={e => setF(p=>({...p,adhesion_auction_number:e.target.value}))} required placeholder="Ex: 012/2024" /></div>
          </div>
        )}

        <div><Label>Status</Label>
          <Select value={f.status} onValueChange={v => setF(p=>({...p,status:v}))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Observações</Label><Textarea value={f.notes} onChange={e => setF(p=>({...p,notes:e.target.value}))} rows={2} /></div>
        <Button type="submit" className="w-full">{isEdit ? 'Salvar Alterações' : 'Criar Registro de Preços'}</Button>
      </form>
    );
  };

  const GroupForm = ({ initial, onSave, isEdit }) => {
    const [f, setF] = useState(initial);
    return (
      <form onSubmit={e => { e.preventDefault(); onSave({ ...f, total_value: parseFloat(f.total_value)||0 }); }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Nº da ARP *</Label><Input value={f.arp_number} onChange={e => setF(p=>({...p,arp_number:e.target.value}))} required placeholder="Ex: ARP-001/2025" /></div>
          <div><Label>Nº do Grupo</Label><Input value={f.group_number} onChange={e => setF(p=>({...p,group_number:e.target.value}))} placeholder="Ex: 01" /></div>
        </div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</h4>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Empresa *</Label><Input value={f.supplier_name} onChange={e => setF(p=>({...p,supplier_name:e.target.value}))} required /></div>
          <div><Label>CNPJ</Label><Input value={f.supplier_cnpj} onChange={e => setF(p=>({...p,supplier_cnpj:e.target.value}))} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2"><Label>Endereço</Label><Input value={f.supplier_address} onChange={e => setF(p=>({...p,supplier_address:e.target.value}))} /></div>
          <div><Label>CEP</Label><Input value={f.supplier_cep} onChange={e => setF(p=>({...p,supplier_cep:e.target.value}))} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Cidade</Label><Input value={f.supplier_city} onChange={e => setF(p=>({...p,supplier_city:e.target.value}))} /></div>
          <div><Label>Estado</Label>
            <Select value={f.supplier_state} onValueChange={v => setF(p=>({...p,supplier_state:v}))}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{STATES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Telefone</Label><Input value={f.supplier_phone} onChange={e => setF(p=>({...p,supplier_phone:e.target.value}))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>E-mail</Label><Input type="email" value={f.supplier_email} onChange={e => setF(p=>({...p,supplier_email:e.target.value}))} /></div>
          <div><Label>Responsável</Label><Input value={f.supplier_contact} onChange={e => setF(p=>({...p,supplier_contact:e.target.value}))} /></div>
        </div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vigência</h4>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Início</Label><Input type="date" value={f.start_date} onChange={e => setF(p=>({...p,start_date:e.target.value}))} /></div>
          <div><Label>Vigência</Label><Input type="date" value={f.end_date} onChange={e => setF(p=>({...p,end_date:e.target.value}))} /></div>
          <div><Label>Valor Total (R$)</Label><Input type="number" min="0" step="0.01" value={f.total_value} onChange={e => setF(p=>({...p,total_value:e.target.value}))} /></div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Switch checked={f.can_extend} onCheckedChange={v => setF(p=>({...p,can_extend:v}))} id="can_extend" />
          <div><Label htmlFor="can_extend" className="cursor-pointer">Possibilidade de prorrogação (+12 meses)</Label><p className="text-[10px] text-muted-foreground">Conforme art. 57 da Lei 8.666/93</p></div>
        </div>
        <div><Label>Status</Label>
          <Select value={f.status} onValueChange={v => setF(p=>({...p,status:v}))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Observações</Label><Textarea value={f.notes} onChange={e => setF(p=>({...p,notes:e.target.value}))} rows={2} /></div>
        <Button type="submit" className="w-full">{isEdit ? 'Salvar Alterações' : 'Criar Grupo/ARP'}</Button>
      </form>
    );
  };

  if (selectedGroup) {
    const daysLeft = selectedGroup.end_date ? differenceInDays(new Date(selectedGroup.end_date), new Date()) : null;
    const arpAsContract = {
      contract_number: selectedGroup.arp_number,
      supplier_name: selectedGroup.supplier_name,
      supplier_cnpj: selectedGroup.supplier_cnpj,
      supplier_address: selectedGroup.supplier_address,
      supplier_city: selectedGroup.supplier_city,
      supplier_state: selectedGroup.supplier_state,
      supplier_cep: selectedGroup.supplier_cep,
      total_value: selectedGroup.total_value,
      object: selected?.object || '',
      auction_number: selected?.auction_number || '',
    };
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)} className="gap-1"><ChevronRight className="w-4 h-4 rotate-180" />Voltar ao Pregão</Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{selectedGroup.arp_number} {selectedGroup.group_number ? `— Grupo ${selectedGroup.group_number}` : ''}</h1>
            <p className="text-sm text-muted-foreground">{selectedGroup.supplier_name}</p>
          </div>
          <TechnicalCapabilityButton contract={arpAsContract} contractId={selectedGroup.id} />
          {isAdmin && (
            <>
              <Dialog open={editGroup?.id === selectedGroup.id} onOpenChange={(o) => { if(!o) setEditGroup(null); }}>
                <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1" onClick={() => setEditGroup(selectedGroup)}><Pencil className="w-4 h-4" />Editar</Button></DialogTrigger>
                <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Editar Grupo/ARP</DialogTitle></DialogHeader>
                  <GroupForm initial={editGroup||selectedGroup} onSave={(d) => { updateGroup.mutate({ id: selectedGroup.id, d }); setSelectedGroup({...selectedGroup,...d}); }} isEdit />
                </DialogContent>
              </Dialog>
              <Button variant="destructive" size="sm" className="gap-1" onClick={() => { if(confirm('Excluir este grupo/ARP?')) { deleteGroup.mutate(selectedGroup.id); setSelectedGroup(null); } }}><Trash2 className="w-4 h-4" />Excluir</Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border-0 shadow-sm"><p className="text-xs text-muted-foreground">Empresa</p><p className="font-semibold text-sm">{selectedGroup.supplier_name}</p><p className="text-[10px] text-muted-foreground">{selectedGroup.supplier_cnpj}</p></Card>
          <Card className="p-4 border-0 shadow-sm"><p className="text-xs text-muted-foreground">Valor Total</p><p className="font-semibold text-sm text-emerald-600">{fmtBRL(selectedGroup.total_value)}</p></Card>
          <Card className="p-4 border-0 shadow-sm"><p className="text-xs text-muted-foreground">Vigência</p><p className={`font-semibold text-sm ${daysLeft !== null && daysLeft < 30 ? 'text-red-600' : ''}`}>{daysLeft !== null ? `${daysLeft} dias` : '—'}</p><p className="text-[10px] text-muted-foreground">{selectedGroup.end_date ? format(new Date(selectedGroup.end_date), 'dd/MM/yyyy') : '—'}</p></Card>
          <Card className="p-4 border-0 shadow-sm"><p className="text-xs text-muted-foreground">Prorrogação</p><Badge className={selectedGroup.can_extend ? 'bg-emerald-500/10 text-emerald-600 border-0' : 'bg-muted text-muted-foreground border-0'}>{selectedGroup.can_extend ? 'Possível (+12m)' : 'Não permitida'}</Badge></Card>
        </div>

        <Tabs defaultValue="items">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="items">Itens</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscalização</TabsTrigger>
            <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="mt-4">
            <ContractItemsTab contractId={selectedGroup.id} contract={arpAsContract} />
          </TabsContent>
          <TabsContent value="fiscal" className="mt-4">
            <FiscalTab contractId={selectedGroup.id} contract={arpAsContract} />
          </TabsContent>
          <TabsContent value="occurrences" className="mt-4">
            <OccurrenceTab contractId={selectedGroup.id} contract={arpAsContract} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="gap-1"><ChevronRight className="w-4 h-4 rotate-180" />Voltar</Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">Pregão Eletrônico Nº {selected.auction_number}</h1>
            <p className="text-sm text-muted-foreground truncate">{selected.object}</p>
          </div>
          <Badge className={`${statusColors[selected.status] || ''} border-0`}>{selected.status}</Badge>
          {isAdmin && (
            <>
              <Dialog open={editPR?.id === selected.id} onOpenChange={(o) => { if(!o) setEditPR(null); }}>
                <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1" onClick={() => setEditPR(selected)}><Pencil className="w-4 h-4" />Editar</Button></DialogTrigger>
                <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Editar Pregão</DialogTitle></DialogHeader>
                  <PRForm initial={editPR||selected} onSave={(d) => { updatePR.mutate({ id: selected.id, d }); setSelected({...selected,...d}); }} isEdit />
                </DialogContent>
              </Dialog>
              <Button variant="destructive" size="sm" className="gap-1" onClick={() => { if(confirm('Excluir este registro de preços?')) { deletePR.mutate(selected.id); setSelected(null); } }}><Trash2 className="w-4 h-4" />Excluir</Button>
            </>
          )}
          {selected.sei_number && <Badge variant="outline" className="text-xs">SEI: {selected.sei_number}</Badge>}
        </div>

        {/* Groups */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Grupos / ARPs ({groups.length})</h2>
          {isAdmin ? (
            <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
              <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Criar Grupo/ARP</Button></DialogTrigger>
              <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Criar Grupo / ARP</DialogTitle></DialogHeader>
                <GroupForm initial={groupForm} onSave={(d) => createGroup.mutate(d)} />
              </DialogContent>
            </Dialog>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg"><Lock className="w-3 h-3" />Somente admin</div>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum grupo/ARP cadastrado</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((g, i) => {
              const daysLeft = g.end_date ? differenceInDays(new Date(g.end_date), new Date()) : null;
              return (
                <motion.div key={g.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}>
                  <Card className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedGroup(g)}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{g.arp_number}{g.group_number ? ` — Grupo ${g.group_number}` : ''}</p>
                        <p className="text-xs text-muted-foreground">{g.supplier_name}</p>
                      </div>
                      <Badge className={`${statusColors[g.status]||''} border-0 text-[10px]`}>{g.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="text-emerald-600 font-medium">{fmtBRL(g.total_value)}</span>
                      {daysLeft !== null && <span className={daysLeft < 30 ? 'text-red-600 font-medium' : ''}>{daysLeft} dias restantes</span>}
                      {g.can_extend && <Badge className="bg-blue-500/10 text-blue-600 border-0 text-[10px]">Prorrogável +12m</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-primary"><Package className="w-3 h-3" />Ver itens →</div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro de Preços</h1>
          <p className="text-sm text-muted-foreground">Gestão de pregões eletrônicos, ARPs e grupos</p>
        </div>
        {isAdmin ? (
          <Dialog open={showNewPR} onOpenChange={setShowNewPR}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Novo Registro de Preços</Button></DialogTrigger>
            <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Novo Registro de Preços</DialogTitle></DialogHeader>
              <PRForm initial={prForm} onSave={(d) => createPR.mutate(d)} />
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg"><Lock className="w-4 h-4" />Somente admin pode criar registros</div>
        )}
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nº do pregão ou objeto..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum registro de preços encontrado</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.03 }}>
              <Card className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(r)}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`${statusColors[r.status]||''} border-0 text-[10px]`}>{r.status}</Badge>
                      <span className="text-xs font-semibold">Pregão Nº {r.auction_number}</span>
                      {r.sei_number && <span className="text-[10px] text-muted-foreground">SEI: {r.sei_number}</span>}
                      <Badge className={r.registration_type === 'adesao' ? 'bg-amber-500/10 text-amber-700 border-0 text-[10px]' : 'bg-blue-500/10 text-blue-700 border-0 text-[10px]'}>
                        {r.registration_type === 'adesao' ? `Adesão — ${r.adhesion_organ || 'Órgão'}` : 'SRP do CFP'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.object}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-primary flex-shrink-0">
                    Ver ARPs <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}