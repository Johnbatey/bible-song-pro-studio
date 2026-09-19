/* =========================================================================
   BackgroundPicker — choose the ground a scene sits on
   -------------------------------------------------------------------------
   Speaks `Background`, the structured shape a scene carries, so what this
   writes is exactly what ProgramSurface resolves. The theme editor keeps its
   own flat CSS fields and its own controls; what the two share is the media
   grid and the gradient maths.
   ========================================================================= */
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Background, MediaItem, Theme } from '../types';
import { MediaGrid } from './MediaGrid';
import { type as typeStyles, fontWeight } from '../styles/type';
import { useDraggableModal } from '../hooks/useDraggableModal';
import {
  gradientCss,
  parseBackgroundInfo,
  DEFAULT_GROUND,
  DEFAULT_GRADIENT_START,
  DEFAULT_GRADIENT_END,
} from '../utils/background';

export type Choice = 'transparent' | 'solid' | 'gradient' | 'image' | 'video';

export const PRO_GRADIENT_PRESETS = [
  { name: 'Midnight', start: '#0a0f1d', end: '#1e293b', dir: '135deg' },
  { name: 'Royal Indigo', start: '#0f0c29', end: '#302b63', dir: '135deg' },
  { name: 'Crimson Plum', start: '#2b0914', end: '#831843', dir: '135deg' },
  { name: 'Emerald Deep', start: '#022c22', end: '#065f46', dir: '135deg' },
  { name: 'Ocean Azure', start: '#082f49', end: '#0284c7', dir: '135deg' },
  { name: 'Charcoal Zinc', start: '#18181b', end: '#3f3f46', dir: '135deg' },
];

const PRO_SOLID_PRESETS = [
  '#000000',
  '#0c0e14',
  '#0B132B',
  '#18181b',
  '#0a1a12',
  '#1a0f16',
];

export interface BackgroundPickerProps {
  value: Background | undefined;
  /** `undefined` means "no background of its own" — fall through to the theme. */
  onChange: (next: Background | undefined) => void;
}

/**
 * Circular Angle Dial (Studio style)
 * Dragging rotates the angle from 0 to 360 degrees.
 */
export function CircularAngleDial({
  angleDeg,
  isRadial,
  onChangeAngle,
}: {
  angleDeg: number;
  isRadial: boolean;
  onChangeAngle: (deg: number) => void;
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

    // Subtle snap to cardinal & diagonal angles (within 4 degrees)
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

  // Needle tip position on 32px dial (center 16, radius 10)
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const needleLength = 9.5;
  const cx = 16;
  const cy = 16;
  const nx = cx + Math.cos(rad) * needleLength;
  const ny = cy + Math.sin(rad) * needleLength;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
          {/* Outer track circle */}
          <circle
            cx="16"
            cy="16"
            r="14.5"
            fill="var(--bsp-raised, #1D1B1C)"
            stroke="var(--border-primary, rgba(255, 255, 255, 0.14))"
            strokeWidth="1.2"
          />
          {/* Inner disc */}
          <circle
            cx="16"
            cy="16"
            r="11"
            fill="var(--bsp-booth, #0C0B0B)"
          />
          {/* Cardinal tick marks */}
          <line x1="16" y1="2.5" x2="16" y2="5" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" strokeLinecap="round" />
          <line x1="29.5" y1="16" x2="27" y2="16" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" strokeLinecap="round" />
          <line x1="16" y1="29.5" x2="16" y2="27" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" strokeLinecap="round" />
          <line x1="2.5" y1="16" x2="5" y2="16" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" strokeLinecap="round" />

          {/* Center pivot dot */}
          <circle cx="16" cy="16" r="2" fill="var(--text-dim, #a1a1aa)" />

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
                r="2.8"
                fill="var(--accent, #FF5500)"
                stroke="#ffffff"
                strokeWidth="1"
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export function getBackgroundFromTheme(theme: Theme | null, mode: 'fullscreen' | 'lowerThird'): Background {
  const surface = mode === 'lowerThird' ? theme?.lowerThird : theme?.fullScreen;
  if (!surface) return { type: 'transparent', color: 'transparent', gradient: 'transparent' };

  if (
    surface.backgroundType === 'transparent' ||
    surface.backgroundColor === 'transparent' ||
    surface.background === 'transparent'
  ) {
    return {
      type: 'transparent',
      color: 'transparent',
      gradient: 'transparent',
      opacity: typeof surface.backgroundOpacity === 'number' ? surface.backgroundOpacity : 1,
    };
  }

  if (surface.backgroundType === 'image' || (surface.backgroundMediaType === 'image' && surface.backgroundMediaUrl)) {
    return {
      type: 'image',
      mediaUrl: surface.backgroundMediaUrl || '',
      mediaType: 'image',
      fit: surface.backgroundFit || 'cover',
      opacity: typeof surface.backgroundOpacity === 'number' ? surface.backgroundOpacity : 1,
    };
  }
  if (surface.backgroundType === 'video' || (surface.backgroundMediaType === 'video' && surface.backgroundMediaUrl)) {
    return {
      type: 'video',
      mediaUrl: surface.backgroundMediaUrl || '',
      mediaType: 'video',
      fit: surface.backgroundFit || 'cover',
      loop: surface.backgroundLoop !== false,
      opacity: typeof surface.backgroundOpacity === 'number' ? surface.backgroundOpacity : 1,
    };
  }
  const bgGradient = (surface as any).backgroundGradient || (surface.backgroundType === 'gradient' ? surface.background : undefined);
  if (surface.backgroundType === 'gradient' || (bgGradient && bgGradient !== 'transparent')) {
    return {
      type: 'gradient',
      gradient: bgGradient || 'linear-gradient(135deg, #0a0f1d, #1e293b)',
      opacity: typeof surface.backgroundOpacity === 'number' ? surface.backgroundOpacity : 1,
    };
  }
  if (
    surface.backgroundType === 'solid' ||
    (surface.backgroundColor && surface.backgroundColor !== 'transparent') ||
    (surface.background && surface.background !== 'transparent')
  ) {
    const col =
      (surface.backgroundColor && surface.backgroundColor !== 'transparent' ? surface.backgroundColor : undefined) ||
      (surface.background && surface.background !== 'transparent' ? surface.background : undefined) ||
      '#000000';
    return {
      type: 'solid',
      color: col,
      opacity: typeof surface.backgroundOpacity === 'number' ? surface.backgroundOpacity : 1,
    };
  }

  return { type: 'transparent', color: 'transparent', gradient: 'transparent' };
}

/**
 * Clean, Pro-Studio BackgroundPicker Component
 */
export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const isAlpha =
    value?.type === 'transparent' ||
    value?.color === 'transparent' ||
    value?.gradient === 'transparent';
  const choice: Choice = isAlpha ? 'transparent' : ((value?.type as Choice) || 'gradient');
  const info = parseBackgroundInfo(value?.gradient, value?.color);

  const isRadial = info.dir === 'radial';
  const numericAngle = parseInt(info.dir.replace('deg', ''), 10) || 135;

  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);
  const solidInputRef = useRef<HTMLInputElement | null>(null);

  const memoryRef = useRef<{
    solidColor: string;
    gradient: string;
    imageUrl: string;
    imageFit: 'cover' | 'contain' | 'fill';
    videoUrl: string;
    videoFit: 'cover' | 'contain' | 'fill';
    videoLoop: boolean;
    opacity: number;
  }>({
    solidColor: value?.color && value.color !== 'transparent' ? value.color : '#0a0f1d',
    gradient: value?.gradient && value.gradient !== 'transparent' ? value.gradient : 'linear-gradient(135deg, #0a0f1d, #1e293b)',
    imageUrl: value?.type === 'image' && value?.mediaUrl ? value.mediaUrl : '',
    imageFit: value?.fit || 'cover',
    videoUrl: value?.type === 'video' && value?.mediaUrl ? value.mediaUrl : '',
    videoFit: value?.fit || 'cover',
    videoLoop: value?.loop !== false,
    opacity: typeof value?.opacity === 'number' ? value.opacity : 1,
  });

  useEffect(() => {
    if (!value) return;
    if (value.type === 'solid' && value.color && value.color !== 'transparent') {
      memoryRef.current.solidColor = value.color;
    } else if (value.type === 'gradient' && value.gradient && value.gradient !== 'transparent') {
      memoryRef.current.gradient = value.gradient;
      if (value.color && value.color !== 'transparent') memoryRef.current.solidColor = value.color;
    } else if (value.type === 'image' && value.mediaUrl) {
      memoryRef.current.imageUrl = value.mediaUrl;
      if (value.fit) memoryRef.current.imageFit = value.fit;
    } else if (value.type === 'video' && value.mediaUrl) {
      memoryRef.current.videoUrl = value.mediaUrl;
      if (value.fit) memoryRef.current.videoFit = value.fit;
      if (typeof value.loop === 'boolean') memoryRef.current.videoLoop = value.loop;
    }
    if (typeof value.opacity === 'number') {
      memoryRef.current.opacity = value.opacity;
    }
  }, [value]);

  const setChoice = (next: Choice) => {
    if (next === choice) return;
    switch (next) {
      case 'transparent':
        onChange({
          type: 'transparent',
          color: 'transparent',
          gradient: 'transparent',
          opacity: memoryRef.current.opacity,
        });
        break;
      case 'solid':
        onChange({
          type: 'solid',
          color: memoryRef.current.solidColor,
          opacity: memoryRef.current.opacity,
        });
        break;
      case 'gradient':
        onChange({
          type: 'gradient',
          gradient: memoryRef.current.gradient,
          color: memoryRef.current.solidColor,
          opacity: memoryRef.current.opacity,
        });
        break;
      case 'image':
        onChange({
          type: 'image',
          mediaUrl: memoryRef.current.imageUrl,
          mediaType: 'image',
          fit: memoryRef.current.imageFit,
          opacity: memoryRef.current.opacity,
        });
        break;
      case 'video':
        onChange({
          type: 'video',
          mediaUrl: memoryRef.current.videoUrl,
          mediaType: 'video',
          fit: memoryRef.current.videoFit,
          loop: memoryRef.current.videoLoop,
          opacity: memoryRef.current.opacity,
        });
        break;
    }
  };

  const pickMedia = (item: MediaItem) => {
    if (item.type === 'image') {
      memoryRef.current.imageUrl = item.url;
    } else if (item.type === 'video') {
      memoryRef.current.videoUrl = item.url;
    }
    onChange({
      type: item.type,
      mediaUrl: item.url,
      mediaType: item.type,
      fit: (item.type === 'image' ? memoryRef.current.imageFit : memoryRef.current.videoFit) || 'cover',
      loop: item.type === 'video' ? memoryRef.current.videoLoop : undefined,
      opacity: memoryRef.current.opacity,
    });
  };

  const setGradient = (parts: { start?: string; end?: string; dir?: string }) => {
    const start = parts.start ?? info.start;
    const end = parts.end ?? info.end;
    const dir = parts.dir ?? info.dir;
    const grad = gradientCss(start, end, dir);
    memoryRef.current.gradient = grad;
    onChange({ type: 'gradient', gradient: grad, opacity: memoryRef.current.opacity });
  };

  const handleSwapGradient = () => {
    setGradient({ start: info.end, end: info.start });
  };

  const handleAngleChange = (deg: number) => {
    setGradient({ dir: `${deg}deg` });
  };

  const currentOpacity = typeof value?.opacity === 'number' ? value.opacity : 1;

  const fieldBoxStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary, #D9D4D2)',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    background: 'var(--bsp-raised, #1D1B1C)',
    border: '1px solid var(--border-primary, #262628)',
    borderRadius: 6,
    color: 'var(--text-primary, #ffffff)',
    fontSize: 12,
    fontWeight: 500,
    padding: '0 10px',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* Fill Type Dropdown (Studio Standard) */}
      <div style={fieldBoxStyle}>
        <span style={fieldLabelStyle}>Fill Type</span>
        <select
          style={selectStyle}
          value={choice}
          onChange={(e) => setChoice(e.target.value as Choice)}
        >
          <option value="solid" style={{ background: '#161414', color: '#fff' }}>Solid Color</option>
          <option value="gradient" style={{ background: '#161414', color: '#fff' }}>Gradient</option>
          <option value="image" style={{ background: '#161414', color: '#fff' }}>Image</option>
          <option value="video" style={{ background: '#161414', color: '#fff' }}>Video</option>
          <option value="transparent" style={{ background: '#161414', color: '#fff' }}>Alpha</option>
        </select>
      </div>

      {/* Opacity Slider */}
      <div style={fieldBoxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={fieldLabelStyle}>Opacity</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary, #ffffff)', fontFamily: 'ui-monospace, monospace' }}>
            {Math.round(currentOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={currentOpacity}
          onChange={(e) => {
            const op = parseFloat(e.target.value);
            memoryRef.current.opacity = op;
            onChange({ ...value, opacity: op } as Background);
          }}
          style={{
            width: '100%',
            height: 4,
            borderRadius: 2,
            outline: 'none',
            cursor: 'pointer',
            background: `linear-gradient(to right, var(--accent, #FF5500) 0%, var(--accent, #FF5500) ${currentOpacity * 100}%, rgba(255, 255, 255, 0.12) ${currentOpacity * 100}%, rgba(255, 255, 255, 0.12) 100%)`,
          }}
        />
      </div>

      {/* ALPHA (TRANSPARENT) MODE */}
      {choice === 'transparent' && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 6,
            border: '1px dashed var(--border-primary, rgba(255, 255, 255, 0.16))',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
            Alpha / Transparent Pass-Through
          </div>
          <div style={{ ...typeStyles.caption, color: 'var(--text-dim, #a1a1aa)', fontSize: 11, lineHeight: 1.4 }}>
            Background is clear so underlying videos, lower thirds, or camera feeds pass through.
          </div>
        </div>
      )}

      {/* IMAGE / VIDEO MODE */}
      {(choice === 'image' || choice === 'video') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Media Asset</span>
            <MediaGrid kind={choice} selectedUrl={value?.mediaUrl || ''} onSelect={pickMedia} />
          </div>

          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Fit Mode</span>
            <div style={{ display: 'flex', background: 'var(--bsp-raised, #1D1B1C)', border: '1px solid var(--border-primary, #262628)', borderRadius: 6, padding: 2, gap: 2 }}>
              {(['cover', 'contain', 'fill'] as const).map((fitMode) => {
                const isSelected = (value?.fit || 'cover') === fitMode;
                return (
                  <button
                    key={fitMode}
                    type="button"
                    onClick={() => {
                      if (choice === 'image') memoryRef.current.imageFit = fitMode;
                      if (choice === 'video') memoryRef.current.videoFit = fitMode;
                      onChange({ ...value, type: choice, fit: fitMode } as Background);
                    }}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: 11,
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#ffffff' : 'var(--text-dim, #a1a1aa)',
                      background: isSelected ? 'var(--accent, #FF5500)' : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {fitMode === 'fill' ? 'Stretch' : fitMode.charAt(0).toUpperCase() + fitMode.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {choice === 'video' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginTop: 2 }}>
              <input
                type="checkbox"
                checked={value?.loop !== false}
                onChange={(e) => {
                  memoryRef.current.videoLoop = e.target.checked;
                  onChange({ ...value, loop: e.target.checked } as Background);
                }}
                style={{ accentColor: 'var(--accent, #FF5500)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11.5, color: 'var(--text-primary, #ffffff)' }}>Loop Video Background</span>
            </label>
          )}
        </div>
      )}

      {/* SOLID COLOR MODE */}
      {choice === 'solid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Color</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={() => solidInputRef.current?.click()}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  background: value?.color || DEFAULT_GROUND,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)',
                  transition: 'transform 0.1s ease',
                }}
                title="Click to choose color"
              />
              <input
                ref={solidInputRef}
                type="color"
                value={(value?.color || DEFAULT_GROUND).startsWith('#') ? (value?.color || DEFAULT_GROUND) : DEFAULT_GROUND}
                onChange={(e) => onChange({ type: 'solid', color: e.target.value, opacity: currentOpacity })}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
              />
              <input
                type="text"
                value={value?.color || DEFAULT_GROUND}
                onChange={(e) => onChange({ type: 'solid', color: e.target.value, opacity: currentOpacity })}
                style={{
                  flex: 1,
                  height: 32,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11.5,
                  background: 'var(--bsp-raised, #1D1B1C)',
                  border: '1px solid var(--border-primary, #262628)',
                  borderRadius: 6,
                  color: 'var(--text-primary, #ffffff)',
                  padding: '0 8px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Presets</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {PRO_SOLID_PRESETS.map((hex) => {
                const isSelected = (value?.color || DEFAULT_GROUND).toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onChange({ type: 'solid', color: hex, opacity: currentOpacity })}
                    style={{
                      height: 22,
                      borderRadius: 4,
                      border: isSelected ? '2px solid var(--accent, #FF5500)' : '1px solid rgba(255,255,255,0.18)',
                      background: hex,
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'transform 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    title={hex}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GRADIENT MODE: Pro Theme Studio Style Interactive Gradient Editor */}
      {choice === 'gradient' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Gradient Type Dropdown */}
          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Gradient Type</span>
            <select
              style={selectStyle}
              value={isRadial ? 'radial' : 'linear'}
              onChange={(e) => {
                if (e.target.value === 'radial') {
                  setGradient({ dir: 'radial' });
                } else {
                  setGradient({ dir: `${numericAngle || 135}deg` });
                }
              }}
            >
              <option value="linear" style={{ background: '#161414', color: '#fff' }}>Linear Gradient</option>
              <option value="radial" style={{ background: '#161414', color: '#fff' }}>Radial Gradient (Circular)</option>
            </select>
          </div>

          {/* Color Stops & Spectrum Bar */}
          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Color Stops & Spectrum</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Start Color Swatch */}
              <div
                onClick={() => startInputRef.current?.click()}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: info.start.startsWith('#') ? info.start : DEFAULT_GRADIENT_START,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 2px 5px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                title={`Start Color: ${info.start} (click to change)`}
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
                  height: 30,
                  borderRadius: 6,
                  border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.16))',
                  background: isRadial
                    ? `radial-gradient(circle, ${info.start}, ${info.end})`
                    : `linear-gradient(to right, ${info.start}, ${info.end})`,
                  boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Live gradient spectrum"
              >
                {/* Centered Swap Button */}
                <button
                  type="button"
                  onClick={handleSwapGradient}
                  title="Swap Start & End Colors"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent, #FF5500)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.65)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 5h18" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 19H3" />
                  </svg>
                </button>
              </div>

              {/* End Color Swatch */}
              <div
                onClick={() => endInputRef.current?.click()}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: info.end.startsWith('#') ? info.end : DEFAULT_GRADIENT_END,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 2px 5px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                title={`End Color: ${info.end} (click to change)`}
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
          </div>

          {/* Gradient Angle Controls (Linear Mode) */}
          {!isRadial && (
            <div style={fieldBoxStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={fieldLabelStyle}>Gradient Angle</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #FF5500)', fontFamily: 'ui-monospace, monospace' }}>
                  {numericAngle}°
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CircularAngleDial
                  angleDeg={numericAngle}
                  isRadial={isRadial}
                  onChangeAngle={handleAngleChange}
                />
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={numericAngle}
                  onChange={(e) => handleAngleChange(parseInt(e.target.value, 10))}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    outline: 'none',
                    cursor: 'pointer',
                    background: `linear-gradient(to right, var(--accent, #FF5500) 0%, var(--accent, #FF5500) ${(numericAngle / 360) * 100}%, rgba(255, 255, 255, 0.12) ${(numericAngle / 360) * 100}%, rgba(255, 255, 255, 0.12) 100%)`,
                  }}
                />
              </div>

              <select
                style={selectStyle}
                value={['0', '45', '90', '135', '180', '225', '270', '315'].includes(String(numericAngle)) ? `${numericAngle}deg` : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setGradient({ dir: e.target.value });
                  }
                }}
              >
                <option value="0deg" style={{ background: '#161414', color: '#fff' }}>0° (To Top)</option>
                <option value="45deg" style={{ background: '#161414', color: '#fff' }}>45° (Top Right)</option>
                <option value="90deg" style={{ background: '#161414', color: '#fff' }}>90° (To Right)</option>
                <option value="135deg" style={{ background: '#161414', color: '#fff' }}>135° (Bottom Right - Default)</option>
                <option value="180deg" style={{ background: '#161414', color: '#fff' }}>180° (To Bottom)</option>
                <option value="225deg" style={{ background: '#161414', color: '#fff' }}>225° (Bottom Left)</option>
                <option value="270deg" style={{ background: '#161414', color: '#fff' }}>270° (To Left)</option>
                <option value="315deg" style={{ background: '#161414', color: '#fff' }}>315° (Top Left)</option>
                {!['0', '45', '90', '135', '180', '225', '270', '315'].includes(String(numericAngle)) && (
                  <option value="custom" style={{ background: '#161414', color: '#fff' }}>Custom Angle ({numericAngle}°)</option>
                )}
              </select>
            </div>
          )}

          {/* Curated Studio Gradient Presets */}
          <div style={fieldBoxStyle}>
            <span style={fieldLabelStyle}>Presets</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {PRO_GRADIENT_PRESETS.map((preset) => {
                const targetGrad = gradientCss(preset.start, preset.end, isRadial ? 'radial' : preset.dir);
                const isMatch = value?.gradient === targetGrad;

                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={`${preset.name} (${preset.start} → ${preset.end})`}
                    onClick={() => {
                      setGradient({
                        start: preset.start,
                        end: preset.end,
                        dir: isRadial ? 'radial' : preset.dir,
                      });
                    }}
                    style={{
                      height: 22,
                      borderRadius: 4,
                      border: isMatch ? '2px solid var(--accent, #FF5500)' : '1px solid rgba(255, 255, 255, 0.18)',
                      background: isRadial
                        ? `radial-gradient(circle, ${preset.start}, ${preset.end})`
                        : `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'transform 0.12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface BackgroundPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  value: Background | undefined;
  onChange: (bg: Background | undefined) => void;
  workspaceLabel?: 'Bible' | 'Songs' | string;
  outputMode?: 'FS' | 'LT' | string;
  isLinked?: boolean;
}

const POPOVER_WIDTH = 320;

/**
 * Floating Pro-Studio Background Popover Window (Harmonized with Popover Design System)
 */
export function BackgroundPopover({
  isOpen,
  onClose,
  anchorRef,
  value,
  onChange,
  workspaceLabel = 'Songs',
  outputMode = 'FS',
  isLinked = true,
}: BackgroundPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { modalStyle, headerProps } = useDraggableModal();

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const estimatedHeight = 350;

    let top: number;
    if (anchor.top > window.innerHeight / 2) {
      top = Math.max(12, anchor.top - estimatedHeight - 10);
    } else {
      top = Math.min(window.innerHeight - estimatedHeight - 16, anchor.bottom + 8);
    }

    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - POPOVER_WIDTH - 16));
    setPos({ top, left });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPOVER_WIDTH,
        maxHeight: `calc(100vh - ${Math.max(20, pos.top)}px - 20px)`,
        overflowY: 'auto',
        background: 'var(--bsp-surface, #1C1A19)',
        border: '1px solid var(--bsp-edge, #2D2A28)',
        borderRadius: 8,
        boxShadow: '0 16px 44px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        zIndex: 9999,
        padding: '12px 14px 14px',
        color: 'var(--text-primary, #ffffff)',
        backdropFilter: 'blur(20px)',
        userSelect: 'none',
        ...modalStyle,
      }}
    >
      {/* Title & Drag Handle Header */}
      <div
        {...headerProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 8,
          marginBottom: 12,
          borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #ffffff)', letterSpacing: '0.01em' }}>
            {workspaceLabel} Background
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(255, 85, 0, 0.18)',
              color: 'var(--accent, #FF5500)',
            }}
          >
            {outputMode}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-dim, #a1a1aa)',
            }}
          >
            {isLinked ? 'Linked' : 'Independent'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-no-drag
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-dim, #a1a1aa)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-dim, #a1a1aa)';
          }}
          title="Close Background Settings"
        >
          ✕
        </button>
      </div>

      <BackgroundPicker value={value} onChange={onChange} />
    </div>,
    document.body
  );
}
