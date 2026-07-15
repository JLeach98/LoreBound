import { useEffect, useState } from 'react';
import type { DossierType } from '../types/dossierTypes';
import { dossierTypes } from '../types/dossierTypes';
import type { InvestigationSection } from '../types/investigationSections';
import { sectionEmptyStates } from '../types/investigationSections';
import { DossierSectionView } from './DossierSectionView';

type DossierManagerViewProps = {
  initialDossierType: DossierType;
  hasActiveCase: boolean;
  onReturnToBoard: () => void;
};

const dossierTypeSections: Record<DossierType, InvestigationSection> = {
  Character: 'Characters',
  Location: 'Locations',
  Event: 'Events',
  Organization: 'Organizations',
  Theory: 'Theories',
  Artifact: 'Artifacts',
};

const dossierTabLabels: Record<DossierType, string> = {
  Character: 'Characters',
  Location: 'Locations',
  Event: 'Events',
  Organization: 'Organizations',
  Theory: 'Theories',
  Artifact: 'Artifacts',
};

export function DossierManagerView({
  initialDossierType,
  hasActiveCase,
  onReturnToBoard,
}: DossierManagerViewProps) {
  const [activeDossierType, setActiveDossierType] = useState(initialDossierType);
  const activeSection = dossierTypeSections[activeDossierType];
  const emptyState = sectionEmptyStates[activeSection];

  useEffect(() => {
    setActiveDossierType(initialDossierType);
  }, [initialDossierType]);

  return (
    <DossierSectionView
      dossierType={activeDossierType}
      title={emptyState.heading}
      emptyMessage={emptyState.message}
      hasActiveCase={hasActiveCase}
      onReturnToBoard={onReturnToBoard}
      managerTabs={
        <div className="dossier-manager-tabs" role="tablist" aria-label="Dossier types">
          {dossierTypes.map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={activeDossierType === type}
              onClick={() => setActiveDossierType(type)}
            >
              {dossierTabLabels[type]}
            </button>
          ))}
        </div>
      }
    />
  );
}
