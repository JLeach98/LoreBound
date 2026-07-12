import { Button } from '../../../components/ui/Button';
import type { InvestigationSection } from '../types/investigationSections';
import { sectionEmptyStates } from '../types/investigationSections';
import { DossierSectionView } from './DossierSectionView';

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

  if (section === 'Board' || section === 'Case Settings') {
    return null;
  }

  if (section === 'Characters') {
    return (
      <DossierSectionView
        dossierType="Character"
        title={emptyState.heading}
        emptyMessage={emptyState.message}
        hasActiveCase={hasActiveCase}
        onReturnToBoard={onReturnToBoard}
      />
    );
  }

  if (section === 'Locations') {
    return (
      <DossierSectionView
        dossierType="Location"
        title={emptyState.heading}
        emptyMessage={emptyState.message}
        hasActiveCase={hasActiveCase}
        onReturnToBoard={onReturnToBoard}
      />
    );
  }

  if (section === 'Events') {
    return (
      <DossierSectionView
        dossierType="Event"
        title={emptyState.heading}
        emptyMessage={emptyState.message}
        hasActiveCase={hasActiveCase}
        onReturnToBoard={onReturnToBoard}
      />
    );
  }

  if (section === 'Organizations') {
    return (
      <DossierSectionView
        dossierType="Organization"
        title={emptyState.heading}
        emptyMessage={emptyState.message}
        hasActiveCase={hasActiveCase}
        onReturnToBoard={onReturnToBoard}
      />
    );
  }

  if (section === 'Theories') {
    return (
      <DossierSectionView
        dossierType="Theory"
        title={emptyState.heading}
        emptyMessage={emptyState.message}
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
