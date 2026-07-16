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
import { useInvestigatorProfile } from '../../services/profile/InvestigatorProfileContext';
import { useAutomaticSync } from '../../services/sync/AutomaticSyncContext';
import { syncService } from '../../services/sync/SyncService';
import { getSyncPlanArchiveAction, type SyncPlan, type SyncProgress, type SyncResult } from '../../services/sync/SyncTypes';

type AuthView =
  | 'overview'
  | 'sign-in'
  | 'sign-up'
  | 'confirmation'
  | 'connected'
  | 'profile-onboarding'
  | 'edit-profile'
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
      reconciliation: {
        baselineMetadataPresent: false,
        invalidIds: 0,
        timestampParseFailures: 0,
        fingerprintMismatches: 0,
        automaticGateReason: 'Not reviewed.',
      },
      archiveState: {
        classification: 'Empty',
        activeInvestigationIdPresent: false,
        sameInvestigationIdLocalAndCloud: false,
        localCaseStableId: null,
        cloudCaseStableId: null,
        caseNormalizedMatch: false,
        retrievalEligibility: 'Blocked',
        retrievalBlockReason: 'Not reviewed.',
        actionEnabled: false,
        disabledReason: 'Not reviewed.',
        handlerPresent: false,
        repairEligibility: 'Blocked',
        repairStage: 'Not started.',
        selectedAction: 'Not reviewed.',
        selectedActionReason: 'Not reviewed.',
        localImageReferences: 0,
        cloudImageReferences: 0,
      },
    },
  };
}

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

function formatMemberSince(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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
      localOnly: totals.localOnly + comparison.localOnly,
      cloudOnly: totals.cloudOnly + comparison.onlineOnly,
      localNewer: totals.localNewer + comparison.localNewer,
      cloudNewer: totals.cloudNewer + comparison.onlineNewer,
      newRecords: totals.newRecords + comparison.localOnly,
      updatedRecords: totals.updatedRecords + comparison.updatedRecords,
      existingRecords: totals.existingRecords + comparison.unchangedRecords,
      cloudUpdatesAvailable:
        totals.cloudUpdatesAvailable + comparison.cloudUpdatesAvailable,
      conflicts: totals.conflicts + comparison.conflictRecords,
      itemsRequiringReview:
        totals.itemsRequiringReview + comparison.itemsRequiringReview,
    }),
    {
      localOnly: 0,
      cloudOnly: 0,
      localNewer: 0,
      cloudNewer: 0,
      newRecords: 0,
      updatedRecords: 0,
      existingRecords: 0,
      cloudUpdatesAvailable: 0,
      conflicts: 0,
      itemsRequiringReview: 0,
    },
  );
}

function getArchiveStatusLabel(totals: ReturnType<typeof getSummaryTotals>) {
  if (totals.conflicts > 0) {
    return 'Archive Reconciliation Required';
  }

  if (totals.itemsRequiringReview > 0) {
    return 'Review Required';
  }

  if (totals.cloudUpdatesAvailable > 0) {
    return 'LoreBound Online Updates Available';
  }

  if (totals.newRecords + totals.updatedRecords > 0) {
    return 'Local Changes Waiting';
  }

  return 'Archive Up To Date';
}

export function AuthAccessPanel() {
  const {
    profile,
    profilePhotoUrl,
    isLoading: isProfileLoading,
    errorMessage: profileError,
    profileState,
    needsOnboarding,
    saveProfile,
  } = useInvestigatorProfile();
  const {
    isAutomaticSyncEnabled,
    lastAutomaticSyncAt,
    setAutomaticSyncEnabled,
    synchronizeNow,
  } = useAutomaticSync();
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
  const [profileUsername, setProfileUsername] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileTitle, setProfileTitle] = useState('Investigator');
  const [profileBio, setProfileBio] = useState('');
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(null);
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
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
  const identityLabel = profile?.username ?? authStatus?.user?.displayName ?? 'Investigator Profile';
  const localRecordTotal = getLocalRecordTotal(syncPlan);
  const onlineRecordTotal = getOnlineRecordTotal(syncPlan);
  const summaryTotals = getSummaryTotals(syncPlan);
  const archiveAction = getSyncPlanArchiveAction(syncPlan);
  const isPartialLocalArchive =
    syncPlan.diagnostics.archiveState.classification === 'Partial Local Archive';
  const archiveStatusLabel = isPartialLocalArchive
    ? 'Local Archive Incomplete'
    : getArchiveStatusLabel(summaryTotals);
  const pendingLocalChanges =
    summaryTotals.localOnly +
    summaryTotals.localNewer +
    summaryTotals.conflicts +
    summaryTotals.itemsRequiringReview;
  const syncActionLabel = archiveAction.kind === 'sync' ? archiveAction.label : 'Synchronize Investigation';
  const isRetrievalAction = archiveAction.kind === 'retrieve' || archiveAction.kind === 'repair-local-archive';
  const retrieveActionLabel = isRetrievalAction ? archiveAction.label : 'Retrieve Investigation';
  const reconciliationDiagnosticTotals = Object.values(syncPlan.sections).reduce(
    (totals, section) => ({
      conflicts: totals.conflicts + section.conflictRecords,
      reviewItems: totals.reviewItems + section.itemsRequiringReview,
      localOnly: totals.localOnly + section.localOnly,
      cloudOnly: totals.cloudOnly + section.onlineOnly,
    }),
    {
      conflicts: 0,
      reviewItems: 0,
      localOnly: 0,
      cloudOnly: 0,
    },
  );
  const hasNoSynchronizationChanges =
    localRecordTotal > 0 &&
    onlineRecordTotal > 0 &&
    summaryTotals.newRecords === 0 &&
    summaryTotals.updatedRecords === 0 &&
    summaryTotals.cloudUpdatesAvailable === 0 &&
    summaryTotals.conflicts === 0 &&
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
  const profileValidation = useMemo(() => {
    if (authView !== 'profile-onboarding' && authView !== 'edit-profile') {
      return null;
    }

    if (profileUsername.trim().length < 3) {
      return 'Username must be at least 3 characters.';
    }

    if (profileTitle.trim().length < 2) {
      return 'Investigator title is required.';
    }

    return null;
  }, [authView, profileTitle, profileUsername]);

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
        (event.detail?.view === 'review' ||
          event.detail?.view === 'sign-out' ||
          event.detail?.view === 'profile' ||
          event.detail?.view === 'setup')
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

      if (requestedView === 'setup' && isSignedIn) {
        goToView('profile-onboarding');
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

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileUsername(profile.username);
    setProfileDisplayName(profile.displayName ?? '');
    setProfileTitle(profile.title);
    setProfileBio(profile.bio ?? '');
    setProfilePhotoDataUrl(null);
    setRemoveProfilePhoto(false);
  }, [profile]);

  useEffect(() => {
    if (isSignedIn && needsOnboarding) {
      setIsOpen(true);
      setAuthView('profile-onboarding');
    }
  }, [isSignedIn, needsOnboarding]);

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

  function handleProfilePhotoChange(file: File | null) {
    if (!file) {
      setProfilePhotoDataUrl(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePhotoDataUrl(reader.result);
        setRemoveProfilePhoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (profileValidation) {
      setNotice(profileValidation);
      setNoticeState('error');
      return;
    }

    setIsWorking(true);
    setNotice(null);

    try {
      await saveProfile({
        username: profileUsername,
        displayName: profileDisplayName,
        title: profileTitle,
        bio: profileBio,
        profilePhotoDataUrl,
        removeProfilePhoto,
        onboardingCompleted: true,
      });
      setProfilePhotoDataUrl(null);
      setRemoveProfilePhoto(false);
      setNotice('Investigator Profile updated.');
      setNoticeState('connected');
      setAuthView('connected');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'The Investigator Profile could not be updated.',
      );
      setNoticeState('error');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSynchronizeNow() {
    setIsWorking(true);

    try {
      await synchronizeNow();
      const nextPlanResult = await syncService.createPlan();
      setSyncPlan(nextPlanResult.plan);
      setNotice('Investigation Synchronized.');
      setNoticeState('connected');
    } catch {
      setNotice('Synchronization Failed. Review synchronization before trying again.');
      setNoticeState('error');
    } finally {
      setIsWorking(false);
    }
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

  function openLibraryAccess() {
    setAuthView(isSignedIn ? 'connected' : 'overview');
    setIsOpen(true);
  }

  function getProfileStateMessage() {
    if (profileState === 'loading' || isProfileLoading) {
      return 'Loading Investigator Profile';
    }

    if (profileState === 'migration-unavailable') {
      return 'Investigator Profile setup is not yet available because LoreBound Online requires a database update.';
    }

    if (profileState === 'permission-denied') {
      return 'Unable to open Investigator Profile. Your Local Archive remains available.';
    }

    if (profileState === 'offline') {
      return 'LoreBound Online is unavailable while you are offline. Your Local Archive remains available.';
    }

    if (profileState === 'no-profile' || profileState === 'profile-creation-required') {
      return 'Investigator Profile setup is ready. Prepare your personnel file to continue.';
    }

    if (profileState === 'unexpected-failure') {
      return profileError ?? 'Unable to open Investigator Profile. Your Local Archive remains available.';
    }

    return null;
  }

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

  const profileStateMessage = getProfileStateMessage();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="account-status-control"
        onClick={openLibraryAccess}
        aria-haspopup="dialog"
      >
        <span>{controlLabel}</span>
        <strong>{isSignedIn ? identityLabel : 'Investigator Profile'}</strong>
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

            {isSignedIn && authView === 'connected' ? (
              <div className="auth-dialog__signed-in auth-dialog__personnel-file">
                <div className="profile-credential">
                  <div className="profile-credential__photo" aria-hidden="true">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="" />
                    ) : (
                      <span>{identityLabel.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <span>{profile?.username ?? 'Investigator Profile'}</span>
                    <h3>{profile?.displayName || profile?.username || 'Investigator'}</h3>
                    <p>{profile?.title ?? 'Investigator'}</p>
                  </div>
                </div>

                {profileStateMessage ? (
                  <p
                    className="profile-state-message"
                    role={
                      profileState === 'migration-unavailable' ||
                      profileState === 'permission-denied' ||
                      profileState === 'unexpected-failure'
                        ? 'alert'
                        : 'status'
                    }
                  >
                    {profileStateMessage}
                  </p>
                ) : null}

                <dl className="profile-file-list">
                  <div>
                    <dt>Badge</dt>
                    <dd>{profile?.badgeNumber ?? 'Preparing badge'}</dd>
                  </div>
                  <div>
                    <dt>LoreBound Online</dt>
                    <dd>{readinessLabel}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{authStatus.user?.email ?? 'Not available'}</dd>
                  </div>
                  <div>
                    <dt>Member Since</dt>
                    <dd>{formatMemberSince(profile?.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Last Sync</dt>
                    <dd>{formatSyncDateTime(lastAutomaticSyncAt ?? syncPlan.lastSynchronizedAt)}</dd>
                  </div>
                  <div>
                    <dt>Automatic Sync</dt>
                    <dd>{isAutomaticSyncEnabled ? 'On' : 'Off'}</dd>
                  </div>
                  <div>
                    <dt>Archive Status</dt>
                    <dd>{connectivity === 'offline' ? 'Offline' : archiveStatusLabel}</dd>
                  </div>
                  <div>
                    <dt>Local Archive</dt>
                    <dd>Active</dd>
                  </div>
                  <div>
                    <dt>Pending Changes</dt>
                    <dd>
                      {pendingLocalChanges > 0
                        ? `${pendingLocalChanges} awaiting review`
                        : 'No pending changes detected'}
                    </dd>
                  </div>
                </dl>

                {profile?.bio ? <p className="profile-file-bio">{profile.bio}</p> : null}
                {profileError ? <p className="auth-dialog__inline-validation">{profileError}</p> : null}
                {cloudReadiness?.detail ? <small>{cloudReadiness.detail}</small> : null}

                <label className="profile-sync-toggle">
                  <input
                    type="checkbox"
                    checked={isAutomaticSyncEnabled}
                    onChange={(event) => setAutomaticSyncEnabled(event.target.checked)}
                  />
                  <span>Automatic Synchronization</span>
                </label>

                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={() => goToView(profile ? 'connected' : 'profile-onboarding')}
                    disabled={
                      isWorking ||
                      isProfileLoading ||
                      profileState === 'migration-unavailable' ||
                      profileState === 'permission-denied' ||
                      profileState === 'unexpected-failure'
                    }
                  >
                    Open Investigator Profile
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={
                      isRetrievalAction
                        ? () => goToView('confirm-retrieve')
                        : handleSynchronizeNow
                    }
                    disabled={isWorking || isProfileLoading || (isRetrievalAction && !archiveAction.canRun)}
                  >
                    {isRetrievalAction ? archiveAction.label : 'Synchronize Now'}
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={refreshSynchronizationReview}
                    disabled={isWorking}
                  >
                    Review Synchronization
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--secondary"
                    onClick={() => goToView('edit-profile')}
                    disabled={isWorking || isProfileLoading || !profile}
                  >
                    Edit Profile
                  </button>
                  {syncPlan.canRetrieve ? (
                    <button
                      type="button"
                      className="auth-button auth-button--secondary"
                      onClick={() => goToView('confirm-retrieve')}
                      disabled={isWorking}
                    >
                      {retrieveActionLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={handleInvestigatorOffline}
                    disabled={isWorking}
                  >
                    Investigator Offline
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={closeDialog}
                    disabled={isWorking}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}

            {isSignedIn &&
            ![
              'connected',
              'profile-onboarding',
              'edit-profile',
              'review',
              'confirm-sync',
              'confirm-retrieve',
              'progress',
              'complete',
              'sync-error',
            ].includes(authView) ? (
              <div className="auth-dialog__signed-in auth-dialog__personnel-file">
                <p className="profile-state-message">Loading Investigator Profile</p>
                <div className="auth-dialog__actions">
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={() => goToView('connected')}
                  >
                    Open Investigator Profile
                  </button>
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
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

            {isSignedIn && (authView === 'profile-onboarding' || authView === 'edit-profile') ? (
              <form className="auth-dialog__form profile-edit-form" onSubmit={handleProfileSubmit}>
                <div className="auth-dialog__form-heading">
                  {authView === 'edit-profile' ? (
                    <button
                      type="button"
                      className="auth-button auth-button--quiet"
                      onClick={() => goToView('connected')}
                      disabled={isWorking || needsOnboarding}
                    >
                      Back
                    </button>
                  ) : null}
                  <h3>
                    {authView === 'profile-onboarding'
                      ? 'Prepare Investigator Profile'
                      : 'Edit Investigator Profile'}
                  </h3>
                </div>

                <div className="profile-photo-editor">
                  <div className="profile-credential__photo" aria-hidden="true">
                    {profilePhotoDataUrl ? (
                      <img src={profilePhotoDataUrl} alt="" />
                    ) : profilePhotoUrl && !removeProfilePhoto ? (
                      <img src={profilePhotoUrl} alt="" />
                    ) : (
                      <span>{profileUsername.slice(0, 2).toUpperCase() || 'LB'}</span>
                    )}
                  </div>
                  <div>
                    <label htmlFor="profile-photo">Profile Photo</label>
                    <input
                      id="profile-photo"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleProfilePhotoChange(event.currentTarget.files?.[0] ?? null)
                      }
                    />
                    {profile?.profilePhotoUrl ? (
                      <button
                        type="button"
                        className="auth-button auth-button--quiet"
                        onClick={() => {
                          setRemoveProfilePhoto(true);
                          setProfilePhotoDataUrl(null);
                        }}
                      >
                        Remove Photo
                      </button>
                    ) : null}
                  </div>
                </div>

                <label htmlFor="profile-username">Username</label>
                <input
                  id="profile-username"
                  type="text"
                  value={profileUsername}
                  autoComplete="username"
                  onChange={(event) => setProfileUsername(event.target.value)}
                  required
                />

                <label htmlFor="profile-display-name">Display Name</label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                />

                <label htmlFor="profile-title">Investigator Title</label>
                <input
                  id="profile-title"
                  type="text"
                  value={profileTitle}
                  onChange={(event) => setProfileTitle(event.target.value)}
                  required
                />

                <label htmlFor="profile-bio">Bio</label>
                <textarea
                  id="profile-bio"
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                  rows={4}
                />

                <small>Badge {profile?.badgeNumber ?? 'will be issued automatically'} cannot be changed.</small>

                {profileValidation ? (
                  <p className="auth-dialog__inline-validation">{profileValidation}</p>
                ) : null}

                <div className="auth-dialog__form-actions">
                  <button
                    type="submit"
                    className="auth-button auth-button--primary"
                    disabled={isWorking || Boolean(profileValidation)}
                  >
                    {isWorking ? 'Updating...' : 'Save Profile'}
                  </button>
                  {authView === 'edit-profile' ? (
                    <button
                      type="button"
                      className="auth-button auth-button--quiet"
                      onClick={() => goToView('connected')}
                      disabled={isWorking}
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="auth-button auth-button--quiet"
                    onClick={handleInvestigatorOffline}
                    disabled={isWorking}
                  >
                    Investigator Offline
                  </button>
                </div>
              </form>
            ) : null}

            {isSignedIn && authView === 'review' ? (
              <section className="archive-sync-review" aria-labelledby="archive-sync-title">
                <div>
                  <p>Archive Synchronization Review</p>
                  <h3 id="archive-sync-title">{archiveStatusLabel}</h3>
                </div>
                <div className="archive-sync-review__status">
                  <span>Last Secured</span>
                  <strong>{formatSyncDateTime(syncPlan.lastSynchronizedAt)}</strong>
                </div>
                {localRecordTotal === 0 ? (
                  <p>This browser origin does not currently contain archived investigations.</p>
                ) : isPartialLocalArchive ? (
                  <p>
                    LoreBound Online contains additional records for this Investigation. Repair can retrieve
                    the missing Dossiers, Bonds, Evidence Pins, and stored images without removing existing
                    local records.
                  </p>
                ) : (
                  <p>Review the records inside this browser's Local Archive.</p>
                )}
                {hasNoSynchronizationChanges ? (
                  <p>Your Local Archive and LoreBound Online contain the same Investigation records.</p>
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
                        <dt>New Local Records</dt>
                        <dd>{summaryTotals.newRecords}</dd>
                      </div>
                      <div>
                        <dt>Local Updates</dt>
                        <dd>{summaryTotals.updatedRecords}</dd>
                      </div>
                      <div>
                        <dt>Unchanged Records</dt>
                        <dd>{summaryTotals.existingRecords}</dd>
                      </div>
                      <div>
                        <dt>Cloud Updates Available</dt>
                        <dd>{summaryTotals.cloudUpdatesAvailable}</dd>
                      </div>
                      <div>
                        <dt>Conflicts</dt>
                        <dd>{summaryTotals.conflicts}</dd>
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
                {!archiveAction.canRun && archiveAction.kind !== 'close' ? (
                  <p>{syncPlan.diagnostics.archiveState.disabledReason}</p>
                ) : null}
                <div className="auth-dialog__actions">
                  {archiveAction.kind === 'close' || hasNoSynchronizationChanges ? (
                    <button type="button" className="auth-button auth-button--primary" onClick={closeDialog}>
                      Close
                    </button>
                  ) : isRetrievalAction ? (
                    <button
                      type="button"
                      className="auth-button auth-button--primary"
                      disabled={!archiveAction.canRun || isWorking}
                      onClick={() => goToView('confirm-retrieve')}
                      title={!archiveAction.canRun ? syncPlan.diagnostics.archiveState.retrievalBlockReason : undefined}
                    >
                      {archiveAction.label}
                    </button>
                  ) : archiveAction.kind === 'sync' ? (
                    <button
                      type="button"
                      className="auth-button auth-button--primary"
                      disabled={!archiveAction.canRun || isWorking}
                      onClick={() => goToView('confirm-sync')}
                      title={!archiveAction.canRun ? syncPlan.blockingReasons[0] : undefined}
                    >
                      {archiveAction.label}
                    </button>
                  ) : (
                    <button type="button" className="auth-button auth-button--primary" disabled>
                      {archiveAction.label}
                    </button>
                  )}
                  {syncPlan.canRetrieve && !isRetrievalAction ? (
                    <button
                      type="button"
                      className="auth-button auth-button--secondary"
                      disabled={isWorking}
                      onClick={() => goToView('confirm-retrieve')}
                    >
                      {retrieveActionLabel}
                    </button>
                  ) : null}
                  {hasNoSynchronizationChanges ? (
                    <button
                      type="button"
                      className="auth-button auth-button--secondary"
                      disabled={isWorking}
                      onClick={handleSynchronizeNow}
                    >
                      Synchronize Now
                    </button>
                  ) : null}
                </div>
                {import.meta.env.DEV ? (
                  <section className="auth-dialog__developer-diagnostics" aria-label="Developer reconciliation diagnostics">
                    <h4>Developer Diagnostics</h4>
                    <dl className="settings-compact-list">
                      <div>
                        <dt>Selected action</dt>
                        <dd>{archiveAction.label}</dd>
                      </div>
                      <div>
                        <dt>Action enabled</dt>
                        <dd>{archiveAction.canRun ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Disabled reason</dt>
                        <dd>{syncPlan.diagnostics.archiveState.disabledReason}</dd>
                      </div>
                      <div>
                        <dt>Handler present</dt>
                        <dd>{syncPlan.diagnostics.archiveState.handlerPresent ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Authenticated</dt>
                        <dd>{isSignedIn ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Cloud available</dt>
                        <dd>{syncPlan.online.isAvailable ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Local archive classification</dt>
                        <dd>{syncPlan.diagnostics.archiveState.classification}</dd>
                      </div>
                      <div>
                        <dt>Repair eligible</dt>
                        <dd>{syncPlan.diagnostics.archiveState.repairEligibility === 'Available' ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Synchronization running</dt>
                        <dd>{isWorking ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Conflicts</dt>
                        <dd>{reconciliationDiagnosticTotals.conflicts}</dd>
                      </div>
                      <div>
                        <dt>Review items</dt>
                        <dd>{reconciliationDiagnosticTotals.reviewItems}</dd>
                      </div>
                      <div>
                        <dt>Local-only count</dt>
                        <dd>{reconciliationDiagnosticTotals.localOnly}</dd>
                      </div>
                      <div>
                        <dt>Cloud-only count</dt>
                        <dd>{reconciliationDiagnosticTotals.cloudOnly}</dd>
                      </div>
                    </dl>
                  </section>
                ) : null}
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
                <h3>{isPartialLocalArchive ? 'Repair Local Archive?' : 'Retrieve Investigation from LoreBound Online?'}</h3>
                <p>
                  {isPartialLocalArchive
                    ? 'LoreBound Online contains additional records for this Investigation. Missing Dossiers, Bonds, Evidence Pins, and stored images will be retrieved without removing existing local records.'
                    : 'Records will be written into this empty Local Archive.'}
                </p>
                <div className="archive-sync-review__groups">
                  {isPartialLocalArchive ? (
                    <section>
                      <h4>Local Archive</h4>
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
                      </dl>
                    </section>
                  ) : null}
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
                    {retrieveActionLabel}
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
