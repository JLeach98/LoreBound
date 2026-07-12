import type { Materials } from './materials';

type OfficeFurnitureProps = {
  materials: Materials;
};

export function OfficeFurniture({ materials }: OfficeFurnitureProps) {
  return (
    <>
      <group position={[-3.35, 0.92, -1.75]}>
        <mesh castShadow receiveShadow material={materials.darkWood}>
          <boxGeometry args={[0.9, 1.85, 0.5]} />
        </mesh>
        {[0.35, 0.85, 1.35].map((y) => (
          <mesh key={y} material={materials.walnut} position={[0, y - 0.92, 0.28]}>
            <boxGeometry args={[0.78, 0.055, 0.08]} />
          </mesh>
        ))}
        {[-0.22, 0.05, 0.27].map((x) => (
          <mesh key={x} castShadow material={materials.book} position={[x, 0.15, 0.32]}>
            <boxGeometry args={[0.12, 0.52, 0.11]} />
          </mesh>
        ))}
      </group>

      <group position={[3.25, 0.7, -1.85]}>
        <mesh castShadow receiveShadow material={materials.darkWood}>
          <boxGeometry args={[1.08, 1.32, 0.48]} />
        </mesh>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} material={materials.walnut} position={[x, 0.05, 0.28]}>
            <boxGeometry args={[0.42, 0.32, 0.07]} />
          </mesh>
        ))}
        <mesh castShadow material={materials.brass} position={[0.58, 1.15, 0.02]}>
          <cylinderGeometry args={[0.035, 0.035, 1.45, 16]} />
        </mesh>
        <mesh castShadow material={materials.deepGraphite} position={[0.58, 1.85, 0.02]}>
          <sphereGeometry args={[0.12, 16, 10]} />
        </mesh>
      </group>

      <group position={[0, 0.48, -2.55]}>
        <mesh castShadow receiveShadow material={materials.darkWood}>
          <boxGeometry args={[3.4, 0.58, 0.42]} />
        </mesh>
        <mesh material={materials.brass} position={[-0.7, 0.08, 0.24]}>
          <boxGeometry args={[0.3, 0.035, 0.035]} />
        </mesh>
        <mesh material={materials.brass} position={[0.7, 0.08, 0.24]}>
          <boxGeometry args={[0.3, 0.035, 0.035]} />
        </mesh>
      </group>
    </>
  );
}
