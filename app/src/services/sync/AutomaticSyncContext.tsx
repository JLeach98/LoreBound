import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authService } from '../auth/AuthService';
import { syncService } from './SyncService';
import type { SyncResult } from './SyncTypes';

export type AutomaticSyncState =
  | 'connected'
  | 'synchronizing'
  | 'up-to-date'
  | 'offline'
  | 'changes-waiting'
  | 'review-required'
  | 'failed';

type AutomaticSyncContextValue = {
  isAutomaticSyncEnabled: boolean;
  automaticSyncState: AutomaticSyncState;
  automaticSyncLabel: string;
  lastAutomaticSyncAt: string | null;
  pendingAutomaticSyncReasons: string[];
  latestManualSyncRequestAt: string | null;
  setAutomaticSyncEnabled: (enabled: boolean) => void;
  requestAutomaticSync: (reason: string) => void;
  synchronizeNow: () => Promise<SyncResult>;
};

const automaticSyncPreferenceKey = 'lorebound:auto-sync-enabled';
const automaticSyncDelayMs = 5000;
const AutomaticSyncContext = createContext<AutomaticSyncContextValue | null>(null);
let automaticSyncRequester: ((reason: string) => void) | null = null;

export function requestAutomaticSynchronization(reason: string) {
  automaticSyncRequester?.(reason);
}

function readAutomaticSyncPreference() {
  return window.localStorage.getItem(automaticSyncPreferenceKey) === 'true';
}

function writeAutomaticSyncPreference(enabled: boolean) {
  window.localStorage.setItem(automaticSyncPreferenceKey, String(enabled));
}

function getStateLabel(state: AutomaticSyncState, enabled: boolean) {
  if (!enabled) {
    return 'Off';
  }

  switch (state) {
    case 'synchronizing':
      return 'Synchronizing';
    case 'up-to-date':
      return 'Up To Date';
    case 'offline':
      return 'Offline';
    case 'changes-waiting':
      return 'Changes Waiting';
    case 'review-required':
      return 'Synchronization Review Required';
    case 'failed':
      return 'Synchronization Failed';
    case 'connected':
    default:
      return 'Watching for changes';
  }
}

export function AutomaticSyncProvider({ children }: { children: ReactNode }) {
  const [isAutomaticSyncEnabled, setIsAutomaticSyncEnabled] = useState(
    readAutomaticSyncPreference,
  );
  const [automaticSyncState, setAutomaticSyncState] = useState<AutomaticSyncState>(
    navigator.onLine ? 'connected' : 'offline',
  );
  const [lastAutomaticSyncAt, setLastAutomaticSyncAt] = useState<string | null>(null);
  const [pendingAutomaticSyncReasons, setPendingAutomaticSyncReasons] = useState<string[]>([]);
  const [latestManualSyncRequestAt, setLatestManualSyncRequestAt] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const isSynchronizingRef = useRef(false);

  const runSynchronization = useCallback(async (respectAutomaticPreference: boolean): Promise<SyncResult> => {
    const emptyResult = (message: string): SyncResult => ({
      ok: false,
      message,
      counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
      completedStages: [],
      itemsRequiringReview: 0,
    });

    if (
      (respectAutomaticPreference && !isAutomaticSyncEnabled) ||
      isSynchronizingRef.current
    ) {
      return emptyResult('Synchronization is already in progress or Automatic Synchronization is off.');
    }

    if (!navigator.onLine) {
      setAutomaticSyncState('offline');
      return emptyResult('LoreBound Online is unavailable while this browser is offline.');
    }

    const authStatus = await authService.getStatus();

    if (authStatus.state !== 'signed-in') {
      setAutomaticSyncState('connected');
      return emptyResult('Investigator Connect is required before synchronization.');
    }

    isSynchronizingRef.current = true;
    setAutomaticSyncState('synchronizing');

    try {
      const planResult = await syncService.createPlan();
      const reviewCount = Object.values(planResult.plan.sections).reduce(
        (total, section) => total + section.itemsRequiringReview,
        0,
      );
      const conflictCount = Object.values(planResult.plan.sections).reduce(
        (total, section) => total + section.conflictRecords,
        0,
      );
      const localChangeCount = Object.values(planResult.plan.sections).reduce(
        (total, section) => total + section.newRecords + section.updatedRecords,
        0,
      );
      const cloudUpdateCount = Object.values(planResult.plan.sections).reduce(
        (total, section) => total + section.cloudUpdatesAvailable,
        0,
      );

      if (
        reviewCount > 0 ||
        conflictCount > 0 ||
        cloudUpdateCount > 0 ||
        planResult.plan.diagnostics.archiveState.classification === 'Partial Local Archive'
      ) {
        setAutomaticSyncState('review-required');
        return emptyResult(
          planResult.plan.blockingReasons[0] ??
          planResult.plan.diagnostics.archiveState.disabledReason ??
          'Archive Synchronization Review is required.',
        );
      }

      if (planResult.plan.diagnostics.reconciliation.canRebuildBaseline) {
        if (respectAutomaticPreference) {
          setAutomaticSyncState('review-required');
          return emptyResult('This browser’s synchronization baseline is outdated.');
        }

        const result = await syncService.rebuildBaseline();
        setAutomaticSyncState(result.ok ? 'up-to-date' : 'failed');

      if (result.ok) {
        setLastAutomaticSyncAt(result.completedAt ?? new Date().toISOString());
      }

        return result;
      }

      if (localChangeCount === 0) {
        setAutomaticSyncState('up-to-date');
        return {
          ok: true,
          message: 'Archive Up To Date',
          counts: { cases: 0, dossiers: 0, bonds: 0, boardEntries: 0 },
          completedStages: [],
          itemsRequiringReview: 0,
          completedAt: new Date().toISOString(),
        };
      }

      if (!planResult.plan.canSynchronize) {
        setAutomaticSyncState('changes-waiting');
        return emptyResult(
          planResult.plan.blockingReasons[0] ??
          planResult.plan.diagnostics.archiveState.disabledReason ??
          'Synchronization is not available for this archive.',
        );
      }

      const result = await syncService.synchronize();

      if (!result.ok) {
        setAutomaticSyncState(
          result.itemsRequiringReview && result.itemsRequiringReview > 0
            ? 'review-required'
            : 'failed',
        );
        return result;
      }

      setLastAutomaticSyncAt(result.completedAt ?? new Date().toISOString());
      setAutomaticSyncState('up-to-date');
      setPendingAutomaticSyncReasons([]);
      return result;
    } catch {
      setAutomaticSyncState('failed');
      return emptyResult('Synchronization Failed. Review synchronization before trying again.');
    } finally {
      isSynchronizingRef.current = false;
    }
  }, [isAutomaticSyncEnabled]);

  const runAutomaticSync = useCallback(
    () => runSynchronization(true),
    [runSynchronization],
  );

  const scheduleAutomaticSync = useCallback(
    (reason: string) => {
      if (!isAutomaticSyncEnabled) {
        return;
      }

      setPendingAutomaticSyncReasons((currentReasons) =>
        [...new Set([...currentReasons, reason])],
      );
      setAutomaticSyncState(navigator.onLine ? 'changes-waiting' : 'offline');

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runAutomaticSync();
      }, automaticSyncDelayMs);
    },
    [isAutomaticSyncEnabled, runAutomaticSync],
  );

  const setAutomaticSyncEnabled = useCallback(
    (enabled: boolean) => {
      writeAutomaticSyncPreference(enabled);
      setIsAutomaticSyncEnabled(enabled);
      setAutomaticSyncState(enabled ? (navigator.onLine ? 'connected' : 'offline') : 'connected');

      if (enabled) {
        scheduleAutomaticSync('automatic sync enabled');
      } else if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [scheduleAutomaticSync],
  );

  const synchronizeNow = useCallback(async () => {
    setLatestManualSyncRequestAt(new Date().toISOString());
    return runSynchronization(false);
  }, [runSynchronization]);

  useEffect(() => {
    automaticSyncRequester = scheduleAutomaticSync;

    return () => {
      if (automaticSyncRequester === scheduleAutomaticSync) {
        automaticSyncRequester = null;
      }
    };
  }, [scheduleAutomaticSync]);

  useEffect(() => {
    const handleOnline = () => scheduleAutomaticSync('network restored');
    const handleOffline = () => setAutomaticSyncState('offline');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleAutomaticSync('investigation foregrounded');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [scheduleAutomaticSync]);

  const contextValue = useMemo(
    () => ({
      isAutomaticSyncEnabled,
      automaticSyncState,
      automaticSyncLabel: getStateLabel(automaticSyncState, isAutomaticSyncEnabled),
      lastAutomaticSyncAt,
      pendingAutomaticSyncReasons,
      latestManualSyncRequestAt,
      setAutomaticSyncEnabled,
      requestAutomaticSync: scheduleAutomaticSync,
      synchronizeNow,
    }),
    [
      automaticSyncState,
      isAutomaticSyncEnabled,
      lastAutomaticSyncAt,
      latestManualSyncRequestAt,
      pendingAutomaticSyncReasons,
      scheduleAutomaticSync,
      setAutomaticSyncEnabled,
      synchronizeNow,
    ],
  );

  return (
    <AutomaticSyncContext.Provider value={contextValue}>
      {children}
    </AutomaticSyncContext.Provider>
  );
}

export function useAutomaticSync() {
  const context = useContext(AutomaticSyncContext);

  if (!context) {
    throw new Error('useAutomaticSync must be used inside AutomaticSyncProvider.');
  }

  return context;
}
