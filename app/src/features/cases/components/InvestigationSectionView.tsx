import { Button } from '../../../components/ui/Button';
import type { InvestigationSection } from '../types/investigationSections';
import { sectionEmptyStates } from '../types/investigationSections';
import type { DossierType } from '../types/dossierTypes';
import { DossierManagerView } from './DossierManagerView';

type InvestigationSectionViewProps = {
  section: InvestigationSection;
  hasActiveCase: boolean;
  onReturnToBoard: () => void;
  onOpenCaseArchive: () => void;
};

export function InvestigationSectionView({
  section,
  hasActiveCase,
  onReturnToBoard,
  onOpenCaseArchive,
}: InvestigationSectionViewProps) {
  const emptyState = sectionEmptyStates[section];
  const dossierSectionTypes: Partial<Record<InvestigationSection, DossierType>> = {
    Characters: 'Character',
    Locations: 'Location',
    Events: 'Event',
    Organizations: 'Organization',
    Theories: 'Theory',
    Artifacts: 'Artifact',
  };
  const dossierType = dossierSectionTypes[section];

  if (section === 'Board' || section === 'Case Settings') {
    return null;
  }

  if (dossierType) {
    return (
      <DossierManagerView
        initialDossierType={dossierType}
        hasActiveCase={hasActiveCase}
        onReturnToBoard={onReturnToBoard}
      />
    );
  }

  return (
    <section className="investigation-section" aria-labelledby="section-view-heading">
      <p className="investigation-section__eyebrow">Active Investigation</p>
      <h2 id="section-view-heading">{emptyState.heading}</h2>
      <p>{emptyState.message}</p>
      <p className="investigation-section__note">
        This section will be implemented in a later milestone.
      </p>
      <div className="investigation-section__actions">
        <Button type="button" variant="brass" onClick={onReturnToBoard}>
          Return to Board
        </Button>
        <Button type="button" variant="plaque" onClick={onOpenCaseArchive}>
          Case Archive
        </Button>
      </div>
    </section>
  );
}
