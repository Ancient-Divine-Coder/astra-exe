import { useEffect } from 'react';
import type { MountainStats } from '../types/game';

interface GameHUDProps {
  stats: MountainStats;
  isAiming: boolean;
  powerPercent: number;
  showTrajectory: boolean;
  onToggleTrajectory: () => void;
  onResetMountain: () => void;
  onClearArrows?: () => void;
}

export function GameHUD({
  stats,
  isAiming,
  powerPercent,
  showTrajectory,
  onToggleTrajectory,
  onResetMountain,
}: GameHUDProps) {
  // Listen for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key === 'r' || e.key === 'R') {
        onResetMountain();
      } else if (e.key === 't' || e.key === 'T') {
        onToggleTrajectory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResetMountain, onToggleTrajectory]);

  const intactPercent = stats.totalPieces > 0
    ? Math.max(0, Math.round(((stats.totalPieces - stats.dislodgedPieces) / stats.totalPieces) * 100))
    : 100;

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
        padding: '24px',
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
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '14px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(56, 189, 248, 0.1)',
            pointerEvents: 'auto',
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
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                letterSpacing: '0.8px',
              }}
            >
              MILESTONE 4 • IMPACT FX
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Celestial Archery • Dynamic Destruction • Collision & Impact FX
          </div>
        </div>

        {/* Mountain Telemetry Monitor */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(192, 132, 252, 0.25)',
            borderRadius: '12px',
            padding: '14px 20px',
            minWidth: '240px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>
              MOUNTAIN INTEGRITY
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: intactPercent > 40 ? '#38bdf8' : '#f43f5e' }}>
              {intactPercent}%
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: `${intactPercent}%`,
                height: '100%',
                background: intactPercent > 50
                  ? 'linear-gradient(90deg, #38bdf8, #818cf8)'
                  : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
            <span>Dislodged Fragments:</span>
            <strong style={{ color: '#c084fc' }}>{stats.dislodgedPieces} / {stats.totalPieces}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
            <span>Celestial Core:</span>
            <span
              style={{
                fontWeight: 700,
                color: stats.coreIntact ? '#38bdf8' : '#f43f5e',
              }}
            >
              {stats.coreIntact ? '✦ Shielded' : '⚡ BREACHED'}
            </span>
          </div>
        </div>
      </div>

      {/* Right-Side Power Meter Gauge when drawing bow (Unobstructed Center View!) */}
      {isAiming && (
        <div
          style={{
            position: 'absolute',
            right: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '16px',
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.25)',
            pointerEvents: 'none',
            width: '68px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 800, letterSpacing: '1px', marginBottom: '6px' }}>
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
                background: 'linear-gradient(0deg, #38bdf8, #c084fc, #f43f5e)',
                borderRadius: '6px',
                transition: 'height 0.05s ease',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.8)',
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
            background: 'rgba(15, 23, 42, 0.8)',
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
          <div>🎯 <strong style={{ color: '#e2e8f0' }}>Release:</strong> Fire high-velocity projectile into floating mountain</div>
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
