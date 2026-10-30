import { RigidBody, interactionGroups } from '@react-three/rapier';
import { COLLISION_GROUPS } from '../types/game';

export function CelestialIsland() {
  return (
    <group>
      {/* Upper Main Platform */}
      <RigidBody
        type="fixed"
        friction={0.88}
        restitution={0.05}
        collisionGroups={interactionGroups(COLLISION_GROUPS.ENVIRONMENT, [
          COLLISION_GROUPS.PROJECTILE,
          COLLISION_GROUPS.DESTRUCTIBLE,
        ])}
      >
        <mesh position={[0, -1, 0]} receiveShadow>
          <boxGeometry args={[16, 1, 16]} />
          <meshStandardMaterial color="#13112c" roughness={0.85} metalness={0.2} />
        </mesh>
      </RigidBody>

      {/* Mid Platform Tier */}
      <RigidBody
        type="fixed"
        friction={0.85}
        restitution={0.05}
        collisionGroups={interactionGroups(COLLISION_GROUPS.ENVIRONMENT, [
          COLLISION_GROUPS.PROJECTILE,
          COLLISION_GROUPS.DESTRUCTIBLE,
        ])}
      >
        <mesh position={[0, -2.2, 0]} receiveShadow>
          <boxGeometry args={[13, 1.4, 13]} />
          <meshStandardMaterial color="#1e184a" roughness={0.9} metalness={0.15} />
        </mesh>
      </RigidBody>

      {/* Floating Island Inverted Keystone Foundation */}
      <mesh position={[0, -4.6, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[6.5, 3.8, 6]} />
        <meshStandardMaterial color="#0f0c24" roughness={1.0} flatShading={true} />
      </mesh>

      {/* Mythical Celestial Rune Ring Trim */}
      <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.8, 8.05, 48]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={1.2}
          roughness={0.3}
        />
      </mesh>

      {/* Under-island ethereal glow light */}
      <pointLight position={[0, -5, 0]} color="#4f46e5" intensity={4} distance={30} decay={2} />
    </group>
  );
}
