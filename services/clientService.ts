import { Cliente } from '../types';
import { normalizeIE, formatIE, normalizeCNPJ, formatCNPJ, sanitizeCNPJ, sanitizeIE } from '../utils';
import { getSupabaseClient, mapRowToCliente, mapClienteToRow } from './supabaseService';

const STORAGE_KEY = 'uniconta_clientes_v1';
const MIGRATION_KEY = 'uniconta_clientes_migrated_v1';

// Base de exemplo para fallback inicial caso ainda não haja clientes no banco
export const DEFAULT_CLIENTS: Cliente[] = [
  {
    id: 'cli-001',
    codigo: '1001',
    cnpj: '10316742000185',
    inscricao_estadual: '036942910',
    inscricao_estadual_formatada: '0369429-10',
    razao_social: 'ISABEL CRISTINA CAVALCANTI RODRIGUES',
    nome_fantasia: 'ISABEL CONFECCOES',
    ativo: true,
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-01-10T08:00:00.000Z'
  },
  {
    id: 'cli-002',
    codigo: '1002',
    cnpj: '08452190000132',
    inscricao_estadual: '048291044',
    inscricao_estadual_formatada: '0482910-44',
    razao_social: 'COMERCIAL ALIMENTOS DO AGRESTE LTDA',
    nome_fantasia: 'DISTRIBUIDORA AGRESTE',
    ativo: true,
    created_at: '2026-01-12T10:30:00.000Z',
    updated_at: '2026-01-12T10:30:00.000Z'
  },
  {
    id: 'cli-003',
    codigo: '1003',
    cnpj: '12876543000190',
    inscricao_estadual: '029481230',
    inscricao_estadual_formatada: '0294812-30',
    razao_social: 'TEXTIL SANTA CRUZ EIRELI',
    nome_fantasia: 'SANTA CRUZ MODAS',
    ativo: true,
    created_at: '2026-01-15T14:20:00.000Z',
    updated_at: '2026-01-15T14:20:00.000Z'
  },
  {
    id: 'cli-004',
    codigo: '1004',
    cnpj: '03123456000177',
    inscricao_estadual: '018374288',
    inscricao_estadual_formatada: '0183742-88',
    razao_social: 'AUTO POSTO CARUARU CENTRAL LTDA',
    nome_fantasia: 'POSTO CENTRAL',
    ativo: true,
    created_at: '2026-02-01T09:15:00.000Z',
    updated_at: '2026-02-01T09:15:00.000Z'
  },
  {
    id: 'cli-005',
    codigo: '1005',
    cnpj: '24987654000112',
    inscricao_estadual: '051239871',
    inscricao_estadual_formatada: '0512398-71',
    razao_social: 'FARMACIA POPULAR DE PERNAMBUCO S/A',
    nome_fantasia: 'REDE POPULAR FARMA',
    ativo: true,
    created_at: '2026-02-05T11:45:00.000Z',
    updated_at: '2026-02-05T11:45:00.000Z'
  },
  {
    id: 'cli-006',
    codigo: '1006',
    cnpj: '18765432000101',
    inscricao_estadual: '',
    inscricao_estadual_formatada: 'Sem IE',
    razao_social: 'INDUSTRIA METALURGICA DO VALE LTDA',
    nome_fantasia: 'METALVALE MATRIZ',
    ativo: true,
    created_at: '2026-02-10T16:00:00.000Z',
    updated_at: '2026-02-10T16:00:00.000Z'
  },
  {
    id: 'cli-007',
    codigo: '1007',
    cnpj: '18765432000292',
    inscricao_estadual: '',
    inscricao_estadual_formatada: 'Sem IE',
    razao_social: 'INDUSTRIA METALURGICA DO VALE LTDA',
    nome_fantasia: 'METALVALE FILIAL',
    ativo: true,
    created_at: '2026-02-10T16:30:00.000Z',
    updated_at: '2026-02-10T16:30:00.000Z'
  },
  {
    id: 'cli-008',
    codigo: '1008',
    cnpj: '12345678000190',
    inscricao_estadual: '',
    inscricao_estadual_formatada: 'Sem IE',
    razao_social: 'EMPRESA ABC SERVICOS LTDA',
    nome_fantasia: 'ABC SERVICOS',
    ativo: true,
    created_at: '2026-02-15T09:00:00.000Z',
    updated_at: '2026-02-15T09:00:00.000Z'
  }
];

/**
 * Lê os clientes do armazenamento local (usado para migração e backup)
 */
export const getLocalClients = (): Cliente[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      return DEFAULT_CLIENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_CLIENTS;
  } catch (e) {
    console.error('Erro ao ler clientes do LocalStorage:', e);
    return DEFAULT_CLIENTS;
  }
};

export const saveClientsToStorage = (clients: Cliente[]): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    }
  } catch (e) {
    console.error('Erro ao gravar clientes no LocalStorage:', e);
  }
};

/**
 * Verifica se existem clientes locais disponíveis para migração ao Supabase
 */
export const hasLocalClientsToMigrate = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const isAlreadyMigrated = localStorage.getItem(MIGRATION_KEY) === 'true';
    const raw = localStorage.getItem(STORAGE_KEY);
    return !isAlreadyMigrated && Boolean(raw);
  } catch {
    return false;
  }
};

/**
 * Validates a client candidate.
 * Mandatory fields: Razão Social.
 * Optional fields: CNPJ, Inscrição Estadual, Código, Nome Fantasia.
 *
 * Duplication rules:
 * 1. Razão Social: PODE REPETIR! Não bloqueia cadastro, edição nem importação.
 * 2. CNPJ: NÃO PODE REPETIR quando preenchido.
 * 3. Inscrição Estadual: NÃO PODE REPETIR quando preenchida.
 */
export const validateClient = (
  candidate: Partial<Cliente>,
  existingClients: Cliente[],
  currentId?: string
): string | null => {
  if (!candidate.razao_social || candidate.razao_social.trim() === '') {
    return 'A Razão Social é obrigatória.';
  }

  // 1. Validar unicidade de CNPJ (quando preenchido)
  const cleanCNPJ = sanitizeCNPJ(candidate.cnpj);
  if (cleanCNPJ && cleanCNPJ.length >= 11) {
    const dupCNPJ = existingClients.find(
      c => c.id !== currentId && sanitizeCNPJ(c.cnpj) === cleanCNPJ
    );
    if (dupCNPJ) {
      return 'Já existe um cliente cadastrado com este CNPJ.';
    }
  }

  // 2. Validar unicidade de Inscrição Estadual (quando preenchida)
  const cleanIE = sanitizeIE(candidate.inscricao_estadual);
  if (cleanIE) {
    const dupIE = existingClients.find(
      c => c.id !== currentId && c.inscricao_estadual && sanitizeIE(c.inscricao_estadual) === cleanIE
    );
    if (dupIE) {
      return 'Já existe um cliente cadastrado com esta Inscrição Estadual.';
    }
  }

  // 3. Razão Social: PODE SER DUPLICADA. Sem bloqueio!
  return null;
};

/**
 * Lista todos os clientes. Supabase é a fonte oficial.
 * Realiza query: supabase.from('clientes').select('*').order('razao_social')
 */
export const getClients = async (): Promise<Cliente[]> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('razao_social', { ascending: true });

      if (!error && data) {
        return data.map(mapRowToCliente);
      }

      if (error) {
        console.warn('Erro ao carregar clientes do Supabase:', error.message);
      }
    } catch (err) {
      console.error('Falha de rede ao consultar Supabase:', err);
    }
  }

  // Se Supabase não estiver configurado ou falhar, retorna dados locais
  return getLocalClients();
};

/**
 * Cadastra (INSERT) ou Edita (UPDATE) cliente diretamente no Supabase.
 */
export const createOrUpdateClient = async (
  clientData: {
    id?: string;
    codigo?: string;
    cnpj?: string;
    inscricao_estadual?: string;
    razao_social: string;
    nome_fantasia?: string;
    ativo?: boolean;
  }
): Promise<{ success: boolean; error?: string; cliente?: Cliente }> => {
  const cleanIE = sanitizeIE(clientData.inscricao_estadual);
  const cleanCNPJ = sanitizeCNPJ(clientData.cnpj);

  if (!clientData.razao_social || clientData.razao_social.trim() === '') {
    return { success: false, error: 'A Razão Social é obrigatória.' };
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Validar duplicidade de CNPJ no Supabase
      if (cleanCNPJ && cleanCNPJ.length >= 11) {
        let query = supabase
          .from('clientes')
          .select('id, razao_social')
          .eq('cnpj', cleanCNPJ);

        if (clientData.id) {
          query = query.neq('id', clientData.id);
        }

        const { data: dupCnpj, error: errCnpj } = await query.maybeSingle();
        if (!errCnpj && dupCnpj) {
          return { success: false, error: 'Já existe um cliente cadastrado com este CNPJ.' };
        }
      }

      // 2. Validar duplicidade de IE no Supabase
      if (cleanIE) {
        let query = supabase
          .from('clientes')
          .select('id, razao_social')
          .eq('inscricao_estadual', cleanIE);

        if (clientData.id) {
          query = query.neq('id', clientData.id);
        }

        const { data: dupIe, error: errIe } = await query.maybeSingle();
        if (!errIe && dupIe) {
          return { success: false, error: 'Já existe um cliente cadastrado com esta Inscrição Estadual.' };
        }
      }

      const rowPayload = mapClienteToRow(clientData);

      if (clientData.id) {
        // UPDATE no Supabase
        const { data, error } = await supabase
          .from('clientes')
          .update(rowPayload)
          .eq('id', clientData.id)
          .select()
          .single();

        if (error) {
          return { success: false, error: `Erro no Supabase ao atualizar: ${error.message}` };
        }

        return { success: true, cliente: mapRowToCliente(data) };
      } else {
        // INSERT no Supabase
        const { data, error } = await supabase
          .from('clientes')
          .insert([rowPayload])
          .select()
          .single();

        if (error) {
          return { success: false, error: `Erro no Supabase ao cadastrar: ${error.message}` };
        }

        return { success: true, cliente: mapRowToCliente(data) };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha na comunicação com o Supabase.' };
    }
  }

  // Fallback local se o Supabase não estiver configurado
  const currentList = getLocalClients();
  const error = validateClient(clientData, currentList, clientData.id);
  if (error) {
    return { success: false, error };
  }

  const now = new Date().toISOString();
  if (clientData.id) {
    const index = currentList.findIndex(c => c.id === clientData.id);
    if (index === -1) {
      return { success: false, error: 'Cliente não encontrado para atualização.' };
    }
    const updated: Cliente = {
      ...currentList[index],
      codigo: clientData.codigo?.trim() || currentList[index].codigo,
      cnpj: cleanCNPJ ? formatCNPJ(cleanCNPJ) : '',
      inscricao_estadual: cleanIE || '',
      inscricao_estadual_formatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
      razao_social: clientData.razao_social.trim().toUpperCase(),
      nome_fantasia: clientData.nome_fantasia?.trim().toUpperCase() || '',
      ativo: clientData.ativo !== undefined ? clientData.ativo : currentList[index].ativo,
      updated_at: now
    };
    currentList[index] = updated;
    saveClientsToStorage(currentList);
    return { success: true, cliente: updated };
  } else {
    const newClient: Cliente = {
      id: 'cli-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      codigo: clientData.codigo?.trim() || '',
      cnpj: cleanCNPJ ? formatCNPJ(cleanCNPJ) : '',
      inscricao_estadual: cleanIE || '',
      inscricao_estadual_formatada: cleanIE ? formatIE(cleanIE) : 'Sem IE',
      razao_social: clientData.razao_social.trim().toUpperCase(),
      nome_fantasia: clientData.nome_fantasia?.trim().toUpperCase() || '',
      ativo: clientData.ativo !== undefined ? clientData.ativo : true,
      created_at: now,
      updated_at: now
    };
    currentList.unshift(newClient);
    saveClientsToStorage(currentList);
    return { success: true, cliente: newClient };
  }
};

/**
 * Exclui cliente diretamente no Supabase (DELETE)
 */
export const deleteClient = async (id: string): Promise<boolean> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (!error) return true;
      console.error('Erro ao excluir cliente no Supabase:', error.message);
    } catch (e) {
      console.error('Falha de rede ao excluir cliente no Supabase:', e);
    }
  }

  // Fallback local
  const currentList = getLocalClients();
  const filtered = currentList.filter(c => c.id !== id);
  if (filtered.length !== currentList.length) {
    saveClientsToStorage(filtered);
    return true;
  }
  return false;
};

/**
 * Alterna status ativo/inativo do cliente diretamente no Supabase (UPDATE)
 */
export const toggleClientStatus = async (id: string, currentAtivo: boolean): Promise<Cliente | null> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update({
          ativo: !currentAtivo,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return mapRowToCliente(data);
      }
    } catch (e) {
      console.error('Erro ao alterar status no Supabase:', e);
    }
  }

  // Fallback local
  const currentList = getLocalClients();
  const index = currentList.findIndex(c => c.id === id);
  if (index !== -1) {
    currentList[index].ativo = !currentList[index].ativo;
    currentList[index].updated_at = new Date().toISOString();
    saveClientsToStorage(currentList);
    return currentList[index];
  }
  return null;
};

/**
 * Busca clientes ativos diretamente do Supabase antes do confronto de editais.
 * supabase.from('clientes').select('*').eq('ativo', true)
 */
export const fetchActiveClientsForEdital = async (): Promise<Cliente[]> => {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true);

      if (!error && data && data.length > 0) {
        return data.map(mapRowToCliente);
      }
    } catch (e) {
      console.warn('Erro ao consultar clientes ativos no Supabase:', e);
    }
  }

  // Fallback
  return getLocalClients().filter(c => c.ativo !== false);
};

/**
 * Migra os clientes existentes no localStorage para a tabela clientes no Supabase.
 * - Valida duplicidades de CNPJ e IE antes de inserir
 * - Normaliza os dados
 * - Preserva os dados locais como backup temporário
 * - Marca a migração como concluída
 */
export const migrateLocalClientsToSupabase = async (): Promise<{
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  error?: string;
}> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      error: 'Supabase não está configurado. Conecte o Supabase antes de migrar.'
    };
  }

  try {
    const localList = getLocalClients();
    if (localList.length === 0) {
      return { success: true, migratedCount: 0, skippedCount: 0 };
    }

    // Buscar clientes já existentes no Supabase para evitar duplicidade
    const { data: dbClients, error: fetchErr } = await supabase
      .from('clientes')
      .select('id, cnpj, inscricao_estadual');

    if (fetchErr) {
      return {
        success: false,
        migratedCount: 0,
        skippedCount: 0,
        error: `Erro ao verificar clientes no Supabase: ${fetchErr.message}`
      };
    }

    const existingCnpjs = new Set<string>();
    const existingIes = new Set<string>();

    (dbClients || []).forEach(r => {
      if (r.cnpj) existingCnpjs.add(r.cnpj);
      if (r.inscricao_estadual) existingIes.add(r.inscricao_estadual);
    });

    let migratedCount = 0;
    let skippedCount = 0;
    const toInsert: any[] = [];

    for (const client of localList) {
      const cleanCNPJ = sanitizeCNPJ(client.cnpj);
      const cleanIE = sanitizeIE(client.inscricao_estadual);

      // Verificar duplicidade de CNPJ
      if (cleanCNPJ && existingCnpjs.has(cleanCNPJ)) {
        skippedCount++;
        continue;
      }

      // Verificar duplicidade de IE
      if (cleanIE && existingIes.has(cleanIE)) {
        skippedCount++;
        continue;
      }

      toInsert.push(mapClienteToRow(client));

      if (cleanCNPJ) existingCnpjs.add(cleanCNPJ);
      if (cleanIE) existingIes.add(cleanIE);
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('clientes')
        .insert(toInsert);

      if (insertErr) {
        return {
          success: false,
          migratedCount: 0,
          skippedCount: 0,
          error: `Erro ao inserir clientes no Supabase: ${insertErr.message}`
        };
      }
      migratedCount = toInsert.length;
    }

    // Marca migração como concluída
    if (typeof window !== 'undefined') {
      localStorage.setItem(MIGRATION_KEY, 'true');
    }

    return {
      success: true,
      migratedCount,
      skippedCount
    };
  } catch (err: any) {
    return {
      success: false,
      migratedCount: 0,
      skippedCount: 0,
      error: err.message || 'Falha durante a migração.'
    };
  }
};

export const resetSampleClients = (): Cliente[] => {
  saveClientsToStorage(DEFAULT_CLIENTS);
  return DEFAULT_CLIENTS;
};

