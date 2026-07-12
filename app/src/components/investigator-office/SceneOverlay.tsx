import { Button } from '../ui/Button';
import { useCases } from '../../features/cases/context/CaseContext';
import { useDossiers } from '../../features/cases/context/DossierContext';
import type { InvestigationSection } from '../../features/cases/types/investigationSections';

type SceneOverlayProps = {
  activeSection: InvestigationSection;
  onOpenCaseArchive: () => void;
  onSelectSection: (section: InvestigationSection) => void;
};

const dossierNavigationItems: Array<{
  section: InvestigationSection;
  label: string;
  countKey: 'Character' | 'Location' | 'Event' | 'Organization' | 'Theory';
}> = [
  { section: 'Characters', label: 'Character Dossiers', countKey: 'Character' },
  { section: 'Locations', label: 'Location Dossiers', countKey: 'Location' },
  { section: 'Events', label: 'Event Dossiers', countKey: 'Event' },
  { section: 'Organizations', label: 'Organization Dossiers', countKey: 'Organization' },
  { section: 'Theories', label: 'Theory Dossiers', countKey: 'Theory' },
];

export function SceneOverlay({
  activeSection,
  onOpenCaseArchive,
  onSelectSection,
}: SceneOverlayProps) {
  const { activeCase } = useCases();
  const { dossierCounts } = useDossiers();
  const isBoardSelected = activeSection === 'Board';

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
          <div className="scene-overlay__dossier-nav" aria-label="Dossier sections">
            {dossierNavigationItems.map((item) => {
              const count = dossierCounts[item.countKey];

              return (
                <button
                  key={item.section}
                  type="button"
                  onClick={() => onSelectSection(item.section)}
                  aria-current={activeSection === item.section ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  <strong>
                    {count} {count === 1 ? 'record' : 'records'}
                  </strong>
                </button>
              );
            })}
          </div>
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
