export interface AccountingRecord {
  id: string; // Unique ID (usually key)
  numero: string;
  dataEmissao: string;
  valor: number;
  chave: string;
  sourceRow: any;
}

export interface SefazRecord {
  id: string; // Unique ID (usually key)
  chave: string;
  numero: string;
  serie: string;
  situacao: string; // Autorizada, Cancelada, etc.
  emitente: string;
  data: string;
  sourceRow: any;
}

export enum MatchStatus {
  MATCHED = 'Lançada',
  MISSING_IN_ACCOUNTING = 'Não Lançada',
  MISSING_IN_SEFAZ = 'Não encontrada na SEFAZ',
  CANCELLED = 'Cancelada'
}

export interface ComparisonResult {
  id: string;
  chave: string;
  numero: string;
  serie: string;
  data: string;
  valor: number | string;
  situacaoSefaz: string;
  status: MatchStatus;
  sefazRecord?: SefazRecord;
  accountingRecord?: AccountingRecord;
}

export interface SummaryStats {
  total: number;
  matched: number;
  missingInAccounting: number;
  cancelled: number;
  others: number;
}