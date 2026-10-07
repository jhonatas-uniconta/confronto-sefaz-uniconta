import React, { useState, useEffect } from 'react';
import { 
  History, Calendar, FileText, Download, Eye, 
  Trash2, Search, Filter, AlertCircle, ArrowRight,
  Loader2, Database, Copy, Check, RefreshCw, Sparkles
} from 'lucide-react';
import { ConsultaEdital, EditalMatchResult } from '../../types';
import { 
  getConsultas, 
  getConsultaById, 
  deleteConsulta, 
  hasLocalHistoryToMigrate, 
  migrateLocalHistoryToSupabase 
} from '../../services/historyService';
import { 
  SUPABASE_HISTORICO_SQL_SCRIPT, 
  testSupabaseHistoricoConnection,
  isSupabaseConfigured 
} from '../../services/supabaseService';
import { exportEditaisToExcel } from '../../services/excelService';
import { Card, Button, Modal } from '../../components/ui';
import { formatIE, formatCNPJ } from '../../utils';

export const HistoricoEditaisView: React.FC = () => {
  const [consultas, setConsultas] = useState<ConsultaEdital[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Deleting and loading detail states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Modal for Viewing Reopened Results
  const [selectedConsulta, setSelectedConsulta] = useState<ConsultaEdital | null>(null);

  // Migration of local history to Supabase
  const [hasLocalMigration, setHasLocalMigration] = useState<boolean>(() => hasLocalHistoryToMigrate());
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  // Database verification & SQL Script Modal
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [tableStatus, setTableStatus] = useState<{ checked: boolean; exists: boolean; message: string } | null>(null);

  const fetchConsultas = async () => {
    setIsLoading(true);
    try {
      const data = await getConsultas();
      setConsultas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar histórico de editais:', err);
      setConsultas([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultas();

    // Checar se as tabelas do histórico existem no Supabase
    if (isSupabaseConfigured()) {
      testSupabaseHistoricoConnection()
        .then((res) => {
          setTableStatus({
            checked: true,
            exists: res.tablesExist,
            message: res.message
          });
        })
        .catch(() => {
          // Ignorar silenciosamente falhas transitórias
        });
    }
  }, []);

  const handleOpenResults = async (c: ConsultaEdital) => {
    // Se a consulta já possui os resultados carregados, abrir imediatamente
    if (Array.isArray(c.resultados) && c.resultados.length > 0) {
      setSelectedConsulta(c);
      return;
    }

    // Se possui clientes encontrados mas o array veio vazio pelo join, buscar detalhes
    if (c.quantidade_clientes_encontrados > 0) {
      setLoadingDetailId(c.id);
      try {
        const fullConsulta = await getConsultaById(c.id);
        if (fullConsulta) {
          setSelectedConsulta(fullConsulta);
          // Atualizar no estado local para futuras visualizações
          setConsultas(prev => prev.map(item => item.id === c.id ? fullConsulta : item));
        } else {
          setSelectedConsulta(c);
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes da consulta:', err);
        setSelectedConsulta(c);
      } finally {
        setLoadingDetailId(null);
      }
    } else {
      // Consulta sem clientes encontrados
      setSelectedConsulta(c);
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (window.confirm(`Deseja remover o registro de "${fileName}" do histórico do Supabase?`)) {
      setDeletingId(id);
      try {
        const success = await deleteConsulta(id);
        if (success) {
          setConsultas(prev => prev.filter(c => c.id !== id));
        } else {
          alert('Não foi possível excluir o registro. Verifique a conexão com o Supabase.');
        }
      } catch (e: any) {
        console.error('Erro ao excluir consulta:', e);
        alert(`Erro ao excluir: ${e.message || e}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm('Deseja migrar todos os editais salvos localmente neste navegador para o Supabase?')) {
      return;
    }

    setIsMigrating(true);
    setMigrationMessage(null);
    try {
      const res = await migrateLocalHistoryToSupabase();
      if (res.success) {
        setMigrationMessage(`Sucesso! ${res.migratedCount} consultas foram transferidas com sucesso para o Supabase.`);
        setHasLocalMigration(false);
        await fetchConsultas();
      } else {
        setMigrationMessage(`Aviso: ${res.error || 'Ocorreu um erro durante a migração.'}`);
      }
    } catch (err: any) {
      setMigrationMessage(`Erro: ${err.message || 'Falha ao migrar histórico.'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_HISTORICO_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const safeConsultas = Array.isArray(consultas) ? consultas : [];
  const filteredConsultas = safeConsultas.filter(c => {
    if (!c) return false;
    const term = searchTerm.toLowerCase();
    return (
      (c.nome_arquivo && c.nome_arquivo.toLowerCase().includes(term)) ||
      (c.numero_edital && c.numero_edital.toLowerCase().includes(term)) ||
      (c.tipo_documento && c.tipo_documento.toLowerCase().includes(term)) ||
      (c.usuario && c.usuario.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <History size={22} className="text-blue-600" />
              Histórico de Confrontos de Editais
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Database size={11} />
              Base Centralizada Supabase
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consultas armazenadas e compartilhadas na nuvem para auditoria, relatórios e conferência sem necessidade de reprocessar os PDFs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsSqlModalOpen(true)}
            title="Ver script SQL das tabelas de histórico do Supabase"
          >
            <Database size={14} className="text-blue-600" />
            <span className="hidden sm:inline">Script SQL</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchConsultas}
            disabled={isLoading}
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          <div className="relative w-full sm:w-60">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por arquivo ou edital..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Banner se tabelas do Supabase precisarem ser criadas */}
      {tableStatus && !tableStatus.exists && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-semibold">Tabelas de Histórico no Supabase</strong>
              <span>As tabelas <code>consultas_editais</code> e <code>resultados_editais</code> precisam ser criadas no Supabase SQL Editor.</span>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSqlModalOpen(true)}
            className="shrink-0"
          >
            <Copy size={13} />
            Ver Script de Criação
          </Button>
        </div>
      )}

      {/* Banner de migração de histórico local */}
      {hasLocalMigration && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-semibold">Migração para a Base Centralizada</strong>
              <span>Detectamos históricos gravados neste navegador antes da migração. Deseja sincronizá-los com o Supabase?</span>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleMigrate}
            disabled={isMigrating}
            className="shrink-0"
          >
            {isMigrating ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
            {isMigrating ? 'Migrando...' : 'Migrar para o Supabase'}
          </Button>
        </div>
      )}

      {migrationMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center justify-between">
          <span>{migrationMessage}</span>
          <button 
            onClick={() => setMigrationMessage(null)} 
            className="text-emerald-700 font-bold ml-2 cursor-pointer hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 select-none">
              <tr>
                <th className="px-4 py-3">Data e Hora</th>
                <th className="px-4 py-3">Arquivo PDF</th>
                <th className="px-4 py-3">Nº Edital</th>
                <th className="px-4 py-3">Tipo do Documento</th>
                <th className="px-4 py-3 text-center">Páginas</th>
                <th className="px-4 py-3 text-center">IEs Lidas</th>
                <th className="px-4 py-3 text-center">Clientes Encontrados</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-blue-600" />
                      <span className="text-xs text-slate-500">Carregando histórico do Supabase...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredConsultas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {new Date(c.data || c.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate" title={c.nome_arquivo}>
                        {c.nome_arquivo}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {c.numero_edital || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate" title={c.tipo_documento}>
                        {c.tipo_documento}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {c.quantidade_paginas}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {c.quantidade_ies.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                          c.quantidade_clientes_encontrados > 0 
                            ? 'bg-amber-100 text-amber-900' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.quantidade_clientes_encontrados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[130px]" title={c.usuario}>
                        {c.usuario ? c.usuario.split('@')[0] : 'Operador'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenResults(c)}
                            disabled={loadingDetailId === c.id}
                            title="Reabrir resultados encontrados"
                          >
                            {loadingDetailId === c.id ? (
                              <Loader2 size={13} className="animate-spin text-blue-600" />
                            ) : (
                              <Eye size={13} />
                            )}
                            Ver resultado
                          </Button>
                          <button
                            onClick={() => handleDelete(c.id, c.nome_arquivo)}
                            disabled={deletingId === c.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 cursor-pointer"
                            title="Excluir do Histórico"
                          >
                            {deletingId === c.id ? (
                              <Loader2 size={15} className="animate-spin text-red-600" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredConsultas.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        Nenhum registro de consulta encontrado no histórico.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View Consultation Results */}
      {selectedConsulta && (
        <Modal
          isOpen={Boolean(selectedConsulta)}
          onClose={() => setSelectedConsulta(null)}
          title={`Resultado Histórico: ${selectedConsulta.nome_arquivo}`}
          subtitle={`Edital ${selectedConsulta.numero_edital || '-'} – Processado em ${new Date(selectedConsulta.data || selectedConsulta.created_at).toLocaleString('pt-BR')}`}
          icon={<History size={20} />}
          maxWidth="5xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span>Tipo: <strong>{selectedConsulta.tipo_documento}</strong></span> •{' '}
                <span>Total Páginas: <strong>{selectedConsulta.quantidade_paginas}</strong></span> •{' '}
                <span>Total IEs: <strong>{selectedConsulta.quantidade_ies.toLocaleString('pt-BR')}</strong></span> •{' '}
                <span>Clientes Encontrados: <strong>{selectedConsulta.quantidade_clientes_encontrados}</strong></span>
              </div>
              {selectedConsulta.resultados && selectedConsulta.resultados.length > 0 && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => exportEditaisToExcel(selectedConsulta.resultados, `historico_${(selectedConsulta.numero_edital || 'consulta').replace('/', '_')}.xlsx`)}
                >
                  <Download size={13} /> Exportar Excel
                </Button>
              )}
            </div>

            {selectedConsulta.resultados && selectedConsulta.resultados.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-[50vh]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Situação</th>
                      <th className="px-4 py-2.5">Cliente</th>
                      <th className="px-4 py-2.5">Inscrição Estadual</th>
                      <th className="px-4 py-2.5">CNPJ</th>
                      <th className="px-4 py-2.5">Encontrado por</th>
                      <th className="px-4 py-2.5 text-center">Página</th>
                      <th className="px-4 py-2.5">Trecho Encontrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedConsulta.resultados.map((res, i) => (
                      <tr key={res.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${res.situacaoVisual?.cor || 'bg-amber-50 text-amber-800'}`}>
                            {res.situacaoVisual?.texto || 'Localizado'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {res.razaoSocial}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-800">
                          {res.inscricaoEstadual ? (
                            <span className="font-bold">{res.inscricaoEstadualFormatada || formatIE(res.inscricaoEstadual)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Sem IE</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-600">
                          {res.cnpj ? formatCNPJ(res.cnpj) : '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                            {res.encontradoPor || 'Inscrição Estadual'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-blue-700">
                          {res.pagina}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-1 rounded block max-w-sm truncate" title={res.trechoOriginal}>
                            {res.trechoOriginal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-gray-200">
                Nenhum cliente cadastrado constava neste edital quando foi processado.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <Button variant="primary" onClick={() => setSelectedConsulta(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: SQL Script do Histórico */}
      {isSqlModalOpen && (
        <Modal
          isOpen={isSqlModalOpen}
          onClose={() => setIsSqlModalOpen(false)}
          title="Script SQL do Histórico de Editais (Supabase)"
          subtitle="Tabelas consultas_editais e resultados_editais com RLS e índices"
          icon={<Database size={20} className="text-blue-600" />}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Execute o script abaixo no <strong>SQL Editor</strong> do seu painel Supabase para criar as tabelas do histórico caso ainda não tenham sido criadas:
            </p>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 font-mono text-[11px] p-4 rounded-xl overflow-x-auto max-h-[50vh] leading-relaxed">
                {SUPABASE_HISTORICO_SQL_SCRIPT}
              </pre>
              <button
                onClick={handleCopySql}
                className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                {copiedSql ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setIsSqlModalOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
