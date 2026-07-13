export function OfficeLighting() {
  return (
    <>
      <hemisphereLight args={['#f2dfc1', '#21140f', 0.66]} />
      <directionalLight
        castShadow
        color="#efbd73"
        intensity={2.4}
        position={[3.45, 5.45, 3.25]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      <directionalLight color="#fff1d5" intensity={0.28} position={[-3, 2.2, 4]} />
    </>
  );
}
