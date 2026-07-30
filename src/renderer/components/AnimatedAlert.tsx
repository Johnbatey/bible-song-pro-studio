import { useEffect, useState } from 'react';
import type { Alert } from '../types';

interface AnimatedAlertProps {
  alert: Alert;
  onDismiss: () => void;
}

export function AnimatedAlert({ alert, onDismiss }: AnimatedAlertProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');

  useEffect(() => {
    setPhase('entering');
    const enterTimer = setTimeout(() => setPhase('visible'), 50);
    const exitTimer = setTimeout(() => setPhase('exiting'), (alert.duration - 0.5) * 1000);
    const dismissTimer = setTimeout(onDismiss, alert.duration * 1000 + 300);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [alert.id]);

  const getColors = () => {
    switch (alert.type) {
      case 'warning': return { bg: 'rgba(231, 76, 60, 0.95)', border: '#e74c3c', accent: '#ff6b6b' };
      case 'announcement': return { bg: 'rgba(201, 169, 110, 0.95)', border: '#C9A96E', accent: '#F4E4B0' };
      case 'custom': return { bg: 'rgba(0,0,0,0.9)', border: 'var(--border-accent)', accent: '#C9A96E' };
      default: return { bg: 'rgba(52, 152, 219, 0.95)', border: '#3498db', accent: '#5dade2' };
    }
  };

  const colors = getColors();
  const isVisible = phase !== 'exiting';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        zIndex: 9999,
        transform: `translateX(-50%) translateY(${phase === 'entering' ? '-100%' : '0'})`,
        opacity: phase === 'visible' ? 1 : 0,
        transition: `all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)`,
        padding: '14px 32px',
        background: colors.bg,
        borderBottom: `2px solid ${colors.border}`,
        borderLeft: `1px solid ${colors.border}`,
        borderRight: `1px solid ${colors.border}`,
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        maxWidth: '80%',
        pointerEvents: phase === 'exiting' ? 'none' : 'auto',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 3,
          height: 28,
          background: colors.accent,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            opacity: 0.7,
            marginBottom: 2,
          }}
        >
          {alert.type}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>
          {alert.text}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      >
        ✕
      </button>
    </div>
  );
}
