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
 * Normalizes an Inscrição Estadual by removing all non-digits.
 * Example: "0369429-10" -> "036942910"
 * Example: "0369429 - 10" -> "036942910"
 */
export const normalizeIE = (ie: string | null | undefined): string => {
  if (!ie) return '';
  return ie.toString().replace(/[^0-9]/g, '').trim();
};

/**
 * Formats an Inscrição Estadual for display (Pernambuco standard 9-digit: 0369429-10 or 14-digit: 18.1.001.0000000-0)
 */
export const formatIE = (ie: string | null | undefined): string => {
  const clean = normalizeIE(ie);
  if (!clean) return '-';
  if (clean.length === 9) {
    return `${clean.substring(0, 7)}-${clean.substring(7, 9)}`;
  }
  if (clean.length === 14) {
    return `${clean.substring(0, 2)}.${clean.substring(2, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 13)}-${clean.substring(13, 14)}`;
  }
  return clean;
};

/**
 * Normalizes a CNPJ by stripping non-numeric characters.
 */
export const normalizeCNPJ = (cnpj: string | null | undefined): string => {
  if (!cnpj) return '';
  return cnpj.toString().replace(/[^0-9]/g, '').trim();
};

/**
 * Formats a CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export const formatCNPJ = (cnpj: string | null | undefined): string => {
  const clean = normalizeCNPJ(cnpj);
  if (!clean) return '-';
  if (clean.length === 14) {
    return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-${clean.substring(12, 14)}`;
  }
  return clean;
};
