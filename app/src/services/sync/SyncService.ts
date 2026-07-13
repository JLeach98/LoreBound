import { environmentManager } from '../environment/EnvironmentManager';
import { getActiveStorageProvider } from '../storage/storageProviderRegistry';

export type SyncStatus = {
  mode: 'local' | 'cloud';
  state: 'local-only' | 'idle' | 'syncing' | 'error';
  label: string;
  detail: string;
  lastSyncedAt: string | null;
};

export interface SyncService {
  getStatus: () => Promise<SyncStatus>;
  synchronize: () => Promise<SyncStatus>;
}

class LoreBoundSyncService implements SyncService {
  async getStatus(): Promise<SyncStatus> {
    const environment = environmentManager.getEnvironment();
    const storageStatus = getActiveStorageProvider().getStatus();

    if (!environment.isCloudConfigured || storageStatus.mode === 'local') {
      return {
        mode: 'local',
        state: 'local-only',
        label:
          environment.cloud.provider === 'supabase'
            ? 'Connected to LoreBound Online, Local Archive Active'
            : 'Offline Mode',
        detail:
          environment.cloud.provider === 'supabase'
            ? 'LoreBound Online is configured. Synchronize Investigation is not active yet.'
            : 'LoreBound Online is not available.',
        lastSyncedAt: null,
      };
    }

    return {
      mode: 'cloud',
      state: 'idle',
      label: 'LoreBound Online Archive',
      detail: 'Synchronize Investigation is ready.',
      lastSyncedAt: null,
    };
  }

  async synchronize(): Promise<SyncStatus> {
    return this.getStatus();
  }
}

export const syncService: SyncService = new LoreBoundSyncService();
