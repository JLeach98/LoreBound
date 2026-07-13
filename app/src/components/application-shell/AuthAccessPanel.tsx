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
import {
  firstSyncPreviewService,
  type FirstSyncPreview,
} from '../../services/migration/FirstSyncPreviewService';

type AuthView = 'overview' | 'sign-in' | 'sign-up' | 'confirmation' | 'connected' | 'review';
type AuthNoticeState = 'idle' | 'confirmation-required' | 'connected' | 'signed-out' | 'error';

function emptyPreview(): FirstSyncPreview {
  return {
    local: {
      caseCount: 0,
      dossierCount: 0,
      bondCount: 0,
      boardEntryCount: 0,
      localImageCount: 0,
      estimatedUploadBytes: 0,
    },
    cloud: {
      isAvailable: false,
      caseCount: 0,
      dossierCount: 0,
      bondCount: 0,
      boardEntryCount: 0,
    },
    comparison: {
      cases: { localOnly: 0, cloudOnly: 0, matching: 0, potentialConflicts: 0, duplicateRisk: 0 },
      dossiers: { localOnly: 0, cloudOnly: 0, matching: 0, potentialConflicts: 0, duplicateRisk: 0 },
      bonds: { localOnly: 0, cloudOnly: 0, matching: 0, potentialConflicts: 0, duplicateRisk: 0 },
      boardEntries: {
        localOnly: 0,
        cloudOnly: 0,
        matching: 0,
        potentialConflicts: 0,
        duplicateRisk: 0,
      },
    },
    message: 'Connect your Investigator Profile to review archive synchronization.',
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

function getLocalRecordTotal(preview: FirstSyncPreview) {
  return (
    preview.local.caseCount +
    preview.local.dossierCount +
    preview.local.bondCount +
    preview.local.boardEntryCount
  );
}

function getCloudRecordTotal(preview: FirstSyncPreview) {
  return (
    preview.cloud.caseCount +
    preview.cloud.dossierCount +
    preview.cloud.bondCount +
    preview.cloud.boardEntryCount
  );
}

function getSummaryTotals(preview: FirstSyncPreview) {
  const values = Object.values(preview.comparison);

  return values.reduce(
    (totals, comparison) => ({
      newRecords: totals.newRecords + comparison.localOnly,
      existingRecords: totals.existingRecords + comparison.matching,
      itemsRequiringReview:
        totals.itemsRequiringReview + comparison.potentialConflicts + comparison.duplicateRisk,
    }),
    {
      newRecords: 0,
      existingRecords: 0,
      itemsRequiringReview: 0,
    },
  );
}

export function AuthAccessPanel() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [cloudReadiness, setCloudReadiness] = useState<CloudReadinessStatus | null>(null);
  const [syncPreview, setSyncPreview] = useState<FirstSyncPreview>(emptyPreview);
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
  const localRecordTotal = getLocalRecordTotal(syncPreview);
  const cloudRecordTotal = getCloudRecordTotal(syncPreview);
  const summaryTotals = getSummaryTotals(syncPreview);
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
        const [nextCloudReadiness, nextPreview] = await Promise.all([
          cloudReadinessService.check(),
          firstSyncPreviewService.preview(),
        ]);

        if (isMounted) {
          setCloudReadiness(nextCloudReadiness);
          setSyncPreview(nextPreview);
        }
      }
    }

    const subscription = authService.onAuthStateChanged((nextAuthStatus) => {
      setAuthStatus(nextAuthStatus);

      if (nextAuthStatus.state === 'signed-in') {
        void Promise.all([
          cloudReadinessService.check(),
          firstSyncPreviewService.preview(),
        ]).then(([nextCloudReadiness, nextPreview]) => {
          setCloudReadiness(nextCloudReadiness);
          setSyncPreview(nextPreview);
        });
      } else {
        setCloudReadiness(null);
        setSyncPreview(emptyPreview());
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
    const [nextCloudReadiness, nextPreview] = await Promise.all([
      cloudReadinessService.check(),
      firstSyncPreviewService.preview(),
    ]);
    setCloudReadiness(nextCloudReadiness);
    setSyncPreview(nextPreview);
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
    setSyncPreview(emptyPreview());
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
                    onClick={() => goToView('review')}
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
                {localRecordTotal === 0 ? (
                  <p>This browser origin does not currently contain archived investigations.</p>
                ) : (
                  <p>Review the records inside this browser's Local Archive.</p>
                )}
                {syncPreview.cloud.isAvailable && cloudRecordTotal === 0 ? (
                  <p>LoreBound Online does not yet contain any archived investigations.</p>
                ) : null}
                {!syncPreview.cloud.isAvailable ? (
                  <p>LoreBound Online could not be reviewed. Your Local Archive remains unchanged.</p>
                ) : null}

                <div className="archive-sync-review__groups">
                  <section>
                    <h4>Local Archive</h4>
                    <dl>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPreview.local.caseCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Files</dt>
                        <dd>{syncPreview.local.dossierCount}</dd>
                      </div>
                      <div>
                        <dt>Connections</dt>
                        <dd>{syncPreview.local.bondCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPreview.local.boardEntryCount}</dd>
                      </div>
                      <div>
                        <dt>Stored Images</dt>
                        <dd>{syncPreview.local.localImageCount}</dd>
                      </div>
                      <div>
                        <dt>Estimated Transfer Size</dt>
                        <dd>{formatBytes(syncPreview.local.estimatedUploadBytes)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h4>LoreBound Online</h4>
                    <dl>
                      <div>
                        <dt>Investigations</dt>
                        <dd>{syncPreview.cloud.caseCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Files</dt>
                        <dd>{syncPreview.cloud.dossierCount}</dd>
                      </div>
                      <div>
                        <dt>Connections</dt>
                        <dd>{syncPreview.cloud.bondCount}</dd>
                      </div>
                      <div>
                        <dt>Evidence Pins</dt>
                        <dd>{syncPreview.cloud.boardEntryCount}</dd>
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
                        <dt>Existing Records</dt>
                        <dd>{summaryTotals.existingRecords}</dd>
                      </div>
                      <div>
                        <dt>Items Requiring Review</dt>
                        <dd>{summaryTotals.itemsRequiringReview}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
                <button type="button" className="auth-button auth-button--secondary" disabled>
                  Synchronize Investigation is not yet available
                </button>
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
