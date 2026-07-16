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
  setAutomaticSyncEnabled: (enabled: boolean) => void;
  requestAutomaticSync: (reason: string) => void;
  synchronizeNow: () => Promise<void>;
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
  const timerRef = useRef<number | null>(null);
  const isSynchronizingRef = useRef(false);

  const runSynchronization = useCallback(async (respectAutomaticPreference: boolean) => {
    if (
      (respectAutomaticPreference && !isAutomaticSyncEnabled) ||
      isSynchronizingRef.current
    ) {
      return;
    }

    if (!navigator.onLine) {
      setAutomaticSyncState('offline');
      return;
    }

    const authStatus = await authService.getStatus();

    if (authStatus.state !== 'signed-in') {
      setAutomaticSyncState('connected');
      return;
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
        return;
      }

      if (localChangeCount === 0) {
        setAutomaticSyncState('up-to-date');
        return;
      }

      if (!planResult.plan.canSynchronize) {
        setAutomaticSyncState('changes-waiting');
        return;
      }

      const result = await syncService.synchronize();

      if (!result.ok) {
        setAutomaticSyncState(
          result.itemsRequiringReview && result.itemsRequiringReview > 0
            ? 'review-required'
            : 'failed',
        );
        return;
      }

      setLastAutomaticSyncAt(result.completedAt ?? new Date().toISOString());
      setAutomaticSyncState('up-to-date');
    } catch {
      setAutomaticSyncState('failed');
    } finally {
      isSynchronizingRef.current = false;
    }
  }, [isAutomaticSyncEnabled]);

  const runAutomaticSync = useCallback(
    () => runSynchronization(true),
    [runSynchronization],
  );

  const scheduleAutomaticSync = useCallback(
    (_reason: string) => {
      if (!isAutomaticSyncEnabled) {
        return;
      }

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
    await runSynchronization(false);
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
      setAutomaticSyncEnabled,
      requestAutomaticSync: scheduleAutomaticSync,
      synchronizeNow,
    }),
    [
      automaticSyncState,
      isAutomaticSyncEnabled,
      lastAutomaticSyncAt,
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
