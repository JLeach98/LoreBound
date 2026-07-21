import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { LoreBoundSettings } from '../../../components/application-shell/LoreBoundSettings';
import { Button } from '../../../components/ui/Button';
import { useCases } from '../../cases/context/CaseContext';
import type { Dossier, DossierType } from '../../cases/types/dossierTypes';
import { FieldKitBoard } from './FieldKitBoard';
import { FieldKitDossiers, recordFieldKitRuntimeFailure } from './FieldKitDossiers';
import { FieldKitHeader } from './FieldKitHeader';
import { FieldKitHome } from './FieldKitHome';
import { FieldKitInvestigations } from './FieldKitInvestigations';
import { FieldKitMore } from './FieldKitMore';
import { FieldKitNavigation, type FieldKitDestination } from './FieldKitNavigation';
import { FieldKitQuickAdd } from './FieldKitQuickAdd';

type FieldKitRouteBoundaryProps = {
  children: ReactNode;
  hasSelectedDossier: boolean;
  onReturnToFieldKit: () => void;
  onReturnToDossierList: () => void;
};

type FieldKitRouteBoundaryState = {
  error: Error | null;
};

class FieldKitRouteBoundary extends Component<FieldKitRouteBoundaryProps, FieldKitRouteBoundaryState> {
  state: FieldKitRouteBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordFieldKitRuntimeFailure(error, 'FieldKitRouteBoundary');
    const existingDiagnostics = (() => {
      try {
        return JSON.parse(window.localStorage.getItem('lorebound:field-kit-dossier-diagnostics') ?? '{}') as Record<
          string,
          unknown
        >;
      } catch {
        return {};
      }
    })();

    window.localStorage.setItem(
      'lorebound:field-kit-dossier-diagnostics',
      JSON.stringify({
        ...existingDiagnostics,
        routeLevelErrorBoundaryTriggered: true,
        sanitizedComponentName: 'FieldKitRouteBoundary',
        safeComponentTrace: info.componentStack?.split('\n').slice(0, 4).join(' / '),
      }),
    );
  }

  retry = () => {
    this.setState({ error: null });
  };

  returnToFieldKit = () => {
    this.setState({ error: null });
    this.props.onReturnToFieldKit();
  };

  returnToDossierList = () => {
    this.setState({ error: null });
    this.props.onReturnToDossierList();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="field-kit-panel field-kit-dossier-error" aria-labelledby="field-kit-route-error-title">
        <h2 id="field-kit-route-error-title">Unable to Open Dossiers</h2>
        <p>LoreBound could not display the Dossier archive.</p>
        <p>Your Local Archive remains unchanged.</p>
        <div className="field-kit-dossier-actions">
          <Button type="button" variant="brass" onClick={this.retry}>
            Retry
          </Button>
          <Button type="button" variant="secondary" onClick={this.returnToFieldKit}>
            Return to Field Kit
          </Button>
          {this.props.hasSelectedDossier ? (
            <Button type="button" variant="secondary" onClick={this.returnToDossierList}>
              Return to Dossier List
            </Button>
          ) : null}
        </div>
      </section>
    );
  }
}

export function FieldKitShell() {
  const { activeCase } = useCases();
  const [activeDestination, setActiveDestination] = useState<FieldKitDestination>('home');
  const [isInvestigationDrawerOpen, setIsInvestigationDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<DossierType | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [boardDossier, setBoardDossier] = useState<Dossier | null>(null);

  return (
    <main className="field-kit" aria-label="LoreBound Field Kit">
      <FieldKitHeader
        activeCase={activeCase}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickAdd={() => setIsQuickAddOpen(true)}
      />

      <div className="field-kit-main">
        {activeDestination === 'home' ? (
          <FieldKitHome
            onNavigate={setActiveDestination}
            onOpenInvestigations={() => setIsInvestigationDrawerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : null}
        {activeDestination === 'dossiers' ? (
          <FieldKitRouteBoundary
            key={`dossiers-${boardDossier?.id ?? 'list'}`}
            hasSelectedDossier={Boolean(boardDossier)}
            onReturnToFieldKit={() => {
              setBoardDossier(null);
              setActiveDestination('home');
            }}
            onReturnToDossierList={() => {
              setBoardDossier(null);
              setActiveDestination('dossiers');
            }}
          >
            <FieldKitDossiers
              initialCreateType={quickAddType}
              onInitialCreateConsumed={() => setQuickAddType(null)}
              onReturnToFieldKit={() => {
                setBoardDossier(null);
                setActiveDestination('home');
              }}
            />
          </FieldKitRouteBoundary>
        ) : null}
        {activeDestination === 'board' ? (
          boardDossier ? (
            <FieldKitRouteBoundary
              key={`board-dossier-${boardDossier.id}`}
              hasSelectedDossier
              onReturnToFieldKit={() => {
                setBoardDossier(null);
                setActiveDestination('home');
              }}
              onReturnToDossierList={() => {
                setBoardDossier(null);
                setActiveDestination('dossiers');
              }}
            >
              <FieldKitDossiers
                initialType={boardDossier.dossierType}
                initialDossierId={boardDossier.id}
                initialCreateType={quickAddType}
                onInitialCreateConsumed={() => setQuickAddType(null)}
                onReturnToFieldKit={() => {
                  setBoardDossier(null);
                  setActiveDestination('home');
                }}
              />
            </FieldKitRouteBoundary>
          ) : (
            <FieldKitBoard
              onBrowseDossiers={() => setActiveDestination('dossiers')}
              onOpenDossier={(dossier) => {
                setBoardDossier(dossier);
                setActiveDestination('dossiers');
              }}
            />
          )
        ) : null}
        {activeDestination === 'more' ? (
          <FieldKitMore onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : null}
      </div>

      <FieldKitNavigation
        activeDestination={activeDestination}
        onNavigate={(destination) => {
          setBoardDossier(null);
          setActiveDestination(destination);
        }}
      />

      {isInvestigationDrawerOpen ? (
        <FieldKitInvestigations
          onClose={() => setIsInvestigationDrawerOpen(false)}
          onOpened={() => {
            setIsInvestigationDrawerOpen(false);
            setActiveDestination('home');
          }}
        />
      ) : null}

      {isQuickAddOpen ? (
        <FieldKitQuickAdd
          onClose={() => setIsQuickAddOpen(false)}
          onChoose={(type) => {
            setQuickAddType(type);
            setIsQuickAddOpen(false);
            setBoardDossier(null);
            setActiveDestination('dossiers');
          }}
        />
      ) : null}

      {isSettingsOpen ? <LoreBoundSettings onClose={() => setIsSettingsOpen(false)} /> : null}
    </main>
  );
}
