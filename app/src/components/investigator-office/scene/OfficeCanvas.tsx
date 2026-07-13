import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { InvestigatorOfficeScene } from './InvestigatorOfficeScene';

type OfficeCanvasProps = {
  mode: 'office' | 'investigation';
};

export function OfficeCanvas({ mode }: OfficeCanvasProps) {
  return (
    <Canvas
      className="office-canvas"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.25, 7.2], fov: 42, near: 0.1, far: 80 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <InvestigatorOfficeScene mode={mode} />
      </Suspense>
    </Canvas>
  );
}
