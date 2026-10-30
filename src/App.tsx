import { Canvas } from '@react-three/fiber';
import { Physics, RigidBody } from '@react-three/rapier';
import { OrbitControls, Stars } from '@react-three/drei';
import './App.css';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#030008' }}>
      <Canvas camera={{ position: [0, 8, 16], fov: 60 }}>
        {/* Cosmic Atmosphere & Lighting */}
        <color attach="background" args={['#030008']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[15, 25, 10]} intensity={2} castShadow />
        <pointLight position={[0, -5, 0]} color="#4338ca" intensity={3} distance={25} />

        {/* Starfield Background */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={1} fade speed={1} />

        {/* Physics World Container */}
        <Physics gravity={[0, -9.81, 0]}>
          
          {/* --- MYTHICAL FLOATING ISLAND (Manual Crafting) --- */}
          
          {/* 1. Main Island Surface (Static Ground) */}
          <RigidBody type="fixed" friction={0.8}>
            <mesh position={[0, -1, 0]}>
              <boxGeometry args={[16, 1, 16]} />
              <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
            </mesh>
          </RigidBody>

          {/* 2. Layered Rock Underside (Creating the floating chunk look) */}
          <RigidBody type="fixed">
            <mesh position={[0, -2.2, 0]}>
              <boxGeometry args={[12, 1.4, 12]} />
              <meshStandardMaterial color="#312e81" roughness={1} />
            </mesh>
          </RigidBody>

          <RigidBody type="fixed">
            <mesh position={[0, -3.8, 0]}>
              <boxGeometry args={[7, 1.8, 7]} />
              <meshStandardMaterial color="#1e1b4b" roughness={1} />
            </mesh>
          </RigidBody>

          <RigidBody type="fixed">
            <mesh position={[0, -5.5, 0]}>
              <boxGeometry args={[3, 1.5, 3]} />
              <meshStandardMaterial color="#0f172a" roughness={1} />
            </mesh>
          </RigidBody>

          {/* --- TARGET / INTERACTIVE TEST PIECES --- */}

          {/* A small stack of blocks to test impact physics */}
          <RigidBody position={[0, 1, 0]} restitution={0.3} mass={1}>
            <mesh>
              <boxGeometry args={[1.5, 1.5, 1.5]} />
              <meshStandardMaterial color="#818cf8" emissive="#4f46e5" emissiveIntensity={0.2} />
            </mesh>
          </RigidBody>

          <RigidBody position={[0, 3, 0]} restitution={0.3} mass={0.8}>
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#c084fc" emissive="#9333ea" emissiveIntensity={0.2} />
            </mesh>
          </RigidBody>

        </Physics>

        {/* Camera Controls */}
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}