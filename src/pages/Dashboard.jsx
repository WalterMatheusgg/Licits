import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ContractStatusChart from '../components/dashboard/ContractStatusChart';
import ConsumptionChart from '../components/dashboard/ConsumptionChart';
import RecentContracts from '../components/dashboard/RecentContracts';
import FiscalThermometer from '../components/dashboard/FiscalThermometer';
import { LoadingState, EmptyState } from '@/components/common/StateView';
import {
  FileText, AlertTriangle, CheckCircle, Clock, DollarSign,
  ShieldAlert, Package, Users, TrendingUp, TrendingDown,
  Inbox, Brain, MapPin, Bell, Plus
} from 'lucide-react';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function StatCard({ title, value, subtitle, icon: Icon, color, delay, trend, link }) {
  const colorMap = {
    primary: { bg: 'from-blue-500 to-blue-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-white/70' },
    warning: { bg: 'from-amber-400 to-amber-500', icon: 'bg-white/20', text: 'text-white', sub: 'text-white/70' },
    destructive: { bg: 'from-red-500 to-red-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-white/70' },
    accent: { bg: 'from-emerald-500 to-emerald-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-white/70' },
    purple: { bg: 'from-violet-500 to-violet-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-white/70' },
    slate: { bg: 'from-slate-500 to-slate-600', icon: 'bg-white/20', text: 'text-white', sub: 'text-white/70' },
  };
  const c = colorMap[color] || colorMap.primary;
  const IconCmp = Icon;
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg} p-4 lg:p-5 shadow-lg hover:scale-[1.02] transition-transform cursor-default`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${c.sub} mb-1`}>{title}</p>
          <p className={`text-lg sm:text-2xl lg:text-3xl font-extrabold ${c.text} break-words`}>{value}</p>
          {subtitle && <p className={`text-xs mt-1 ${c.sub}`}>{subtitle}</p>}
        </div>
        <div className={`${c.icon} rounded-xl p-2.5`}>
          <IconCmp className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs ${c.sub}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(trend)}% vs. mês anterior</span>
        </div>
      )}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5" />
    </motion.div>
  );
  return link ? <Link to={link}>{card}</Link> : card;
}

function QuickAction({ icon: IconEl, label, to, color }) {
  return (
    <Link to={to}>
      <motion.div whileHover={{ scale: 1.04 }} className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-xl border-2 ${color} gap-2 hover:shadow-md transition-shadow cursor-pointer`}>
        <IconEl className="w-5 h-5 lg:w-6 lg:h-6" />
        <span className="text-xs font-medium text-center leading-tight">{label}</span>
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [expiringFilter, setExpiringFilter] = useState(() => {
    const saved = localStorage.getItem('dashboard_expiringFilter');
    return saved ? parseInt(saved) : 30;
  });

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({ queryKey: ['contracts'], queryFn: () => base44.entities.Contract.list('-created_date'), initialData: [] });
  const { data: priceGroups = [] } = useQuery({ queryKey: ['price-groups-all'], queryFn: () => base44.entities.PriceRegistrationGroup.list(), initialData: [] });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications-all'], queryFn: () => base44.entities.Notification.filter({ read: false }), initialData: [] });
  const { data: adminRequests = [] } = useQuery({ queryKey: ['admin-requests'], queryFn: () => base44.entities.AdminRequest.filter({ status: 'pendente' }), initialData: [] });

  const allItems = [
    ...contracts,
    ...priceGroups.map(g => ({ ...g, _isArp: true, contract_number: g.arp_number, object: `ARP — ${g.supplier_name}` }))
  ];
  const active = allItems.filter(c => c.status === 'ativo');
  const expiring = allItems.filter(c => { if(!c.end_date) return false; const d = differenceInDays(new Date(c.end_date), new Date()); return d>=0 && d<=30 && c.status==='ativo'; });
  const expired = allItems.filter(c => c.status === 'vencido');
  const expiringInDays = (days) => allItems.filter(c => { if(!c.end_date) return false; const d = differenceInDays(new Date(c.end_date), new Date()); return d>=0 && d<=days && c.status==='ativo'; });
  const expiringFiltered = expiringInDays(expiringFilter).sort((a,b) => new Date(a.end_date) - new Date(b.end_date));
  const totalValue = allItems.reduce((s,c)=>s+(c.total_value||0),0);
  const usedValue = allItems.reduce((s,c)=>s+(c.used_value||0),0);
  const lowFiscal = contracts.filter(c => c.fiscal_status === 'baixa');
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'gestor';

  const handleSetExpiringFilter = (d) => {
    setExpiringFilter(d);
    localStorage.setItem('dashboard_expiringFilter', String(d));
  };

  if (contractsLoading) {
    return <LoadingState message="Carregando painel..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-5 lg:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-10 hidden sm:block">
          <div className="w-96 h-96 rounded-full border-[40px] border-white absolute -right-20 -top-20" />
          <div className="w-64 h-64 rounded-full border-[30px] border-white absolute right-10 bottom-0" />
        </div>
        <div className="relative">
          <p className="text-white/70 text-sm font-medium mb-1">Plataforma de Gestão</p>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight">Gestão Contratual</h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1">
            {currentUser ? `Bem-vindo, ${currentUser.full_name?.split(' ')[0] || 'usuário'} · ` : ''}
            {allItems.length} contrato(s)/ata(s) · {active.length} ativo(s)
          </p>
        </div>
      </motion.div>

      {/* Empty state for new users */}
      {allItems.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <EmptyState
            icon={FileText}
            title="Bem-vindo ao ContratoIA!"
            message="Você ainda não possui contratos cadastrados. Comece criando seu primeiro contrato ou utilize a leitura inteligente com IA para extrair dados automaticamente."
            action={
              <div className="flex gap-3 flex-wrap justify-center">
                <Link to="/contracts">
                  <button className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Cadastrar Contrato
                  </button>
                </Link>
                <Link to="/ai-assistant">
                  <button className="bg-muted text-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-muted/80 transition-colors flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Assistente IA
                  </button>
                </Link>
              </div>
            }
          />
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        <StatCard title="Contratos Ativos" value={active.length} icon={CheckCircle} color="primary" delay={0} link="/contracts" />
        <StatCard title="Vencendo (30d)" value={expiring.length} icon={Clock} color="warning" delay={0.05} link="/contract-table" />
        <StatCard title="Vencidos" value={expired.length} icon={AlertTriangle} color="destructive" delay={0.1} link="/contract-table" />
        <StatCard title="Valor Total" value={fmtBRL(totalValue)} subtitle={`Utilizado: ${fmtBRL(usedValue)}`} icon={DollarSign} color="accent" delay={0.15} />
        <StatCard title="Alertas" value={notifications.length} icon={Bell} color="warning" delay={0.2} link="/notifications" />
        <StatCard title="Baixa Fiscalização" value={lowFiscal.length} icon={ShieldAlert} color="destructive" delay={0.25} link="/fiscal" />
      </div>

      {/* Admin alerts */}
      {isAdmin && adminRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Inbox className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">{adminRequests.length} solicitação(ões) pendente(s)</p>
              <p className="text-amber-600 text-xs">Usuários aguardam resposta do administrador</p>
            </div>
          </div>
          <Link to="/admin-requests">
            <button className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">Ver Solicitações</button>
          </Link>
        </motion.div>
      )}

      {/* Contratos a vencer */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border rounded-2xl p-4 lg:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold">Contratos a Vencer</h2>
          </div>
          <div className="flex gap-1">
            {[30, 60, 90].map(d => (
              <button key={d} onClick={() => handleSetExpiringFilter(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  expiringFilter === d ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700'
                }`}>
                {d} dias
              </button>
            ))}
          </div>
        </div>
        {expiringFiltered.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-500" />
            <p className="text-sm">Nenhum contrato ativo vencendo nos próximos {expiringFilter} dias</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {expiringFiltered.map(c => {
              const daysLeft = differenceInDays(new Date(c.end_date), new Date());
              const urgency = daysLeft <= 30 ? 'text-red-600 bg-red-50 border-red-200' : daysLeft <= 60 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-600 bg-blue-50 border-blue-200';
              return (
                <Link to={`/contracts/${c.id}`} key={c.id}>
                  <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${urgency} hover:opacity-80 transition-opacity`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.contract_number} — {c.supplier_name}</p>
                      <p className="text-xs opacity-70 truncate">{c.object}</p>
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="text-sm font-bold">{daysLeft}d</p>
                      <p className="text-[10px] opacity-70">{new Date(c.end_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acesso Rápido</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 lg:gap-3">
          <QuickAction icon={FileText} label="Contratos" to="/contracts" color="border-blue-200 text-blue-600 hover:border-blue-400" />
          <QuickAction icon={Package} label="Itens / Estoque" to="/contracts" color="border-emerald-200 text-emerald-600 hover:border-emerald-400" />
          <QuickAction icon={ShieldAlert} label="Fiscalização" to="/fiscal" color="border-violet-200 text-violet-600 hover:border-violet-400" />
          <QuickAction icon={AlertTriangle} label="Ocorrências" to="/documents" color="border-amber-200 text-amber-600 hover:border-amber-400" />
          <QuickAction icon={MapPin} label="Mapa Brasil" to="/map" color="border-sky-200 text-sky-600 hover:border-sky-400" />
          <QuickAction icon={Brain} label="Assistente IA" to="/ai-assistant" color="border-pink-200 text-pink-600 hover:border-pink-400" />
          <QuickAction icon={Inbox} label="Solicitações" to="/admin-requests" color="border-orange-200 text-orange-600 hover:border-orange-400" />
          {isAdmin && <QuickAction icon={Users} label="Usuários" to="/users" color="border-slate-200 text-slate-600 hover:border-slate-400" />}
        </div>
      </div>

      {/* Thermometer + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <FiscalThermometer contracts={contracts} />
        <ContractStatusChart contracts={contracts} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <ConsumptionChart contracts={contracts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <RecentContracts contracts={contracts} />
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-5 lg:p-6 text-white shadow-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-white -translate-x-10 -translate-y-10" />
            <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full bg-white translate-x-16 translate-y-16" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-white/20 rounded-lg"><Brain className="w-5 h-5" /></div>
              <h3 className="text-base font-bold">Assistente IA</h3>
            </div>
            <p className="text-sm text-white/80 mb-4">Consulte contratos, saldos, vencimentos e gere documentos com inteligência artificial.</p>
            <div className="space-y-2 text-xs text-white/70 mb-5">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">💬 "Quais contratos vencem este mês?"</div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">💬 "Qual o saldo do contrato 001/2024?"</div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">💬 "Liste os itens com estoque crítico"</div>
            </div>
            <Link to="/ai-assistant">
              <button className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors border border-white/30">
                Abrir Assistente IA →
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}