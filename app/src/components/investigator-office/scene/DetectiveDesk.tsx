import { DeskObjects } from './DeskObjects';
import type { Materials } from './materials';

type DetectiveDeskProps = {
  materials: Materials;
};

export function DetectiveDesk({ materials }: DetectiveDeskProps) {
  return (
    <group position={[0, 0, 2.1]}>
      <mesh castShadow receiveShadow material={materials.walnut} position={[0, 1, 0]}>
        <boxGeometry args={[5.8, 0.28, 2.6]} />
      </mesh>
      <mesh castShadow receiveShadow material={materials.darkWood} position={[0, 0.52, 1.18]}>
        <boxGeometry args={[5.7, 0.78, 0.18]} />
      </mesh>
      <mesh castShadow receiveShadow material={materials.darkWood} position={[-2.25, 0.55, 0.22]}>
        <boxGeometry args={[0.22, 0.85, 1.58]} />
      </mesh>
      <mesh castShadow receiveShadow material={materials.darkWood} position={[2.25, 0.55, 0.22]}>
        <boxGeometry args={[0.22, 0.85, 1.58]} />
      </mesh>
      {[-1.45, 0, 1.45].map((x) => (
        <group key={x} position={[x, 0.62, 1.285]}>
          <mesh material={materials.walnut}>
            <boxGeometry args={[1.08, 0.26, 0.05]} />
          </mesh>
          <mesh material={materials.brass} position={[0, 0, 0.035]}>
            <boxGeometry args={[0.26, 0.035, 0.035]} />
          </mesh>
        </group>
      ))}
      <DeskObjects materials={materials} />
    </group>
  );
}
