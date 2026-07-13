import { useEffect, useState } from 'react';
import { authService, type AuthStatus } from '../../services/auth/AuthService';
import { syncService, type SyncStatus } from '../../services/sync/SyncService';

type ConnectivityState = 'online' | 'offline';

export function LibraryStatusBadge() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityState>(
    navigator.onLine ? 'online' : 'offline',
  );

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
      const [nextAuthStatus, nextSyncStatus] = await Promise.all([
        authService.getStatus(),
        syncService.getStatus(),
      ]);

      if (isMounted) {
        setAuthStatus(nextAuthStatus);
        setSyncStatus(nextSyncStatus);
      }
    }

    const updateOnlineStatus = () =>
      setConnectivity(navigator.onLine ? 'online' : 'offline');
    const subscription = authService.onAuthStateChanged((nextAuthStatus) => {
      setAuthStatus(nextAuthStatus);
      void syncService.getStatus().then(setSyncStatus);
    });

    void refreshStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const label = authStatus?.label ?? 'Local Archive';
  const detail =
    connectivity === 'offline'
      ? 'Offline Mode'
      : (syncStatus?.label ?? 'Offline Mode');

  return (
    <aside className="library-status-badge" aria-label="Library status">
      <span>{label}</span>
      <strong>{detail}</strong>
    </aside>
  );
}
