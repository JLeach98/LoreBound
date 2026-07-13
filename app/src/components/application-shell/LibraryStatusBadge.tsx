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

    void refreshStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      isMounted = false;
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const label = authStatus?.label ?? 'Local Library';
  const detail =
    connectivity === 'offline'
      ? 'Offline'
      : (syncStatus?.label ?? 'Local Mode');

  return (
    <aside className="library-status-badge" aria-label="Library status">
      <span>{label}</span>
      <strong>{detail}</strong>
    </aside>
  );
}
