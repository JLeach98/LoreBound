import { Button } from '../ui/Button';
import { useCases } from '../../features/cases/context/CaseContext';
import type { InvestigationSection } from '../../features/cases/types/investigationSections';

type SceneOverlayProps = {
  activeSection: InvestigationSection;
  onOpenCaseArchive: () => void;
  onSelectSection: (section: InvestigationSection) => void;
  workspaceMode: 'office' | 'investigation';
  onEnterInvestigationMode: () => void;
};

export function SceneOverlay({
  activeSection,
  onOpenCaseArchive,
  onSelectSection,
  workspaceMode,
  onEnterInvestigationMode,
}: SceneOverlayProps) {
  const { activeCase } = useCases();
  const isBoardSelected = activeSection === 'Board';

  if (workspaceMode === 'investigation') {
    return null;
  }

  if (activeCase && !isBoardSelected) {
    return (
      <section className="scene-overlay scene-overlay--compact" aria-label="Active Case">
        <h1 className="font-display">{activeCase.caseName}</h1>
        <p>{activeSection}</p>
      </section>
    );
  }

  return (
    <section className="scene-overlay" aria-labelledby="scene-empty-heading">
      {!activeCase ? <p className="scene-overlay__eyebrow">Board</p> : null}
      <h1 id="scene-empty-heading" className="font-display">
        {activeCase ? activeCase.caseName : 'No Active Investigation'}
      </h1>
      {activeCase ? (
        <>
          <p>
            {activeCase.universeType}
            {activeCase.authorOrCreator ? ` / ${activeCase.authorOrCreator}` : ''}
          </p>
          <div className="scene-overlay__actions">
            <Button type="button" variant="brass" onClick={onEnterInvestigationMode}>
              Focus on Board
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelectSection('Characters')}
            >
              Manage Dossiers
            </Button>
          </div>
        </>
      ) : (
        <p>Open or create a Case to begin.</p>
      )}
      <Button
        type="button"
        variant={activeCase ? 'ghost' : 'brass'}
        className="mt-4"
        onClick={onOpenCaseArchive}
      >
        Open Case Archive
      </Button>
    </section>
  );
}
