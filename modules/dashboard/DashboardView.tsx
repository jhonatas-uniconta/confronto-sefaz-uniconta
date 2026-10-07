import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileCheck2, 
  Users, 
  History, 
  ArrowRight, 
  ExternalLink, 
  ShieldCheck, 
  Building2, 
  Sparkles 
} from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { AppRoute } from '../../components/Sidebar';
import { Cliente, ConsultaEdital } from '../../types';
import { getClients } from '../../services/clientService';
import { getConsultas } from '../../services/historyService';

interface DashboardViewProps {
  onNavigate: (route: AppRoute) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(true);
  const [history, setHistory] = useState<ConsultaEdital[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    getClients()
      .then((data) => {
        if (isMounted) {
          setClients(Array.isArray(data) ? data : []);
          setLoadingClients(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar clientes no Dashboard:', err);
        if (isMounted) {
          setClients([]);
          setLoadingClients(false);
        }
      });

    getConsultas()
      .then((data) => {
        if (isMounted) {
          setHistory(Array.isArray(data) ? data : []);
          setLoadingHistory(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar histórico no Dashboard:', err);
        if (isMounted) {
          setHistory([]);
          setLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const safeClients = Array.isArray(clients) ? clients : [];
  const activeClients = safeClients.filter(c => c && c.ativo !== false);
  const safeHistory = Array.isArray(history) ? history : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#151f32] to-[#1e293b] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-slate-800">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium mb-3 border border-blue-500/30">
            <ShieldCheck size={14} />
            <span>Ambiente Corporativo Uniconta – Caruaru & Agreste</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Ferramentas Fiscais – Uniconta
          </h1>
          <p className="mt-2.5 text-slate-300 text-sm sm:text-base leading-relaxed">
            Portal integrado de auditoria tributária e conformidade fiscal. Confronte registros contábeis com a SEFAZ-PE e monitore publicações de editais oficiais para salvaguardar a regularidade de nossos clientes.
          </p>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div>
            <span className="text-xs text-slate-400 block">Clientes Cadastrados</span>
            <span className="text-2xl font-bold text-white">
              {loadingClients ? '...' : safeClients.length}
            </span>
          </div>
          <div>
            <span className="text-xs text-emerald-400 block">Clientes Ativos</span>
            <span className="text-2xl font-bold text-emerald-400">
              {loadingClients ? '...' : activeClients.length}
            </span>
          </div>
          <div>
            <span className="text-xs text-blue-400 block">Editais Processados</span>
            <span className="text-2xl font-bold text-blue-300">
              {loadingHistory ? '...' : safeHistory.length}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Módulos Ativos</span>
            <span className="text-2xl font-bold text-white">2 Ferramentas</span>
          </div>
        </div>
      </div>

      {/* Main Tool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: Confronto de Notas Fiscais */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 sm:p-7 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileSpreadsheet size={26} />
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Operacional
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Confronto de Notas Fiscais
            </h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Confronte as notas fiscais lançadas no sistema contábil com os dados da SEFAZ. Realize conciliação de NF-e, identifique notas não lançadas, notas canceladas e exporte relatórios em PDF.
            </p>

            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="bg-slate-100 px-2 py-1 rounded">Excel (.xls, .xlsx)</span>
              <span className="bg-slate-100 px-2 py-1 rounded">HTML e-Fisco SEFAZ</span>
              <span className="bg-slate-100 px-2 py-1 rounded">Relatório PDF</span>
            </div>
          </div>

          <div className="mt-6 pt-4">
            <Button
              variant="primary"
              className="w-full justify-between"
              onClick={() => onNavigate('notas')}
            >
              <span>Acessar ferramenta</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        {/* CARD 2: Confronto de Editais SEFAZ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 sm:p-7 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-100/50 to-transparent pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileCheck2 size={26} />
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Sparkles size={12} />
                Novo Módulo
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              Confronto de Editais SEFAZ
            </h2>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Importe editais da SEFAZ-PE e identifique automaticamente clientes da Uniconta presentes nas publicações. Identifica intimações de IE, regularização de débitos e descredenciamentos com evidência em PDF.
            </p>

            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="bg-slate-100 px-2 py-1 rounded">PDFs SEFAZ-PE</span>
              <span className="bg-slate-100 px-2 py-1 rounded">Extração Automática de IE</span>
              <span className="bg-slate-100 px-2 py-1 rounded">Exportação Excel</span>
            </div>
          </div>

          <div className="mt-6 pt-4">
            <Button
              variant="secondary"
              className="w-full justify-between"
              onClick={() => onNavigate('editais')}
            >
              <span>Acessar ferramenta</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>

      </div>

      {/* Auxiliary Modules & Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div 
          onClick={() => onNavigate('clientes')}
          className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all flex items-start gap-4"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Users size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Base de Clientes</h3>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre, edite ou importe planilhas com CNPJs e IEs para cruzamento com os editais.
            </p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('historico-editais')}
          className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all flex items-start gap-4"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <History size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Histórico de Editais</h3>
            <p className="text-xs text-slate-500 mt-1">
              Consulte editais processados anteriormente e reabra resultados sem novo processamento.
            </p>
          </div>
        </div>

        <a 
          href="https://efisco.sefaz.pe.gov.br/"
          target="_blank"
          rel="noreferrer"
          className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all flex items-start gap-4"
        >
          <div className="p-3 bg-slate-100 text-slate-700 rounded-lg shrink-0">
            <ExternalLink size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-slate-900 text-sm">Portal e-Fisco SEFAZ</h3>
              <ExternalLink size={12} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Acesse o portal oficial da Fazenda de Pernambuco para baixar editais e notas fiscais.
            </p>
          </div>
        </a>
      </div>
    </div>
  );
};
