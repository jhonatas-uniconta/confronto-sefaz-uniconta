import React from 'react';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { UnicontaLogo } from './ui';

export const SystemConfigMissing: React.FC = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-600/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-700/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 text-center">
        {/* Brand Header */}
        <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl inline-block mb-4">
          <UnicontaLogo className="h-10 w-auto text-white" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-white mb-1">
          Confronta <span className="font-light text-slate-400">Uniconta</span>
        </h1>
        <p className="text-xs text-slate-400 mb-6 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-blue-400" />
          Portal de Ferramentas Fiscais
        </p>

        {/* Friendly Notice Card */}
        <div className="bg-[#1e293b]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">
              Configuração do sistema incompleta.
            </h2>
            <p className="text-sm text-slate-300 font-medium">
              Entre em contato com o administrador.
            </p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed pt-2">
            As variáveis de ambiente do servidor são necessárias para a inicialização dos serviços fiscais e autenticação segura.
          </p>

          <div className="pt-3">
            <button
              type="button"
              onClick={handleReload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors border border-slate-700 cursor-pointer shadow-md"
            >
              <RefreshCw size={14} />
              <span>Verificar novamente</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Uniconta Assessoria Contábil • Caruaru/PE
        </div>
      </div>
    </div>
  );
};
