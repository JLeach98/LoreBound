import { BrandMark } from './BrandMark';
import { CompactNavigation } from './CompactNavigation';
import { OfficeControls } from './OfficeControls';
import { OfficeCanvas } from './scene/OfficeCanvas';
import { SceneOverlay } from './SceneOverlay';

export function InvestigatorOffice() {
  return (
    <div className="office-shell">
      <OfficeCanvas />
      <CompactNavigation />
      <BrandMark />
      <OfficeControls />
      <SceneOverlay />
    </div>
  );
}
