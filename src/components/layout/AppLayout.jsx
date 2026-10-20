import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-[9999] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      </div>
      {sidebarOpen && (
        <div className="block lg:hidden fixed inset-y-0 left-0 z-[10000]">
          <Sidebar collapsed={false} onToggleCollapse={() => setSidebarOpen(false)} />
        </div>
      )}
      <div
        className={`transition-all duration-300 ease-in-out ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-[268px]'}`}
      >
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
