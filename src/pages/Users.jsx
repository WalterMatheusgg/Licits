import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users as UsersIcon, UserPlus, Mail, Shield, Search, Loader2, Trash2, Lock, Unlock, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';

const roleLabels = { admin: 'Administrador', gestor: 'Gestor/Fiscal', operacional: 'Operacional' };
const roleBadge = { admin: 'bg-primary/10 text-primary', gestor: 'bg-amber-500/10 text-amber-600', operacional: 'bg-muted text-muted-foreground' };
const statusBadge = { ativo: 'bg-emerald-500/10 text-emerald-600', inativo: 'bg-gray-500/10 text-gray-600', bloqueado: 'bg-red-500/10 text-red-600' };

export default function Users() {
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operacional');
  const [inviting, setInviting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [editRoleUser, setEditRoleUser] = useState(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    dataClient.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => dataClient.entities.User.list(),
    initialData: [],
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    return u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
  });

  const handleInvite = async () => {
    setInviting(true);
    const role = inviteRole;
    try {
      await dataClient.users.inviteUser(inviteEmail, role);
      setShowInvite(false);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      alert('Não foi possível enviar o convite: ' + error.message);
    } finally {
      setInviting(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => dataClient.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dataClient.entities.User.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
            <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
          </div>
          {isAdmin && (
            <Dialog open={showInvite} onOpenChange={setShowInvite}>
              <DialogTrigger asChild><Button className="gap-2"><UserPlus className="w-4 h-4" /> Convidar Usuário</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Convidar Usuário</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>E-mail</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
                  <div><Label>Nível de Acesso</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador (Nível 1)</SelectItem>
                        <SelectItem value="gestor">Gestor/Fiscal (Nível 2)</SelectItem>
                        <SelectItem value="operacional">Operacional (Nível 3)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="w-full">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Convite'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar usuários..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="p-4 border-0 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{u.full_name?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {u.sector && <Badge variant="outline" className="text-[10px]">{u.sector}</Badge>}
                  <Badge className={`${roleBadge[u.role] || roleBadge.operacional} border-0 text-[10px]`}>
                    <Shield className="w-3 h-3 mr-1" />{roleLabels[u.role] || 'Operacional'}
                  </Badge>
                  <Badge variant="outline" className={`${statusBadge[u.status] || statusBadge.ativo} text-[10px]`}>
                    {u.status === 'bloqueado' ? '🔒 Bloqueado' : u.status === 'inativo' ? 'Inativo' : 'Ativo'}
                  </Badge>

                  {isAdmin && u.id !== currentUser?.id && (
                    <div className="flex items-center gap-1 ml-2">
                      {/* Alterar nível */}
                      <Dialog open={editRoleUser?.id === u.id} onOpenChange={(open) => { if (!open) setEditRoleUser(null); }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setEditRoleUser(u); setEditRoleValue(u.role || 'operacional'); }}>
                            <Pencil className="w-3 h-3" /> Nível
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader><DialogTitle>Alterar Nível de Acesso</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Usuário: <strong>{u.full_name || u.email}</strong></p>
                            <div>
                              <Label>Novo nível</Label>
                              <Select value={editRoleValue} onValueChange={setEditRoleValue}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrador (Nível 1)</SelectItem>
                                  <SelectItem value="gestor">Gestor/Fiscal (Nível 2)</SelectItem>
                                  <SelectItem value="operacional">Operacional (Nível 3)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => { updateMutation.mutate({ id: u.id, data: { role: editRoleValue } }); setEditRoleUser(null); }}>
                              Salvar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Bloquear / Desbloquear */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs gap-1 ${u.status === 'bloqueado' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}>
                            {u.status === 'bloqueado' ? <><Unlock className="w-3 h-3" /> Desbloquear</> : <><Lock className="w-3 h-3" /> Bloquear</>}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{u.status === 'bloqueado' ? 'Desbloquear usuário?' : 'Bloquear usuário?'}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {u.status === 'bloqueado'
                                ? `${u.full_name || u.email} poderá acessar o sistema novamente.`
                                : `${u.full_name || u.email} será impedido de acessar o sistema imediatamente.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => updateMutation.mutate({ id: u.id, data: { status: u.status === 'bloqueado' ? 'ativo' : 'bloqueado' } })}>
                              {u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Excluir */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="w-3 h-3" /> Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita. O usuário <strong>{u.full_name || u.email}</strong> será removido permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(u.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
