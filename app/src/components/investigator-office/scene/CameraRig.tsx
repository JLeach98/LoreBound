import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';

type CameraMode = 'office' | 'investigation';

type CameraRigProps = {
  mode: CameraMode;
};

const officeCameraPosition = new Vector3(0, 2.25, 7.2);
const officeCameraTarget = new Vector3(0, 1.75, 0);
const investigationCameraPosition = new Vector3(0, 2.05, 3.05);
const investigationCameraTarget = new Vector3(0, 2.16, -1.45);

export function CameraRig({ mode }: CameraRigProps) {
  const { camera, size } = useThree();
  const currentTarget = useRef(officeCameraTarget.clone());
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);

    if ('fov' in camera) {
      camera.fov = mode === 'investigation' ? (aspect > 1.75 ? 31 : 35) : aspect > 1.75 ? 39 : 43;
      camera.near = 0.1;
      camera.far = 80;
      camera.updateProjectionMatrix();
    }
  }, [camera, mode, size.width, size.height]);

  useFrame((_, delta) => {
    const targetPosition =
      mode === 'investigation' ? investigationCameraPosition : officeCameraPosition;
    const targetLookAt =
      mode === 'investigation' ? investigationCameraTarget : officeCameraTarget;

    if (prefersReducedMotion) {
      camera.position.copy(targetPosition);
      currentTarget.current.copy(targetLookAt);
    } else {
      const blend = 1 - Math.exp(-delta * 5.5);
      camera.position.lerp(targetPosition, blend);
      currentTarget.current.lerp(targetLookAt, blend);
    }

    camera.lookAt(currentTarget.current);
  });

  return null;
}
