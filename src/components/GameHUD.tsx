import { useEffect, useState } from 'react';
import type { MountainStats, AstraType, MountainMaterialType } from '../types/game';
import { ASTRA_CONFIGS, MOUNTAIN_TYPES } from '../types/game';

interface GameHUDProps {
  stats: MountainStats;
  isAiming: boolean;
  powerPercent: number;
  showTrajectory: boolean;
  selectedAstra: AstraType;
  selectedMaterial: MountainMaterialType;
  onSelectAstra: (astra: AstraType) => void;
  onSelectMaterial: (material: MountainMaterialType) => void;
  onToggleTrajectory: () => void;
  onResetMountain: () => void;
  onClearArrows?: () => void;
}

export function GameHUD({
  stats,
  isAiming,
  powerPercent,
  showTrajectory,
  selectedAstra,
  selectedMaterial,
  onSelectAstra,
  onSelectMaterial,
  onToggleTrajectory,
  onResetMountain,
}: GameHUDProps) {
  // Listen for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      if (key === 'r') {
        onResetMountain();
      } else if (key === 't') {
        onToggleTrajectory();
      } else if (key === '1') {
        onSelectAstra('astral');
      } else if (key === '2') {
        onSelectAstra('agni');
      } else if (key === '3') {
        onSelectAstra('vayu');
      } else if (key === '4') {
        onSelectAstra('brahmashira');
      } else if (key === 'b') {
        onSelectMaterial('Basalt');
      } else if (key === 'i') {
        onSelectMaterial('Iron');
      } else if (key === 'c') {
        onSelectMaterial('Crystal');
      } else if (key === 'd') {
        onSelectMaterial('DuctileRock');
      } else if (key === 'm') {
        // Cycle to next mountain material
        const order: MountainMaterialType[] = ['Basalt', 'Iron', 'Crystal', 'DuctileRock'];
        const curIdx = order.indexOf(selectedMaterial);
        const nextIdx = (curIdx + 1) % order.length;
        onSelectMaterial(order[nextIdx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResetMountain, onSelectAstra, onSelectMaterial, onToggleTrajectory, selectedMaterial]);

  const currentAstra = ASTRA_CONFIGS[selectedAstra] || ASTRA_CONFIGS.astral;
  const currentMaterial = MOUNTAIN_TYPES[selectedMaterial] || MOUNTAIN_TYPES.Basalt;

  // Track real-time health & trailing ghost damage bar
  const health = stats.health || {
    maxHealth: 680,
    currentHealth: 680,
    selectedMaterial: selectedMaterial,
  };
  const isFullyDestroyed = stats.totalPieces > 0 && stats.dislodgedPieces >= stats.totalPieces;
  const displayHealth = isFullyDestroyed ? 0 : health.currentHealth;
  const healthPercent = Math.max(
    0,
    Math.min(100, Math.round((displayHealth / health.maxHealth) * 100))
  );

  const [ghostPercent, setGhostPercent] = useState(healthPercent);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGhostPercent(healthPercent);
    }, 380);
    return () => clearTimeout(timer);
  }, [healthPercent]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 100, // Guarantees HUD is above Three.js canvas in the stacking context
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 24px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: '#f8fafc',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Title & Milestone Tag */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${currentAstra.color}44`,
            borderRadius: '12px',
            padding: '12px 18px',
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px ${currentAstra.color}22`,
            pointerEvents: 'auto',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '2px',
                background: 'linear-gradient(135deg, #38bdf8, #c084fc, #f43f5e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ASTRA.EXE
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: `${currentAstra.color}22`,
                color: currentAstra.color,
                border: `1px solid ${currentAstra.color}55`,
                letterSpacing: '0.8px',
              }}
            >
              MILESTONE 5 • DIVINE ASTRAS
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Active Weapon: <strong style={{ color: currentAstra.color }}>{currentAstra.name}</strong> • <span style={{ color: '#cbd5e1' }}>{currentAstra.subtitle}</span>
          </div>
        </div>

        {/* Mountain Health & Telemetry Monitor */}
        {(() => {
          const isWaveDmg = health.damageType === 'wave';
          const isVortexDmg = health.damageType === 'vortex';
          const showRecentDmg =
            !isFullyDestroyed &&
            !!health.lastDamageTaken &&
            performance.now() - (health.lastDamageTime || 0) < 1900;

          return (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.88)',
                backdropFilter: 'blur(14px)',
                border: `1px solid ${
                  isFullyDestroyed
                    ? '#ef4444'
                    : isWaveDmg && showRecentDmg
                    ? '#c084fc'
                    : `${currentMaterial.themeColor}55`
                }`,
                borderRadius: '12px',
                padding: '12px 18px',
                minWidth: '280px',
                boxShadow: isWaveDmg && showRecentDmg
                  ? '0 8px 32px rgba(0, 0, 0, 0.55), 0 0 20px rgba(192, 132, 252, 0.45)'
                  : `0 8px 32px rgba(0, 0, 0, 0.55), 0 0 16px ${isFullyDestroyed ? '#ef4444' : currentMaterial.themeColor}20`,
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                pointerEvents: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: isFullyDestroyed ? '#ef4444' : '#94a3b8',
                      fontWeight: 700,
                      letterSpacing: '0.8px',
                    }}
                  >
                    {isFullyDestroyed ? 'MOUNTAIN DESTROYED' : 'MOUNTAIN HEALTH'}
                  </span>
                  {showRecentDmg && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: isWaveDmg ? '#e879f9' : isVortexDmg ? '#c084fc' : '#f43f5e',
                        backgroundColor: isWaveDmg
                          ? 'rgba(192, 132, 252, 0.25)'
                          : isVortexDmg
                          ? 'rgba(192, 132, 252, 0.18)'
                          : 'rgba(244, 63, 94, 0.15)',
                        border: `1px solid ${
                          isWaveDmg ? '#c084fc' : isVortexDmg ? '#a855f7' : 'rgba(244, 63, 94, 0.4)'
                        }`,
                        padding: '1px 7px',
                        borderRadius: '4px',
                        boxShadow: isWaveDmg ? '0 0 10px rgba(192, 132, 252, 0.5)' : undefined,
                        letterSpacing: '0.4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      {isWaveDmg ? '⚡ WAVE -' : isVortexDmg ? '🌀 VORTEX -' : '-'}
                      {health.lastDamageTaken} {isWaveDmg ? 'HP' : 'DMG'}
                    </span>
                  )}
                  {isFullyDestroyed && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      CRUMBLED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>
                  <span
                    style={{
                      color:
                        displayHealth === 0
                          ? '#ef4444'
                          : healthPercent > 50
                          ? currentMaterial.themeColor
                          : healthPercent > 25
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {displayHealth}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {' '}/ {health.maxHealth} HP
                  </span>
                </div>
              </div>

              {/* Dynamic Health Bar with Lagging Ghost Damage Layer */}
              <div
                style={{
                  width: '100%',
                  height: '11px',
                  backgroundColor: 'rgba(30, 41, 59, 0.85)',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                  border: isWaveDmg && showRecentDmg ? '1px solid rgba(192, 132, 252, 0.65)' : '1px solid rgba(255, 255, 255, 0.08)',
                  position: 'relative',
                  boxShadow: isWaveDmg && showRecentDmg ? '0 0 12px rgba(192, 132, 252, 0.35)' : undefined,
                }}
              >
                {/* Lagging Ghost Damage Bar (smoothly slides to visualize health lost) */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${Math.max(healthPercent, ghostPercent)}%`,
                    height: '100%',
                    backgroundColor: isWaveDmg ? 'rgba(192, 132, 252, 0.7)' : 'rgba(239, 68, 68, 0.7)',
                    borderRadius: '5px',
                    transition: 'width 0.75s cubic-bezier(0.25, 1, 0.5, 1)',
                  }}
                />

                {/* Primary Real-Time Health Bar */}
                <div
                  style={{
                    position: 'relative',
                    width: `${healthPercent}%`,
                    height: '100%',
                    background:
                      healthPercent > 50
                        ? `linear-gradient(90deg, ${currentMaterial.themeColor}, ${currentMaterial.accentColor})`
                        : healthPercent > 25
                        ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : 'linear-gradient(90deg, #dc2626, #7f1d1d)',
                    boxShadow:
                      healthPercent > 50
                        ? `0 0 10px ${currentMaterial.themeColor}66`
                        : '0 0 10px #ef444466',
                    borderRadius: '5px',
                    transition: 'width 0.16s ease-out',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#cbd5e1',
                }}
              >
                <span>Armor Material:</span>
                <strong style={{ color: currentMaterial.themeColor }}>
                  {currentMaterial.name} ({health.maxHealth} HP)
                </strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#cbd5e1',
                  marginTop: '4px',
                }}
              >
                <span>Dislodged Fragments:</span>
                <strong style={{ color: currentMaterial.themeColor }}>
                  {stats.dislodgedPieces} / {stats.totalPieces}
                </strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#cbd5e1',
                  marginTop: '4px',
                }}
              >
                <span>Celestial Core:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: stats.coreIntact ? currentMaterial.themeColor : '#f43f5e',
                  }}
                >
                  {stats.coreIntact ? '✦ Shielded' : '⚡ BREACHED'}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Divine Weapon Arsenal Selector (Left-Side Dock) */}
      <div
        style={{
          position: 'absolute',
          left: '24px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'auto',
          zIndex: 110,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '12px 10px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
            width: '186px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#94a3b8',
              letterSpacing: '1.2px',
              paddingLeft: '4px',
              marginBottom: '2px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>WEAPONS</span>
            <span style={{ fontSize: '9px', opacity: 0.7 }}>KEYS [1-4]</span>
          </div>

          {Object.values(ASTRA_CONFIGS).map((astra) => {
            const isSelected = astra.id === selectedAstra;
            return (
              <button
                key={astra.id}
                type="button"
                onClick={() => onSelectAstra(astra.id)}
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${astra.color}28, ${astra.accentColor}36)`
                    : 'rgba(30, 41, 59, 0.6)',
                  border: isSelected
                    ? `2px solid ${astra.color}`
                    : '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  transition: 'all 0.18s ease',
                  boxShadow: isSelected
                    ? `0 0 16px ${astra.color}44, 0 4px 12px rgba(0,0,0,0.4)`
                    : 'none',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1.0)',
                }}
                onMouseOver={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = astra.color;
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                    e.currentTarget.style.transform = 'scale(1.0)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: `${astra.color}33`,
                      color: astra.color,
                      padding: '2px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    [{astra.hotkey}]
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: isSelected ? astra.color : '#94a3b8',
                      fontWeight: 700,
                    }}
                  >
                    {astra.id === 'agni' ? 'BLAST 2.2x' : astra.id === 'vayu' ? 'SPD 2.0x' : astra.id === 'brahmashira' ? 'VORTEX' : 'BALANCED'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isSelected ? '#ffffff' : '#e2e8f0',
                    marginTop: '2px',
                  }}
                >
                  {astra.name}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: isSelected ? astra.color : '#94a3b8',
                  }}
                >
                  {astra.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mountain Material Forge Selector (Right-Side Dock, Matching Weapons Dock) */}
      <div
        style={{
          position: 'absolute',
          right: '24px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'auto',
          zIndex: 110,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '12px 10px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
            width: '186px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#94a3b8',
              letterSpacing: '1.2px',
              paddingLeft: '4px',
              marginBottom: '2px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>MOUNTAIN</span>
            <span style={{ fontSize: '9px', opacity: 0.7 }}>KEYS [B-D]</span>
          </div>

          {(Object.keys(MOUNTAIN_TYPES) as MountainMaterialType[]).map((matKey) => {
            const conf = MOUNTAIN_TYPES[matKey];
            const isSelected = selectedMaterial === matKey;
            const badgeTag =
              matKey === 'Basalt'
                ? 'ARMOR 12x'
                : matKey === 'Iron'
                ? 'DENSE 18x'
                : matKey === 'Crystal'
                ? 'BRITTLE'
                : 'DEFORM';

            return (
              <button
                key={matKey}
                type="button"
                onClick={() => onSelectMaterial(matKey)}
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${conf.themeColor}28, ${conf.accentColor}36)`
                    : 'rgba(30, 41, 59, 0.6)',
                  border: isSelected
                    ? `2px solid ${conf.themeColor}`
                    : '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  transition: 'all 0.18s ease',
                  boxShadow: isSelected
                    ? `0 0 16px ${conf.themeColor}44, 0 4px 12px rgba(0,0,0,0.4)`
                    : 'none',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1.0)',
                }}
                onMouseOver={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = conf.themeColor;
                    e.currentTarget.style.transform = 'translateX(-3px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                    e.currentTarget.style.transform = 'scale(1.0)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: `${conf.themeColor}33`,
                      color: conf.themeColor,
                      padding: '2px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    [{conf.hotkey}]
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: isSelected ? conf.themeColor : '#94a3b8',
                      fontWeight: 700,
                    }}
                  >
                    {badgeTag}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isSelected ? '#ffffff' : '#e2e8f0',
                    marginTop: '2px',
                  }}
                >
                  {conf.name.replace(' Mountain', '')}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: isSelected ? conf.themeColor : '#94a3b8',
                  }}
                >
                  {conf.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Left-Adjacent Power Meter Gauge when drawing bow */}
      {isAiming && (
        <div
          style={{
            position: 'absolute',
            left: '222px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${currentAstra.color}66`,
            borderRadius: '16px',
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px ${currentAstra.color}33`,
            pointerEvents: 'none',
            width: '68px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '10px', color: currentAstra.color, fontWeight: 800, letterSpacing: '1px', marginBottom: '6px' }}>
            POWER
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', marginBottom: '10px' }}>
            {powerPercent}%
          </div>
          {/* Vertical Gauge Track */}
          <div
            style={{
              width: '12px',
              height: '140px',
              backgroundColor: 'rgba(30, 41, 59, 0.9)',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${powerPercent}%`,
                background: `linear-gradient(0deg, ${currentAstra.color}, ${currentAstra.accentColor}, #ffffff)`,
                borderRadius: '6px',
                transition: 'height 0.05s ease',
                boxShadow: `0 0 10px ${currentAstra.color}`,
              }}
            />
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, marginTop: '8px', letterSpacing: '0.5px' }}>
            CHARGE
          </div>
        </div>
      )}

      {/* Bottom Bar: Quick Controls & Instructions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Controls Instructions */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px 18px',
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: 1.6,
            pointerEvents: 'auto',
          }}
        >
          <div>🏹 <strong style={{ color: '#e2e8f0' }}>Click & Drag Bow:</strong> Draw string backwards to aim & charge</div>
          <div>🔢 <strong style={{ color: '#e2e8f0' }}>Keys [1, 2, 3, 4]:</strong> Switch Divine Astra types (Astral, Agni, Vayu, Brahmashira)</div>
          <div>🏔️ <strong style={{ color: '#e2e8f0' }}>Keys [B, I, C, D] or [M]:</strong> Forge Mountain Material (Basalt, Iron, Crystal, Ductile)</div>
          <div>🎥 <strong style={{ color: '#e2e8f0' }}>Drag Background:</strong> Orbit camera around island</div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto', flexWrap: 'wrap' }}>
          {/* Trajectory Guide Toggle */}
          <button
            type="button"
            onClick={onToggleTrajectory}
            style={{
              background: showTrajectory ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.85)',
              border: `1px solid ${showTrajectory ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)'}`,
              color: showTrajectory ? '#38bdf8' : '#cbd5e1',
              padding: '11px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: showTrajectory ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
              pointerEvents: 'auto',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
            onMouseOut={(e) =>
              (e.currentTarget.style.borderColor = showTrajectory ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)')
            }
          >
            Trajectory: <strong style={{ color: showTrajectory ? '#38bdf8' : '#94a3b8' }}>{showTrajectory ? 'ON' : 'OFF'}</strong>{' '}
            <span style={{ fontSize: '11px', opacity: 0.6 }}>[T]</span>
          </button>

          <button
            type="button"
            onClick={onResetMountain}
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #9333ea)',
              border: '1px solid rgba(192, 132, 252, 0.4)',
              color: '#ffffff',
              padding: '11px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(147, 51, 234, 0.4)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'auto',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            ✦ Rebuild Mountain <span style={{ fontSize: '11px', opacity: 0.8 }}>[R]</span>
          </button>
        </div>
      </div>
    </div>
  );
}
