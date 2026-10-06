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

// ==========================================
// CLIENTES & EDITAIS TYPES
// ==========================================

export interface Cliente {
  id: string;
  codigo?: string;
  cnpj?: string;
  inscricao_estadual?: string; // Normalized: e.g. "036942910" or empty/null
  inscricao_estadual_formatada?: string; // Formatted: e.g. "0369429-10" or "Sem IE"
  razao_social: string;
  nome_fantasia?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export enum TipoEdital {
  INTIMACAO_IE = 'Intimação – Inscrição Estadual',
  INTIMACAO_ANTECIPACAO = 'Intimação para Regularização de Débitos – Antecipação Tributária',
  DESCREDENCIAMENTO_ANTECIPACAO = 'Descredenciamento da Antecipação Tributária',
  OUTRO = 'Outro / Não identificado'
}

export type MetodoIdentificacao = 
  | 'CNPJ' 
  | 'Inscrição Estadual' 
  | 'Razão Social' 
  | 'Razão Social – conferir'
  | 'Correspondência ambígua por Razão Social';

export interface SituacaoVisualInfo {
  texto: string;
  tipo: 'warning' | 'danger' | 'info';
  cor: string;
}

export interface EditalMatchResult {
  id: string;
  consultaId?: string;
  clienteId?: string;
  cliente?: Cliente;
  clientesCandidatos?: Cliente[]; // Lista de clientes quando houver correspondência ambígua por Razão Social
  razaoSocial: string;
  razaoSocialPdf?: string;
  cnpj?: string;
  inscricaoEstadual?: string; // Normalized or empty
  inscricaoEstadualFormatada?: string; // Formatted or "Sem IE"
  tipoEdital: TipoEdital | string;
  numeroEdital: string;
  arquivo: string;
  pagina: number;
  trechoOriginal: string;
  dataProcessamento: string;
  encontradoPor: MetodoIdentificacao;
  similaridade?: number; // 0.0 - 1.0 (e.g. 0.98 = 98%)
  situacaoVisual: SituacaoVisualInfo;
}

export interface ConsultaEdital {
  id: string;
  data: string;
  nome_arquivo: string;
  numero_edital: string;
  tipo_documento: TipoEdital | string;
  quantidade_paginas: number;
  quantidade_ies: number;
  quantidade_clientes_encontrados: number;
  usuario: string;
  resultados: EditalMatchResult[];
  created_at: string;
}

export interface EditalProcessingStats {
  totalPdfs: number;
  totalPaginas: number;
  totalIes: number;
  clientesAtivos: number;
  clientesEncontrados: number;
}

export interface SpreadsheetColumnMapping {
  colunaPlanilha: string;
  campoDestino: keyof Cliente | 'ignorar';
}

export interface ImportValidationSummary {
  total: number;
  novos: number;
  existentesCnpj: number; // Existentes por CNPJ
  existentesIe: number;   // Existentes por Inscrição Estadual
  existentes: number;     // Total já existentes
  duplicidadesArquivo: number; // Duplicidades dentro da própria planilha
  duplicidadesDescricao: string[];
  erros: number;
  errosDescricao: string[];
}
