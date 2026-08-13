import React from 'react';

interface AppleToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function AppleToggle({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  style,
}: AppleToggleProps) {
  return (
    <label
      onClick={(e) => {
        if (disabled) return;
        e.preventDefault();
        onChange(!checked);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: label ? 'space-between' : 'center',
        gap: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          {label && <span style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>{label}</span>}
          {description && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{description}</span>}
        </div>
      )}
      <div
        style={{
          position: 'relative',
          width: 38,
          height: 22,
          borderRadius: 6,
          background: checked ? '#FF5500' : '#2a2a2e',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'background 0.2s ease, border-color 0.2s ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </label>
  );
}
