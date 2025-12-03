import React, { useState, useMemo, useEffect } from 'react';
import { FileText, ExternalLink, Download, RefreshCw, AlertTriangle, CheckCheck, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseAccountingFile, parseSefazFiles } from './services/parser';
import { exportToPdf } from './services/pdfService';
import { AccountingRecord, SefazRecord, ComparisonResult, MatchStatus, SummaryStats } from './types';
import { FileUpload, Button, Card, StatusBadge } from './components/ui';
import { extractDateFromKey } from './utils';

const App: React.FC = () => {
  // State
  const [accountingData, setAccountingData] = useState<AccountingRecord[]>([]);
  const [sefazData, setSefazData] = useState<SefazRecord[]>([]);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isCompared, setIsCompared] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  
  // File names for UI feedback
  const [accountingFileName, setAccountingFileName] = useState('');
  const [sefazFileName, setSefazFileName] = useState('');
  
  // Errors
  const [error, setError] = useState<string | null>(null);

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
    sefazData.forEach(sefaz => {
      const match = mapAccounting.get(sefaz.chave);
      let status = MatchStatus.MISSING_IN_ACCOUNTING;

      if (sefaz.situacao.toLowerCase().includes('cancelada')) {
        status = MatchStatus.CANCELLED;
      } else if (match) {
        status = MatchStatus.MATCHED;
        mapAccounting.delete(sefaz.chave); // Remove found to track remaining
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

    // Remaining accounting records (exist in system but not in SEFAZ HTML)
    mapAccounting.forEach((acc) => {
       comparison.push({
         id: acc.chave,
         chave: acc.chave,
         numero: acc.numero,
         serie: '',
         data: acc.dataEmissao || extractDateFromKey(acc.chave),
         valor: acc.valor,
         situacaoSefaz: 'Não encontrada no arquivo',
         status: MatchStatus.MISSING_IN_SEFAZ,
         accountingRecord: acc
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

  // Filtered Table Data
  const filteredResults = useMemo(() => {
    return results.filter(r => {
        const matchesText = 
          r.numero?.toLowerCase().includes(filterText.toLowerCase()) || 
          r.chave?.includes(filterText) ||
          r.situacaoSefaz?.toLowerCase().includes(filterText.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    
        return matchesText && matchesStatus;
      });
  }, [results, filterText, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedData = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const startRecordIndex = (currentPage - 1) * itemsPerPage + 1;
  const endRecordIndex = Math.min(currentPage * itemsPerPage, filteredResults.length);

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <header className="bg-slate-850 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <CheckCheck className="text-emerald-400" /> FiscalAudit Pro
              </h1>
              <p className="text-slate-400 text-sm mt-1">Ferramenta de Auditoria e Confronto Contábil x SEFAZ</p>
            </div>
            <div className="text-right hidden sm:block">
              <span className="bg-slate-700 px-3 py-1 rounded text-xs font-mono text-slate-300">v2.1.0</span>
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
                <FileUpload 
                    label="Selecione a exportação do sistema" 
                    accept=".xls,.xlsx,.csv" 
                    onFileSelect={handleAccountingUpload}
                    fileName={accountingFileName}
                />
                <div className="text-xs text-gray-400 mt-2">
                    Colunas esperadas: ChaveNFe, Numero, Valor, Data
                </div>
            </Card>

            {/* Step 2 */}
            <Card title="2. Arquivo(s) SEFAZ" subtitle="HTML Exportado do e-Fisco" icon={<ExternalLink size={20} />}>
                 <div className="mb-4">
                    <a href="https://efisco.sefaz.pe.gov.br/" target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline flex items-center gap-1 mb-3">
                        Acessar e-Fisco <ExternalLink size={12}/>
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
                                    <th className="px-6 py-3">Número</th>
                                    <th className="px-6 py-3">Série</th>
                                    <th className="px-6 py-3">Data</th>
                                    <th className="px-6 py-3">Chave de Acesso</th>
                                    <th className="px-6 py-3">Situação SEFAZ</th>
                                    <th className="px-6 py-3">Status</th>
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
                    {filteredResults.length > 0 && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-gray-600">
                                Exibindo <strong>{startRecordIndex}</strong> a <strong>{endRecordIndex}</strong> de <strong>{filteredResults.length}</strong> resultados
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
    </div>
  );
}

export default App;