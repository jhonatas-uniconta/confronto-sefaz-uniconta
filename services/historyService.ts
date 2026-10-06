import { ConsultaEdital, EditalMatchResult, TipoEdital } from '../types';

const STORAGE_KEY = 'uniconta_consultas_editais_v1';

// Initial sample history item so user sees how history looks
const DEFAULT_HISTORY: ConsultaEdital[] = [
  {
    id: 'hist-001',
    data: '2026-03-20T14:32:00.000Z',
    nome_arquivo: 'Edital_Intimacao_037_2026_SEFAZ_PE.pdf',
    numero_edital: '037/2026',
    tipo_documento: TipoEdital.INTIMACAO_IE,
    quantidade_paginas: 42,
    quantidade_ies: 1250,
    quantidade_clientes_encontrados: 1,
    usuario: 'digitalizacao@unicontacaruaru.com.br',
    created_at: '2026-03-20T14:32:00.000Z',
    resultados: [
      {
        id: 'res-seed-01',
        razaoSocial: 'ISABEL CRISTINA CAVALCANTI RODRIGUES',
        razaoSocialPdf: 'ISABEL CRISTINA CAVALCANTI RODRIGUES',
        cnpj: '10.316.742/0001-85',
        inscricaoEstadual: '036942910',
        inscricaoEstadualFormatada: '0369429-10',
        tipoEdital: TipoEdital.INTIMACAO_IE,
        numeroEdital: '037/2026',
        arquivo: 'Edital_Intimacao_037_2026_SEFAZ_PE.pdf',
        pagina: 27,
        trechoOriginal: '0369429-10 10.316.742 ISABEL CRISTINA CAVALCANTI RODRIGUES',
        dataProcessamento: '2026-03-20T14:32:00.000Z',
        situacaoVisual: {
          texto: 'Cliente intimado a sanar irregularidade',
          tipo: 'danger',
          cor: 'bg-red-50 text-red-700 border-red-300'
        }
      }
    ]
  }
];

export const getConsultas = (): ConsultaEdital[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_HISTORY));
      return DEFAULT_HISTORY;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_HISTORY;
  } catch (e) {
    console.error('Erro ao ler histórico de editais:', e);
    return DEFAULT_HISTORY;
  }
};

export const saveConsulta = (consultaData: Omit<ConsultaEdital, 'id' | 'created_at'>): ConsultaEdital => {
  const current = getConsultas();
  const newConsulta: ConsultaEdital = {
    ...consultaData,
    id: 'hist-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
    created_at: new Date().toISOString()
  };

  const updated = [newConsulta, ...current];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Erro ao salvar consulta no LocalStorage:', e);
  }
  return newConsulta;
};

export const getConsultaById = (id: string): ConsultaEdital | undefined => {
  const all = getConsultas();
  return all.find(c => c.id === id);
};

export const deleteConsulta = (id: string): boolean => {
  const current = getConsultas();
  const filtered = current.filter(c => c.id !== id);
  if (filtered.length !== current.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('Erro ao excluir consulta:', e);
    }
  }
  return false;
};
