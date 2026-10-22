import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, MapPin, Users, Bell,
  MessageSquare, ClipboardCheck, AlertOctagon, BarChart3,
  ChevronLeft, ChevronRight, LogOut, Activity, Mail, Phone,
  ClipboardList, Inbox, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard', color: 'from-blue-500 to-blue-600' },
    ]
  },
  {
    label: 'Contratos',
    items: [
      { path: '/contracts', icon: FileText, label: 'Contratos', color: 'from-indigo-500 to-indigo-600' },
      { path: '/price-registrations', icon: ClipboardList, label: 'Registros de Preços', color: 'from-violet-500 to-violet-600' },
      { path: '/contract-table', icon: BarChart3, label: 'Quadro Resumido', color: 'from-cyan-500 to-cyan-600' },
    ]
  },
  {
    label: 'Fiscalização',
    items: [
      { path: '/fiscal', icon: ClipboardCheck, label: 'Rotinas de Fiscalização', color: 'from-emerald-500 to-emerald-600' },
      { path: '/documents', icon: AlertOctagon, label: 'Ocorrências', color: 'from-amber-500 to-amber-600' },
      { path: '/admin-requests', icon: Inbox, label: 'Solicitações Admin', color: 'from-orange-500 to-orange-600', permission: 'members.manage' },
    ]
  },
  {
    label: 'Comunicação',
    items: [
      { path: '/notifications', icon: Bell, label: 'Notificações', color: 'from-pink-500 to-pink-600' },
      { path: '/alerts-email', icon: Mail, label: 'Alertas E-mail', color: 'from-rose-500 to-rose-600' },
      { path: '/contacts', icon: Phone, label: 'Contatos', color: 'from-teal-500 to-teal-600' },
    ]
  },
  {
    label: 'Ferramentas',
    items: [
      { path: '/map', icon: MapPin, label: 'Mapa Brasil', color: 'from-sky-500 to-sky-600' },
      { path: '/ai-assistant', icon: MessageSquare, label: 'Assistente IA', color: 'from-purple-500 to-purple-600' },
      { path: '/users', icon: Users, label: 'Usuários', color: 'from-slate-500 to-slate-600', permission: 'members.manage' },
      { path: '/audit', icon: Activity, label: 'Auditoria', color: 'from-gray-500 to-gray-600', permission: 'audit.view' },
    ]
  }
];

export default function Sidebar({ collapsed, onToggleCollapse }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { can } = useOrganization();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 268 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-[10000] flex flex-col border-r border-sidebar-border"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30"
            aria-hidden="true"
          >
            <ShieldCheck className="w-5 h-5 text-white" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <h1 className="text-sm font-extrabold tracking-tight leading-tight">Licits</h1>
                <p className="text-[9px] text-sidebar-foreground/50 leading-tight">Gestão Contratual</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto overflow-x-hidden" onClick={() => onToggleCollapse?.()}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/30 px-2 mb-1.5"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.filter((item) => !item.permission || can(item.permission)).map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} aria-label={item.label}>
                    <motion.div
                      whileHover={{ x: collapsed ? 0 : 3 }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        "flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-200 group relative",
                        isActive
                          ? `bg-gradient-to-r ${item.color} text-white shadow-md`
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                        isActive ? "bg-white/20" : "bg-sidebar-accent/0 group-hover:bg-sidebar-accent"
                      )}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="text-xs font-medium overflow-hidden whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {/* Tooltip when collapsed */}
                      {collapsed && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                          {item.label}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                        </div>
                      )}
                      {/* Active indicator */}
                      {isActive && !collapsed && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70"
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t border-sidebar-border space-y-1 flex-shrink-0">
        <motion.button
          whileHover={{ x: 3 }}
          onClick={handleLogout}
          aria-label="Sair do sistema"
          className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-all w-full"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          {!collapsed && <span className="text-xs font-medium">Sair</span>}
        </motion.button>
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex items-center justify-center w-full py-2 rounded-xl text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
}