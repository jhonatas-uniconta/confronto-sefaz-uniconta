import { Cliente } from '../types';
import { normalizeIE, formatIE, normalizeCNPJ, formatCNPJ, sanitizeCNPJ, sanitizeIE } from '../utils';

const STORAGE_KEY = 'uniconta_clientes_v1';

// Seed sample clients with realistic Pernambuco data, including clients with and without IE,
// as well as multiple clients sharing the same Razão Social with different CNPJs:
const DEFAULT_CLIENTS: Cliente[] = [
  {
    id: 'cli-001',
    codigo: '1001',
    cnpj: '10.316.742/0001-85',
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
    cnpj: '08.452.190/0001-32',
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
    cnpj: '12.876.543/0001-90',
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
    cnpj: '03.123.456/0001-77',
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
    cnpj: '24.987.654/0001-12',
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
    cnpj: '18.765.432/0001-01',
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
    cnpj: '18.765.432/0002-92',
    inscricao_estadual: '',
    inscricao_estadual_formatada: 'Sem IE',
    razao_social: 'INDUSTRIA METALURGICA DO VALE LTDA', // Mesma Razão Social, CNPJ diferente permitido!
    nome_fantasia: 'METALVALE FILIAL',
    ativo: true,
    created_at: '2026-02-10T16:30:00.000Z',
    updated_at: '2026-02-10T16:30:00.000Z'
  },
  {
    id: 'cli-008',
    codigo: '1008',
    cnpj: '12.345.678/0001-90',
    inscricao_estadual: '',
    inscricao_estadual_formatada: 'Sem IE',
    razao_social: 'EMPRESA ABC SERVICOS LTDA',
    nome_fantasia: 'ABC SERVICOS',
    ativo: true,
    created_at: '2026-02-15T09:00:00.000Z',
    updated_at: '2026-02-15T09:00:00.000Z'
  }
];

export const getClients = (): Cliente[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CLIENTS));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Erro ao gravar clientes no LocalStorage:', e);
  }
};

/**
 * Validates a client candidate.
 * Mandatory fields: Razão Social.
 * Optional fields: CNPJ, Inscrição Estadual, Código, Nome Fantasia.
 *
 * Duplication rules:
 * 1. Razão Social: PODE REPETIR! Não bloqueia cadastro, edição nem importação.
 * 2. CNPJ: NÃO PODE REPETIR quando preenchido. Se outro cliente tiver o mesmo CNPJ normalizado, bloqueia com:
 *    “Já existe um cliente cadastrado com este CNPJ.”
 *    Na edição, exclui o próprio registro para permitir manter o mesmo CNPJ.
 * 3. Inscrição Estadual: NÃO PODE REPETIR quando preenchida. Se outro cliente tiver a mesma IE normalizada, bloqueia com:
 *    “Já existe um cliente cadastrado com esta Inscrição Estadual.”
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

export const createOrUpdateClient = (
  clientData: {
    id?: string;
    codigo?: string;
    cnpj?: string;
    inscricao_estadual?: string;
    razao_social: string;
    nome_fantasia?: string;
    ativo?: boolean;
  }
): { success: boolean; error?: string; cliente?: Cliente } => {
  const currentList = getClients();
  const error = validateClient(clientData, currentList, clientData.id);
  if (error) {
    return { success: false, error };
  }

  const cleanIE = sanitizeIE(clientData.inscricao_estadual);
  const cleanCNPJ = sanitizeCNPJ(clientData.cnpj);
  const now = new Date().toISOString();

  if (clientData.id) {
    // Update
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
    // Create new
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

export const deleteClient = (id: string): boolean => {
  const currentList = getClients();
  const filtered = currentList.filter(c => c.id !== id);
  if (filtered.length !== currentList.length) {
    saveClientsToStorage(filtered);
    return true;
  }
  return false;
};

export const toggleClientStatus = (id: string): Cliente | null => {
  const currentList = getClients();
  const index = currentList.findIndex(c => c.id === id);
  if (index !== -1) {
    currentList[index].ativo = !currentList[index].ativo;
    currentList[index].updated_at = new Date().toISOString();
    saveClientsToStorage(currentList);
    return currentList[index];
  }
  return null;
};

export const resetSampleClients = (): Cliente[] => {
  saveClientsToStorage(DEFAULT_CLIENTS);
  return DEFAULT_CLIENTS;
};

