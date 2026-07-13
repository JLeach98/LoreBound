import { useEffect, useState } from 'react';
import { BrandMark } from './BrandMark';
import { CompactNavigation } from './CompactNavigation';
import { OfficeControls } from './OfficeControls';
import { OfficeCanvas } from './scene/OfficeCanvas';
import { SceneOverlay } from './SceneOverlay';
import { CaseArchiveView } from '../../features/cases/components/CaseArchiveView';
import { ActiveCaseFile } from '../../features/cases/components/ActiveCaseFile';
import { BoardEvidenceLayer } from '../../features/cases/components/BoardEvidenceLayer';
import { CaseSettingsView } from '../../features/cases/components/CaseSettingsView';
import { InvestigationSectionView } from '../../features/cases/components/InvestigationSectionView';
import { useCases } from '../../features/cases/context/CaseContext';
import type { InvestigationSection } from '../../features/cases/types/investigationSections';

export function InvestigatorOffice() {
  const [isCaseArchiveOpen, setIsCaseArchiveOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<InvestigationSection>('Board');
  const [workspaceMode, setWorkspaceMode] = useState<'office' | 'investigation'>('office');
  const { activeCase } = useCases();

  useEffect(() => {
    if (!activeCase && activeSection !== 'Board') {
      setActiveSection('Board');
    }

    if (!activeCase && workspaceMode !== 'office') {
      setWorkspaceMode('office');
    }
  }, [activeCase, activeSection, workspaceMode]);

  function openCaseArchive() {
    setIsCaseArchiveOpen(true);
  }

  function closeCaseArchive() {
    setIsCaseArchiveOpen(false);
  }

  function handleCaseOpened() {
    setActiveSection('Board');
    setWorkspaceMode('office');
    closeCaseArchive();
  }

  function enterInvestigationMode() {
    setActiveSection('Board');
    setWorkspaceMode('investigation');
  }

  return (
    <div className={`office-shell office-shell--${workspaceMode}`}>
      <OfficeCanvas mode={workspaceMode} />
      {workspaceMode === 'office' ? (
        <CompactNavigation
          activeSection={activeSection}
        hasActiveCase={Boolean(activeCase)}
        onOpenCaseArchive={openCaseArchive}
        onSelectSection={setActiveSection}
        onFocusBoard={enterInvestigationMode}
      />
      ) : null}
      <BrandMark />
      {workspaceMode === 'office' ? <OfficeControls /> : null}
      <SceneOverlay
        activeSection={activeSection}
        onOpenCaseArchive={openCaseArchive}
        onSelectSection={setActiveSection}
        workspaceMode={workspaceMode}
        onEnterInvestigationMode={enterInvestigationMode}
      />
      {activeCase && workspaceMode === 'investigation' ? (
        <BoardEvidenceLayer
          activeCase={activeCase}
          onReturnToOffice={() => setWorkspaceMode('office')}
        />
      ) : null}
      {activeCase && workspaceMode === 'office' ? (
        <ActiveCaseFile activeCase={activeCase} />
      ) : null}
      {activeCase && workspaceMode === 'office' ? (
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
