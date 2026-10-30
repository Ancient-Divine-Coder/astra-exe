import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';

interface ArrowEnergyTrailProps {
  rbRef: React.RefObject<RapierRigidBody | null>;
  color?: string;
  isImpacted?: boolean;
}

const TRAIL_LENGTH = 20;

export function ArrowEnergyTrail({
  rbRef,
  color = '#38bdf8',
  isImpacted = false,
}: ArrowEnergyTrailProps) {
  const { camera } = useThree();
  const ribbonMeshRef = useRef<THREE.Mesh>(null);
  const wakePointsRef = useRef<THREE.Points>(null);

  // History buffer of world positions
  const historyRef = useRef<THREE.Vector3[]>([]);
  const isInitializedRef = useRef(false);
  const opacityRef = useRef(1.0);

  // Pre-allocate buffer geometry attributes for the camera-facing ribbon
  // Each history point has 2 vertices (left and right), forming quads
  const vertexCount = TRAIL_LENGTH * 2;
  const indexCount = (TRAIL_LENGTH - 1) * 6;

  const { ribbonGeometry, positionsArray, colorsArray } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint16Array(indexCount);

    // Build indices for triangle strips as quads
    let idx = 0;
    for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
      const p1 = i * 2;
      const p2 = i * 2 + 1;
      const p3 = (i + 1) * 2;
      const p4 = (i + 1) * 2 + 1;

      indices[idx++] = p1;
      indices[idx++] = p2;
      indices[idx++] = p3;

      indices[idx++] = p2;
      indices[idx++] = p4;
      indices[idx++] = p3;
    }

    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return { ribbonGeometry: geo, positionsArray: positions, colorsArray: colors };
  }, [vertexCount, indexCount]);

  // Pre-allocate wake ember points
  const WAKE_COUNT = 16;
  const { wakeGeometry, wakePositions, wakeColors, wakeVelocities, wakeLifetimes } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(WAKE_COUNT * 3);
    const col = new Float32Array(WAKE_COUNT * 3);
    const vels: THREE.Vector3[] = [];
    const lives = new Float32Array(WAKE_COUNT);

    const baseCol = new THREE.Color(color);
    const whiteCol = new THREE.Color('#ffffff');

    for (let i = 0; i < WAKE_COUNT; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = -1000; // start offscreen
      pos[i * 3 + 2] = 0;

      const mixed = baseCol.clone().lerp(whiteCol, Math.random() * 0.6);
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;

      vels.push(new THREE.Vector3());
      lives[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    return {
      wakeGeometry: geo,
      wakePositions: pos,
      wakeColors: col,
      wakeVelocities: vels,
      wakeLifetimes: lives,
    };
  }, [color]);

  const wakeHeadRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);

  // Update loop for trail ribbon and wake motes
  useFrame((_, delta) => {
    if (!rbRef.current) return;

    let arrowPos: THREE.Vector3;
    let arrowRot: THREE.Quaternion;
    let arrowVel: { x: number; y: number; z: number };

    try {
      const trans = rbRef.current.translation();
      const rot = rbRef.current.rotation();
      arrowVel = rbRef.current.linvel();
      arrowPos = new THREE.Vector3(trans.x, trans.y, trans.z);
      arrowRot = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    } catch {
      return;
    }

    // Arrow's fletching tail position (approx 0.65 units behind the center along -Y in local space)
    const tailOffset = new THREE.Vector3(0, -0.65, 0).applyQuaternion(arrowRot);
    const tailPos = arrowPos.clone().add(tailOffset);

    // Initialize history buffer on first frame
    if (!isInitializedRef.current) {
      historyRef.current = Array.from({ length: TRAIL_LENGTH }, () => tailPos.clone());
      isInitializedRef.current = true;
    } else {
      // Shift points: push current tail to end
      const history = historyRef.current;
      history.shift();
      history.push(tailPos.clone());
    }

    const history = historyRef.current;
    const speed = Math.hypot(arrowVel.x, arrowVel.y, arrowVel.z);

    // Fade out trail when impacted or stationary
    if (isImpacted || speed < 1.5) {
      opacityRef.current = Math.max(0, opacityRef.current - delta * 3.5);
    } else {
      opacityRef.current = Math.min(1.0, opacityRef.current + delta * 5.0);
    }

    // 1. Update Camera-Facing Ribbon Vertices
    const camPos = camera.position;
    const baseColor = new THREE.Color(color);
    const coreColor = new THREE.Color('#e0f2fe'); // brilliant icy white core

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const pt = history[i];
      const nextPt = i < TRAIL_LENGTH - 1 ? history[i + 1] : pt;
      const prevPt = i > 0 ? history[i - 1] : pt;

      // Segment tangent direction
      const tangent = nextPt.clone().sub(prevPt);
      if (tangent.lengthSq() < 0.0001) {
        tangent.set(0, 0, -1);
      } else {
        tangent.normalize();
      }

      // Vector to camera
      const toCam = camPos.clone().sub(pt).normalize();

      // Binormal (perpendicular to tangent and view direction)
      const binormal = new THREE.Vector3().crossVectors(tangent, toCam);
      if (binormal.lengthSq() < 0.0001) {
        binormal.set(0, 1, 0);
      } else {
        binormal.normalize();
      }

      // Aerodynamic tapering: 0 width at oldest point, up to 0.22 width at arrow tail
      const progress = i / (TRAIL_LENGTH - 1); // 0 (tail end) to 1 (at arrow nock)
      const taperWidth = 0.22 * Math.pow(progress, 1.4);

      // Left vertex
      const left = pt.clone().addScaledVector(binormal, taperWidth);
      positionsArray[i * 6] = left.x;
      positionsArray[i * 6 + 1] = left.y;
      positionsArray[i * 6 + 2] = left.z;

      // Right vertex
      const right = pt.clone().addScaledVector(binormal, -taperWidth);
      positionsArray[i * 6 + 3] = right.x;
      positionsArray[i * 6 + 4] = right.y;
      positionsArray[i * 6 + 5] = right.z;

      // Color fade: older segments fade to black/transparent, front is bright emissive
      const alpha = Math.pow(progress, 1.8) * opacityRef.current;
      const mixedColor = baseColor.clone().lerp(coreColor, progress * 0.6).multiplyScalar(alpha);

      colorsArray[i * 6] = mixedColor.r;
      colorsArray[i * 6 + 1] = mixedColor.g;
      colorsArray[i * 6 + 2] = mixedColor.b;

      colorsArray[i * 6 + 3] = mixedColor.r;
      colorsArray[i * 6 + 4] = mixedColor.g;
      colorsArray[i * 6 + 5] = mixedColor.b;
    }

    if (ribbonMeshRef.current) {
      ribbonGeometry.attributes.position.needsUpdate = true;
      ribbonGeometry.attributes.color.needsUpdate = true;
    }

    // 2. Spawn & Update Wake Embers
    const now = performance.now();
    if (!isImpacted && speed > 5 && now - lastSpawnTimeRef.current > 45) {
      lastSpawnTimeRef.current = now;
      const slot = wakeHeadRef.current;
      wakeHeadRef.current = (wakeHeadRef.current + 1) % WAKE_COUNT;

      // Spawn near tail with slight random lateral jitter
      wakePositions[slot * 3] = tailPos.x + (Math.random() - 0.5) * 0.12;
      wakePositions[slot * 3 + 1] = tailPos.y + (Math.random() - 0.5) * 0.12;
      wakePositions[slot * 3 + 2] = tailPos.z + (Math.random() - 0.5) * 0.12;

      // Slight drift opposite to flight velocity
      wakeVelocities[slot].set(
        -arrowVel.x * 0.05 + (Math.random() - 0.5) * 0.6,
        -arrowVel.y * 0.05 + (Math.random() - 0.5) * 0.6,
        -arrowVel.z * 0.05 + (Math.random() - 0.5) * 0.6
      );

      wakeLifetimes[slot] = 1.0; // 1.0 down to 0.0
    }

    // Update wake particles
    if (wakePointsRef.current) {
      for (let i = 0; i < WAKE_COUNT; i++) {
        if (wakeLifetimes[i] > 0) {
          wakeLifetimes[i] -= delta * 2.2;
          const life = Math.max(0, wakeLifetimes[i]);

          const vel = wakeVelocities[i];
          wakePositions[i * 3] += vel.x * delta;
          wakePositions[i * 3 + 1] += vel.y * delta;
          wakePositions[i * 3 + 2] += vel.z * delta;

          // Fade vertex color
          const c = baseColor.clone().multiplyScalar(life * opacityRef.current);
          wakeColors[i * 3] = c.r;
          wakeColors[i * 3 + 1] = c.g;
          wakeColors[i * 3 + 2] = c.b;
        } else {
          wakePositions[i * 3 + 1] = -1000;
        }
      }
      wakeGeometry.attributes.position.needsUpdate = true;
      wakeGeometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <>
      {/* 1. Camera-Facing Energy Ribbon Trail */}
      <mesh ref={ribbonMeshRef} geometry={ribbonGeometry}>
        <meshBasicMaterial
          vertexColors
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Twinkling Astral Wake Motes */}
      <points ref={wakePointsRef} geometry={wakeGeometry}>
        <pointsMaterial
          size={0.16}
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

