import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { syncService } from '../../../services/sync/SyncService';
import type { SyncPlan } from '../../../services/sync/SyncTypes';
import { useBoard } from '../../cases/context/BoardContext';
import { useCases } from '../../cases/context/CaseContext';
import { useDossiers } from '../../cases/context/DossierContext';
import type { FieldKitDestination } from './FieldKitNavigation';

type FieldKitHomeProps = {
  onNavigate: (destination: FieldKitDestination) => void;
  onOpenInvestigations: () => void;
  onOpenSettings: () => void;
};

export function FieldKitHome({ onNavigate, onOpenInvestigations, onOpenSettings }: FieldKitHomeProps) {
  const { cases, activeCase } = useCases();
  const { dossiers, refreshDossiers } = useDossiers();
  const { boardPins } = useBoard();
  const recentDossiers = dossiers.slice(0, 3);
  const [repairPlan, setRepairPlan] = useState<SyncPlan | null>(null);
  const [repairState, setRepairState] = useState<'idle' | 'working' | 'failed'>('idle');
  const isPartialArchive =
    repairPlan?.diagnostics.archiveState.classification === 'Partial Local Archive' && dossiers.length === 0;

  useEffect(() => {
    let isMounted = true;

    async function reviewRepairState() {
      try {
        const planResult = await syncService.createPlan();

        if (isMounted) {
          setRepairPlan(planResult.plan);
        }
      } catch {
        if (isMounted) {
          setRepairPlan(null);
        }
      }
    }

    if (activeCase && dossiers.length === 0) {
      void reviewRepairState();
    }

    return () => {
      isMounted = false;
    };
  }, [activeCase, dossiers.length]);

  async function handleRepairLocalArchive() {
    setRepairState('working');
    const result = await syncService.retrieve();
    setRepairState(result.ok ? 'idle' : 'failed');

    if (result.ok) {
      await refreshDossiers();
    }
  }

  return (
    <section className="field-kit-home" aria-labelledby="field-kit-home-title">
      <header className="field-kit-home__masthead">
        <span>Field Kit</span>
        <h1 id="field-kit-home-title">LoreBound</h1>
        <p>Portable Archive</p>
      </header>

      <div className="field-kit-drawers">
        <button type="button" className="field-kit-drawer" onClick={onOpenInvestigations}>
          <span className="field-kit-drawer__label">Investigations</span>
          <strong>{cases.length}</strong>
          <small>{activeCase ? activeCase.caseName : 'Open Investigations'}</small>
          <i aria-hidden="true" />
        </button>
        <button type="button" className="field-kit-drawer" onClick={() => onNavigate('dossiers')}>
          <span className="field-kit-drawer__label">Recent Dossiers</span>
          <strong>{dossiers.length}</strong>
          <small>{recentDossiers[0]?.name ?? 'No Recent Dossiers'}</small>
          <i aria-hidden="true" />
        </button>
        <button type="button" className="field-kit-drawer" onClick={() => onNavigate('more')}>
          <span className="field-kit-drawer__label">LoreBound Online</span>
          <strong>Manual</strong>
          <small>Synchronize Investigation</small>
          <i aria-hidden="true" />
        </button>
        <button type="button" className="field-kit-drawer" onClick={onOpenSettings}>
          <span className="field-kit-drawer__label">Settings</span>
          <strong>Ready</strong>
          <small>Application preferences</small>
          <i aria-hidden="true" />
        </button>
      </div>

      {activeCase ? (
        <section className="field-kit-case-file" aria-label="Active Investigation">
          <div>
            <span>Active Investigation</span>
            <h2>{activeCase.caseName}</h2>
            <p>{activeCase.description || 'Field case file ready for review.'}</p>
          </div>
          <dl>
            <div>
              <dt>Dossiers</dt>
              <dd>{dossiers.length}</dd>
            </div>
            <div>
              <dt>Evidence Pins</dt>
              <dd>{boardPins.length}</dd>
            </div>
          </dl>
          <div className="field-kit-inline-actions">
            {isPartialArchive ? (
              <Button
                type="button"
                variant="brass"
                onClick={handleRepairLocalArchive}
                disabled={repairState === 'working' || !repairPlan?.canRetrieve}
              >
                {repairState === 'working' ? 'Repairing Local Archive...' : 'Repair Local Archive'}
              </Button>
            ) : (
              <Button type="button" variant="brass" onClick={() => onNavigate('dossiers')}>
                Review
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => onNavigate('board')}>
              Evidence Board
            </Button>
          </div>
          {repairState === 'failed' ? <p>Local Archive Repair could not be completed. Review Library Access.</p> : null}
        </section>
      ) : (
        <section className="field-kit-case-file" aria-label="No active Investigation">
          <div>
            <h2>No Investigation Open</h2>
            <p>Open or retrieve an Investigation to begin.</p>
          </div>
          <Button type="button" variant="brass" onClick={onOpenInvestigations}>
            Open Investigations
          </Button>
        </section>
      )}
    </section>
  );
}
