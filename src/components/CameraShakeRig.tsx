import { useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

export interface CameraShakeHandle {
  addTrauma: (amount: number) => void;
}

interface CameraShakeRigProps {
  decayRate?: number;
  maxOffset?: number;
  maxPitch?: number;
  maxYaw?: number;
  maxRoll?: number;
}

export const CameraShakeRig = forwardRef<CameraShakeHandle, CameraShakeRigProps>(
  (
    {
      decayRate = 1.9,
      maxOffset = 0.45,
      maxPitch = 0.045,
      maxYaw = 0.045,
      maxRoll = 0.035,
    },
    ref
  ) => {
    const { camera } = useThree();
    const traumaRef = useRef(0);

    useImperativeHandle(ref, () => ({
      addTrauma: (amount: number) => {
        // Trauma is capped at 1.0, and accumulates additively
        traumaRef.current = Math.min(1.0, traumaRef.current + amount);
      },
    }));

    useFrame((state, delta) => {
      if (traumaRef.current <= 0.001) {
        traumaRef.current = 0;
        return;
      }

      // Non-linear shake power (shake = trauma^2.2) for punchy peaks
      const trauma = traumaRef.current;
      const shake = Math.pow(trauma, 2.2);
      const time = state.clock.elapsedTime;

      // High-frequency harmonic tremors
      const offsetX = maxOffset * shake * Math.sin(time * 42.0);
      const offsetY = maxOffset * shake * Math.cos(time * 48.0);
      const offsetZ = (maxOffset * 0.6) * shake * Math.sin(time * 36.0);

      const pitch = maxPitch * shake * Math.sin(time * 38.0 + 1.2);
      const yaw = maxYaw * shake * Math.cos(time * 44.0 + 2.4);
      const roll = maxRoll * shake * Math.sin(time * 50.0 + 0.8);

      // Apply shake offset to camera on top of OrbitControls for this frame
      camera.position.x += offsetX;
      camera.position.y += offsetY;
      camera.position.z += offsetZ;

      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      euler.x += pitch;
      euler.y += yaw;
      euler.z += roll;
      camera.quaternion.setFromEuler(euler);

      // Decay trauma over time
      traumaRef.current = Math.max(0, traumaRef.current - delta * decayRate);
    });

    return null;
  }
);
CameraShakeRig.displayName = 'CameraShakeRig';

