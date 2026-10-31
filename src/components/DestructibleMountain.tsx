import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { COLLISION_GROUPS, ASTRA_CONFIGS, MOUNTAIN_TYPES } from '../types/game';
import type {
  FracturedPieceConfig,
  MountainStats,
  AstraType,
  MountainMaterialProfile,
  MountainMaterialType,
  MountainHealthState,
} from '../types/game';
import { initializeMountainHealth, calculateArrowImpactDamage } from '../types/game';

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

// Generate smaller, tightly-nested fractured pieces floating across the cosmic chasm (at Z = -50, elevated at Y = 10.0)
// Scaled down to ~0.55x-0.65x of previous monolithic blocks with ~47 faceted pieces for realistic fine-grained destruction
export function generateMountainPieces(materialType: MountainMaterialType = 'Basalt'): FracturedPieceConfig[] {
  const pieces: FracturedPieceConfig[] = [];
  const SCALE = 2.1; // Overall mountain envelope ~24w x 22h x 18d
  const centerZ = -50;
  const centerY = 10.0;

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
    const calcMass = baseMass * (material.density / 10.0);
    // Dynamic break threshold scaled to material toughness
    const dynamicThreshold = Math.round(100 * material.toughness * customThresholdMultiplier);

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

  // --- TIER 1: Lower Bedrock Foundation (14 smaller faceted base chunks) ---
  const fColor = palette.foundation;
  const fEmissive = palette.foundationEmissive;
  const fMass = 2.8;

  addPiece('f_left_1', 'foundation', [-3.4, -2.0, 0.2], [1.1, 0.95, 1.1], [0.08, 0.3, -0.05], fMass, fColor, fEmissive, 0.2, 'boulder', mountainMat, 1.0);
  addPiece('f_left_2', 'foundation', [-2.6, -1.9, -0.8], [1.15, 0.95, 1.05], [-0.04, 0.15, 0.06], fMass, fColor, fEmissive, 0.2, 'slab', mountainMat, 1.0);
  addPiece('f_fl_1', 'foundation', [-1.6, -1.9, 1.0], [1.05, 0.95, 1.0], [0.03, -0.2, 0.04], fMass, fColor, fEmissive, 0.2, 'slab', mountainMat, 0.95);
  addPiece('f_fl_2', 'foundation', [-0.6, -1.9, 1.3], [1.1, 0.95, 1.05], [-0.05, 0.1, -0.02], fMass, fColor, fEmissive, 0.2, 'boulder', mountainMat, 0.95);
  addPiece('f_fr_1', 'foundation', [0.6, -1.9, 1.3], [1.1, 0.95, 1.05], [0.05, -0.1, 0.02], fMass, fColor, fEmissive, 0.2, 'boulder', mountainMat, 0.95);
  addPiece('f_fr_2', 'foundation', [1.6, -1.9, 1.0], [1.05, 0.95, 1.0], [-0.03, 0.2, -0.04], fMass, fColor, fEmissive, 0.2, 'slab', mountainMat, 0.95);
  addPiece('f_right_1', 'foundation', [2.6, -1.9, -0.8], [1.15, 0.95, 1.05], [0.04, -0.15, -0.06], fMass, fColor, fEmissive, 0.2, 'slab', mountainMat, 1.0);
  addPiece('f_right_2', 'foundation', [3.4, -2.0, 0.2], [1.1, 0.95, 1.1], [-0.08, -0.3, 0.05], fMass, fColor, fEmissive, 0.2, 'boulder', mountainMat, 1.0);
  addPiece('f_bl_1', 'foundation', [-2.2, -2.0, -1.7], [1.1, 1.0, 1.1], [0.02, 0.4, 0.05], fMass + 0.4, fColor, fEmissive, 0.2, 'pillar', mountainMat, 1.05);
  addPiece('f_bc_1', 'foundation', [-0.9, -2.0, -2.1], [1.2, 1.0, 1.1], [-0.03, 0.1, 0.0], fMass + 0.5, fColor, fEmissive, 0.2, 'slab', mountainMat, 1.1);
  addPiece('f_bc_2', 'foundation', [0.9, -2.0, -2.1], [1.2, 1.0, 1.1], [0.03, -0.1, 0.0], fMass + 0.5, fColor, fEmissive, 0.2, 'slab', mountainMat, 1.1);
  addPiece('f_br_1', 'foundation', [2.2, -2.0, -1.7], [1.1, 1.0, 1.1], [-0.02, -0.4, -0.05], fMass + 0.4, fColor, fEmissive, 0.2, 'pillar', mountainMat, 1.05);
  addPiece('f_keystone', 'foundation', [0.0, -3.0, -0.2], [1.4, 1.2, 1.4], [Math.PI, 0.1, 0], fMass + 1.0, fColor, fEmissive, 0.2, 'peak', mountainMat, 1.2);
  addPiece('f_buttress', 'foundation', [0.0, -2.2, 0.7], [1.3, 1.0, 1.2], [0.1, 0.0, 0.0], fMass + 0.5, fColor, fEmissive, 0.2, 'slab', mountainMat, 1.0);

  // --- INNER CELESTIAL CORE (Heart of the Mountain Material) ---
  addPiece(
    'celestial_core',
    'core',
    [0.0, 0.4, 0.0],
    [0.9, 1.2, 0.9],
    [0.1, 0.4, 0.2],
    3.2,
    palette.core,
    palette.coreEmissive,
    2.6,
    'crystal_shard',
    mountainMat,
    1.35,
    true
  );

  // --- TIER 2: Mid Mountain Outer Shell & Faceted Armor (17 smaller chunks) ---
  const mColor = palette.mid;
  const mEmissive = palette.midEmissive;
  const mMass = 2.0;

  addPiece('m_shield_fl', 'mid', [-1.3, 0.1, 1.2], [1.05, 0.95, 0.95], [0.05, 0.2, -0.03], mMass, mColor, mEmissive, 0.35, 'boulder', mountainMat, 0.75);
  addPiece('m_shield_fc', 'mid', [0.0, 0.1, 1.5], [1.1, 0.95, 0.9], [-0.04, 0.0, 0.02], mMass + 0.2, mColor, mEmissive, 0.4, 'slab', mountainMat, 0.8);
  addPiece('m_shield_fr', 'mid', [1.3, 0.1, 1.2], [1.05, 0.95, 0.95], [-0.05, -0.2, 0.03], mMass, mColor, mEmissive, 0.35, 'boulder', mountainMat, 0.75);
  addPiece('m_flank_l1', 'mid', [-2.3, 0.1, 0.4], [1.0, 0.95, 1.0], [0.04, 0.3, 0.05], mMass, mColor, mEmissive, 0.3, 'pillar', mountainMat, 0.75);
  addPiece('m_flank_l2', 'mid', [-2.4, 0.1, -0.6], [1.0, 0.95, 1.0], [-0.02, 0.35, -0.04], mMass, mColor, mEmissive, 0.3, 'boulder', mountainMat, 0.75);
  addPiece('m_flank_r1', 'mid', [2.3, 0.1, 0.4], [1.0, 0.95, 1.0], [-0.04, -0.3, -0.05], mMass, mColor, mEmissive, 0.3, 'pillar', mountainMat, 0.75);
  addPiece('m_flank_r2', 'mid', [2.4, 0.1, -0.6], [1.0, 0.95, 1.0], [0.02, -0.35, 0.04], mMass, mColor, mEmissive, 0.3, 'boulder', mountainMat, 0.75);
  addPiece('m_back_l', 'mid', [-1.4, 0.1, -1.6], [1.05, 0.95, 1.0], [0.04, 0.4, 0.02], mMass, mColor, mEmissive, 0.3, 'boulder', mountainMat, 0.75);
  addPiece('m_back_c', 'mid', [0.0, 0.1, -1.8], [1.15, 0.95, 1.0], [-0.04, 0.0, 0.0], mMass, mColor, mEmissive, 0.3, 'slab', mountainMat, 0.8);
  addPiece('m_back_r', 'mid', [1.4, 0.1, -1.6], [1.05, 0.95, 1.0], [-0.04, -0.4, -0.02], mMass, mColor, mEmissive, 0.3, 'boulder', mountainMat, 0.75);
  addPiece('m_matrix_fl', 'mid', [-0.9, 1.0, 0.9], [0.95, 0.9, 0.9], [0.03, 0.15, -0.02], mMass - 0.3, mColor, mEmissive, 0.4, 'slab', mountainMat, 0.65);
  addPiece('m_matrix_fr', 'mid', [0.9, 1.0, 0.9], [0.95, 0.9, 0.9], [-0.03, -0.15, 0.02], mMass - 0.3, mColor, mEmissive, 0.4, 'slab', mountainMat, 0.65);
  addPiece('m_matrix_ml', 'mid', [-1.5, 1.0, 0.0], [0.95, 0.9, 0.95], [0.04, 0.25, 0.03], mMass - 0.3, mColor, mEmissive, 0.35, 'boulder', mountainMat, 0.7);
  addPiece('m_matrix_mr', 'mid', [1.5, 1.0, 0.0], [0.95, 0.9, 0.95], [-0.04, -0.25, -0.03], mMass - 0.3, mColor, mEmissive, 0.35, 'boulder', mountainMat, 0.7);
  addPiece('m_matrix_bl', 'mid', [-0.9, 1.0, -1.0], [0.95, 0.9, 0.9], [0.02, 0.2, 0.03], mMass - 0.3, mColor, mEmissive, 0.35, 'slab', mountainMat, 0.7);
  addPiece('m_matrix_br', 'mid', [0.9, 1.0, -1.0], [0.95, 0.9, 0.9], [-0.02, -0.2, -0.03], mMass - 0.3, mColor, mEmissive, 0.35, 'slab', mountainMat, 0.7);
  addPiece('m_matrix_top', 'mid', [0.0, 1.3, 0.2], [1.0, 0.85, 0.95], [0.01, 0.1, 0.0], mMass - 0.2, mColor, mEmissive, 0.45, 'slab', mountainMat, 0.65);

  // --- TIER 3: Upper Slopes & Ridge Shoulders (11 smaller faceted chunks) ---
  const uColor = palette.peak;
  const uEmissive = palette.peakEmissive;
  const uMass = 1.5;

  addPiece('u_front_l', 'mid', [-0.9, 2.0, 0.5], [0.9, 0.9, 0.9], [0.06, 0.15, -0.04], uMass, uColor, uEmissive, 0.5, 'boulder', mountainMat, 0.55);
  addPiece('u_front_c', 'mid', [0.0, 2.1, 0.7], [0.95, 0.9, 0.85], [-0.03, 0.0, 0.02], uMass, uColor, uEmissive, 0.55, 'slab', mountainMat, 0.55);
  addPiece('u_front_r', 'mid', [0.9, 2.0, 0.5], [0.9, 0.9, 0.9], [-0.06, -0.15, 0.04], uMass, uColor, uEmissive, 0.5, 'boulder', mountainMat, 0.55);
  addPiece('u_flank_l', 'mid', [-1.3, 1.9, -0.3], [0.85, 0.9, 0.85], [0.04, 0.3, 0.02], uMass - 0.2, uColor, uEmissive, 0.45, 'boulder', mountainMat, 0.5);
  addPiece('u_flank_r', 'mid', [1.3, 1.9, -0.3], [0.85, 0.9, 0.85], [-0.04, -0.3, -0.02], uMass - 0.2, uColor, uEmissive, 0.45, 'boulder', mountainMat, 0.5);
  addPiece('u_back_l', 'mid', [-0.7, 1.9, -1.0], [0.85, 0.9, 0.85], [0.03, 0.4, 0.02], uMass - 0.2, uColor, uEmissive, 0.45, 'boulder', mountainMat, 0.5);
  addPiece('u_back_c', 'mid', [0.0, 2.0, -1.1], [0.9, 0.9, 0.85], [-0.03, 0.0, 0.0], uMass - 0.2, uColor, uEmissive, 0.45, 'slab', mountainMat, 0.5);
  addPiece('u_back_r', 'mid', [0.7, 1.9, -1.0], [0.85, 0.9, 0.85], [-0.03, -0.4, -0.02], uMass - 0.2, uColor, uEmissive, 0.45, 'boulder', mountainMat, 0.5);
  addPiece('u_crest_l', 'mid', [-0.5, 2.7, 0.2], [0.8, 0.8, 0.8], [0.05, 0.1, -0.03], uMass - 0.4, uColor, uEmissive, 0.6, 'boulder', mountainMat, 0.45);
  addPiece('u_crest_c', 'mid', [0.0, 2.8, 0.3], [0.8, 0.8, 0.75], [0.0, 0.0, 0.0], uMass - 0.4, uColor, uEmissive, 0.65, 'slab', mountainMat, 0.45);
  addPiece('u_crest_r', 'mid', [0.5, 2.7, 0.2], [0.8, 0.8, 0.8], [-0.05, -0.1, 0.03], uMass - 0.4, uColor, uEmissive, 0.6, 'boulder', mountainMat, 0.45);

  // --- TIER 4: Mountain Peaks & Apex Spire (4 tapered jagged shards) ---
  const pColor = palette.peak;
  const pEmissive = palette.peakEmissive;

  addPiece('p_left', 'peak', [-0.45, 3.6, 0.0], [0.75, 0.95, 0.75], [0.04, 0.15, -0.03], 1.0, pColor, pEmissive, 0.8, 'boulder', mountainMat, 0.38);
  addPiece('p_right', 'peak', [0.45, 3.6, 0.0], [0.75, 0.95, 0.75], [-0.04, -0.15, 0.03], 1.0, pColor, pEmissive, 0.8, 'boulder', mountainMat, 0.38);
  addPiece('p_summit', 'peak', [0.0, 4.6, 0.0], [0.7, 1.2, 0.7], [0.02, 0.1, -0.02], 0.8, pColor, pEmissive, 1.1, 'peak', mountainMat, 0.32);
  addPiece('p_spire', 'peak', [0.0, 5.7, 0.0], [0.45, 1.1, 0.45], [0.02, 0.15, -0.02], 0.6, palette.core, palette.coreEmissive, 1.5, 'peak', mountainMat, 0.28);

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
  onDamage,
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
  onDamage?: (dmg: number) => void;
  onDespawn?: (id: string) => void;
}) {
  const rbRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const isDespawningRef = useRef(false);
  const lastImpactTimeRef = useRef(0);
  const pendingImpulseRef = useRef<[number, number, number] | null>(null);
  const hasAppliedImpulseRef = useRef(false);
  const accumulatedDamageRef = useRef(0);

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
            const pullForce = v.strength * Math.pow(1 - progress, 0.4);
            const swirlForce = 24 * (1 - progress);

            const fx = (dx * invDist) * pullForce + (-dz * invDist) * swirlForce;
            const fy = (dy * invDist) * pullForce + 10.5 * (1 - progress);
            const fz = (dz * invDist) * pullForce + (dx * invDist) * swirlForce;

            const vel = rbRef.current.linvel();
            rbRef.current.setLinvel(
              {
                x: vel.x * 0.91 + fx * delta,
                y: vel.y * 0.91 + fy * delta,
                z: vel.z * 0.91 + fz * delta,
              },
              true
            );

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

      // Automatically dispose of falling debris when Y < -15 or Z < -100
      if (pos.y < -15 || pos.z < -100 || Math.abs(pos.x) > 60) {
        isDespawningRef.current = true;
        onDespawn?.(config.id);
      }
    } catch {
      // ignore
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
      if (now - lastImpactTimeRef.current < 70) return;

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

        // 2. Compute Mountain Health Bar Damage via calculateArrowImpactDamage
        const dmg = calculateArrowImpactDamage(arrowMass, impactSpeed, material, astraType);
        onDamage?.(dmg);

        let impactEnergy = impactSpeed * arrowMass;

        // 3. Material-Specific Interaction (Tuned for Basalt, Iron, Crystal, Ductile):
        if (material.name === 'Basalt') {
          if (astraType === 'agni') impactEnergy *= 2.5;
          else if (astraType === 'vayu') impactEnergy *= 1.45;
          else if (astraType === 'astral') impactEnergy *= 1.15;
        } else if (material.name === 'Iron-Core') {
          if (astraType === 'agni') impactEnergy *= 2.35;
          else if (astraType === 'vayu') impactEnergy *= 1.25;
          else if (astraType === 'astral') impactEnergy *= 0.85;
        } else if (material.name === 'Crystal') {
          if (astraType === 'agni') impactEnergy *= 3.4;
          else if (astraType === 'vayu') impactEnergy *= 0.60;
          else if (astraType === 'astral') impactEnergy *= 1.1;
        } else if (material.name === 'Ductile-Stone') {
          if (astraType === 'vayu') impactEnergy *= 1.85;
          else if (astraType === 'agni') impactEnergy *= 1.15;
          else if (astraType === 'astral') impactEnergy *= 0.95;
        }

        // Force Protection & Hardness Absorption:
        const hardnessAbsorptionRate =
          material.name === 'Crystal' && astraType === 'vayu'
            ? 0.45
            : material.name === 'Iron-Core'
            ? 0.32
            : material.name === 'Ductile-Stone'
            ? 0.16
            : 0.22;
        const hardnessAbsorption = material.hardness * hardnessAbsorptionRate;
        const effectiveEnergy = impactEnergy * (1 - hardnessAbsorption);

        const ductilityBuffer =
          material.name === 'Ductile-Stone'
            ? material.ductility * 44
            : material.ductility * (material.name === 'Iron-Core' ? 18 : 12);
        const dynamicFractureThreshold = (config.fractureThreshold ?? 60) + ductilityBuffer;

        // Cumulative Structural Damage Tracking:
        accumulatedDamageRef.current += effectiveEnergy;
        const hasFractured =
          accumulatedDamageRef.current >= dynamicFractureThreshold ||
          effectiveEnergy >= dynamicFractureThreshold * 0.90 ||
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
            if (aPos) contactPos = [aPos.x, aPos.y, aPos.z];
          } catch {
            // fallback to config position
          }
        }

        const hitMatName = (config.material.name === 'Iron-Core'
          ? 'Iron'
          : config.material.name === 'Ductile-Stone'
          ? 'DuctileRock'
          : config.material.name) as MountainMaterialType;

        // If cumulative damage hasn't yet breached the material fracture threshold:
        if (!hasFractured && !isDislodged) {
          const deflectionColor =
            material.name === 'Crystal'
              ? '#e0f2fe'
              : material.name === 'Iron-Core'
              ? '#fbbf24'
              : material.name === 'Ductile-Stone'
              ? '#fb923c'
              : '#818cf8';
          const deflectionIntensity =
            material.name === 'Crystal'
              ? 0.95
              : material.name === 'Iron-Core'
              ? 0.75
              : material.name === 'Ductile-Stone'
              ? 0.45
              : 0.55;
          onPieceImpact?.(contactPos, normal, false, deflectionColor, deflectionIntensity, astraType, hitMatName);
          return;
        }

        // Energy breached threshold: switch chunk to dynamic & apply kinetic impulse
        accumulatedDamageRef.current = 0;
        const baseImpulse = astraConf.impulseMultiplier;
        let impulseVector: [number, number, number];

        if (astraType === 'brahmashira') {
          impulseVector = [0, 0.8, 0];
        } else {
          const flightDir = recordedVel
            ? new THREE.Vector3(...recordedVel).normalize()
            : (arrowVel && Math.hypot(arrowVel.x, arrowVel.y, arrowVel.z) > 1
                ? new THREE.Vector3(arrowVel.x, arrowVel.y, arrowVel.z).normalize()
                : new THREE.Vector3(0, 0.15, -1));

          const brittlenessFactor = 1.0 + (1.0 - material.ductility) * (material.name === 'Crystal' ? 0.8 : 0.45);
          const massDamping = Math.min(1.8, 12.0 / material.density);
          const pushScalar = Math.min(3.2, Math.max(0.7, (effectiveEnergy / dynamicFractureThreshold) * brittlenessFactor)) * massDamping;

          impulseVector = [
            flightDir.x * impactSpeed * 0.40 * baseImpulse * pushScalar,
            (flightDir.y * impactSpeed * 0.40 + (material.name === 'Crystal' ? 5.5 : material.name === 'Ductile-Stone' ? 2.2 : 3.5)) * baseImpulse * pushScalar,
            flightDir.z * impactSpeed * 0.65 * baseImpulse * pushScalar,
          ];
        }

        pendingImpulseRef.current = impulseVector;

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
    [config.color, config.fractureThreshold, config.id, config.isCore, config.material, config.position, isDislodged, onDamage, onDislodge, onPieceImpact]
  );

  return (
    <RigidBody
      ref={rbRef}
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
          emissive={config.emissiveColor}
          emissiveIntensity={
            isDislodged
              ? config.emissiveIntensity * 1.3
              : config.emissiveIntensity
          }
          roughness={config.roughness ?? 0.8}
          metalness={config.metalness ?? 0.15}
          flatShading={true}
        />
      </mesh>

      {/* Radiant celestial light from the Core */}
      {config.isCore && (
        <pointLight
          color={config.emissiveColor}
          intensity={3.5}
          distance={12}
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
  const [dislodgedMap, setDislodgedMap] = useState<Map<string, [number, number, number]>>(new Map());
  const [despawnedSet, setDespawnedSet] = useState<Set<string>>(new Set());
  const [vortices, setVortices] = useState<ActiveVortex[]>([]);

  // Mountain Health State Management
  const [healthState, setHealthState] = useState<MountainHealthState>(() =>
    initializeMountainHealth(materialType)
  );

  // Sync health pool when material profile changes
  useEffect(() => {
    setHealthState(initializeMountainHealth(materialType));
    setDislodgedMap(new Map());
    setDespawnedSet(new Set());
    setVortices([]);
  }, [materialType]);

  // Clean expired singularity vortices
  useFrame(() => {
    if (vortices.length === 0) return;
    const now = performance.now();
    setVortices((prev) => prev.filter((v) => now - v.startTime < v.duration));
  });

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

  const handleDamage = useCallback((dmg: number) => {
    setHealthState((prev) => {
      const nextHealth = Math.max(0, prev.currentHealth - dmg);
      return {
        ...prev,
        currentHealth: nextHealth,
        lastDamageTaken: dmg,
        lastDamageTime: performance.now(),
      };
    });
  }, []);

  // Catastrophic mountain collapse if health reaches 0
  useEffect(() => {
    if (healthState.currentHealth <= 0 && pieces.length > 0) {
      setDislodgedMap((prev) => {
        if (prev.size >= pieces.length) return prev;
        const next = new Map(prev);
        pieces.forEach((p) => {
          if (!next.has(p.id)) {
            next.set(p.id, [
              (Math.random() - 0.5) * 10,
              Math.random() * 5 + 2,
              -12 - Math.random() * 10,
            ]);
          }
        });
        return next;
      });
    }
  }, [healthState.currentHealth, pieces]);

  const handleDislodge = useCallback(
    (
      id: string,
      contactPos: [number, number, number],
      impulse?: [number, number, number],
      astraType: AstraType = 'astral'
    ) => {
      const astraConf = ASTRA_CONFIGS[astraType] || ASTRA_CONFIGS.astral;

      if (astraType === 'brahmashira') {
        const newVortex: ActiveVortex = {
          id: Date.now() + Math.random(),
          center: contactPos,
          startTime: performance.now(),
          duration: 2500,
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
          pieces.forEach((p) => {
            if (!next.has(p.id)) {
              const dx = p.position[0] - contactPos[0];
              const dy = p.position[1] - contactPos[1];
              const dz = p.position[2] - contactPos[2];
              const dist = Math.hypot(dx, dy, dz);
              if (dist < 11.5) {
                const invDist = Math.max(0.1, dist);
                next.set(p.id, [
                  -(dx / invDist) * 2,
                  -(dy / invDist) * 1.5 + 1.2,
                  -(dz / invDist) * 2,
                ]);
              }
            }
          });
        } else {
          // Standard / Agni / Vayu explosive dislodge
          const isCrystal = materialType === 'Crystal';
          const isDuctile = materialType === 'DuctileRock';
          const baseRadius = 5.2;
          const blastRadius =
            baseRadius *
            astraConf.blastRadiusMultiplier *
            (isCrystal && astraType === 'agni' ? 1.3 : isDuctile && astraType === 'agni' ? 0.75 : 1.0);

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
        }

        // Tightly couple health pool to physical fragment count:
        // As mountain pieces are dislodged or sucked into singularity, health pool proportionately drains!
        const total = pieces.length;
        const dislodgedCount = next.size;
        const remainingRatio = total > 0 ? Math.max(0, (total - dislodgedCount) / total) : 0;

        setHealthState((hPrev) => {
          const physicalCap = Math.round(hPrev.maxHealth * remainingRatio);
          const newHealth = dislodgedCount >= total ? 0 : Math.min(hPrev.currentHealth, physicalCap);
          const dmgDealt = Math.max(0, hPrev.currentHealth - newHealth);

          if (newHealth === hPrev.currentHealth) return hPrev;
          return {
            ...hPrev,
            currentHealth: newHealth,
            lastDamageTaken: dmgDealt > 0 ? dmgDealt : hPrev.lastDamageTaken,
            lastDamageTime: dmgDealt > 0 ? performance.now() : hPrev.lastDamageTime,
          };
        });

        return next;
      });
    },
    [pieces, materialType]
  );

  const handleDespawn = useCallback((id: string) => {
    setDespawnedSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Notify parent of updated destruction and health stats
  useEffect(() => {
    const total = pieces.length;
    const dislodged = dislodgedMap.size;
    const coreIntact = !dislodgedMap.has('celestial_core');
    const remainingRatio = total > 0 ? Math.max(0, (total - dislodged) / total) : 0;
    const physicalCap = Math.round(healthState.maxHealth * remainingRatio);

    // Guaranteed: If the mountain is fully dislodged, health is ALWAYS 0!
    const effectiveCurrent = dislodged >= total || total === 0 ? 0 : Math.min(healthState.currentHealth, physicalCap);

    const syncedHealth: MountainHealthState = {
      ...healthState,
      currentHealth: effectiveCurrent,
    };

    onStatsChange?.({
      totalPieces: total,
      activePieces: Math.max(0, total - dislodged),
      dislodgedPieces: dislodged,
      coreIntact,
      health: syncedHealth,
    });
  }, [pieces.length, dislodgedMap, onStatsChange, healthState]);

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
            onDamage={handleDamage}
            onDespawn={handleDespawn}
          />
        );
      })}
    </group>
  );
}
