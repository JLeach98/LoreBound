import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Vector3 } from 'three';

const cameraPosition = new Vector3(0, 2.25, 7.2);
const cameraTarget = new Vector3(0, 1.75, 0);

export function CameraRig() {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);

    if ('fov' in camera) {
      camera.fov = aspect > 1.75 ? 39 : 43;
      camera.near = 0.1;
      camera.far = 80;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  return null;
}
