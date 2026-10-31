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
  const accretionDiskRef = useRef<THREE.Mesh>(null);
  const lensingRingRef = useRef<THREE.Mesh>(null);
  const photonRingRef = useRef<THREE.Mesh>(null);
  const energyWaveRef1 = useRef<THREE.Mesh>(null);
  const energyWaveMat1 = useRef<THREE.MeshBasicMaterial>(null);
  const energyWaveRef2 = useRef<THREE.Mesh>(null);
  const energyWaveMat2 = useRef<THREE.MeshBasicMaterial>(null);
  const agniCoreRef = useRef<THREE.Mesh>(null);
  const agniCoreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const agniFireMantleRef = useRef<THREE.Mesh>(null);
  const agniFireMantleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const agniBlastWaveRef = useRef<THREE.Mesh>(null);
  const agniBlastWaveMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vayuMachConeRef = useRef<THREE.Mesh>(null);
  const vayuMachConeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vayuNeedleRef = useRef<THREE.Mesh>(null);
  const vayuNeedleMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vayuShockRing1Ref = useRef<THREE.Mesh>(null);
  const vayuShockRing1MatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vayuShockRing2Ref = useRef<THREE.Mesh>(null);
  const vayuShockRing2MatRef = useRef<THREE.MeshBasicMaterial>(null);

  const astraType = event.astraType || 'astral';
  const astraConf = ASTRA_CONFIGS[astraType] || ASTRA_CONFIGS.astral;
  const isBrahmashira = astraType === 'brahmashira';
  const materialType = event.materialType || 'Basalt';
  const matFX = MATERIAL_VFX_PROFILES[materialType] || MATERIAL_VFX_PROFILES.Basalt;

  const duration = event.isCore
    ? 1100
    : astraType === 'agni'
    ? 1200 // Extended thermonuclear explosion lifecycle
    : isBrahmashira
    ? 3500 // 3.5s dramatic singularity event
    : astraType === 'vayu'
    ? 850 // Sharp supersonic kinetic dissipation
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
    if (astraType === 'agni') count = Math.round(matFX.sparkBaseCount * 2.2); // ~170-190 solar blast sparks and incandescent embers
    else if (isBrahmashira) count = 160; // Dense swirling gravitational accretion particle cloud
    else if (astraType === 'vayu') count = Math.round(matFX.sparkBaseCount * 1.6); // ~120-140 hypersonic kinetic spallation sparks

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
        // Massive Singularity Vortex particles start in wide orbit (up to 7.5 units) and spiral inward
        const r = 1.6 + Math.random() * 6.2;
        const a = Math.random() * Math.PI * 2;
        const yOff = (Math.random() - 0.5) * 3.4;
        const rSpd = 5.0 + Math.random() * 7.5;
        vortexCoords.push({ radius: r, angle: a, yOffset: yOff, rotSpeed: rSpd });

        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = yOff;
        positions[i * 3 + 2] = Math.sin(a) * r;
        velocities.push(new THREE.Vector3(0, 0, 0));
      } else {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;

        if (astraType === 'vayu') {
          // Hypersonic kinetic needle spallation jet - tight, ultra-high-speed supersonic cone along surface normal
          const azimuth = Math.random() * Math.PI * 2;
          const coneTightness = (10 + Math.random() * 14) * (Math.PI / 180); // 10-24 deg tight kinetic beam
          const radialDir = new THREE.Vector3()
            .addScaledVector(tangent, Math.cos(azimuth))
            .addScaledVector(bitangent, Math.sin(azimuth));

          const dir = new THREE.Vector3()
            .addScaledVector(norm, Math.cos(coneTightness))
            .addScaledVector(radialDir, Math.sin(coneTightness))
            .normalize();

          const baseSpeed = (event.isCore ? 30 : 22) + Math.random() * 22;
          velocities.push(dir.multiplyScalar(baseSpeed * 2.35));
        } else {
          // Space Simulator Hypervelocity Inverted Conical Ejecta Curtain:
          const azimuth = Math.random() * Math.PI * 2;
          const jitter = (Math.random() - 0.5) * (astraType === 'agni' ? 0.7 : matFX.coneJitter);
          const elevation = Math.max(0.12, coneAngleRad + jitter);

          // Direction along conical sheet / spherical explosive starburst for Agni
          const radialDir = new THREE.Vector3()
            .addScaledVector(tangent, Math.cos(azimuth))
            .addScaledVector(bitangent, Math.sin(azimuth));

          const dir = new THREE.Vector3()
            .addScaledVector(norm, Math.sin(elevation))
            .addScaledVector(radialDir, Math.cos(elevation))
            .normalize();

          const speedMult = astraType === 'agni' ? 1.95 : 1.0;
          const baseSpeed = (event.isCore ? 18 : 12) + Math.random() * (event.isCore ? 20 : 16);
          velocities.push(dir.multiplyScalar(baseSpeed * speedMult));
        }
      }

      // Material-specific color mixing or specialized palette for Agni / Vayu
      let mixed: THREE.Color;
      if (astraType === 'agni') {
        const rand = Math.random();
        mixed = rand < 0.35
          ? new THREE.Color('#ffffff')
          : rand < 0.65
          ? new THREE.Color('#fef08a')
          : rand < 0.85
          ? new THREE.Color('#f97316')
          : new THREE.Color('#ef4444');
      } else if (astraType === 'vayu') {
        const rand = Math.random();
        mixed = rand < 0.40
          ? new THREE.Color('#ffffff') // Incandescent white friction core
          : rand < 0.75
          ? new THREE.Color('#a7f3d0') // Luminous mint Mach condensation
          : rand < 0.92
          ? new THREE.Color('#10b981') // Emerald tempest shockwave
          : new THREE.Color('#047857'); // Deep compressed air green
      } else {
        const r = Math.random();
        mixed = r < 0.4 ? c1.clone() : r < 0.75 ? c2.clone() : c3.clone();
        mixed.lerp(astraGlow, 0.35);
      }

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
      const speed = (5 + Math.random() * 9) * (astraType === 'agni' ? 1.4 : astraType === 'vayu' ? 1.55 : 1.0);
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
        const pulse = 1.0 + Math.sin(elapsed * 0.015) * 0.35;
        lightRef.current.intensity = 26 * (1 - progress * 0.6) * pulse;
      } else if (astraType === 'agni') {
        // Blinding Thermonuclear Solar Detonation Flash
        lightRef.current.intensity = (event.isCore ? 52 : 44) * Math.pow(1 - progress, 2.0);
      } else {
        const baseIntensity = event.isCore ? 22 : 12;
        lightRef.current.intensity = baseIntensity * Math.pow(1 - progress, 2.6);
      }
    }

    // 2. Agni Astra Thermonuclear Solar Fireball Animations
    if (astraType === 'agni') {
      if (agniCoreRef.current && agniCoreMatRef.current) {
        const cFactor = progress < 0.28
          ? Math.pow(progress / 0.28, 0.4) * 3.8
          : 3.8 + (progress - 0.28) * 1.6;
        agniCoreRef.current.scale.set(cFactor, cFactor, cFactor);
        agniCoreMatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.8));
      }
      if (agniFireMantleRef.current && agniFireMantleMatRef.current) {
        const mFactor = progress < 0.36
          ? Math.pow(progress / 0.36, 0.45) * 5.6
          : 5.6 + (progress - 0.36) * 2.4;
        agniFireMantleRef.current.scale.set(mFactor, mFactor, mFactor);
        agniFireMantleRef.current.rotation.y += 2.8 * delta;
        agniFireMantleRef.current.rotation.z += 1.9 * delta;
        agniFireMantleMatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.2) * 0.9);
      }
      if (agniBlastWaveRef.current && agniBlastWaveMatRef.current) {
        const wScale = 0.5 + Math.pow(progress, 0.55) * 9.5;
        agniBlastWaveRef.current.scale.set(wScale, wScale, wScale);
        agniBlastWaveMatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.6) * 0.95);
      }
    }

    // 2b. Vayu Astra Supersonic Mach Vapor Cone, Piercing Needle & Shock Discs Animations
    if (astraType === 'vayu') {
      if (vayuMachConeRef.current && vayuMachConeMatRef.current) {
        const coneExp = 0.35 + Math.pow(progress, 0.4) * 4.8;
        vayuMachConeRef.current.scale.set(coneExp, coneExp, 1.0 + progress * 2.8);
        vayuMachConeMatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.4) * 0.85);
      }
      if (vayuNeedleRef.current && vayuNeedleMatRef.current) {
        const needleStretch = 1.0 + Math.pow(progress, 0.35) * 3.8;
        vayuNeedleRef.current.scale.set(Math.max(0.01, 1 - progress * 0.75), Math.max(0.01, 1 - progress * 0.75), needleStretch);
        vayuNeedleMatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.8) * 0.95);
      }
      if (vayuShockRing1Ref.current && vayuShockRing1MatRef.current) {
        const s1 = 0.3 + Math.pow(progress, 0.45) * 6.8;
        vayuShockRing1Ref.current.scale.set(s1, s1, s1);
        vayuShockRing1MatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.6) * 0.9);
      }
      if (vayuShockRing2Ref.current && vayuShockRing2MatRef.current) {
        const s2 = 0.2 + Math.pow(progress, 0.55) * 9.5;
        vayuShockRing2Ref.current.scale.set(s2, s2, s2);
        vayuShockRing2MatRef.current.opacity = Math.max(0, Math.pow(1 - progress, 1.7) * 0.75);
      }
    }

    // 2. Brahmashira Black Hole Accretion Disk, Lensing Spin & Gravitational Energy Waves
    if (isBrahmashira) {
      if (accretionDiskRef.current) {
        accretionDiskRef.current.rotation.z += 12.0 * delta;
        const breath = 1.0 + Math.sin(elapsed * 0.008) * 0.12;
        accretionDiskRef.current.scale.set(breath, breath, breath);
      }
      if (lensingRingRef.current) {
        lensingRingRef.current.rotation.x += 4.5 * delta;
        lensingRingRef.current.rotation.y += 3.2 * delta;
      }
      if (photonRingRef.current) {
        const pPulse = 1.0 + Math.sin(elapsed * 0.02) * 0.08;
        photonRingRef.current.scale.set(pPulse, pPulse, pPulse);
      }

      // Rhythmic expanding gravitational energy waves (matching the periodic damage pulses)
      const waveCycle1 = (elapsed % 1000) / 1000;
      const waveCycle2 = ((elapsed + 500) % 1000) / 1000;

      if (energyWaveRef1.current && energyWaveMat1.current) {
        const s1 = 1.35 + waveCycle1 * 13.0;
        energyWaveRef1.current.scale.set(s1, s1, s1);
        energyWaveMat1.current.opacity = Math.pow(1 - waveCycle1, 1.3) * 0.75 * (1 - progress * 0.4);
      }
      if (energyWaveRef2.current && energyWaveMat2.current) {
        const s2 = 1.35 + waveCycle2 * 13.0;
        energyWaveRef2.current.scale.set(s2, s2, s2);
        energyWaveMat2.current.opacity = Math.pow(1 - waveCycle2, 1.3) * 0.75 * (1 - progress * 0.4);
      }
    }

    // Primary Fast Shockwave Ring
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
        // Accelerate inward toward singularity center exponentially (Keplerian orbital spiral)
        for (let i = 0; i < sparkData.count; i++) {
          const c = sparkData.vortexCoords[i];
          if (!c) continue;
          const curR = Math.max(0.06, c.radius * Math.pow(1 - progress, 0.75));
          const angularSpeed = c.rotSpeed * (2.2 / Math.max(0.35, curR));
          const curA = c.angle + angularSpeed * (elapsed * 0.002);

          posArray[i * 3] = Math.cos(curA) * curR;
          posArray[i * 3 + 1] = c.yOffset * Math.pow(1 - progress, 0.85);
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
          // Debris gets sucked inward into singularity eye and disappears!
          child.position.lerp(new THREE.Vector3(0, 0, 0), delta * 3.5);
          child.rotation.x += data.rotSpeed.x * delta * 3;
          child.rotation.y += data.rotSpeed.y * delta * 3;
          child.rotation.z += data.rotSpeed.z * delta * 3;
          const shrink = Math.max(0.001, Math.pow(1 - progress, 1.8));
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

      {/* Cosmic Singularity Void Core (Astrophysical Kerr Black Hole for Brahmashira) */}
      {isBrahmashira ? (
        <group quaternion={normalQuat}>
          {/* 1. Pure Pitch-Black Void Sphere (Event Horizon, radius 1.35) */}
          <mesh>
            <sphereGeometry args={[1.35, 36, 36]} />
            <meshBasicMaterial color="#000000" depthWrite={true} />
          </mesh>

          {/* 2. Brilliant Razor-Sharp Photon Sphere Boundary Ring */}
          <mesh ref={photonRingRef}>
            <ringGeometry args={[1.34, 1.55, 64]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.95}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 3. Primary Massive Equatorial Accretion Disk (radius 6.8 units) */}
          <mesh ref={accretionDiskRef} rotation={[0.45, 0.2, 0]}>
            <ringGeometry args={[1.45, 6.8, 64]} />
            <meshBasicMaterial
              color="#ec4899"
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 4. Secondary Gravitational Lensing Halo (Warped Arcing Ring) */}
          <mesh ref={lensingRingRef} rotation={[Math.PI * 0.45, 0, 0.35]}>
            <ringGeometry args={[1.4, 5.2, 64]} />
            <meshBasicMaterial
              color="#818cf8"
              transparent
              opacity={0.65}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 5. Deep Cosmic Violet Outer Disk Fringe (radius 8.5 units) */}
          <mesh rotation={[-0.3, 0.45, 0]}>
            <ringGeometry args={[1.5, 8.5, 64]} />
            <meshBasicMaterial
              color="#c084fc"
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 6. Dual Relativistic Polar Plasma Jets */}
          <mesh position={[0, 0, 2.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.55, 4.4, 16]} />
            <meshBasicMaterial
              color="#f472b6"
              transparent
              opacity={0.65}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0, -2.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.55, 4.4, 16]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.65}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 7. Concentric Rhythmic Gravitational Energy Waves */}
          <mesh ref={energyWaveRef1}>
            <ringGeometry args={[1.0, 1.45, 64]} />
            <meshBasicMaterial
              ref={energyWaveMat1}
              color="#c084fc"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={energyWaveRef2}>
            <ringGeometry args={[1.0, 1.45, 64]} />
            <meshBasicMaterial
              ref={energyWaveMat2}
              color="#38bdf8"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : astraType === 'agni' ? (
        /* Agni Astra Thermonuclear Solar Detonation Explosion */
        <group quaternion={normalQuat}>
          {/* 1. White-Hot Incandescent Solar Core Sphere */}
          <mesh ref={agniCoreRef} position={[0, 0, 0.2]}>
            <sphereGeometry args={[0.95, 28, 28]} />
            <meshBasicMaterial
              ref={agniCoreMatRef}
              color="#fffbeb"
              transparent
              opacity={1}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 2. Turbulent Outer Fireball Flame Mantle */}
          <mesh ref={agniFireMantleRef} position={[0, 0, 0.35]}>
            <dodecahedronGeometry args={[1.3, 1]} />
            <meshStandardMaterial
              ref={agniFireMantleMatRef}
              color="#f97316"
              emissive="#dc2626"
              emissiveIntensity={4.2}
              transparent
              opacity={0.88}
              roughness={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 3. Expanding Scorching Secondary Blast Wave Ring */}
          <mesh ref={agniBlastWaveRef}>
            <ringGeometry args={[0.85, 1.55, 48]} />
            <meshBasicMaterial
              ref={agniBlastWaveMatRef}
              color="#f97316"
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : astraType === 'vayu' ? (
        /* Vayu Astra Supersonic Tempest Shockwave & Hyper-Velocity Mach Jet */
        <group quaternion={normalQuat}>
          {/* 1. Aerodynamic Supersonic Prandtl-Glauert Mach Vapor Cone */}
          <mesh ref={vayuMachConeRef} position={[0, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[1.6, 3.4, 32, 1, true]} />
            <meshBasicMaterial
              ref={vayuMachConeMatRef}
              color="#6ee7b7"
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 2. Razor-Sharp Kinetic Lancet Needle Core */}
          <mesh ref={vayuNeedleRef} position={[0, 0, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.38, 4.8, 16]} />
            <meshBasicMaterial
              ref={vayuNeedleMatRef}
              color="#ffffff"
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 3. Primary High-Velocity Emerald Toroidal Shock Disc */}
          <mesh ref={vayuShockRing1Ref} position={[0, 0, 0.2]}>
            <ringGeometry args={[0.35, 0.75, 48]} />
            <meshBasicMaterial
              ref={vayuShockRing1MatRef}
              color="#10b981"
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 4. Secondary Outer Atmospheric Compression Disc */}
          <mesh ref={vayuShockRing2Ref} position={[0, 0, 0.4]}>
            <ringGeometry args={[0.55, 1.05, 48]} />
            <meshBasicMaterial
              ref={vayuShockRing2MatRef}
              color="#a7f3d0"
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : (
        /* Inner High-Energy Core Flash for Astral */
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
