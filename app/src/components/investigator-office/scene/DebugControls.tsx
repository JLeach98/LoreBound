import { OrbitControls } from '@react-three/drei';

export const ENABLE_SCENE_DEBUG = false;

export function DebugControls() {
  if (!ENABLE_SCENE_DEBUG) {
    return null;
  }

  return (
    <>
      <OrbitControls makeDefault target={[0, 1.7, 0]} />
      <gridHelper args={[12, 12, '#b88a3d', '#5c3a26']} />
      <axesHelper args={[2]} />
    </>
  );
}
