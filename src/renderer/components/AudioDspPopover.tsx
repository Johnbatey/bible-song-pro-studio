import React, { useEffect, useRef } from 'react';
import { AppleToggle } from './AppleToggle';
import type { AudioDspOptions } from '../services/audio-capture';

interface AudioDspPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  dsp: AudioDspOptions;
  onChangeDsp: (next: AudioDspOptions) => void;
  anchorEl: HTMLElement | null;
}

export function AudioDspPopover({ isOpen, onClose, dsp, onChangeDsp, anchorEl }: AudioDspPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        (!anchorEl || !anchorEl.contains(e.target as Node))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen) return null;

  const currentGain = dsp.digitalGain ?? 1.0;
  const gainDb = 20 * Math.log10(currentGain);
  const formattedDb = `${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)} dB`;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 250,
        background: 'var(--bg-secondary, #18191f)',
        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25)',
        padding: '12px 14px',
        zIndex: 9999,
        color: 'var(--text-primary, #ffffff)',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        fontSize: 12,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-primary, #fff)' }}>
            Audio DSP &amp; Preamp
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: 2,
            cursor: 'pointer',
            color: 'var(--text-dim, #888)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* DSP Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 11.5 }}>Noise Suppression</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim, #888)' }}>Removes background fan / room hum</div>
          </div>
          <AppleToggle
            checked={Boolean(dsp.noiseSuppression)}
            onChange={(checked) => onChangeDsp({ ...dsp, noiseSuppression: checked })}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 11.5 }}>Echo Cancellation</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim, #888)' }}>Reduces speaker acoustic feedback</div>
          </div>
          <AppleToggle
            checked={Boolean(dsp.echoCancellation)}
            onChange={(checked) => onChangeDsp({ ...dsp, echoCancellation: checked })}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 11.5 }}>Auto Gain Control (AGC)</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim, #888)' }}>Hardware auto-volume leveling</div>
          </div>
          <AppleToggle
            checked={Boolean(dsp.autoGainControl)}
            onChange={(checked) => onChangeDsp({ ...dsp, autoGainControl: checked })}
          />
        </div>
      </div>

      {/* Manual Digital Preamp Gain Slider */}
      <div
        style={{
          background: 'var(--bg-card, rgba(255, 255, 255, 0.04))',
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 11 }}>Input Preamp Gain</span>
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: 11,
              fontWeight: 600,
              color: currentGain > 1.05 ? 'var(--tally-preview, #4ade80)' : currentGain < 0.95 ? 'var(--tally-hold, #facc15)' : 'var(--text-dim, #888)',
            }}
          >
            {currentGain.toFixed(2)}x ({formattedDb})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min="0.3"
            max="3.5"
            step="0.05"
            value={currentGain}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChangeDsp({ ...dsp, digitalGain: val });
            }}
            style={{
              flex: 1,
              accentColor: 'var(--accent-primary, #6366f1)',
              cursor: 'pointer',
            }}
          />
          {Math.abs(currentGain - 1.0) > 0.05 && (
            <button
              type="button"
              onClick={() => onChangeDsp({ ...dsp, digitalGain: 1.0 })}
              style={{
                background: 'var(--chrome-control, rgba(255, 255, 255, 0.1))',
                border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #fff)',
                fontSize: 9.5,
                fontWeight: 600,
                padding: '2px 5px',
                borderRadius: 4,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="Reset gain to unity (1.0x)"
            >
              1.0x
            </button>
          )}
        </div>
      </div>

      {/* Tip footer */}
      <div
        style={{
          fontSize: 9.5,
          color: 'var(--text-dim, #888)',
          lineHeight: 1.35,
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          paddingTop: 6,
        }}
      >
        💡 <strong>Pro Tip:</strong> For direct mixer feeds, keep DSP toggles <strong>OFF</strong> and use the <strong>Gain Slider</strong> to dial in healthy green levels.
      </div>
    </div>
  );
}
