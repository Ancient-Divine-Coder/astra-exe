export type CollisionGroup = {
  ENVIRONMENT: number; // 0
  PROJECTILE: number;  // 1
  DESTRUCTIBLE: number;// 2
};

export const COLLISION_GROUPS = {
  ENVIRONMENT: 0,
  PROJECTILE: 1,
  DESTRUCTIBLE: 2,
} as const;

export interface MountainMaterialProfile {
  name: 'Basalt' | 'Iron-Core' | 'Crystal' | 'Ductile-Stone';
  hardness: number;     // Resistance to surface indentation/penetration (0.0 - 1.0)
  toughness: number;    // Energy absorption before fracturing (0.0 - 1.0)
  ductility: number;    // Ability to deform under stress rather than instantly shattering (0.0 - 1.0)
  density: number;      // RigidBody mass multiplier
  restitution: number;  // Bounciness on impact
}

export type MountainMaterialType = 'Basalt' | 'Iron' | 'Crystal' | 'DuctileRock';

export const MOUNTAIN_MATERIALS: Record<MountainMaterialType, MountainMaterialProfile> = {
  Basalt: { name: 'Basalt', hardness: 0.85, toughness: 0.8, ductility: 0.1, density: 12.0, restitution: 0.1 },
  Iron: { name: 'Iron-Core', hardness: 0.95, toughness: 0.9, ductility: 0.3, density: 18.0, restitution: 0.2 },
  Crystal: { name: 'Crystal', hardness: 0.9, toughness: 0.3, ductility: 0.0, density: 5.0, restitution: 0.6 },
  DuctileRock: { name: 'Ductile-Stone', hardness: 0.6, toughness: 0.7, ductility: 0.5, density: 8.0, restitution: 0.15 },
};

export interface MountainTypeConfig {
  id: MountainMaterialType;
  name: string;
  subtitle: string;
  description: string;
  hotkey: string;
  themeColor: string;
  accentColor: string;
  profile: MountainMaterialProfile;
  tacticalNote: string;
  palette: {
    foundation: string;
    foundationEmissive: string;
    mid: string;
    midEmissive: string;
    peak: string;
    peakEmissive: string;
    core: string;
    coreEmissive: string;
    metalness: number;
    roughness: number;
    emissiveIntensityMultiplier: number;
  };
}

export const MOUNTAIN_TYPES: Record<MountainMaterialType, MountainTypeConfig> = {
  Basalt: {
    id: 'Basalt',
    name: 'Basalt Mountain',
    subtitle: 'Heavy Volcanic Armor',
    description: 'Ancient solidified magma bedrock. Massive density and hardness resist standard kinetic arrow fire.',
    hotkey: 'B',
    themeColor: '#818cf8',
    accentColor: '#4f46e5',
    profile: MOUNTAIN_MATERIALS.Basalt,
    tacticalNote: 'Heavy & rigid. Requires focused consecutive hits or explosive force to fracture.',
    palette: {
      foundation: '#1e1b4b',
      foundationEmissive: '#312e81',
      mid: '#2e1065',
      midEmissive: '#4c1d95',
      peak: '#3b0764',
      peakEmissive: '#701a75',
      core: '#38bdf8',
      coreEmissive: '#0284c7',
      metalness: 0.15,
      roughness: 0.85,
      emissiveIntensityMultiplier: 1.0,
    },
  },
  Iron: {
    id: 'Iron',
    name: 'Iron Mountain',
    subtitle: 'Ultra-Dense Metallic Core',
    description: 'Heavy celestial iron-nickel alloy. Massive density (18.0) and ultra-tough metallic matrix.',
    hotkey: 'I',
    themeColor: '#fbbf24',
    accentColor: '#d97706',
    profile: MOUNTAIN_MATERIALS.Iron,
    tacticalNote: 'Maximum toughness! Highly resistant to kinetic pierce. Weak to Agni explosive blast & Brahmashira vortex.',
    palette: {
      foundation: '#1e293b',
      foundationEmissive: '#334155',
      mid: '#334155',
      midEmissive: '#475569',
      peak: '#475569',
      peakEmissive: '#64748b',
      core: '#f59e0b',
      coreEmissive: '#b45309',
      metalness: 0.85,
      roughness: 0.28,
      emissiveIntensityMultiplier: 0.75,
    },
  },
  Crystal: {
    id: 'Crystal',
    name: 'Crystal Mountain',
    subtitle: 'Brittle Celestial Quartz',
    description: 'Gleaming celestial gem formations. Extreme surface hardness (0.9) but low toughness (0.3) and high bounce (0.6).',
    hotkey: 'C',
    themeColor: '#06b6d4',
    accentColor: '#0891b2',
    profile: MOUNTAIN_MATERIALS.Crystal,
    tacticalNote: 'Highly brittle! Shatters dramatically when struck. High-velocity Vayu Astra tears through it easily.',
    palette: {
      foundation: '#0e7490',
      foundationEmissive: '#0891b2',
      mid: '#06b6d4',
      midEmissive: '#22d3ee',
      peak: '#38bdf8',
      peakEmissive: '#7dd3fc',
      core: '#f43f5e',
      coreEmissive: '#fda4af',
      metalness: 0.25,
      roughness: 0.1,
      emissiveIntensityMultiplier: 2.2,
    },
  },
  DuctileRock: {
    id: 'DuctileRock',
    name: 'Ductile Stone',
    subtitle: 'Deformable Earthen Strata',
    description: 'Layered sandstone and sedimentary clay. High ductility (0.5) absorbs and cushions single kinetic impacts.',
    hotkey: 'D',
    themeColor: '#f97316',
    accentColor: '#ea580c',
    profile: MOUNTAIN_MATERIALS.DuctileRock,
    tacticalNote: 'Deforms before cracking. Cushions isolated blows; sustained rapid assault breaches the matrix.',
    palette: {
      foundation: '#7c2d12',
      foundationEmissive: '#9a3412',
      mid: '#9a3412',
      midEmissive: '#c2410c',
      peak: '#c2410c',
      peakEmissive: '#ea580c',
      core: '#facc15',
      coreEmissive: '#ca8a04',
      metalness: 0.05,
      roughness: 0.95,
      emissiveIntensityMultiplier: 0.85,
    },
  },
};

export interface FracturedPieceConfig {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  mass: number;
  friction: number;
  restitution: number;
  linearDamping?: number;
  angularDamping?: number;
  color: string;
  emissiveColor: string;
  emissiveIntensity: number;
  metalness?: number;
  roughness?: number;
  shapeType: 'boulder' | 'slab' | 'pillar' | 'crystal_shard' | 'peak';
  tier: 'foundation' | 'mid' | 'peak' | 'core';
  material: MountainMaterialProfile;
  fractureThreshold?: number;
  isCore?: boolean;
}

export type AstraType = 'astral' | 'agni' | 'vayu' | 'brahmashira';

export interface AstraConfig {
  id: AstraType;
  name: string;
  subtitle: string;
  color: string;
  accentColor: string;
  description: string;
  hotkey: string;
  speedMultiplier: number;
  blastRadiusMultiplier: number;
  impulseMultiplier: number;
}

export const ASTRA_CONFIGS: Record<AstraType, AstraConfig> = {
  astral: {
    id: 'astral',
    name: 'Astral Arrow',
    subtitle: 'Celestial Nova Piercer',
    color: '#38bdf8',
    accentColor: '#0284c7',
    description: 'Consecrated cyber-celestial arrow with diamond broadhead & starlight nova burst.',
    hotkey: '1',
    speedMultiplier: 1.15,
    blastRadiusMultiplier: 1.05,
    impulseMultiplier: 1.25,
  },
  agni: {
    id: 'agni',
    name: 'Agni Astra',
    subtitle: 'Solar Explosive',
    color: '#f97316',
    accentColor: '#dc2626',
    description: 'Heavy explosive detonation that blasts outer rock armor outward with thermonuclear solar heat.',
    hotkey: '2',
    speedMultiplier: 0.95,
    blastRadiusMultiplier: 2.8,
    impulseMultiplier: 3.5,
  },
  vayu: {
    id: 'vayu',
    name: 'Vayu Astra',
    subtitle: 'Tempest Hyper-Speed',
    color: '#10b981',
    accentColor: '#047857',
    description: 'Hyper-velocity tempest penetrator with extreme kinetic impulse & Mach shockwave.',
    hotkey: '3',
    speedMultiplier: 2.4,
    blastRadiusMultiplier: 0.9,
    impulseMultiplier: 4.2,
  },
  brahmashira: {
    id: 'brahmashira',
    name: 'Brahmashira',
    subtitle: 'Cosmic Singularity',
    color: '#c084fc',
    accentColor: '#7e22ce',
    description: 'Cosmic Singularity that pulls loose debris into a localized vortex and devours matter.',
    hotkey: '4',
    speedMultiplier: 1.05,
    blastRadiusMultiplier: 1.2,
    impulseMultiplier: 1.4,
  },
};

export interface ArrowInstance {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  type: AstraType;
  createdAt: number;
}

export interface ImpactEvent {
  id: number;
  position: [number, number, number];
  normal: [number, number, number];
  intensity: number;
  color: string;
  isCore?: boolean;
  astraType?: AstraType;
  materialType?: MountainMaterialType;
}

export interface MountainHealthState {
  maxHealth: number;
  currentHealth: number;
  selectedMaterial: MountainMaterialType;
  lastDamageTaken?: number;
  lastDamageTime?: number;
  damageType?: 'direct' | 'wave' | 'vortex';
}

export function initializeMountainHealth(materialType: MountainMaterialType): MountainHealthState {
  const profile = MOUNTAIN_MATERIALS[materialType] || MOUNTAIN_MATERIALS.Basalt;
  const baseVolumeFactor = 1000;
  const maxHealth = Math.round(baseVolumeFactor * profile.hardness * profile.toughness);

  return {
    maxHealth,
    currentHealth: maxHealth,
    selectedMaterial: materialType,
  };
}

export function calculateArrowImpactDamage(
  arrowMass: number,
  impactSpeed: number,
  materialProfile: MountainMaterialProfile,
  astraType: AstraType = 'astral'
): number {
  // Kinetic Energy formula: KE = 0.5 * m * v^2
  const rawKE = 0.5 * arrowMass * (impactSpeed * impactSpeed);
  const kineticEnergy = rawKE * 0.038;

  // Toughness resistance: Higher toughness absorbs and mitigates incoming damage
  const damageMitigation = materialProfile.toughness * 0.8 + materialProfile.hardness * 0.2;
  let finalDamage = Math.max(kineticEnergy * (1.0 - damageMitigation * 0.75), 6.0);

  // Elemental Astra Multipliers:
  if (materialProfile.name === 'Crystal') {
    // Crystal (Mohs 9+, Brittle): Catastrophically shatters to Agni thermal shock
    if (astraType === 'agni') finalDamage *= 3.8;
    else if (astraType === 'vayu') finalDamage *= 0.65;
    else if (astraType === 'brahmashira') finalDamage *= 1.65;
  } else if (materialProfile.name === 'Iron-Core') {
    // Iron (Ultra-Dense Matrix): Thermally softened & ruptured by Agni solar heat; punctured by Vayu railgun
    if (astraType === 'agni') finalDamage *= 2.9;
    else if (astraType === 'vayu') finalDamage *= 1.45;
    else if (astraType === 'astral') finalDamage *= 0.70;
    else if (astraType === 'brahmashira') finalDamage *= 1.45;
  } else if (materialProfile.name === 'Ductile-Stone') {
    // Ductile Stone (Sedimentary Sandstone): Sheared clean through by hyper-velocity Vayu kinetic needle
    if (astraType === 'vayu') finalDamage *= 2.65;
    else if (astraType === 'agni') finalDamage *= 2.2;
    else if (astraType === 'brahmashira') finalDamage *= 1.55;
  } else if (materialProfile.name === 'Basalt') {
    // Basalt (Solid Magma Bedrock): Heavy armor shattered by Agni thermal spallation & pierced by Vayu kinetic punch
    if (astraType === 'agni') finalDamage *= 3.2;
    else if (astraType === 'vayu') finalDamage *= 1.65;
    else if (astraType === 'brahmashira') finalDamage *= 1.50;
  }

  return Math.round(finalDamage);
}

export interface MountainStats {
  totalPieces: number;
  activePieces: number;
  dislodgedPieces: number;
  coreIntact: boolean;
  health: MountainHealthState;
}
