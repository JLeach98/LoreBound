export function OfficeLighting() {
  return (
    <>
      <hemisphereLight args={['#f7ead7', '#2f1d14', 0.82]} />
      <directionalLight
        castShadow
        color="#f2c37a"
        intensity={2.6}
        position={[3.8, 5.5, 3.8]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
      />
      <directionalLight color="#fff4dc" intensity={0.45} position={[-3, 2.2, 4]} />
    </>
  );
}
