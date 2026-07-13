import { supabase } from '../../lib/supabase';
import { authService } from '../auth/AuthService';

export type CloudReadinessStatus = {
  state: 'not-configured' | 'signed-out' | 'ready' | 'not-initialized' | 'unavailable' | 'offline';
  label: string;
  detail: string;
};

const expectedTables = ['cases', 'dossiers', 'bonds', 'board_entries'] as const;

class CloudReadinessService {
  async check(): Promise<CloudReadinessStatus> {
    if (!navigator.onLine) {
      return {
        state: 'offline',
        label: 'Offline Mode',
        detail: 'LoreBound Online cannot be reviewed while offline.',
      };
    }

    if (!supabase) {
      return {
        state: 'not-configured',
        label: 'LoreBound Online Unavailable',
        detail: 'LoreBound Online is not available in this browser session.',
      };
    }

    const client = supabase;
    const user = await authService.getCurrentUser();

    if (!user) {
      return {
        state: 'signed-out',
        label: 'Investigator Connect Required',
        detail: 'Connect your Investigator Profile to review LoreBound Online.',
      };
    }

    const results = await Promise.all(
      expectedTables.map((tableName) =>
        client.from(tableName).select('id', { count: 'exact', head: true }),
      ),
    ).catch(() => null);

    if (!results) {
      return {
        state: 'unavailable',
        label: 'LoreBound Online Unavailable',
        detail: 'LoreBound Online could not be reviewed. Your Local Archive remains available.',
      };
    }
    const failedResult = results.find((result) => result.error);

    if (!failedResult) {
      return {
        state: 'ready',
        label: 'LoreBound Online Ready',
        detail: 'LoreBound Online is available. Your Local Archive has not been synchronized.',
      };
    }

    const message = failedResult.error?.message.toLocaleLowerCase() ?? '';

    if (
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('relation')
    ) {
      return {
        state: 'not-initialized',
        label: 'LoreBound Online Unavailable',
        detail: 'Apply the LoreBound SQL migration in Supabase before first sync.',
      };
    }

    return {
      state: 'unavailable',
      label: 'LoreBound Online Unavailable',
      detail: 'LoreBound Online could not be reviewed. Your Local Archive remains available.',
    };
  }
}

export const cloudReadinessService = new CloudReadinessService();
