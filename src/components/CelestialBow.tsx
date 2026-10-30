import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, interactionGroups, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { ArrowEnergyTrail } from './ArrowEnergyTrail';
import { COLLISION_GROUPS } from '../types/game';
import type { ArrowInstance } from '../types/game';

interface CelestialBowProps {
  onDragStateChange: (dragging: boolean) => void;
  onPowerChange?: (powerPercent: number) => void;
  showTrajectory?: boolean;
  onImpact?: (impact: {
    position: [number, number, number];
    normal: [number, number, number];
    color: string;
    intensity: number;
    isCore?: boolean;
  }) => void;
  onFire?: (powerRatio: number) => void;
}

// Single Physical Energy Arrow in Flight
function Arrow({
  id,
  position,
  velocity,
  onImpact,
  onDestroy,
}: {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  onImpact?: (impact: {
    position: [number, number, number];
    normal: [number, number, number];
    color: string;
    intensity: number;
    isCore?: boolean;
  }) => void;
  onDestroy: (id: number) => void;
}) {
  const rbRef = useRef<RapierRigidBody>(null);
  const hasImpactedRef = useRef(false);
  const isDestroyedRef = useRef(false);
  const [isImpacted, setIsImpacted] = useState(false);

  // Orient arrow along flight velocity
  const rotation = useMemo(() => {
    const v = new THREE.Vector3(...velocity).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    const e = new THREE.Euler().setFromQuaternion(q);
    return [e.x, e.y, e.z] as [number, number, number];
  }, [velocity]);

  // Monitor arrow position: automatically delete once past mountain or out of range
  useFrame(() => {
    if (!rbRef.current || isDestroyedRef.current) return;
    try {
      const pos = rbRef.current.translation();
      // Mountain is at Z = -45. If arrow passes Z = -68, falls below Y = -35, or flies off sideways, delete it!
      if (pos.z < -68 || pos.y < -35 || Math.abs(pos.x) > 50 || Math.abs(pos.z) > 110) {
        isDestroyedRef.current = true;
        onDestroy(id);
      }
    } catch {
      // ignore
    }
  });

  const handleCollision = useCallback(
    (e: any) => {
      if (hasImpactedRef.current) return;
      hasImpactedRef.current = true;
      setIsImpacted(true);

      const otherUserData = e.other?.rigidBody?.userData as { type?: string } | undefined;
      // If it hit environment (not destructible blocks which manage their own block fracture),
      // spawn a celestial stone impact flash!
      if (otherUserData?.type !== 'destructible') {
        if (rbRef.current) {
          try {
            const pos = rbRef.current.translation();
            const vel = rbRef.current.linvel();
            const norm = new THREE.Vector3(-vel.x, Math.max(0.4, -vel.y), -vel.z).normalize();
            onImpact?.({
              position: [pos.x, pos.y, pos.z],
              normal: [norm.x, norm.y, norm.z],
              color: '#38bdf8',
              intensity: 1.0,
              isCore: false,
            });
          } catch {
            // fallback
          }
        }
      }

      // Automatically delete arrow shortly after collision impact to optimize performance
      setTimeout(() => {
        if (!isDestroyedRef.current) {
          isDestroyedRef.current = true;
          onDestroy(id);
        }
      }, 60);
    },
    [id, onDestroy, onImpact]
  );

  return (
    <>
      <RigidBody
        ref={rbRef}
        name="arrow"
        userData={{ type: 'arrow' }}
        position={position}
        rotation={rotation}
        linearVelocity={velocity}
        restitution={0.1}
        friction={0.6}
        mass={1.5}
        ccd={true} // Continuous Collision Detection prevents tunneling through mountain blocks!
        collisionGroups={interactionGroups(COLLISION_GROUPS.PROJECTILE, [
          COLLISION_GROUPS.ENVIRONMENT,
          COLLISION_GROUPS.DESTRUCTIBLE,
        ])}
        onCollisionEnter={handleCollision}
      >
        <group>
          {/* Glowing Astral Arrow Head */}
          <mesh position={[0, 0.45, 0]}>
            <coneGeometry args={[0.18, 0.7, 8]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={2.5}
              roughness={0.2}
            />
          </mesh>

          {/* Luminous Arrow Shaft */}
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 1.1, 8]} />
            <meshStandardMaterial
              color="#bae6fd"
              emissive="#38bdf8"
              emissiveIntensity={1.6}
              roughness={0.3}
            />
          </mesh>

          {/* Fletching Energy fins */}
          <mesh position={[0, -0.8, 0]}>
            <coneGeometry args={[0.15, 0.3, 4]} />
            <meshStandardMaterial
              color="#0ea5e9"
              emissive="#0284c7"
              emissiveIntensity={2.0}
            />
          </mesh>

          {/* Flight Point Light */}
          <pointLight color="#38bdf8" intensity={2.5} distance={7} decay={2} />
        </group>
      </RigidBody>

      {/* Milestone 4 Point 2: Dynamic Camera-Facing Energy Trail Ribbon & Wake Embers */}
      <ArrowEnergyTrail
        rbRef={rbRef}
        color="#38bdf8"
        isImpacted={isImpacted}
      />
    </>
  );
}

// 3D Glowing Cylinder String Segment
function StringSegment({
  start,
  end,
  color = '#38bdf8',
}: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}) {
  const vStart = useMemo(() => new THREE.Vector3(...start), [start]);
  const vEnd = useMemo(() => new THREE.Vector3(...end), [end]);
  const distance = useMemo(() => vStart.distanceTo(vEnd), [vStart, vEnd]);
  const mid = useMemo(() => vStart.clone().add(vEnd).multiplyScalar(0.5), [vStart, vEnd]);

  const quaternion = useMemo(() => {
    const dir = vEnd.clone().sub(vStart).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [vStart, vEnd]);

  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[0.014, 0.014, distance, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.0}
        roughness={0.2}
      />
    </mesh>
  );
}

// Helper to compute tuned aim vector with deadzone and full-range vertical elevation
function computeAimVector(dx: number, dy: number, isDragging: boolean) {
  const maxPullX = 160;
  const deadzone = 14; // Horizontal deadzone for rock-steady straight shots

  // Horizontal steering with progressive deadzone curve
  let curvedX = 0;
  if (Math.abs(dx) > deadzone) {
    const sign = Math.sign(dx);
    const remapped = (Math.abs(dx) - deadzone) / (maxPullX - deadzone);
    curvedX = sign * Math.min(1.0, Math.pow(remapped, 1.25));
  }
  const aimX = -curvedX * 0.40; // Opposite-direction steer

  // Pull ratio & launch speed scaled for 47-unit chasm
  const pullDist = Math.hypot(dx, dy);
  const pullRatio = Math.min(1.0, Math.max(0, (pullDist - 10) / 100));
  const forwardSpeed = 46 + pullRatio * 48; // 46 to 94 speed units across the chasm

  // Flat trajectory ballistic compensation for mountain at Z = -45:
  const distToMountain = 47;
  const flightTime = distToMountain / forwardSpeed;
  const compVy = 0.5 * 9.81 * flightTime;
  const baseElevationAngle = compVy / forwardSpeed;

  // Full vertical elevation range:
  const userPitch = ((dy - 80) / 100) * 0.44;
  const aimY = baseElevationAngle + (isDragging && pullDist > 10 ? userPitch : 0);
  const aimZ = -1.0;
  const worldAimDir = new THREE.Vector3(aimX, aimY, aimZ).normalize();

  return {
    pullRatio,
    forwardSpeed,
    worldAimDir,
    nockDistance: pullRatio * 1.35,
  };
}

export function CelestialBow({
  onDragStateChange,
  onPowerChange,
  showTrajectory = true,
  onImpact,
  onFire,
}: CelestialBowProps) {
  const { world, rapier } = useRapier();
  const [arrows, setArrows] = useState<ArrowInstance[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pullOffset, setPullOffset] = useState({ x: 0, y: 0 });

  const handleDestroyArrow = useCallback((id: number) => {
    setArrows((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const pullOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  // Keep refs in sync inside effects
  useEffect(() => {
    pullOffsetRef.current = pullOffset;
  }, [pullOffset]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Clean up arrows older than 14 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setArrows((prev) => prev.filter((a) => now - a.createdAt < 14000).slice(-30));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Construct circular crescent arc geometry for the bow frame
  const bowArcGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const arcRadius = 1.25;
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = (t - 0.5) * Math.PI; // -PI/2 to +PI/2
      const y = Math.sin(angle) * arcRadius;
      const z = -Math.cos(angle) * 0.45; // curves forward in center towards -Z
      points.push(new THREE.Vector3(0, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 32, 0.045, 12, false);
  }, []);

  // Tip positions on the bow arc
  const topTip: [number, number, number] = [0, 1.25, 0];
  const bottomTip: [number, number, number] = [0, -1.25, 0];

  // Calculate pull vector and launch direction with deadzone and ballistic compensation
  const { pullDist, bowEuler, nockPos } = useMemo(() => {
    const dx = pullOffset.x;
    const dy = pullOffset.y;
    const dist = Math.hypot(dx, dy);

    if (!isDragging || dist < 4) {
      return {
        pullDist: 0,
        bowEuler: [0, 0, 0] as [number, number, number],
        nockPos: [0, 0, 0] as [number, number, number],
      };
    }

    const { worldAimDir, nockDistance } = computeAimVector(dx, dy, isDragging);

    // Bow orientation: rotates to directly face the arrow launch direction!
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), worldAimDir);
    const e = new THREE.Euler().setFromQuaternion(q);

    // In local space of the rotated bow, the nock dot is pulled back along +Z:
    const nock: [number, number, number] = [0, 0, nockDistance];

    return {
      pullDist: nockDistance,
      bowEuler: [e.x, e.y, e.z] as [number, number, number],
      nockPos: nock,
    };
  }, [pullOffset, isDragging]);

  // Trajectory Prediction with Physical Collision Stopping (Stops dead on surface!)
  const trajectoryData = useMemo(() => {
    if (!isDragging || !showTrajectory || pullDist <= 0.05) return null;

    const { forwardSpeed, worldAimDir } = computeAimVector(pullOffset.x, pullOffset.y, true);

    const p0 = new THREE.Vector3(
      worldAimDir.x * 0.4,
      1.2 + worldAimDir.y * 0.4,
      2 + worldAimDir.z * 0.4
    );
    const v0 = worldAimDir.clone().multiplyScalar(forwardSpeed);
    const g = 9.81;

    // Flight time to reach mountain distance (Z ~ -55)
    const totalFlightTime = Math.min(2.0, Math.max(0.4, (-55 - p0.z) / v0.z));
    const steps = 60;

    const trajectoryPoints: THREE.Vector3[] = [p0.clone()];
    let hitPoint: THREE.Vector3 | null = null;
    let hitNormal: THREE.Vector3 | null = null;

    for (let i = 0; i < steps; i++) {
      const tA = (i / steps) * totalFlightTime;
      const tB = ((i + 1) / steps) * totalFlightTime;

      const pA = new THREE.Vector3(
        p0.x + v0.x * tA,
        p0.y + v0.y * tA - 0.5 * g * tA * tA,
        p0.z + v0.z * tA
      );
      const pB = new THREE.Vector3(
        p0.x + v0.x * tB,
        p0.y + v0.y * tB - 0.5 * g * tB * tB,
        p0.z + v0.z * tB
      );

      const delta = pB.clone().sub(pA);
      const segDist = delta.length();

      if (segDist > 0.001) {
        const dir = delta.clone().normalize();
        const ray = new rapier.Ray(pA, dir);

        // Raycast against Environment (0) and Destructible Mountain (2)
        const hit = world.castRayAndGetNormal(
          ray,
          segDist,
          true,
          undefined,
          interactionGroups(COLLISION_GROUPS.PROJECTILE, [
            COLLISION_GROUPS.ENVIRONMENT,
            COLLISION_GROUPS.DESTRUCTIBLE,
          ])
        );

        if (hit) {
          // Intersected object! Stop trajectory right on the object's surface!
          const impact = pA.clone().add(dir.multiplyScalar(hit.timeOfImpact));
          trajectoryPoints.push(impact);
          hitPoint = impact;
          hitNormal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
          break; // Terminate trajectory line at the surface!
        }
      }

      trajectoryPoints.push(pB);
    }

    // Convert trajectory points to Float32Array for line geometry
    const positions = new Float32Array(trajectoryPoints.length * 3);
    trajectoryPoints.forEach((pt, idx) => {
      positions[idx * 3] = pt.x;
      positions[idx * 3 + 1] = pt.y;
      positions[idx * 3 + 2] = pt.z;
    });

    // Sample beads along the arc
    const beadPoints: [number, number, number][] = [];
    for (let i = 4; i < trajectoryPoints.length; i += 4) {
      const pt = trajectoryPoints[i];
      beadPoints.push([pt.x, pt.y, pt.z]);
    }

    const finalEnd = hitPoint || trajectoryPoints[trajectoryPoints.length - 1];
    const reticlePos: [number, number, number] = [finalEnd.x, finalEnd.y, finalEnd.z];

    // Orient reticle flush against the hit surface normal
    const reticleQuat = new THREE.Quaternion();
    if (hitNormal) {
      reticleQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hitNormal);
      // Offset slightly along normal to prevent z-fighting with the rock mesh
      reticlePos[0] += hitNormal.x * 0.03;
      reticlePos[1] += hitNormal.y * 0.03;
      reticlePos[2] += hitNormal.z * 0.03;
    }

    return {
      positions,
      beadPoints,
      reticlePos,
      reticleQuat,
      hasHit: !!hitPoint,
    };
  }, [isDragging, showTrajectory, pullDist, pullOffset, world, rapier]);

  // Fire Arrow implementation
  const fireArrow = useCallback(() => {
    if (!isDraggingRef.current) return;

    setIsDragging(false);
    isDraggingRef.current = false;
    onDragStateChange(false);
    onPowerChange?.(0);

    const offset = pullOffsetRef.current;
    const dist = Math.hypot(offset.x, offset.y);

    if (dist < 8) {
      setPullOffset({ x: 0, y: 0 });
      return;
    }

    const { pullRatio, forwardSpeed, worldAimDir } = computeAimVector(offset.x, offset.y, true);
    onFire?.(pullRatio);

    const velocity: [number, number, number] = [
      worldAimDir.x * forwardSpeed,
      worldAimDir.y * forwardSpeed,
      worldAimDir.z * forwardSpeed,
    ];

    // Spawn arrow at bow position
    const spawnPosition: [number, number, number] = [
      0 + worldAimDir.x * 0.4,
      1.2 + worldAimDir.y * 0.4,
      2 + worldAimDir.z * 0.4,
    ];

    setArrows((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        position: spawnPosition,
        velocity,
        createdAt: Date.now(),
      },
    ]);

    setPullOffset({ x: 0, y: 0 });
    pullOffsetRef.current = { x: 0, y: 0 };
  }, [onDragStateChange, onPowerChange]);

  // Window-level pointer listeners so releasing anywhere on screen reliably fires arrow
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const maxPullX = 160;
      const maxPullY = 180;
      const clampedX = Math.max(-maxPullX, Math.min(maxPullX, dx));
      const clampedY = Math.max(-maxPullY, Math.min(maxPullY, dy));

      const newOffset = { x: clampedX, y: clampedY };
      setPullOffset(newOffset);
      pullOffsetRef.current = newOffset;

      const pullDistance = Math.hypot(clampedX, clampedY);
      const powerPct = Math.min(100, Math.round(Math.max(0, (pullDistance - 10) / 100) * 100));
      onPowerChange?.(powerPct);
    };

    const handleWindowPointerUp = () => {
      fireArrow();
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [isDragging, fireArrow, onPowerChange]);

  // Pointer Down on Bow initiates the aim
  const handlePointerDown = useCallback(
    (e: any) => {
      e.stopPropagation();
      setIsDragging(true);
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setPullOffset({ x: 0, y: 0 });
      pullOffsetRef.current = { x: 0, y: 0 };
      onDragStateChange(true);
      onPowerChange?.(0);
    },
    [onDragStateChange, onPowerChange]
  );

  return (
    <>
      {/* Interactive Celestial Bow at Island edge [0, 1.2, 2] */}
      <group position={[0, 1.2, 2]}>
        {/* Invisible Expanded Grab Hitbox for easy clicking */}
        <mesh onPointerDown={handlePointerDown} visible={false}>
          <sphereGeometry args={[1.8, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Rotatable Bow Assembly: Pivots in real time to face the arrow launch direction */}
        <group rotation={bowEuler}>
          {/* Circular Crescent Arc Frame */}
          <mesh geometry={bowArcGeometry} onPointerDown={handlePointerDown}>
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#d97706"
              emissiveIntensity={isDragging ? 1.0 : 0.4}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>

          {/* Top Tip Gem */}
          <mesh position={topTip}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.5} />
          </mesh>

          {/* Bottom Tip Gem */}
          <mesh position={bottomTip}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.5} />
          </mesh>

          {/* Center Handle Grip */}
          <mesh position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.22, 12]} />
            <meshStandardMaterial color="#c084fc" emissive="#7e22ce" emissiveIntensity={0.8} />
          </mesh>

          {/* Upper Bowstring: From Top Tip to Nock Dot */}
          <StringSegment
            start={topTip}
            end={nockPos}
            color={isDragging ? '#38bdf8' : '#fbbf24'}
          />

          {/* Lower Bowstring: From Bottom Tip to Nock Dot */}
          <StringSegment
            start={bottomTip}
            end={nockPos}
            color={isDragging ? '#38bdf8' : '#fbbf24'}
          />

          {/* Interactive Nock Dot in the Middle of the Arc */}
          <mesh position={nockPos} onPointerDown={handlePointerDown}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial
              color={isDragging ? '#38bdf8' : '#f43f5e'}
              emissive={isDragging ? '#0284c7' : '#be123c'}
              emissiveIntensity={isDragging ? 2.5 : 1.2}
            />
          </mesh>

          {/* Loaded Energy Arrow resting on the string when pulling back */}
          {isDragging && pullDist > 0.05 && (
            <group position={[0, 0, nockPos[2] - 0.5]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh position={[0, 0.45, 0]}>
                <coneGeometry args={[0.14, 0.5, 8]} />
                <meshStandardMaterial
                  color="#38bdf8"
                  emissive="#0284c7"
                  emissiveIntensity={2.8}
                />
              </mesh>
              <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
                <meshStandardMaterial
                  color="#bae6fd"
                  emissive="#38bdf8"
                  emissiveIntensity={2.0}
                />
              </mesh>
            </group>
          )}
        </group>
      </group>

      {/* Trajectory Prediction Arc & Impact Reticle (Stops on Object Surface!) */}
      {trajectoryData && (
        <group>
          {/* Continuous Glowing Trajectory Line */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[trajectoryData.positions, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.65}
            />
          </line>

          {/* Celestial Energy Beads along the arc */}
          {trajectoryData.beadPoints.map((pt, idx) => (
            <mesh key={`bead_${idx}`} position={pt}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
            </mesh>
          ))}

          {/* Impact Target Reticle (Flush on Object Surface) */}
          <group position={trajectoryData.reticlePos} quaternion={trajectoryData.reticleQuat}>
            <mesh>
              <ringGeometry args={[0.22, 0.35, 24]} />
              <meshBasicMaterial
                color={trajectoryData.hasHit ? '#38bdf8' : '#818cf8'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.9}
              />
            </mesh>
            <mesh>
              <circleGeometry args={[0.08, 16]} />
              <meshBasicMaterial
                color={trajectoryData.hasHit ? '#f43f5e' : '#38bdf8'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* Active Arrows in flight in the physics world */}
      {arrows.map((arrow) => (
        <Arrow
          key={arrow.id}
          id={arrow.id}
          position={arrow.position}
          velocity={arrow.velocity}
          onImpact={onImpact}
          onDestroy={handleDestroyArrow}
        />
      ))}
    </>
  );
}
