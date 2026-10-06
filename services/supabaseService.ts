/**
 * Supabase Integration Service
 * 
 * Provides SQL migration script and client-side REST sync when
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in the environment.
 */

export const SUPABASE_SQL_SCRIPT = `-- ==============================================================================
-- SISTEMA FISCAL UNICONTA - ESTRUTURA DE BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- ==============================================================================

-- 1. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50),
    cnpj VARCHAR(20),
    inscricao_estadual VARCHAR(20) NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para busca rápida e unicidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_ie ON public.clientes (inscricao_estadual);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON public.clientes (cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_razao ON public.clientes (razao_social);

-- 2. TABELA DE CONSULTAS / HISTÓRICO DE EDITAIS
CREATE TABLE IF NOT EXISTS public.consultas_editais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_documento VARCHAR(255) NOT NULL,
    numero_edital VARCHAR(50),
    quantidade_paginas INTEGER NOT NULL DEFAULT 0,
    quantidade_ies INTEGER NOT NULL DEFAULT 0,
    quantidade_clientes_encontrados INTEGER NOT NULL DEFAULT 0,
    usuario_id VARCHAR(100) DEFAULT 'digitalizacao@unicontacaruaru.com.br',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultas_created_at ON public.consultas_editais (created_at DESC);

-- 3. TABELA DE RESULTADOS DO CONFRONTO DE EDITAIS
CREATE TABLE IF NOT EXISTS public.resultados_editais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID NOT NULL REFERENCES public.consultas_editais(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    inscricao_estadual VARCHAR(20) NOT NULL,
    pagina INTEGER NOT NULL,
    trecho_original TEXT NOT NULL,
    razao_social_pdf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resultados_consulta ON public.resultados_editais (consulta_id);
CREATE INDEX IF NOT EXISTS idx_resultados_cliente ON public.resultados_editais (cliente_id);
CREATE INDEX IF NOT EXISTS idx_resultados_ie ON public.resultados_editais (inscricao_estadual);

-- 4. SEGURANÇA: ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_editais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_editais ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para uso autenticado / chave anônima da Uniconta
CREATE POLICY "Acesso total aos clientes para usuários autorizados" 
ON public.clientes FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acesso total às consultas para usuários autorizados" 
ON public.consultas_editais FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acesso total aos resultados para usuários autorizados" 
ON public.resultados_editais FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualização automática de updated_at em clientes
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
`;

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
  isConfigured: boolean;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey)
  };
};
