import { useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { AuthAccessPanel } from '../../../components/application-shell/AuthAccessPanel';
import { LibraryStatusBadge } from '../../../components/application-shell/LibraryStatusBadge';
import { useBoard } from '../../cases/context/BoardContext';
import { useBonds } from '../../cases/context/BondContext';
import { useCases } from '../../cases/context/CaseContext';
import { useDossiers } from '../../cases/context/DossierContext';

type FieldKitMoreProps = {
  onOpenSettings: () => void;
};

type MorePanel = 'menu' | 'online' | 'details' | 'timeline';

export function FieldKitMore({ onOpenSettings }: FieldKitMoreProps) {
  const { activeCase } = useCases();
  const { dossiers } = useDossiers();
  const { bonds } = useBonds();
  const { boardPins } = useBoard();
  const [activePanel, setActivePanel] = useState<MorePanel>('menu');

  if (activePanel === 'online') {
    return (
      <FieldKitMorePanel title="LoreBound Online" eyebrow="Manual Sync" onBack={() => setActivePanel('menu')}>
        <section className="field-kit-file-section">
          <h3>LoreBound Online</h3>
          <p>Manual synchronization and Investigator Profile controls.</p>
          <div className="field-kit-online-host">
            <LibraryStatusBadge />
            <AuthAccessPanel />
          </div>
          <div className="field-kit-inline-actions">
            <Button
              type="button"
              variant="brass"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('lorebound:open-library-access', { detail: { view: 'overview' } }),
                )
              }
            >
              Library Access
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('lorebound:open-library-access', { detail: { view: 'review' } }),
                )
              }
            >
              Archive Synchronization Review
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('lorebound:open-library-access', { detail: { view: 'sign-out' } }),
                )
              }
            >
              Investigator Offline
            </Button>
          </div>
        </section>
      </FieldKitMorePanel>
    );
  }

  if (activePanel === 'details') {
    return (
      <FieldKitMorePanel title="Investigation Details" eyebrow="Case File" onBack={() => setActivePanel('menu')}>
        <section className="field-kit-file-section">
          <h3>{activeCase?.caseName ?? 'No Investigation Open'}</h3>
          <dl className="settings-compact-list">
            <div>
              <dt>Universe Type</dt>
              <dd>{activeCase?.universeType ?? 'Not available'}</dd>
            </div>
            <div>
              <dt>Author or Creator</dt>
              <dd>{activeCase?.authorOrCreator || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Dossiers</dt>
              <dd>{dossiers.length}</dd>
            </div>
            <div>
              <dt>Bonds</dt>
              <dd>{bonds.length}</dd>
            </div>
            <div>
              <dt>Evidence Pins</dt>
              <dd>{boardPins.length}</dd>
            </div>
          </dl>
          {activeCase?.description ? <p>{activeCase.description}</p> : null}
        </section>
      </FieldKitMorePanel>
    );
  }

  if (activePanel === 'timeline') {
    return (
      <FieldKitMorePanel title="Timeline" eyebrow="Future Lens" onBack={() => setActivePanel('menu')}>
        <section className="field-kit-file-section">
          <h3>Timeline</h3>
          <p>Coming in a future LoreBound update.</p>
        </section>
      </FieldKitMorePanel>
    );
  }

  return (
    <section className="field-kit-panel" aria-labelledby="field-kit-more-title">
      <header className="field-kit-panel__header">
        <div>
          <span>Field Controls</span>
          <h2 id="field-kit-more-title">More</h2>
        </div>
      </header>

      <div className="field-kit-more-list">
        <MoreRow
          title="LoreBound Online"
          description="Manual synchronization and Investigator Profile"
          status="Manual"
          onClick={() => setActivePanel('online')}
        />
        <MoreRow
          title="Investigation Details"
          description="Review active Investigation information"
          status={activeCase ? 'Open' : 'None'}
          onClick={() => setActivePanel('details')}
        />
        <MoreRow
          title="Timeline"
          description="Coming in a future LoreBound update"
          status="Future"
          onClick={() => setActivePanel('timeline')}
        />
        <MoreRow
          title="Settings"
          description="Application preferences"
          onClick={onOpenSettings}
        />
      </div>
    </section>
  );
}

function FieldKitMorePanel({
  title,
  eyebrow,
  children,
  onBack,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onBack: () => void;
}) {
  return (
    <section className="field-kit-panel" aria-labelledby="field-kit-more-panel-title">
      <header className="field-kit-panel__header">
        <button type="button" onClick={onBack} aria-label="Back to More">
          Back
        </button>
        <div>
          <span>{eyebrow}</span>
          <h2 id="field-kit-more-panel-title">{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

function MoreRow({
  title,
  description,
  status,
  onClick,
}: {
  title: string;
  description: string;
  status?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="field-kit-more-row" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>
        {status ? <b>{status}</b> : null}
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </em>
    </button>
  );
}
