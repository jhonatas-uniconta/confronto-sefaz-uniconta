import React, { useState, useMemo, useEffect } from 'react';
import { FileText, ExternalLink, Download, RefreshCw, AlertTriangle, LayoutDashboard, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, PlayCircle, X } from 'lucide-react';
import { parseAccountingFile, parseSefazFiles } from './services/parser';
import { exportToPdf } from './services/pdfService';
import { AccountingRecord, SefazRecord, ComparisonResult, MatchStatus, SummaryStats } from './types';
import { FileUpload, Button, Card, StatusBadge } from './components/ui';
import { extractDateFromKey } from './utils';

// Logo Component replicating the provided image (3x4 grid, skewed)
const UnicontaLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="skewX(-20)">
        {/* Row 1 (Top) */}
        <rect x="70" y="10" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="115" y="10" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="160" y="10" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="205" y="10" width="35" height="35" rx="4" fill="currentColor" />

        {/* Row 2 (Middle) */}
        <rect x="55" y="55" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="100" y="55" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="145" y="55" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="190" y="55" width="35" height="35" rx="4" fill="currentColor" />

        {/* Row 3 (Bottom) */}
        <rect x="40" y="100" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="85" y="100" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="130" y="100" width="35" height="35" rx="4" fill="currentColor" />
        <rect x="175" y="100" width="35" height="35" rx="4" fill="currentColor" />
    </g>
  </svg>
);

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: keyof ComparisonResult | 'status';
  direction: SortDirection;
}

const App: React.FC = () => {
  // State
  const [accountingData, setAccountingData] = useState<AccountingRecord[]>([]);
  const [sefazData, setSefazData] = useState<SefazRecord[]>([]);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isCompared, setIsCompared] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Sorting State
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  
  // File names for UI feedback
  const [accountingFileName, setAccountingFileName] = useState('');
  const [sefazFileName, setSefazFileName] = useState('');
  
  // Errors
  const [error, setError] = useState<string | null>(null);

  // Tutorial Modal State
  const [showTutorial, setShowTutorial] = useState(false);

  // Filters
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Handlers
  const handleAccountingUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0]; // Accounting usually one file
    try {
      setError(null);
      const data = await parseAccountingFile(file);
      setAccountingData(data);
      setAccountingFileName(file.name);
      setIsCompared(false); // Reset comparison if new file
    } catch (err: any) {
      setError(`Erro no arquivo contábil: ${err.message}`);
    }
  };

  const handleSefazUpload = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      setError(null);
      const data = await parseSefazFiles(files);
      setSefazData(data);
      setSefazFileName(files.length > 1 ? `${files.length} arquivos selecionados` : files[0].name);
      setIsCompared(false);
    } catch (err: any) {
      setError(`Erro nos arquivos SEFAZ: ${err.message}`);
    }
  };

  const handleCompare = () => {
    if (accountingData.length === 0 || sefazData.length === 0) {
      setError("Por favor, carregue ambos os arquivos antes de confrontar.");
      return;
    }

    // Create a typed Map for efficient lookups
    const mapAccounting = new Map<string, AccountingRecord>();
    accountingData.forEach(item => {
      if (item.chave) {
        mapAccounting.set(item.chave, item);
      }
    });
    
    const comparison: ComparisonResult[] = [];

    // Iterate Sefaz records (Authority)
    // We ONLY care about records present in SEFAZ as requested.
    sefazData.forEach(sefaz => {
      const match = mapAccounting.get(sefaz.chave);
      let status = MatchStatus.MISSING_IN_ACCOUNTING;

      if (sefaz.situacao.toLowerCase().includes('cancelada')) {
        status = MatchStatus.CANCELLED;
      } else if (match) {
        status = MatchStatus.MATCHED;
      }

      comparison.push({
        id: sefaz.chave,
        chave: sefaz.chave,
        numero: sefaz.numero,
        serie: sefaz.serie,
        // Use extracted date if still missing from parser
        data: sefaz.data || extractDateFromKey(sefaz.chave),
        valor: match ? match.valor : 0, 
        situacaoSefaz: sefaz.situacao,
        status: status,
        sefazRecord: sefaz,
        accountingRecord: match
      });
    });

    setResults(comparison);
    setIsCompared(true);
    setCurrentPage(1); // Reset to page 1 on new comparison
  };

  const handleExportPDF = (onlyPending: boolean) => {
    const dataToExport = onlyPending 
      ? results.filter(r => r.status === MatchStatus.MISSING_IN_ACCOUNTING && !r.situacaoSefaz.toLowerCase().includes('cancelada'))
      : results;
    
    exportToPdf(dataToExport, onlyPending ? 'Relatório de Pendências (Não Lançadas)' : 'Relatório Completo de Confronto');
  };

  const handleSort = (key: keyof ComparisonResult) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterText, statusFilter]);

  // Stats
  const stats: SummaryStats = useMemo(() => {
    const s = {
      total: results.length,
      matched: 0,
      missingInAccounting: 0,
      cancelled: 0,
      others: 0
    };
    results.forEach(r => {
      if (r.status === MatchStatus.MATCHED) s.matched++;
      else if (r.status === MatchStatus.MISSING_IN_ACCOUNTING) s.missingInAccounting++;
      else if (r.status === MatchStatus.CANCELLED) s.cancelled++;
      else s.others++;
    });
    return s;
  }, [results]);

  // Filtered AND Sorted Table Data
  const processedResults = useMemo(() => {
    // 1. Filter
    let data = results.filter(r => {
        const matchesText = 
          r.numero?.toLowerCase().includes(filterText.toLowerCase()) || 
          r.chave?.includes(filterText) ||
          r.situacaoSefaz?.toLowerCase().includes(filterText.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    
        return matchesText && matchesStatus;
      });

    // 2. Sort
    if (sortConfig) {
      data = [...data].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle Dates (DD/MM/YYYY)
        if (sortConfig.key === 'data') {
           const parseDate = (dateStr: any) => {
               if (!dateStr || typeof dateStr !== 'string') return 0;
               const parts = dateStr.split('/');
               if (parts.length !== 3) return 0;
               return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
           };
           const dateA = parseDate(aValue);
           const dateB = parseDate(bValue);
           
           if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
           if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
           return 0;
        }

        // Handle numeric strings in numero/serie if possible, else string compare
        if (aValue === bValue) return 0;

        // General String/Number compare
        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [results, filterText, statusFilter, sortConfig]);

  // Pagination Logic (Applied AFTER sort)
  const totalPages = Math.ceil(processedResults.length / itemsPerPage);
  const paginatedData = processedResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const startRecordIndex = (currentPage - 1) * itemsPerPage + 1;
  const endRecordIndex = Math.min(currentPage * itemsPerPage, processedResults.length);

  // Helper for Sort Icons
  const SortIcon = ({ column }: { column: keyof ComparisonResult }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="text-gray-400 opacity-50 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600 ml-1" />
      : <ArrowDown size={14} className="text-blue-600 ml-1" />;
  };

  // Helper for Header Click
  const ThSortable = ({ label, column }: { label: string, column: keyof ComparisonResult }) => (
    <th 
        className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
        onClick={() => handleSort(column)}
    >
        <div className="flex items-center gap-1">
            {label}
            <SortIcon column={column} />
        </div>
    </th>
  );

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <header className="bg-slate-850 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <UnicontaLogo className="h-8 w-auto text-white" />
                <span>
                  Confronta <span className="font-normal text-slate-300 ml-1">by Uniconta</span>
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-1 ml-1">Ferramenta de Auditoria e Confronto Contábil x SEFAZ</p>
            </div>
            <div className="text-right hidden sm:block">
              <span className="bg-slate-700 px-3 py-1 rounded text-xs font-mono text-slate-300">v2.3.0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* Error Banner */}
        {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 animate-pulse">
                <AlertTriangle className="text-red-500 shrink-0" />
                <div>
                    <h3 className="text-red-800 font-semibold">Atenção</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            </div>
        )}

        {/* Input Section - Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1 */}
            <Card title="1. Arquivo Contábil" subtitle="Excel (.xls, .xlsx, .csv)" icon={<FileText size={20} />}>
                <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-semibold text-gray-700 hidden">Upload</span>
                    <button 
                        onClick={() => setShowTutorial(true)} 
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors ml-auto mb-2"
                    >
                        <PlayCircle size={14} />
                        Como exportar?
                    </button>
                </div>

                <FileUpload 
                    label="Selecione a exportação do sistema" 
                    accept=".xls,.xlsx,.csv" 
                    onFileSelect={handleAccountingUpload}
                    fileName={accountingFileName}
                />
                <div className="text-xs text-gray-500 mt-2 bg-yellow-50 p-2 rounded border border-yellow-100">
                    <strong>Importante:</strong> Na exportação selecione a opção: <em>Planilha com Cabeçalho</em>.
                </div>
            </Card>

            {/* Step 2 */}
            <Card title="2. Arquivo(s) SEFAZ" subtitle="HTML Exportado do e-Fisco" icon={<ExternalLink size={20} />}>
                 <div className="mb-4">
                    <a 
                        href="https://efisco.sefaz.pe.gov.br/" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center justify-center gap-2 w-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 font-medium py-2 px-4 rounded-lg transition-all mb-4 text-sm"
                    >
                        <ExternalLink size={16}/> Acessar e-Fisco (SEFAZ-PE)
                    </a>
                    
                    <FileUpload 
                        label="Selecione o(s) arquivo(s) HTML" 
                        accept=".html,.htm" 
                        onFileSelect={handleSefazUpload}
                        fileName={sefazFileName}
                        multiple={true}
                    />
                     <div className="text-xs text-gray-400 mt-2">
                        Permite múltiplos arquivos (duplicatas serão removidas)
                    </div>
                 </div>
            </Card>

            {/* Step 3 */}
            <Card title="3. Confronto" subtitle="Processar Dados" icon={<RefreshCw size={20} />}>
                <div className="flex flex-col justify-center h-full space-y-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Contábil: <strong>{accountingData.length}</strong> regs</span>
                        <span>SEFAZ: <strong>{sefazData.length}</strong> regs</span>
                    </div>
                    <Button 
                        onClick={handleCompare} 
                        disabled={accountingData.length === 0 || sefazData.length === 0}
                        className="w-full"
                        variant="secondary"
                    >
                        Executar Confronto
                    </Button>
                </div>
            </Card>
        </div>

        {/* Results Section */}
        {isCompared && (
            <div className="animate-fade-in space-y-6">
                
                {/* Dashboard Stats */}
                <div className="w-full bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <LayoutDashboard size={20} className="text-slate-500"/> Resumo do Período
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <div className="text-sm text-gray-500">Total Analisado</div>
                            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-lg text-center">
                            <div className="text-sm text-emerald-600 font-medium">Lançadas</div>
                            <div className="text-2xl font-bold text-emerald-700">{stats.matched}</div>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg text-center">
                            <div className="text-sm text-red-600 font-medium">Faltantes</div>
                            <div className="text-2xl font-bold text-red-700">{stats.missingInAccounting}</div>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg text-center">
                            <div className="text-sm text-orange-600 font-medium">Canceladas</div>
                            <div className="text-2xl font-bold text-orange-700">{stats.cancelled}</div>
                        </div>
                    </div>
                </div>

                {/* Main Table Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h2 className="font-semibold text-lg text-gray-800">Detalhamento</h2>
                        
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <input 
                                type="text" 
                                placeholder="Buscar nota, chave..." 
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                            <select 
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">Todos os Status</option>
                                <option value={MatchStatus.MATCHED}>Lançadas</option>
                                <option value={MatchStatus.MISSING_IN_ACCOUNTING}>Não Lançadas</option>
                                <option value={MatchStatus.CANCELLED}>Canceladas</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <ThSortable label="Número" column="numero" />
                                    <ThSortable label="Série" column="serie" />
                                    <ThSortable label="Data" column="data" />
                                    <ThSortable label="Chave de Acesso" column="chave" />
                                    <ThSortable label="Situação SEFAZ" column="situacaoSefaz" />
                                    <ThSortable label="Status" column="status" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedData.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-gray-900">{item.numero}</td>
                                        <td className="px-6 py-3 text-gray-600">{item.serie}</td>
                                        <td className="px-6 py-3 text-gray-600">{item.data}</td>
                                        <td className="px-6 py-3">
                                            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded truncate max-w-[150px] inline-block" title={item.chave}>
                                                {item.chave}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`text-xs font-semibold ${item.situacaoSefaz.includes('Autorizada') ? 'text-blue-600' : 'text-orange-600'}`}>
                                                {item.situacaoSefaz}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <StatusBadge status={item.status} />
                                        </td>
                                    </tr>
                                ))}
                                {paginatedData.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            Nenhum registro encontrado com os filtros atuais.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination Footer */}
                    {processedResults.length > 0 && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-gray-600">
                                Exibindo <strong>{startRecordIndex}</strong> a <strong>{endRecordIndex}</strong> de <strong>{processedResults.length}</strong> resultados
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 h-9"
                                >
                                    <ChevronLeft size={16} /> Anterior
                                </Button>
                                
                                <span className="text-sm font-medium text-gray-700 px-2">
                                    Página {currentPage} de {totalPages}
                                </span>
                                
                                <Button 
                                    variant="outline" 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 h-9"
                                >
                                    Próximo <ChevronRight size={16} />
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="p-4 bg-white border-t border-gray-200 flex flex-wrap gap-3 justify-end rounded-b-xl">
                        <Button variant="outline" onClick={() => handleExportPDF(false)}>
                            <Download size={16} /> PDF Completo
                        </Button>
                        <Button variant="primary" onClick={() => handleExportPDF(true)}>
                            <Download size={16} /> Apenas Pendências
                        </Button>
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <PlayCircle size={20} className="text-blue-600"/> Tutorial: Exportação do Sistema Contábil
                </h3>
                <button 
                  onClick={() => setShowTutorial(false)} 
                  className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors"
                >
                   <X size={24} />
                </button>
             </div>
             <div className="aspect-video w-full bg-black">
                <iframe
                   width="100%"
                   height="100%"
                   src="https://www.youtube.com/embed/o-h5nwPTQn8?autoplay=1"
                   title="Tutorial Exportação"
                   frameBorder="0"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   allowFullScreen
                ></iframe>
             </div>
             <div className="p-4 text-sm text-gray-500 text-center bg-gray-50">
                Siga os passos do vídeo para gerar o arquivo .XLS com cabeçalho correto.
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;