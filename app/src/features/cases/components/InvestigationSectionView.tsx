import { Button } from '../../../components/ui/Button';
import type { InvestigationSection } from '../types/investigationSections';
import { sectionEmptyStates } from '../types/investigationSections';

type InvestigationSectionViewProps = {
  section: InvestigationSection;
  onReturnToBoard: () => void;
  onOpenCaseArchive: () => void;
};

export function InvestigationSectionView({
  section,
  onReturnToBoard,
  onOpenCaseArchive,
}: InvestigationSectionViewProps) {
  const emptyState = sectionEmptyStates[section];

  if (section === 'Board' || section === 'Case Settings') {
    return null;
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
