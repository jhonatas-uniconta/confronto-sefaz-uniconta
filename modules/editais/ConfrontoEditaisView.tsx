import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, Upload, Files, AlertTriangle, CheckCircle, 
  Download, Eye, FileText, RefreshCw, X, Info, Search, 
  Filter, Sparkles, Building2, ExternalLink
} from 'lucide-react';
import { 
  Cliente, 
  TipoEdital, 
  EditalMatchResult, 
  EditalProcessingStats,
  ConsultaEdital,
  MetodoIdentificacao
} from '../../types';
import { fetchActiveClientsForEdital } from '../../services/clientService';
import { processEditalPdf, PdfDocumentAnalysis, getMetodoBadge } from '../../services/pdfEditalService';
import { exportEditaisToExcel } from '../../services/excelService';
import { saveConsulta } from '../../services/historyService';
import { Card, Button, Modal } from '../../components/ui';
import { formatIE, formatCNPJ } from '../../utils';
import { PdfPageViewerModal } from '../../components/PdfPageViewerModal';

export const ConfrontoEditaisView: React.FC = () => {
  // Selected files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Analysis & Results State
  const [hasProcessed, setHasProcessed] = useState(false);
  const [analyses, setAnalyses] = useState<PdfDocumentAnalysis[]>([]);
  const [results, setResults] = useState<EditalMatchResult[]>([]);
  const [stats, setStats] = useState<EditalProcessingStats | null>(null);

  // Filters & Search in Results
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals
  const [selectedResultForDetails, setSelectedResultForDetails] = useState<EditalMatchResult | null>(null);
  const [viewerModalState, setViewerModalState] = useState<{
    isOpen: boolean;
    file?: File;
    page: number;
    highlight?: string;
    clientName?: string;
  }>({
    isOpen: false,
    page: 1
  });

  // Client database loaded directly from Supabase
  const [activeClients, setActiveClients] = useState<Cliente[]>([]);

  useEffect(() => {
    fetchActiveClientsForEdital()
      .then(list => setActiveClients(Array.isArray(list) ? list : []))
      .catch(err => {
        console.error('Erro ao buscar clientes ativos:', err);
        setActiveClients([]);
      });
  }, []);

  // Handle file drop / select
  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setError('Por favor, selecione arquivos em formato PDF.');
      return;
    }
    setError(null);
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(p => p.name));
      const newFiles = pdfs.filter(p => !existingNames.has(p.name));
      return [...prev, ...newFiles];
    });
    setHasProcessed(false);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setHasProcessed(false);
  };

  // Helper to generate a demo sample SEFAZ-PE PDF for immediate testing
  const handleLoadDemoPdf = () => {
    // Generate a minimal valid PDF with SEFAZ-PE Intimação layout testing all 3 identification levels:
    // 1. IE & CNPJ: Isabel Cristina Cavalcanti Rodrigues
    // 2. CNPJ (sem IE): Industria Metalurgica do Vale Ltda
    // 3. Razão Social (sem IE e sem CNPJ): Empresa ABC Servicos Ltda
    const sampleText = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 520 >> stream
BT
/F1 14 Tf
50 720 Td
(GOVERNO DO ESTADO DE PERNAMBUCO - SEFAZ-PE) Tj
/F1 12 Tf
0 -25 Td
(EDITAL DE INTIMACAO N. 037/2026 - ANTECIPACAO E REGULARIZACAO) Tj
/F1 10 Tf
0 -30 Td
(O Diretor de Fiscalizacao da SEFAZ-PE intima os contribuintes abaixo relacionados:) Tj
0 -30 Td
(0369429-10  10.316.742/0001-85  ISABEL CRISTINA CAVALCANTI RODRIGUES  CARUARU-PE) Tj
0 -20 Td
(18.765.432/0001-01  INDUSTRIA METALURGICA DO VALE LTDA  CARUARU-PE) Tj
0 -20 Td
(EMPRESA ABC SERVICOS LTDA  CARUARU-PE) Tj
0 -20 Td
(0999999-99  99.999.999/0001-99  OUTRO CONTRIBUINTE NAO CADASTRADO  RECIFE-PE) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000295 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
865
%%EOF`;

    const blob = new Blob([sampleText], { type: 'application/pdf' });
    const file = new File([blob], 'EDITAL_INTIMACAO_037_2026_SEFAZ_PE.pdf', { type: 'application/pdf' });
    setSelectedFiles([file]);
    setError(null);
    setHasProcessed(false);
  };

  // Main PDF Processing
  const handleProcessPdfs = async () => {
    if (selectedFiles.length === 0) {
      setError('Por favor, adicione pelo menos um PDF da SEFAZ para processar.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgressPercent(5);
    setProgressStep('Iniciando processamento...');

    try {
      const allAnalyses: PdfDocumentAnalysis[] = [];
      const allMatches: EditalMatchResult[] = [];
      let totalPages = 0;
      let totalIes = 0;

      // Buscar os clientes ativos diretamente do Supabase antes de iniciar o confronto
      setProgressStep('Consultando clientes ativos no Supabase...');
      const freshActiveClients = await fetchActiveClientsForEdital();
      const safeActiveClients = Array.isArray(freshActiveClients) ? freshActiveClients : [];
      setActiveClients(safeActiveClients);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgressStep(`Processando ${file.name} (${i + 1} de ${selectedFiles.length})...`);

        const analysis = await processEditalPdf(
          file,
          safeActiveClients,
          undefined,
          (step, pct) => {
            const overallPct = Math.round(((i / selectedFiles.length) * 100) + (pct / selectedFiles.length));
            setProgressPercent(overallPct);
            setProgressStep(`${file.name}: ${step}`);
          }
        );

        allAnalyses.push(analysis);
        allMatches.push(...analysis.matches);
        totalPages += analysis.totalPages;
        totalIes += analysis.totalIesEncontradas;

        // Auto-save each edital to history (Supabase)
        await saveConsulta({
          data: new Date().toISOString(),
          nome_arquivo: analysis.fileName,
          numero_edital: analysis.numeroEdital,
          tipo_documento: analysis.tipoEdital,
          quantidade_paginas: analysis.totalPages,
          quantidade_ies: analysis.totalIesEncontradas,
          quantidade_clientes_encontrados: analysis.matches.length,
          usuario: 'digitalizacao@unicontacaruaru.com.br',
          resultados: analysis.matches
        });
      }

      setAnalyses(allAnalyses);
      setResults(allMatches);

      // Unique clients matched
      const matchedClientIds = new Set(allMatches.map(m => m.inscricaoEstadual));

      setStats({
        totalPdfs: selectedFiles.length,
        totalPaginas: totalPages,
        totalIes: totalIes,
        clientesAtivos: activeClients.length,
        clientesEncontrados: matchedClientIds.size
      });

      setHasProcessed(true);
      setProgressPercent(100);
      setProgressStep('Processamento concluído com sucesso!');
    } catch (err: any) {
      console.error('Erro no processamento de editais:', err);
      setError(`Erro ao processar os arquivos PDF: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open viewer modal for specific page
  const handleOpenPageViewer = (match: EditalMatchResult) => {
    const file = selectedFiles.find(f => f.name === match.arquivo);
    setViewerModalState({
      isOpen: true,
      file: file,
      page: match.pagina,
      highlight: match.trechoOriginal,
      clientName: match.razaoSocial
    });
  };

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter(item => {
      const term = searchFilter.toLowerCase().trim();
      const matchesSearch = !term || (
        item.razaoSocial.toLowerCase().includes(term) ||
        (item.cnpj && item.cnpj.includes(term)) ||
        item.inscricaoEstadual.includes(term) ||
        item.inscricaoEstadualFormatada.includes(term) ||
        item.numeroEdital.toLowerCase().includes(term) ||
        item.arquivo.toLowerCase().includes(term) ||
        item.trechoOriginal.toLowerCase().includes(term)
      );

      const matchesType = typeFilter === 'all' || item.tipoEdital === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [results, searchFilter, typeFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 size={24} className="text-emerald-600" />
              Confronto de Editais SEFAZ-PE
            </h1>
            <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
              Intimações & Débitos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Importe publicações oficiais em PDF e cruze automaticamente as Inscrições Estaduais com a base da Uniconta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadDemoPdf}
            title="Carrega um edital de demonstração para testar sem precisar baixar arquivo"
          >
            <Sparkles size={14} className="text-amber-500" /> Carregar Edital Demo
          </Button>

          <a
            href="https://efisco.sefaz.pe.gov.br/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ExternalLink size={13} /> Editais SEFAZ-PE
          </a>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 animate-pulse text-sm">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-800 font-semibold">Atenção no Processamento</h4>
            <p className="text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Zone Card */}
      <Card
        title="1. Seleção dos Arquivos PDF da SEFAZ"
        subtitle="Permite múltiplos editais em formato .pdf pesquisável"
        icon={<Upload size={20} />}
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFilesSelected(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center hover:border-emerald-500 transition-all bg-slate-50/50 cursor-pointer"
            onClick={() => document.getElementById('editalPdfInput')?.click()}
          >
            <input
              id="editalPdfInput"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <FileText size={38} className="mx-auto text-emerald-600 mb-2 opacity-80" />
            <h3 className="font-semibold text-slate-800 text-sm">
              Arraste os PDFs da SEFAZ aqui
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ou clique para selecionar do computador
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-slate-700 shadow-2xs">
              <Files size={14} className="text-blue-600" />
              Selecionar Arquivos PDF
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
              <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-700 flex justify-between items-center">
                <span>Arquivos Selecionados ({selectedFiles.length})</span>
                <span className="text-slate-500 font-normal">Base de clientes ativa: <strong>{activeClients.length}</strong></span>
              </div>
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={16} className="text-red-500 shrink-0" />
                    <span className="font-medium text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-gray-400 font-mono">
                      ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(idx)}
                    disabled={isProcessing}
                    className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                    title="Remover arquivo"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="space-y-2 bg-blue-50 p-4 rounded-xl border border-blue-200 animate-pulse">
              <div className="flex justify-between items-center text-xs font-medium text-blue-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={14} className="animate-spin text-blue-600" />
                  {progressStep}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <div className="text-xs text-gray-500">
              * A leitura é 100% automatizada e verifica todas as páginas do documento.
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={handleProcessPdfs}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="w-full sm:w-auto min-w-[180px]"
            >
              <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
              {isProcessing ? 'Processando Documentos...' : 'Processar PDFs'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results & Confrontation View */}
      {hasProcessed && stats && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Summary KPI Cards */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">
              Resultado da Análise dos Editais
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
                <span className="text-xs text-slate-500 block">PDFs analisados</span>
                <span className="text-xl font-bold text-slate-800">{stats.totalPdfs}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
                <span className="text-xs text-slate-500 block">Páginas analisadas</span>
                <span className="text-xl font-bold text-slate-800">{stats.totalPaginas}</span>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-100">
                <span className="text-xs text-blue-600 block">Inscrições encontradas</span>
                <span className="text-xl font-bold text-blue-700">{stats.totalIes.toLocaleString('pt-BR')}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
                <span className="text-xs text-slate-500 block">Clientes ativos</span>
                <span className="text-xl font-bold text-slate-800">{stats.clientesAtivos}</span>
              </div>
              <div className={`p-3 rounded-lg text-center border ${
                stats.clientesEncontrados > 0 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <span className="text-xs block font-medium">Clientes encontrados</span>
                <span className="text-xl font-bold">
                  {stats.clientesEncontrados}
                </span>
              </div>
            </div>
          </div>

          {/* No Clients Found - Positive Green State */}
          {results.length === 0 && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-xl flex items-start gap-4">
              <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="text-emerald-900 font-bold text-base">
                  Nenhum cliente cadastrado foi localizado neste edital.
                </h3>
                <p className="text-emerald-800 text-sm mt-1">
                  Documento processado com sucesso. Todas as {stats.totalPaginas} páginas e {stats.totalIes} inscrições estaduais foram conferidas e nenhuma empresa da base ativa Uniconta consta com pendência nestas publicações.
                </p>
              </div>
            </div>
          )}

          {/* Clients Found - Detailed Table */}
          {results.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              {/* Header with Search and Export */}
              <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 text-base">
                    Clientes Identificados ({results.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clientes da Uniconta que constam nas publicações da SEFAZ
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por cliente, IE ou edital..."
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>

                  <select
                    className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">Todos os Editais</option>
                    <option value={TipoEdital.INTIMACAO_ANTECIPACAO}>Antecipação Tributária</option>
                    <option value={TipoEdital.DESCREDENCIAMENTO_ANTECIPACAO}>Descredenciamento</option>
                    <option value={TipoEdital.INTIMACAO_IE}>Intimação IE</option>
                  </select>

                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => exportEditaisToExcel(results)}
                  >
                    <Download size={14} /> Exportar Excel (.xlsx)
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Inscrição Estadual</th>
                      <th className="px-4 py-3">CNPJ</th>
                      <th className="px-4 py-3">Encontrado por</th>
                      <th className="px-4 py-3">Tipo do Edital</th>
                      <th className="px-4 py-3">Nº Edital</th>
                      <th className="px-4 py-3">Arquivo</th>
                      <th className="px-4 py-3 text-center">Página</th>
                      <th className="px-4 py-3">Evidência</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredResults.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${item.situacaoVisual.cor}`}>
                            {item.situacaoVisual.texto}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 max-w-[200px] truncate" title={item.razaoSocial}>
                          {item.razaoSocial}
                          {item.cliente?.nome_fantasia && (
                            <span className="block text-[11px] font-normal text-slate-500 truncate">
                              {item.cliente.nome_fantasia}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {item.clientesCandidatos ? (
                            <span className="text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Várias ({item.clientesCandidatos.length})
                            </span>
                          ) : item.inscricaoEstadual ? (
                            <span className="font-bold text-slate-800">{item.inscricaoEstadualFormatada}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Sem IE</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                          {item.clientesCandidatos ? (
                            <span className="text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Vários ({item.clientesCandidatos.length})
                            </span>
                          ) : item.cnpj ? (
                            formatCNPJ(item.cnpj)
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const badge = getMetodoBadge(item.encontradoPor);
                            return (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border font-medium ${badge.cor}`}>
                                {badge.texto}
                                {item.similaridade && item.similaridade < 1.0 && (
                                  <span className="text-[10px] opacity-80 font-mono">
                                    ({Math.round(item.similaridade * 100)}%)
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={item.tipoEdital}>
                          {item.tipoEdital}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800 whitespace-nowrap">
                          {item.numeroEdital}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={item.arquivo}>
                          {item.arquivo}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">
                          {item.pagina}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[240px] truncate font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-1 rounded" title={item.trechoOriginal}>
                            {item.trechoOriginal}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedResultForDetails(item)}
                            className="text-xs"
                          >
                            <Eye size={13} /> Ver detalhes
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {filteredResults.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                          Nenhum resultado corresponde aos filtros de busca aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Details Modal */}
      {selectedResultForDetails && (
        <Modal
          isOpen={Boolean(selectedResultForDetails)}
          onClose={() => setSelectedResultForDetails(null)}
          title="Detalhes da Notificação no Edital"
          subtitle={`Edital ${selectedResultForDetails.numeroEdital} – SEFAZ-PE`}
          icon={<FileText size={20} />}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Visual alert */}
            <div className={`p-3.5 rounded-lg border font-medium ${selectedResultForDetails.situacaoVisual.cor}`}>
              {selectedResultForDetails.situacaoVisual.texto}
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-gray-500 block">Razão Social:</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {selectedResultForDetails.razaoSocial}
                </span>
                {selectedResultForDetails.cliente?.nome_fantasia && (
                  <span className="text-slate-600 text-xs block">
                    {selectedResultForDetails.cliente.nome_fantasia}
                  </span>
                )}
              </div>

              <div>
                <span className="text-gray-500 block">Inscrição Estadual (IE):</span>
                <span className="font-mono font-bold text-slate-900 text-sm block mt-0.5">
                  {selectedResultForDetails.inscricaoEstadualFormatada}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">CNPJ:</span>
                <span className="font-mono text-slate-800 text-xs block mt-0.5">
                  {selectedResultForDetails.cnpj ? formatCNPJ(selectedResultForDetails.cnpj) : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Data do Processamento:</span>
                <span className="text-slate-800 text-xs block mt-0.5">
                  {new Date(selectedResultForDetails.dataProcessamento).toLocaleString('pt-BR')}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Tipo do Edital:</span>
                <span className="font-medium text-slate-800 text-xs block mt-0.5">
                  {selectedResultForDetails.tipoEdital}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Número do Edital:</span>
                <span className="font-mono font-bold text-slate-900 text-xs block mt-0.5">
                  {selectedResultForDetails.numeroEdital}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Arquivo PDF de Origem:</span>
                <span className="text-slate-800 text-xs block mt-0.5 truncate" title={selectedResultForDetails.arquivo}>
                  {selectedResultForDetails.arquivo}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Encontrado por:</span>
                <span className="font-semibold text-slate-900 text-xs block mt-0.5">
                  {selectedResultForDetails.encontradoPor}
                  {selectedResultForDetails.similaridade && selectedResultForDetails.similaridade < 1.0 && (
                    <span className="text-slate-500 font-normal ml-1">
                      ({Math.round(selectedResultForDetails.similaridade * 100)}% de similaridade)
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Localização no Documento:</span>
                <span className="font-bold text-blue-700 text-xs block mt-0.5">
                  Página {selectedResultForDetails.pagina}
                </span>
              </div>
            </div>

            {/* Candidate clients when ambiguous */}
            {selectedResultForDetails.clientesCandidatos && selectedResultForDetails.clientesCandidatos.length > 0 && (
              <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200">
                <div className="font-bold text-purple-900 text-xs mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-purple-600 shrink-0" />
                  <span>
                    Atenção: Existem {selectedResultForDetails.clientesCandidatos.length} empresas com esta mesma Razão Social cadastradas na base da Uniconta:
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedResultForDetails.clientesCandidatos.map((cand, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{cand.razao_social}</span>
                        {cand.nome_fantasia && <span className="text-slate-500 ml-1.5">({cand.nome_fantasia})</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-600">
                        <span>CNPJ: <strong>{cand.cnpj ? formatCNPJ(cand.cnpj) : 'Sem CNPJ'}</strong></span>
                        <span>IE: <strong>{cand.inscricao_estadual ? formatIE(cand.inscricao_estadual) : 'Sem IE'}</strong></span>
                        {cand.codigo && <span>Cód: {cand.codigo}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-purple-700 mt-2">
                  Como o edital não especificou CNPJ ou Inscrição Estadual, confirme visualmente na página do edital qual das empresas foi notificada.
                </p>
              </div>
            )}

            {/* Evidence snippet */}
            <div>
              <span className="font-semibold text-slate-800 block mb-1">
                Trecho Original Extraído do PDF (Evidência):
              </span>
              <pre className="bg-[#151f32] text-amber-300 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap break-all border border-slate-800 select-all">
                {selectedResultForDetails.trechoOriginal}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  handleOpenPageViewer(selectedResultForDetails);
                }}
              >
                <Eye size={14} /> Ver página no PDF
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedResultForDetails(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PDF Canvas Page Viewer Modal */}
      {viewerModalState.isOpen && (
        <PdfPageViewerModal
          isOpen={viewerModalState.isOpen}
          onClose={() => setViewerModalState(s => ({ ...s, isOpen: false }))}
          file={viewerModalState.file}
          pageNumber={viewerModalState.page}
          highlightText={viewerModalState.highlight}
          clientName={viewerModalState.clientName}
        />
      )}
    </div>
  );
};
