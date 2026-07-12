import { useState } from 'react';
import { BrandMark } from './BrandMark';
import { CompactNavigation } from './CompactNavigation';
import { OfficeControls } from './OfficeControls';
import { OfficeCanvas } from './scene/OfficeCanvas';
import { SceneOverlay } from './SceneOverlay';
import { CaseArchiveView } from '../../features/cases/components/CaseArchiveView';

export function InvestigatorOffice() {
  const [isCaseArchiveOpen, setIsCaseArchiveOpen] = useState(false);

  return (
    <div className="office-shell">
      <OfficeCanvas />
      <CompactNavigation onOpenCaseArchive={() => setIsCaseArchiveOpen(true)} />
      <BrandMark />
      <OfficeControls />
      <SceneOverlay onOpenCaseArchive={() => setIsCaseArchiveOpen(true)} />
      {isCaseArchiveOpen ? (
        <CaseArchiveView onClose={() => setIsCaseArchiveOpen(false)} />
      ) : null}
    </div>
  );
}
