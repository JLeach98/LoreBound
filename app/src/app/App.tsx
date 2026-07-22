import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthAccessPanel } from '../components/application-shell/AuthAccessPanel';
import { InvestigatorHome } from '../components/application-shell/InvestigatorHome';
import { InvestigatorProfileOnboardingScreen } from '../components/application-shell/InvestigatorProfileOnboardingScreen';
import { LoreBoundAccessScreen } from '../components/application-shell/LoreBoundAccessScreen';
import { BondProvider } from '../features/cases/context/BondContext';
import { BoardProvider } from '../features/cases/context/BoardContext';
import { CaseProvider, useCases } from '../features/cases/context/CaseContext';
import { DossierProvider } from '../features/cases/context/DossierContext';
import { FieldKitShell } from '../features/field-kit/components/FieldKitShell';
import { authService, type AuthStatus } from '../services/auth/AuthService';
import { OperationsConsoleProvider } from '../services/preferences/OperationsConsoleContext';
import { InvestigatorProfileProvider, useInvestigatorProfile } from '../services/profile/InvestigatorProfileContext';
import { AutomaticSyncProvider } from '../services/sync/AutomaticSyncContext';
import { useDeviceExperience } from './useDeviceExperience';

const InvestigatorOffice = lazy(() =>
  import('../components/investigator-office/InvestigatorOffice').then((module) => ({
    default: module.InvestigatorOffice,
  })),
);

function LoreBoundExperience() {
  const experience = useDeviceExperience();

  if (experience === 'field-kit') {
    return <FieldKitShell />;
  }

  return (
    <Suspense
      fallback={
        <main className="study-loading" aria-live="polite">
          <span>LoreBound</span>
          <strong>Opening the Investigator's Study...</strong>
        </main>
      }
    >
      <InvestigatorOffice />
    </Suspense>
  );
}

type AuthenticatedDestination = 'home' | 'investigation';

function BrandedResolutionState() {
  return (
    <main className="study-loading entry-resolution" aria-live="polite">
      <span>LoreBound</span>
      <strong>Verifying Investigator Access...</strong>
    </main>
  );
}

function AuthenticatedWorkspace() {
  const [destination, setDestination] = useState<AuthenticatedDestination>('home');
  const { activeCase } = useCases();

  function returnHome() {
    setDestination('home');
  }

  return (
    <>
      <AuthAccessPanel showTrigger={false} />
      {destination === 'investigation' && activeCase ? (
        <button
          type="button"
          className="app-home-control"
          onClick={returnHome}
          aria-label="Home"
        >
          ← Home
        </button>
      ) : null}
      {destination === 'home' ? (
        <InvestigatorHome onEnterInvestigation={() => setDestination('investigation')} />
      ) : (
        <LoreBoundExperience />
      )}
    </>
  );
}

function AuthenticatedApplication() {
  return (
    <CaseProvider>
      <DossierProvider>
        <BoardProvider>
          <BondProvider>
            <AuthenticatedWorkspace />
          </BondProvider>
        </BoardProvider>
      </DossierProvider>
    </CaseProvider>
  );
}

function LoreBoundEntryGate() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const { profileState, needsOnboarding, isLoading: isProfileLoading } = useInvestigatorProfile();

  useEffect(() => {
    let isMounted = true;

    void authService.getStatus().then((status) => {
      if (isMounted) {
        setAuthStatus(status);
      }
    });

    const subscription = authService.onAuthStateChanged((status) => {
      setAuthStatus(status);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authStatus) {
    return <BrandedResolutionState />;
  }

  if (authStatus.state !== 'signed-in') {
    return <LoreBoundAccessScreen onAuthResolved={setAuthStatus} />;
  }

  if (isProfileLoading || profileState === 'idle' || profileState === 'loading') {
    return <BrandedResolutionState />;
  }

  if (
    needsOnboarding ||
    profileState === 'no-profile' ||
    profileState === 'profile-creation-required' ||
    profileState === 'migration-unavailable' ||
    profileState === 'permission-denied' ||
    profileState === 'offline' ||
    profileState === 'unexpected-failure'
  ) {
    return <InvestigatorProfileOnboardingScreen onComplete={() => undefined} />;
  }

  return <AuthenticatedApplication />;
}

export function App() {
  return (
    <OperationsConsoleProvider>
      <InvestigatorProfileProvider>
        <AutomaticSyncProvider>
          <LoreBoundEntryGate />
        </AutomaticSyncProvider>
      </InvestigatorProfileProvider>
    </OperationsConsoleProvider>
  );
}
