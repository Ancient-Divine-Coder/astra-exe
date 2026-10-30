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
  shapeType: 'boulder' | 'slab' | 'pillar' | 'crystal_shard' | 'peak';
  tier: 'foundation' | 'mid' | 'peak' | 'core';
  isCore?: boolean;
}

export interface ArrowInstance {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  createdAt: number;
}

export interface ImpactEvent {
  id: number;
  position: [number, number, number];
  normal: [number, number, number];
  intensity: number;
  color: string;
  isCore?: boolean;
}

export interface MountainStats {
  totalPieces: number;
  activePieces: number;
  dislodgedPieces: number;
  coreIntact: boolean;
}
