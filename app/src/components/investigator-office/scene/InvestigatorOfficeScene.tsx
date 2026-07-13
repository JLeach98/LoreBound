import { ContactShadows } from '@react-three/drei';
import { CameraRig } from './CameraRig';
import { CorkBoard3D } from './CorkBoard3D';
import { DebugControls } from './DebugControls';
import { DetectiveDesk } from './DetectiveDesk';
import { OfficeFurniture } from './OfficeFurniture';
import { OfficeLighting } from './OfficeLighting';
import { OfficeRoom } from './OfficeRoom';
import { useOfficeMaterials } from './materials';

type InvestigatorOfficeSceneProps = {
  mode: 'office' | 'investigation';
};

export function InvestigatorOfficeScene({ mode }: InvestigatorOfficeSceneProps) {
  const materials = useOfficeMaterials();

  return (
    <>
      <CameraRig mode={mode} />
      <OfficeLighting />
      <OfficeRoom materials={materials} />
      <CorkBoard3D materials={materials} />
      <OfficeFurniture materials={materials} />
      <DetectiveDesk materials={materials} />
      <ContactShadows
        position={[0, 0.025, 0.6]}
        opacity={0.35}
        scale={8}
        blur={2.5}
        far={5}
        color="#171514"
      />
      <DebugControls />
    </>
  );
}
