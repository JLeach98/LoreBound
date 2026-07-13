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
  const transitionProgress = useRef(1);
  const startPosition = useRef(officeCameraPosition.clone());
  const startTarget = useRef(officeCameraTarget.clone());
  const destinationPosition = useRef(officeCameraPosition.clone());
  const destinationTarget = useRef(officeCameraTarget.clone());
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

  useEffect(() => {
    startPosition.current.copy(camera.position);
    startTarget.current.copy(currentTarget.current);
    destinationPosition.current.copy(
      mode === 'investigation' ? investigationCameraPosition : officeCameraPosition,
    );
    destinationTarget.current.copy(
      mode === 'investigation' ? investigationCameraTarget : officeCameraTarget,
    );
    transitionProgress.current = prefersReducedMotion ? 1 : 0;
  }, [camera.position, mode, prefersReducedMotion]);

  useFrame((_, delta) => {
    if (prefersReducedMotion) {
      camera.position.copy(destinationPosition.current);
      currentTarget.current.copy(destinationTarget.current);
    } else {
      transitionProgress.current = Math.min(1, transitionProgress.current + delta * 0.92);
      const progress = transitionProgress.current;
      const eased = progress * progress * (3 - 2 * progress);
      const lift = Math.sin(progress * Math.PI) * (mode === 'investigation' ? 0.12 : 0.06);

      camera.position.lerpVectors(
        startPosition.current,
        destinationPosition.current,
        eased,
      );
      camera.position.y += lift;
      currentTarget.current.lerpVectors(
        startTarget.current,
        destinationTarget.current,
        eased,
      );
    }

    camera.lookAt(currentTarget.current);
  });

  return null;
}
