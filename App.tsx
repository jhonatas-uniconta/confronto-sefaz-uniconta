import React, { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { Sidebar, AppRoute } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './modules/dashboard/DashboardView';
import { ConfrontoNotasView } from './modules/notas/ConfrontoNotasView';
import { ConfrontoEditaisView } from './modules/editais/ConfrontoEditaisView';
import { ClientesView } from './modules/clientes/ClientesView';
import { HistoricoEditaisView } from './modules/historico/HistoricoEditaisView';
import { LoginView } from './modules/auth/LoginView';
import { SystemConfigMissing } from './components/SystemConfigMissing';
import { UnicontaLogo } from './components/ui';
import { getSupabaseClient, isSupabaseConfigured } from './services/supabaseService';
import { getInitialSession, signOut } from './services/authService';

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

    if (path.includes('login') || hash.includes('login')) return 'login';
    if (path.includes('notas') || hash.includes('notas')) return 'notas';
    if (path.includes('editais') || hash.includes('editais')) return 'editais';
    if (path.includes('clientes') || hash.includes('clientes')) return 'clientes';
    if (path.includes('historico') || hash.includes('historico')) return 'historico-editais';

    return 'dashboard';
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);
  
  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

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

  // Handle Logout
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('Erro durante signOut:', e);
    } finally {
      setUser(null);
      setSession(null);
      handleRouteChange('login');
    }
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

  // Initialize and observe Supabase Auth session
  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        const client = getSupabaseClient();
        if (!client) {
          // Supabase não configurado ainda
          if (isMounted) {
            setUser(null);
            setSession(null);
            setAuthLoading(false);
          }
          return;
        }

        // 1. Obter sessão atual
        const { session: currentSession, user: currentUser } = await getInitialSession();
        if (isMounted) {
          setSession(currentSession);
          setUser(currentUser);
          setAuthLoading(false);

          if (currentUser && currentRoute === 'login') {
            handleRouteChange('dashboard');
          } else if (!currentUser && currentRoute !== 'login') {
            handleRouteChange('login');
          }
        }

        // 2. Ouvir mudanças no estado de autenticação
        const { data } = client.auth.onAuthStateChange((event, newSession) => {
          if (!isMounted) return;

          setSession(newSession);
          setUser(newSession?.user || null);
          setAuthLoading(false);

          if (event === 'SIGNED_IN' && newSession?.user) {
            if (currentRoute === 'login') {
              handleRouteChange('dashboard');
            }
          } else if (event === 'SIGNED_OUT') {
            handleRouteChange('login');
          }
        });

        authSubscription = data.subscription;
      } catch (err) {
        console.error('Falha ao inicializar autenticação Supabase:', err);
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  // 0. Se as variáveis de ambiente do Supabase não estiverem configuradas no Vercel
  if (!isSupabaseConfigured()) {
    return <SystemConfigMissing />;
  }

  // 1. Loading screen while checking session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="p-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-xl mb-4">
          <UnicontaLogo className="h-10 w-auto text-white animate-pulse" />
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-300 font-medium">
          <Loader2 size={18} className="animate-spin text-blue-500" />
          <span>Verificando sessão...</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Portal de Ferramentas Fiscais • Uniconta Assessoria
        </p>
      </div>
    );
  }

  // 2. If user is not authenticated, render Login screen
  if (!user || currentRoute === 'login') {
    return (
      <LoginView
        onLoginSuccess={() => handleRouteChange('dashboard')}
      />
    );
  }

  // 3. Authenticated Application
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
        userEmail={user.email}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area with sleek Top Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          currentRoute={currentRoute}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
          userEmail={user.email}
          onSignOut={handleSignOut}
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
              <span className="font-semibold text-slate-700">Uniconta Assessoria Contábil</span>
              <span>•</span>
              <span className="text-slate-400">Portal de Ferramentas Fiscais</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400">Logado como: <strong className="text-slate-600">{user.email}</strong></span>
              <span>•</span>
              <span className="font-mono text-slate-400">v3.1.0</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
