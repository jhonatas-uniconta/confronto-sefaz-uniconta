import * as XLSX from 'xlsx';
import { EditalMatchResult, Cliente, SpreadsheetColumnMapping, ImportValidationSummary } from '../types';
import { normalizeHeader, normalizeIE, formatIE, normalizeCNPJ, formatCNPJ } from '../utils';
import { getClients, saveClientsToStorage } from './clientService';

/**
 * Exports Edital confrontation results to Excel (.xlsx)
 * Exactly per user specification:
 * - Cliente
 * - CNPJ
 * - Inscrição Estadual
 * - Tipo do Edital
 * - Número do Edital
 * - Arquivo
 * - Página
 * - Trecho Encontrado
 * - Data do Processamento
 */
export const exportEditaisToExcel = (results: EditalMatchResult[], customFileName?: string): void => {
  const rows = results.map(r => ({
    'Situação': r.situacaoVisual?.texto || 'Localizado',
    'Cliente': r.razaoSocial,
    'Nome Fantasia': r.cliente?.nome_fantasia || '',
    'CNPJ': r.cnpj ? formatCNPJ(r.cnpj) : '-',
    'Inscrição Estadual': formatIE(r.inscricaoEstadual),
    'Tipo do Edital': r.tipoEdital,
    'Número do Edital': r.numeroEdital,
    'Arquivo': r.arquivo,
    'Página': r.pagina,
    'Trecho Encontrado': r.trechoOriginal,
    'Data do Processamento': new Date(r.dataProcessamento).toLocaleString('pt-BR')
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 36 }, // Situação
    { wch: 38 }, // Cliente
    { wch: 25 }, // Fantasia
    { wch: 20 }, // CNPJ
    { wch: 18 }, // IE
    { wch: 45 }, // Tipo do Edital
    { wch: 18 }, // Número
    { wch: 28 }, // Arquivo
    { wch: 10 }, // Página
    { wch: 55 }, // Trecho
    { wch: 22 }  // Data
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados Editais');

  const fileName = customFileName || `confronto_editais_uniconta_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Exports client list to Excel (.xlsx)
 */
export const exportClientsToExcel = (clients: Cliente[]): void => {
  const rows = clients.map(c => ({
    'Código': c.codigo || '',
    'Razão Social': c.razao_social,
    'Nome Fantasia': c.nome_fantasia || '',
    'CNPJ': c.cnpj ? formatCNPJ(c.cnpj) : '',
    'Inscrição Estadual': formatIE(c.inscricao_estadual),
    'Status': c.ativo ? 'Ativo' : 'Inativo',
    'Cadastrado Em': new Date(c.created_at).toLocaleDateString('pt-BR'),
    'Atualizado Em': new Date(c.updated_at).toLocaleDateString('pt-BR')
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes Uniconta');
  XLSX.writeFile(workbook, `clientes_uniconta_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export interface ParsedSpreadsheetData {
  headers: string[];
  rows: any[];
  mappings: SpreadsheetColumnMapping[];
}

/**
 * Intelligent auto-mapping of spreadsheet columns to system fields:
 * Inscrição Estadual -> Inscrição Estadual
 * IE -> Inscrição Estadual
 * Razão Social -> Razão Social
 * CNPJ -> CNPJ
 * Nome Fantasia -> Nome Fantasia
 * Código -> Código
 */
export const suggestMapping = (header: string): keyof Cliente | 'ignorar' => {
  const norm = normalizeHeader(header);

  if (norm.includes('inscricao') || norm.includes('estadual') || norm === 'ie' || norm.includes('inscr')) {
    return 'inscricao_estadual';
  }
  if (norm.includes('razao') || norm.includes('social') || norm === 'empresa' || norm === 'cliente' || norm === 'nome') {
    return 'razao_social';
  }
  if (norm.includes('cnpj') || norm.includes('cgc')) {
    return 'cnpj';
  }
  if (norm.includes('fantasia') || norm.includes('comercial') || norm.includes('nome_fantasia')) {
    return 'nome_fantasia';
  }
  if (norm.includes('codigo') || norm.includes('cod') || norm === 'id') {
    return 'codigo';
  }

  return 'ignorar';
};

/**
 * Parses client spreadsheet (.xlsx, .xls, .csv)
 */
export const parseClientSpreadsheet = async (file: File): Promise<ParsedSpreadsheetData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonRaw = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });
        if (!jsonRaw || jsonRaw.length === 0) {
          throw new Error('A planilha está vazia.');
        }

        const rawHeaders = (jsonRaw[0] as any[]).map(h => (h ? h.toString().trim() : ''));
        const validHeaders = rawHeaders.filter(h => h.length > 0);

        const rows = jsonRaw.slice(1).filter(r => r && r.length > 0 && r.some((c: any) => c != null && c.toString().trim() !== ''));

        const mappings: SpreadsheetColumnMapping[] = validHeaders.map(col => ({
          colunaPlanilha: col,
          campoDestino: suggestMapping(col)
        }));

        resolve({
          headers: validHeaders,
          rows,
          mappings
        });
      } catch (err: any) {
        reject(new Error(`Erro ao ler planilha: ${err.message || err}`));
      }
    };
    reader.onerror = () => reject(new Error('Falha na leitura do arquivo.'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Analyzes and validates records based on mappings before confirming import
 */
export const analyzeImport = (
  rows: any[],
  headers: string[],
  mappings: SpreadsheetColumnMapping[],
  existingClients: Cliente[]
): ImportValidationSummary => {
  const existingIeMap = new Map<string, Cliente>();
  existingClients.forEach(c => {
    existingIeMap.set(c.inscricao_estadual, c);
  });

  const ieIndex = headers.indexOf(mappings.find(m => m.campoDestino === 'inscricao_estadual')?.colunaPlanilha || '');
  const razaoIndex = headers.indexOf(mappings.find(m => m.campoDestino === 'razao_social')?.colunaPlanilha || '');

  let novos = 0;
  let existentes = 0;
  let erros = 0;
  let duplicidadesArquivo = 0;
  const errosDescricao: string[] = [];
  const seenFileIes = new Set<string>();

  if (ieIndex === -1) {
    return {
      total: rows.length,
      novos: 0,
      existentes: 0,
      duplicidadesArquivo: 0,
      erros: rows.length,
      errosDescricao: ['A coluna para "Inscrição Estadual" não foi mapeada.']
    };
  }

  if (razaoIndex === -1) {
    return {
      total: rows.length,
      novos: 0,
      existentes: 0,
      duplicidadesArquivo: 0,
      erros: rows.length,
      errosDescricao: ['A coluna para "Razão Social" não foi mapeada.']
    };
  }

  rows.forEach((row, idx) => {
    const rawIE = row[ieIndex];
    const rawRazao = row[razaoIndex];

    const cleanIE = normalizeIE(rawIE);
    const cleanRazao = rawRazao ? rawRazao.toString().trim() : '';

    if (!cleanIE) {
      erros++;
      if (errosDescricao.length < 5) {
        errosDescricao.push(`Linha ${idx + 2}: Inscrição Estadual vazia ou inválida.`);
      }
      return;
    }

    if (!cleanRazao) {
      erros++;
      if (errosDescricao.length < 5) {
        errosDescricao.push(`Linha ${idx + 2} (IE ${cleanIE}): Razão Social não informada.`);
      }
      return;
    }

    if (seenFileIes.has(cleanIE)) {
      duplicidadesArquivo++;
    } else {
      seenFileIes.add(cleanIE);
      if (existingIeMap.has(cleanIE)) {
        existentes++;
      } else {
        novos++;
      }
    }
  });

  return {
    total: rows.length,
    novos,
    existentes,
    duplicidadesArquivo,
    erros,
    errosDescricao
  };
};

/**
 * Commits the import to the client database
 */
export const executeImport = (
  rows: any[],
  headers: string[],
  mappings: SpreadsheetColumnMapping[],
  updateExisting: boolean
): { importedCount: number; updatedCount: number; skippedCount: number } => {
  const currentClients = getClients();
  const ieMap = new Map<string, number>();
  currentClients.forEach((c, idx) => {
    ieMap.set(c.inscricao_estadual, idx);
  });

  const getColIndex = (field: keyof Cliente) => {
    const m = mappings.find(item => item.campoDestino === field);
    return m ? headers.indexOf(m.colunaPlanilha) : -1;
  };

  const idxIE = getColIndex('inscricao_estadual');
  const idxRazao = getColIndex('razao_social');
  const idxCnpj = getColIndex('cnpj');
  const idxFantasia = getColIndex('nome_fantasia');
  const idxCodigo = getColIndex('codigo');

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const rawIE = idxIE !== -1 ? row[idxIE] : null;
    const rawRazao = idxRazao !== -1 ? row[idxRazao] : null;

    const cleanIE = normalizeIE(rawIE);
    const razaoSocial = rawRazao ? rawRazao.toString().trim().toUpperCase() : '';

    if (!cleanIE || !razaoSocial) {
      skippedCount++;
      continue;
    }

    const rawCnpj = idxCnpj !== -1 ? row[idxCnpj] : '';
    const cleanCnpj = normalizeCNPJ(rawCnpj);
    const fantasia = idxFantasia !== -1 && row[idxFantasia] ? row[idxFantasia].toString().trim().toUpperCase() : '';
    const codigo = idxCodigo !== -1 && row[idxCodigo] ? row[idxCodigo].toString().trim() : '';

    if (ieMap.has(cleanIE)) {
      if (updateExisting) {
        const clientIndex = ieMap.get(cleanIE)!;
        currentClients[clientIndex] = {
          ...currentClients[clientIndex],
          razao_social: razaoSocial,
          nome_fantasia: fantasia || currentClients[clientIndex].nome_fantasia,
          cnpj: cleanCnpj ? formatCNPJ(cleanCnpj) : currentClients[clientIndex].cnpj,
          codigo: codigo || currentClients[clientIndex].codigo,
          updated_at: now
        };
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      const newClient: Cliente = {
        id: 'cli-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
        codigo: codigo,
        cnpj: cleanCnpj ? formatCNPJ(cleanCnpj) : '',
        inscricao_estadual: cleanIE,
        inscricao_estadual_formatada: formatIE(cleanIE),
        razao_social: razaoSocial,
        nome_fantasia: fantasia,
        ativo: true,
        created_at: now,
        updated_at: now
      };
      currentClients.push(newClient);
      ieMap.set(cleanIE, currentClients.length - 1);
      importedCount++;
    }
  }

  saveClientsToStorage(currentClients);
  return { importedCount, updatedCount, skippedCount };
};
