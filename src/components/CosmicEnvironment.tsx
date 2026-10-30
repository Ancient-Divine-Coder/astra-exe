import { Stars } from '@react-three/drei';

export function CosmicEnvironment() {
  return (
    <>
      {/* Deep Cosmos Background Color */}
      <color attach="background" args={['#030008']} />

      {/* Dynamic Cosmic Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[14, 22, 12]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      {/* Rim & Key light highlighting the distant celestial mountain */}
      <directionalLight position={[-16, 18, -48]} intensity={1.8} color="#818cf8" />
      <directionalLight position={[18, 14, -38]} intensity={1.4} color="#c084fc" />

      {/* Deep Space Starfield */}
      <Stars radius={180} depth={80} count={7000} factor={4} saturation={1} fade speed={1.2} />
    </>
  );
}
