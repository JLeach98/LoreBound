import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { loreBoundVersion } from '../../app/version';
import { isSupabaseConfigured } from '../../lib/supabase';
import { authService, type AuthStatus } from '../../services/auth/AuthService';
import { useOperationsConsole } from '../../services/preferences/OperationsConsoleContext';
import { useInvestigatorProfile } from '../../services/profile/InvestigatorProfileContext';
import { useAutomaticSync } from '../../services/sync/AutomaticSyncContext';
import { syncService, type SyncStatus } from '../../services/sync/SyncService';
import type { SyncPlan } from '../../services/sync/SyncTypes';

type LoreBoundSettingsProps = {
  onClose: () => void;
};

type SettingsSection = 'general' | 'online' | 'about' | 'operations';

const unlockActivationTarget = 7;
const unlockResetMs = 5000;

function createEmptyPlanSection() {
  return {
    newRecords: 0,
    existingRecords: 0,
    unchangedRecords: 0,
    updatedRecords: 0,
    cloudUpdatesAvailable: 0,
    conflictRecords: 0,
    unsupportedRecords: 0,
    invalidRecords: 0,
    itemsRequiringReview: 0,
    localOnly: 0,
    onlineOnly: 0,
    matchingIds: 0,
    localNewer: 0,
    onlineNewer: 0,
    conflicts: 0,
    requiresReview: 0,
    sameTimestampDifferingContents: 0,
  };
}

function emptyPlan(): SyncPlan {
  return {
    local: {
      investigationName: null,
      caseCount: 0,
      dossierCount: 0,
      bondCount: 0,
      boardEntryCount: 0,
      localImageCount: 0,
      estimatedTransferBytes: 0,
    },
    online: {
      isAvailable: false,
      caseCount: 0,
      dossierCount: 0,
      bondCount: 0,
      boardEntryCount: 0,
    },
    sections: {
      cases: createEmptyPlanSection(),
      dossiers: createEmptyPlanSection(),
      bonds: createEmptyPlanSection(),
      boardEntries: createEmptyPlanSection(),
    },
    canSynchronize: false,
    canRetrieve: false,
    isLocalArchiveEmpty: true,
    isOnlineArchiveEmpty: true,
    lastSynchronizedAt: null,
    blockingReasons: [],
    imageStatus: {
      readyToSynchronize: 0,
      awaitingStorageSetup: 0,
      couldNotProcess: 0,
      message: 'No stored images were found in this Local Archive.',
    },
    imagePaths: {
      cases: {},
      dossiers: {},
    },
    diagnostics: {
      localSource: 'Not reviewed',
      localDatabaseName: 'Not reviewed',
      localDatabaseVersion: 0,
      localObjectStores: [],
      localInvestigationsRead: 0,
      localDossiersRead: 0,
      localBondsRead: 0,
      localEvidencePinsRead: 0,
      cloudQueries: {
        cases: { status: 'Failed', message: 'Not reviewed.', httpStatus: null },
        dossiers: { status: 'Failed', message: 'Not reviewed.', httpStatus: null },
        bonds: { status: 'Failed', message: 'Not reviewed.', httpStatus: null },
        boardEntries: { status: 'Failed', message: 'Not reviewed.', httpStatus: null },
      },
      storage: {
        bucketReachable: false,
        localImagesExtracted: 0,
        imagesPrepared: 0,
        imageUploadsSucceeded: 0,
        imageUploadsFailed: 0,
        storageVerificationSucceeded: 0,
      },
      reconciliation: {
        baselineMetadataPresent: false,
        invalidIds: 0,
        timestampParseFailures: 0,
        fingerprintMismatches: 0,
        automaticGateReason: 'Not reviewed.',
      },
    },
  };
}

function formatCloudQueryStatus(query: SyncPlan['diagnostics']['cloudQueries']['cases']) {
  if (query.status === 'Success') {
    return 'Success';
  }

  const details = [
    query.code ? `Code: ${query.code}` : null,
    query.message ? `Message: ${query.message}` : null,
    typeof query.httpStatus === 'number' ? `HTTP: ${query.httpStatus}` : null,
  ].filter(Boolean);

  return details.length > 0 ? `Failure (${details.join(', ')})` : 'Failure';
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function openLibraryAccess(view: 'overview' | 'review' | 'sign-out' | 'profile' | 'setup') {
  window.dispatchEvent(
    new CustomEvent('lorebound:open-library-access', {
      detail: { view },
    }),
  );
}

export function LoreBoundSettings({ onClose }: LoreBoundSettingsProps) {
  const { operationsConsoleUnlocked, setOperationsConsoleUnlocked } = useOperationsConsole();
  const {
    profile,
    profileState,
    errorMessage: profileError,
    diagnostics: profileDiagnostics,
  } = useInvestigatorProfile();
  const {
    isAutomaticSyncEnabled,
    automaticSyncState,
    automaticSyncLabel,
    lastAutomaticSyncAt,
    setAutomaticSyncEnabled,
    synchronizeNow,
  } = useAutomaticSync();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [isUnlockConfirmOpen, setIsUnlockConfirmOpen] = useState(false);
  const [isRelockConfirmOpen, setIsRelockConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncPlan, setSyncPlan] = useState<SyncPlan>(emptyPlan);
  const settingsRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const unlockDialogRef = useRef<HTMLElement>(null);
  const relockDialogRef = useRef<HTMLElement>(null);
  const unlockPrimaryButtonRef = useRef<HTMLButtonElement>(null);
  const unlockCloseButtonRef = useRef<HTMLButtonElement>(null);
  const relockCancelButtonRef = useRef<HTMLButtonElement>(null);
  const relockButtonRef = useRef<HTMLButtonElement>(null);
  const activationCountRef = useRef(0);
  const activationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      if (activationTimerRef.current) {
        window.clearTimeout(activationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!operationsConsoleUnlocked && activeSection === 'operations') {
      setActiveSection('general');
    }
  }, [activeSection, operationsConsoleUnlocked]);

  useEffect(() => {
    if (isUnlockConfirmOpen) {
      window.setTimeout(() => unlockPrimaryButtonRef.current?.focus(), 0);
    }
  }, [isUnlockConfirmOpen]);

  useEffect(() => {
    if (isRelockConfirmOpen) {
      window.setTimeout(() => relockCancelButtonRef.current?.focus(), 0);
    }
  }, [isRelockConfirmOpen]);

  useEffect(() => {
    let isMounted = true;

    async function refreshSettingsState() {
      const [nextAuthStatus, nextSyncStatus, nextPlanResult] = await Promise.all([
        authService.getStatus(),
        syncService.getStatus(),
        operationsConsoleUnlocked ? syncService.createPlan() : Promise.resolve(null),
      ]);

      if (!isMounted) {
        return;
      }

      setAuthStatus(nextAuthStatus);
      setSyncStatus(nextSyncStatus);

      if (nextPlanResult) {
        setSyncPlan(nextPlanResult.plan);
      }
    }

    const subscription = authService.onAuthStateChanged((nextAuthStatus) => {
      setAuthStatus(nextAuthStatus);
      void syncService.getStatus().then(setSyncStatus);
    });

    void refreshSettingsState();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [operationsConsoleUnlocked]);

  const systemInformation = useMemo(
    () => ({
      environmentMode: import.meta.env.MODE,
      browserPlatform: navigator.platform || 'Not available',
      networkState: navigator.onLine ? 'Online' : 'Offline',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Yes' : 'No',
      origin: window.location.origin,
    }),
    [],
  );

  const navigationItems = useMemo(
    () => [
      { id: 'general' as const, label: 'General' },
      { id: 'online' as const, label: 'LoreBound Online' },
      { id: 'about' as const, label: 'About' },
      ...(operationsConsoleUnlocked
        ? [
            {
              id: 'operations' as const,
              label: 'Operations Console',
            },
          ]
        : []),
    ],
    [operationsConsoleUnlocked],
  );

  function resetActivationCount() {
    activationCountRef.current = 0;

    if (activationTimerRef.current) {
      window.clearTimeout(activationTimerRef.current);
      activationTimerRef.current = null;
    }
  }

  function closeSettings() {
    resetActivationCount();
    onClose();
  }

  function handleLogoActivation() {
    if (operationsConsoleUnlocked || activeSection !== 'about') {
      return;
    }

    if (activationTimerRef.current) {
      window.clearTimeout(activationTimerRef.current);
    }

    activationTimerRef.current = window.setTimeout(resetActivationCount, unlockResetMs);
    activationCountRef.current += 1;

    if (activationCountRef.current >= unlockActivationTarget) {
      resetActivationCount();
      setIsUnlockConfirmOpen(true);
    }
  }

  function handleLogoKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleLogoActivation();
    }
  }

  function selectSection(nextSection: SettingsSection) {
    if (nextSection !== 'about') {
      resetActivationCount();
    }

    setActiveSection(nextSection);
  }

  function handleSettingsKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      if (isUnlockConfirmOpen) {
        setIsUnlockConfirmOpen(false);
        unlockCloseButtonRef.current?.focus();
        return;
      }

      if (isRelockConfirmOpen) {
        setIsRelockConfirmOpen(false);
        relockButtonRef.current?.focus();
        return;
      }

      closeSettings();
      return;
    }

    const activeFocusRoot = isUnlockConfirmOpen
      ? unlockDialogRef.current
      : isRelockConfirmOpen
        ? relockDialogRef.current
        : settingsRef.current;

    if (event.key !== 'Tab' || !activeFocusRoot) {
      return;
    }

    const focusableElements = Array.from(
      activeFocusRoot.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function unlockConsole(openConsole: boolean) {
    setOperationsConsoleUnlocked(true);
    setIsUnlockConfirmOpen(false);
    setNotice('Operations Console unlocked on this device.');
    setActiveSection(openConsole ? 'operations' : 'about');
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  }

  function relockConsole() {
    setIsRelockConfirmOpen(false);
    setActiveSection('general');
    setOperationsConsoleUnlocked(false);
    setNotice('Operations Console hidden on this device.');
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  }

  function handleOpenLibraryAccess(view: 'overview' | 'review' | 'sign-out' | 'profile' | 'setup') {
    openLibraryAccess(view);
    closeSettings();
  }

  async function handleSynchronizeNow() {
    setNotice('Synchronizing Investigation...');

    try {
      await synchronizeNow();
      const [nextSyncStatus, nextPlanResult] = await Promise.all([
        syncService.getStatus(),
        syncService.createPlan(),
      ]);
      setSyncStatus(nextSyncStatus);
      setSyncPlan(nextPlanResult.plan);
      setNotice('Investigation Synchronized');
    } catch {
      setNotice('Synchronization Failed. Review synchronization before trying again.');
    }
  }

  return (
    <div className="settings-shell" role="presentation">
      <section
        ref={settingsRef}
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={handleSettingsKeyDown}
      >
        <header className="settings-panel__header">
          <div>
            <h2 id="settings-title">LoreBound Settings</h2>
            <p>Application preferences</p>
          </div>
          <div className="settings-panel__header-actions">
            <button
              ref={closeButtonRef}
              type="button"
              className="auth-button auth-button--quiet settings-panel__close"
              onClick={closeSettings}
            >
              Close
            </button>
          </div>
        </header>

        <div className="settings-panel__body">
          <nav className="settings-tabs" aria-label="Settings sections">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-tab settings-tab--${item.id}${
                  activeSection === item.id ? ' settings-tab--active' : ''
                }`}
                onClick={() => selectSection(item.id)}
                aria-current={activeSection === item.id ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {activeSection === 'general' ? (
              <section className="settings-section" aria-labelledby="general-settings-heading">
                <div className="settings-section__header">
                  <p className="investigation-section__eyebrow">General</p>
                  <h3 id="general-settings-heading">Archive Preferences</h3>
                </div>
                <div className="settings-file-card">
                  <strong>Appearance</strong>
                  <p>Visual customization will arrive in a future LoreBound update.</p>
                </div>
              </section>
            ) : null}

            {activeSection === 'online' ? (
              <section className="settings-section" aria-labelledby="lorebound-online-heading">
                <div className="settings-section__header">
                  <p className="investigation-section__eyebrow">LoreBound Online</p>
                  <h3 id="lorebound-online-heading">Connection File</h3>
                </div>
                <div className="settings-file-grid">
                  <section className="settings-file-card">
                    <strong>Investigator Profile</strong>
                    <dl className="settings-compact-list">
                      <div>
                        <dt>Connection Status</dt>
                        <dd>{authStatus?.label ?? 'Local Archive'}</dd>
                      </div>
                      <div>
                        <dt>Current Investigator</dt>
                        <dd>
                          {authStatus?.state === 'signed-in' && authStatus.user
                            ? (profile?.username ?? authStatus.user.displayName)
                            : 'Not connected'}
                        </dd>
                      </div>
                      <div>
                        <dt>Badge</dt>
                        <dd>{profile?.badgeNumber ?? 'Not issued'}</dd>
                      </div>
                      <div>
                        <dt>Profile Status</dt>
                        <dd>
                          {profile
                            ? 'Loaded'
                            : profileState === 'migration-unavailable'
                              ? 'Database update required'
                              : profileState === 'offline'
                                ? 'Offline'
                                : 'Not available'}
                        </dd>
                      </div>
                    </dl>
                    {profileError ? <p>{profileError}</p> : null}
                  </section>
                  <section className="settings-file-card">
                    <strong>Archive Status</strong>
                    <dl className="settings-compact-list">
                      <div>
                        <dt>Local Archive</dt>
                        <dd>Active</dd>
                      </div>
                      <div>
                        <dt>LoreBound Online</dt>
                        <dd>{syncStatus?.label ?? 'Offline Mode'}</dd>
                      </div>
                      <div>
                        <dt>Last Synchronization</dt>
                        <dd>
                          {formatDateTime(
                            lastAutomaticSyncAt ?? syncPlan.lastSynchronizedAt ?? syncStatus?.lastSyncedAt,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Automatic Sync</dt>
                        <dd>{automaticSyncLabel}</dd>
                      </div>
                    </dl>
                    <label className="profile-sync-toggle settings-sync-toggle">
                      <input
                        type="checkbox"
                        checked={isAutomaticSyncEnabled}
                        onChange={(event) => setAutomaticSyncEnabled(event.target.checked)}
                      />
                      <span>Automatic Synchronization</span>
                    </label>
                  </section>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={() => handleOpenLibraryAccess('profile')}
                  >
                    Open Investigator Profile
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={() => handleOpenLibraryAccess('overview')}
                  >
                    Library Access
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={handleSynchronizeNow}
                    disabled={authStatus?.state !== 'signed-in'}
                  >
                    Synchronize Now
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={() => handleOpenLibraryAccess('review')}
                  >
                    Archive Synchronization Review
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={() => handleOpenLibraryAccess('sign-out')}
                  >
                    Investigator Offline
                  </button>
                </div>
              </section>
            ) : null}

            {activeSection === 'about' ? (
              <section className="settings-section settings-section--about" aria-labelledby="about-lorebound-heading">
                <button
                  type="button"
                  className="settings-about-logo"
                  aria-label="LoreBound"
                  onClick={handleLogoActivation}
                  onKeyDown={handleLogoKeyDown}
                >
                  <span>LoreBound</span>
                  <small>Investigate Every Story.</small>
                </button>
                <div className="settings-section__header settings-section__header--center">
                  <p className="investigation-section__eyebrow">About LoreBound</p>
                  <h3 id="about-lorebound-heading">LoreBound</h3>
                </div>
                <p>
                  LoreBound helps investigators examine fictional worlds through Cases, Dossiers,
                  Bonds, and Evidence Boards.
                </p>
                <dl className="settings-compact-list">
                  <div>
                    <dt>Version</dt>
                    <dd>{loreBoundVersion}</dd>
                  </div>
                  <div>
                    <dt>Attribution</dt>
                    <dd>Mythos Guild</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {activeSection === 'operations' && operationsConsoleUnlocked ? (
              <section
                className="settings-section settings-section--operations"
                aria-labelledby="operations-console-heading"
              >
                <div className="settings-section__header">
                  <p className="investigation-section__eyebrow">Operations Console</p>
                  <h3 id="operations-console-heading">Control Room</h3>
                </div>
                <div className="settings-diagnostics-grid">
                  <details>
                    <summary>Status</summary>
                    <dl>
                      <div>
                        <dt>Console</dt>
                        <dd>Unlocked on this device</dd>
                      </div>
                      <div>
                        <dt>Application version</dt>
                        <dd>{loreBoundVersion}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>Authentication</summary>
                    <dl>
                      <div>
                        <dt>Supabase configured</dt>
                        <dd>{isSupabaseConfigured ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Session connected</dt>
                        <dd>{authStatus?.state === 'signed-in' ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{authStatus?.label ?? 'Not reviewed'}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>Investigator Profile</summary>
                    <dl>
                      <div>
                        <dt>Authenticated user present</dt>
                        <dd>{profileDiagnostics.authenticatedUserPresent ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Profile query</dt>
                        <dd>{profileDiagnostics.profileQueryStatus}</dd>
                      </div>
                      <div>
                        <dt>Profile record found</dt>
                        <dd>{profileDiagnostics.profileRecordFound ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Profile creation attempted</dt>
                        <dd>{profileDiagnostics.profileCreationAttempted ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Profile state</dt>
                        <dd>{profileState}</dd>
                      </div>
                      <div>
                        <dt>Error code</dt>
                        <dd>{profileDiagnostics.sanitizedErrorCode ?? 'None'}</dd>
                      </div>
                      <div>
                        <dt>Error message</dt>
                        <dd>{profileDiagnostics.sanitizedErrorMessage ?? 'None'}</dd>
                      </div>
                      <div>
                        <dt>HTTP status</dt>
                        <dd>{profileDiagnostics.httpStatus ?? 'None'}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>Synchronization</summary>
                    <dl>
                      <div>
                        <dt>Current stage</dt>
                        <dd>{automaticSyncState}</dd>
                      </div>
                      <div>
                        <dt>Automatic synchronization enabled</dt>
                        <dd>{isAutomaticSyncEnabled ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Last synchronized</dt>
                        <dd>{formatDateTime(syncPlan.lastSynchronizedAt)}</dd>
                      </div>
                      <div>
                        <dt>Items requiring review</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.itemsRequiringReview,
                            0,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>Archive Reconciliation</summary>
                    <dl>
                      <div>
                        <dt>Records matched</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.matchingIds,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Local-only</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.localOnly,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Cloud-only</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.onlineOnly,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Matching</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.unchangedRecords,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Local-newer</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.localNewer,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Cloud-newer</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.onlineNewer,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Conflicts</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.conflictRecords,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Requires review</dt>
                        <dd>
                          {Object.values(syncPlan.sections).reduce(
                            (total, section) => total + section.itemsRequiringReview,
                            0,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Invalid IDs</dt>
                        <dd>{syncPlan.diagnostics.reconciliation.invalidIds}</dd>
                      </div>
                      <div>
                        <dt>Timestamp parse failures</dt>
                        <dd>{syncPlan.diagnostics.reconciliation.timestampParseFailures}</dd>
                      </div>
                      <div>
                        <dt>Fingerprint mismatches</dt>
                        <dd>{syncPlan.diagnostics.reconciliation.fingerprintMismatches}</dd>
                      </div>
                      <div>
                        <dt>Baseline metadata present</dt>
                        <dd>
                          {syncPlan.diagnostics.reconciliation.baselineMetadataPresent ? 'Yes' : 'No'}
                        </dd>
                      </div>
                      <div>
                        <dt>Automatic gate reason</dt>
                        <dd>{syncPlan.diagnostics.reconciliation.automaticGateReason}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>Storage</summary>
                    <dl>
                      <div>
                        <dt>Storage readiness</dt>
                        <dd>{syncPlan.diagnostics.storage.bucketReachable ? 'Success' : 'Warning'}</dd>
                      </div>
                      <div>
                        <dt>Images extracted</dt>
                        <dd>{syncPlan.diagnostics.storage.localImagesExtracted}</dd>
                      </div>
                      <div>
                        <dt>Images prepared</dt>
                        <dd>{syncPlan.diagnostics.storage.imagesPrepared}</dd>
                      </div>
                      <div>
                        <dt>Images synchronized</dt>
                        <dd>{syncPlan.diagnostics.storage.imageUploadsSucceeded}</dd>
                      </div>
                      <div>
                        <dt>Images failed</dt>
                        <dd>{syncPlan.diagnostics.storage.imageUploadsFailed}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>Local Archive</summary>
                    <dl>
                      <div>
                        <dt>Local source</dt>
                        <dd>{syncPlan.diagnostics.localSource}</dd>
                      </div>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPlan.diagnostics.localInvestigationsRead}</dd>
                      </div>
                      <div>
                        <dt>Dossiers</dt>
                        <dd>{syncPlan.diagnostics.localDossiersRead}</dd>
                      </div>
                      <div>
                        <dt>Bonds</dt>
                        <dd>{syncPlan.diagnostics.localBondsRead}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPlan.diagnostics.localEvidencePinsRead}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>LoreBound Online</summary>
                    <dl>
                      <div>
                        <dt>Investigations query</dt>
                        <dd>{formatCloudQueryStatus(syncPlan.diagnostics.cloudQueries.cases)}</dd>
                      </div>
                      <div>
                        <dt>Dossiers query</dt>
                        <dd>{formatCloudQueryStatus(syncPlan.diagnostics.cloudQueries.dossiers)}</dd>
                      </div>
                      <div>
                        <dt>Bonds query</dt>
                        <dd>{formatCloudQueryStatus(syncPlan.diagnostics.cloudQueries.bonds)}</dd>
                      </div>
                      <div>
                        <dt>Evidence Board query</dt>
                        <dd>{formatCloudQueryStatus(syncPlan.diagnostics.cloudQueries.boardEntries)}</dd>
                      </div>
                    </dl>
                  </details>
                  <details>
                    <summary>System Information</summary>
                    <dl>
                      <div>
                        <dt>Environment mode</dt>
                        <dd>{systemInformation.environmentMode}</dd>
                      </div>
                      <div>
                        <dt>Browser platform</dt>
                        <dd>{systemInformation.browserPlatform}</dd>
                      </div>
                      <div>
                        <dt>Network state</dt>
                        <dd>{systemInformation.networkState}</dd>
                      </div>
                      <div>
                        <dt>Reduced motion</dt>
                        <dd>{systemInformation.reducedMotion}</dd>
                      </div>
                      <div>
                        <dt>Origin</dt>
                        <dd>{systemInformation.origin}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
                <button
                  ref={relockButtonRef}
                  type="button"
                  className="auth-button auth-button--secondary settings-relock-button"
                  onClick={() => setIsRelockConfirmOpen(true)}
                >
                  Relock Operations Console
                </button>
              </section>
            ) : null}
          </div>
        </div>

        {notice ? (
          <p className="settings-panel__notice" role="status" aria-live="polite">
            {notice}
          </p>
        ) : null}

        {isUnlockConfirmOpen ? (
          <div className="case-settings-confirm-backdrop" role="presentation">
            <section
              ref={unlockDialogRef}
              className="case-settings-confirm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="operations-unlocked-title"
            >
              <h3 id="operations-unlocked-title">Operations Console Unlocked</h3>
              <p>Advanced diagnostics are now available on this device.</p>
              <div className="auth-dialog__actions">
                <button
                  ref={unlockPrimaryButtonRef}
                  type="button"
                  className="auth-button auth-button--primary"
                  onClick={() => unlockConsole(true)}
                >
                  Open Operations Console
                </button>
                <button
                  ref={unlockCloseButtonRef}
                  type="button"
                  className="auth-button auth-button--quiet"
                  onClick={() => unlockConsole(false)}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {isRelockConfirmOpen ? (
          <div className="case-settings-confirm-backdrop" role="presentation">
            <section
              ref={relockDialogRef}
              className="case-settings-confirm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="operations-relock-title"
            >
              <h3 id="operations-relock-title">Relock Operations Console?</h3>
              <p>Advanced diagnostics will be hidden on this device.</p>
              <div className="auth-dialog__actions">
                <button
                  ref={relockCancelButtonRef}
                  type="button"
                  className="auth-button auth-button--quiet"
                  onClick={() => {
                    setIsRelockConfirmOpen(false);
                    window.setTimeout(() => relockButtonRef.current?.focus(), 0);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="auth-button auth-button--primary"
                  onClick={relockConsole}
                >
                  Relock Console
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
