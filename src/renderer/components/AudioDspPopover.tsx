import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AppleToggle } from './AppleToggle';
import type { AudioDspOptions } from '../services/audio-capture';
import type { AudioMeterState } from '../types';

interface AudioDspPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  dsp: AudioDspOptions;
  onChangeDsp: (next: AudioDspOptions) => void;
  anchorEl: HTMLElement | null;
  meter?: AudioMeterState;
}

interface SleekSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
  accentColor?: string;
  style?: React.CSSProperties;
}

function SleekSlider({ min, max, step, value, onChange, accentColor = '#6366f1', style }: SleekSliderProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="bsp-sleek-slider"
      style={{
        ...style,
        background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%, rgba(255, 255, 255, 0.12) 100%)`,
      }}
    />
  );
}

const POPOVER_WIDTH = 295;

export function AudioDspPopover({ isOpen, onClose, dsp, onChangeDsp, anchorEl, meter }: AudioDspPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const measure = useCallback(() => {
    if (!anchorEl) return;
    const anchor = anchorEl.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight || 420;

    // Check if there's enough space below the button, otherwise display above
    const spaceBelow = window.innerHeight - anchor.bottom;
    let top: number;
    if (spaceBelow >= popoverHeight + 8 || spaceBelow >= anchor.top) {
      top = Math.min(window.innerHeight - popoverHeight - 12, anchor.bottom + 6);
    } else {
      top = Math.max(12, anchor.top - popoverHeight - 6);
    }

    // Center popover horizontally directly underneath the anchor button, clamped to window
    const anchorCenter = anchor.left + anchor.width / 2;
    const idealLeft = anchorCenter - POPOVER_WIDTH / 2;
    const safeLeft = Math.max(12, Math.min(idealLeft, window.innerWidth - POPOVER_WIDTH - 12));

    setCoords({ top, left: safeLeft });
  }, [anchorEl]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    measure();
    const req = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(req);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || anchorEl?.contains(target)) return;
      onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const timerId = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen || !coords) return null;

  const currentGain = dsp.digitalGain ?? 1.0;
  const gainDb = 20 * Math.log10(currentGain);
  const formattedDb = `${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)} dB`;
  const suppressionLevel = dsp.noiseSuppressionLevel || 'aggressive';
  const sensitivity = dsp.noiseSuppressionSensitivity ?? 1.0;
  const isVoiceActive = meter?.isVoiceActive ?? false;
  const gateGain = meter?.gateGain ?? 1.0;
  const isNoiseSuppressed = Boolean(dsp.noiseSuppression);

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: POPOVER_WIDTH,
        background: 'var(--bsp-surface, #1C1A19)',
        border: '1px solid var(--bsp-edge, #2D2A28)',
        borderRadius: 8,
        boxShadow: '0 16px 44px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        padding: '12px 14px',
        zIndex: 99999,
        color: 'var(--text-primary, #ffffff)',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        fontSize: 12,
        backdropFilter: 'blur(20px)',
      }}
    >
      <style>{`
        .bsp-sleek-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3.5px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
          margin: 4px 0;
          transition: opacity 0.15s ease;
        }
        .bsp-sleek-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .bsp-sleek-slider:hover::-webkit-slider-thumb {
          transform: scale(1.2);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.7), 0 0 0 2px rgba(255, 255, 255, 0.35);
        }
        .bsp-sleek-slider:active::-webkit-slider-thumb {
          transform: scale(1.08);
        }
      `}</style>

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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-dim, #888)',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-dim, #888)';
          }}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Headphone Monitor Section */}
      <div
        style={{
          background: dsp.isHeadphoneMonitoring ? 'rgba(74, 222, 128, 0.08)' : 'var(--bg-card, rgba(255, 255, 255, 0.04))',
          padding: '8px 10px',
          borderRadius: 6,
          border: `1px solid ${dsp.isHeadphoneMonitoring ? 'rgba(74, 222, 128, 0.35)' : 'var(--border-subtle, rgba(255, 255, 255, 0.06))'}`,
          marginBottom: 10,
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dsp.isHeadphoneMonitoring ? 6 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dsp.isHeadphoneMonitoring ? '#4ade80' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 11.5, color: dsp.isHeadphoneMonitoring ? '#4ade80' : 'inherit', whiteSpace: 'nowrap' }}>
                Headphone Monitor
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-dim, #888)', whiteSpace: 'nowrap' }}>
                {dsp.isHeadphoneMonitoring ? 'Listening to post-DSP audio live' : 'Monitor muted'}
              </div>
            </div>
          </div>
          <AppleToggle
            checked={Boolean(dsp.isHeadphoneMonitoring)}
            onChange={(checked) => onChangeDsp({ ...dsp, isHeadphoneMonitoring: checked })}
          />
        </div>

        {dsp.isHeadphoneMonitoring && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 9.5, color: 'var(--text-dim, #888)', minWidth: 24 }}>Vol</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <SleekSlider
                min={0}
                max={1}
                step={0.05}
                value={dsp.monitorVolume ?? 1.0}
                onChange={(vol) => onChangeDsp({ ...dsp, monitorVolume: vol })}
                accentColor="#4ade80"
              />
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 9.5, minWidth: 28, textAlign: 'right', color: 'var(--text-dim, #888)' }}>
              {Math.round((dsp.monitorVolume ?? 1.0) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* DSP Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {/* Noise Suppression & Mode Selector */}
        <div
          style={{
            background: isNoiseSuppressed ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
            padding: isNoiseSuppressed ? '8px 10px' : '0 2px',
            borderRadius: 6,
            border: isNoiseSuppressed ? '1px solid rgba(99, 102, 241, 0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                Noise Suppression
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-dim, #888)', marginTop: 1, whiteSpace: 'nowrap' }}>
                Adaptive spectral room gate
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {isNoiseSuppressed && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    fontSize: 8.5,
                    lineHeight: 1,
                    padding: '2.5px 5.5px',
                    borderRadius: 3.5,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    background: isVoiceActive ? 'rgba(74, 222, 128, 0.16)' : 'rgba(239, 68, 68, 0.14)',
                    color: isVoiceActive ? '#4ade80' : '#f87171',
                    border: `1px solid ${isVoiceActive ? 'rgba(74, 222, 128, 0.35)' : 'rgba(239, 68, 68, 0.3)'}`,
                    letterSpacing: '0.02em',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {isVoiceActive ? (
                    <>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                      <span>VOICE</span>
                    </>
                  ) : (
                    <>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                      <span>GATED ({Math.round(20 * Math.log10(Math.max(0.0001, gateGain)))} dB)</span>
                    </>
                  )}
                </span>
              )}
              <AppleToggle
                checked={isNoiseSuppressed}
                onChange={(checked) => onChangeDsp({ ...dsp, noiseSuppression: checked })}
              />
            </div>
          </div>

          {isNoiseSuppressed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {/* Profile Selector */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0, 0, 0, 0.25)', padding: 2, borderRadius: 5 }}>
                <button
                  type="button"
                  onClick={() => onChangeDsp({ ...dsp, noiseSuppressionLevel: 'aggressive' })}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontSize: 9.5,
                    fontWeight: suppressionLevel === 'aggressive' ? 700 : 500,
                    background: suppressionLevel === 'aggressive' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                    color: suppressionLevel === 'aggressive' ? '#fff' : 'var(--text-dim, #888)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                  title="Deep background noise elimination (Google Meet & Zoom standard)"
                >
                  Meet / Zoom
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDsp({ ...dsp, noiseSuppressionLevel: 'studio' })}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontSize: 9.5,
                    fontWeight: suppressionLevel === 'studio' ? 700 : 500,
                    background: suppressionLevel === 'studio' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                    color: suppressionLevel === 'studio' ? '#fff' : 'var(--text-dim, #888)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                  title="Natural studio expander (-20 dB room reduction, best for singing)"
                >
                  Studio
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDsp({ ...dsp, noiseSuppressionLevel: 'extreme' })}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontSize: 9.5,
                    fontWeight: suppressionLevel === 'extreme' ? 700 : 500,
                    background: suppressionLevel === 'extreme' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                    color: suppressionLevel === 'extreme' ? '#fff' : 'var(--text-dim, #888)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                  title="Extreme isolation (-72 dB total silence during pauses)"
                >
                  Extreme
                </button>
              </div>

              {/* Sensitivity Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 9.5, color: 'var(--text-dim, #888)', minWidth: 52 }}>Sensitivity</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <SleekSlider
                    min={0.3}
                    max={2.5}
                    step={0.1}
                    value={sensitivity}
                    onChange={(val) => onChangeDsp({ ...dsp, noiseSuppressionSensitivity: val })}
                    accentColor="var(--accent-primary, #6366f1)"
                  />
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 9.5, minWidth: 26, textAlign: 'right', color: 'var(--text-dim, #888)' }}>
                  {sensitivity === 1.0 ? 'Auto' : `${sensitivity.toFixed(1)}x`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 11.5 }}>Echo Cancellation</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-dim, #888)' }}>Reduces speaker acoustic feedback</div>
          </div>
          <AppleToggle
            checked={Boolean(dsp.echoCancellation)}
            onChange={(checked) => onChangeDsp({ ...dsp, echoCancellation: checked })}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 11.5 }}>Auto Gain Control (AGC)</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-dim, #888)' }}>Broadcast dynamics leveler &amp; compressor</div>
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
              fontSize: 10.5,
              fontWeight: 600,
              color: currentGain > 1.05 ? 'var(--tally-preview, #4ade80)' : currentGain < 0.95 ? 'var(--tally-hold, #facc15)' : 'var(--text-dim, #888)',
            }}
          >
            {currentGain.toFixed(2)}x ({formattedDb})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <SleekSlider
              min={0.3}
              max={3.5}
              step={0.05}
              value={currentGain}
              onChange={(val) => onChangeDsp({ ...dsp, digitalGain: val })}
              accentColor="var(--accent-primary, #6366f1)"
            />
          </div>
          {Math.abs(currentGain - 1.0) > 0.05 && (
            <button
              type="button"
              onClick={() => onChangeDsp({ ...dsp, digitalGain: 1.0 })}
              style={{
                background: 'var(--chrome-control, rgba(255, 255, 255, 0.1))',
                border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                color: 'var(--text-primary, #fff)',
                fontSize: 9,
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
          display: 'flex',
          alignItems: 'flex-start',
          gap: 5,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent-primary, #6366f1)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <strong>Pro Tip:</strong> Select <strong>Meet / Zoom</strong> to actively eliminate fan, AC, and room noise with sub-millisecond voice attack.
        </div>
      </div>
    </div>,
    document.body
  );
}
