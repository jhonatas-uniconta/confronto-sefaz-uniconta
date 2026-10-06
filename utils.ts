export const normalizeKey = (key: string): string => {
  if (!key) return '';
  return key.replace(/[^0-9]/g, '');
};

export const extractDateFromKey = (key: string): string => {
  const cleanKey = normalizeKey(key);
  if (cleanKey.length !== 44) return '';
  
  // Key structure: 2 digits UF, 2 digits YY, 2 digits MM
  // Indices: 0-1 (UF), 2-3 (YY), 4-5 (MM)
  const yy = cleanKey.substring(2, 4);
  const mm = cleanKey.substring(4, 6);
  
  return `${mm}/20${yy}`;
};

export const normalizeHeader = (text: string): string => {
  if (!text) return "";
  return text
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_");
};

export const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return dateStr; 
};

/**
 * Normalizes and sanitizes an Inscrição Estadual value.
 * Accepts string, null, undefined.
 * Returns only digits (e.g. "036942910") or null if empty / without digits.
 */
export function sanitizeIE(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.toString().replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/**
 * Normalizes an Inscrição Estadual by removing all non-digits. Returns empty string if absent.
 */
export const normalizeIE = (ie?: string | null): string => {
  return sanitizeIE(ie) || '';
};

/**
 * Formats an Inscrição Estadual for display (Pernambuco standard 9-digit: 0369429-10 or 14-digit: 18.1.001.0000000-0).
 * Returns "Sem IE" if absent or empty.
 */
export const formatIE = (ie: string | null | undefined): string => {
  const clean = sanitizeIE(ie);
  if (!clean) return 'Sem IE';
  if (clean.length === 9) {
    return `${clean.substring(0, 7)}-${clean.substring(7, 9)}`;
  }
  if (clean.length === 14) {
    return `${clean.substring(0, 2)}.${clean.substring(2, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 13)}-${clean.substring(13, 14)}`;
  }
  return clean;
};

/**
 * Normalizes a company name (Razão Social) according to exact normalization rules:
 * 1. Converte para maiúsculas
 * 2. Remove acentos
 * 3. Remove pontos
 * 4. Remove vírgulas
 * 5. Remove hífens
 * 6. Remove barras
 * 7. Remove caracteres especiais
 * 8. Substitui múltiplos espaços por um único espaço
 * 9. Remove espaços no início e final
 *
 * Exemplo:
 * "L. C. COMÉRCIO E SERVIÇOS LTDA" -> "L C COMERCIO E SERVICOS LTDA"
 */
export function normalizeCompanyName(text?: string | null): string {
  if (!text) return '';

  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // 2. Remove acentos
    .toUpperCase()                   // 1. Converte para maiúsculas
    .replace(/[^A-Z0-9]/g, ' ')      // 3, 4, 5, 6, 7. Remove pontos, vírgulas, hífens, barras, caracteres especiais
    .replace(/\s+/g, ' ')            // 8. Substitui múltiplos espaços por um único espaço
    .trim();                         // 9. Remove espaços no início e final
}

/** Alias for compatibility */
export const normalizeRazaoSocial = normalizeCompanyName;

export interface RegistroPdf {
  inscricao_estadual?: string;
  cnpj?: string;
  razao_social: string;
  rawLine: string;
}

/**
 * Extracts candidate registration data (IE, CNPJ, Razão Social) from a line in the SEFAZ PDF.
 * Removes recognized IE, CNPJ, dates, currency and municipality/UF suffixes from the line,
 * leaving the raw company name.
 */
export function extractRegistroPdf(line: string): RegistroPdf {
  let cleaned = line.trim();

  // 1. Remove initial sequence/item numbering (e.g. "01 - ", "1. ", "Item 10: ")
  cleaned = cleaned.replace(/^\s*\d+[\.\-\)]\s*/, '');
  cleaned = cleaned.replace(/^ITEM\s*\d+[\.\:\-]?\s*/i, '');

  // 2. Extract and remove Inscrição Estadual (9 digits: e.g. "0369429-10" or "036942910", or 14 digits)
  let extractedIE: string | undefined;
  const ieRegex = /\b(\d{7}[-\s]?\d{2}|\d{2}\.\d\.\d{3}\.\d{7}-\d|\d{9})\b/;
  const ieMatch = cleaned.match(ieRegex);
  if (ieMatch) {
    extractedIE = ieMatch[0];
    cleaned = cleaned.replace(ieMatch[0], ' ');
  }

  // 3. Extract and remove CNPJ (e.g. "10.316.742/0001-85", "10316742000185", "10.316.742") or CPF
  let extractedCNPJ: string | undefined;
  const cnpjRegex = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{2}\.\d{3}\.\d{3})\b/;
  const cnpjMatch = cleaned.match(cnpjRegex);
  if (cnpjMatch) {
    extractedCNPJ = cnpjMatch[0];
    cleaned = cleaned.replace(cnpjMatch[0], ' ');
  } else {
    const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
    const cpfMatch = cleaned.match(cpfRegex);
    if (cpfMatch) {
      extractedCNPJ = cpfMatch[0];
      cleaned = cleaned.replace(cpfMatch[0], ' ');
    }
  }

  // 4. Remove debt amounts e.g. "R$ 1.234,56" or dates
  cleaned = cleaned.replace(/R\$\s*[\d\.\,]+/gi, ' ');
  cleaned = cleaned.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, ' ');

  // 5. Remove municipality / UF from end of line (e.g. "CARUARU-PE", "RECIFE - PE", "RECIFE/PE", "- PE", " PE")
  cleaned = cleaned.replace(/(?:\s+[-/]\s*|\s+)[A-ZÀ-Úa-z\s]+[-/]\s*(?:PE|AL|PB|BA|RN|CE|SE|PI|MA|SP|RJ|MG|ES|PR|SC|RS|MS|MT|GO|DF|TO|PA|AM|RO|AC|RR|AP)\s*$/i, ' ');
  cleaned = cleaned.replace(/[-/]\s*[A-Z]{2}\s*$/i, ' ');
  cleaned = cleaned.replace(/\s+[A-Z]{2}\s*$/i, ' ');

  const razao = cleaned.replace(/\s+/g, ' ').trim();

  return {
    inscricao_estadual: extractedIE,
    cnpj: extractedCNPJ,
    razao_social: razao,
    rawLine: line
  };
}


/**
 * Normalizes and sanitizes a CNPJ value.
 * Accepts string, null, undefined.
 * Returns only digits (e.g. "12345678000190") or null if empty / without digits.
 */
export function sanitizeCNPJ(value?: string | null): string | null {
  if (!value) return null;

  const digits = value.toString().replace(/\D/g, "");

  return digits.length > 0 ? digits : null;
}

/**
 * Normalizes a CNPJ by stripping non-numeric characters. Returns empty string if absent.
 */
export const normalizeCNPJ = (value?: string | null): string => {
  return sanitizeCNPJ(value) || '';
};

/**
 * Formats a CNPJ (XX.XXX.XXX/XXXX-XX). Returns '-' if empty or invalid.
 */
export const formatCNPJ = (cnpj?: string | null): string => {
  const clean = sanitizeCNPJ(cnpj);
  if (!clean) return '-';
  if (clean.length === 14) {
    return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-${clean.substring(12, 14)}`;
  }
  if (clean.length === 11) {
    // CPF format if 11 digits
    return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
  }
  return clean;
};
