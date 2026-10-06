import React, { useState, useEffect } from 'react';
import { Sidebar, AppRoute } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './modules/dashboard/DashboardView';
import { ConfrontoNotasView } from './modules/notas/ConfrontoNotasView';
import { ConfrontoEditaisView } from './modules/editais/ConfrontoEditaisView';
import { ClientesView } from './modules/clientes/ClientesView';
import { HistoricoEditaisView } from './modules/historico/HistoricoEditaisView';
import { UnicontaLogo } from './components/ui';

// Re-export existing types and services to preserve full backward compatibility
export * from './types';
export * from './utils';
export { parseAccountingFile, parseSefazHtml, parseSefazFiles } from './services/parser';
export { exportToPdf } from './services/pdfService';
export { FileUpload, Button, Card, StatusBadge } from './components/ui';

export const App: React.FC = () => {
  // Determine initial route based on window pathname or hash
  const getInitialRoute = (): AppRoute => {
    if (typeof window === 'undefined') return 'dashboard';
    
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase().replace('#', '').replace('/', '');

    if (path.includes('notas') || hash.includes('notas')) return 'notas';
    if (path.includes('editais') || hash.includes('editais')) return 'editais';
    if (path.includes('clientes') || hash.includes('clientes')) return 'clientes';
    if (path.includes('historico') || hash.includes('historico')) return 'historico-editais';

    return 'dashboard';
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);
  
  // Collapsible sidebar state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('uniconta_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Toggle and save collapse state
  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('uniconta_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Sync route with browser history
  const handleRouteChange = (newRoute: AppRoute) => {
    setCurrentRoute(newRoute);
    const targetPath = newRoute === 'dashboard' ? '/' : `/${newRoute}`;
    
    try {
      window.history.pushState({ route: newRoute }, '', targetPath);
    } catch (e) {
      window.location.hash = newRoute === 'dashboard' ? '' : `#${newRoute}`;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listen to popstate and hashchange events
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Lateral Collapsible Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area with sleek minimal Top Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          currentRoute={currentRoute}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {currentRoute === 'dashboard' && (
            <DashboardView
              onNavigate={handleRouteChange}
            />
          )}

          {currentRoute === 'notas' && (
            <ConfrontoNotasView />
          )}

          {currentRoute === 'editais' && (
            <ConfrontoEditaisView />
          )}

          {currentRoute === 'clientes' && (
            <ClientesView />
          )}

          {currentRoute === 'historico-editais' && (
            <HistoricoEditaisView />
          )}
        </main>

        {/* Clean Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 text-xs text-gray-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UnicontaLogo className="h-4 w-auto text-slate-600" />
              <span className="font-semibold text-slate-700">Uniconta Assessoria Contabil</span>
              <span>•</span>
              <span className="text-slate-400">Portal de Ferramentas Fiscais</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-400">v3.0.0</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
