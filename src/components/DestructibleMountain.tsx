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
  MountainLevel,
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
  level?: MountainLevel;
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

// ============================================================================
// LEVEL 2: 5x Scale Destructible Planetoid / Celestial Sphere
// Massive floating spherical celestial body across the cosmic chasm (Z = -70, elevated Y = 16.0)
// Constructed out of ~49 faceted spherical mantle/crust plates enveloping a celestial core
// ============================================================================
export function generatePlanetoidPieces(materialType: MountainMaterialType = 'Basalt'): FracturedPieceConfig[] {
  const pieces: FracturedPieceConfig[] = [];
  const centerZ = -70;
  const centerY = 16.0;
  const PLANET_RADIUS = 14.5; // ~29 unit diameter (5x scale of mountain cross-section)

  const matConfig = MOUNTAIN_TYPES[materialType] || MOUNTAIN_TYPES.Basalt;
  const mountainMat = matConfig.profile;
  const palette = matConfig.palette;

  const addPiece = (
    id: string,
    tier: 'foundation' | 'mid' | 'peak' | 'core',
    worldPos: [number, number, number],
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
    const calcMass = baseMass * (material.density / 10.0);
    const dynamicThreshold = Math.round(180 * material.toughness * customThresholdMultiplier);

    pieces.push({
      id,
      tier,
      position: worldPos,
      scale: baseScale,
      rotation,
      mass: calcMass,
      friction: material.name === 'Crystal' ? 0.35 : material.name === 'Iron-Core' ? 0.45 : 0.8,
      restitution: material.restitution,
      linearDamping: 0.22,
      angularDamping: 0.45,
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

  // 1. Central Hyper-Dense Planetary Celestial Core
  addPiece(
    'celestial_core',
    'core',
    [0.0, centerY, centerZ],
    [4.2, 4.2, 4.2],
    [0.1, 0.4, 0.2],
    18.0,
    palette.core,
    palette.coreEmissive,
    3.8,
    'crystal_shard',
    mountainMat,
    1.6,
    true
  );

  // 2. Uniform Fibonacci Spherical Tectonic Crust (N = 54 interlocking hexagonal plates)
  const N = 54;
  const goldenAngle = 2.399963229728653; // pi * (3 - sqrt(5))

  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rXZ = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * rXZ;
    const z = Math.sin(theta) * rXZ;

    const norm = new THREE.Vector3(x, y, z).normalize();

    // Align local Y axis (height axis of the cylinder/plate) to point radially outwards
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
    const e = new THREE.Euler().setFromQuaternion(q);

    // Position tightly along the planetary shell radius
    const worldPos: [number, number, number] = [
      norm.x * PLANET_RADIUS,
      centerY + norm.y * PLANET_RADIUS,
      centerZ + norm.z * PLANET_RADIUS,
    ];

    const isPolar = i < 6 || i > N - 7;
    const isEquatorial = Math.abs(y) < 0.35;
    const tier: 'foundation' | 'mid' | 'peak' = isPolar ? 'peak' : isEquatorial ? 'foundation' : 'mid';

    const color = isPolar
      ? palette.peak
      : isEquatorial
      ? palette.foundation
      : (i % 2 === 0 ? palette.mid : palette.foundation);

    const emissiveColor = isPolar
      ? palette.peakEmissive
      : isEquatorial
      ? palette.foundationEmissive
      : (i % 2 === 0 ? palette.midEmissive : palette.foundationEmissive);

    const emissiveIntensity = isPolar ? 0.65 : isEquatorial ? 0.35 : 0.45;

    // Scale [radiusX, thicknessY, radiusZ]: 4.35 radius provides seamless beveled overlap
    const plateScale: [number, number, number] = [4.35, 2.8, 4.35];

    addPiece(
      `pl_tect_${i}`,
      tier,
      worldPos,
      plateScale,
      [e.x, e.y, e.z],
      7.0,
      color,
      emissiveColor,
      emissiveIntensity,
      'tectonic',
      mountainMat,
      1.0
    );
  }

  return pieces;
}

// Individual Fractured Piece
function MountainPiece({
  config,
  level = 1,
  isDislodged,
  impulse,
  vortices,
  onDislodge,
  onPieceImpact,
  onDamage,
  onDespawn,
}: {
  config: FracturedPieceConfig;
  level?: MountainLevel;
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
      case 'tectonic':
        // Geodesic hexagonal spherical crust tile: wide hexagonal top, slightly tapered bottom
        return new THREE.CylinderGeometry(1.0, 0.88, 0.5, 6);
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
            // Gravitational pull accelerates exponentially toward event horizon
            const pullForce = (v.strength / Math.max(0.6, dist * 0.45)) * Math.pow(1 - progress, 0.4);
            const swirlForce = 28 * (1 - progress);

            const fx = (dx * invDist) * pullForce + (-dz * invDist) * swirlForce;
            const fy = (dy * invDist) * pullForce + 11.5 * (1 - progress);
            const fz = (dz * invDist) * pullForce + (dx * invDist) * swirlForce;

            const vel = rbRef.current.linvel();
            rbRef.current.setLinvel(
              {
                x: vel.x * 0.88 + fx * delta,
                y: vel.y * 0.88 + fy * delta,
                z: vel.z * 0.88 + fz * delta,
              },
              true
            );

            rbRef.current.applyTorqueImpulse(
              {
                x: -dz * 0.12,
                y: 0.35,
                z: dx * 0.12,
              },
              true
            );

            // Gravitational Spaghettification & Devouring into the Singularity:
            // As pieces approach the event horizon, they stretch, shrink, and vanish into the void!
            if (dist < 4.5 && meshRef.current) {
              const shrink = Math.max(0.01, (dist - 1.2) / 3.0);
              meshRef.current.scale.set(shrink, shrink, shrink);

              // If piece crosses the event horizon (dist <= 1.45) or is drawn into collapsing core (dist < 2.4 when progress > 0.65), it is fully devoured!
              if ((dist <= 1.45 || (progress > 0.65 && dist < 2.4)) && !isDespawningRef.current) {
                isDespawningRef.current = true;
                onDespawn?.(config.id);
                return;
              }
            }
          }
        }
      }

      // Smoothly shrink piece as it plunges past the abyss edge toward Y = -18
      if (pos.y < -5 && meshRef.current) {
        const shrink = Math.max(0.01, 1.0 - (-5 - pos.y) / 14);
        meshRef.current.scale.set(shrink, shrink, shrink);
      }

      // Automatically dispose of falling debris when Y < -25 or Z < -140
      if (pos.y < -25 || pos.z < -140 || Math.abs(pos.x) > 85) {
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

        // 2. Compute Mountain / Planetoid Health Bar Damage via calculateArrowImpactDamage
        const dmg = calculateArrowImpactDamage(arrowMass, impactSpeed, material, astraType, level);
        onDamage?.(dmg);

        let impactEnergy = impactSpeed * arrowMass;

        // 3. Material-Specific Interaction (Tuned for Basalt, Iron, Crystal, Ductile):
        if (material.name === 'Basalt') {
          if (astraType === 'agni') impactEnergy *= 2.5;
          else if (astraType === 'vayu') impactEnergy *= 1.75;
          else if (astraType === 'astral') impactEnergy *= 1.15;
        } else if (material.name === 'Iron-Core') {
          if (astraType === 'agni') impactEnergy *= 2.35;
          else if (astraType === 'vayu') impactEnergy *= 1.55;
          else if (astraType === 'astral') impactEnergy *= 0.85;
        } else if (material.name === 'Crystal') {
          if (astraType === 'agni') impactEnergy *= 3.4;
          else if (astraType === 'vayu') impactEnergy *= 0.70;
          else if (astraType === 'astral') impactEnergy *= 1.1;
        } else if (material.name === 'Ductile-Stone') {
          if (astraType === 'vayu') impactEnergy *= 2.45;
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

          if (astraType === 'vayu') {
            // Vayu Astra: Hyper-velocity kinetic railgun punch. Blasts directly along flight vector with massive rearward velocity
            impulseVector = [
              flightDir.x * impactSpeed * 0.95 * baseImpulse * pushScalar,
              (flightDir.y * impactSpeed * 0.45 + 2.0) * baseImpulse * pushScalar,
              flightDir.z * impactSpeed * 1.55 * baseImpulse * pushScalar,
            ];
          } else {
            impulseVector = [
              flightDir.x * impactSpeed * 0.40 * baseImpulse * pushScalar,
              (flightDir.y * impactSpeed * 0.40 + (material.name === 'Crystal' ? 5.5 : material.name === 'Ductile-Stone' ? 2.2 : 3.5)) * baseImpulse * pushScalar,
              flightDir.z * impactSpeed * 0.65 * baseImpulse * pushScalar,
            ];
          }
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

// ============================================================================
// Planetary Particle Cloud System (~1,400 Orbiting Cosmic Particles)
// ============================================================================
interface PlanetoidParticleCloudProps {
  center: [number, number, number];
  radius: number;
  materialType: MountainMaterialType;
}

export function PlanetoidParticleCloud({ center, radius, materialType }: PlanetoidParticleCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Points>(null);

  // Generate cosmic particle distributions tailored to the target material
  const { haloPositions, haloColors, ringPositions, ringColors } = useMemo(() => {
    // 1. Atmosphere / Ionosphere dust (850 particles)
    const haloCount = 850;
    const hPos = new Float32Array(haloCount * 3);
    const hCol = new Float32Array(haloCount * 3);

    let paletteHexes: string[];
    switch (materialType) {
      case 'Iron':
        paletteHexes = ['#ffffff', '#fef08a', '#f59e0b', '#38bdf8', '#fbbf24'];
        break;
      case 'Crystal':
        paletteHexes = ['#a78bfa', '#38bdf8', '#e0e7ff', '#f472b6', '#ffffff'];
        break;
      case 'DuctileRock':
        paletteHexes = ['#f59e0b', '#d97706', '#b45309', '#fde68a', '#78350f'];
        break;
      case 'Basalt':
      default:
        paletteHexes = ['#ff4500', '#fb923c', '#ea580c', '#381124', '#fef08a'];
        break;
    }

    const cols = paletteHexes.map((hex) => new THREE.Color(hex));

    for (let i = 0; i < haloCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = radius * (1.02 + Math.pow(Math.random(), 1.5) * 0.42);

      const sinPhi = Math.sin(phi);
      hPos[i * 3] = r * sinPhi * Math.cos(theta);
      hPos[i * 3 + 1] = r * Math.cos(phi);
      hPos[i * 3 + 2] = r * sinPhi * Math.sin(theta);

      const c = cols[Math.floor(Math.random() * cols.length)];
      hCol[i * 3] = c.r;
      hCol[i * 3 + 1] = c.g;
      hCol[i * 3 + 2] = c.b;
    }

    // 2. Equatorial Accretion Ring / Asteroid Dust Belt (550 particles)
    const ringCount = 550;
    const rPos = new Float32Array(ringCount * 3);
    const rCol = new Float32Array(ringCount * 3);

    for (let i = 0; i < ringCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius * (1.25 + Math.random() * 0.7);
      const ySpread = (Math.random() - 0.5) * 1.6;

      rPos[i * 3] = Math.cos(angle) * dist;
      rPos[i * 3 + 1] = ySpread;
      rPos[i * 3 + 2] = Math.sin(angle) * dist;

      const c = cols[Math.floor(Math.random() * cols.length)];
      rCol[i * 3] = c.r;
      rCol[i * 3 + 1] = c.g;
      rCol[i * 3 + 2] = c.b;
    }

    return {
      haloPositions: hPos,
      haloColors: hCol,
      ringPositions: rPos,
      ringColors: rCol,
    };
  }, [radius, materialType]);

  // Subtle orbital rotation in useFrame
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.08;
      pointsRef.current.rotation.x += delta * 0.02;
    }
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.14;
    }
  });

  return (
    <group position={center}>
      {/* 1. Atmospheric Stardust Swarm */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[haloPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[haloColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.32}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 2. Tilted Planetary Dust & Accretion Belt */}
      <group rotation={[0.42, 0.25, -0.32]}>
        <points ref={ringRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[ringPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[ringColors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.38}
            vertexColors
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>
    </group>
  );
}

export function DestructibleMountain({
  materialType = 'Basalt',
  level = 1,
  onStatsChange,
  onImpact,
}: DestructibleMountainProps) {
  const matConfig = MOUNTAIN_TYPES[materialType] || MOUNTAIN_TYPES.Basalt;
  const palette = matConfig.palette;

  const pieces = useMemo(
    () => (level === 2 ? generatePlanetoidPieces(materialType) : generateMountainPieces(materialType)),
    [materialType, level]
  );
  const [dislodgedMap, setDislodgedMap] = useState<Map<string, [number, number, number]>>(new Map());
  const [despawnedSet, setDespawnedSet] = useState<Set<string>>(new Set());
  const [vortices, setVortices] = useState<ActiveVortex[]>([]);

  // Mountain / Planetoid Health State Management
  const [healthState, setHealthState] = useState<MountainHealthState>(() =>
    initializeMountainHealth(materialType, level)
  );

  // Sync health pool when material profile or level changes
  useEffect(() => {
    setHealthState(initializeMountainHealth(materialType, level));
    setDislodgedMap(new Map());
    setDespawnedSet(new Set());
    setVortices([]);
  }, [materialType, level]);

  // Clean expired singularity vortices and emit continuous gravitational energy wave damage
  const lastWaveDamageTimeRef = useRef(0);

  useFrame(() => {
    if (vortices.length === 0) return;
    const now = performance.now();
    setVortices((prev) => prev.filter((v) => now - v.startTime < v.duration));

    // Brahmashira Gravitational Energy Waves: pulse damage every 420ms while vortex is active
    if (now - lastWaveDamageTimeRef.current >= 420 && vortices.length > 0) {
      lastWaveDamageTimeRef.current = now;

      const profile = MOUNTAIN_TYPES[materialType]?.profile;
      const toughness = profile?.toughness || 0.8;
      // Continuous gravitational wave pulse deals 20-30 damage per wave
      const pulseDamage = Math.round(Math.max(14, 28 * (1 - toughness * 0.45) * vortices.length));

      setHealthState((prev) => {
        const nextHealth = Math.max(0, prev.currentHealth - pulseDamage);
        return {
          ...prev,
          currentHealth: nextHealth,
          lastDamageTaken: pulseDamage,
          lastDamageTime: now,
          damageType: 'wave',
        };
      });

      // Gravitational tidal resonance waves destabilize and loosen nearby fragile chunks
      vortices.forEach((v) => {
        const waveFieldRadius = v.radius * 1.15;
        setDislodgedMap((prev) => {
          let updated = false;
          const next = new Map(prev);
          pieces.forEach((p) => {
            if (!next.has(p.id) && !p.isCore) {
              const dx = p.position[0] - v.center[0];
              const dy = p.position[1] - v.center[1];
              const dz = p.position[2] - v.center[2];
              const dist = Math.hypot(dx, dy, dz);

              if (dist <= waveFieldRadius && Math.random() < 0.07) {
                updated = true;
                const invDist = Math.max(0.2, dist);
                next.set(p.id, [
                  (dx / invDist) * 3.2,
                  (dy / invDist) * 2.2 + 1.8,
                  (dz / invDist) * 3.2 - 3.5,
                ]);
              }
            }
          });
          return updated ? next : prev;
        });
      });
    }
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
        damageType: 'direct',
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
        const vortexRadius =
          materialType === 'Iron'
            ? 4.8
            : materialType === 'Basalt'
            ? 5.6
            : materialType === 'DuctileRock'
            ? 6.2
            : 6.8;

        const newVortex: ActiveVortex = {
          id: Date.now() + Math.random(),
          center: contactPos,
          startTime: performance.now(),
          duration: 3400, // 3.4s sustained singularity event
          radius: vortexRadius,
          strength: 70,
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
          const vortexRadius =
            materialType === 'Iron'
              ? 4.8
              : materialType === 'Basalt'
              ? 5.6
              : materialType === 'DuctileRock'
              ? 6.2
              : 6.8;

          const candidates: { piece: FracturedPieceConfig; dist: number }[] = [];
          pieces.forEach((p) => {
            if (!next.has(p.id) && !p.isCore) {
              const dx = p.position[0] - contactPos[0];
              const dy = p.position[1] - contactPos[1];
              const dz = p.position[2] - contactPos[2];
              const dist = Math.hypot(dx, dy, dz);
              if (dist <= vortexRadius) {
                candidates.push({ piece: p, dist });
              }
            }
          });

          candidates.sort((a, b) => a.dist - b.dist);
          const maxPulled =
            materialType === 'Iron'
              ? 7
              : materialType === 'Basalt'
              ? 9
              : materialType === 'DuctileRock'
              ? 11
              : 13;
          const pulled = candidates.slice(0, maxPulled);

          pulled.forEach(({ piece: p }) => {
            const dx = p.position[0] - contactPos[0];
            const dy = p.position[1] - contactPos[1];
            const dz = p.position[2] - contactPos[2];
            const dist = Math.max(0.1, Math.hypot(dx, dy, dz));
            next.set(p.id, [
              -(dx / dist) * 2.5,
              -(dy / dist) * 2.0 + 1.2,
              -(dz / dist) * 2.5,
            ]);
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
                const radialImpulse: [number, number, number] =
                  astraType === 'vayu'
                    ? [
                        (dx / invDist) * push * 0.4,
                        (dy / invDist) * push * 0.3 + 2.0,
                        -Math.abs(push * 2.2) - 24, // violent hyper-kinetic punch straight backward into the abyss
                      ]
                    : [
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
            damageType: astraType === 'brahmashira' ? 'vortex' : 'direct',
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
      {/* For Level 2: Underlying Solid Planetary Mantle Sphere ensuring seamless rocky density */}
      {level === 2 && (
        <mesh position={[0, 16.0, -70]} receiveShadow>
          <sphereGeometry args={[13.6, 36, 36]} />
          <meshStandardMaterial
            color={palette.foundation}
            emissive={palette.foundationEmissive}
            emissiveIntensity={palette.emissiveIntensityMultiplier * 0.4}
            roughness={palette.roughness}
            metalness={palette.metalness}
            flatShading={false}
          />
        </mesh>
      )}

      {/* For Level 2: 1,400-Particle Swirling Atmosphere & Accretion Dust Ring */}
      {level === 2 && (
        <PlanetoidParticleCloud
          center={[0, 16.0, -70]}
          radius={14.5}
          materialType={materialType}
        />
      )}

      {pieces.map((piece) => {
        if (despawnedSet.has(piece.id)) return null;
        return (
          <MountainPiece
            key={piece.id}
            config={piece}
            level={level}
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
