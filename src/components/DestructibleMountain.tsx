import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { COLLISION_GROUPS, ASTRA_CONFIGS, MOUNTAIN_TYPES } from '../types/game';
import type { FracturedPieceConfig, MountainStats, AstraType, MountainMaterialProfile, MountainMaterialType } from '../types/game';

export interface ActiveVortex {
  id: number;
  center: [number, number, number];
  startTime: number;
  duration: number;
  radius: number;
  strength: number;
}

interface DestructibleMountainProps {
  materialType?: MountainMaterialType;
  onStatsChange?: (stats: MountainStats) => void;
  onImpact?: (impact: {
    position: [number, number, number];
    normal: [number, number, number];
    color: string;
    isCore?: boolean;
    intensity: number;
    astraType?: AstraType;
    materialType?: MountainMaterialType;
  }) => void;
}

// Generate pre-fractured pieces floating in space across the cosmic chasm (at Z = -50, elevated at Y = 10.0, 2.2x scale: ~25x24x18 units)
export function generateMountainPieces(materialType: MountainMaterialType = 'Basalt'): FracturedPieceConfig[] {
  const pieces: FracturedPieceConfig[] = [];
  const SCALE = 2.2; // Massive 2.2x scale spanning ~25w x 24h x 18d
  const centerZ = -50; // Elevated deeper across cosmic chasm (~52 units from bow)
  const centerY = 10.0; // Elevated above island plane

  const matConfig = MOUNTAIN_TYPES[materialType] || MOUNTAIN_TYPES.Basalt;
  const mountainMat = matConfig.profile;
  const palette = matConfig.palette;

  const addPiece = (
    id: string,
    tier: 'foundation' | 'mid' | 'peak' | 'core',
    relPos: [number, number, number],
    baseScale: [number, number, number],
    rotation: [number, number, number],
    baseMass: number,
    color: string,
    emissiveColor: string,
    emissiveIntensity: number,
    shapeType: FracturedPieceConfig['shapeType'],
    material: MountainMaterialProfile,
    customThresholdMultiplier: number,
    isCore = false
  ) => {
    // RigidBody mass scaled by material density
    const calcMass = baseMass * SCALE * (material.density / 10.0);
    // Base threshold dynamically scaled to the chosen material's toughness
    const dynamicThreshold = Math.round(140 * material.toughness * customThresholdMultiplier);

    pieces.push({
      id,
      tier,
      position: [
        relPos[0] * SCALE,
        centerY + relPos[1] * SCALE,
        centerZ + relPos[2] * SCALE,
      ],
      scale: [
        baseScale[0] * SCALE,
        baseScale[1] * SCALE,
        baseScale[2] * SCALE,
      ],
      rotation,
      mass: calcMass,
      friction: material.name === 'Crystal' ? 0.35 : material.name === 'Iron-Core' ? 0.45 : 0.8,
      restitution: material.restitution,
      linearDamping: 0.2,
      angularDamping: 0.5,
      color,
      emissiveColor,
      emissiveIntensity: emissiveIntensity * palette.emissiveIntensityMultiplier,
      metalness: palette.metalness,
      roughness: palette.roughness,
      shapeType,
      material,
      fractureThreshold: dynamicThreshold,
      isCore,
    });
  };

  // --- TIER 1: Lower Bedrock Foundation (Heavy Base Armor) ---
  const fColor = palette.foundation;
  const fEmissive = palette.foundationEmissive;
  const fMass = 6.0;

  addPiece('f_left', 'foundation', [-3.2, -1.8, 0.0], [2.2, 1.8, 2.2], [0.05, 0.2, -0.05], fMass, fColor, fEmissive, 0.25, 'boulder', mountainMat, 1.05);
  addPiece('f_front_l', 'foundation', [-1.2, -1.8, 0.8], [2.1, 1.8, 2.0], [-0.02, 0.1, 0.03], fMass, fColor, fEmissive, 0.25, 'slab', mountainMat, 1.0);
  addPiece('f_front_r', 'foundation', [1.2, -1.8, 0.8], [2.1, 1.8, 2.0], [0.03, -0.15, -0.02], fMass, fColor, fEmissive, 0.25, 'slab', mountainMat, 1.0);
  addPiece('f_right', 'foundation', [3.2, -1.8, 0.0], [2.2, 1.8, 2.2], [-0.04, -0.2, 0.04], fMass, fColor, fEmissive, 0.25, 'boulder', mountainMat, 1.05);
  addPiece('f_back_l', 'foundation', [-2.0, -1.8, -1.5], [2.2, 1.8, 2.2], [0.02, 0.3, 0.05], fMass + 1.0, fColor, fEmissive, 0.2, 'pillar', mountainMat, 1.1);
  addPiece('f_back_c', 'foundation', [0.0, -1.8, -2.0], [2.4, 1.8, 2.2], [-0.05, 0.0, 0.0], fMass + 1.5, fColor, fEmissive, 0.2, 'slab', mountainMat, 1.15);
  addPiece('f_back_r', 'foundation', [2.0, -1.8, -1.5], [2.2, 1.8, 2.2], [-0.02, -0.3, -0.05], fMass + 1.0, fColor, fEmissive, 0.2, 'pillar', mountainMat, 1.1);
  addPiece('f_keystone', 'foundation', [0.0, -3.2, -0.2], [2.6, 2.2, 2.6], [Math.PI, 0.2, 0], fMass + 2.0, fColor, fEmissive, 0.2, 'peak', mountainMat, 1.25);
  addPiece('f_buttress_l', 'foundation', [-2.4, -3.0, 0.6], [1.9, 1.8, 1.9], [0.1, 0.2, -0.1], fMass + 1.0, fColor, fEmissive, 0.2, 'boulder', mountainMat, 1.05);
  addPiece('f_buttress_r', 'foundation', [2.4, -3.0, 0.6], [1.9, 1.8, 1.9], [-0.1, -0.2, 0.1], fMass + 1.0, fColor, fEmissive, 0.2, 'boulder', mountainMat, 1.05);

  // --- INNER CELESTIAL CORE (Heart of the Mountain Material) ---
  addPiece(
    'celestial_core',
    'core',
    [0.0, 0.5, 0.0],
    [1.4, 1.9, 1.4],
    [0.1, 0.4, 0.2],
    5.0,
    palette.core,
    palette.coreEmissive,
    2.8,
    'crystal_shard',
    mountainMat,
    1.4,
    true
  );

  // --- TIER 2: Mid Mountain Outer Shell & Armor Matrix ---
  const mColor = palette.mid;
  const mEmissive = palette.midEmissive;
  const mMass = 4.0;

  addPiece('m_shield_l', 'mid', [-1.8, 0.2, 1.2], [1.8, 1.7, 1.6], [0.06, 0.25, -0.04], mMass, mColor, mEmissive, 0.4, 'boulder', mountainMat, 0.75);
  addPiece('m_shield_c', 'mid', [0.0, 0.2, 1.8], [1.9, 1.7, 1.5], [-0.04, 0.0, 0.02], mMass + 0.5, mColor, mEmissive, 0.5, 'slab', mountainMat, 0.85);
  addPiece('m_shield_r', 'mid', [1.8, 0.2, 1.2], [1.8, 1.7, 1.6], [-0.06, -0.25, 0.04], mMass, mColor, mEmissive, 0.4, 'boulder', mountainMat, 0.75);
  addPiece('m_flank_l', 'mid', [-2.6, 0.2, -0.2], [1.8, 1.7, 1.8], [0.03, 0.35, 0.06], mMass, mColor, mEmissive, 0.35, 'pillar', mountainMat, 0.8);
  addPiece('m_flank_r', 'mid', [2.6, 0.2, -0.2], [1.8, 1.7, 1.8], [-0.03, -0.35, -0.06], mMass, mColor, mEmissive, 0.35, 'pillar', mountainMat, 0.8);
  addPiece('m_back_l', 'mid', [-1.6, 0.2, -1.8], [1.8, 1.7, 1.8], [0.05, 0.45, 0.02], mMass, mColor, mEmissive, 0.3, 'boulder', mountainMat, 0.75);
  addPiece('m_back_c', 'mid', [0.0, 0.2, -2.2], [2.0, 1.7, 1.8], [-0.05, 0.0, 0.0], mMass, mColor, mEmissive, 0.3, 'slab', mountainMat, 0.85);
  addPiece('m_back_r', 'mid', [1.6, 0.2, -1.8], [1.8, 1.7, 1.8], [-0.05, -0.45, -0.02], mMass, mColor, mEmissive, 0.3, 'boulder', mountainMat, 0.75);
  addPiece('m_matrix_fl', 'mid', [-1.1, 1.2, 1.3], [1.6, 1.4, 1.5], [0.04, 0.15, -0.03], mMass - 0.5, mColor, mEmissive, 0.45, 'slab', mountainMat, 0.7);
  addPiece('m_matrix_fr', 'mid', [1.1, 1.2, 1.3], [1.6, 1.4, 1.5], [-0.04, -0.15, 0.03], mMass - 0.5, mColor, mEmissive, 0.45, 'slab', mountainMat, 0.7);
  addPiece('m_matrix_bl', 'mid', [-1.1, 1.2, -1.4], [1.6, 1.4, 1.5], [0.03, 0.2, 0.04], mMass - 0.5, mColor, mEmissive, 0.4, 'slab', mountainMat, 0.75);
  addPiece('m_matrix_br', 'mid', [1.1, 1.2, -1.4], [1.6, 1.4, 1.5], [-0.03, -0.2, -0.04], mMass - 0.5, mColor, mEmissive, 0.4, 'slab', mountainMat, 0.75);

  // --- TIER 3: Upper Slopes & Ridge Shoulders ---
  const uColor = palette.peak;
  const uEmissive = palette.peakEmissive;
  const uMass = 2.5;

  addPiece('u_front_l', 'mid', [-1.2, 2.0, 0.6], [1.5, 1.5, 1.5], [0.08, 0.15, -0.06], uMass, uColor, uEmissive, 0.55, 'boulder', mountainMat, 0.55);
  addPiece('u_front_r', 'mid', [1.2, 2.0, 0.6], [1.5, 1.5, 1.5], [-0.08, -0.15, 0.06], uMass, uColor, uEmissive, 0.55, 'boulder', mountainMat, 0.55);
  addPiece('u_center', 'mid', [0.0, 2.2, -0.2], [1.6, 1.6, 1.6], [0.02, 0.3, 0.0], uMass + 0.5, uColor, uEmissive, 0.7, 'slab', mountainMat, 0.6);
  addPiece('u_back_l', 'mid', [-1.0, 2.0, -1.2], [1.5, 1.5, 1.5], [0.04, 0.5, 0.03], uMass, uColor, uEmissive, 0.5, 'boulder', mountainMat, 0.55);
  addPiece('u_back_r', 'mid', [1.0, 2.0, -1.2], [1.5, 1.5, 1.5], [-0.04, -0.5, -0.03], uMass, uColor, uEmissive, 0.5, 'boulder', mountainMat, 0.55);
  addPiece('u_crest_l', 'mid', [-0.7, 2.7, 0.3], [1.3, 1.3, 1.3], [0.06, 0.1, -0.04], uMass - 0.5, uColor, uEmissive, 0.6, 'boulder', mountainMat, 0.45);
  addPiece('u_crest_r', 'mid', [0.7, 2.7, 0.3], [1.3, 1.3, 1.3], [-0.06, -0.1, 0.04], uMass - 0.5, uColor, uEmissive, 0.6, 'boulder', mountainMat, 0.45);

  // --- TIER 4: Mountain Peaks & Apex Spire ---
  const pColor = palette.peak;
  const pEmissive = palette.peakEmissive;

  addPiece('p_left', 'peak', [-0.6, 3.6, 0.0], [1.2, 1.4, 1.2], [0.05, 0.2, -0.04], 1.6, pColor, pEmissive, 0.8, 'boulder', mountainMat, 0.38);
  addPiece('p_right', 'peak', [0.6, 3.6, 0.0], [1.2, 1.4, 1.2], [-0.05, -0.2, 0.04], 1.6, pColor, pEmissive, 0.8, 'boulder', mountainMat, 0.38);
  addPiece('p_summit', 'peak', [0.0, 5.0, 0.0], [1.0, 1.9, 1.0], [0.03, 0.1, -0.03], 1.0, pColor, pEmissive, 1.1, 'peak', mountainMat, 0.32);
  addPiece('p_spire', 'peak', [0.0, 6.2, 0.0], [0.6, 1.5, 0.6], [0.02, 0.15, -0.02], 0.8, palette.core, palette.coreEmissive, 1.4, 'peak', mountainMat, 0.28);

  return pieces;
}

// Individual Fractured Piece
function MountainPiece({
  config,
  isDislodged,
  impulse,
  vortices,
  onDislodge,
  onPieceImpact,
  onDespawn,
}: {
  config: FracturedPieceConfig;
  isDislodged: boolean;
  impulse?: [number, number, number];
  vortices?: ActiveVortex[];
  onDislodge: (
    id: string,
    contactPoint: [number, number, number],
    impulse?: [number, number, number],
    astraType?: AstraType
  ) => void;
  onPieceImpact?: (
    contactPoint: [number, number, number],
    normal: [number, number, number],
    isCore: boolean,
    color: string,
    intensity: number,
    astraType?: AstraType,
    hitMaterial?: MountainMaterialType
  ) => void;
  onDespawn?: (id: string) => void;
}) {
  const rbRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const isDespawningRef = useRef(false);
  const lastImpactTimeRef = useRef(0);
  const pendingImpulseRef = useRef<[number, number, number] | null>(null);
  const hasAppliedImpulseRef = useRef(false);
  const accumulatedDamageRef = useRef(0);
  const [stressFlash, setStressFlash] = useState(0);

  const geometry = useMemo(() => {
    switch (config.shapeType) {
      case 'crystal_shard':
        return new THREE.OctahedronGeometry(0.85, 0);
      case 'boulder':
        return new THREE.DodecahedronGeometry(0.8, 0);
      case 'pillar':
        return new THREE.CylinderGeometry(0.7, 0.85, 1.2, 6);
      case 'peak':
        return new THREE.ConeGeometry(0.75, 1.4, 5);
      case 'slab':
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }, [config.shapeType]);

  // Monitor piece falling out of bounds and apply vortex attraction
  useFrame((_, delta) => {
    if (!isDislodged || !rbRef.current || isDespawningRef.current) return;
    try {
      const pos = rbRef.current.translation();

      // Continuous Singularity Vortex Suction & Swirl Physics
      if (vortices && vortices.length > 0) {
        const now = performance.now();
        for (const v of vortices) {
          const age = now - v.startTime;
          if (age > v.duration) continue;
          const dx = v.center[0] - pos.x;
          const dy = v.center[1] - pos.y;
          const dz = v.center[2] - pos.z;
          const dist = Math.hypot(dx, dy, dz);

          if (dist < v.radius && dist > 0.05) {
            const invDist = 1 / dist;
            const progress = age / v.duration;
            // Inward gravitational suction force pulling stones toward singularity core
            const pullForce = v.strength * Math.pow(1 - progress, 0.4);
            // Tangential vortex orbital swirl around the singularity eye
            const swirlForce = 24 * (1 - progress);

            const fx = (dx * invDist) * pullForce + (-dz * invDist) * swirlForce;
            // Upward lift to counteract natural gravity and keep stones trapped floating in the vortex!
            const fy = (dy * invDist) * pullForce + 10.5 * (1 - progress);
            const fz = (dz * invDist) * pullForce + (dx * invDist) * swirlForce;

            const vel = rbRef.current.linvel();
            // Dampen outward escape momentum and pull into swirling orbit!
            rbRef.current.setLinvel(
              {
                x: vel.x * 0.91 + fx * delta,
                y: vel.y * 0.91 + fy * delta,
                z: vel.z * 0.91 + fz * delta,
              },
              true
            );

            // Orbiting rotational tumble
            rbRef.current.applyTorqueImpulse(
              {
                x: -dz * 0.06,
                y: 0.22,
                z: dx * 0.06,
              },
              true
            );
          }
        }
      }

      // Smoothly shrink piece as it plunges past the abyss edge toward Y = -15
      if (pos.y < -5 && meshRef.current) {
        const shrink = Math.max(0.01, 1.0 - (-5 - pos.y) / 10);
        meshRef.current.scale.set(shrink, shrink, shrink);
      }

      // Objective 4: Automatically dispose of falling debris when Y < -15 or Z < -100
      if (pos.y < -15 || pos.z < -100 || Math.abs(pos.x) > 60) {
        isDespawningRef.current = true;
        onDespawn?.(config.id);
      }
    } catch {
      // ignore
    }

    if (stressFlash > 0.01) {
      setStressFlash((prev) => Math.max(0, prev - delta * 3.5));
    }
  });

  // Apply kinetic impulse & tumble torque upon becoming dynamic
  useEffect(() => {
    if (isDislodged && rbRef.current && !hasAppliedImpulseRef.current) {
      hasAppliedImpulseRef.current = true;
      const applied = impulse || pendingImpulseRef.current || [
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 4,
        -18 - Math.random() * 8,
      ];
      rbRef.current.wakeUp();
      rbRef.current.applyImpulse({ x: applied[0], y: applied[1], z: applied[2] }, true);
      rbRef.current.applyTorqueImpulse(
        {
          x: (Math.random() - 0.5) * 16,
          y: (Math.random() - 0.5) * 16,
          z: (Math.random() - 0.5) * 16,
        },
        true
      );
    }
  }, [isDislodged, impulse]);

  const handleCollision = useCallback(
    (e: any) => {
      // Throttle rapid repeated impacts on the exact same piece
      const now = performance.now();
      if (now - lastImpactTimeRef.current < 80) return;

      const otherObject = e.other?.rigidBodyObject;
      const otherBody = e.other?.rigidBody;
      const otherUserData = otherBody?.userData as {
        type?: string;
        astraType?: AstraType;
        impactSpeed?: number;
        impactVel?: [number, number, number];
      } | undefined;

      const isArrowHit =
        otherUserData?.type === 'arrow' ||
        otherObject?.name === 'arrow' ||
        (otherBody && otherBody.mass() <= 2.0);

      if (isArrowHit) {
        lastImpactTimeRef.current = now;
        const astraType = (otherUserData?.astraType as AstraType) || 'astral';
        const astraConf = ASTRA_CONFIGS[astraType] || ASTRA_CONFIGS.astral;
        const arrowVel = otherBody?.linvel();
        const material = config.material;

        // 1. Calculate Real Kinetic Impact Energy using pre-collision velocity
        const recordedSpeed = otherUserData?.impactSpeed;
        const measuredSpeed = arrowVel ? Math.hypot(arrowVel.x, arrowVel.y, arrowVel.z) : 55;
        const impactSpeed = recordedSpeed && recordedSpeed > 20 ? recordedSpeed : Math.max(50, measuredSpeed);
        const arrowMass = otherBody ? otherBody.mass() : 1.5;
        let impactEnergy = impactSpeed * arrowMass;

        // 2. Material-Specific Interaction (Tuned for Basalt, Iron, and Crystal):
        if (material.name === 'Basalt') {
          // BASALT: Dense Volcanic Armor Bedrock
          if (astraType === 'agni') {
            impactEnergy *= 2.5; // High thermal detonation spalling
          } else if (astraType === 'vayu') {
            impactEnergy *= 1.45; // Hyper-velocity armor penetration
          } else if (astraType === 'astral') {
            impactEnergy *= 1.15; // Standard balanced piercing
          }
        } else if (material.name === 'Iron-Core') {
          // IRON: Ultra-Dense Heavy Metallic Matrix (Destroyed hardly; high deflection & yield strength)
          if (astraType === 'agni') {
            // Agni Astra: Thermal Softening & Rupture! Concentrated solar heat melts/ruptures the metallic weld
            impactEnergy *= 2.35;
          } else if (astraType === 'vayu') {
            // Vayu Astra: Focused kinetic pierce against heavy iron armor
            impactEnergy *= 1.25;
          } else if (astraType === 'astral') {
            // Astral Arrow: Standard kinetic arrow glances off heavy iron plate with metallic ricochet sparks
            impactEnergy *= 0.85; // Strong resistance to standard kinetic pierce
          }
        } else if (material.name === 'Crystal') {
          // CRYSTAL: Ultra-Hard Gem Lattice (Mohs 9+), Brittle to Thermal Shock, Deflects High-Speed Arrows
          if (astraType === 'agni') {
            // Agni Astra: Catastrophic Cleavage Fracture!
            // Extreme thermal gradient shatters crystal cleavage planes instantly
            impactEnergy *= 3.4; // Massive brittle thermal shattering multiplier
          } else if (astraType === 'vayu') {
            // Vayu Astra: Deflected by Hard Crystal Facets!
            // Streamlined high-velocity projectile is glanced/ricocheted off slick diamond-hard crystal faces
            impactEnergy *= 0.60; // High deflection resistance
          } else if (astraType === 'astral') {
            // Astral Arrow: Moderate celestial resonance
            impactEnergy *= 1.1;
          }
        } else if (material.name === 'Ductile-Stone') {
          // DUCTILE STONE: Porous Sedimentary Sandstone & Clay
          // Plastically deforms to absorb explosive blasts & blunt impacts, but vulnerable to high-velocity shear:
          if (astraType === 'vayu') {
            // Vayu Astra: Inertial Shear Penetration! (The hard counter to Ductile Stone)
            // Hyper-velocity projectile shears through porous sandstone before the rock has time to deform
            impactEnergy *= 1.85; // Massive shear penetration bonus
          } else if (astraType === 'agni') {
            // Agni Astra: Porous sandstone compacts and muffles thermal explosive shockwaves
            impactEnergy *= 1.15; // Heavily dampened thermal shock
          } else if (astraType === 'astral') {
            // Astral Arrow: Standard kinetic energy partially absorbed by clay matrix
            impactEnergy *= 0.95;
          }
        }

        // 3. Force Protection & Hardness Absorption:
        const hardnessAbsorptionRate =
          material.name === 'Crystal' && astraType === 'vayu'
            ? 0.45 // Crystal facets strongly deflect Vayu's streamlined kinetic tip!
            : material.name === 'Iron-Core'
            ? 0.32
            : material.name === 'Ductile-Stone'
            ? 0.16 // Low hardness: arrows penetrate deeply into soft sandstone
            : 0.22;
        const hardnessAbsorption = material.hardness * hardnessAbsorptionRate;
        const effectiveEnergy = impactEnergy * (1 - hardnessAbsorption);

        // Ductility buffer:
        // Ductile-Stone has 0.5 ductility! It absorbs +22 energy into plastic deformation cushion before cracking:
        const ductilityBuffer =
          material.name === 'Ductile-Stone'
            ? material.ductility * 44 // Absorbs up to 22 energy units into plastic compaction
            : material.ductility * (material.name === 'Iron-Core' ? 18 : 12);
        const dynamicFractureThreshold = (config.fractureThreshold ?? 60) + ductilityBuffer;

        // Trigger visual stress flash on impact
        setStressFlash(1.0);

        // 4. Cumulative Structural Damage Tracking:
        // Chunks remember damage from previous hits until their yield threshold is breached!
        accumulatedDamageRef.current += effectiveEnergy;
        const hasFractured =
          accumulatedDamageRef.current >= dynamicFractureThreshold ||
          effectiveEnergy >= dynamicFractureThreshold * 0.92 ||
          astraType === 'brahmashira';

        let contactPos: [number, number, number] = [
          config.position[0],
          config.position[1],
          config.position[2],
        ];
        let normal: [number, number, number] = [0, 0, 1];

        const recordedVel = otherUserData?.impactVel;
        if (recordedVel) {
          const inv = new THREE.Vector3(-recordedVel[0], -recordedVel[1], -recordedVel[2]).normalize();
          normal = [inv.x, inv.y, inv.z];
        } else if (arrowVel) {
          const inv = new THREE.Vector3(-arrowVel.x, -arrowVel.y, -arrowVel.z).normalize();
          normal = [inv.x, inv.y, inv.z];
        }

        if (otherBody) {
          try {
            const aPos = otherBody.translation();
            if (aPos) {
              contactPos = [aPos.x, aPos.y, aPos.z];
            }
          } catch {
            // fallback to config position
          }
        }

        const hitMatName = (config.material.name === 'Iron-Core' ? 'Iron' : config.material.name === 'Ductile-Stone' ? 'DuctileRock' : config.material.name) as MountainMaterialType;

        // 5. Kinetic Energy Threshold Check:
        // If cumulative damage hasn't yet breached the material threshold:
        if (!hasFractured && !isDislodged) {
          // Material-specific deflection spark colors:
          const deflectionColor =
            material.name === 'Crystal'
              ? '#e0f2fe' // Radiant diamond-white/cyan ricochet flash
              : material.name === 'Iron-Core'
              ? '#fbbf24' // Metallic golden ricochet sparks
              : material.name === 'Ductile-Stone'
              ? '#fb923c' // Warm terracotta/sandstone compaction dust flash
              : '#818cf8'; // Volcanic stone sparks
          const deflectionIntensity =
            material.name === 'Crystal'
              ? 0.95
              : material.name === 'Iron-Core'
              ? 0.75
              : material.name === 'Ductile-Stone'
              ? 0.45 // Soft, dampened compaction impact
              : 0.55;
          onPieceImpact?.(contactPos, normal, false, deflectionColor, deflectionIntensity, astraType, hitMatName);
          return;
        }

        // 6. Energy breached threshold: switch chunk to dynamic & apply kinetic impulse
        accumulatedDamageRef.current = 0;
        const baseImpulse = astraConf.impulseMultiplier;
        let impulseVector: [number, number, number];

        if (astraType === 'brahmashira') {
          // Brahmashira does NOT blast the struck stone away! It detaches it into the vortex!
          impulseVector = [0, 0.8, 0];
        } else {
          const flightDir = recordedVel
            ? new THREE.Vector3(...recordedVel).normalize()
            : (arrowVel && Math.hypot(arrowVel.x, arrowVel.y, arrowVel.z) > 1
                ? new THREE.Vector3(arrowVel.x, arrowVel.y, arrowVel.z).normalize()
                : new THREE.Vector3(0, 0.15, -1));

          // Ductility dampens violent jerk; brittle crystal pops sharply
          const brittlenessFactor = 1.0 + (1.0 - material.ductility) * (material.name === 'Crystal' ? 0.8 : 0.45);
          // Mass damping: Density 8.0 for ductile stone
          const massDamping = Math.min(1.8, 12.0 / material.density);
          const pushScalar = Math.min(3.2, Math.max(0.7, (effectiveEnergy / dynamicFractureThreshold) * brittlenessFactor)) * massDamping;

          impulseVector = [
            flightDir.x * impactSpeed * 0.40 * baseImpulse * pushScalar,
            (flightDir.y * impactSpeed * 0.40 + (material.name === 'Crystal' ? 5.5 : material.name === 'Ductile-Stone' ? 2.2 : 3.5)) * baseImpulse * pushScalar,
            flightDir.z * impactSpeed * 0.65 * baseImpulse * pushScalar,
          ];
        }

        pendingImpulseRef.current = impulseVector;

        // If piece was already dislodged and gets hit again, transfer kinetic momentum
        if (isDislodged && rbRef.current) {
          if (astraType !== 'brahmashira') {
            rbRef.current.applyImpulse(
              { x: impulseVector[0] * 0.6, y: impulseVector[1] * 0.6, z: impulseVector[2] * 0.6 },
              true
            );
          }
        }

        const intensity = (config.isCore ? 2.5 : 1.2) * astraConf.impulseMultiplier;
        onPieceImpact?.(contactPos, normal, !!config.isCore, astraConf.color, intensity, astraType, hitMatName);

        if (!isDislodged) {
          onDislodge(config.id, contactPos, impulseVector, astraType);
        }
      }
    },
    [config.color, config.fractureThreshold, config.id, config.isCore, config.material, config.position, isDislodged, onDislodge, onPieceImpact]
  );

  return (
    <RigidBody
      ref={rbRef}
      // Fixed in cosmic space until struck, then becomes dynamic and tumbles into the abyss!
      type={isDislodged ? 'dynamic' : 'fixed'}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      mass={config.mass}
      friction={config.friction}
      restitution={config.restitution}
      linearDamping={config.linearDamping}
      angularDamping={config.angularDamping}
      userData={{ type: 'destructible', id: config.id, isCore: config.isCore }}
      colliders={config.shapeType === 'slab' ? 'cuboid' : 'hull'}
      collisionGroups={interactionGroups(COLLISION_GROUPS.DESTRUCTIBLE, [
        COLLISION_GROUPS.ENVIRONMENT,
        COLLISION_GROUPS.PROJECTILE,
        COLLISION_GROUPS.DESTRUCTIBLE,
      ])}
      onCollisionEnter={handleCollision}
    >
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={config.color}
          emissive={stressFlash > 0.05 ? '#ffffff' : config.emissiveColor}
          emissiveIntensity={
            isDislodged
              ? config.emissiveIntensity * 1.5
              : config.emissiveIntensity + stressFlash * 2.8
          }
          roughness={config.roughness ?? 0.8}
          metalness={config.metalness ?? 0.15}
          flatShading={true}
        />
      </mesh>

      {/* Radiant celestial light from the Core */}
      {config.isCore && (
        <pointLight
          color={config.color}
          intensity={isDislodged ? 14 : 7}
          distance={20}
          decay={2}
        />
      )}
    </RigidBody>
  );
}

export function DestructibleMountain({
  materialType = 'Basalt',
  onStatsChange,
  onImpact,
}: DestructibleMountainProps) {
  const pieces = useMemo(() => generateMountainPieces(materialType), [materialType]);
  const [dislodgedMap, setDislodgedMap] = useState<Map<string, [number, number, number]>>(() => new Map());
  const [despawnedSet, setDespawnedSet] = useState<Set<string>>(() => new Set());
  const [vortices, setVortices] = useState<ActiveVortex[]>([]);

  // Periodically clean up expired singularity vortices
  useFrame(() => {
    if (vortices.length === 0) return;
    const now = performance.now();
    if (vortices.some((v) => now - v.startTime >= v.duration)) {
      setVortices((prev) => prev.filter((v) => now - v.startTime < v.duration));
    }
  });

  const handleDespawn = useCallback((id: string) => {
    setDespawnedSet((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handlePieceImpact = useCallback(
    (
      contactPos: [number, number, number],
      normal: [number, number, number],
      isCore: boolean,
      color: string,
      intensity: number,
      astraType?: AstraType,
      hitMaterial?: MountainMaterialType
    ) => {
      onImpact?.({
        position: contactPos,
        normal,
        isCore,
        color,
        intensity,
        astraType,
        materialType: hitMaterial || materialType,
      });
    },
    [onImpact, materialType]
  );

  const handleDislodge = useCallback(
    (
      id: string,
      contactPos: [number, number, number],
      impulse?: [number, number, number],
      astraType: AstraType = 'astral'
    ) => {
      const astraConf = ASTRA_CONFIGS[astraType] || ASTRA_CONFIGS.astral;

      if (astraType === 'brahmashira') {
        // Spawn active singularity gravitational vortex at contact position!
        const newVortex: ActiveVortex = {
          id: Date.now() + Math.random(),
          center: contactPos,
          startTime: performance.now(),
          duration: 2500, // 2.5s sustained gravitational vortex suction
          radius: 11.5,
          strength: 58,
        };
        setVortices((prev) => [...prev, newVortex]);
      }

      setDislodgedMap((prev) => {
        if (prev.has(id)) return prev;
        const next = new Map(prev);
        const directImpulse = astraType === 'brahmashira'
          ? ([0, 1.0, 0] as [number, number, number])
          : (impulse || [0, 4, -22]);
        next.set(id, directImpulse);

        if (astraType === 'brahmashira') {
          // Brahmashira Singularity: Detach surrounding pieces without explosive blasting,
          // allowing the continuous vortex suction to grab, lift, and swirl them inward!
          pieces.forEach((p) => {
            if (!next.has(p.id) && !p.isCore) {
              const dx = p.position[0] - contactPos[0];
              const dy = p.position[1] - contactPos[1];
              const dz = p.position[2] - contactPos[2];
              const dist = Math.hypot(dx, dy, dz);
              if (dist < 10.5) {
                const invDist = Math.max(0.1, dist);
                next.set(p.id, [
                  -(dx / invDist) * 2,
                  -(dy / invDist) * 1.5 + 1.2,
                  -(dz / invDist) * 2,
                ]);
              }
            }
          });
          return next;
        }

        // Standard / Agni / Vayu explosive dislodge (scaled for 2.2x mountain)
        const isCrystal = materialType === 'Crystal';
        const isDuctile = materialType === 'DuctileRock';
        const baseRadius = 5.2;
        const blastRadius =
          baseRadius *
          astraConf.blastRadiusMultiplier *
          (isCrystal && astraType === 'agni' ? 1.3 : isDuctile && astraType === 'agni' ? 0.75 : 1.0);
        // Crystal is extremely brittle against Agni thermal blast (92% cascade shatter chance);
        // Ductile sandstone compacts and muffles explosive blast waves (35% shatter chance),
        // but Vayu cleanly shears through ductile layers (65% shatter chance):
        const shatterChance =
          astraType === 'agni'
            ? (isCrystal ? 0.92 : isDuctile ? 0.35 : 0.80)
            : astraType === 'vayu'
            ? (isCrystal ? 0.20 : isDuctile ? 0.65 : 0.45)
            : 0.45;

        pieces.forEach((p) => {
          if (!next.has(p.id) && !p.isCore) {
            const dx = p.position[0] - contactPos[0];
            const dy = p.position[1] - contactPos[1];
            const dz = p.position[2] - contactPos[2];
            const dist = Math.hypot(dx, dy, dz);

            if (dist < blastRadius && Math.random() < shatterChance) {
              const invDist = Math.max(0.2, dist);
              const push = (18 / invDist) * astraConf.impulseMultiplier;
              const radialImpulse: [number, number, number] = [
                (dx / invDist) * push,
                (dy / invDist) * push + (astraType === 'agni' ? 10 : 5),
                (dz / invDist) * push - 10,
              ];
              next.set(p.id, radialImpulse);
            }
          }
        });

        return next;
      });
    },
    [pieces, materialType]
  );

  // Notify parent of updated destruction stats
  useEffect(() => {
    const total = pieces.length;
    const dislodged = dislodgedMap.size;
    const coreIntact = !dislodgedMap.has('celestial_core');

    onStatsChange?.({
      totalPieces: total,
      activePieces: total - dislodged,
      dislodgedPieces: dislodged,
      coreIntact,
    });
  }, [pieces.length, dislodgedMap, onStatsChange]);

  return (
    <group>
      {pieces.map((piece) => {
        if (despawnedSet.has(piece.id)) return null;
        return (
          <MountainPiece
            key={piece.id}
            config={piece}
            isDislodged={dislodgedMap.has(piece.id)}
            impulse={dislodgedMap.get(piece.id)}
            vortices={vortices}
            onDislodge={handleDislodge}
            onPieceImpact={handlePieceImpact}
            onDespawn={handleDespawn}
          />
        );
      })}
    </group>
  );
}
