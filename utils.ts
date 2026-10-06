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
 * Sanitizes an Inscrição Estadual value: strips non-digits and filters out
 * placeholders like "-", "=", "SEM IE", "ISENTO", "NULL", "S/N".
 * Returns clean numeric string or empty string.
 */
export const sanitizeIE = (ie: string | null | undefined): string => {
  if (!ie) return '';
  const str = ie.toString().trim();
  const upper = str.toUpperCase();
  if (
    upper === '-' ||
    upper === '=' ||
    upper === 'SEM IE' ||
    upper === 'ISENTO' ||
    upper === 'NULL' ||
    upper === 'S/N' ||
    upper === 'N/A' ||
    upper === 'NAO POSSUI' ||
    upper === 'SEM INSCRIÇÃO' ||
    upper === 'SEM INSCRICAO'
  ) {
    return '';
  }
  return normalizeIE(str);
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
 * Normalizes a company name (Razão Social) for precise comparison.
 * - Uppercase
 * - Removes accents
 * - Removes punctuation, hyphens, slashes, special symbols
 * - Collapses multiple spaces and trims
 * Example: "OLIVEIRAS BEM-ESTAR ALIMENTOS LTDA - EPP" -> "OLIVEIRAS BEM ESTAR ALIMENTOS LTDA EPP"
 */
export const normalizeRazaoSocial = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculates Levenshtein distance between two strings
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
};

/**
 * Calculates similarity score (0.0 to 1.0) between two normalized strings
 */
export const stringSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeRazaoSocial(str1);
  const s2 = normalizeRazaoSocial(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
};

export interface RazaoSocialMatchResult {
  matched: boolean;
  score: number;
  level: 'strong' | 'review' | 'none';
  matchedSnippet?: string;
}

/**
 * Compares client's corporate name against a line from the PDF.
 * Checks for:
 * 1. Exact inclusion of the full normalized name (score: 1.0 -> 'strong')
 * 2. Sliding window of words for minor spelling differences/abbreviations (similarity >= 0.95 -> 'strong', >= 0.85 -> 'review')
 */
export const matchRazaoSocialInLine = (
  clientRazao: string,
  lineText: string
): RazaoSocialMatchResult => {
  const normClient = normalizeRazaoSocial(clientRazao);
  const normLine = normalizeRazaoSocial(lineText);

  if (!normClient || !normLine || normClient.length < 4) {
    return { matched: false, score: 0, level: 'none' };
  }

  // 1. Exact match or full phrase containment
  if (normLine === normClient || normLine.includes(normClient)) {
    return {
      matched: true,
      score: 1.0,
      level: 'strong',
      matchedSnippet: clientRazao
    };
  }

  // 2. Sliding window of words in the line
  const clientWords = normClient.split(' ').filter(w => w.length > 0);
  const lineWords = normLine.split(' ').filter(w => w.length > 0);

  if (lineWords.length === 0 || clientWords.length === 0) {
    return { matched: false, score: 0, level: 'none' };
  }

  let bestScore = 0;
  let bestSnippet = '';

  // Test window sizes: [clientWords.length - 1, clientWords.length, clientWords.length + 1]
  const minW = Math.max(1, clientWords.length - 1);
  const maxW = Math.min(lineWords.length, clientWords.length + 2);

  for (let wLen = minW; wLen <= maxW; wLen++) {
    for (let i = 0; i <= lineWords.length - wLen; i++) {
      const windowStr = lineWords.slice(i, i + wLen).join(' ');
      const sim = stringSimilarity(normClient, windowStr);
      if (sim > bestScore) {
        bestScore = sim;
        bestSnippet = windowStr;
      }
    }
  }

  // Thresholds per user instructions:
  // >= 95%: Strong match ("Razão Social")
  // 85% a 94%: Possible match ("Razão Social – conferir")
  // < 85%: Not a match
  if (bestScore >= 0.95) {
    return {
      matched: true,
      score: bestScore,
      level: 'strong',
      matchedSnippet: bestSnippet
    };
  } else if (bestScore >= 0.85) {
    return {
      matched: true,
      score: bestScore,
      level: 'review',
      matchedSnippet: bestSnippet
    };
  }

  return { matched: false, score: bestScore, level: 'none' };
};


/**
 * Normalizes a CNPJ by stripping non-numeric characters.
 */
export const normalizeCNPJ = (cnpj: string | null | undefined): string => {
  if (!cnpj) return '';
  return cnpj.toString().replace(/[^0-9]/g, '').trim();
};

/**
 * Sanitizes a CNPJ value: removes non-digits and filters out dummy/filler values
 * such as "-", "=", "SEM CNPJ", "ISENTO", "NULL", "S/N", "N/A".
 * Returns clean numeric string or empty string.
 */
export const sanitizeCNPJ = (cnpj: string | null | undefined): string => {
  if (!cnpj) return '';
  const str = cnpj.toString().trim();
  const upper = str.toUpperCase();
  if (
    upper === '-' ||
    upper === '=' ||
    upper === 'SEM CNPJ' ||
    upper === 'ISENTO' ||
    upper === 'NULL' ||
    upper === 'S/N' ||
    upper === 'N/A' ||
    upper === 'NAO POSSUI' ||
    upper === 'SEM DOCUMENTO'
  ) {
    return '';
  }
  return normalizeCNPJ(str);
};

/**
 * Formats a CNPJ (XX.XXX.XXX/XXXX-XX). Returns '-' if empty or invalid.
 */
export const formatCNPJ = (cnpj: string | null | undefined): string => {
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
