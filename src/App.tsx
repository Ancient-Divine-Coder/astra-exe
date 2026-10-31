import { useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { OrbitControls } from '@react-three/drei';
import { CosmicEnvironment } from './components/CosmicEnvironment';
import { CelestialIsland } from './components/CelestialIsland';
import { DestructibleMountain } from './components/DestructibleMountain';
import { CelestialBow } from './components/CelestialBow';
import { ImpactFX } from './components/ImpactFX';
import { CameraShakeRig, type CameraShakeHandle } from './components/CameraShakeRig';
import { GameHUD } from './components/GameHUD';
import type { MountainStats, ImpactEvent, AstraType, MountainMaterialType, MountainLevel } from './types/game';
import { initializeMountainHealth } from './types/game';

export default function App() {
  const [selectedAstra, setSelectedAstra] = useState<AstraType>('astral');
  const [mountainMaterial, setMountainMaterial] = useState<MountainMaterialType>('Basalt');
  const [targetLevel, setTargetLevel] = useState<MountainLevel>(1);
  const [isAiming, setIsAiming] = useState(false);
  const [drawPower, setDrawPower] = useState(0);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [impacts, setImpacts] = useState<ImpactEvent[]>([]);
  const impactIdCounter = useRef(1);
  const cameraShakeRef = useRef<CameraShakeHandle>(null);

  const [mountainStats, setMountainStats] = useState<MountainStats>(() => ({
    totalPieces: 0,
    activePieces: 0,
    dislodgedPieces: 0,
    coreIntact: true,
    health: initializeMountainHealth('Basalt', 1),
  }));

  const handleImpact = useCallback((data: Omit<ImpactEvent, 'id'>) => {
    const id = impactIdCounter.current++;
    const newImpact: ImpactEvent = {
      ...data,
      id,
    };
    setImpacts((prev) => [...prev.slice(-20), newImpact]);

    // Trigger dynamic seismic camera shake based on impact severity and Astra type
    const astraMultiplier = data.astraType === 'agni' ? 2.3 : data.astraType === 'brahmashira' ? 1.4 : 1.0;
    const traumaAmount = (data.isCore ? 0.95 : 0.42 * (data.intensity || 1.0)) * astraMultiplier;
    cameraShakeRef.current?.addTrauma(Math.min(1.0, traumaAmount));
  }, []);

  const handleBowFire = useCallback((powerRatio: number) => {
    // Subtle kinetic recoil kick on bow release
    const recoilTrauma = 0.12 + powerRatio * 0.26;
    cameraShakeRef.current?.addTrauma(recoilTrauma);
  }, []);

  const handleExpireImpact = useCallback((id: number) => {
    setImpacts((prev) => prev.filter((evt) => evt.id !== id));
  }, []);

  const handleResetMountain = useCallback(() => {
    setResetTrigger((prev) => prev + 1);
    setImpacts([]);
    setMountainStats((prev) => ({
      ...prev,
      dislodgedPieces: 0,
      activePieces: prev.totalPieces,
      coreIntact: true,
      health: initializeMountainHealth(mountainMaterial, targetLevel),
    }));
  }, [mountainMaterial, targetLevel]);

  const handleToggleTrajectory = useCallback(() => {
    setShowTrajectory((prev) => !prev);
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#030008',
        cursor: isAiming ? 'crosshair' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 3.8, 8.6], fov: 56, far: 300 }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Cosmic Atmosphere, Lighting & Distant Stars */}
        <CosmicEnvironment />

        {/* Physics Simulation Container */}
        <Physics gravity={[0, -9.81, 0]}>
          {/* Milestone 1: Multi-Tiered Floating Celestial Island (Player Sanctum) */}
          <CelestialIsland />

          {/* Milestone 3: Destructible Mountain / Level 2 5x Planetoid across the Cosmic Chasm */}
          <DestructibleMountain
            key={`target_${mountainMaterial}_lvl${targetLevel}_${resetTrigger}`}
            materialType={mountainMaterial}
            level={targetLevel}
            onStatsChange={setMountainStats}
            onImpact={handleImpact}
          />

          {/* Milestone 2 & 5: Celestial Bow with Divine Astra Arsenal */}
          <CelestialBow
            selectedAstra={selectedAstra}
            onDragStateChange={setIsAiming}
            onPowerChange={setDrawPower}
            showTrajectory={showTrajectory}
            onImpact={handleImpact}
            onFire={handleBowFire}
          />

          {/* Milestone 4 & 5: High-Energy Collision & Impact FX */}
          <ImpactFX
            impacts={impacts}
            onExpire={handleExpireImpact}
          />
        </Physics>

        {/* Milestone 4: Dynamic Trauma-Based Camera Shake */}
        <CameraShakeRig ref={cameraShakeRef} />

        {/* Orbit Camera: Automatically disabled during bow aiming */}
        <OrbitControls
          makeDefault
          target={targetLevel === 2 ? [0, 10.0, -22] : [0, 4.8, -16]}
          enabled={!isAiming}
          enableDamping
          dampingFactor={0.06}
          minDistance={4}
          maxDistance={90}
          maxPolarAngle={Math.PI / 2 + 0.15}
        />
      </Canvas>

      {/* Cyber-Celestial HUD Overlay */}
      <GameHUD
        stats={mountainStats}
        isAiming={isAiming}
        powerPercent={drawPower}
        showTrajectory={showTrajectory}
        selectedAstra={selectedAstra}
        selectedMaterial={mountainMaterial}
        targetLevel={targetLevel}
        onSelectAstra={setSelectedAstra}
        onSelectMaterial={setMountainMaterial}
        onSelectLevel={setTargetLevel}
        onToggleTrajectory={handleToggleTrajectory}
        onResetMountain={handleResetMountain}
      />
    </div>
  );
}