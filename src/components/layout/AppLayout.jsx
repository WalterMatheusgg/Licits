import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen min-w-0 bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button type="button" aria-label="Fechar menu lateral" className="fixed inset-0 z-[9999] bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      </div>
      {sidebarOpen && (
        <div role="dialog" aria-modal="true" aria-label="Menu de navegação" className="fixed inset-y-0 left-0 z-[10000] block max-w-[calc(100vw-2rem)] lg:hidden">
          <Sidebar collapsed={false} onNavigate={() => setSidebarOpen(false)} onToggleCollapse={() => setSidebarOpen(false)} />
        </div>
      )}
      <div
        className={`min-w-0 max-w-full transition-all duration-300 ease-in-out ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[268px]'}`}
      >
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main id="main-content" className="app-main min-w-0 max-w-full overflow-x-clip px-3 py-4 sm:px-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
