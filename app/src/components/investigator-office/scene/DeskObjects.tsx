import type { Materials } from './materials';

type DeskObjectsProps = {
  materials: Materials;
};

export function DeskObjects({ materials }: DeskObjectsProps) {
  return (
    <group position={[0, 1.16, 2.28]}>
      <group position={[-1.75, 0.05, -0.36]} rotation={[0, 0.12, -0.08]}>
        <mesh castShadow receiveShadow material={materials.paper}>
          <boxGeometry args={[0.92, 0.04, 0.62]} />
        </mesh>
        <mesh material={materials.paperEdge} position={[0.1, 0.04, -0.28]}>
          <boxGeometry args={[0.34, 0.035, 0.12]} />
        </mesh>
      </group>

      <group position={[-0.68, 0.06, -0.54]} rotation={[0, -0.18, 0.05]}>
        <mesh castShadow receiveShadow material={materials.folder}>
          <boxGeometry args={[0.82, 0.05, 0.5]} />
        </mesh>
        <mesh castShadow receiveShadow material={materials.folderLight} position={[0.08, 0.06, -0.05]}>
          <boxGeometry args={[0.78, 0.04, 0.46]} />
        </mesh>
      </group>

      <group position={[0.75, 0.08, -0.48]} rotation={[0, 0.2, 0.1]}>
        <mesh castShadow receiveShadow material={materials.leather}>
          <boxGeometry args={[0.66, 0.08, 0.82]} />
        </mesh>
        <mesh material={materials.paperEdge} position={[0.34, -0.01, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.74]} />
        </mesh>
        <mesh material={materials.brass} position={[-0.22, 0.045, 0]}>
          <boxGeometry args={[0.025, 0.018, 0.7]} />
        </mesh>
      </group>

      <group position={[1.55, 0.1, -0.08]} rotation={[0, -0.75, 0.04]}>
        <mesh castShadow receiveShadow material={materials.brass}>
          <torusGeometry args={[0.22, 0.025, 12, 40]} />
        </mesh>
        <mesh castShadow receiveShadow material={materials.brass} position={[0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.58, 16]} />
        </mesh>
      </group>

      <group position={[2.05, 0.06, -0.78]}>
        <mesh castShadow receiveShadow material={materials.brass} position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.38, 18]} />
        </mesh>
        <mesh castShadow receiveShadow material={materials.brass} position={[0, 0.43, 0]} rotation={[0.08, 0, 0]}>
          <coneGeometry args={[0.34, 0.34, 24]} />
        </mesh>
        <mesh castShadow receiveShadow material={materials.brassDark} position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 0.08, 24]} />
        </mesh>
        <pointLight
          color="#f0b85d"
          intensity={0.75}
          distance={4.2}
          position={[-0.1, 0.55, 0.12]}
          castShadow={false}
        />
      </group>
    </group>
  );
}
