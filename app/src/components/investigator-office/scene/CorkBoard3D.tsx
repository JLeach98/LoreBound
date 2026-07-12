import type { Materials } from './materials';

type CorkBoard3DProps = {
  materials: Materials;
};

export function CorkBoard3D({ materials }: CorkBoard3DProps) {
  return (
    <group position={[0, 2.25, -2.82]}>
      <mesh
        castShadow
        receiveShadow
        material={materials.darkWood}
        position={[0, 0, -0.08]}
      >
        <boxGeometry args={[4.9, 2.6, 0.18]} />
      </mesh>
      <mesh castShadow receiveShadow material={materials.cork} position={[0, 0, 0.04]}>
        <boxGeometry args={[4.35, 2.05, 0.08]} />
      </mesh>
      <mesh material={materials.brass} position={[0, 1.18, 0.08]}>
        <boxGeometry args={[4.7, 0.05, 0.04]} />
      </mesh>
      <mesh material={materials.brass} position={[0, -1.18, 0.08]}>
        <boxGeometry args={[4.7, 0.05, 0.04]} />
      </mesh>
    </group>
  );
}
