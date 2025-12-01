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