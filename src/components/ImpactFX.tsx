import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ImpactEvent } from '../types/game';

interface ImpactFXProps {
  impacts: ImpactEvent[];
  onExpire?: (id: number) => void;
}

// Single active impact explosion
function SingleImpact({
  event,
  onFinish,
}: {
  event: ImpactEvent;
  onFinish: (id: number) => void;
}) {
  const startTime = useRef(performance.now());
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparksRef = useRef<THREE.Points>(null);
  const debrisGroupRef = useRef<THREE.Group>(null);

  const duration = event.isCore ? 900 : 650; // ms

  // Calculate orientation aligned with the surface normal
  const normalQuat = useMemo(() => {
    const norm = new THREE.Vector3(...event.normal).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
    return q;
  }, [event.normal]);

  // Pre-generate spark particles
  const sparkData = useMemo(() => {
    const count = event.isCore ? 40 : 24;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    const norm = new THREE.Vector3(...event.normal).normalize();
    const baseColor = new THREE.Color(event.color || '#38bdf8');
    const sparkColor = event.isCore ? new THREE.Color('#fef08a') : new THREE.Color('#67e8f9');

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      // Hemispherical spread biased along surface normal
      const randDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      const dir = randDir.addScaledVector(norm, 1.4).normalize();
      const speed = (event.isCore ? 16 : 10) + Math.random() * (event.isCore ? 18 : 12);
      velocities.push(dir.multiplyScalar(speed));

      // Color variation between spark tint and base emissive
      const mixed = baseColor.clone().lerp(sparkColor, Math.random());
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    return { count, positions, colors, velocities };
  }, [event]);

  // Pre-generate rock debris shards
  const debrisData = useMemo(() => {
    const count = event.isCore ? 8 : 6;
    const norm = new THREE.Vector3(...event.normal).normalize();
    const items = [];

    for (let i = 0; i < count; i++) {
      const randDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      const dir = randDir.addScaledVector(norm, 1.1).normalize();
      const speed = 4 + Math.random() * 8;
      const velocity = dir.multiplyScalar(speed);

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );

      const scale = (event.isCore ? 0.22 : 0.16) + Math.random() * (event.isCore ? 0.18 : 0.12);

      items.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity,
        rotSpeed,
        scale,
      });
    }

    return items;
  }, [event]);

  // Spark points geometry setup
  const sparkGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkData.positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(sparkData.colors, 3));
    return geo;
  }, [sparkData]);

  // Frame animation loop
  useFrame((_, delta) => {
    const elapsed = performance.now() - startTime.current;
    const progress = Math.min(1.0, elapsed / duration);

    if (progress >= 1.0) {
      onFinish(event.id);
      return;
    }

    // 1. Point Light Flash
    if (lightRef.current) {
      const peakIntensity = event.isCore ? 16 : 8;
      // Exponential decay from peak
      lightRef.current.intensity = peakIntensity * Math.pow(1 - progress, 2.5);
    }

    // 2. Expanding Shockwave Ring
    if (ringRef.current && ringMatRef.current) {
      const maxScale = event.isCore ? 3.8 : 2.2;
      const currentScale = 0.2 + progress * maxScale;
      ringRef.current.scale.set(currentScale, currentScale, currentScale);
      ringMatRef.current.opacity = Math.pow(1 - progress, 1.6);
    }

    // 3. Spark Particles
    if (sparksRef.current) {
      const posAttr = sparksRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < sparkData.count; i++) {
        const vel = sparkData.velocities[i];
        // Apply gravity & drag
        vel.y -= 12 * delta;
        vel.multiplyScalar(0.96);

        posArray[i * 3] += vel.x * delta;
        posArray[i * 3 + 1] += vel.y * delta;
        posArray[i * 3 + 2] += vel.z * delta;
      }
      posAttr.needsUpdate = true;
    }

    // 4. Debris Shards
    if (debrisGroupRef.current) {
      const children = debrisGroupRef.current.children;
      for (let i = 0; i < children.length && i < debrisData.length; i++) {
        const child = children[i] as THREE.Mesh;
        const data = debrisData[i];

        // Apply gravity
        data.velocity.y -= 15 * delta;
        data.velocity.multiplyScalar(0.98);

        child.position.addScaledVector(data.velocity, delta);
        child.rotation.x += data.rotSpeed.x * delta;
        child.rotation.y += data.rotSpeed.y * delta;
        child.rotation.z += data.rotSpeed.z * delta;

        // Fade scale slightly towards end
        const shrink = 1.0 - Math.max(0, (progress - 0.6) / 0.4);
        child.scale.setScalar(data.scale * shrink);
      }
    }
  });

  return (
    <group position={event.position}>
      {/* 1. Impact Point Light Flash */}
      <pointLight
        ref={lightRef}
        color={event.isCore ? '#fef08a' : '#38bdf8'}
        intensity={event.isCore ? 16 : 8}
        distance={event.isCore ? 14 : 9}
        decay={2}
      />

      {/* 2. Expanding Shockwave Ring (facing impact normal) */}
      <mesh ref={ringRef} quaternion={normalQuat}>
        <ringGeometry args={[0.65, 0.95, 32]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={event.isCore ? '#fef08a' : '#38bdf8'}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Second Inner High-Energy Ring */}
      <mesh quaternion={normalQuat}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial
          color={event.isCore ? '#ffffff' : '#e0f2fe'}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Glowing Sparks */}
      <points ref={sparksRef} geometry={sparkGeometry}>
        <pointsMaterial
          size={event.isCore ? 0.22 : 0.15}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 4. Debris Shards */}
      <group ref={debrisGroupRef}>
        {debrisData.map((d, idx) => (
          <mesh key={idx} scale={d.scale}>
            {event.isCore ? (
              <octahedronGeometry args={[1, 0]} />
            ) : (
              <dodecahedronGeometry args={[1, 0]} />
            )}
            <meshStandardMaterial
              color={event.color || '#312e81'}
              emissive={event.isCore ? '#38bdf8' : '#4338ca'}
              emissiveIntensity={event.isCore ? 2.5 : 1.2}
              roughness={0.7}
              flatShading
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function ImpactFX({ impacts, onExpire }: ImpactFXProps) {
  return (
    <group>
      {impacts.map((evt) => (
        <SingleImpact
          key={evt.id}
          event={evt}
          onFinish={(id) => onExpire?.(id)}
        />
      ))}
    </group>
  );
}
