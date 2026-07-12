export function OfficeLighting() {
  return (
    <>
      <hemisphereLight args={['#f4e3c8', '#241711', 0.72]} />
      <directionalLight
        castShadow
        color="#efbd73"
        intensity={2.25}
        position={[3.6, 5.2, 3.5]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      <directionalLight color="#fff1d5" intensity={0.36} position={[-3, 2.2, 4]} />
    </>
  );
}
