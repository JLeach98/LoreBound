import { useMemo, useRef, useState } from 'react';
import { CaseArchiveView } from '../../features/cases/components/CaseArchiveView';
import { useCases } from '../../features/cases/context/CaseContext';
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
  const { profile, profilePhotoUrl } = useInvestigatorProfile();
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

  function openInvestigatorProfile() {
    window.dispatchEvent(
      new CustomEvent('lorebound:open-library-access', { detail: { view: 'profile' } }),
    );
  }

  return (
    <main className={`entry-screen investigator-home ${isEnteringStudy ? 'investigator-home--entering' : ''}`}>
      <section className="investigator-home__scene" aria-labelledby="investigator-home-title">
        <h1 id="investigator-home-title" className="investigator-home__brand">
          LoreBound
        </h1>
        <div className="investigator-home__lintel" aria-hidden="true" />
        <div className="investigator-home__side-window investigator-home__side-window--left" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="investigator-home__plant" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="investigator-home__door-frame">
          <div className="investigator-home__door">
            <div className="investigator-home__door-window">
              <button
                type="button"
                className="investigator-home__nameplate"
                onClick={openInvestigatorProfile}
                disabled={isEnteringStudy}
                aria-label="Open Investigator Profile"
              >
                <span className="investigator-home__nameplate-photo" aria-hidden="true">
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="" />
                  ) : (
                    displayName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? '')
                      .join('') || 'LB'
                  )}
                </span>
                <span className="investigator-home__nameplate-text">
                  <strong>{displayName}</strong>
                  <em>{title}</em>
                  {badgeNumber ? <small>{badgeNumber}</small> : null}
                </span>
              </button>
            </div>
            <div className="investigator-home__door-rail">
              <div className="investigator-home__content">
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
                        Select Case
                      </button>
                      <button
                        ref={createButtonRef}
                        type="button"
                        className="auth-button auth-button--quiet investigator-home__quiet-action"
                        onClick={() => openArchive('create')}
                        disabled={isEnteringStudy}
                      >
                        Create Case
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
                      <span>Create Case</span>
                      <small>Every fictional universe begins as a Case.</small>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="investigator-home__handle" />
          </div>
        </div>
        <div className="investigator-home__side-window investigator-home__side-window--right" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <button
          type="button"
          className="investigator-home__sign-out"
          onClick={handleSignOut}
          disabled={isSigningOut || isEnteringStudy}
        >
          {isSigningOut ? 'Signing Off...' : 'Sign Off'}
        </button>
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
