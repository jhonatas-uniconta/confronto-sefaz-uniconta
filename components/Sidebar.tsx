import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  FileCheck2, 
  Users, 
  History, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  ShieldCheck, 
  X, 
  Menu,
  LogOut,
  UserCheck
} from 'lucide-react';
import { UnicontaLogo } from './ui';

export type AppRoute = 'dashboard' | 'notas' | 'editais' | 'clientes' | 'historico-editais' | 'login';

interface SidebarProps {
  currentRoute: AppRoute;
  onRouteChange: (route: AppRoute) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onRouteChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  userEmail,
  onSignOut
}) => {
  const navItems: { route: AppRoute; label: string; icon: React.ReactNode; badge?: string }[] = [
    { route: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { route: 'notas', label: 'Confronto de Notas', icon: <FileSpreadsheet size={20} /> },
    { route: 'editais', label: 'Confronto de Editais', icon: <FileCheck2 size={20} />, badge: 'Novo' },
    { route: 'clientes', label: 'Base de Clientes', icon: <Users size={20} /> },
    { route: 'historico-editais', label: 'Histórico de Editais', icon: <History size={20} /> },
  ];

  const handleItemClick = (route: AppRoute) => {
    onRouteChange(route);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#151f32] text-slate-200 select-none">
      {/* Brand Header */}
      <div className={`flex items-center h-16 px-4 border-b border-slate-800/80 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed ? (
          <button 
            onClick={() => handleItemClick('dashboard')}
            className="flex items-center gap-3 text-left group"
          >
            <UnicontaLogo className="h-7 w-auto text-white group-hover:scale-105 transition-transform" />
            <div>
              <span className="text-base font-bold tracking-tight text-white block">
                Confronta <span className="font-light text-slate-300">Uniconta</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Portal Fiscal
              </span>
            </div>
          </button>
        ) : (
          <button 
            onClick={() => handleItemClick('dashboard')}
            title="Confronta Uniconta"
            className="hover:scale-105 transition-transform"
          >
            <UnicontaLogo className="h-6 w-auto text-white" />
          </button>
        )}

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentRoute === item.route;
          return (
            <button
              key={item.route}
              onClick={() => handleItemClick(item.route)}
              title={isCollapsed ? item.label : undefined}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }
                ${isCollapsed ? 'justify-center' : 'justify-start'}
              `}
            >
              <div className={`shrink-0 transition-transform ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}>
                {item.icon}
              </div>

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ml-2">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Floating Tooltip when collapsed */}
              {isCollapsed && (
                <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl z-50 whitespace-nowrap items-center gap-1.5 border border-slate-700 pointer-events-none">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="bg-emerald-500 text-white text-[9px] px-1 rounded-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        {/* e-Fisco Link */}
        <a
          href="https://efisco.sefaz.pe.gov.br/"
          target="_blank"
          rel="noreferrer"
          title={isCollapsed ? "Portal e-Fisco SEFAZ-PE" : undefined}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors
            ${isCollapsed ? 'justify-center' : 'justify-start'}
          `}
        >
          <ExternalLink size={15} className="shrink-0" />
          {!isCollapsed && <span className="truncate">e-Fisco SEFAZ</span>}
        </a>

        {/* Desktop Collapse / Expand Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className={`
            hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all border border-slate-800 cursor-pointer
            ${isCollapsed ? 'justify-center' : 'justify-between'}
          `}
          title={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {!isCollapsed && <span className="font-medium">Recolher Menu</span>}
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* User Card & Logout Option */}
        {onSignOut && (
          <div className="pt-2 border-t border-slate-800/60">
            {!isCollapsed ? (
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-900/60 rounded-xl border border-slate-800/70">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <UserCheck size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-medium text-slate-200 truncate" title={userEmail || 'Usuário Autenticado'}>
                      {userEmail ? userEmail.split('@')[0] : 'Colaborador'}
                    </span>
                    <span className="block text-[9px] text-slate-400 truncate">
                      Conectado
                    </span>
                  </div>
                </div>

                <button
                  onClick={onSignOut}
                  title="Sair da conta (Logout)"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignOut}
                title="Sair da conta (Logout)"
                className="w-full flex justify-center p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}

        {/* Version info */}
        {!isCollapsed && (
          <div className="px-1 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="truncate">Uniconta Assessoria</span>
            <span className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">v3.1</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-300 ease-in-out z-30 shadow-xl border-r border-slate-800
          ${isCollapsed ? 'w-[72px]' : 'w-64'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer Panel */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 w-72 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
