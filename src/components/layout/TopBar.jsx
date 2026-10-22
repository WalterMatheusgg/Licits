import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Building2, Menu, Moon, Search, Sun, User } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { notificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const roleLabels = {
  organization_admin: 'Administrador da organização',
  gestor: 'Gestor',
  fiscal: 'Fiscal',
  operacional: 'Operacional',
  visualizador: 'Visualizador',
};

export default function TopBar({ onMenuClick }) {
  const [darkMode, setDarkMode] = useState(() => (
    (window.localStorage.getItem('nexofiscal.theme') ?? window.localStorage.getItem('licits.theme')) === 'dark'
  ));
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchInputRef = useRef(null);
  const { user, authUser, logout } = useAuth();
  const {
    memberships,
    pendingInvitations,
    acceptInvitation,
    activeOrganization,
    activeOrganizationId,
    role,
    isPlatformAdmin,
    selectOrganization,
  } = useOrganization();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    window.localStorage.setItem('nexofiscal.theme', darkMode ? 'dark' : 'light');
    window.localStorage.removeItem('licits.theme');
  }, [darkMode]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-unread', activeOrganizationId, authUser?.id],
    queryFn: () => notificationService.listUnread({
      organizationId: activeOrganizationId,
      userId: authUser.id,
      limit: 5,
    }),
    enabled: Boolean(activeOrganizationId && authUser?.id),
    initialData: [],
    refetchInterval: 30000,
  });

  useEffect(() => notificationService.subscribe({
    organizationId: activeOrganizationId,
    onChange: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  }), [activeOrganizationId, queryClient]);

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    navigate(`/contracts?q=${encodeURIComponent(query)}`);
    setSearchTerm('');
  };

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground" onClick={onMenuClick} aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </Button>

        {memberships.length > 1 ? (
          <Select value={activeOrganizationId || undefined} onValueChange={selectOrganization}>
            <SelectTrigger className="w-[190px] hidden md:flex bg-muted/40 border-0">
              <Building2 className="w-4 h-4 mr-2 shrink-0" />
              <SelectValue placeholder="Selecionar organização" />
            </SelectTrigger>
            <SelectContent>
              {memberships.map((membership) => (
                <SelectItem key={membership.organization_id} value={membership.organization_id}>
                  {membership.organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground max-w-[190px]">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="truncate">{activeOrganization?.name}</span>
          </div>
        )}

        <form onSubmit={handleSearch} className="relative max-w-md w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Buscar contratos, fornecedores... (Ctrl+K)"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </form>
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        {pendingInvitations.length>0 && (
          <Button variant="outline" size="sm" onClick={async()=>{try{await acceptInvitation(pendingInvitations[0].organization_id);}catch(e){window.alert('Convite: '+e.message);}}}>
            Aceitar convite ({pendingInvitations.length})
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)} className="text-muted-foreground" aria-label="Alternar tema">
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label="Notificações">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 font-semibold text-sm flex items-center justify-between">
              <span>Notificações</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ao vivo
              </span>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhuma notificação</div>
            ) : notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 py-2">
                <span className="text-sm font-medium">{notification.title}</span>
                <span className="text-xs text-muted-foreground line-clamp-1">{notification.message}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm text-primary cursor-pointer" onClick={() => navigate('/notifications')}>
              Ver todas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left hidden md:block max-w-44">
                <p className="text-sm font-medium text-foreground truncate">{user?.full_name || user?.email || 'Usuário'}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {isPlatformAdmin ? 'Administrador da plataforma' : roleLabels[role] || 'Sem função'}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout}>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
