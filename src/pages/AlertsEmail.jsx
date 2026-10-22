import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataClient } from '@/api/dataClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, Package, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';

export default function AlertsEmail() {
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [done, setDone] = useState(false);
  const {data: budgetAlerts = [], error: budgetError} = useQuery({
    queryKey: ['fiscal-budget-alert-queue'],
    queryFn: () => dataClient.finance.alerts(),
    refetchInterval: 60000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => dataClient.entities.Contract.list('-created_date'),
    initialData: [],
  });

  const { data: items = [] } = useQuery({
    queryKey: ['all-items'],
    queryFn: () => dataClient.entities.ContractItem.list(),
    initialData: [],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => dataClient.entities.User.list(),
    initialData: [],
  });

  // Find eligible recipients: admin (level 1) and users with role 'gestor' (level 2)
  const recipients = users.filter(u => u.role === 'admin' || u.role === 'gestor');

  // Contracts expiring in 60 days
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date || c.status !== 'ativo') return false;
    const days = differenceInDays(new Date(c.end_date), new Date());
    return days >= 0 && days <= 60;
  });

  // Items with low balance (used >= 80% of contracted)
  const lowItems = items.filter(i => {
    if (!i.contracted_qty || i.contracted_qty === 0) return false;
    const pct = ((i.used_qty || 0) / i.contracted_qty) * 100;
    return pct >= 80;
  });

  const getContractForItem = (item) => contracts.find(c => c.id === item.contract_id);

  const handleSendAlerts = async () => {
    if (recipients.length === 0) {
      alert('Nenhum usuário de nível 1 (Admin) ou nível 2 (Gestor) cadastrado para receber alertas.');
      return;
    }
    setSending(true);
    setSentCount(0);
    let count = 0;

    for (const user of recipients) {
      if (!user.email) continue;

      // Build email body
      let body = `<h2 style="color:#1e40af">Licits — Alertas de Gestão Contratual</h2>`;
      body += `<p>Olá, <strong>${user.full_name || user.email}</strong>.</p>`;
      body += `<p>Abaixo estão os alertas identificados automaticamente pelo sistema:</p>`;

      if (expiringContracts.length > 0) {
        body += `<h3 style="color:#d97706">⚠️ Contratos Próximos do Vencimento (60 dias)</h3><table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#f3f4f6"><th>Contrato</th><th>Empresa</th><th>Vigência</th><th>Dias Restantes</th></tr>`;
        for (const c of expiringContracts) {
          const days = differenceInDays(new Date(c.end_date), new Date());
          body += `<tr><td>${c.contract_number}</td><td>${c.supplier_name}</td><td>${c.end_date}</td><td style="color:${days <= 30 ? '#dc2626' : '#d97706'};font-weight:bold">${days} dias</td></tr>`;
        }
        body += `</table>`;
      }

      if (lowItems.length > 0) {
        body += `<h3 style="color:#dc2626" style="margin-top:24px">🔴 Itens com Saldo Crítico (≥80% consumido)</h3><table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#f3f4f6"><th>Contrato</th><th>Especificação</th><th>Utilizado</th><th>Disponível</th></tr>`;
        for (const item of lowItems) {
          const c = getContractForItem(item);
          const pct = ((item.used_qty || 0) / item.contracted_qty * 100).toFixed(0);
          const available = item.contracted_qty - (item.used_qty || 0);
          body += `<tr><td>${c?.contract_number || '—'}</td><td>${item.description}</td><td style="color:#dc2626;font-weight:bold">${pct}%</td><td>${available.toLocaleString('pt-BR')} ${item.unit || ''}</td></tr>`;
        }
        body += `</table>`;
      }

      if (expiringContracts.length === 0 && lowItems.length === 0) {
        body += `<p style="color:#16a34a">✅ Nenhum alerta crítico identificado no momento.</p>`;
      }

      body += `<hr/><p style="font-size:11px;color:#6b7280">E-mail automático gerado pelo sistema Licits em ${new Date().toLocaleString('pt-BR')}</p>`;

      await dataClient.integrations.Core.SendEmail({
        to: user.email,
        subject: `[Licits] ${expiringContracts.length} contrato(s) vencendo • ${lowItems.length} item(s) crítico(s)`,
        body,
      });
      count++;
      setSentCount(count);
    }

    setSending(false);
    setDone(true);
    setTimeout(() => setDone(false), 5000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="w-6 h-6" /> Alertas por E-mail
        </h1>
        <p className="text-sm text-muted-foreground">Acompanhe a fila automática de alertas por orçamento. O resumo manual abaixo pode ser enviado separadamente.</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Clock className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Contratos Vencendo</p>
              <p className="text-2xl font-bold">{expiringContracts.length}</p>
              <p className="text-[10px] text-muted-foreground">próximos 60 dias</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10"><Package className="w-4 h-4 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Itens Críticos</p>
              <p className="text-2xl font-bold">{lowItems.length}</p>
              <p className="text-[10px] text-muted-foreground">≥80% consumido</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Mail className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Destinatários</p>
              <p className="text-2xl font-bold">{recipients.length}</p>
              <p className="text-[10px] text-muted-foreground">Admin + Gestores</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Durable automatic alerts, with honest delivery states. */}
      <Card className="p-4 lg:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-bold">Alertas automáticos de orçamento</h2>
          <p className="text-sm text-muted-foreground">Avisos de 80%, 90% e 100% gerados ao registrar compras. Destino: fiscal atribuído e administradores.</p></div>
          <Badge variant="outline">{budgetAlerts.length} alertas registrados</Badge>
        </div>
        {budgetError && <p className="text-sm text-red-600" role="alert">{budgetError.message}</p>}
        <p className="text-xs text-amber-700">O e-mail externo requer implantação da função dispatch-budget-alerts, Resend e agendamento. Sem isso, avisos ficam pendentes na fila.</p>
        {!budgetAlerts.length
          ? <p className="text-sm text-muted-foreground">Nenhum marco orçamentário alcançado nesta organização.</p>
          : <div className="space-y-2 max-h-80 overflow-y-auto">{budgetAlerts.slice(0,30).map(a => {
            const c = contracts.find(v=>v.id===a.contract_id);
            const label=a.status==='sent'?'E-mail encaminhado':a.status==='failed'?'Falha — em tentativa':a.status==='processing'?'Processando':'Aguardando envio';
            return <div className="flex justify-between gap-3 border rounded-lg p-3" key={a.id}>
              <div><p className="text-sm font-semibold">{c?.contract_number || a.contract_id} · {a.threshold_percent}% do teto</p>
                <p className="text-xs text-muted-foreground">Utilização no marco: {Number(a.amount_used).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} de {Number(a.budget_total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
              </div>
              <Badge className={a.status==='sent'?'bg-emerald-100 text-emerald-800':a.status==='failed'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-800'}>{label}</Badge>
            </div>;
          })}</div>}
      </Card>

      {/* Recipients list */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Destinatários do Alerta</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário Admin ou Gestor cadastrado.</p>
          ) : (
            recipients.map(u => (
              <div key={u.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{u.full_name?.[0] || u.email?.[0] || '?'}</div>
                  <span className="text-sm">{u.full_name || u.email}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{u.role === 'admin' ? 'Nível 1' : 'Nível 2'}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Expiring contracts preview */}
      {expiringContracts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />Contratos Vencendo em 60 dias</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {expiringContracts.map(c => {
              const days = differenceInDays(new Date(c.end_date), new Date());
              return (
                <div key={c.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                  <div>
                    <span className="text-sm font-medium">{c.contract_number}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.supplier_name}</span>
                  </div>
                  <Badge className={`${days <= 30 ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'} border-0 text-[10px]`}>{days}d restantes</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Low items preview */}
      {lowItems.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-red-600" />Itens com Saldo Crítico</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lowItems.map(item => {
              const c = getContractForItem(item);
              const pct = ((item.used_qty || 0) / item.contracted_qty * 100).toFixed(0);
              return (
                <div key={item.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                  <div>
                    <span className="text-sm font-medium">{item.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c?.contract_number || '—'}</span>
                  </div>
                  <Badge className="bg-red-500/10 text-red-600 border-0 text-[10px]">{pct}% consumido</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Send button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSendAlerts} disabled={sending || recipients.length === 0} className="gap-2" size="lg">
          {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando {sentCount}/{recipients.length}...</> : <><Mail className="w-4 h-4" />Enviar resumo manual agora</>}
        </Button>
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-emerald-600 text-sm">
            <CheckCircle className="w-4 h-4" /> {sentCount} e-mail(s) aceito(s) pelo provedor (entrega final não confirmada).
          </motion.div>
        )}
      </div>
    </div>
  );
}