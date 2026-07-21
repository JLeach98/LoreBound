import { useState } from 'react';
import { CaseArchiveView } from '../../features/cases/components/CaseArchiveView';
import { useCases } from '../../features/cases/context/CaseContext';
import { authService } from '../../services/auth/AuthService';
import { useInvestigatorProfile } from '../../services/profile/InvestigatorProfileContext';

type InvestigatorHomeProps = {
  onEnterInvestigation: () => void;
};

export function InvestigatorHome({ onEnterInvestigation }: InvestigatorHomeProps) {
  const { profile } = useInvestigatorProfile();
  const { cases, cloudCases, activeCase, isLoading } = useCases();
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const displayName = profile?.displayName || profile?.username || 'Investigator';
  const title = profile?.title || 'Investigator';
  const totalCases = cases.length + cloudCases.length;

  function closeArchive() {
    setIsArchiveOpen(false);
  }

  function handleCaseOpened() {
    closeArchive();
    onEnterInvestigation();
  }

  async function handleSignOut() {
    await authService.signOut();
  }

  return (
    <main className="entry-screen entry-screen--home">
      <section className="entry-panel entry-panel--home" aria-labelledby="investigator-home-title">
        <p className="entry-panel__eyebrow">Investigator Home</p>
        <h1 id="investigator-home-title">Welcome, {displayName}</h1>
        <p>{title}</p>

        <div className="investigator-home__summary" aria-live="polite">
          <span>Case Archive</span>
          <strong>{isLoading ? 'Reviewing Archive' : `${totalCases} Investigation${totalCases === 1 ? '' : 's'}`}</strong>
        </div>

        <div className="investigator-home__actions">
          {activeCase ? (
            <button type="button" className="auth-button auth-button--primary" onClick={onEnterInvestigation}>
              Continue Investigation
            </button>
          ) : null}
          <button type="button" className="auth-button auth-button--secondary" onClick={() => setIsArchiveOpen(true)}>
            {totalCases > 0 ? 'Select a Case' : 'Create Your First Case'}
          </button>
          {totalCases > 0 ? (
            <button type="button" className="auth-button auth-button--quiet" onClick={() => setIsArchiveOpen(true)}>
              Create a Case
            </button>
          ) : null}
          <button type="button" className="auth-button auth-button--quiet" onClick={handleSignOut}>
            Investigator Offline
          </button>
        </div>
      </section>

      {isArchiveOpen ? (
        <CaseArchiveView
          onClose={closeArchive}
          onCaseOpened={handleCaseOpened}
          closeLabel="Return Home"
          openCreatedCase
        />
      ) : null}
    </main>
  );
}
