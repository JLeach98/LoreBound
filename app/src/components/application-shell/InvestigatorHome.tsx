import { useMemo, useRef, useState } from 'react';
import { CaseArchiveView } from '../../features/cases/components/CaseArchiveView';
import { useCases } from '../../features/cases/context/CaseContext';
import { formatCaseDate } from '../../features/cases/utils/caseSorting';
import { authService } from '../../services/auth/AuthService';
import { useInvestigatorProfile } from '../../services/profile/InvestigatorProfileContext';

type InvestigatorHomeProps = {
  onEnterInvestigation: () => void;
};

type ArchiveMode = 'select' | 'create';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function InvestigatorHome({ onEnterInvestigation }: InvestigatorHomeProps) {
  const { profile } = useInvestigatorProfile();
  const { cases, cloudCases, activeCase, isLoading, openExistingCase } = useCases();
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>('select');
  const [isEnteringStudy, setIsEnteringStudy] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const selectButtonRef = useRef<HTMLButtonElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const displayName = profile?.displayName?.trim() || profile?.username?.trim() || 'Investigator';
  const title = profile?.title?.trim() || 'Investigator';
  const badgeNumber = profile?.badgeNumber?.trim() || null;
  const totalCases = cases.length + cloudCases.length;
  const continueCase = useMemo(() => activeCase ?? cases[0] ?? null, [activeCase, cases]);
  const hasAnyCases = totalCases > 0;
  const hasContinueTarget = Boolean(continueCase);
  const caseCountLabel = isLoading
    ? 'Reviewing Archive'
    : `${totalCases} Investigation${totalCases === 1 ? '' : 's'} Available`;
  const continueContext = continueCase
    ? `${continueCase.caseName}${continueCase.dateLastOpened ? ` · Last opened ${formatCaseDate(continueCase.dateLastOpened)}` : ''}`
    : 'No active Case selected';

  function closeArchive(restoreFocus = true) {
    setIsArchiveOpen(false);

    if (!restoreFocus || isEnteringStudy) {
      return;
    }

    window.setTimeout(() => {
      if (archiveMode === 'create') {
        createButtonRef.current?.focus();
        return;
      }

      selectButtonRef.current?.focus();
    }, 0);
  }

  function beginStudyEntry() {
    closeArchive(false);

    if (prefersReducedMotion()) {
      onEnterInvestigation();
      return;
    }

    setIsEnteringStudy(true);
    window.setTimeout(() => {
      onEnterInvestigation();
    }, 620);
  }

  async function handleContinueInvestigation() {
    if (!continueCase || isEnteringStudy) {
      return;
    }

    try {
      setHomeError(null);
      await openExistingCase(continueCase.id);
      beginStudyEntry();
    } catch (error) {
      console.error(error);
      setIsEnteringStudy(false);
      setHomeError('The Case could not be opened. Select another Case or try again.');
    }
  }

  function openArchive(mode: ArchiveMode) {
    setArchiveMode(mode);
    setHomeError(null);
    setIsArchiveOpen(true);
  }

  function handleCaseOpened() {
    beginStudyEntry();
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    await authService.signOut();
  }

  return (
    <main className={`entry-screen investigator-home ${isEnteringStudy ? 'investigator-home--entering' : ''}`}>
      <section className="investigator-home__scene" aria-labelledby="investigator-home-title">
        <div className="investigator-home__lintel" aria-hidden="true" />
        <div className="investigator-home__door-frame">
          <div className="investigator-home__door" aria-hidden="true">
            <div className="investigator-home__door-window">
              <div className="investigator-home__nameplate">
                <span>{title}</span>
                <strong>{displayName}</strong>
                {badgeNumber ? <small>Badge {badgeNumber}</small> : null}
              </div>
            </div>
            <div className="investigator-home__door-rail" />
            <div className="investigator-home__handle" />
          </div>
        </div>

        <div className="investigator-home__content">
          <p className="entry-panel__eyebrow">Private Study</p>
          <h1 id="investigator-home-title">LoreBound</h1>
          <p className="investigator-home__lede">Investigate Every Story.</p>

          <div className="investigator-home__case-note" aria-live="polite">
            <span>Case Archive</span>
            <strong>{caseCountLabel}</strong>
            {hasContinueTarget ? <p>{continueContext}</p> : null}
          </div>

          {homeError ? (
            <p className="investigator-home__error" role="alert">
              {homeError}
            </p>
          ) : null}

          <div className="investigator-home__actions" aria-label="Investigation actions">
            {hasContinueTarget ? (
              <button
                type="button"
                className="auth-button auth-button--primary investigator-home__primary-action"
                onClick={handleContinueInvestigation}
                disabled={isEnteringStudy || isLoading}
              >
                <span>Continue Investigation</span>
                <small>{continueCase?.caseName}</small>
              </button>
            ) : null}
            {hasAnyCases ? (
              <>
                <button
                  ref={selectButtonRef}
                  type="button"
                  className="auth-button auth-button--secondary"
                  onClick={() => openArchive('select')}
                  disabled={isEnteringStudy}
                >
                  Select a Case
                </button>
                <button
                  ref={createButtonRef}
                  type="button"
                  className="auth-button auth-button--quiet investigator-home__quiet-action"
                  onClick={() => openArchive('create')}
                  disabled={isEnteringStudy}
                >
                  Create a Case
                </button>
              </>
            ) : (
              <button
                ref={createButtonRef}
                type="button"
                className="auth-button auth-button--primary investigator-home__primary-action"
                onClick={() => openArchive('create')}
                disabled={isEnteringStudy || isLoading}
              >
                <span>Create Your First Case</span>
                <small>Every fictional universe begins as a Case.</small>
              </button>
            )}
          </div>

          <button
            type="button"
            className="investigator-home__sign-out"
            onClick={handleSignOut}
            disabled={isSigningOut || isEnteringStudy}
          >
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </section>

      <div className="investigator-home__entry-transition" aria-hidden="true" />

      {isArchiveOpen ? (
        <CaseArchiveView
          onClose={closeArchive}
          onCaseOpened={handleCaseOpened}
          closeLabel="Return Home"
          openCreatedCase
          startWithCreateDialog={archiveMode === 'create'}
        />
      ) : null}
    </main>
  );
}
