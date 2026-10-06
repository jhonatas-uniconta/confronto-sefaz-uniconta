import * as XLSX from 'xlsx';
import { EditalMatchResult, Cliente, SpreadsheetColumnMapping, ImportValidationSummary } from '../types';
import { normalizeHeader, normalizeIE, formatIE, normalizeCNPJ, formatCNPJ, normalizeRazaoSocial } from '../utils';
import { getClients, saveClientsToStorage } from './clientService';

/**
 * Exports Edital confrontation results to Excel (.xlsx)
 * Columns:
 * - Situação
 * - Cliente
 * - Nome Fantasia
 * - CNPJ
 * - Inscrição Estadual
 * - Encontrado por (CNPJ | Inscrição Estadual | Razão Social | Razão Social – conferir)
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
    'Inscrição Estadual': r.inscricaoEstadual ? formatIE(r.inscricaoEstadual) : 'Sem IE',
    'Encontrado por': r.encontradoPor || 'Inscrição Estadual',
    'Tipo do Edital': r.tipoEdital,
    'Número do Edital': r.numeroEdital,
    'Arquivo': r.arquivo,
    'Página': r.pagina,
    'Trecho Encontrado': r.trechoOriginal,
    'Data do Processamento': new Date(r.dataProcessamento).toLocaleString('pt-BR')
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 36 }, // Situação
    { wch: 38 }, // Cliente
    { wch: 25 }, // Fantasia
    { wch: 20 }, // CNPJ
    { wch: 18 }, // IE
    { wch: 24 }, // Encontrado por
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
    'Inscrição Estadual': c.inscricao_estadual ? formatIE(c.inscricao_estadual) : 'Sem IE',
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
 * Intelligent auto-mapping of spreadsheet columns to system fields
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
 * Finds an existing client matching candidate according to priority:
 * 1. CNPJ igual (quando preenchido com >= 11 dígitos)
 * 2. IE igual (quando ambos possuírem IE preenchida)
 * 3. Razão Social normalizada igual
 */
const findMatchingExistingClient = (
  cnpj: string,
  ie: string,
  razaoNorm: string,
  existingClients: Cliente[]
): Cliente | undefined => {
  // 1. Match by CNPJ
  if (cnpj && cnpj.length >= 11) {
    const matchCNPJ = existingClients.find(c => c.cnpj && normalizeCNPJ(c.cnpj) === cnpj);
    if (matchCNPJ) return matchCNPJ;
  }

  // 2. Match by IE (only if candidate has IE)
  if (ie) {
    const matchIE = existingClients.find(c => c.inscricao_estadual && normalizeIE(c.inscricao_estadual) === ie);
    if (matchIE) return matchIE;
  }

  // 3. Match by normalized Razão Social
  if (razaoNorm) {
    const matchRazao = existingClients.find(c => normalizeRazaoSocial(c.razao_social) === razaoNorm);
    if (matchRazao) return matchRazao;
  }

  return undefined;
};

/**
 * Analyzes and validates records based on mappings before confirming import.
 * Razão Social: Obrigatória.
 * IE: Opcional. Linhas sem IE NÃO geram erro.
 * CNPJ: Opcional, recomendado.
 */
export const analyzeImport = (
  rows: any[],
  headers: string[],
  mappings: SpreadsheetColumnMapping[],
  existingClients: Cliente[]
): ImportValidationSummary => {
  const ieIndex = headers.indexOf(mappings.find(m => m.campoDestino === 'inscricao_estadual')?.colunaPlanilha || '');
  const razaoIndex = headers.indexOf(mappings.find(m => m.campoDestino === 'razao_social')?.colunaPlanilha || '');
  const cnpjIndex = headers.indexOf(mappings.find(m => m.campoDestino === 'cnpj')?.colunaPlanilha || '');

  let novos = 0;
  let existentes = 0;
  let erros = 0;
  let duplicidadesArquivo = 0;
  const errosDescricao: string[] = [];

  if (razaoIndex === -1) {
    return {
      total: rows.length,
      novos: 0,
      existentes: 0,
      duplicidadesArquivo: 0,
      erros: rows.length,
      errosDescricao: ['A coluna para "Razão Social" não foi mapeada. É um campo obrigatório.']
    };
  }

  // Track seen identifiers within the file
  const seenFileCNPJs = new Set<string>();
  const seenFileIEs = new Set<string>();
  const seenFileRazaos = new Set<string>();

  rows.forEach((row, idx) => {
    const rawRazao = row[razaoIndex];
    const rawIE = ieIndex !== -1 ? row[ieIndex] : null;
    const rawCnpj = cnpjIndex !== -1 ? row[cnpjIndex] : null;

    const cleanRazao = rawRazao ? rawRazao.toString().trim() : '';
    const cleanIE = normalizeIE(rawIE);
    const cleanCNPJ = normalizeCNPJ(rawCnpj);
    const normRazao = normalizeRazaoSocial(cleanRazao);

    // Only Razão Social is mandatory
    if (!cleanRazao) {
      erros++;
      if (errosDescricao.length < 5) {
        errosDescricao.push(`Linha ${idx + 2}: Razão Social não informada.`);
      }
      return;
    }

    // Check duplicate within the file
    let isFileDuplicate = false;
    if (cleanCNPJ && cleanCNPJ.length >= 11) {
      if (seenFileCNPJs.has(cleanCNPJ)) isFileDuplicate = true;
    }
    if (!isFileDuplicate && cleanIE) {
      if (seenFileIEs.has(cleanIE)) isFileDuplicate = true;
    }
    if (!isFileDuplicate && normRazao) {
      if (seenFileRazaos.has(normRazao)) isFileDuplicate = true;
    }

    if (isFileDuplicate) {
      duplicidadesArquivo++;
    } else {
      if (cleanCNPJ && cleanCNPJ.length >= 11) seenFileCNPJs.add(cleanCNPJ);
      if (cleanIE) seenFileIEs.add(cleanIE);
      if (normRazao) seenFileRazaos.add(normRazao);

      // Check if matches an existing client in the database
      const existingMatch = findMatchingExistingClient(cleanCNPJ, cleanIE, normRazao, existingClients);
      if (existingMatch) {
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
 * Commits the import to the client database.
 * Does not require Inscrição Estadual.
 */
export const executeImport = (
  rows: any[],
  headers: string[],
  mappings: SpreadsheetColumnMapping[],
  updateExisting: boolean
): { importedCount: number; updatedCount: number; skippedCount: number } => {
  const currentClients = [...getClients()];

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
    const rawRazao = idxRazao !== -1 ? row[idxRazao] : null;
    const razaoSocial = rawRazao ? rawRazao.toString().trim().toUpperCase() : '';

    if (!razaoSocial) {
      skippedCount++;
      continue;
    }

    const rawIE = idxIE !== -1 ? row[idxIE] : null;
    const cleanIE = normalizeIE(rawIE);

    const rawCnpj = idxCnpj !== -1 ? row[idxCnpj] : '';
    const cleanCnpj = normalizeCNPJ(rawCnpj);
    const fantasia = idxFantasia !== -1 && row[idxFantasia] ? row[idxFantasia].toString().trim().toUpperCase() : '';
    const codigo = idxCodigo !== -1 && row[idxCodigo] ? row[idxCodigo].toString().trim() : '';
    const normRazao = normalizeRazaoSocial(razaoSocial);

    // Find existing match by 1. CNPJ, 2. IE, 3. Razão Social
    const existingIndex = currentClients.findIndex(c => {
      if (cleanCnpj && cleanCnpj.length >= 11 && c.cnpj && normalizeCNPJ(c.cnpj) === cleanCnpj) {
        return true;
      }
      if (cleanIE && c.inscricao_estadual && normalizeIE(c.inscricao_estadual) === cleanIE) {
        return true;
      }
      if (normRazao && normalizeRazaoSocial(c.razao_social) === normRazao) {
        return true;
      }
      return false;
    });

    if (existingIndex !== -1) {
      if (updateExisting) {
        const prev = currentClients[existingIndex];
        currentClients[existingIndex] = {
          ...prev,
          razao_social: razaoSocial,
          nome_fantasia: fantasia || prev.nome_fantasia,
          cnpj: cleanCnpj ? formatCNPJ(cleanCnpj) : prev.cnpj,
          inscricao_estadual: cleanIE || prev.inscricao_estadual || '',
          inscricao_estadual_formatada: cleanIE ? formatIE(cleanIE) : (prev.inscricao_estadual_formatada || 'Sem IE'),
          codigo: codigo || prev.codigo,
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
        inscricao_estadual: cleanIE || '',
        inscricao_estadual_formatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
        razao_social: razaoSocial,
        nome_fantasia: fantasia,
        ativo: true,
        created_at: now,
        updated_at: now
      };
      currentClients.push(newClient);
      importedCount++;
    }
  }

  saveClientsToStorage(currentClients);
  return { importedCount, updatedCount, skippedCount };
};

