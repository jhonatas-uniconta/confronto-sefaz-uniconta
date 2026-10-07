import { ConsultaEdital, EditalMatchResult, TipoEdital } from '../types';
import { sanitizeCNPJ, sanitizeIE, formatCNPJ, formatIE } from '../utils';
import { getSupabaseClient } from './supabaseService';

const STORAGE_KEY = 'uniconta_consultas_editais_v1';
const LEGACY_STORAGE_KEY = 'uniconta_historico_editais';
const MIGRATION_KEY = 'uniconta_historico_migrated_v1';

// Base de exemplo legada para fallback inicial caso necessário
export const DEFAULT_HISTORY: ConsultaEdital[] = [
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
        encontradoPor: 'Inscrição Estadual',
        situacaoVisual: {
          texto: 'Cliente intimado a sanar irregularidade',
          tipo: 'danger',
          cor: 'bg-red-50 text-red-700 border-red-300'
        }
      }
    ]
  }
];

/**
 * Validador de formato UUID v4
 */
const isValidUUID = (str?: string | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
};

/**
 * Converte linha do banco (tabela resultados_editais) para o formato EditalMatchResult
 */
export const mapRowToEditalMatchResult = (row: any): EditalMatchResult => {
  const cleanCNPJ = sanitizeCNPJ(row.cnpj);
  const cleanIE = sanitizeIE(row.inscricao_estadual);

  const situacaoTexto = row.situacao_texto || 'Localizado';
  const situacaoTipo = (row.situacao_tipo || 'danger') as 'warning' | 'danger' | 'info';
  const situacaoCor = row.situacao_cor || 'bg-red-50 text-red-700 border-red-300';

  return {
    id: String(row.id || ''),
    consultaId: row.consulta_id || undefined,
    clienteId: row.cliente_id || undefined,
    razaoSocial: row.razao_social || '',
    razaoSocialPdf: row.razao_social_pdf || row.razao_social || '',
    cnpj: cleanCNPJ ? formatCNPJ(cleanCNPJ) : (row.cnpj || ''),
    inscricaoEstadual: cleanIE || '',
    inscricaoEstadualFormatada: row.inscricao_estadual_formatada || (cleanIE ? formatIE(cleanIE) : 'Sem IE'),
    tipoEdital: row.tipo_edital || TipoEdital.OUTRO,
    numeroEdital: row.numero_edital || '',
    arquivo: row.arquivo || '',
    pagina: typeof row.pagina === 'number' ? row.pagina : 1,
    trechoOriginal: row.trecho_original || '',
    dataProcessamento: row.created_at || new Date().toISOString(),
    encontradoPor: (row.encontrado_por || 'Inscrição Estadual') as any,
    similaridade: typeof row.similaridade === 'number' ? row.similaridade : undefined,
    situacaoVisual: {
      texto: situacaoTexto,
      tipo: situacaoTipo,
      cor: situacaoCor
    }
  };
};

/**
 * Converte linha do banco (tabela consultas_editais) para o formato ConsultaEdital
 */
export const mapRowToConsultaEdital = (row: any, resultados: EditalMatchResult[] = []): ConsultaEdital => {
  return {
    id: String(row.id || ''),
    data: row.created_at || new Date().toISOString(),
    nome_arquivo: row.nome_arquivo || '',
    numero_edital: row.numero_edital || '',
    tipo_documento: row.tipo_documento || '',
    quantidade_paginas: Number(row.quantidade_paginas) || 0,
    quantidade_ies: Number(row.quantidade_ies) || 0,
    quantidade_clientes_encontrados: Number(row.quantidade_clientes_encontrados) || 0,
    usuario: row.usuario_email || 'Operador',
    created_at: row.created_at || new Date().toISOString(),
    resultados: Array.isArray(resultados) ? resultados : []
  };
};

/**
 * Converte item de resultado para linha da tabela resultados_editais
 */
export const mapResultToRow = (res: EditalMatchResult, consultaId: string) => {
  const cleanCNPJ = sanitizeCNPJ(res.cnpj);
  const cleanIE = sanitizeIE(res.inscricaoEstadual);

  return {
    consulta_id: consultaId,
    cliente_id: isValidUUID(res.clienteId) ? res.clienteId : null,
    razao_social: res.razaoSocial ? res.razaoSocial.trim().toUpperCase() : 'NÃO INFORMADO',
    razao_social_pdf: res.razaoSocialPdf ? res.razaoSocialPdf.trim().toUpperCase() : null,
    cnpj: cleanCNPJ || null,
    inscricao_estadual: cleanIE || null,
    inscricao_estadual_formatada: res.inscricaoEstadualFormatada || (cleanIE ? formatIE(cleanIE) : null),
    tipo_edital: res.tipoEdital || null,
    numero_edital: res.numeroEdital || null,
    arquivo: res.arquivo || null,
    pagina: typeof res.pagina === 'number' ? res.pagina : 1,
    trecho_original: res.trechoOriginal || null,
    encontrado_por: res.encontradoPor || null,
    similaridade: typeof res.similaridade === 'number' ? res.similaridade : null,
    situacao_texto: res.situacaoVisual?.texto || null,
    situacao_tipo: res.situacaoVisual?.tipo || null,
    situacao_cor: res.situacaoVisual?.cor || null
  };
};

/**
 * Lê o histórico armazenado localmente (usado para migração ou fallback offline)
 */
export const getLocalConsultas = (): ConsultaEdital[] => {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Erro ao ler consultas locais:', e);
    return [];
  }
};

/**
 * Grava consultas localmente
 */
export const saveLocalConsultas = (consultas: ConsultaEdital[]): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consultas));
    }
  } catch (e) {
    console.error('Erro ao salvar consultas locais:', e);
  }
};

/**
 * Verifica se existem consultas locais pendentes de migração para o Supabase
 */
export const hasLocalHistoryToMigrate = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const isAlreadyMigrated = localStorage.getItem(MIGRATION_KEY) === 'true';
    if (isAlreadyMigrated) return false;

    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
};

/**
 * Consulta todas as consultas de editais gravadas no Supabase.
 * Retorna sempre um array seguro de ConsultaEdital.
 */
export const getConsultas = async (): Promise<ConsultaEdital[]> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Tentar carregar consultas com join na tabela resultados_editais
      const { data, error } = await supabase
        .from('consultas_editais')
        .select(`
          *,
          resultados_editais (*)
        `)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(row => {
          const resList = Array.isArray(row.resultados_editais)
            ? row.resultados_editais.map(mapRowToEditalMatchResult)
            : [];
          return mapRowToConsultaEdital(row, resList);
        });
      }

      if (error) {
        console.warn('Join falhou ou tabelas sem FK direta, buscando consultas_editais diretamente:', error.message);
        const { data: directData, error: directError } = await supabase
          .from('consultas_editais')
          .select('*')
          .order('created_at', { ascending: false });

        if (!directError && Array.isArray(directData)) {
          return directData.map(row => mapRowToConsultaEdital(row, []));
        }
      }
    } catch (err) {
      console.error('Falha de rede ao consultar histórico no Supabase:', err);
    }
  }

  // Fallback local se o Supabase não estiver disponível
  const local = getLocalConsultas();
  return Array.isArray(local) ? local : [];
};

/**
 * Busca uma consulta completa por ID com todos os seus resultados_editais
 */
export const getConsultaById = async (id: string): Promise<ConsultaEdital | null> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data: cRow, error: cErr } = await supabase
        .from('consultas_editais')
        .select('*')
        .eq('id', id)
        .single();

      if (!cErr && cRow) {
        const { data: rRows, error: rErr } = await supabase
          .from('resultados_editais')
          .select('*')
          .eq('consulta_id', id)
          .order('pagina', { ascending: true });

        const resultados = !rErr && Array.isArray(rRows)
          ? rRows.map(mapRowToEditalMatchResult)
          : [];

        return mapRowToConsultaEdital(cRow, resultados);
      }
    } catch (e) {
      console.error('Erro ao buscar detalhes da consulta no Supabase:', e);
    }
  }

  const local = getLocalConsultas();
  const found = local.find(c => c.id === id);
  return found || null;
};

/**
 * Salva uma nova consulta de edital no Supabase.
 * PERSISTE SEMPRE A CONSULTA, mesmo quando quantidade_clientes_encontrados === 0 (resultados vazios).
 */
export const saveConsulta = async (
  consultaData: Omit<ConsultaEdital, 'id' | 'created_at'>
): Promise<ConsultaEdital> => {
  const supabase = getSupabaseClient();
  
  // Obter identificação do usuário logado se disponível
  let userId: string | null = null;
  let userEmail: string = consultaData.usuario || 'Operador';

  if (supabase) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        userId = isValidUUID(authData.user.id) ? authData.user.id : null;
        userEmail = authData.user.email || userEmail;
      }
    } catch {}
  }

  if (supabase) {
    try {
      const payloadConsulta = {
        nome_arquivo: consultaData.nome_arquivo,
        numero_edital: consultaData.numero_edital || null,
        tipo_documento: consultaData.tipo_documento || null,
        quantidade_paginas: Number(consultaData.quantidade_paginas) || 0,
        quantidade_ies: Number(consultaData.quantidade_ies) || 0,
        quantidade_clientes_encontrados: Number(consultaData.quantidade_clientes_encontrados) || 0,
        usuario_id: userId,
        usuario_email: userEmail,
        observacao: (consultaData as any).observacao || null
      };

      // 1. Inserir cabeçalho em public.consultas_editais
      const { data: consultaRow, error: consultaErr } = await supabase
        .from('consultas_editais')
        .insert([payloadConsulta])
        .select()
        .single();

      if (consultaErr) {
        console.error('Erro ao inserir consulta_edital no Supabase:', consultaErr.message);
      } else if (consultaRow) {
        const consultaId = consultaRow.id;
        const resultadosInseridos: EditalMatchResult[] = [];

        // 2. Se houver resultados (clientes encontrados), inserir em public.resultados_editais
        if (Array.isArray(consultaData.resultados) && consultaData.resultados.length > 0) {
          const rowsResultados = consultaData.resultados.map(res => mapResultToRow(res, consultaId));

          const { data: rData, error: rErr } = await supabase
            .from('resultados_editais')
            .insert(rowsResultados)
            .select();

          if (rErr) {
            console.error('Erro ao inserir resultados_editais no Supabase:', rErr.message);
          } else if (Array.isArray(rData)) {
            resultadosInseridos.push(...rData.map(mapRowToEditalMatchResult));
          }
        }

        const finalResult = mapRowToConsultaEdital(
          consultaRow,
          resultadosInseridos.length > 0 ? resultadosInseridos : consultaData.resultados
        );
        return finalResult;
      }
    } catch (e) {
      console.error('Falha de rede ao salvar consulta no Supabase:', e);
    }
  }

  // Fallback Local se Supabase não estiver acessível
  const current = getLocalConsultas();
  const newConsulta: ConsultaEdital = {
    ...consultaData,
    usuario: userEmail,
    id: 'hist-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
    created_at: new Date().toISOString()
  };

  const updated = [newConsulta, ...current];
  saveLocalConsultas(updated);
  return newConsulta;
};

/**
 * Exclui uma consulta de edital do Supabase (e em cascata seus resultados)
 */
export const deleteConsulta = async (id: string): Promise<boolean> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Tentar excluir registros filhos como garantia caso ON DELETE CASCADE não esteja configurado
      await supabase
        .from('resultados_editais')
        .delete()
        .eq('consulta_id', id);

      // 2. Excluir cabeçalho da consulta
      const { error } = await supabase
        .from('consultas_editais')
        .delete()
        .eq('id', id);

      if (!error) {
        return true;
      }
      console.error('Erro ao excluir consulta do Supabase:', error.message);
    } catch (e) {
      console.error('Falha ao excluir consulta do Supabase:', e);
    }
  }

  // Fallback Local
  const current = getLocalConsultas();
  const filtered = current.filter(c => c.id !== id);
  if (filtered.length !== current.length) {
    saveLocalConsultas(filtered);
    return true;
  }
  return false;
};

/**
 * Migra os históricos salvos localmente no navegador para o Supabase
 */
export const migrateLocalHistoryToSupabase = async (): Promise<{
  success: boolean;
  migratedCount: number;
  error?: string;
}> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      migratedCount: 0,
      error: 'Supabase não está configurado.'
    };
  }

  const localHistory = getLocalConsultas();
  if (localHistory.length === 0) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MIGRATION_KEY, 'true');
    }
    return {
      success: true,
      migratedCount: 0
    };
  }

  let count = 0;
  try {
    for (const item of localHistory) {
      await saveConsulta({
        data: item.data || item.created_at || new Date().toISOString(),
        nome_arquivo: item.nome_arquivo,
        numero_edital: item.numero_edital,
        tipo_documento: item.tipo_documento,
        quantidade_paginas: item.quantidade_paginas,
        quantidade_ies: item.quantidade_ies,
        quantidade_clientes_encontrados: item.quantidade_clientes_encontrados,
        usuario: item.usuario,
        resultados: item.resultados || []
      });
      count++;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(MIGRATION_KEY, 'true');
      // Limpar chave local antiga para não ocupar espaço desnecessário
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    return {
      success: true,
      migratedCount: count
    };
  } catch (err: any) {
    return {
      success: false,
      migratedCount: count,
      error: err?.message || 'Falha ao migrar histórico para o Supabase.'
    };
  }
};
