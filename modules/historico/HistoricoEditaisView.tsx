import React, { useState } from 'react';
import { 
  History, Calendar, FileText, Download, Eye, 
  Trash2, Search, Filter, AlertCircle, ArrowRight 
} from 'lucide-react';
import { ConsultaEdital, EditalMatchResult } from '../../types';
import { getConsultas, deleteConsulta } from '../../services/historyService';
import { exportEditaisToExcel } from '../../services/excelService';
import { Card, Button, Modal } from '../../components/ui';
import { formatIE, formatCNPJ } from '../../utils';

export const HistoricoEditaisView: React.FC = () => {
  const [consultas, setConsultas] = useState<ConsultaEdital[]>(() => getConsultas());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal for Viewing Reopened Results
  const [selectedConsulta, setSelectedConsulta] = useState<ConsultaEdital | null>(null);
  const [selectedResultDetails, setSelectedResultDetails] = useState<EditalMatchResult | null>(null);

  const refreshHistory = () => {
    setConsultas(getConsultas());
  };

  const handleDelete = (id: string, fileName: string) => {
    if (window.confirm(`Deseja remover o registro de "${fileName}" do histórico?`)) {
      deleteConsulta(id);
      refreshHistory();
    }
  };

  const filteredConsultas = consultas.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.nome_arquivo.toLowerCase().includes(term) ||
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
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History size={22} className="text-blue-600" />
            Histórico de Confrontos de Editais
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consultas armazenadas para auditoria, relatórios e conferência sem necessidade de reprocessar os PDFs.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
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
              {filteredConsultas.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(c.data).toLocaleString('pt-BR')}
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
                    {c.usuario.split('@')[0]}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedConsulta(c)}
                        title="Reabrir resultados encontrados"
                      >
                        <Eye size={13} /> Ver resultado
                      </Button>
                      <button
                        onClick={() => handleDelete(c.id, c.nome_arquivo)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir do Histórico"
                      >
                        <Trash2 size={15} />
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
          subtitle={`Edital ${selectedConsulta.numero_edital} – Processado em ${new Date(selectedConsulta.data).toLocaleString('pt-BR')}`}
          icon={<History size={20} />}
          maxWidth="5xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span>Tipo: <strong>{selectedConsulta.tipo_documento}</strong></span> •{' '}
                <span>Total Páginas: <strong>{selectedConsulta.quantidade_paginas}</strong></span> •{' '}
                <span>Total IEs: <strong>{selectedConsulta.quantidade_ies}</strong></span>
              </div>
              {selectedConsulta.resultados && selectedConsulta.resultados.length > 0 && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => exportEditaisToExcel(selectedConsulta.resultados, `historico_${selectedConsulta.numero_edital.replace('/', '_')}.xlsx`)}
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
                      <th className="px-4 py-2.5 text-center">Página</th>
                      <th className="px-4 py-2.5">Trecho Encontrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedConsulta.resultados.map((res, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${res.situacaoVisual?.cor || 'bg-amber-50 text-amber-800'}`}>
                            {res.situacaoVisual?.texto || 'Localizado'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {res.razaoSocial}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-800">
                          {res.inscricaoEstadualFormatada || formatIE(res.inscricaoEstadual)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-600">
                          {res.cnpj ? formatCNPJ(res.cnpj) : '-'}
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
              <div className="p-8 text-center text-gray-500 bg-slate-50 rounded-lg">
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
    </div>
  );
};
