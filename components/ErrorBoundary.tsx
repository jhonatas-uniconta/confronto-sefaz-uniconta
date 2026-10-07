import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('uniconta_supabase_url');
      localStorage.removeItem('uniconta_supabase_anon_key');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Erro ao limpar storage:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
          <div className="max-w-lg w-full bg-[#1e293b] border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 text-amber-400">
              <AlertTriangle size={32} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {this.props.fallbackTitle || 'Ocorreu uma instabilidade na aplicação'}
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              O sistema encontrou um erro inesperado durante o carregamento. Não se preocupe, seus dados estão protegidos.
            </p>

            {this.state.error && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-left mb-6 font-mono text-xs text-red-400 overflow-x-auto max-h-36">
                <span className="font-semibold text-slate-400 block mb-1">Mensagem do erro:</span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <RefreshCw size={16} />
                Recarregar Sistema
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-sm transition-colors border border-slate-700 cursor-pointer"
              >
                <Trash2 size={16} />
                Reiniciar Configurações
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldAlert size={14} />
              <span>Uniconta Assessoria Contábil • Portal Fiscal</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
