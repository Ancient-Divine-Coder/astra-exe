import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ImpactEvent, MountainMaterialType } from '../types/game';
import { ASTRA_CONFIGS } from '../types/game';

interface ImpactFXProps {
  impacts: ImpactEvent[];
  onExpire?: (id: number) => void;
}

// Material physics and visual profiles for realistic planetary/space simulation destruction
interface MaterialVFXProfile {
  sparkBaseCount: number;
  sparkColors: [string, string, string];
  sparkSize: number;
  debrisCount: number;
  debrisGeometry: 'octahedron' | 'dodecahedron' | 'box' | 'cylinder';
  debrisColor: string;
  debrisEmissive: string;
  debrisRoughness: number;
  debrisMetalness: number;
  coneAngleDeg: number;
  coneJitter: number;
  microgravity: number; // Space microgravity: -2.0 to -3.8 (vs Earth -15)
  dragFactor: number;
  shockwaveColor: string;
  dustHaloColor: string;
}

const MATERIAL_VFX_PROFILES: Record<MountainMaterialType, MaterialVFXProfile> = {
  Basalt: {
    sparkBaseCount: 75,
    sparkColors: ['#ff4500', '#f97316', '#3b0764'], // Incandescent magma embers & fine volcanic ash
    sparkSize: 0.13,
    debrisCount: 22,
    debrisGeometry: 'dodecahedron', // Small angular volcanic rock flakes
    debrisColor: '#1e1b4b',
    debrisEmissive: '#f97316',
    debrisRoughness: 0.9,
    debrisMetalness: 0.15,
    coneAngleDeg: 42,
    coneJitter: 0.35,
    microgravity: -3.2,
    dragFactor: 0.985,
    shockwaveColor: '#f97316',
    dustHaloColor: '#431407',
  },
  Iron: {
    sparkBaseCount: 90,
    sparkColors: ['#ffffff', '#fef08a', '#f59e0b'], // White-hot molten metal spatter & golden arcs
    sparkSize: 0.11,
    debrisCount: 24,
    debrisGeometry: 'box', // Fine metallic shrapnel slivers
    debrisColor: '#475569',
    debrisEmissive: '#fbbf24',
    debrisRoughness: 0.35,
    debrisMetalness: 0.92,
    coneAngleDeg: 48,
    coneJitter: 0.28,
    microgravity: -3.8,
    dragFactor: 0.988,
    shockwaveColor: '#fef08a',
    dustHaloColor: '#cbd5e1',
  },
  Crystal: {
    sparkBaseCount: 85,
    sparkColors: ['#ffffff', '#e0f2fe', '#38bdf8'], // Prismatic diamond glints & aetheric sparkles
    sparkSize: 0.14,
    debrisCount: 28,
    debrisGeometry: 'octahedron', // Lightweight sharp crystalline micro-facets
    debrisColor: '#0284c7',
    debrisEmissive: '#38bdf8',
    debrisRoughness: 0.12,
    debrisMetalness: 0.35,
    coneAngleDeg: 38,
    coneJitter: 0.22,
    microgravity: -2.2,
    dragFactor: 0.982,
    shockwaveColor: '#38bdf8',
    dustHaloColor: '#a5f3fc',
  },
  DuctileRock: {
    sparkBaseCount: 82,
    sparkColors: ['#fed7aa', '#fb923c', '#c2410c'], // Billowing terracotta dust motes & sandstone powder
    sparkSize: 0.13,
    debrisCount: 20,
    debrisGeometry: 'cylinder', // Small sedimentary shale/clay flakes
    debrisColor: '#9a3412',
    debrisEmissive: '#ea580c',
    debrisRoughness: 0.88,
    debrisMetalness: 0.08,
    coneAngleDeg: 55,
    coneJitter: 0.45,
    microgravity: -2.5,
    dragFactor: 0.975,
    shockwaveColor: '#fb923c',
    dustHaloColor: '#7c2d12',
  },
};

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
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparksRef = useRef<THREE.Points>(null);
  const debrisGroupRef = useRef<THREE.Group>(null);

  const astraType = event.astraType || 'astral';
  const astraConf = ASTRA_CONFIGS[astraType] || ASTRA_CONFIGS.astral;
  const isBrahmashira = astraType === 'brahmashira';
  const materialType = event.materialType || 'Basalt';
  const matFX = MATERIAL_VFX_PROFILES[materialType] || MATERIAL_VFX_PROFILES.Basalt;

  const duration = event.isCore
    ? 1100
    : astraType === 'agni'
    ? 950
    : isBrahmashira
    ? 2600
    : 750; // ms

  // Calculate orientation aligned with the surface normal
  const normalQuat = useMemo(() => {
    const norm = new THREE.Vector3(...event.normal).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
    return q;
  }, [event.normal]);

  // Pre-generate conical ejecta particles tailored to Material + Astra
  const sparkData = useMemo(() => {
    let count = matFX.sparkBaseCount;
    if (event.isCore) count = Math.round(count * 1.5);
    if (astraType === 'agni') count = Math.round(count * 1.4);
    else if (isBrahmashira) count = 54;
    else if (astraType === 'vayu') count = Math.round(count * 1.2);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    const vortexCoords: { radius: number; angle: number; yOffset: number; rotSpeed: number }[] = [];

    const norm = new THREE.Vector3(...event.normal).normalize();

    // Construct local tangent basis perpendicular to normal for conical curtain
    const arbitrary = Math.abs(norm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(norm, arbitrary).normalize();
    const bitangent = new THREE.Vector3().crossVectors(norm, tangent).normalize();

    const c1 = new THREE.Color(matFX.sparkColors[0]);
    const c2 = new THREE.Color(matFX.sparkColors[1]);
    const c3 = new THREE.Color(matFX.sparkColors[2]);
    const astraGlow = new THREE.Color(astraConf.color);

    const coneAngleRad = (matFX.coneAngleDeg * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      if (isBrahmashira) {
        // Singularity Vortex particles start spread in cosmic space and swirl inward
        const r = 2.4 + Math.random() * 4.0;
        const a = Math.random() * Math.PI * 2;
        const yOff = (Math.random() - 0.5) * 2.4;
        const rSpd = 4.2 + Math.random() * 5.2;
        vortexCoords.push({ radius: r, angle: a, yOffset: yOff, rotSpeed: rSpd });

        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = yOff;
        positions[i * 3 + 2] = Math.sin(a) * r;
        velocities.push(new THREE.Vector3(0, 0, 0));
      } else {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;

        // Space Simulator Hypervelocity Inverted Conical Ejecta Curtain:
        // Ejecta expands at an angle ~coneAngleRad from the impact surface normal
        const azimuth = Math.random() * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * matFX.coneJitter;
        const elevation = Math.max(0.15, coneAngleRad + jitter);

        // Direction along conical sheet
        const radialDir = new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(azimuth))
          .addScaledVector(bitangent, Math.sin(azimuth));

        const dir = new THREE.Vector3()
          .addScaledVector(norm, Math.sin(elevation))
          .addScaledVector(radialDir, Math.cos(elevation))
          .normalize();

        const speedMult = astraType === 'vayu' ? 1.7 : astraType === 'agni' ? 1.3 : 1.0;
        const baseSpeed = (event.isCore ? 18 : 12) + Math.random() * (event.isCore ? 20 : 14);
        velocities.push(dir.multiplyScalar(baseSpeed * speedMult));
      }

      // Material-specific color mixing with Astra energy tint
      const r = Math.random();
      const mixed = r < 0.4 ? c1.clone() : r < 0.75 ? c2.clone() : c3.clone();
      mixed.lerp(astraGlow, 0.35);

      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    return { count, positions, colors, velocities, vortexCoords };
  }, [event, astraType, astraConf, isBrahmashira, matFX]);

  // Pre-generate material-tailored polygonal micro-debris shards
  const debrisData = useMemo(() => {
    let count = matFX.debrisCount;
    if (event.isCore) count += 3;
    if (astraType === 'agni') count += 2;

    const norm = new THREE.Vector3(...event.normal).normalize();
    const items = [];

    for (let i = 0; i < count; i++) {
      const randDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();

      const dir = randDir.addScaledVector(norm, 1.25).normalize();
      const speed = (5 + Math.random() * 9) * (astraType === 'agni' ? 1.4 : astraType === 'vayu' ? 1.3 : 1.0);
      const velocity = dir.multiplyScalar(speed);

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * (materialType === 'Crystal' ? 24 : 16),
        (Math.random() - 0.5) * (materialType === 'Crystal' ? 24 : 16),
        (Math.random() - 0.5) * (materialType === 'Crystal' ? 24 : 16)
      );

      const scale = (event.isCore ? 0.09 : 0.055) + Math.random() * (event.isCore ? 0.06 : 0.04);

      items.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity,
        rotSpeed,
        scale,
      });
    }

    return items;
  }, [event, astraType, matFX, materialType]);

  // Spark points geometry setup
  const sparkGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkData.positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(sparkData.colors, 3));
    return geo;
  }, [sparkData]);

  // Frame animation loop with space simulation microgravity and orbital drift
  useFrame((_, delta) => {
    const elapsed = performance.now() - startTime.current;
    const progress = Math.min(1.0, elapsed / duration);

    if (progress >= 1.0) {
      onFinish(event.id);
      return;
    }

    // 1. Point Light Flash
    if (lightRef.current) {
      if (isBrahmashira) {
        const pulse = 1.0 + Math.sin(elapsed * 0.015) * 0.3;
        lightRef.current.intensity = 18 * (1 - progress * 0.7) * pulse;
      } else {
        const baseIntensity = event.isCore ? 22 : astraType === 'agni' ? 20 : 12;
        lightRef.current.intensity = baseIntensity * Math.pow(1 - progress, 2.6);
      }
    }

    // 2. Primary Fast Shockwave Ring
    if (ringRef.current && ringMatRef.current) {
      if (isBrahmashira) {
        ringRef.current.rotation.z += 7.5 * delta;
        const vortexScale = 1.0 + Math.sin(elapsed * 0.012) * 0.25;
        ringRef.current.scale.set(vortexScale, vortexScale, vortexScale);
        ringMatRef.current.opacity = Math.pow(1 - progress, 0.7);
      } else {
        const maxScale = (event.isCore ? 4.5 : 2.8) * astraConf.blastRadiusMultiplier;
        const currentScale = 0.2 + progress * maxScale;
        ringRef.current.scale.set(currentScale, currentScale, currentScale);
        ringMatRef.current.opacity = Math.pow(1 - progress, 1.8);
      }
    }

    // Secondary Spallation Dust Halo Ring
    if (haloRef.current && haloMatRef.current && !isBrahmashira) {
      const haloScale = 0.15 + progress * (event.isCore ? 3.6 : 2.2) * astraConf.blastRadiusMultiplier;
      haloRef.current.scale.set(haloScale, haloScale, haloScale);
      haloMatRef.current.opacity = Math.pow(1 - progress, 1.3) * 0.75;
    }

    // 3. Ejecta Sparks in Deep Space Microgravity
    if (sparksRef.current) {
      const posAttr = sparksRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      if (isBrahmashira) {
        // Particles swirl INWARD toward singularity center
        for (let i = 0; i < sparkData.count; i++) {
          const c = sparkData.vortexCoords[i];
          if (!c) continue;
          const curR = Math.max(0.08, c.radius * (1 - progress));
          const curA = c.angle + c.rotSpeed * (elapsed * 0.0035);

          posArray[i * 3] = Math.cos(curA) * curR;
          posArray[i * 3 + 1] = c.yOffset * (1 - progress);
          posArray[i * 3 + 2] = Math.sin(curA) * curR;
        }
      } else {
        // Space simulator microgravity: particles drift in 3D orbit rather than dropping instantly
        const g = matFX.microgravity;
        const drag = matFX.dragFactor;

        for (let i = 0; i < sparkData.count; i++) {
          const vel = sparkData.velocities[i];
          vel.y += g * delta;
          vel.multiplyScalar(drag);

          posArray[i * 3] += vel.x * delta;
          posArray[i * 3 + 1] += vel.y * delta;
          posArray[i * 3 + 2] += vel.z * delta;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 4. Micro-Debris Shards with Space Tumble
    if (debrisGroupRef.current) {
      const children = debrisGroupRef.current.children;
      for (let i = 0; i < children.length && i < debrisData.length; i++) {
        const child = children[i] as THREE.Mesh;
        const data = debrisData[i];

        if (isBrahmashira) {
          // Debris gets sucked inward into singularity eye
          child.position.lerp(new THREE.Vector3(0, 0, 0), delta * 2.8);
          child.rotation.x += data.rotSpeed.x * delta * 2;
          child.rotation.y += data.rotSpeed.y * delta * 2;
          child.rotation.z += data.rotSpeed.z * delta * 2;
          const shrink = Math.max(0.01, 1 - progress);
          child.scale.setScalar(data.scale * shrink);
        } else {
          // Space microgravity tumble
          data.velocity.y += matFX.microgravity * 1.5 * delta;
          data.velocity.multiplyScalar(matFX.dragFactor);

          child.position.addScaledVector(data.velocity, delta);
          child.rotation.x += data.rotSpeed.x * delta;
          child.rotation.y += data.rotSpeed.y * delta;
          child.rotation.z += data.rotSpeed.z * delta;

          const shrink = 1.0 - Math.max(0, (progress - 0.6) / 0.4);
          child.scale.setScalar(data.scale * shrink);
        }
      }
    }
  });

  return (
    <group position={event.position}>
      {/* 1. Impact Point Light Flash */}
      <pointLight
        ref={lightRef}
        color={event.isCore ? '#fef08a' : astraConf.color}
        intensity={event.isCore ? 22 : isBrahmashira ? 18 : 12}
        distance={event.isCore ? 18 : isBrahmashira ? 20 : 12}
        decay={2}
      />

      {/* 2. Expanding Primary Shockwave Ring */}
      <mesh ref={ringRef} quaternion={normalQuat}>
        <ringGeometry args={[isBrahmashira ? 0.6 : 0.65, isBrahmashira ? 2.6 : 0.95, 36]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={event.isCore ? '#fef08a' : astraConf.color}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary Material-Specific Spallation Dust Halo Ring */}
      {!isBrahmashira && (
        <mesh ref={haloRef} quaternion={normalQuat}>
          <ringGeometry args={[0.3, 1.4, 32]} />
          <meshBasicMaterial
            ref={haloMatRef}
            color={matFX.dustHaloColor}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Cosmic Singularity Void Core (Black Hole Eye for Brahmashira) */}
      {isBrahmashira ? (
        <group quaternion={normalQuat}>
          <mesh>
            <sphereGeometry args={[0.55, 24, 24]} />
            <meshBasicMaterial color="#050010" />
          </mesh>
          <mesh rotation={[0.4, 0.2, 0]}>
            <ringGeometry args={[0.7, 3.2, 32]} />
            <meshBasicMaterial
              color="#ec4899"
              transparent
              opacity={0.65}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : (
        /* Inner High-Energy Core Flash */
        <mesh quaternion={normalQuat}>
          <circleGeometry args={[0.45, 24]} />
          <meshBasicMaterial
            color={event.isCore ? '#ffffff' : astraConf.accentColor}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 3. Conical Ejecta Sparks / Singularity Inward Stream */}
      <points ref={sparksRef} geometry={sparkGeometry}>
        <pointsMaterial
          size={event.isCore ? 0.25 : isBrahmashira ? 0.22 : matFX.sparkSize}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 4. Material-Specific Polygonal Micro-Debris Shards */}
      <group ref={debrisGroupRef}>
        {debrisData.map((d, idx) => (
          <mesh key={idx} scale={d.scale}>
            {event.isCore ? (
              <octahedronGeometry args={[1, 0]} />
            ) : matFX.debrisGeometry === 'octahedron' ? (
              <octahedronGeometry args={[1, 0]} />
            ) : matFX.debrisGeometry === 'box' ? (
              <boxGeometry args={[0.7, 0.4, 1.4]} /> // Elongated metallic sliver shrapnel
            ) : matFX.debrisGeometry === 'cylinder' ? (
              <cylinderGeometry args={[0.9, 0.9, 0.35, 6]} /> // Flat sedimentary slab
            ) : (
              <dodecahedronGeometry args={[1, 0]} /> // Angular basalt boulder
            )}
            <meshStandardMaterial
              color={matFX.debrisColor}
              emissive={matFX.debrisEmissive}
              emissiveIntensity={event.isCore ? 2.5 : 1.3}
              roughness={matFX.debrisRoughness}
              metalness={matFX.debrisMetalness}
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
