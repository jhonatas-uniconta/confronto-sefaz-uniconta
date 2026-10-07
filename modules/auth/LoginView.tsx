import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  Database, 
  Settings, 
  CheckCircle2, 
  ShieldCheck, 
  Loader2, 
  ServerCrash,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { UnicontaLogo } from '../../components/ui';
import { signInWithPassword } from '../../services/authService';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection 
} from '../../services/supabaseService';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supabase Configuration State (for Vercel or local fallback)
  const [config, setConfig] = useState(() => getSupabaseConfig());
  const [showConfigSettings, setShowConfigSettings] = useState(!config.isConfigured);
  const [inputUrl, setInputUrl] = useState(config.url || '');
  const [inputKey, setInputKey] = useState(config.anonKey || '');
  const [configFeedback, setConfigFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!config.isConfigured) {
      setErrorMessage('Configure a URL e a Anon Key do Supabase antes de realizar o login.');
      setShowConfigSettings(true);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage('Informe email e senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signInWithPassword(email, password);
      if (result.success) {
        onLoginSuccess();
      } else {
        setErrorMessage(result.error || 'Email ou senha incorretos.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível conectar ao servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigFeedback(null);

    const cleanUrl = inputUrl.trim();
    const cleanKey = inputKey.trim();

    if (!cleanUrl || !cleanKey) {
      setConfigFeedback({
        type: 'error',
        message: 'Preencha a URL do projeto e a chave anônima (Anon Key).'
      });
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setConfigFeedback({
        type: 'error',
        message: 'A URL do Supabase deve começar com https:// (ex: https://xyz.supabase.co).'
      });
      return;
    }

    saveSupabaseConfig(cleanUrl, cleanKey);
    const updated = getSupabaseConfig();
    setConfig(updated);

    // Test connection
    setTestingConnection(true);
    try {
      const testRes = await testSupabaseConnection();
      if (testRes.success) {
        setConfigFeedback({
          type: 'success',
          message: 'Conectado ao Supabase com sucesso!'
        });
        setErrorMessage(null);
      } else {
        setConfigFeedback({
          type: 'info',
          message: `Configuração salva. Nota: ${testRes.message}`
        });
      }
    } catch (err: any) {
      setConfigFeedback({
        type: 'info',
        message: 'Configuração salva no navegador.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-600/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-700/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl mb-3">
            <UnicontaLogo className="h-10 w-auto text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Confronta <span className="font-light text-slate-400">Uniconta</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-blue-400" />
            Portal Fiscal • Acesso Restrito a Colaboradores
          </p>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-[#1e293b]/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Unconfigured Alert Banner */}
          {!config.isConfigured && (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
                <span>Configuração do Supabase Necessária</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                As variáveis de ambiente (<code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">VITE_SUPABASE_URL</code> e <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">VITE_SUPABASE_ANON_KEY</code>) ainda não foram detectadas no ambiente.
              </p>
              <p className="text-slate-400">
                Preencha os dados abaixo para conectar seu banco de dados agora ou adicione as variáveis no painel da Vercel.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-950/70 border border-red-500/50 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-200 animate-in fade-in duration-200">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Main Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Corporativo
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@unicontacaruaru.com.br"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>

          {/* Admin Note */}
          <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-[11px] text-slate-400 leading-relaxed">
            Não há cadastro público. As contas de acesso são criadas e gerenciadas exclusivamente pelo administrador no painel do Supabase.
          </div>

          {/* Config Drawer / Vercel Helper */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowConfigSettings(!showConfigSettings)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Database size={14} className={config.isConfigured ? 'text-emerald-400' : 'text-amber-400'} />
                {config.isConfigured ? 'Supabase Conectado' : 'Configurar Conexão Supabase'}
              </span>
              {showConfigSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showConfigSettings && (
              <form onSubmit={handleSaveConfig} className="mt-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3 animate-in fade-in duration-150">
                <div className="text-[11px] text-slate-400 leading-tight">
                  Preencha os dados do seu projeto Supabase caso ainda não tenha configurado no painel da Vercel:
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Project URL (VITE_SUPABASE_URL)
                  </label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="block w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-600 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    API Anon Key (VITE_SUPABASE_ANON_KEY)
                  </label>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    className="block w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-600 focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                {configFeedback && (
                  <div className={`p-2 rounded-lg text-[11px] font-medium ${
                    configFeedback.type === 'success' 
                      ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300' 
                      : configFeedback.type === 'error'
                      ? 'bg-red-950/70 border border-red-500/50 text-red-300'
                      : 'bg-blue-950/70 border border-blue-500/50 text-blue-300'
                  }`}>
                    {configFeedback.message}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={testingConnection}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Testando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Salvar e Conectar</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Uniconta Assessoria Contábil • Caruaru/PE
        </div>
      </div>
    </div>
  );
};
