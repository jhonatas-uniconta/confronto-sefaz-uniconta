import { Cliente } from '../types';
import { normalizeIE, formatIE, normalizeCNPJ, formatCNPJ } from '../utils';

const STORAGE_KEY = 'uniconta_clientes_v1';

// Seed sample clients with realistic Pernambuco data, including the exact example from the prompt:
// "0369429-10 10.316.742 ISABEL CRISTINA CAVALCANTI RODRIGUES"
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
    inscricao_estadual: '032145690',
    inscricao_estadual_formatada: '0321456-90',
    razao_social: 'INDUSTRIA METALURGICA DO VALE LTDA',
    nome_fantasia: 'METALVALE',
    ativo: false,
    created_at: '2026-02-10T16:00:00.000Z',
    updated_at: '2026-02-10T16:00:00.000Z'
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

export const validateClient = (
  candidate: Partial<Cliente>,
  existingClients: Cliente[],
  currentId?: string
): string | null => {
  if (!candidate.razao_social || candidate.razao_social.trim() === '') {
    return 'A Razão Social é obrigatória.';
  }

  const cleanIE = normalizeIE(candidate.inscricao_estadual);
  if (!cleanIE) {
    return 'A Inscrição Estadual é obrigatória.';
  }

  // Check duplicate IE (except current client being edited)
  const dupIE = existingClients.find(
    c => c.id !== currentId && c.inscricao_estadual === cleanIE
  );
  if (dupIE) {
    return `Já existe um cliente cadastrado com esta Inscrição Estadual (${formatIE(cleanIE)}: ${dupIE.razao_social}).`;
  }

  // Check duplicate CNPJ if provided
  const cleanCNPJ = normalizeCNPJ(candidate.cnpj);
  if (cleanCNPJ && cleanCNPJ.length >= 11) {
    const dupCNPJ = existingClients.find(
      c => c.id !== currentId && normalizeCNPJ(c.cnpj) === cleanCNPJ
    );
    if (dupCNPJ) {
      return `Já existe um cliente cadastrado com este CNPJ (${formatCNPJ(cleanCNPJ)}: ${dupCNPJ.razao_social}).`;
    }
  }

  return null;
};

export const createOrUpdateClient = (
  clientData: {
    id?: string;
    codigo?: string;
    cnpj?: string;
    inscricao_estadual: string;
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

  const cleanIE = normalizeIE(clientData.inscricao_estadual);
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
      cnpj: clientData.cnpj ? formatCNPJ(clientData.cnpj) : currentList[index].cnpj,
      inscricao_estadual: cleanIE,
      inscricao_estadual_formatada: formatIE(cleanIE),
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
      cnpj: clientData.cnpj ? formatCNPJ(clientData.cnpj) : '',
      inscricao_estadual: cleanIE,
      inscricao_estadual_formatada: formatIE(cleanIE),
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
