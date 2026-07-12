import type { Materials } from './materials';

type OfficeRoomProps = {
  materials: Materials;
};

export function OfficeRoom({ materials }: OfficeRoomProps) {
  return (
    <group>
      <mesh receiveShadow material={materials.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[8.6, 8.4]} />
      </mesh>
      <mesh receiveShadow material={materials.wall} position={[0, 2.05, -3.05]}>
        <boxGeometry args={[8.6, 4.1, 0.16]} />
      </mesh>
      <mesh receiveShadow material={materials.sideWall} position={[-4.25, 2.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[6.2, 4.1, 0.12]} />
      </mesh>
      <mesh receiveShadow material={materials.sideWall} position={[4.25, 2.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[6.2, 4.1, 0.12]} />
      </mesh>
    </group>
  );
}
