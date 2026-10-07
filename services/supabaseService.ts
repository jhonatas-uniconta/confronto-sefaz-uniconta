import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cliente } from '../types';
import { sanitizeCNPJ, sanitizeIE, formatCNPJ, formatIE } from '../utils';

/**
 * SQL completo para criação da tabela clientes e políticas RLS no Supabase.
 * Execute no Supabase SQL Editor.
 */
export const SUPABASE_SQL_SCRIPT = `-- ==============================================================================
-- SISTEMA FISCAL UNICONTA - TABELA E POLÍTICAS DA BASE DE CLIENTES
-- Execute este script no SQL Editor do seu projeto Supabase (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. CRIAR OU AJUSTAR A TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50),
    cnpj VARCHAR(20),                     -- Normalizado (apenas números), opcional
    inscricao_estadual VARCHAR(20),       -- Normalizada (apenas números), opcional
    razao_social VARCHAR(255) NOT NULL,    -- Obrigatória, PODE REPETIR
    nome_fantasia VARCHAR(255),           -- Opcional, pode repetir
    ativo BOOLEAN NOT NULL DEFAULT true,  -- Ativo/Inativo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT                       -- Para auditoria (opcional)
);

-- Garantir que colunas estejam com as regras corretas caso a tabela já exista:
ALTER TABLE public.clientes ALTER COLUMN razao_social SET NOT NULL;
ALTER TABLE public.clientes ALTER COLUMN ativo SET DEFAULT true;
ALTER TABLE public.clientes ALTER COLUMN inscricao_estadual DROP NOT NULL;
ALTER TABLE public.clientes ALTER COLUMN cnpj DROP NOT NULL;

-- 2. ÍNDICES DE PERFORMANCE E REGRAS DE DUPLICIDADE
-- A) Razão Social: PODE REPETIR (índice comum de busca rápida, SEM restrição UNIQUE)
CREATE INDEX IF NOT EXISTS idx_clientes_razao ON public.clientes (razao_social);

-- B) CNPJ: NÃO PODE REPETIR quando preenchido (permite múltiplos nulos ou vazios)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_cnpj_unique
ON public.clientes (cnpj)
WHERE cnpj IS NOT NULL AND cnpj <> '';

-- C) Inscrição Estadual: NÃO PODE REPETIR quando preenchida (permite múltiplos nulos ou vazios)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_ie_unique
ON public.clientes (inscricao_estadual)
WHERE inscricao_estadual IS NOT NULL AND inscricao_estadual <> '';

-- 3. TRIGGER PARA ATUALIZAR AUTOMATICAMENTE updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clientes_updated_at ON public.clientes;
CREATE TRIGGER trigger_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Revogar acesso público (anon) e permitir acesso para autenticados
REVOKE ALL ON public.clientes FROM anon;
GRANT ALL ON public.clientes TO authenticated;

-- Remover políticas antigas para evitar duplicidade de nomes
DROP POLICY IF EXISTS "Permitir SELECT para autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir INSERT para autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir UPDATE para autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir DELETE para autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Acesso total aos clientes para usuários autorizados" ON public.clientes;
DROP POLICY IF EXISTS "Permitir SELECT para anon" ON public.clientes;
DROP POLICY IF EXISTS "Permitir INSERT para anon" ON public.clientes;
DROP POLICY IF EXISTS "Permitir UPDATE para anon" ON public.clientes;
DROP POLICY IF EXISTS "Permitir DELETE para anon" ON public.clientes;

-- 5. POLÍTICAS DE ACESSO EXCLUSIVAS PARA USUÁRIOS AUTENTICADOS (Supabase Auth)
-- Todos os colaboradores autenticados acessam a Base de Clientes compartilhada
CREATE POLICY "Permitir SELECT para autenticados" 
ON public.clientes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir INSERT para autenticados" 
ON public.clientes FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE para autenticados" 
ON public.clientes FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir DELETE para autenticados" 
ON public.clientes FOR DELETE 
TO authenticated 
USING (true);

-- IMPORTANTE: Nenhuma permissão de SELECT/INSERT/UPDATE/DELETE é concedida à role 'anon'.
-- Usuários sem login no Supabase Auth são bloqueados diretamente no banco de dados.
`;

/**
 * SQL completo para criação das tabelas do Histórico de Confrontos de Editais
 * e políticas RLS no Supabase.
 */
export const SUPABASE_HISTORICO_SQL_SCRIPT = `-- ==============================================================================
-- SISTEMA FISCAL UNICONTA - HISTÓRICO DE CONFRONTOS DE EDITAIS
-- Execute este script no SQL Editor do seu projeto Supabase (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. CRIAR TABELA DE CONSULTAS DE EDITAIS (CABEÇALHO)
CREATE TABLE IF NOT EXISTS public.consultas_editais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo TEXT NOT NULL,
    numero_edital VARCHAR(50),
    tipo_documento VARCHAR(100),
    quantidade_paginas INTEGER DEFAULT 0,
    quantidade_ies INTEGER DEFAULT 0,
    quantidade_clientes_encontrados INTEGER DEFAULT 0,
    usuario_id UUID,
    usuario_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observacao TEXT
);

-- 2. CRIAR TABELA DE RESULTADOS DOS EDITAIS (DETALHES / CLIENTES ENCONTRADOS)
CREATE TABLE IF NOT EXISTS public.resultados_editais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas_editais(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    razao_social TEXT NOT NULL,
    razao_social_pdf TEXT,
    cnpj VARCHAR(20),
    inscricao_estadual VARCHAR(20),
    inscricao_estadual_formatada VARCHAR(30),
    tipo_edital VARCHAR(100),
    numero_edital VARCHAR(50),
    arquivo TEXT,
    pagina INTEGER DEFAULT 1,
    trecho_original TEXT,
    encontrado_por VARCHAR(100),
    similaridade NUMERIC(5,4),
    situacao_texto TEXT,
    situacao_tipo VARCHAR(20),
    situacao_cor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_consultas_created_at ON public.consultas_editais (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultas_numero ON public.consultas_editais (numero_edital);
CREATE INDEX IF NOT EXISTS idx_resultados_consulta_id ON public.resultados_editais (consulta_id);
CREATE INDEX IF NOT EXISTS idx_resultados_razao ON public.resultados_editais (razao_social);
CREATE INDEX IF NOT EXISTS idx_resultados_cnpj ON public.resultados_editais (cnpj);
CREATE INDEX IF NOT EXISTS idx_resultados_ie ON public.resultados_editais (inscricao_estadual);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.consultas_editais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_editais ENABLE ROW LEVEL SECURITY;

-- Revogar acesso anônimo (anon) e conceder aos usuários autenticados
REVOKE ALL ON public.consultas_editais FROM anon;
GRANT ALL ON public.consultas_editais TO authenticated;

REVOKE ALL ON public.resultados_editais FROM anon;
GRANT ALL ON public.resultados_editais TO authenticated;

-- Limpar políticas anteriores para evitar duplicidade de nomes
DROP POLICY IF EXISTS "Permitir SELECT consultas para autenticados" ON public.consultas_editais;
DROP POLICY IF EXISTS "Permitir INSERT consultas para autenticados" ON public.consultas_editais;
DROP POLICY IF EXISTS "Permitir UPDATE consultas para autenticados" ON public.consultas_editais;
DROP POLICY IF EXISTS "Permitir DELETE consultas para autenticados" ON public.consultas_editais;

DROP POLICY IF EXISTS "Permitir SELECT resultados para autenticados" ON public.resultados_editais;
DROP POLICY IF EXISTS "Permitir INSERT resultados para autenticados" ON public.resultados_editais;
DROP POLICY IF EXISTS "Permitir UPDATE resultados para autenticados" ON public.resultados_editais;
DROP POLICY IF EXISTS "Permitir DELETE resultados para autenticados" ON public.resultados_editais;

-- Políticas para consultas_editais
CREATE POLICY "Permitir SELECT consultas para autenticados" 
ON public.consultas_editais FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir INSERT consultas para autenticados" 
ON public.consultas_editais FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE consultas para autenticados" 
ON public.consultas_editais FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir DELETE consultas para autenticados" 
ON public.consultas_editais FOR DELETE 
TO authenticated 
USING (true);

-- Políticas para resultados_editais
CREATE POLICY "Permitir SELECT resultados para autenticados" 
ON public.resultados_editais FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir INSERT resultados para autenticados" 
ON public.resultados_editais FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE resultados para autenticados" 
ON public.resultados_editais FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir DELETE resultados para autenticados" 
ON public.resultados_editais FOR DELETE 
TO authenticated 
USING (true);
`;

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
  isConfigured: boolean;
}

// Segurança: Remove quaisquer credenciais legadas do Supabase que possam ter sido salvas anteriormente no localStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('uniconta_supabase_url');
    localStorage.removeItem('uniconta_supabase_anon_key');
  } catch {}
}

/**
 * Lê a configuração do Supabase EXCLUSIVAMENTE a partir das variáveis de ambiente configuradas no Vercel/Vite.
 * Não utiliza localStorage para credenciais e não permite configuração manual pelo navegador.
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const cleanUrl = typeof envUrl === 'string' ? envUrl.trim() : '';
  const cleanKey = typeof envKey === 'string' ? envKey.trim() : '';

  // Validar se não é placeholder e se possui URL válida
  const isPlaceholderUrl = cleanUrl.includes('seu-projeto') || cleanUrl === '';
  const isPlaceholderKey = cleanKey.includes('sua-chave') || cleanKey === '';

  const isValidUrl = Boolean(
    !isPlaceholderUrl && 
    (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))
  );
  const isValidKey = Boolean(!isPlaceholderKey && cleanKey.length > 0);

  const isConfigured = Boolean(isValidUrl && isValidKey);

  return {
    url: isConfigured ? cleanUrl : undefined,
    anonKey: isConfigured ? cleanKey : undefined,
    isConfigured
  };
};

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfig().isConfigured;
};

export const clearSupabaseConfig = (): void => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('uniconta_supabase_url');
      localStorage.removeItem('uniconta_supabase_anon_key');
    } catch {}
  }
  supabaseInstance = null;
  lastClientUrl = '';
  lastClientKey = '';
};

let supabaseInstance: SupabaseClient | null = null;
let lastClientUrl = '';
let lastClientKey = '';

/**
 * Retorna uma instância ativa do cliente Supabase ou null se não configurado
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  if (!supabaseInstance || lastClientUrl !== config.url || lastClientKey !== config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      lastClientUrl = config.url;
      lastClientKey = config.anonKey;
    } catch (e) {
      console.error('Falha ao inicializar o cliente Supabase:', e);
      return null;
    }
  }

  return supabaseInstance;
};

/**
 * Testa se a tabela clientes existe e é acessível no Supabase
 */
export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string; tableExists: boolean }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não está configurado. Defina a URL e Anon Key.',
      tableExists: false
    };
  }

  try {
    const { data, error } = await client
      .from('clientes')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation "public.clientes" does not exist') || error.message.includes('clientes')) {
        return {
          success: true,
          message: 'Conectado ao Supabase, mas a tabela "clientes" ainda não foi criada. Execute o script SQL no editor do Supabase.',
          tableExists: false
        };
      }
      return {
        success: false,
        message: `Erro do Supabase: ${error.message}`,
        tableExists: false
      };
    }

    return {
      success: true,
      message: 'Conexão ativa com a tabela "clientes" no Supabase.',
      tableExists: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha na conexão com o Supabase.',
      tableExists: false
    };
  }
};

/**
 * Testa se as tabelas do Histórico de Editais (consultas_editais e resultados_editais) existem no Supabase
 */
export const testSupabaseHistoricoConnection = async (): Promise<{ success: boolean; message: string; tablesExist: boolean }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não está configurado. Defina a URL e Anon Key.',
      tablesExist: false
    };
  }

  try {
    const { error: cErr } = await client
      .from('consultas_editais')
      .select('id')
      .limit(1);

    if (cErr) {
      if (cErr.code === '42P01' || cErr.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Tabela "consultas_editais" ainda não foi criada no Supabase. Execute o script SQL no editor do Supabase.',
          tablesExist: false
        };
      }
      return {
        success: false,
        message: `Erro na tabela de consultas: ${cErr.message}`,
        tablesExist: false
      };
    }

    const { error: rErr } = await client
      .from('resultados_editais')
      .select('id')
      .limit(1);

    if (rErr) {
      if (rErr.code === '42P01' || rErr.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Tabela "resultados_editais" ainda não foi criada no Supabase. Execute o script SQL no editor do Supabase.',
          tablesExist: false
        };
      }
      return {
        success: false,
        message: `Erro na tabela de resultados: ${rErr.message}`,
        tablesExist: false
      };
    }

    return {
      success: true,
      message: 'Tabelas "consultas_editais" e "resultados_editais" conectadas e operacionais no Supabase.',
      tablesExist: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha na verificação das tabelas de histórico.',
      tablesExist: false
    };
  }
};

/**
 * Converte um registro retornado do Supabase no formato Cliente da aplicação
 */
export const mapRowToCliente = (row: any): Cliente => {
  const cleanIE = sanitizeIE(row.inscricao_estadual);
  const cleanCNPJ = sanitizeCNPJ(row.cnpj);
  return {
    id: row.id,
    codigo: row.codigo || '',
    cnpj: cleanCNPJ ? formatCNPJ(cleanCNPJ) : '',
    inscricao_estadual: cleanIE || '',
    inscricao_estadual_formatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
    razao_social: row.razao_social || '',
    nome_fantasia: row.nome_fantasia || '',
    ativo: row.ativo !== false,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    created_by: row.created_by
  };
};

/**
 * Converte dados do Cliente para o formato salvo no banco do Supabase.
 * Salva CNPJ e IE exclusivamente normalizados (apenas números ou null).
 */
export const mapClienteToRow = (client: Partial<Cliente>, userId?: string) => {
  const cleanCNPJ = sanitizeCNPJ(client.cnpj);
  const cleanIE = sanitizeIE(client.inscricao_estadual);
  return {
    codigo: client.codigo?.trim() || null,
    cnpj: cleanCNPJ || null,                     // Apenas dígitos ou NULL
    inscricao_estadual: cleanIE || null,         // Apenas dígitos ou NULL
    razao_social: client.razao_social?.trim().toUpperCase(),
    nome_fantasia: client.nome_fantasia?.trim().toUpperCase() || null,
    ativo: client.ativo !== undefined ? client.ativo : true,
    created_by: userId || client.created_by || 'digitalizacao@unicontacaruaru.com.br',
    updated_at: new Date().toISOString()
  };
};
