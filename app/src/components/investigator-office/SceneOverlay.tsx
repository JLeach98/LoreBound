import { Button } from '../ui/Button';
import { useCases } from '../../features/cases/context/CaseContext';

type SceneOverlayProps = {
  onOpenCaseArchive: () => void;
};

export function SceneOverlay({ onOpenCaseArchive }: SceneOverlayProps) {
  const { activeCase } = useCases();

  return (
    <section className="scene-overlay" aria-labelledby="scene-empty-heading">
      <p className="scene-overlay__eyebrow">
        {activeCase ? 'Active Investigation' : 'Board'}
      </p>
      <h1 id="scene-empty-heading" className="font-display">
        {activeCase ? activeCase.caseName : 'No Active Investigation'}
      </h1>
      {activeCase ? (
        <p>
          {activeCase.universeType}
          {activeCase.authorOrCreator ? ` / ${activeCase.authorOrCreator}` : ''}
        </p>
      ) : (
        <p>Open or create a Case to begin.</p>
      )}
      <Button type="button" variant="brass" className="mt-4" onClick={onOpenCaseArchive}>
        Open Case Archive
      </Button>
    </section>
  );
}
