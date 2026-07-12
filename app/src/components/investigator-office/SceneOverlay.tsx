import { Button } from '../ui/Button';
import { useCases } from '../../features/cases/context/CaseContext';
import type { InvestigationSection } from '../../features/cases/types/investigationSections';

type SceneOverlayProps = {
  activeSection: InvestigationSection;
  onOpenCaseArchive: () => void;
};

export function SceneOverlay({ activeSection, onOpenCaseArchive }: SceneOverlayProps) {
  const { activeCase } = useCases();
  const isBoardSelected = activeSection === 'Board';

  if (activeCase && !isBoardSelected) {
    return (
      <section className="scene-overlay scene-overlay--compact" aria-label="Active Case">
        <p className="scene-overlay__eyebrow">Active Investigation</p>
        <h1 className="font-display">{activeCase.caseName}</h1>
        <p>{activeSection}</p>
      </section>
    );
  }

  return (
    <section className="scene-overlay" aria-labelledby="scene-empty-heading">
      <p className="scene-overlay__eyebrow">
        {activeCase ? 'Active Investigation' : 'Board'}
      </p>
      <h1 id="scene-empty-heading" className="font-display">
        {activeCase ? activeCase.caseName : 'No Active Investigation'}
      </h1>
      {activeCase ? (
        <>
          <p>
            {activeCase.universeType}
            {activeCase.authorOrCreator ? ` / ${activeCase.authorOrCreator}` : ''}
          </p>
          <p className="scene-overlay__secondary">
            No evidence has been documented yet.
          </p>
          <p className="scene-overlay__secondary">
            Begin by creating a Character, Location, Event, Organization, or Theory.
          </p>
        </>
      ) : (
        <p>Open or create a Case to begin.</p>
      )}
      <Button type="button" variant="brass" className="mt-4" onClick={onOpenCaseArchive}>
        Open Case Archive
      </Button>
    </section>
  );
}
