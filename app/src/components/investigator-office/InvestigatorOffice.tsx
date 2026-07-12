import { useEffect, useState } from 'react';
import { BrandMark } from './BrandMark';
import { CompactNavigation } from './CompactNavigation';
import { OfficeControls } from './OfficeControls';
import { OfficeCanvas } from './scene/OfficeCanvas';
import { SceneOverlay } from './SceneOverlay';
import { CaseArchiveView } from '../../features/cases/components/CaseArchiveView';
import { ActiveCaseFile } from '../../features/cases/components/ActiveCaseFile';
import { CaseSettingsView } from '../../features/cases/components/CaseSettingsView';
import { InvestigationSectionView } from '../../features/cases/components/InvestigationSectionView';
import { useCases } from '../../features/cases/context/CaseContext';
import type { InvestigationSection } from '../../features/cases/types/investigationSections';

export function InvestigatorOffice() {
  const [isCaseArchiveOpen, setIsCaseArchiveOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<InvestigationSection>('Board');
  const { activeCase } = useCases();

  useEffect(() => {
    if (!activeCase && activeSection !== 'Board') {
      setActiveSection('Board');
    }
  }, [activeCase, activeSection]);

  function openCaseArchive() {
    setIsCaseArchiveOpen(true);
  }

  function closeCaseArchive() {
    setIsCaseArchiveOpen(false);
  }

  function handleCaseOpened() {
    setActiveSection('Board');
    closeCaseArchive();
  }

  return (
    <div className="office-shell">
      <OfficeCanvas />
      <CompactNavigation
        activeSection={activeSection}
        hasActiveCase={Boolean(activeCase)}
        onOpenCaseArchive={openCaseArchive}
        onSelectSection={setActiveSection}
      />
      <BrandMark />
      <OfficeControls />
      <SceneOverlay
        activeSection={activeSection}
        onOpenCaseArchive={openCaseArchive}
        onSelectSection={setActiveSection}
      />
      {activeCase ? <ActiveCaseFile activeCase={activeCase} /> : null}
      {activeCase ? (
        <>
          <InvestigationSectionView
            section={activeSection}
            hasActiveCase={Boolean(activeCase)}
            onReturnToBoard={() => setActiveSection('Board')}
            onOpenCaseArchive={openCaseArchive}
          />
          {activeSection === 'Case Settings' ? (
            <CaseSettingsView
              activeCase={activeCase}
              onReturnToBoard={() => setActiveSection('Board')}
              onOpenCaseArchive={openCaseArchive}
            />
          ) : null}
        </>
      ) : null}
      {isCaseArchiveOpen ? (
        <CaseArchiveView onClose={closeCaseArchive} onCaseOpened={handleCaseOpened} />
      ) : null}
    </div>
  );
}
