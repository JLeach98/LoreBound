import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { environmentManager } from '../environment/EnvironmentManager';

export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
};

export type AuthStatus = {
  mode: 'local' | 'cloud';
  state: 'local-only' | 'signed-out' | 'signed-in' | 'confirmation-required';
  user: AuthUser | null;
  label: string;
  confirmationEmail?: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type AuthOperation = 'signUp' | 'signIn' | 'signOut' | 'getStatus';

export type AuthFailure = {
  operation: AuthOperation;
  code: string;
  message: string;
  status: number | null;
  name: string;
};

export type AuthActionResult =
  | {
      ok: true;
      status: AuthStatus;
    }
  | {
      ok: false;
      error: AuthFailure;
      status: AuthStatus;
    };

export interface AuthService {
  getStatus: () => Promise<AuthStatus>;
  getCurrentUser: () => Promise<AuthUser | null>;
  signIn: (credentials: AuthCredentials) => Promise<AuthActionResult>;
  signUp: (credentials: AuthCredentials) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  onAuthStateChanged: (
    callback: (status: AuthStatus) => void,
  ) => {
    unsubscribe: () => void;
  };
}

function mapSessionToStatus(session: Session | null): AuthStatus {
  if (!session?.user) {
    return {
      mode: 'cloud',
      state: 'signed-out',
      user: null,
      label: 'Local Archive',
    };
  }

  return {
    mode: 'cloud',
    state: 'signed-in',
    user: {
      id: session.user.id,
      displayName: session.user.email ?? 'LoreBound Investigator',
      email: session.user.email,
    },
    label: 'Connected to LoreBound Online',
  };
}

function mapConfirmationRequired(user: User | null, email: string): AuthStatus {
  return {
    mode: 'cloud',
    state: 'confirmation-required',
    user: user
      ? {
          id: user.id,
          displayName: user.email ?? email,
          email: user.email ?? email,
        }
      : null,
    label: 'Investigator Profile Confirmation Required',
    confirmationEmail: user?.email ?? email,
  };
}

function getRedirectTo() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.origin;
}

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unexpected_auth_error';
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? `http_${status}` : 'unexpected_auth_error';
  }

  return 'unexpected_auth_error';
}

function getErrorStatus(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }

  return null;
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === 'string' ? name : 'AuthError';
  }

  return 'AuthError';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unexpected authentication failure.';
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-token]')
    .trim();
}

function createFailure(operation: AuthOperation, error: unknown): AuthFailure {
  return {
    operation,
    code: getErrorCode(error),
    message: sanitizeErrorMessage(getErrorMessage(error)),
    status: getErrorStatus(error),
    name: getErrorName(error),
  };
}

function failedResult(
  operation: AuthOperation,
  error: unknown,
  status: AuthStatus,
): AuthActionResult {
  return {
    ok: false,
    error: createFailure(operation, error),
    status,
  };
}

function successfulResult(status: AuthStatus): AuthActionResult {
  return {
    ok: true,
    status,
  };
}

class SupabaseAuthService implements AuthService {
  async getStatus(): Promise<AuthStatus> {
    const environment = environmentManager.getEnvironment();

    if (!environment.isCloudConfigured || !supabase) {
      return {
        mode: 'local',
        state: 'local-only',
        user: null,
        label: 'Local Archive',
      };
    }

    try {
      const { data } = await supabase.auth.getSession();
      return mapSessionToStatus(data.session);
    } catch (error) {
      createFailure('getStatus', error);
      return {
        mode: 'cloud',
        state: 'signed-out',
        user: null,
        label: 'Local Archive',
      };
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const status = await this.getStatus();
    return status.user;
  }

  async signIn(credentials: AuthCredentials): Promise<AuthActionResult> {
    if (!supabase) {
      return failedResult(
        'signIn',
        new Error('LoreBound Online configuration missing.'),
        await this.getStatus(),
      );
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        return failedResult('signIn', error, await this.getStatus());
      }

      return successfulResult(mapSessionToStatus(data.session));
    } catch (error) {
      return failedResult('signIn', error, await this.getStatus());
    }
  }

  async signUp(credentials: AuthCredentials): Promise<AuthActionResult> {
    if (!supabase) {
      return failedResult(
        'signUp',
        new Error('LoreBound Online configuration missing.'),
        await this.getStatus(),
      );
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          emailRedirectTo: getRedirectTo(),
        },
      });

      if (error) {
        return failedResult('signUp', error, await this.getStatus());
      }

      if (data.user?.identities && data.user.identities.length === 0) {
        return failedResult(
          'signUp',
          new Error('An account may already exist for that email. Try signing in.'),
          await this.getStatus(),
        );
      }

      if (data.user && !data.session) {
        return successfulResult(mapConfirmationRequired(data.user, credentials.email));
      }

      if (!data.user && !data.session) {
        return failedResult(
          'signUp',
          new Error('Supabase did not return a user or session.'),
          await this.getStatus(),
        );
      }

      return successfulResult(mapSessionToStatus(data.session));
    } catch (error) {
      return failedResult('signUp', error, await this.getStatus());
    }
  }

  async signOut(): Promise<AuthActionResult> {
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();

        if (error) {
          return failedResult('signOut', error, await this.getStatus());
        }
      }

      return successfulResult(await this.getStatus());
    } catch (error) {
      return failedResult('signOut', error, await this.getStatus());
    }
  }

  onAuthStateChanged(callback: (status: AuthStatus) => void) {
    if (!supabase) {
      void this.getStatus().then(callback);
      return {
        unsubscribe: () => undefined,
      };
    }

    const { data } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        callback(mapSessionToStatus(session));
      },
    );

    return {
      unsubscribe: () => data.subscription.unsubscribe(),
    };
  }
}

export const authService: AuthService = new SupabaseAuthService();
