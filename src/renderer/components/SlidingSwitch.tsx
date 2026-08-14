import React from 'react';

export interface SlidingSwitchOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  title?: string;
}

interface SlidingSwitchProps {
  value: string;
  options: SlidingSwitchOption[];
  onChange: (value: string) => void;
  height?: number;
  style?: React.CSSProperties;
}

/**
 * Segmented switcher whose highlight slides between segments rather than
 * blinking on and off.
 *
 * Segments are forced to equal width (`flex: 1`) so the thumb can be positioned
 * arithmetically — with intrinsic widths a "Single Version" / "Dual Version"
 * pair would leave the thumb sitting off its label.
 */
export function SlidingSwitch({ value, options, onChange, height = 38, style }: SlidingSwitchProps) {
  const count = options.length || 1;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        background: 'var(--chrome-control)',
        borderRadius: 6,
        padding: 3,
        border: '1px solid var(--chrome-control)',
        flexShrink: 0,
        height,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: `calc(3px + ${activeIndex} * (100% - 6px) / ${count})`,
          width: `calc((100% - 6px) / ${count})`,
          background: 'var(--chrome-control-active)',
          border: '1px solid var(--chrome-control-active)',
          borderRadius: 4,
          boxSizing: 'border-box',
          transition: 'left var(--d-state) var(--ease)',
          zIndex: 1,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          title={option.title}
          style={{
            position: 'relative',
            zIndex: 2,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0 12px',
            height: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
