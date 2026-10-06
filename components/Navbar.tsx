import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  FileCheck2, 
  Users, 
  History, 
  Menu, 
  X, 
  Database,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { UnicontaLogo } from './ui';

export type AppRoute = 'dashboard' | 'notas' | 'editais' | 'clientes' | 'historico-editais';

interface NavbarProps {
  currentRoute: AppRoute;
  onRouteChange: (route: AppRoute) => void;
  onOpenSqlModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onRouteChange, onOpenSqlModal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { route: AppRoute; label: string; icon: React.ReactNode; badge?: string }[] = [
    { route: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { route: 'notas', label: 'Confronto de Notas', icon: <FileSpreadsheet size={18} /> },
    { route: 'editais', label: 'Confronto de Editais', icon: <FileCheck2 size={18} />, badge: 'Novo' },
    { route: 'clientes', label: 'Clientes', icon: <Users size={18} /> },
    { route: 'historico-editais', label: 'Histórico de Editais', icon: <History size={18} /> },
  ];

  const handleNavClick = (route: AppRoute) => {
    onRouteChange(route);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-[#151f32] text-white shadow-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Portal Title */}
          <div className="flex items-center gap-6">
            <button 
              onClick={() => handleNavClick('dashboard')} 
              className="flex items-center gap-3 text-left group hover:opacity-90 transition-opacity"
            >
              <UnicontaLogo className="h-8 w-auto text-white group-hover:scale-105 transition-transform" />
              <div>
                <span className="text-xl font-bold tracking-tight block">
                  Confronta <span className="font-normal text-slate-300">by Uniconta</span>
                </span>
                <span className="text-[11px] text-slate-400 block -mt-1 font-medium">
                  Portal de Ferramentas Fiscais
                </span>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1 ml-4">
              {navItems.map(item => {
                const isActive = currentRoute === item.route;
                return (
                  <button
                    key={item.route}
                    onClick={() => handleNavClick(item.route)}
                    className={`
                      flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all
                      ${isActive 
                        ? 'bg-blue-600/90 text-white shadow-sm' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }
                    `}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="hidden md:flex items-center gap-3">
            {onOpenSqlModal && (
              <button
                onClick={onOpenSqlModal}
                title="Estrutura SQL do Banco Supabase"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
              >
                <Database size={13} className="text-blue-400" />
                <span>Supabase SQL</span>
              </button>
            )}

            <div className="text-right border-l border-slate-700 pl-3">
              <span className="text-xs text-slate-400 block">Usuário</span>
              <span className="text-xs font-medium text-slate-200 block truncate max-w-[170px]" title="digitalizacao@unicontacaruaru.com.br">
                digitalizacao@uniconta
              </span>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center gap-2">
            {onOpenSqlModal && (
              <button
                onClick={onOpenSqlModal}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                title="SQL Supabase"
              >
                <Database size={18} />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 px-4 pt-2 pb-4 space-y-1">
          {navItems.map(item => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => handleNavClick(item.route)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center px-3">
            <span>digitalizacao@unicontacaruaru.com.br</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-[11px]">v3.0.0</span>
          </div>
        </div>
      )}
    </header>
  );
};
