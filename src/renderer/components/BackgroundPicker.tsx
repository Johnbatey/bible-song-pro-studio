/* =========================================================================
   BackgroundPicker — choose the ground a scene sits on
   -------------------------------------------------------------------------
   Speaks `Background`, the structured shape a scene carries, so what this
   writes is exactly what ProgramSurface resolves. The theme editor keeps its
   own flat CSS fields and its own controls; what the two share is the media
   grid and the gradient maths, not this whole component.

   "Theme" is a real option and the default one: clearing a background is what
   puts a song back under whatever the operator has themed, so it needs to be a
   choice rather than something you reach by deleting.
   ========================================================================= */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Background, MediaItem } from '../types';
import { MediaGrid } from './MediaGrid';
import { type as typeStyles } from '../styles/type';
import {
  gradientCss,
  parseBackgroundInfo,
  DEFAULT_GROUND,
  DEFAULT_GRADIENT_START,
  DEFAULT_GRADIENT_END,
} from '../utils/background';

type Choice = 'theme' | 'image' | 'video' | 'solid' | 'gradient';

interface ChoiceItem {
  id: Choice;
  label: string;
  icon: React.ReactNode;
}

const CHOICES: ChoiceItem[] = [
  {
    id: 'theme',
    label: 'Theme',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    id: 'image',
    label: 'Image',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: 'video',
    label: 'Video',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    id: 'solid',
    label: 'Colour',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
  },
  {
    id: 'gradient',
    label: 'Gradient',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
];

const PRO_GRADIENT_PRESETS = [
  { name: 'Midnight', start: '#0a0d18', end: '#1e293b', dir: '135deg' },
  { name: 'Royal', start: '#0d0b20', end: '#312e81', dir: '135deg' },
  { name: 'Crimson', start: '#2a0808', end: '#7c2d12', dir: '135deg' },
  { name: 'Emerald', start: '#022018', end: '#064e3b', dir: '135deg' },
  { name: 'Charcoal', start: '#09090b', end: '#27272a', dir: '135deg' },
  { name: 'Ocean', start: '#041f30', end: '#075985', dir: '135deg' },
];

const PRO_SOLID_PRESETS = [
  '#000000',
  '#0c0e14',
  '#0B132B',
  '#1a0f16',
  '#0a1a12',
  '#1c1c20',
];

interface BackgroundPickerProps {
  value: Background | undefined;
  /** `undefined` means "no background of its own" — fall through to the theme. */
  onChange: (next: Background | undefined) => void;
}

/**
 * Circular Angle Dial (Photoshop / Illustrator style)
 * Dragging rotates the angle from 0 to 360 degrees.
 */
function CircularAngleDial({
  angleDeg,
  isRadial,
  onChangeAngle,
  onToggleRadial,
}: {
  angleDeg: number;
  isRadial: boolean;
  onChangeAngle: (deg: number) => void;
  onToggleRadial: () => void;
}) {
  const dialRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateAngleFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    // In CSS linear-gradient: 0deg = Up (0, -1), 90deg = Right (1, 0), 180deg = Down (0, 1), 270deg = Left (-1, 0)
    const angleRad = Math.atan2(dx, -dy);
    let deg = Math.round((angleRad * 180) / Math.PI);
    if (deg < 0) deg += 360;

    // Optional subtle snap to cardinal & diagonal angles (within 4 degrees)
    const snapPoints = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    for (const p of snapPoints) {
      if (Math.abs(deg - p) <= 4) {
        deg = p === 360 ? 0 : p;
        break;
      }
    }

    onChangeAngle(deg);
  }, [onChangeAngle]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    calculateAngleFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    calculateAngleFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  // Needle tip position on 32px dial (center 16, radius 11)
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const needleLength = 10;
  const cx = 16;
  const cy = 16;
  const nx = cx + Math.cos(rad) * needleLength;
  const ny = cy + Math.sin(rad) * needleLength;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Circular interactive dial */}
      <div
        style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}
        title={isRadial ? 'Radial gradient active' : `Angle: ${angleDeg}° (drag to rotate)`}
      >
        <svg
          ref={dialRef}
          width="32"
          height="32"
          viewBox="0 0 32 32"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            cursor: isRadial ? 'default' : 'crosshair',
            touchAction: 'none',
            opacity: isRadial ? 0.35 : 1,
            userSelect: 'none',
          }}
        >
          {/* Outer ring */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="var(--bg-surface, #18181b)"
            stroke="var(--border-primary, rgba(255,255,255,0.15))"
            strokeWidth="1.5"
          />
          {/* Cardinal tick marks */}
          <line x1="16" y1="3" x2="16" y2="5" stroke="var(--text-dim, rgba(255,255,255,0.3))" strokeWidth="1" />
          <line x1="29" y1="16" x2="27" y2="16" stroke="var(--text-dim, rgba(255,255,255,0.3))" strokeWidth="1" />
          <line x1="16" y1="29" x2="16" y2="27" stroke="var(--text-dim, rgba(255,255,255,0.3))" strokeWidth="1" />
          <line x1="3" y1="16" x2="5" y2="16" stroke="var(--text-dim, rgba(255,255,255,0.3))" strokeWidth="1" />

          {/* Center pivot dot */}
          <circle cx="16" cy="16" r="2" fill="var(--text-secondary, #a1a1aa)" />

          {/* Radial Needle Line */}
          {!isRadial && (
            <>
              <line
                x1="16"
                y1="16"
                x2={nx}
                y2={ny}
                stroke="var(--accent, #FF5500)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle
                cx={nx}
                cy={ny}
                r="3"
                fill="var(--accent, #FF5500)"
                stroke="#ffffff"
                strokeWidth="0.8"
              />
            </>
          )}
        </svg>
      </div>

      {/* Degree Badge / Readout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button
          type="button"
          onClick={onToggleRadial}
          title={isRadial ? 'Switch to Linear gradient' : 'Switch to Radial gradient'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-ui)',
            background: isRadial ? 'rgba(255, 85, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${isRadial ? 'var(--accent, #FF5500)' : 'var(--border-primary, rgba(255,255,255,0.12))'}`,
            borderRadius: 4,
            color: isRadial ? 'var(--accent, #FF5500)' : 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {isRadial ? 'Radial' : `${angleDeg}°`}
        </button>
      </div>
    </div>
  );
}

export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const choice: Choice = value?.type === 'transparent' ? 'theme' : (value?.type ?? 'theme');
  const info = parseBackgroundInfo(value?.gradient, value?.color);

  // Extract numerical degrees from direction or default
  const isRadial = info.dir === 'radial';
  const numericAngle = parseInt(info.dir.replace('deg', ''), 10) || 135;

  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);
  const solidInputRef = useRef<HTMLInputElement | null>(null);

  const setChoice = (next: Choice) => {
    if (next === choice) return;
    switch (next) {
      case 'theme':
        onChange(undefined);
        break;
      case 'solid':
        onChange({
          type: 'solid',
          color: value?.color || info.color || DEFAULT_GROUND,
          gradient: value?.gradient || gradientCss(info.start, info.end, info.dir),
        });
        break;
      case 'gradient':
        onChange({
          type: 'gradient',
          gradient: value?.gradient || gradientCss(info.start || DEFAULT_GRADIENT_START, info.end || DEFAULT_GRADIENT_END, info.dir || '135deg'),
          color: value?.color || info.color || DEFAULT_GROUND,
        });
        break;
      case 'image':
      case 'video':
        onChange({
          type: next,
          mediaUrl: value?.mediaUrl || '',
          mediaType: next,
          fit: value?.fit || 'cover',
          loop: value?.loop !== false,
          opacity: typeof value?.opacity === 'number' ? value.opacity : 1,
          gradient: value?.gradient,
          color: value?.color,
        });
        break;
    }
  };

  const pickMedia = (item: MediaItem) => {
    onChange({
      type: item.type,
      mediaUrl: item.url,
      mediaType: item.type,
      fit: value?.fit || 'cover',
      loop: value?.loop !== false,
      opacity: typeof value?.opacity === 'number' ? value.opacity : 1,
    });
  };

  const setGradient = (parts: { start?: string; end?: string; dir?: string }) => {
    const start = parts.start ?? info.start;
    const end = parts.end ?? info.end;
    const dir = parts.dir ?? info.dir;
    onChange({ type: 'gradient', gradient: gradientCss(start, end, dir) });
  };

  const handleSwapGradient = () => {
    setGradient({ start: info.end, end: info.start });
  };

  const handleAngleChange = (deg: number) => {
    setGradient({ dir: `${deg}deg` });
  };

  const handleToggleRadial = () => {
    if (isRadial) {
      setGradient({ dir: '135deg' });
    } else {
      setGradient({ dir: 'radial' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {/* Sleek Segmented Control Tab Bar with SVG Icons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'var(--bg-surface, #141416)',
          border: '1px solid var(--border-primary, rgba(255,255,255,0.08))',
          borderRadius: 6,
          padding: 2,
          width: '100%',
          flexShrink: 0,
        }}
      >
        {CHOICES.map((c) => {
          const isActive = choice === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChoice(c.id)}
              style={{
                flex: 1,
                minWidth: 28,
                height: 24,
                padding: '0 4px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: isActive ? 'var(--accent, #FF5500)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
              }}
              title={c.label}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isActive ? 1 : 0.75 }}>
                {c.icon}
              </span>
            </button>
          );
        })}
      </div>

      {/* THEME MODE: Minimal notice */}
      {choice === 'theme' && (
        <div style={{ ...typeStyles.caption, color: 'var(--text-dim)', fontSize: 10.5, padding: '2px 4px' }}>
          Follows the active theme, the same as Scripture does.
        </div>
      )}

      {/* IMAGE / VIDEO MODE: Compact Media Grid */}
      {(choice === 'image' || choice === 'video') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MediaGrid kind={choice} selectedUrl={value?.mediaUrl || ''} onSelect={pickMedia} />
          {choice === 'video' && value?.mediaUrl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...typeStyles.caption, color: 'var(--text-secondary)', fontSize: 10.5, cursor: 'pointer', marginTop: 2 }}>
              <input
                type="checkbox"
                checked={value?.loop !== false}
                onChange={(e) => onChange({ ...value, loop: e.target.checked })}
                style={{ accentColor: 'var(--accent, #FF5500)', cursor: 'pointer' }}
              />
              Loop video continuously
            </label>
          )}
        </div>
      )}

      {/* SOLID COLOUR MODE: Compact Swatch + Hex + Pro Palette */}
      {choice === 'solid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Native color trigger */}
            <div
              onClick={() => solidInputRef.current?.click()}
              style={{
                width: 28,
                height: 24,
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.2)',
                background: value?.color || DEFAULT_GROUND,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
              }}
              title="Click to pick colour"
            />
            <input
              ref={solidInputRef}
              type="color"
              value={(value?.color || DEFAULT_GROUND).startsWith('#') ? (value?.color || DEFAULT_GROUND) : DEFAULT_GROUND}
              onChange={(e) => onChange({ type: 'solid', color: e.target.value })}
              style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={value?.color || DEFAULT_GROUND}
              onChange={(e) => onChange({ type: 'solid', color: e.target.value })}
              style={{
                flex: 1,
                height: 24,
                padding: '0 6px',
                fontSize: 11,
                fontFamily: 'monospace',
                background: 'var(--bg-surface, #18181b)',
                border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
                borderRadius: 4,
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Quick Curated Dark Theme Swatches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
              Presets:
            </span>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {PRO_SOLID_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onChange({ type: 'solid', color: hex })}
                  style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 3,
                    border: (value?.color || DEFAULT_GROUND).toLowerCase() === hex.toLowerCase() ? '1.5px solid var(--accent, #FF5500)' : '1px solid rgba(255,255,255,0.15)',
                    background: hex,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GRADIENT MODE: Pro Photoshop / Illustrator Style Interactive Gradient Editor */}
      {choice === 'gradient' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
          {/* Row 1: Interactive Live Gradient Bar with Color Stop Handles & Swap Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Start Color Stop Handle / Swatch */}
            <div
              onClick={() => startInputRef.current?.click()}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.25)',
                background: info.start.startsWith('#') ? info.start : DEFAULT_GRADIENT_START,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`Start Colour: ${info.start} (click to change)`}
            >
              <input
                ref={startInputRef}
                type="color"
                value={info.start.startsWith('#') ? info.start : DEFAULT_GRADIENT_START}
                onChange={(e) => setGradient({ start: e.target.value })}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
              />
            </div>

            {/* Live Gradient Preview Strip */}
            <div
              style={{
                flex: 1,
                height: 22,
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: isRadial
                  ? `radial-gradient(circle, ${info.start}, ${info.end})`
                  : `linear-gradient(to right, ${info.start}, ${info.end})`,
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                position: 'relative',
              }}
              title="Live gradient spectrum (Start -> End)"
            />

            {/* Swap Button */}
            <button
              type="button"
              onClick={handleSwapGradient}
              title="Swap Start & End Colours"
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 5h18" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 19H3" />
              </svg>
            </button>

            {/* End Color Stop Handle / Swatch */}
            <div
              onClick={() => endInputRef.current?.click()}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.25)',
                background: info.end.startsWith('#') ? info.end : DEFAULT_GRADIENT_END,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`End Colour: ${info.end} (click to change)`}
            >
              <input
                ref={endInputRef}
                type="color"
                value={info.end.startsWith('#') ? info.end : DEFAULT_GRADIENT_END}
                onChange={(e) => setGradient({ end: e.target.value })}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
              />
            </div>
          </div>

          {/* Row 2: Circular Angle Dial (Photoshop Style) + Pro Gradient Presets */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {/* Circular Angle Dial */}
            <CircularAngleDial
              angleDeg={numericAngle}
              isRadial={isRadial}
              onChangeAngle={handleAngleChange}
              onToggleRadial={handleToggleRadial}
            />

            {/* Pro Gradient Preset Swatches */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
              {PRO_GRADIENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setGradient({ start: preset.start, end: preset.end, dir: preset.dir })}
                  style={{
                    width: 20,
                    height: 18,
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    flexShrink: 0,
                  }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
