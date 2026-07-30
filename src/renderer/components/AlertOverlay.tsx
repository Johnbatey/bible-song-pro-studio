import { useEffect, useRef } from 'react';
import type { Alert } from '../types';

interface AlertOverlayProps {
  alert: Alert;
  onDismiss: () => void;
}

export function AlertOverlay({ alert, onDismiss }: AlertOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alert.duration > 0) {
      const timer = setTimeout(onDismiss, alert.duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [alert, onDismiss]);

  const getAlertColor = () => {
    switch (alert.type) {
      case 'warning': return { bg: 'rgba(231, 76, 60, 0.95)', border: '#e74c3c' };
      case 'announcement': return { bg: 'rgba(201, 169, 110, 0.95)', border: '#C9A96E' };
      case 'custom': return { bg: 'rgba(0,0,0,0.9)', border: 'var(--border-accent)' };
      default: return { bg: 'rgba(52, 152, 219, 0.95)', border: '#3498db' };
    }
  };

  const colors = getAlertColor();

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        padding: '16px 32px',
        background: colors.bg,
        borderBottom: `2px solid ${colors.border}`,
        borderLeft: `1px solid ${colors.border}`,
        borderRight: `1px solid ${colors.border}`,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        maxWidth: '80%',
        animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: 2 }}>
          {alert.type}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {alert.text}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          width: 24,
          height: 24,
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
