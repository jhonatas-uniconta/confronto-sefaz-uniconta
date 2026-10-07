import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, FileSpreadsheet, Search, Filter, 
  Edit2, Trash2, CheckCircle2, XCircle, ArrowUpDown, 
  ArrowUp, ArrowDown, ChevronLeft, ChevronRight, AlertTriangle, 
  RotateCcw, Download, Check, HelpCircle, Database, Settings, 
  Copy, CheckCheck, Loader2
} from 'lucide-react';
import { Cliente, SpreadsheetColumnMapping, ImportValidationSummary } from '../../types';
import { 
  getClients, 
  createOrUpdateClient, 
  deleteClient, 
  toggleClientStatus, 
  resetSampleClients,
  migrateLocalClientsToSupabase,
  hasLocalClientsToMigrate
} from '../../services/clientService';
import { 
  getSupabaseConfig, 
  testSupabaseConnection, 
  SUPABASE_SQL_SCRIPT 
} from '../../services/supabaseService';
import { 
  parseClientSpreadsheet, 
  analyzeImport, 
  executeImport, 
  exportClientsToExcel, 
  ParsedSpreadsheetData 
} from '../../services/excelService';
import { Card, Button, Modal, FileUpload } from '../../components/ui';
import { formatIE, formatCNPJ, normalizeIE, normalizeCNPJ } from '../../utils';

export const ClientesView: React.FC = () => {
  // Client state
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Migration state
  const [hasLocalMigrationAvailable, setHasLocalMigrationAvailable] = useState<boolean>(() => hasLocalClientsToMigrate());
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  // Supabase connection state & modal
  const [supabaseConfig, setSupabaseConfig] = useState(() => getSupabaseConfig());
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatusText, setConnectionStatusText] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Sorting
  const [sortField, setSortField] = useState<keyof Cliente>('razao_social');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formCodigo, setFormCodigo] = useState('');
  const [formCnpj, setFormCnpj] = useState('');
  const [formIE, setFormIE] = useState('');
  const [formRazao, setFormRazao] = useState('');
  const [formFantasia, setFormFantasia] = useState('');
  const [formAtivo, setFormAtivo] = useState(true);

  // Import Spreadsheet State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSpreadsheetData | null>(null);
  const [mappings, setMappings] = useState<SpreadsheetColumnMapping[]>([]);
  const [importSummary, setImportSummary] = useState<ImportValidationSummary | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [importLoading, setImportLoading] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Delete modal state
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null);

  // Load clients directly from Supabase
  const refreshClients = async () => {
    setIsLoading(true);
    try {
      const data = await getClients();
      setClients(data);
    } catch (e) {
      console.error('Erro ao atualizar clientes:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshClients();
    testSupabaseConnection().then(res => {
      setIsDbConnected(res.tableExists);
      if (!res.tableExists && res.message) {
        setConnectionStatusText(res.message);
      }
    });
  }, []);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setFormCodigo('');
    setFormCnpj('');
    setFormIE('');
    setFormRazao('');
    setFormFantasia('');
    setFormAtivo(true);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (client: Cliente) => {
    setEditingClient(client);
    setFormCodigo(client.codigo || '');
    setFormCnpj(client.cnpj || '');
    setFormIE(client.inscricao_estadual_formatada || client.inscricao_estadual);
    setFormRazao(client.razao_social);
    setFormFantasia(client.nome_fantasia || '');
    setFormAtivo(client.ativo);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Handle Save Client directly to Supabase
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      const result = await createOrUpdateClient({
        id: editingClient?.id,
        codigo: formCodigo,
        cnpj: formCnpj,
        inscricao_estadual: formIE,
        razao_social: formRazao,
        nome_fantasia: formFantasia,
        ativo: formAtivo
      });

      if (!result.success) {
        setFormError(result.error || 'Erro ao salvar cliente.');
        return;
      }

      setIsFormModalOpen(false);
      await refreshClients();
    } catch (err: any) {
      setFormError(err.message || 'Erro inesperado ao salvar cliente no Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Toggle Status directly in Supabase
  const handleToggleStatus = async (id: string, currentAtivo: boolean) => {
    await toggleClientStatus(id, currentAtivo);
    await refreshClients();
  };

  // Handle Delete directly in Supabase
  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    await deleteClient(clientToDelete.id);
    setClientToDelete(null);
    await refreshClients();
  };

  // Handle Migration from local storage to Supabase
  const handleMigrateLocal = async () => {
    if (!window.confirm('Deseja transferir os clientes armazenados localmente neste navegador para a tabela clientes no Supabase?')) {
      return;
    }

    setIsMigrating(true);
    setMigrationMessage(null);
    try {
      const result = await migrateLocalClientsToSupabase();
      if (result.success) {
        setHasLocalMigrationAvailable(false);
        setMigrationMessage(`${result.migratedCount} clientes migrados com sucesso para o banco Supabase! (${result.skippedCount} já existentes ignorados)`);
        await refreshClients();
      } else {
        alert(result.error || 'Erro na migração.');
      }
    } catch (err: any) {
      alert(`Falha durante a migração: ${err.message || err}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // Handle Reset Samples
  const handleResetSamples = async () => {
    if (window.confirm('Deseja recarregar a base padrão de clientes exemplo da Uniconta?')) {
      resetSampleClients();
      await refreshClients();
    }
  };

  // Handle Spreadsheet Upload
  const handleSpreadsheetSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setImportFile(file);
    setImportLoading(true);
    setImportFeedback(null);

    try {
      const data = await parseClientSpreadsheet(file);
      setParsedData(data);
      setMappings(data.mappings);
      setImportStep('mapping');
    } catch (err: any) {
      setImportFeedback(`Erro na leitura do arquivo: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Update Mapping
  const handleMappingChange = (coluna: string, campo: keyof Cliente | 'ignorar') => {
    setMappings(prev => 
      prev.map(m => m.colunaPlanilha === coluna ? { ...m, campoDestino: campo } : m)
    );
  };

  // Analyze Mapped Spreadsheet
  const handleProceedToPreview = () => {
    if (!parsedData) return;
    const summary = analyzeImport(parsedData.rows, parsedData.headers, mappings, clients);
    setImportSummary(summary);
    setImportStep('preview');
  };

  // Execute Import directly into Supabase
  const handleExecuteImport = async () => {
    if (!parsedData) return;
    setImportLoading(true);
    try {
      const result = await executeImport(parsedData.rows, parsedData.headers, mappings, updateExisting);
      setIsImportModalOpen(false);
      setImportStep('upload');
      setParsedData(null);
      setImportFile(null);
      await refreshClients();
      alert(`Importação concluída com sucesso no Supabase!\n• ${result.importedCount} novos clientes inseridos\n• ${result.updatedCount} clientes atualizados\n• ${result.skippedCount} registros ignorados`);
    } catch (err: any) {
      alert(`Erro ao importar clientes no Supabase: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Test Supabase Connection using server environment variables
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatusText(null);
    try {
      const currentConf = getSupabaseConfig();
      setSupabaseConfig(currentConf);
      const res = await testSupabaseConnection();
      setIsDbConnected(res.tableExists);
      setConnectionStatusText(res.message);
      if (res.tableExists) {
        await refreshClients();
      }
    } catch (e: any) {
      setConnectionStatusText(`Erro ao testar: ${e.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };


  // Sort Handler
  const handleSort = (field: keyof Cliente) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Filtered & Sorted Data
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || (
        c.razao_social.toLowerCase().includes(term) ||
        (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
        (c.cnpj && c.cnpj.includes(term)) ||
        c.inscricao_estadual.includes(term) ||
        c.inscricao_estadual_formatada.includes(term) ||
        (c.codigo && c.codigo.toLowerCase().includes(term))
      );

      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && c.ativo) || 
        (statusFilter === 'inactive' && !c.ativo);

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      const cmp = String(valA).localeCompare(String(valB));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [clients, searchTerm, statusFilter, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage]);

  const SortIcon = ({ field }: { field: keyof Cliente }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-400 opacity-50 ml-1 inline" />;
    return sortDir === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600 ml-1 inline" /> 
      : <ArrowDown size={14} className="text-blue-600 ml-1 inline" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users size={22} className="text-blue-600" />
              Base de Clientes
            </h1>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Clique para ver o Script SQL e status da conexão com o Supabase"
            >
              <Database size={12} className="text-emerald-600" />
              Supabase Oficial
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empresas cadastradas para verificação automática contra editais da SEFAZ-PE. Banco centralizado no Supabase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportClientsToExcel(clients)}
            title="Exportar base para Excel"
          >
            <Download size={15} /> Exportar Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportStep('upload');
              setImportFeedback(null);
              setImportFile(null);
              setIsImportModalOpen(true);
            }}
          >
            <FileSpreadsheet size={15} /> Importar Planilha
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
          >
            <UserPlus size={15} /> + Novo Cliente
          </Button>
        </div>
      </div>

      {/* Migration Notice Banner (se existirem dados locais a migrar) */}
      {hasLocalMigrationAvailable && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
              <Database size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-950">Migrar base local para o Supabase</h4>
              <p className="text-xs text-blue-800 mt-0.5">
                Detectamos clientes cadastrados no armazenamento local deste navegador. Você pode transferi-los para a tabela oficial do Supabase agora com validação de duplicidade por CNPJ e IE.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleMigrateLocal}
            disabled={isMigrating}
            className="shrink-0"
          >
            {isMigrating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Migrando...
              </>
            ) : (
              'Migrar base local para Supabase'
            )}
          </Button>
        </div>
      )}

      {migrationMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{migrationMessage}</span>
          </div>
          <button onClick={() => setMigrationMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold px-2">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar Razão, Fantasia, CNPJ ou IE..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
            >
              <option value="all">Todos os Status ({clients.length})</option>
              <option value="active">Apenas Ativos ({clients.filter(c => c.ativo).length})</option>
              <option value="inactive">Apenas Inativos ({clients.filter(c => !c.ativo).length})</option>
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetSamples}
            title="Restaurar dados de exemplo da Uniconta"
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            <RotateCcw size={13} /> Dados Padrão
          </Button>
        </div>
      </div>

      {/* Main Clients Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 select-none">
              <tr>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('codigo')}>
                  Código <SortIcon field="codigo" />
                </th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('razao_social')}>
                  Razão Social <SortIcon field="razao_social" />
                </th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nome_fantasia')}>
                  Nome Fantasia <SortIcon field="nome_fantasia" />
                </th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cnpj')}>
                  CNPJ <SortIcon field="cnpj" />
                </th>
                <th className="px-5 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('inscricao_estadual')}>
                  Inscrição Estadual <SortIcon field="inscricao_estadual" />
                </th>
                <th className="px-5 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ativo')}>
                  Status <SortIcon field="ativo" />
                </th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">
                    {client.codigo || '-'}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {client.razao_social}
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs">
                    {client.nome_fantasia || '-'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {client.cnpj ? formatCNPJ(client.cnpj) : '-'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                    {client.inscricao_estadual ? (
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold">
                        {formatIE(client.inscricao_estadual)}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-normal">
                        Sem IE
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => handleToggleStatus(client.id, client.ativo)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        client.ativo 
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Clique para alternar status ativo/inativo"
                    >
                      {client.ativo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {client.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEditModal(client)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Editar Cliente"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setClientToDelete(client)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir Cliente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                    Carregando base de clientes do Supabase...
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Nenhum cliente encontrado no Supabase com os filtros informados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredClients.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Mostrando <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, filteredClients.length)}</strong> de <strong>{filteredClients.length}</strong> clientes
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} /> Anterior
              </Button>
              <span className="font-medium px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Client */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        subtitle="Preencha os dados do cliente para confronto com editais da SEFAZ"
        icon={<Users size={20} />}
      >
        <form onSubmit={handleSaveClient} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Razão Social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="Ex: EMPRESA COMERCIAL DE ALIMENTOS LTDA"
              value={formRazao}
              onChange={(e) => setFormRazao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Inscrição Estadual (IE) <span className="text-gray-400 font-normal text-[11px]">(Opcional)</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Ex: 0369429-10 (ou deixe em branco)"
                value={formIE}
                onChange={(e) => setFormIE(e.target.value)}
              />
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Clientes sem IE serão confrontados por CNPJ e Razão Social.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                CNPJ <span className="text-blue-600 font-normal text-[11px]">(Recomendado)</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Ex: 10.316.742/0001-85"
                value={formCnpj}
                onChange={(e) => setFormCnpj(e.target.value)}
              />
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Permite correspondência confirmada de Nível 1.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nome Fantasia (Opcional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="Ex: DISTRIBUIDORA AGRESTE"
                value={formFantasia}
                onChange={(e) => setFormFantasia(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Código Interno (Opcional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Ex: 1042"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formAtivo}
                onChange={(e) => setFormAtivo(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="font-medium">Cliente ativo na auditoria</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        isOpen={Boolean(clientToDelete)}
        onClose={() => setClientToDelete(null)}
        title="Confirmar Exclusão"
        subtitle="Esta ação removerá o cliente da base de auditoria"
        maxWidth="sm"
      >
        <div className="space-y-4 text-sm">
          <p className="text-gray-700">
            Tem certeza que deseja excluir o cliente <strong>{clientToDelete?.razao_social}</strong> (IE: {clientToDelete?.inscricao_estadual_formatada})?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => setClientToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
              Excluir Definitivamente
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Import Spreadsheet */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Planilha de Clientes"
        subtitle="Importe arquivos .xlsx, .xls ou .csv com mapeamento flexível de colunas"
        icon={<FileSpreadsheet size={20} />}
        maxWidth="3xl"
      >
        <div className="space-y-5">
          {importFeedback && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700">
              {importFeedback}
            </div>
          )}

          {/* Step 1: Upload */}
          {importStep === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                <FileSpreadsheet className="mx-auto text-blue-600 mb-3" size={40} />
                <h3 className="font-semibold text-slate-800 text-sm mb-1">
                  Selecione sua planilha de clientes
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Aceita arquivos exportados de qualquer ERP (.xlsx, .xls, .csv). Na próxima etapa você poderá mapear os nomes das colunas.
                </p>
                <div className="flex justify-center">
                  <FileUpload
                    label=""
                    accept=".xlsx,.xls,.csv"
                    onFileSelect={handleSpreadsheetSelect}
                    fileName={importFile?.name}
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-900 mb-1">Dica de Importação:</p>
                A planilha precisa conter pelo menos a coluna de <strong>Razão Social</strong> (obrigatória). As colunas de <strong>CNPJ</strong> e <strong>Inscrição Estadual (IE)</strong> são opcionais. O sistema aceita qualquer layout e sugere o vínculo automaticamente.
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {importStep === 'mapping' && parsedData && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg text-xs">
                <span>Arquivo: <strong>{importFile?.name}</strong></span>
                <span>Total de Linhas: <strong>{parsedData.rows.length}</strong></span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5">Coluna na Planilha</th>
                      <th className="px-4 py-2.5">Campo no Sistema</th>
                      <th className="px-4 py-2.5">Exemplo da 1ª Linha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mappings.map((m) => {
                      const colIdx = parsedData.headers.indexOf(m.colunaPlanilha);
                      const sampleVal = colIdx !== -1 && parsedData.rows[0] ? parsedData.rows[0][colIdx] : '-';
                      return (
                        <tr key={m.colunaPlanilha} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {m.colunaPlanilha}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              className="px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                              value={m.campoDestino}
                              onChange={(e) => handleMappingChange(m.colunaPlanilha, e.target.value as any)}
                            >
                              <option value="ignorar">Ignorar esta coluna</option>
                              <option value="inscricao_estadual">Inscrição Estadual (IE) *</option>
                              <option value="razao_social">Razão Social *</option>
                              <option value="cnpj">CNPJ</option>
                              <option value="nome_fantasia">Nome Fantasia</option>
                              <option value="codigo">Código do Cliente</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 truncate max-w-xs font-mono">
                            {String(sampleVal || '-')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" onClick={() => setImportStep('upload')}>
                  Voltar
                </Button>
                <Button variant="primary" size="sm" onClick={handleProceedToPreview}>
                  Avançar para Validação
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Confirm */}
          {importStep === 'preview' && importSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-[11px] text-emerald-700 block font-medium">Novos Clientes</span>
                  <span className="text-xl font-bold text-emerald-800">{importSummary.novos}</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-[11px] text-blue-700 block font-medium">Existentes por CNPJ</span>
                  <span className="text-xl font-bold text-blue-800">{importSummary.existentesCnpj}</span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <span className="text-[11px] text-indigo-700 block font-medium">Existentes por IE</span>
                  <span className="text-xl font-bold text-indigo-800">{importSummary.existentesIe}</span>
                </div>
                <div className={`p-3 rounded-lg border ${
                  importSummary.duplicidadesArquivo > 0 
                    ? 'bg-amber-50 border-amber-200 text-amber-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span className="text-[11px] block font-medium">Duplicidades no Arquivo</span>
                  <span className="text-xl font-bold">{importSummary.duplicidadesArquivo}</span>
                </div>
                <div className={`p-3 rounded-lg border ${
                  importSummary.erros > 0 
                    ? 'bg-red-50 border-red-200 text-red-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span className="text-[11px] block font-medium">Registros Inválidos</span>
                  <span className="text-xl font-bold">{importSummary.erros}</span>
                </div>
              </div>

              {/* Duplicates inside file notice */}
              {importSummary.duplicidadesDescricao && importSummary.duplicidadesDescricao.length > 0 && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 space-y-1">
                  <span className="font-bold block flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600" />
                    Duplicidades identificadas dentro da própria planilha:
                  </span>
                  {importSummary.duplicidadesDescricao.map((dup, i) => (
                    <div key={i}>• {dup}</div>
                  ))}
                  <p className="text-[11px] text-amber-700 mt-1 italic">
                    * Linhas repetidas com o mesmo CNPJ ou IE no arquivo não serão importadas em duplicidade.
                  </p>
                </div>
              )}

              {/* Error Warnings */}
              {importSummary.errosDescricao.length > 0 && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-800 space-y-1">
                  <span className="font-bold block">Inconsistências encontradas:</span>
                  {importSummary.errosDescricao.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Action choice */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <span className="font-semibold text-slate-800 block text-sm">Regra para clientes já existentes:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="updateExisting"
                    checked={updateExisting}
                    onChange={() => setUpdateExisting(true)}
                    className="text-blue-600"
                  />
                  <span><strong>Atualizar dados</strong> dos clientes existentes (identificados por CNPJ ou IE)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="updateExisting"
                    checked={!updateExisting}
                    onChange={() => setUpdateExisting(false)}
                    className="text-blue-600"
                  />
                  <span><strong>Ignorar clientes existentes</strong> (manter cadastros atuais sem alteração)</span>
                </label>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" onClick={() => setImportStep('mapping')}>
                  Voltar ao Mapeamento
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleExecuteImport}
                  disabled={importSummary.novos === 0 && importSummary.existentes === 0}
                >
                  <Check size={14} /> Confirmar Importação
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Configurações do Supabase & Script SQL Editor */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configuração do Banco Oficial Supabase"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5 text-sm">
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            isDbConnected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <Database className="shrink-0 mt-0.5 text-blue-600" size={20} />
            <div className="flex-1 text-xs">
              <span className="font-bold block text-sm mb-0.5">
                {isDbConnected ? 'Tabela "clientes" Conectada no Supabase' : 'Ação Necessária: Criar Tabela no Supabase'}
              </span>
              <p>
                {connectionStatusText || (isDbConnected 
                  ? 'A Base de Clientes está conectada diretamente ao Supabase. Todas as operações de listagem, inclusão, edição e confronto consultam o banco oficial.' 
                  : 'Acesse o Supabase Dashboard, abra o SQL Editor, cole e execute o script abaixo para criar a tabela clientes e as políticas RLS.')}
              </p>
            </div>
          </div>

          {/* Section 1: SQL Script */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-900 text-xs">
                Script SQL para executar no Supabase SQL Editor:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySql}
                className="text-xs"
              >
                {copiedSql ? (
                  <>
                    <CheckCheck size={14} className="text-emerald-600" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar SQL Completo
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-56 leading-relaxed select-all">
              {SUPABASE_SQL_SCRIPT}
            </pre>
            <p className="text-[11px] text-slate-500 mt-1">
              Copie o código acima, cole no <strong>SQL Editor</strong> do seu projeto Supabase e clique em <strong>Run</strong>.
            </p>
          </div>

          {/* Section 2: Environment Status & Connection */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="font-semibold text-slate-900 text-xs block">
              Variáveis de Ambiente do Sistema (Vercel):
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">VITE_SUPABASE_URL</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${supabaseConfig.url ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {supabaseConfig.url ? 'Configurada no ambiente' : 'Não configurada'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">VITE_SUPABASE_ANON_KEY</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${supabaseConfig.anonKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {supabaseConfig.anonKey ? 'Configurada no ambiente' : 'Não configurada'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                As credenciais são gerenciadas exclusivamente no painel do Vercel.
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTestConnection}
                disabled={testingConnection || !supabaseConfig.isConfigured}
              >
                {testingConnection ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Testando...
                  </>
                ) : (
                  'Testar Conexão'
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => setIsConfigModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
