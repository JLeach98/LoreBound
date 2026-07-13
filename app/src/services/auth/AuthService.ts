import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { environmentManager } from '../environment/EnvironmentManager';

export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
};

export type AuthStatus = {
  mode: 'local' | 'cloud';
  state: 'local-only' | 'signed-out' | 'signed-in';
  user: AuthUser | null;
  label: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export interface AuthService {
  getStatus: () => Promise<AuthStatus>;
  getCurrentUser: () => Promise<AuthUser | null>;
  signIn: (credentials: AuthCredentials) => Promise<AuthStatus>;
  signUp: (credentials: AuthCredentials) => Promise<AuthStatus>;
  signOut: () => Promise<AuthStatus>;
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
      label: 'Cloud Library',
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
    label: 'Cloud Library',
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
        label: 'Local Library',
      };
    }

    const { data } = await supabase.auth.getSession();
    return mapSessionToStatus(data.session);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const status = await this.getStatus();
    return status.user;
  }

  async signIn(credentials: AuthCredentials): Promise<AuthStatus> {
    if (!supabase) {
      return this.getStatus();
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      throw error;
    }

    return mapSessionToStatus(data.session);
  }

  async signUp(credentials: AuthCredentials): Promise<AuthStatus> {
    if (!supabase) {
      return this.getStatus();
    }

    const { data, error } = await supabase.auth.signUp(credentials);

    if (error) {
      throw error;
    }

    return mapSessionToStatus(data.session);
  }

  async signOut(): Promise<AuthStatus> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    }

    return this.getStatus();
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
