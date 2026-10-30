import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, interactionGroups } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { COLLISION_GROUPS } from '../types/game';
import type { FracturedPieceConfig, MountainStats } from '../types/game';

interface DestructibleMountainProps {
  onStatsChange?: (stats: MountainStats) => void;
  onImpact?: (impact: {
    position: [number, number, number];
    normal: [number, number, number];
    color: string;
    isCore?: boolean;
    intensity: number;
  }) => void;
}

// Generate pre-fractured pieces floating in space across the cosmic chasm (at Z = -45, 1.5x scale)
function generateMountainPieces(): FracturedPieceConfig[] {
  const pieces: FracturedPieceConfig[] = [];
  const SCALE = 1.5;
  const centerZ = -45; // 2.5x original distance
  const centerY = 2.0;

  const addPiece = (
    id: string,
    tier: 'foundation' | 'mid' | 'peak' | 'core',
    relPos: [number, number, number],
    baseScale: [number, number, number],
    rotation: [number, number, number],
    mass: number,
    color: string,
    emissiveColor: string,
    emissiveIntensity: number,
    shapeType: FracturedPieceConfig['shapeType'],
    isCore = false
  ) => {
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
      mass: mass * SCALE,
      friction: 0.8,
      restitution: 0.1,
      linearDamping: 0.2,
      angularDamping: 0.5,
      color,
      emissiveColor,
      emissiveIntensity,
      shapeType,
      isCore,
    });
  };

  // --- TIER 1: Lower Asteroid & Mountain Base ---
  const fColor = '#1e1b4b'; // Deep cosmic basalt
  const fEmissive = '#312e81';
  const fMass = 6.0;

  addPiece('f_left', 'foundation', [-3.2, -1.8, 0.0], [2.2, 1.8, 2.2], [0.05, 0.2, -0.05], fMass, fColor, fEmissive, 0.25, 'boulder');
  addPiece('f_front_l', 'foundation', [-1.2, -1.8, 0.8], [2.1, 1.8, 2.0], [-0.02, 0.1, 0.03], fMass, fColor, fEmissive, 0.25, 'slab');
  addPiece('f_front_r', 'foundation', [1.2, -1.8, 0.8], [2.1, 1.8, 2.0], [0.03, -0.15, -0.02], fMass, fColor, fEmissive, 0.25, 'slab');
  addPiece('f_right', 'foundation', [3.2, -1.8, 0.0], [2.2, 1.8, 2.2], [-0.04, -0.2, 0.04], fMass, fColor, fEmissive, 0.25, 'boulder');
  addPiece('f_back_l', 'foundation', [-2.0, -1.8, -1.5], [2.2, 1.8, 2.2], [0.02, 0.3, 0.05], fMass + 1.0, fColor, fEmissive, 0.2, 'pillar');
  addPiece('f_back_c', 'foundation', [0.0, -1.8, -2.0], [2.4, 1.8, 2.2], [-0.05, 0.0, 0.0], fMass + 1.5, fColor, fEmissive, 0.2, 'slab');
  addPiece('f_back_r', 'foundation', [2.0, -1.8, -1.5], [2.2, 1.8, 2.2], [-0.02, -0.3, -0.05], fMass + 1.0, fColor, fEmissive, 0.2, 'pillar');
  addPiece('f_keystone', 'foundation', [0.0, -3.2, -0.2], [2.6, 2.2, 2.6], [Math.PI, 0.2, 0], fMass + 2.0, '#131033', '#1e1b4b', 0.15, 'peak');

  // --- INNER CELESTIAL CORE (Floating in center sanctuary) ---
  addPiece(
    'celestial_core',
    'core',
    [0.0, 0.5, 0.0],
    [1.4, 1.9, 1.4],
    [0.1, 0.4, 0.2],
    4.0,
    '#38bdf8',
    '#0284c7',
    3.0,
    'crystal_shard',
    true
  );

  // --- TIER 2: Mid Mountain Outer Shell & Flanks ---
  const mColor = '#241a45';
  const mEmissive = '#4338ca';
  const mMass = 4.0;

  addPiece('m_shield_l', 'mid', [-1.8, 0.2, 1.2], [1.8, 1.7, 1.6], [0.06, 0.25, -0.04], mMass, mColor, mEmissive, 0.4, 'boulder');
  addPiece('m_shield_c', 'mid', [0.0, 0.2, 1.8], [1.9, 1.7, 1.5], [-0.04, 0.0, 0.02], mMass + 0.5, mColor, mEmissive, 0.5, 'slab');
  addPiece('m_shield_r', 'mid', [1.8, 0.2, 1.2], [1.8, 1.7, 1.6], [-0.06, -0.25, 0.04], mMass, mColor, mEmissive, 0.4, 'boulder');
  addPiece('m_flank_l', 'mid', [-2.6, 0.2, -0.2], [1.8, 1.7, 1.8], [0.03, 0.35, 0.06], mMass, mColor, mEmissive, 0.35, 'pillar');
  addPiece('m_flank_r', 'mid', [2.6, 0.2, -0.2], [1.8, 1.7, 1.8], [-0.03, -0.35, -0.06], mMass, mColor, mEmissive, 0.35, 'pillar');
  addPiece('m_back_l', 'mid', [-1.6, 0.2, -1.8], [1.8, 1.7, 1.8], [0.05, 0.45, 0.02], mMass, mColor, mEmissive, 0.3, 'boulder');
  addPiece('m_back_c', 'mid', [0.0, 0.2, -2.2], [2.0, 1.7, 1.8], [-0.05, 0.0, 0.0], mMass, mColor, mEmissive, 0.3, 'slab');
  addPiece('m_back_r', 'mid', [1.6, 0.2, -1.8], [1.8, 1.7, 1.8], [-0.05, -0.45, -0.02], mMass, mColor, mEmissive, 0.3, 'boulder');

  // --- TIER 3: Upper Slopes & Ridge Shoulders ---
  const uColor = '#2e1065';
  const uEmissive = '#6d28d9';
  const uMass = 2.5;

  addPiece('u_front_l', 'mid', [-1.2, 2.0, 0.6], [1.5, 1.5, 1.5], [0.08, 0.15, -0.06], uMass, uColor, uEmissive, 0.55, 'boulder');
  addPiece('u_front_r', 'mid', [1.2, 2.0, 0.6], [1.5, 1.5, 1.5], [-0.08, -0.15, 0.06], uMass, uColor, uEmissive, 0.55, 'boulder');
  addPiece('u_center', 'mid', [0.0, 2.2, -0.2], [1.6, 1.6, 1.6], [0.02, 0.3, 0.0], uMass + 0.5, uColor, uEmissive, 0.7, 'slab');
  addPiece('u_back_l', 'mid', [-1.0, 2.0, -1.2], [1.5, 1.5, 1.5], [0.04, 0.5, 0.03], uMass, uColor, uEmissive, 0.5, 'boulder');
  addPiece('u_back_r', 'mid', [1.0, 2.0, -1.2], [1.5, 1.5, 1.5], [-0.04, -0.5, -0.03], uMass, uColor, uEmissive, 0.5, 'boulder');

  // --- TIER 4: Mountain Peaks & Apex Spire ---
  const pColor = '#3b0764';
  const pEmissive = '#9333ea';

  addPiece('p_left', 'peak', [-0.6, 3.6, 0.0], [1.2, 1.4, 1.2], [0.05, 0.2, -0.04], 1.6, pColor, pEmissive, 0.8, 'boulder');
  addPiece('p_right', 'peak', [0.6, 3.6, 0.0], [1.2, 1.4, 1.2], [-0.05, -0.2, 0.04], 1.6, pColor, pEmissive, 0.8, 'boulder');
  addPiece('p_summit', 'peak', [0.0, 5.0, 0.0], [1.0, 1.9, 1.0], [0.03, 0.1, -0.03], 1.0, '#581c87', '#c084fc', 1.2, 'peak');

  return pieces;
}

// Individual Fractured Piece
function MountainPiece({
  config,
  isDislodged,
  impulse,
  onDislodge,
  onPieceImpact,
  onDespawn,
}: {
  config: FracturedPieceConfig;
  isDislodged: boolean;
  impulse?: [number, number, number];
  onDislodge: (id: string, contactPoint: [number, number, number], impulse?: [number, number, number]) => void;
  onPieceImpact?: (
    contactPoint: [number, number, number],
    normal: [number, number, number],
    isCore: boolean,
    color: string,
    intensity: number
  ) => void;
  onDespawn?: (id: string) => void;
}) {
  const rbRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const isDespawningRef = useRef(false);
  const lastImpactTimeRef = useRef(0);
  const pendingImpulseRef = useRef<[number, number, number] | null>(null);
  const hasAppliedImpulseRef = useRef(false);

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

  // Monitor piece falling out of bounds: shrink smoothly and delete from physics & scene
  useFrame(() => {
    if (!isDislodged || !rbRef.current || isDespawningRef.current) return;
    try {
      const pos = rbRef.current.translation();
      // Smoothly shrink piece as it plunges below Y = -12
      if (pos.y < -12 && meshRef.current) {
        const shrink = Math.max(0.01, 1.0 - (-12 - pos.y) / 22);
        meshRef.current.scale.set(shrink, shrink, shrink);
      }
      // Once past Y = -34 or deep out of bounds, delete completely
      if (pos.y < -34 || pos.z < -95 || Math.abs(pos.x) > 60) {
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
      if (now - lastImpactTimeRef.current < 80) return;

      const otherObject = e.other?.rigidBodyObject;
      const otherBody = e.other?.rigidBody;
      const otherUserData = otherBody?.userData as { type?: string } | undefined;

      const isArrowHit =
        otherUserData?.type === 'arrow' ||
        otherObject?.name === 'arrow' ||
        (otherBody && otherBody.mass() <= 2.0 && otherBody.linvel().z < -5); // High speed projectile

      if (isArrowHit) {
        lastImpactTimeRef.current = now;
        const arrowVel = otherBody?.linvel();
        const impulseVector: [number, number, number] = arrowVel
          ? [arrowVel.x * 0.45, (arrowVel.y + 4) * 0.45, arrowVel.z * 0.75]
          : [0, 4, -22];

        pendingImpulseRef.current = impulseVector;

        // If piece was already dislodged and gets hit again, transfer kinetic momentum
        if (isDislodged && rbRef.current) {
          rbRef.current.applyImpulse(
            { x: impulseVector[0] * 0.6, y: impulseVector[1] * 0.6, z: impulseVector[2] * 0.6 },
            true
          );
        }

        let contactPos: [number, number, number] = [
          config.position[0],
          config.position[1],
          config.position[2],
        ];
        let normal: [number, number, number] = [0, 0, 1];

        if (arrowVel) {
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

        const intensity = config.isCore ? 2.5 : 1.2;
        onPieceImpact?.(contactPos, normal, !!config.isCore, config.color, intensity);

        if (!isDislodged) {
          onDislodge(config.id, contactPos, impulseVector);
        }
      }
    },
    [config.color, config.id, config.isCore, config.position, isDislodged, onDislodge, onPieceImpact]
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
          emissive={config.emissiveColor}
          emissiveIntensity={isDislodged ? config.emissiveIntensity * 1.5 : config.emissiveIntensity}
          roughness={config.isCore ? 0.2 : 0.85}
          metalness={config.isCore ? 0.85 : 0.15}
          flatShading={true}
        />
      </mesh>

      {/* Radiant celestial light from the Core */}
      {config.isCore && (
        <pointLight
          color="#38bdf8"
          intensity={isDislodged ? 12 : 6}
          distance={18}
          decay={2}
        />
      )}
    </RigidBody>
  );
}

export function DestructibleMountain({ onStatsChange, onImpact }: DestructibleMountainProps) {
  const pieces = useMemo(() => generateMountainPieces(), []);
  const [dislodgedMap, setDislodgedMap] = useState<Map<string, [number, number, number]>>(() => new Map());
  const [despawnedSet, setDespawnedSet] = useState<Set<string>>(() => new Set());

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
      intensity: number
    ) => {
      onImpact?.({
        position: contactPos,
        normal,
        isCore,
        color,
        intensity,
      });
    },
    [onImpact]
  );

  const handleDislodge = useCallback(
    (id: string, contactPos: [number, number, number], impulse?: [number, number, number]) => {
      setDislodgedMap((prev) => {
        if (prev.has(id)) return prev;
        const next = new Map(prev);
        const directImpulse = impulse || [0, 4, -22];
        next.set(id, directImpulse);

        // Also dislodge adjacent pieces within 3.4 unit radius for explosive destruction!
        pieces.forEach((p) => {
          if (!next.has(p.id) && !p.isCore) {
            const dx = p.position[0] - contactPos[0];
            const dy = p.position[1] - contactPos[1];
            const dz = p.position[2] - contactPos[2];
            const dist = Math.hypot(dx, dy, dz);
            // 40% chance to shatter immediately adjacent outer stones (scaled to 1.5x)
            if (dist < 3.4 && Math.random() < 0.40) {
              const invDist = Math.max(0.2, dist);
              const push = 18 / invDist;
              const radialImpulse: [number, number, number] = [
                (dx / invDist) * push,
                (dy / invDist) * push + 5,
                (dz / invDist) * push - 10,
              ];
              next.set(p.id, radialImpulse);
            }
          }
        });

        return next;
      });
    },
    [pieces]
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
            onDislodge={handleDislodge}
            onPieceImpact={handlePieceImpact}
            onDespawn={handleDespawn}
          />
        );
      })}
    </group>
  );
}
