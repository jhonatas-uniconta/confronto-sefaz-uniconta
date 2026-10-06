import React from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { AppRoute } from './Sidebar';

interface TopHeaderProps {
  currentRoute: AppRoute;
  onOpenMobileSidebar: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentRoute,
  onOpenMobileSidebar,
  isSidebarCollapsed,
  onToggleSidebarCollapse
}) => {
  const routeTitles: Record<AppRoute, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Portal de Ferramentas Fiscais',
      subtitle: 'Painel Central Uniconta'
    },
    notas: {
      title: 'Confronto de Notas Fiscais',
      subtitle: 'Auditoria de NF-e Contábil x e-Fisco SEFAZ'
    },
    editais: {
      title: 'Confronto de Editais SEFAZ',
      subtitle: 'Intimações, Débitos e Descredenciamentos'
    },
    clientes: {
      title: 'Base de Clientes',
      subtitle: 'Gerenciamento de Contribuintes e IEs'
    },
    'historico-editais': {
      title: 'Histórico de Editais',
      subtitle: 'Consultas e Evidências Salvas'
    }
  };

  const currentInfo = routeTitles[currentRoute] || routeTitles.dashboard;

  return (
    <header className="bg-white border-b border-gray-200/80 sticky top-0 z-20 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Abrir menu"
          >
            <Menu size={20} />
          </button>

          {/* Desktop Sidebar Toggle Shortcut */}
          <button
            onClick={onToggleSidebarCollapse}
            className="hidden lg:flex p-1.5 -ml-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title={isSidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>

          <div className="border-l border-gray-200 pl-3 hidden sm:block">
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              {currentInfo.title}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {currentInfo.subtitle}
            </p>
          </div>

          <div className="sm:hidden">
            <span className="text-sm font-bold text-slate-900">
              {currentInfo.title}
            </span>
          </div>
        </div>

        {/* Right: Uniconta Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
            <ShieldCheck size={13} className="text-blue-600" />
            <span className="hidden sm:inline">Uniconta</span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span>Caruaru/PE</span>
          </div>
        </div>
      </div>
    </header>
  );
};
