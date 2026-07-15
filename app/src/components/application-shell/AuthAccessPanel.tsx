import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  authService,
  type AuthFailure,
  type AuthStatus,
} from '../../services/auth/AuthService';
import {
  cloudReadinessService,
  type CloudReadinessStatus,
} from '../../services/cloud/CloudReadinessService';
import { syncService } from '../../services/sync/SyncService';
import type { SyncPlan, SyncProgress, SyncResult } from '../../services/sync/SyncTypes';

type AuthView =
  | 'overview'
  | 'sign-in'
  | 'sign-up'
  | 'confirmation'
  | 'connected'
  | 'review'
  | 'confirm-sync'
  | 'confirm-retrieve'
  | 'progress'
  | 'complete'
  | 'sync-error';
type AuthNoticeState = 'idle' | 'confirmation-required' | 'connected' | 'signed-out' | 'error';

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
      localSource: 'caseStorage IndexedDB Local Archive',
      localDatabaseName: 'lorebound-local-archive',
      localDatabaseVersion: 4,
      localObjectStores: ['cases', 'dossiers', 'boardPins', 'bonds', 'meta'],
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
    },
  };
}

function createEmptyPlanSection() {
  return {
    newRecords: 0,
    existingRecords: 0,
    itemsRequiringReview: 0,
    localOnly: 0,
    onlineOnly: 0,
    matchingIds: 0,
    localNewer: 0,
    onlineNewer: 0,
    sameTimestampDifferingContents: 0,
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 102.4) / 10} KB`;
  }

  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

function formatSyncDateTime(value?: string | null) {
  if (!value) {
    return 'Not secured yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not secured yet';
  }

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (isToday) {
    return `Today ${time}`;
  }

  return `${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)} ${time}`;
}

function getReadableAuthError(error: AuthFailure) {
  const message = error.message.toLocaleLowerCase();
  const code = error.code.toLocaleLowerCase();

  if (!navigator.onLine) {
    return 'LoreBound Online is unavailable while you are offline. Your Local Archive remains available.';
  }

  if (message.includes('missing supabase') || code.includes('missing')) {
    return 'LoreBound Online is not available in this browser session. Your Local Archive remains available.';
  }

  if (message.includes('invalid email') || code.includes('email')) {
    return 'Enter a valid email address for your Investigator Profile.';
  }

  if (message.includes('weak') || message.includes('password')) {
    return 'Use a stronger password for your Investigator Profile.';
  }

  if (message.includes('already') || code.includes('already')) {
    return 'An Investigator Profile may already exist for that email. Try Investigator Connect.';
  }

  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'Unable to connect your Investigator Profile. Please verify your credentials and try again.';
  }

  if (message.includes('confirm') || message.includes('not confirmed')) {
    return 'Confirm your email before connecting your Investigator Profile.';
  }

  if (message.includes('redirect') || message.includes('not allowed')) {
    return 'LoreBound Online could not complete the email confirmation path for this browser.';
  }

  if (message.includes('rate') || message.includes('too many') || code.includes('rate')) {
    return 'Too many connection attempts. Wait a moment before trying again.';
  }

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  ) {
    return 'LoreBound Online cannot be reached right now. Your Local Archive remains available.';
  }

  return 'Unable to connect your Investigator Profile. Please verify your credentials and try again.';
}

function getLocalRecordTotal(plan: SyncPlan) {
  return (
    plan.local.caseCount +
    plan.local.dossierCount +
    plan.local.bondCount +
    plan.local.boardEntryCount
  );
}

function getOnlineRecordTotal(plan: SyncPlan) {
  return (
    plan.online.caseCount +
    plan.online.dossierCount +
    plan.online.bondCount +
    plan.online.boardEntryCount
  );
}

function getSummaryTotals(plan: SyncPlan) {
  const values = Object.values(plan.sections);

  return values.reduce(
    (totals, comparison) => ({
      newRecords: totals.newRecords + comparison.localOnly,
      updatedRecords:
        totals.updatedRecords +
        comparison.localNewer +
        comparison.sameTimestampDifferingContents,
      existingRecords: totals.existingRecords + comparison.existingRecords,
      itemsRequiringReview:
        totals.itemsRequiringReview + comparison.itemsRequiringReview,
    }),
    {
      newRecords: 0,
      updatedRecords: 0,
      existingRecords: 0,
      itemsRequiringReview: 0,
    },
  );
}

function getSyncActionLabel(plan: SyncPlan) {
  return plan.lastSynchronizedAt || getOnlineRecordTotal(plan) > 0
    ? 'Update Investigation'
    : 'Synchronize Investigation';
}

export function AuthAccessPanel() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [cloudReadiness, setCloudReadiness] = useState<CloudReadinessStatus | null>(null);
  const [syncPlan, setSyncPlan] = useState<SyncPlan>(emptyPlan);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [authView, setAuthView] = useState<AuthView>('overview');
  const [email, setEmail] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeState, setNoticeState] = useState<AuthNoticeState>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [connectivity, setConnectivity] = useState(navigator.onLine ? 'online' : 'offline');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isSignedIn = authStatus?.state === 'signed-in';
  const isConfirmationRequired = authStatus?.state === 'confirmation-required';
  const localRecordTotal = getLocalRecordTotal(syncPlan);
  const onlineRecordTotal = getOnlineRecordTotal(syncPlan);
  const summaryTotals = getSummaryTotals(syncPlan);
  const syncActionLabel = getSyncActionLabel(syncPlan);
  const hasNoSynchronizationChanges =
    localRecordTotal > 0 &&
    onlineRecordTotal > 0 &&
    summaryTotals.newRecords === 0 &&
    summaryTotals.updatedRecords === 0 &&
    summaryTotals.itemsRequiringReview === 0;
  const signUpValidation = useMemo(() => {
    if (authView !== 'sign-up') {
      return null;
    }

    if (!email.trim()) {
      return 'Email is required.';
    }

    if (!isValidEmail(email)) {
      return 'Enter a valid email address.';
    }

    if (!password) {
      return 'Password is required.';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }

    if (password !== confirmPassword) {
      return 'Passwords must match.';
    }

    return null;
  }, [authView, confirmPassword, email, password]);
  const signInValidation = useMemo(() => {
    if (authView !== 'sign-in') {
      return null;
    }

    if (!email.trim()) {
      return 'Email is required.';
    }

    if (!password) {
      return 'Password is required.';
    }

    return null;
  }, [authView, email, password]);
  const canSubmit =
    !isWorking &&
    ((authView === 'sign-up' && !signUpValidation) ||
      (authView === 'sign-in' && !signInValidation));

  useEffect(() => {
    let isMounted = true;

    async function refreshPanel() {
      const nextAuthStatus = await authService.getStatus();

      if (!isMounted) {
        return;
      }

      setAuthStatus(nextAuthStatus);

      if (nextAuthStatus.state === 'signed-in') {
        const [nextCloudReadiness, nextPlanResult] = await Promise.all([
          cloudReadinessService.check(),
          syncService.createPlan(),
        ]);

        if (isMounted) {
          setCloudReadiness(nextCloudReadiness);
          setSyncPlan(nextPlanResult.plan);
        }
      }
    }

    const subscription = authService.onAuthStateChanged((nextAuthStatus) => {
      setAuthStatus(nextAuthStatus);

      if (nextAuthStatus.state === 'signed-in') {
        void Promise.all([
          cloudReadinessService.check(),
          syncService.createPlan(),
        ]).then(([nextCloudReadiness, nextPlanResult]) => {
          setCloudReadiness(nextCloudReadiness);
          setSyncPlan(nextPlanResult.plan);
        });
      } else {
        setCloudReadiness(null);
        setSyncPlan(emptyPlan());
      }
    });
    const updateOnlineStatus = () => setConnectivity(navigator.onLine ? 'online' : 'offline');

    void refreshPanel();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    function handleOpenLibraryAccess(event: Event) {
      const requestedView =
        event instanceof CustomEvent &&
        (event.detail?.view === 'review' || event.detail?.view === 'sign-out')
          ? event.detail.view
          : 'overview';

      setIsOpen(true);

      if (requestedView === 'sign-out' && isSignedIn) {
        void handleInvestigatorOffline();
        return;
      }

      if (requestedView === 'review' && isSignedIn) {
        void refreshSynchronizationReview();
        return;
      }

      goToView(isSignedIn ? 'connected' : 'overview');
    }

    window.addEventListener('lorebound:open-library-access', handleOpenLibraryAccess);

    return () => {
      window.removeEventListener('lorebound:open-library-access', handleOpenLibraryAccess);
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
  }, [isOpen]);

  function closeDialog() {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function continueOffline() {
    setNotice(null);
    setNoticeState('idle');
    closeDialog();
  }

  function resetNotice() {
    if (noticeState === 'error') {
      setNotice(null);
      setNoticeState('idle');
    }
  }

  function goToView(nextView: AuthView) {
    setAuthView(nextView);
    setNotice(null);
    setNoticeState('idle');
    setSyncResult(null);
    setPassword('');
    setConfirmPassword('');
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !isWorking) {
      closeDialog();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'));

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

  async function refreshSignedInStatus(nextStatus: AuthStatus, successMessage: string) {
    setAuthStatus(nextStatus);
    const [nextCloudReadiness, nextPlanResult] = await Promise.all([
      cloudReadinessService.check(),
      syncService.createPlan(),
    ]);
    setCloudReadiness(nextCloudReadiness);
    setSyncPlan(nextPlanResult.plan);
    setNotice(successMessage);
    setNoticeState('connected');
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setNotice(signUpValidation ?? signInValidation ?? 'Complete the archive request first.');
      setNoticeState('error');
      return;
    }

    setIsWorking(true);
    setNotice(null);
    setNoticeState('idle');

    const trimmedEmail = email.trim();
    const result =
      authView === 'sign-up'
        ? await authService.signUp({ email: trimmedEmail, password })
        : await authService.signIn({ email: trimmedEmail, password });

    if (!result.ok) {
      setAuthStatus(result.status);
      setNotice(getReadableAuthError(result.error));
      setNoticeState('error');
      setIsWorking(false);
      return;
    }

    if (result.status.state === 'confirmation-required') {
      const nextEmail = result.status.confirmationEmail ?? trimmedEmail;
      setAuthStatus(result.status);
      setConfirmedEmail(nextEmail);
      setAuthView('confirmation');
      setNotice(null);
      setNoticeState('confirmation-required');
      setPassword('');
      setConfirmPassword('');
      setIsWorking(false);
      return;
    }

    if (result.status.state === 'signed-in') {
      await refreshSignedInStatus(
        result.status,
        'Connected to LoreBound Online. Your investigations remain inside your Local Archive until you choose to synchronize them.',
      );
      setPassword('');
      setConfirmPassword('');
      setAuthView('connected');
      setIsWorking(false);
      return;
    }

    setAuthStatus(result.status);
    setNotice('Offline Mode remains available.');
    setIsWorking(false);
  }

  async function handleInvestigatorOffline() {
    setIsWorking(true);
    setNotice(null);

    const result = await authService.signOut();

    if (!result.ok) {
      setNotice(getReadableAuthError(result.error));
      setNoticeState('error');
      setIsWorking(false);
      return;
    }

    setAuthStatus(result.status);
    setCloudReadiness(null);
    setSyncPlan(emptyPlan());
    setAuthView('overview');
    setNotice('Investigator Offline. Your Local Archive remains available.');
    setNoticeState('signed-out');
    setIsWorking(false);
  }

  const controlLabel =
    connectivity === 'offline'
      ? 'Offline Mode'
      : isSignedIn
        ? 'Connected to LoreBound Online'
        : isConfirmationRequired
          ? 'Confirmation Required'
          : 'Local Archive';
  const readinessLabel =
    connectivity === 'offline'
      ? 'Offline Mode'
      : isSignedIn
        ? (cloudReadiness?.label ?? 'Reviewing LoreBound Online access...')
        : 'Connect to review LoreBound Online';
  const formTitle = authView === 'sign-up' ? 'Create Investigator Profile' : 'Investigator Connect';
  const formValidation = authView === 'sign-up' ? signUpValidation : signInValidation;

  async function refreshSynchronizationReview() {
    const nextPlanResult = await syncService.createPlan();
    setSyncPlan(nextPlanResult.plan);
    setSyncResult(null);
    setSyncProgress(null);
    setAuthView('review');
  }

  async function runSynchronization() {
    setIsWorking(true);
    setAuthView('progress');
    setSyncResult(null);
    const result = await syncService.synchronize(setSyncProgress);
    setSyncResult(result);
    setIsWorking(false);
    setAuthView(result.ok ? 'complete' : 'sync-error');
    const nextPlanResult = await syncService.createPlan();
    setSyncPlan(nextPlanResult.plan);
  }

  async function runRetrieval() {
    setIsWorking(true);
    setAuthView('progress');
    setSyncResult(null);
    const result = await syncService.retrieve(setSyncProgress);
    setSyncResult(result);
    setIsWorking(false);
    setAuthView(result.ok ? 'complete' : 'sync-error');
    const nextPlanResult = await syncService.createPlan();
    setSyncPlan(nextPlanResult.plan);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="account-status-control"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
      >
        <span>{controlLabel}</span>
        <strong>{isSignedIn ? authStatus.user?.email : 'Investigator Profile'}</strong>
      </button>

      {isOpen ? (
        <div className="auth-dialog-backdrop" role="presentation">
          <section
            ref={dialogRef}
            className="auth-dialog auth-dialog--file"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            onKeyDown={handleDialogKeyDown}
          >
            <header className="auth-dialog__header">
              <div>
                <p>Archive Credential</p>
                <h2 id="auth-dialog-title">Library Access</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="auth-dialog__close"
                onClick={closeDialog}
                disabled={isWorking}
              >
                Close
              </button>
            </header>

            {isSignedIn && authView !== 'review' ? (
              <div className="auth-dialog__signed-in">
                <span>Connected to LoreBound Online</span>
                <p>Your Investigator Profile is now connected.</p>
                <p>
                  Your investigations remain stored inside your Local Archive until you choose to
                  synchronize them.
                </p>
                <small>{authStatus.user?.email}</small>
                <small>{readinessLabel}</small>
                <small>{cloudReadiness?.detail}</small>
                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={refreshSynchronizationReview}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={handleInvestigatorOffline}
                    disabled={isWorking}
                  >
                    Investigator Offline
                  </button>
                </div>
              </div>
            ) : null}

            {!isSignedIn && authView === 'overview' ? (
              <div className="auth-dialog__overview">
                <div className="auth-dialog__state-card">
                  <span>Current Archive</span>
                  <strong>Local Archive</strong>
                </div>
                <p>
                  Continue investigating locally or connect your Investigator Profile to LoreBound
                  Online.
                </p>
                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={() => goToView('sign-in')}
                  >
                    Investigator Connect
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={() => goToView('sign-up')}
                  >
                    Create Investigator Profile
                  </button>
                  <button type="button" className="auth-button auth-button--quiet" onClick={continueOffline}>
                    Continue Offline
                  </button>
                </div>
              </div>
            ) : null}

            {!isSignedIn && (authView === 'sign-in' || authView === 'sign-up') ? (
              <form className="auth-dialog__form" onSubmit={handleAuthSubmit}>
                <div className="auth-dialog__form-heading">
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={() => goToView('overview')}
                    disabled={isWorking}
                  >
                    Back
                  </button>
                  <h3>{formTitle}</h3>
                </div>

                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    resetNotice();
                  }}
                  aria-describedby="auth-form-message"
                  required
                />

                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  autoComplete={authView === 'sign-up' ? 'new-password' : 'current-password'}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    resetNotice();
                  }}
                  aria-describedby="auth-password-hint auth-form-message"
                  required
                />
                {authView === 'sign-up' ? (
                  <small id="auth-password-hint">Use at least 6 characters.</small>
                ) : null}

                {authView === 'sign-up' ? (
                  <>
                    <label htmlFor="auth-confirm-password">Confirm Password</label>
                    <input
                      id="auth-confirm-password"
                      type="password"
                      value={confirmPassword}
                      autoComplete="new-password"
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        resetNotice();
                      }}
                      aria-describedby="auth-form-message"
                      required
                    />
                  </>
                ) : null}

                {formValidation ? (
                  <p className="auth-dialog__inline-validation">{formValidation}</p>
                ) : null}

                <div className="auth-dialog__form-actions">
                  <button type="submit" className="auth-button auth-button--primary" disabled={!canSubmit}>
                    {isWorking ? 'Reviewing...' : formTitle}
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={continueOffline}
                    disabled={isWorking}
                  >
                    Continue Offline
                  </button>
                </div>
              </form>
            ) : null}

            {!isSignedIn && authView === 'confirmation' ? (
              <div className="auth-dialog__confirmation">
                <h3>Investigator Profile Created</h3>
                <p>Your Investigator Profile has been prepared.</p>
                <p>Confirm your email to connect with LoreBound Online.</p>
                <strong>{confirmedEmail}</strong>
                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={() => goToView('sign-in')}
                  >
                    Investigator Connect
                  </button>
                  <button type="button" className="auth-button auth-button--quiet" onClick={continueOffline}>
                    Continue Offline
                  </button>
                </div>
              </div>
            ) : null}

            {isSignedIn && authView === 'review' ? (
              <section className="archive-sync-review" aria-labelledby="archive-sync-title">
                <div>
                  <p>Archive Synchronization Review</p>
                  <h3 id="archive-sync-title">
                    No investigation will be committed until you approve synchronization.
                  </h3>
                </div>
                <div className="archive-sync-review__status">
                  <span>Last Secured</span>
                  <strong>{formatSyncDateTime(syncPlan.lastSynchronizedAt)}</strong>
                </div>
                {localRecordTotal === 0 ? (
                  <p>This browser origin does not currently contain archived investigations.</p>
                ) : (
                  <p>Review the records inside this browser's Local Archive.</p>
                )}
                {hasNoSynchronizationChanges ? (
                  <p>LoreBound Online already contains the latest version of this Investigation.</p>
                ) : null}
                {syncPlan.online.isAvailable && onlineRecordTotal === 0 ? (
                  <p>LoreBound Online does not yet contain any archived investigations.</p>
                ) : null}
                {!syncPlan.online.isAvailable ? (
                  <p>LoreBound Online could not be reviewed. Your Local Archive remains unchanged.</p>
                ) : null}
                {syncPlan.imageStatus.awaitingStorageSetup > 0 ? (
                  <p>{syncPlan.imageStatus.message}</p>
                ) : null}

                <div className="archive-sync-review__groups">
                  <section>
                    <h4>Local Archive</h4>
                    <dl>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPlan.local.caseCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Files</dt>
                        <dd>{syncPlan.local.dossierCount}</dd>
                      </div>
                      <div>
                        <dt>Connections</dt>
                        <dd>{syncPlan.local.bondCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPlan.local.boardEntryCount}</dd>
                      </div>
                      <div>
                        <dt>Stored Images</dt>
                        <dd>{syncPlan.local.localImageCount}</dd>
                      </div>
                      <div>
                        <dt>Estimated Transfer Size</dt>
                        <dd>{formatBytes(syncPlan.local.estimatedTransferBytes)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h4>LoreBound Online</h4>
                    <dl>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPlan.online.caseCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Files</dt>
                        <dd>{syncPlan.online.dossierCount}</dd>
                      </div>
                      <div>
                        <dt>Connections</dt>
                        <dd>{syncPlan.online.bondCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPlan.online.boardEntryCount}</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h4>Synchronization Summary</h4>
                    <dl>
                      <div>
                        <dt>New Records</dt>
                        <dd>{summaryTotals.newRecords}</dd>
                      </div>
                      <div>
                        <dt>Updated Records</dt>
                        <dd>{summaryTotals.updatedRecords}</dd>
                      </div>
                      <div>
                        <dt>No Changes</dt>
                        <dd>{summaryTotals.existingRecords}</dd>
                      </div>
                      <div>
                        <dt>Items Requiring Review</dt>
                        <dd>{summaryTotals.itemsRequiringReview}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
                {syncPlan.blockingReasons.length > 0 ? (
                  <p>{syncPlan.blockingReasons[0]}</p>
                ) : null}
                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    disabled={!syncPlan.canSynchronize || isWorking}
                    onClick={() => goToView('confirm-sync')}
                    title={!syncPlan.canSynchronize ? syncPlan.blockingReasons[0] : undefined}
                  >
                    {syncActionLabel}
                  </button>
                  {syncPlan.canRetrieve ? (
                    <button
                      type="button"
                      className="auth-button auth-button--secondary"
                      disabled={isWorking}
                      onClick={() => goToView('confirm-retrieve')}
                    >
                      Retrieve Investigation
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {isSignedIn && authView === 'confirm-sync' ? (
              <section className="archive-sync-review" aria-live="polite">
                <div>
                  <p>Secure this Investigation within LoreBound Online.</p>
                  <h3>Synchronize Investigation</h3>
                </div>
                <div className="archive-sync-review__groups">
                  <section>
                    <h4>Investigation Name</h4>
                    <p>{syncPlan.local.investigationName ?? 'Local Archive Investigation'}</p>
                  </section>
                  <section>
                    <h4>Local Archive Summary</h4>
                    <dl>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPlan.local.caseCount}</dd>
                      </div>
                      <div>
                        <dt>Dossiers</dt>
                        <dd>{syncPlan.local.dossierCount}</dd>
                      </div>
                      <div>
                        <dt>Bonds</dt>
                        <dd>{syncPlan.local.bondCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPlan.local.boardEntryCount}</dd>
                      </div>
                      <div>
                        <dt>Stored Images</dt>
                        <dd>{syncPlan.local.localImageCount}</dd>
                      </div>
                      <div>
                        <dt>Estimated Transfer Size</dt>
                        <dd>{formatBytes(syncPlan.local.estimatedTransferBytes)}</dd>
                      </div>
                      <div>
                        <dt>Items Requiring Review</dt>
                        <dd>{summaryTotals.itemsRequiringReview}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
                <p>
                  Your Local Archive will remain on this device. Synchronizing does not remove or
                  replace your local records. If synchronization is interrupted, your Local Archive
                  remains unchanged.
                </p>
                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={() => goToView('review')}
                    disabled={isWorking}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={runSynchronization}
                    disabled={isWorking}
                  >
                    {syncActionLabel}
                  </button>
                </div>
              </section>
            ) : null}

            {isSignedIn && authView === 'confirm-retrieve' ? (
              <section className="archive-sync-review" aria-live="polite">
                <h3>Retrieve Investigation from LoreBound Online?</h3>
                <p>Records will be written into this empty Local Archive.</p>
                <div className="archive-sync-review__groups">
                  <section>
                    <h4>LoreBound Online Archive</h4>
                    <dl>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPlan.online.caseCount}</dd>
                      </div>
                      <div>
                        <dt>Dossiers</dt>
                        <dd>{syncPlan.online.dossierCount}</dd>
                      </div>
                      <div>
                        <dt>Bonds</dt>
                        <dd>{syncPlan.online.bondCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPlan.online.boardEntryCount}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
                <div className="auth-dialog__actions">
                  <button type="button" className="auth-button auth-button--primary" onClick={runRetrieval}>
                    Retrieve Investigation
                  </button>
                  <button type="button" className="auth-button auth-button--quiet" onClick={() => goToView('review')}>
                    Return to Review
                  </button>
                </div>
              </section>
            ) : null}

            {isSignedIn && authView === 'progress' ? (
              <section className="archive-sync-review" aria-live="polite">
                <p>{syncActionLabel}</p>
                <h3>{syncProgress?.stage ?? 'Preparing Archive'}</h3>
                <p>{syncProgress?.detail ?? 'Reviewing Local Archive records before securing them.'}</p>
                <div className="archive-sync-progress">
                  <dl>
                    <div>
                      <dt>Completed Images</dt>
                      <dd>{syncProgress?.completedImages ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Completed Records</dt>
                      <dd>{syncProgress?.completedRecords ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Remaining Records</dt>
                      <dd>{syncProgress?.remainingRecords ?? localRecordTotal}</dd>
                    </div>
                  </dl>
                  {syncProgress?.completedStages.length ? (
                    <section>
                      <h4>Completed Stages</h4>
                      <ul>
                        {syncProgress.completedStages.map((stage) => (
                          <li key={stage}>{stage}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              </section>
            ) : null}

            {isSignedIn && authView === 'complete' && syncResult ? (
              <section className="archive-sync-review" aria-live="polite">
                <div>
                  <p>Your Investigation has been secured within LoreBound Online.</p>
                  <h3>Investigation Secured</h3>
                </div>
                <div className="archive-sync-review__groups">
                  <section>
                    <h4>Secured Summary</h4>
                    <dl>
                      <div>
                        <dt>Investigations synchronized</dt>
                        <dd>{syncResult.counts.cases}</dd>
                      </div>
                      <div>
                        <dt>Evidence Files synchronized</dt>
                        <dd>{syncResult.counts.dossiers}</dd>
                      </div>
                      <div>
                        <dt>Connections synchronized</dt>
                        <dd>{syncResult.counts.bonds}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins synchronized</dt>
                        <dd>{syncResult.counts.boardEntries}</dd>
                      </div>
                      <div>
                        <dt>Stored Images synchronized</dt>
                        <dd>{syncResult.counts.images ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Transfer Size</dt>
                        <dd>{formatBytes(syncResult.transferSize ?? syncPlan.local.estimatedTransferBytes)}</dd>
                      </div>
                      <div>
                        <dt>Completion Time</dt>
                        <dd>{formatSyncDateTime(syncResult.completedAt)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
                <p>Your Local Archive remains available on this device.</p>
                <div className="auth-dialog__actions">
                  <button type="button" className="auth-button auth-button--primary" onClick={closeDialog}>
                    Continue Investigation
                  </button>
                  <button type="button" className="auth-button auth-button--quiet" onClick={closeDialog}>
                    Close
                  </button>
                </div>
              </section>
            ) : null}

            {isSignedIn && authView === 'sync-error' && syncResult ? (
              <section className="archive-sync-review" aria-live="assertive">
                <div>
                  <p>{syncResult.message}</p>
                  <h3>Synchronization Interrupted</h3>
                </div>
                <p>
                  Your Local Archive remains intact. LoreBound Online may contain an incomplete
                  Investigation. Review the details below before retrying.
                </p>
                <div className="archive-sync-review__groups">
                  <section>
                    <h4>Interruption Details</h4>
                    <dl>
                      <div>
                        <dt>Completed stages</dt>
                        <dd>{syncResult.completedStages?.length ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Failed stage</dt>
                        <dd>{syncResult.failedStage ?? 'Review required'}</dd>
                      </div>
                      <div>
                        <dt>Items requiring review</dt>
                        <dd>{syncResult.itemsRequiringReview ?? summaryTotals.itemsRequiringReview}</dd>
                      </div>
                    </dl>
                  </section>
                  {syncResult.completedStages?.length ? (
                    <section>
                      <h4>Completed Stages</h4>
                      <ul className="archive-sync-stage-list">
                        {syncResult.completedStages.map((stage) => (
                          <li key={stage}>{stage}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
                <div className="auth-dialog__actions">
                  <button type="button" className="auth-button auth-button--primary" onClick={refreshSynchronizationReview}>
                    Retry
                  </button>
                  <button type="button" className="auth-button auth-button--quiet" onClick={closeDialog}>
                    Return to Local Archive
                  </button>
                </div>
              </section>
            ) : null}

            {notice ? (
              <p
                id="auth-form-message"
                className="auth-dialog__notice"
                data-state={noticeState}
                role={noticeState === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {notice}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
