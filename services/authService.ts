import { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseService';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
}

/**
 * Traduz mensagens de erro do Supabase Auth para português amigável
 */
export const translateAuthError = (errorMessage?: string): string => {
  if (!errorMessage) {
    return 'Ocorreu um erro ao realizar login. Tente novamente.';
  }

  const msg = errorMessage.toLowerCase();

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid credentials') ||
    msg.includes('user not found') ||
    msg.includes('wrong password')
  ) {
    return 'Email ou senha incorretos.';
  }

  if (msg.includes('email not confirmed')) {
    return 'Email ainda não confirmado. Verifique sua caixa de entrada ou solicite confirmação ao administrador.';
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('connection refused')
  ) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet ou a URL do Supabase.';
  }

  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.';
  }

  return errorMessage;
};

/**
 * Realiza login com email e senha utilizando Supabase Auth
 */
export const signInWithPassword = async (email: string, password: string): Promise<LoginResult> => {
  const cleanEmail = email ? email.trim() : '';
  const cleanPassword = password ? password.trim() : '';

  if (!cleanEmail || !cleanPassword) {
    return {
      success: false,
      error: 'Informe email e senha.'
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'O Supabase ainda não foi configurado. Configure a URL e a Anon Key para continuar.'
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Não foi possível inicializar o cliente Supabase. Verifique a URL e a Anon Key informadas.'
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });

    if (error) {
      return {
        success: false,
        error: translateAuthError(error.message)
      };
    }

    if (!data || !data.user) {
      return {
        success: false,
        error: 'Sessão não pôde ser iniciada. Tente novamente.'
      };
    }

    return {
      success: true,
      user: data.user
    };
  } catch (err: any) {
    console.error('Exceção capturada no signInWithPassword:', err);
    return {
      success: false,
      error: translateAuthError(err?.message)
    };
  }
};

/**
 * Encerra a sessão atual (Logout)
 */
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const { error } = await client.auth.signOut();
    if (error) {
      console.warn('Aviso no signOut:', error.message);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro no signOut:', err);
    return { success: false, error: err?.message };
  }
};

/**
 * Obtém a sessão inicial atual
 */
export const getInitialSession = async (): Promise<{ session: Session | null; user: User | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { session: null, user: null };
  }

  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('Aviso ao obter sessão inicial:', error.message);
      return { session: null, user: null };
    }
    return {
      session: data.session || null,
      user: data.session?.user || null
    };
  } catch (err) {
    console.error('Erro inesperado ao consultar sessão do Supabase:', err);
    return { session: null, user: null };
  }
};
