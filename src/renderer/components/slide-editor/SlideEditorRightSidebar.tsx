import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LayerList, type LayerRow } from './LayerList';
import { ShapeInspector } from '../ShapeInspector';
import { SlideTextPanel } from '../SlideTextPanel';
import { CustomDropdown } from '../CustomDropdown';
import { AppleToggle } from '../AppleToggle';
import { slideElementsFor } from '../NativeSlideBoard';
import type { ParsedShape } from '../../slide-engine/parser/slide-parser';
import type { PresentationSlide, SlideElement } from '../../types';
import { parseBackgroundInfo, gradientCss } from '../../utils/background';
import { fetchInstalledSystemFonts, type FontOptionItem } from '../../utils/system-fonts';

export interface PptxInspector {
  selected: ParsedShape[];
  shapes: ParsedShape[];
  layers: LayerRow[];
  onSelectLayer: (id: string, additive: boolean) => void;
  onReorderLayer: (from: number, to: number) => void;
  onDeleteLayer: (id: string) => void;
  onFill: (hex: string) => void;
  onStroke: (hex: string, widthPx?: number | null) => void;
  onTextColor: (hex: string) => void;
  onFontFamily?: (font: string) => void;
  onFontWeight?: (weight: number) => void;
  onFontSize?: (size: number) => void;
  onLineHeight?: (lh: number) => void;
  onLetterSpacing?: (ls: number) => void;
  onTextAlign?: (align: string) => void;
  onReorder: (toFront: boolean) => void;
  onDelete: () => void;
  onEditText: (shape: ParsedShape, value: string) => void;
  onGroup: () => void;
  onUngroup: () => void;
  canGroup: boolean;
  canUngroup: boolean;
}

interface SlideEditorRightSidebarProps {
  slide: PresentationSlide;
  selectedElement: SlideElement | null;
  selectedElementIds?: string[];
  onUpdateSlide: (updates: Partial<PresentationSlide>) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElements?: (ids?: string[]) => void;
  onSelectElement: (id: string | null, additive?: boolean) => void;
  onReorderElements: (elements: SlideElement[]) => void;
  pptx?: PptxInspector | null;
}

function nativeLayerRows(elements: SlideElement[], selectedIds: string[]): LayerRow[] {
  return [...elements]
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    .map((el) => ({
      id: el.id,
      label: (el.content || '').trim().slice(0, 34) || el.type,
      kind: el.type === 'text' ? 'text' : el.type === 'image' ? 'image' : 'shape',
      selected: selectedIds.includes(el.id),
      locked: Boolean(el.locked),
    }));
}

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Aptos', label: 'Aptos' },
  { value: 'General Sans', label: 'General Sans' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'SF Pro Display', label: 'SF Pro Display' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
];

const FONT_WEIGHTS = [
  { value: '100', label: 'Thin (100)' },
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semi Bold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extra Bold (800)' },
  { value: '900', label: 'Black (900)' },
];

/* The sizes the app's own templates and defaults actually use — 26, 32, 36,
   48, 54, 64 — were missing from this list, so opening a stock slide showed a
   size the menu could not offer back once you had moved off it. */
const FONT_SIZES = [
  '12', '14', '16', '18', '20', '24', '26', '28', '32', '36', '40', '42',
  '48', '54', '60', '64', '72', '80', '96', '120', '144',
].map((v) => ({ value: v, label: v }));

/**
 * A CSS colour as a `#rrggbb` string, or null if it is not one yet.
 *
 * `<input type="color">` only accepts that exact form — hand it `rgba(255,
 * 255, 255, 0.85)`, which is what the default body element carries, and
 * Chromium silently shows black. Shorthand is expanded; anything else (a named
 * colour, a partly-typed hex) returns null so the caller can decline to commit.
 */
function normalizeHex(value: string | undefined): string | null {
  if (!value) return null;
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  const rgb = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const to2 = (n: string) => Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0');
    return `#${to2(rgb[1])}${to2(rgb[2])}${to2(rgb[3])}`;
  }
  return null;
}

/* Drawn rather than typed. The four horizontal buttons all rendered '≡' bar
   one, so three of them were the same picture and the group looked inert
   whichever you pressed. */
function AlignIcon({ align }: { align: 'left' | 'center' | 'right' | 'justify' }) {
  const rows: Array<[number, number]> = align === 'left'
    ? [[1, 14], [1, 9], [1, 14], [1, 9]]
    : align === 'right'
    ? [[1, 14], [6, 9], [1, 14], [6, 9]]
    : align === 'center'
    ? [[1, 14], [3.5, 9], [1, 14], [3.5, 9]]
    : [[1, 14], [1, 14], [1, 14], [1, 14]];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {rows.map(([x, w], i) => (
        <rect key={i} x={x} y={2.5 + i * 3.2} width={w} height="1.6" rx="0.8" fill="currentColor" />
      ))}
    </svg>
  );
}

function VAlignIcon({ vAlign }: { vAlign: 'top' | 'middle' | 'bottom' }) {
  const barY = vAlign === 'top' ? 2 : vAlign === 'bottom' ? 12.4 : 7.2;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y={barY} width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect
        x="4.5"
        y={vAlign === 'top' ? 5.2 : vAlign === 'bottom' ? 5.2 : 2}
        width="7"
        height={vAlign === 'middle' ? 4.4 : 8.4}
        rx="1"
        fill="currentColor"
        opacity="0.45"
      />
      {vAlign === 'middle' && <rect x="4.5" y="9.6" width="7" height="4.4" rx="1" fill="currentColor" opacity="0.45" />}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

interface ScrubbableInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  badge?: React.ReactNode;
  suffix?: string;
  title?: string;
}

function ScrubbableInput({
  value,
  onChange,
  min = -1000,
  max = 1000,
  step = 1,
  precision = 0,
  style,
  inputStyle,
  badge = '⤌⤍',
  suffix,
  title,
}: ScrubbableInputProps) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startValRef = useRef(0);

  const [localText, setLocalText] = useState<string>(String(value ?? ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalText(String(value ?? ''));
    }
  }, [value, isFocused]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const rawDelta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    if (Math.abs(rawDelta) < 0.5) return;

    const multiplier = e.shiftKey ? 10 : 1;
    const direction = rawDelta > 0 ? 1 : -1;
    const deltaAmount = direction * step * multiplier;

    let nextVal = (value || 0) + deltaAmount;
    if (precision === 0) nextVal = Math.round(nextVal);
    else nextVal = parseFloat(nextVal.toFixed(precision));

    if (min !== undefined) nextVal = Math.max(min, nextVal);
    if (max !== undefined) nextVal = Math.min(max, nextVal);

    onChange(nextVal);
    setLocalText(String(nextVal));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startValRef.current = value || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const diffX = moveEvent.clientX - startXRef.current;
      const multiplier = moveEvent.shiftKey ? 10 : 1;
      const deltaAmount = Math.round(diffX / 3) * step * multiplier;

      let nextVal = startValRef.current + deltaAmount;
      if (precision === 0) nextVal = Math.round(nextVal);
      else nextVal = parseFloat(nextVal.toFixed(precision));

      if (min !== undefined) nextVal = Math.max(min, nextVal);
      if (max !== undefined) nextVal = Math.min(max, nextVal);

      onChange(nextVal);
      setLocalText(String(nextVal));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalText(raw);

    if (raw === '' || raw === '-') return;

    const parsed = precision === 0 ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isFinite(parsed)) {
      let clamped = parsed;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (localText === '' || localText === '-') {
      setLocalText(String(value ?? (min !== undefined ? Math.max(0, min) : 0)));
    } else {
      const parsed = precision === 0 ? parseInt(localText, 10) : parseFloat(localText);
      if (Number.isFinite(parsed)) {
        let clamped = parsed;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        onChange(clamped);
        setLocalText(String(clamped));
      } else {
        setLocalText(String(value ?? (min !== undefined ? Math.max(0, min) : 0)));
      }
    }
  };

  return (
    <div
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{ ...styles.iconInputBox, cursor: 'ew-resize', ...style }}
      title={title || "Swipe left/right with two fingers (or drag) to adjust value. Hold Shift for 10x speed."}
    >
      {badge && <span style={styles.iconInputBadge}>{badge}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={localText}
        onFocus={() => setIsFocused(true)}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onWheel={handleWheel}
        style={{ ...styles.iconInput, ...inputStyle }}
      />
      {suffix && <span style={{ fontSize: 10, color: 'var(--text-dim)', paddingRight: 6, flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}

interface GradientRampPickerProps {
  value: string;
  onChange: (nextGradientCss: string) => void;
}

function GradientRampPicker({ value, onChange }: GradientRampPickerProps) {
  const info = parseBackgroundInfo(value, undefined);
  const [activeStop, setActiveStop] = useState<'start' | 'end'>('start');

  const startColor = info.start || '#F97316';
  const endColor = info.end || '#7C2D12';
  const direction = info.dir || '135deg';

  const [startPos, setStartPos] = useState<number>(0);
  const [endPos, setEndPos] = useState<number>(100);

  const angleDeg = direction.includes('deg') ? parseInt(direction.replace('deg', ''), 10) || 135 : 135;
  const isRadial = direction === 'radial';

  const updateGradient = (newStart: string, newEnd: string, newDir: string, pStart = startPos, pEnd = endPos) => {
    let css: string;
    if (newDir === 'radial') {
      css = `radial-gradient(circle at center, ${newStart} ${pStart}%, ${newEnd} ${pEnd}%)`;
    } else {
      css = `linear-gradient(${newDir}, ${newStart} ${pStart}%, ${newEnd} ${pEnd}%)`;
    }
    onChange(css);
  };

  const handleAngleChange = (newAngle: number) => {
    updateGradient(startColor, endColor, `${newAngle}deg`);
  };

  const handleDirToggle = (dir: string) => {
    updateGradient(startColor, endColor, dir);
  };

  const handlePosChange = (stop: 'start' | 'end', newPos: number) => {
    const clamped = Math.max(0, Math.min(100, newPos));
    if (stop === 'start') {
      setStartPos(clamped);
      updateGradient(startColor, endColor, direction, clamped, endPos);
    } else {
      setEndPos(clamped);
      updateGradient(startColor, endColor, direction, startPos, clamped);
    }
  };

  const activeColor = activeStop === 'start' ? startColor : endColor;
  const activePos = activeStop === 'start' ? startPos : endPos;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4, width: '100%', boxSizing: 'border-box' }}>
      {/* Visual Gradient Ramp Track Bar with Movable Stop Pins */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={styles.propLabel}>Gradient Ramp</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)' }}>
            {isRadial ? 'Radial' : `${angleDeg}°`}
          </span>
        </div>

        {/* Ramp Track Bar Container */}
        <div style={{ position: 'relative', width: '100%', paddingTop: 6, paddingBottom: 16 }}>
          {/* Main Gradient Bar */}
          <div
            style={{
              height: 22,
              width: '100%',
              borderRadius: 5,
              background: gradientCss(startColor, endColor, direction),
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), 0 2px 8px rgba(0, 0, 0, 0.4)',
            }}
          />

          {/* Movable Start / Highlight Stop Pointer Handle */}
          <div
            onClick={() => setActiveStop('start')}
            style={{
              position: 'absolute',
              left: `calc(${startPos}% - 7px)`,
              bottom: 0,
              cursor: 'ew-resize',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: activeStop === 'start' ? 10 : 2,
            }}
            title="Highlight Stop: Drag or click to edit"
          >
            {/* Arrow Pointer */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: `6px solid ${activeStop === 'start' ? '#FF5500' : '#ffffff'}`,
              }}
            />
            {/* Swatch Square */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: startColor,
                border: activeStop === 'start' ? '2px solid #FF5500' : '1px solid #ffffff',
                boxShadow: activeStop === 'start' ? '0 0 8px rgba(255, 85, 0, 0.9)' : '0 1px 4px rgba(0,0,0,0.6)',
              }}
            />
          </div>

          {/* Movable End / Shadow Stop Pointer Handle */}
          <div
            onClick={() => setActiveStop('end')}
            style={{
              position: 'absolute',
              left: `calc(${endPos}% - 7px)`,
              bottom: 0,
              cursor: 'ew-resize',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: activeStop === 'end' ? 10 : 2,
            }}
            title="Shadow Stop: Drag or click to edit"
          >
            {/* Arrow Pointer */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: `6px solid ${activeStop === 'end' ? '#FF5500' : '#ffffff'}`,
              }}
            />
            {/* Swatch Square */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: endColor,
                border: activeStop === 'end' ? '2px solid #FF5500' : '1px solid #ffffff',
                boxShadow: activeStop === 'end' ? '0 0 8px rgba(255, 85, 0, 0.9)' : '0 1px 4px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Active Stop Selector Tabs */}
      <div style={styles.segmentGroup}>
        <button
          type="button"
          onClick={() => setActiveStop('start')}
          style={{
            ...styles.segmentBtn,
            background: activeStop === 'start' ? 'var(--chrome-control-active)' : 'transparent',
            color: activeStop === 'start' ? '#FF5500' : 'var(--text-secondary)',
            fontWeight: activeStop === 'start' ? 700 : 500,
            fontSize: 10,
          }}
        >
          ● Highlight ({startPos}%)
        </button>
        <button
          type="button"
          onClick={() => setActiveStop('end')}
          style={{
            ...styles.segmentBtn,
            background: activeStop === 'end' ? 'var(--chrome-control-active)' : 'transparent',
            color: activeStop === 'end' ? '#FF5500' : 'var(--text-secondary)',
            fontWeight: activeStop === 'end' ? 700 : 500,
            fontSize: 10,
          }}
        >
          ● Shadow ({endPos}%)
        </button>
      </div>

      {/* Active Stop Color & Position Editor Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        {/* Color Swatch & Hex */}
        <div style={styles.propRowCol}>
          <span style={styles.propLabel}>{activeStop === 'start' ? 'Highlight Color' : 'Shadow Color'}</span>
          <div style={styles.colorPillRow}>
            <input
              type="color"
              value={normalizeHex(activeColor) || '#F97316'}
              onChange={(e) => {
                if (activeStop === 'start') updateGradient(e.target.value, endColor, direction);
                else updateGradient(startColor, e.target.value, direction);
              }}
              style={styles.colorSwatch}
            />
            <input
              type="text"
              spellCheck={false}
              value={activeColor.toUpperCase()}
              onChange={(e) => {
                if (activeStop === 'start') updateGradient(e.target.value, endColor, direction);
                else updateGradient(startColor, e.target.value, direction);
              }}
              style={styles.colorHexInput}
            />
          </div>
        </div>

        {/* Location Stop Slider */}
        <div style={styles.propRowCol}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={styles.propLabel}>Location</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{activePos}%</span>
          </div>
          <ScrubbableInput
            value={activePos}
            onChange={(v) => handlePosChange(activeStop, v)}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
        </div>
      </div>

      {/* Direction & Angle Selector */}
      <div style={styles.propRowCol}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={styles.propLabel}>Angle & Direction</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isRadial ? 'Radial' : `${angleDeg}°`}
          </span>
        </div>

        {/* Direction Presets */}
        <div style={styles.segmentGroup}>
          {[
            { label: '↘ 135°', dir: '135deg' },
            { label: '➔ 90°', dir: '90deg' },
            { label: '⬇ 180°', dir: '180deg' },
            { label: '⬆ 0°', dir: '0deg' },
            { label: '⭕ Radial', dir: 'radial' },
          ].map((preset) => {
            const on = direction === preset.dir;
            return (
              <button
                key={preset.dir}
                type="button"
                onClick={() => handleDirToggle(preset.dir)}
                style={{
                  ...styles.segmentBtn,
                  background: on ? 'var(--chrome-control-active)' : 'transparent',
                  color: on ? '#FF5500' : 'var(--text-secondary)',
                  fontWeight: on ? 700 : 500,
                  fontSize: 10,
                  padding: '3px 4px',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom Angle Slider (when linear) */}
        {!isRadial && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={angleDeg}
              onChange={(e) => handleAngleChange(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: '#FF5500' }}
            />
          </div>
        )}
      </div>

      {/* Quick Gradient Presets Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
        <span style={styles.propLabel}>Presets</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)',
            'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
            'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
            'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)',
            'linear-gradient(135deg, #ec4899 0%, #831843 100%)',
            'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          ].map((grad, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(grad)}
              style={{
                height: 26,
                background: grad,
                border: value === grad ? '2px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 5,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SlideEditorRightSidebar({
  slide,
  selectedElement,
  selectedElementIds = [],
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElements,
  onSelectElement,
  onReorderElements,
  pptx = null,
}: SlideEditorRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'layer' | 'ai'>('design');
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [systemFontItems, setSystemFontItems] = useState<FontOptionItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchInstalledSystemFonts().then((items) => {
      if (isMounted) setSystemFontItems(items);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Accordion Section Expansion States (collapsed by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    canvas: false,
    typography: false,
    shape: false,
    effects: false,
    geometry: false,
  });

  const [lockAspect, setLockAspect] = useState(true);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const bgType = slide.background?.type || 'color';
  const bgValue = slide.background?.value || '#18181b';

  /* Through the same helper both canvases render with, so a slide that has
     never been touched still shows its default title and body here — reading
     `slide.elements` straight gave an empty list for exactly those slides, and
     the inspector had nothing to point at. */
  const nativeElements = slideElementsFor(slide);
  const activeSelectionIds = selectedElementIds.length > 0
    ? selectedElementIds
    : (selectedElement ? [selectedElement.id] : []);
  const nativeRows = nativeLayerRows(nativeElements, activeSelectionIds);

  /**
   * Which element the Typography controls act on.
   *
   * This used to fall through to `elements.find(type === 'text')` whenever the
   * selection was not text, which produced the two complaints this panel
   * earns: select a shape and the font controls silently retype some other
   * block, or — on a slide with no text at all — appear live and do nothing.
   *
   * Now it is one of three states, and the panel says which:
   *   text selected      → edit that element
   *   nothing selected   → edit the slide's first text element, named in the
   *                        header so the operator knows what will change
   *   non-text selected  → null, and Typography does not render at all
   */
  const firstPptxText = pptx
    ? (pptx.selected.find((s) => s.paragraphs && s.paragraphs.length > 0) ||
       pptx.shapes.find((s) => s.paragraphs && s.paragraphs.length > 0) || null)
    : null;
  const firstPptxRun = firstPptxText?.paragraphs?.[0]?.[0];

  const firstTextElement = nativeElements.find((e) => e.type === 'text') || null;
  const targetTextElement = pptx
    ? null
    : (selectedElement
        ? (selectedElement.type === 'text' ? selectedElement : null)
        : firstTextElement);

  const typographyScope = pptx
    ? (pptx.selected.length > 0
        ? (firstPptxText ? 'selected' : 'unavailable')
        : (firstPptxText ? 'default' : 'unavailable'))
    : (selectedElement
        ? (selectedElement.type === 'text' ? 'selected' : 'unavailable')
        : (firstTextElement ? 'default' : 'unavailable'));

  const currentFontFamily = pptx
    ? (firstPptxRun?.fontFamily || firstPptxRun?.fontFace || 'Inter')
    : (targetTextElement?.fontFamily || 'Inter');

  const fontOptions = useMemo(() => {
    const list: FontOptionItem[] = systemFontItems.length > 0
      ? [...systemFontItems]
      : FONT_FAMILIES.map((f) => ({ value: f.value, label: f.label, isSystemFont: false }));

    if (currentFontFamily && !list.some((f) => f.value.toLowerCase() === currentFontFamily.toLowerCase())) {
      list.unshift({ value: currentFontFamily, label: currentFontFamily, isSystemFont: true });
    }

    return list.map((f) => ({
      value: f.value,
      label: (
        <span style={{ fontFamily: `"${f.value}", sans-serif`, fontSize: 13 }}>
          {f.label}
        </span>
      ),
      sublabel: f.isSystemFont ? 'System Font' : 'App Font',
    }));
  }, [systemFontItems, currentFontFamily]);

  const currentFontWeight = pptx
    ? (firstPptxRun?.fontWeight ?? (firstPptxRun?.bold ? 700 : 600))
    : (targetTextElement?.fontWeight ?? 600);

  const currentFontSize = pptx
    ? (firstPptxRun?.fontSize || 42)
    : (targetTextElement?.fontSize ?? 42);

  const currentLineHeight: number = pptx
    ? (typeof firstPptxText?.lineHeight === 'number' ? firstPptxText.lineHeight : 1.3)
    : (targetTextElement?.lineHeight ?? 1.3);

  const currentLetterSpacing: number = pptx
    ? (typeof firstPptxText?.letterSpacing === 'number' ? firstPptxText.letterSpacing : 0)
    : (targetTextElement?.letterSpacing ?? 0);

  const currentColor = pptx
    ? (firstPptxRun?.color || '#ffffff')
    : (targetTextElement?.color || '#ffffff');

  const currentTextAlign = pptx
    ? (typeof firstPptxText?.textAlign === 'string' ? firstPptxText.textAlign : 'center')
    : (targetTextElement?.textAlign || 'center');

  const currentOpacity: number = pptx
    ? (typeof firstPptxText?.opacity === 'number' ? firstPptxText.opacity : 1)
    : (targetTextElement?.opacity ?? 1);

  const pptxShape = pptx && pptx.selected && pptx.selected.length > 0 ? pptx.selected[0] : null;

  /** Every Typography control writes through here, so none of them can act on
      a target that is not there. */
  const setText = (updates: Partial<SlideElement>) => {
    if (pptx) {
      if (updates.fontFamily && pptx.onFontFamily) pptx.onFontFamily(updates.fontFamily);
      if (typeof updates.fontWeight === 'number' && pptx.onFontWeight) pptx.onFontWeight(updates.fontWeight);
      if (typeof updates.fontSize === 'number' && pptx.onFontSize) pptx.onFontSize(updates.fontSize);
      if (typeof updates.lineHeight === 'number' && pptx.onLineHeight) pptx.onLineHeight(updates.lineHeight);
      if (typeof updates.letterSpacing === 'number' && pptx.onLetterSpacing) pptx.onLetterSpacing(updates.letterSpacing);
      if (updates.color && pptx.onTextColor) pptx.onTextColor(updates.color);
      if (updates.textAlign && pptx.onTextAlign) pptx.onTextAlign(updates.textAlign);
    } else if (targetTextElement) {
      onUpdateElement(targetTextElement.id, updates);
    }
  };

  /* Free-typed fields — line height, letter spacing, the hex box — need
     somewhere to hold a half-finished value. Without it `parseFloat('1.')` is
     NaN and `#FF55` is not a colour, and committing either on every keystroke
     is what made these three feel like they fought back. The draft is keyed by
     element and field, so changing selection drops it. */
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);
  const activeId = pptx ? (firstPptxText?.id || 'pptx-first') : (targetTextElement?.id || 'none');
  const draftKey = (field: string) => `${activeId}:${field}`;
  const fieldValue = (field: string, actual: string | number) =>
    draft && draft.key === draftKey(field) ? draft.value : String(actual);
  const editField = (field: string, value: string, commit: (v: string) => void) => {
    setDraft({ key: draftKey(field), value });
    commit(value);
  };

  function handleNativeReorder(from: number, to: number) {
    const order = [...nativeRows];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    const zById = new Map(order.map((row, i) => [row.id, order.length - i]));
    onReorderElements(nativeElements.map((el) => ({ ...el, zIndex: zById.get(el.id) ?? el.zIndex })));
  }

  function handleNativeDuplicateLayer(from: number, to: number) {
    const targetRow = nativeRows[from];
    if (!targetRow) return;
    const targetEl = nativeElements.find((e) => e.id === targetRow.id);
    if (!targetEl) return;

    const now = Date.now();
    const duplicate: SlideElement = {
      ...targetEl,
      id: `el-${now}`,
      x: Math.min(95, targetEl.x + 3),
      y: Math.min(95, targetEl.y + 3),
      zIndex: Math.max(0, ...nativeElements.map((e) => e.zIndex || 1)) + 1,
    };

    const nextElements = [...nativeElements, duplicate];
    onReorderElements(nextElements);
    onSelectElement(duplicate.id, false);
  }

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const val = evt.target?.result as string;
      if (val) {
        onUpdateSlide({ background: { type: 'image', value: val } });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      style={{
        width: 290,
        minWidth: 290,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <input
        type="file"
        ref={bgFileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgImageUpload}
      />

      {/* Tri-Tab Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}>
        {(['design', 'layer', 'ai'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 8px',
              background: activeTab === tab ? 'var(--chrome-control)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #FF5500' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'ai' ? 'AI Studio' : tab}
          </button>
        ))}
      </div>

      {/* Viewport Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }} className="bar-scroll">
        {/* ---- DESIGN TAB ------------------------------------------------- */}
        {activeTab === 'design' && pptx && (
          <>
            <ShapeInspector
              selected={pptx.selected}
              onFill={pptx.onFill}
              onStroke={pptx.onStroke}
              onTextColor={pptx.onTextColor}
              onReorder={pptx.onReorder}
              onDelete={pptx.onDelete}
            />
            <SlideTextPanel shapes={pptx.shapes} onEdit={pptx.onEditText} />
          </>
        )}

        {activeTab === 'design' && !pptx && (
          <>
            {/* Aspect Ratio & Canvas Section */}
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader} onClick={() => toggleSection('canvas')}>
                <span style={styles.sectionTitle}>Canvas & Aspect</span>
                <ChevronIcon open={Boolean(openSections.canvas)} />
              </div>

              {openSections.canvas && (
                <div style={styles.sectionBody}>
                  {/* Aspect Ratio Pills */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Aspect Ratio</span>
                    <div style={styles.pillGroup}>
                      {(['16:9', '4:3', 'lower-third'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => onUpdateSlide({ aspectRatio: ratio })}
                          style={{
                            ...styles.pillBtn,
                            background: (slide.aspectRatio || '16:9') === ratio ? '#FF5500' : 'transparent',
                            color: (slide.aspectRatio || '16:9') === ratio ? '#ffffff' : 'var(--text-secondary)',
                          }}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lock Aspect Ratio */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={lockAspect}
                        onChange={(e) => setLockAspect(e.target.checked)}
                        style={{ accentColor: '#FF5500', cursor: 'pointer' }}
                      />
                      Lock aspect ratio
                    </label>
                  </div>

                  {/* Canvas Background Header & Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={styles.propLabel}>Canvas Background</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSlide({
                          background: {
                            type: 'color',
                            value: bgValue === 'transparent' ? '#18181b' : 'transparent',
                          },
                        })
                      }
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: 'none',
                        background: bgValue === 'transparent' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                        color: bgValue === 'transparent' ? '#f87171' : '#4ade80',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {bgValue === 'transparent' ? 'Background: OFF' : 'Background: ON'}
                    </button>
                  </div>

                  {/* Background Mode Pills */}
                  <div style={styles.pillGroup}>
                    {(['color', 'gradient', 'image', 'none'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          onUpdateSlide({
                            background: {
                              type: type === 'none' ? 'color' : type,
                              value:
                                type === 'none'
                                  ? 'transparent'
                                  : type === 'gradient'
                                  ? 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)'
                                  : type === 'color'
                                  ? bgValue === 'transparent' ? '#18181b' : bgValue
                                  : bgValue || '',
                            },
                          })
                        }
                        style={{
                          ...styles.pillBtn,
                          fontSize: 10,
                          background:
                            (type === 'none' && bgValue === 'transparent') ||
                            (type !== 'none' && bgType === type && bgValue !== 'transparent')
                              ? '#FF5500'
                              : 'transparent',
                          color:
                            (type === 'none' && bgValue === 'transparent') ||
                            (type !== 'none' && bgType === type && bgValue !== 'transparent')
                              ? '#ffffff'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {type === 'none' ? 'Off / Trans' : type}
                      </button>
                    ))}
                  </div>

                  {/* Solid Color Picker */}
                  {bgType === 'color' && bgValue !== 'transparent' && (
                    <div style={styles.colorPillRow}>
                      <input
                        type="color"
                        value={bgValue.startsWith('#') ? bgValue : '#18181b'}
                        onChange={(e) => onUpdateSlide({ background: { type: 'color', value: e.target.value } })}
                        style={styles.colorSwatch}
                      />
                      <input
                        type="text"
                        value={bgValue.toUpperCase()}
                        onChange={(e) => onUpdateSlide({ background: { type: 'color', value: e.target.value } })}
                        style={styles.colorHexInput}
                      />
                      <span style={styles.opacityBadge}>100%</span>
                    </div>
                  )}

                  {/* Gradient Ramp & Dual Stop Color Controls */}
                  {bgType === 'gradient' && (
                    <GradientRampPicker
                      value={bgValue}
                      onChange={(css) => onUpdateSlide({ background: { type: 'gradient', value: css } })}
                    />
                  )}

                  {/* Background Image Upload & Presets */}
                  {bgType === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => bgFileInputRef.current?.click()}
                        style={{
                          padding: '8px 12px',
                          background: '#202024',
                          border: '1px dashed rgba(255, 255, 255, 0.2)',
                          borderRadius: 6,
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        📁 Choose Image File
                      </button>

                      {bgValue && bgValue.startsWith('data:') && (
                        <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, textAlign: 'center' }}>
                          ✓ Custom image loaded
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Multi-Selection Alignment & Operations Card */}
            {selectedElementIds.length > 1 && (
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionTitle}>
                    Multi-Selection ({selectedElementIds.length} items)
                  </span>
                </div>
                <div style={styles.sectionBody}>
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Alignment</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[
                        { label: '⇤ Align Left', align: 'left' },
                        { label: '⤯ Center', align: 'center' },
                        { label: '⇥ Right', align: 'right' },
                        { label: '⤒ Top', align: 'top' },
                        { label: '⤯ Middle', align: 'middle' },
                        { label: '⤓ Bottom', align: 'bottom' },
                      ].map((item) => (
                        <button
                          key={item.align}
                          type="button"
                          onClick={() => {
                            const selectedEls = nativeElements.filter((e) => selectedElementIds.includes(e.id));
                            if (!selectedEls.length) return;
                            let targetVal = 0;
                            if (item.align === 'left') targetVal = Math.min(...selectedEls.map((e) => e.x));
                            if (item.align === 'right') targetVal = Math.max(...selectedEls.map((e) => e.x + e.width));
                            if (item.align === 'center') {
                              const avg = selectedEls.reduce((acc, e) => acc + (e.x + e.width / 2), 0) / selectedEls.length;
                              selectedEls.forEach((e) => onUpdateElement(e.id, { x: parseFloat((avg - e.width / 2).toFixed(1)) }));
                              return;
                            }
                            if (item.align === 'top') targetVal = Math.min(...selectedEls.map((e) => e.y));
                            if (item.align === 'bottom') targetVal = Math.max(...selectedEls.map((e) => e.y + e.height));
                            if (item.align === 'middle') {
                              const avg = selectedEls.reduce((acc, e) => acc + (e.y + e.height / 2), 0) / selectedEls.length;
                              selectedEls.forEach((e) => onUpdateElement(e.id, { y: parseFloat((avg - e.height / 2).toFixed(1)) }));
                              return;
                            }
                            selectedEls.forEach((e) => {
                              if (item.align === 'left') onUpdateElement(e.id, { x: targetVal });
                              if (item.align === 'right') onUpdateElement(e.id, { x: targetVal - e.width });
                              if (item.align === 'top') onUpdateElement(e.id, { y: targetVal });
                              if (item.align === 'bottom') onUpdateElement(e.id, { y: targetVal - e.height });
                            });
                          }}
                          style={{
                            height: 26,
                            background: 'var(--chrome-control)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 5,
                            color: 'var(--text-primary)',
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title={`Align ${item.align}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => onDuplicateElements?.(selectedElementIds)}
                      style={{
                        flex: 1,
                        height: 28,
                        background: 'var(--chrome-control)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 5,
                        color: '#FF5500',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⌥ Duplicate All (⌘D)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedElementIds.forEach((id) => onDeleteElement(id))}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: 5,
                        color: '#f87171',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Delete All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Typography. Hidden outright when the selection is a shape or an
                image: a control that cannot act on what is selected is worse
                than a control that is not there, because it invites the click
                and then swallows it. */}
            {typographyScope === 'unavailable' ? (
              selectedElement && (
                <div style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <span style={{ ...styles.sectionTitle, color: 'var(--text-dim)' }}>Typography</span>
                  </div>
                  <div style={{ ...styles.sectionBody, color: 'var(--text-dim)', fontSize: 11 }}>
                    {selectedElement.type === 'shape' ? 'A shape has no type.' : 'An image has no type.'} Select a
                    text block to set its font.
                  </div>
                </div>
              )
            ) : (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader} onClick={() => toggleSection('typography')}>
                <span style={styles.sectionTitle}>
                  Typography
                  {typographyScope === 'default' && targetTextElement && (
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                      {' '}— {(targetTextElement.content || 'first text block').toString().trim().slice(0, 18) || 'first text block'}
                    </span>
                  )}
                </span>
                <ChevronIcon open={Boolean(openSections.typography)} />
              </div>

              {openSections.typography && (
                <div style={styles.sectionBody}>
                  {/* Font Family Dropdown */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Font</span>
                    <CustomDropdown
                      value={currentFontFamily}
                      options={fontOptions}
                      onChange={(font) => setText({ fontFamily: font })}
                      style={{ width: '100%' }}
                      zIndex={100005}
                    />
                  </div>

                  {/* Weight & Size Row */}
                  <div style={styles.twoColRow}>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Weight</span>
                      <CustomDropdown
                        value={String(currentFontWeight)}
                        options={FONT_WEIGHTS}
                        onChange={(wt) => setText({ fontWeight: parseInt(wt, 10) })}
                        style={{ width: '100%' }}
                        zIndex={100005}
                      />
                    </div>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Size</span>
                      <ScrubbableInput
                        value={currentFontSize}
                        onChange={(v) => setText({ fontSize: v })}
                        min={6}
                        max={300}
                        step={1}
                        badge="⤌⤍"
                        suffix="px"
                        title="Font size: swipe left/right, drag, or click to type any custom value"
                      />
                    </div>
                  </div>

                  {/* Line Height & Letter Spacing Row */}
                  <div style={styles.twoColRow}>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Line height</span>
                      <ScrubbableInput
                        value={currentLineHeight}
                        onChange={(v) => setText({ lineHeight: v })}
                        min={0.5}
                        max={3.0}
                        step={0.1}
                        precision={1}
                        badge="⤌⤍"
                      />
                    </div>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Letter spacing</span>
                      <ScrubbableInput
                        value={currentLetterSpacing}
                        onChange={(v) => setText({ letterSpacing: v })}
                        min={-20}
                        max={80}
                        step={1}
                        precision={0}
                        badge="⤌⤍"
                        suffix="px"
                      />
                    </div>
                  </div>

                  {/* Color Swatch */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Color</span>
                    <div style={styles.colorPillRow}>
                      <input
                        type="color"
                        value={normalizeHex(currentColor) || '#ffffff'}
                        onChange={(e) => {
                          setDraft(null);
                          setText({ color: e.target.value });
                        }}
                        style={styles.colorSwatch}
                      />
                      <input
                        type="text"
                        spellCheck={false}
                        value={fieldValue('color', (currentColor || '#FFFFFF').toUpperCase())}
                        onChange={(e) => editField('color', e.target.value, (v) => {
                          if (/^#[0-9a-f]{6}$/i.test(v.trim())) setText({ color: v.trim().toLowerCase() });
                        })}
                        onBlur={(e) => {
                          const hex = normalizeHex(e.target.value);
                          if (hex) setText({ color: hex });
                          setDraft(null);
                        }}
                        style={styles.colorHexInput}
                      />
                      <span style={styles.opacityBadge}>
                        {Math.round(currentOpacity * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal & Vertical Alignment */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Alignment</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Horizontal Alignment */}
                      <div style={{ ...styles.segmentGroup, flex: 1 }}>
                        {(['left', 'center', 'right', 'justify'] as const).map((align) => {
                          const on = currentTextAlign === align;
                          return (
                            <button
                              key={align}
                              type="button"
                              onClick={() => setText({ textAlign: align })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? 'var(--chrome-control-active)' : 'transparent',
                                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                              }}
                              title={`Align ${align}`}
                            >
                              <AlignIcon align={align} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Vertical Alignment */}
                      <div style={{ ...styles.segmentGroup, width: 90 }}>
                        {(['top', 'middle', 'bottom'] as const).map((vAlign) => {
                          const on = (targetTextElement?.vAlign || 'middle') === vAlign;
                          return (
                            <button
                              key={vAlign}
                              type="button"
                              onClick={() => setText({ vAlign })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? 'var(--chrome-control-active)' : 'transparent',
                                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                              }}
                              title={`Vertical ${vAlign}`}
                            >
                              <VAlignIcon vAlign={vAlign} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Decoration & Case (BS, Bs, bs for BibleSong) */}
                  <div style={styles.twoColRow}>
                    {/* Decoration */}
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Decoration</span>
                      <div style={styles.segmentGroup}>
                        {(['none', 'underline', 'line-through'] as const).map((deco) => {
                          const on = (targetTextElement?.textDecoration || 'none') === deco;
                          return (
                            <button
                              key={deco}
                              type="button"
                              onClick={() => setText({ textDecoration: deco })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? 'var(--chrome-control-active)' : 'transparent',
                                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                                textDecoration: deco === 'none' ? undefined : deco,
                              }}
                              title={deco === 'none' ? 'No decoration' : deco === 'underline' ? 'Underline' : 'Strikethrough'}
                            >
                              {deco === 'none' ? '―' : deco === 'underline' ? 'U' : 'S'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Case (BS, Bs, bs for BibleSong) */}
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Case</span>
                      <div style={styles.segmentGroup}>
                        {(['none', 'uppercase', 'capitalize', 'lowercase'] as const).map((tc) => {
                          const on = (targetTextElement?.textTransform || 'none') === tc;
                          return (
                            <button
                              key={tc}
                              type="button"
                              onClick={() => setText({ textTransform: tc })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? 'var(--chrome-control-active)' : 'transparent',
                                color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: tc === 'uppercase' ? 700 : 500,
                              }}
                              title={`Case: ${tc}`}
                            >
                              {tc === 'none' ? '―' : tc === 'uppercase' ? 'BS' : tc === 'capitalize' ? 'Bs' : 'bs'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Shape, Fill & Border Section */}
            {(selectedElement || pptxShape) && (
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader} onClick={() => toggleSection('shape')}>
                  <span style={styles.sectionTitle}>Shape, Fill & Border</span>
                  <ChevronIcon open={Boolean(openSections.shape)} />
                </div>

                {openSections.shape && (
                  <div style={styles.sectionBody}>
                    {/* Fill Color & Transparent Toggle */}
                    <div style={styles.propRowCol}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.propLabel}>Fill Color</span>
                        {!pptxShape && selectedElement && (
                          <button
                            type="button"
                            onClick={() => onUpdateElement(selectedElement.id, { backgroundColor: selectedElement.backgroundColor === 'transparent' ? '#FF5500' : 'transparent' })}
                            style={{
                              background: selectedElement.backgroundColor === 'transparent' ? 'var(--accent-dim)' : 'transparent',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 4,
                              color: selectedElement.backgroundColor === 'transparent' ? 'var(--accent)' : 'var(--text-dim)',
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              cursor: 'pointer',
                            }}
                          >
                            {selectedElement.backgroundColor === 'transparent' ? 'No Fill (Active)' : 'Clear Fill'}
                          </button>
                        )}
                      </div>
                      <div style={styles.colorPillRow}>
                        <input
                          type="color"
                          value={
                            pptxShape
                              ? (normalizeHex(typeof pptxShape.fillColor === 'string' ? pptxShape.fillColor : undefined) || '#FF5500')
                              : (normalizeHex(selectedElement?.backgroundColor) || '#FF5500')
                          }
                          onChange={(e) => {
                            if (pptxShape) (pptx as PptxInspector | null)?.onFill(e.target.value);
                            else if (selectedElement) onUpdateElement(selectedElement.id, { backgroundColor: e.target.value });
                          }}
                          style={styles.colorSwatch}
                        />
                        <input
                          type="text"
                          spellCheck={false}
                          value={
                            pptxShape
                              ? ((typeof pptxShape.fillColor === 'string' ? pptxShape.fillColor : '#FF5500')).toUpperCase()
                              : ((selectedElement?.backgroundColor && selectedElement.backgroundColor !== 'transparent') ? (normalizeHex(selectedElement.backgroundColor) || selectedElement.backgroundColor) : '#FF5500').toUpperCase()
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (pptxShape) (pptx as PptxInspector | null)?.onFill(val);
                            else if (selectedElement) onUpdateElement(selectedElement.id, { backgroundColor: val });
                          }}
                          style={styles.colorHexInput}
                        />
                      </div>
                    </div>

                    {/* Fill Opacity Slider */}
                    {selectedElement && (
                      <div style={styles.propRowCol}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={styles.propLabel}>Fill Opacity</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {Math.round((selectedElement.fillOpacity ?? 1) * 100)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round((selectedElement.fillOpacity ?? 1) * 100)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) / 100;
                              onUpdateElement(selectedElement.id, { fillOpacity: val });
                            }}
                            style={{ flex: 1, accentColor: '#FF5500' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Border Color */}
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Border Color</span>
                      <div style={styles.colorPillRow}>
                        <input
                          type="color"
                          value={
                            pptxShape
                              ? (normalizeHex(typeof pptxShape.strokeColor === 'string' ? pptxShape.strokeColor : undefined) || '#FF5500')
                              : (normalizeHex(selectedElement?.borderColor) || '#FF5500')
                          }
                          onChange={(e) => {
                            if (pptxShape) (pptx as PptxInspector | null)?.onStroke(e.target.value, (pptxShape?.strokeWidthPx as number) || 2);
                            else if (selectedElement) onUpdateElement(selectedElement.id, { borderColor: e.target.value });
                          }}
                          style={styles.colorSwatch}
                        />
                        <input
                          type="text"
                          spellCheck={false}
                          value={
                            pptxShape
                              ? ((typeof pptxShape.strokeColor === 'string' ? pptxShape.strokeColor : '#FF5500')).toUpperCase()
                              : (selectedElement?.borderColor || '#FF5500').toUpperCase()
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (pptxShape) (pptx as PptxInspector | null)?.onStroke(val);
                            else if (selectedElement) onUpdateElement(selectedElement.id, { borderColor: val });
                          }}
                          style={styles.colorHexInput}
                        />
                      </div>
                    </div>

                    {/* Stroke Opacity Slider */}
                    {selectedElement && (
                      <div style={styles.propRowCol}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={styles.propLabel}>Stroke Opacity</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {Math.round((selectedElement.strokeOpacity ?? 1) * 100)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round((selectedElement.strokeOpacity ?? 1) * 100)}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) / 100;
                              onUpdateElement(selectedElement.id, { strokeOpacity: val });
                            }}
                            style={{ flex: 1, accentColor: '#FF5500' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Border Width Slider */}
                    <div style={styles.propRowCol}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.propLabel}>Border Width</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {pptxShape ? ((pptxShape.strokeWidthPx as number) || 0) : (selectedElement ? (selectedElement.borderWidth ?? (selectedElement.type === 'shape' ? 3 : 0)) : 0)}px
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={pptxShape ? ((pptxShape.strokeWidthPx as number) || 0) : (selectedElement ? (selectedElement.borderWidth ?? (selectedElement.type === 'shape' ? 3 : 0)) : 0)}
                          onChange={(e) => {
                            const bw = parseInt(e.target.value, 10);
                            if (pptxShape) (pptx as PptxInspector | null)?.onStroke((typeof pptxShape?.strokeColor === 'string' ? pptxShape.strokeColor : '#FF5500'), bw);
                            else if (selectedElement) onUpdateElement(selectedElement.id, { borderWidth: bw });
                          }}
                          style={{ flex: 1, accentColor: '#FF5500' }}
                        />
                      </div>
                    </div>

                    {/* Corner Radius Slider (Works on All Shapes, Text Boxes & Images!) */}
                    <div style={styles.propRowCol}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.propLabel}>Corner Radius</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedElement?.borderRadius ?? 0}px
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={selectedElement?.borderRadius ?? 0}
                          onChange={(e) => {
                            const radius = parseInt(e.target.value, 10);
                            if (selectedElement) onUpdateElement(selectedElement.id, { borderRadius: radius });
                          }}
                          style={{ flex: 1, accentColor: '#FF5500' }}
                        />
                      </div>
                    </div>

                    {/* Layer Opacity Slider */}
                    <div style={styles.propRowCol}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.propLabel}>Layer Opacity</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {Math.round((selectedElement?.opacity ?? 1) * 100)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((selectedElement?.opacity ?? 1) * 100)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) / 100;
                            if (selectedElement) onUpdateElement(selectedElement.id, { opacity: val });
                          }}
                          style={{ flex: 1, accentColor: '#FF5500' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Effects & Shadows Section */}
            {selectedElement && (
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader} onClick={() => toggleSection('effects')}>
                  <span style={styles.sectionTitle}>Effects & Shadows</span>
                  <ChevronIcon open={Boolean(openSections.effects)} />
                </div>

                {openSections.effects && (
                  <div style={styles.sectionBody}>
                    {/* Text Drop Shadow (For Text & Shape elements with content) */}
                    {(selectedElement.type === 'text' || selectedElement.type === 'shape') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Text Drop Shadow</span>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedElement.shadowEnabled)}
                            onChange={(e) => onUpdateElement(selectedElement.id, { shadowEnabled: e.target.checked })}
                            style={{ cursor: 'pointer', accentColor: '#FF5500' }}
                          />
                        </div>

                        {selectedElement.shadowEnabled && (
                          <>
                            {/* Color */}
                            <div style={styles.propRowCol}>
                              <span style={styles.propLabel}>Shadow Color</span>
                              <div style={styles.colorPillRow}>
                                <input
                                  type="color"
                                  value={normalizeHex(selectedElement.shadowColor) || '#000000'}
                                  onChange={(e) => onUpdateElement(selectedElement.id, { shadowColor: e.target.value })}
                                  style={styles.colorSwatch}
                                />
                                <input
                                  type="text"
                                  spellCheck={false}
                                  value={(selectedElement.shadowColor || '#000000').toUpperCase()}
                                  onChange={(e) => onUpdateElement(selectedElement.id, { shadowColor: e.target.value })}
                                  style={styles.colorHexInput}
                                />
                              </div>
                            </div>

                            {/* Blur Radius */}
                            <div style={styles.propRowCol}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={styles.propLabel}>Blur Radius</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {selectedElement.shadowBlur ?? 8}px
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="40"
                                value={selectedElement.shadowBlur ?? 8}
                                onChange={(e) => onUpdateElement(selectedElement.id, { shadowBlur: parseInt(e.target.value, 10) })}
                                style={{ accentColor: '#FF5500' }}
                              />
                            </div>

                            {/* Offset X & Y */}
                            <div style={styles.twoColRow}>
                              <div style={styles.propRowCol}>
                                <span style={styles.propLabel}>Offset X</span>
                                <ScrubbableInput
                                  value={selectedElement.shadowOffsetX ?? 0}
                                  onChange={(v) => onUpdateElement(selectedElement.id, { shadowOffsetX: v })}
                                  min={-30}
                                  max={30}
                                  step={1}
                                />
                              </div>
                              <div style={styles.propRowCol}>
                                <span style={styles.propLabel}>Offset Y</span>
                                <ScrubbableInput
                                  value={selectedElement.shadowOffsetY ?? 4}
                                  onChange={(v) => onUpdateElement(selectedElement.id, { shadowOffsetY: v })}
                                  min={-30}
                                  max={30}
                                  step={1}
                                />
                              </div>
                            </div>

                            {/* Opacity */}
                            <div style={styles.propRowCol}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={styles.propLabel}>Shadow Opacity</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {Math.round((selectedElement.shadowOpacity ?? 0.5) * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={Math.round((selectedElement.shadowOpacity ?? 0.5) * 100)}
                                onChange={(e) => onUpdateElement(selectedElement.id, { shadowOpacity: parseFloat(e.target.value) / 100 })}
                                style={{ accentColor: '#FF5500' }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Container Box Shadow (For Shapes, Images, & Containers) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: (selectedElement.type === 'text' || selectedElement.type === 'shape') ? 6 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Container Box Shadow</span>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedElement.boxShadowEnabled)}
                          onChange={(e) => onUpdateElement(selectedElement.id, { boxShadowEnabled: e.target.checked })}
                          style={{ cursor: 'pointer', accentColor: '#FF5500' }}
                        />
                      </div>

                      {selectedElement.boxShadowEnabled && (
                        <>
                          {/* Color */}
                          <div style={styles.propRowCol}>
                            <span style={styles.propLabel}>Box Shadow Color</span>
                            <div style={styles.colorPillRow}>
                              <input
                                type="color"
                                value={normalizeHex(selectedElement.boxShadowColor) || '#000000'}
                                onChange={(e) => onUpdateElement(selectedElement.id, { boxShadowColor: e.target.value })}
                                style={styles.colorSwatch}
                              />
                              <input
                                type="text"
                                spellCheck={false}
                                value={(selectedElement.boxShadowColor || '#000000').toUpperCase()}
                                onChange={(e) => onUpdateElement(selectedElement.id, { boxShadowColor: e.target.value })}
                                style={styles.colorHexInput}
                              />
                            </div>
                          </div>

                          {/* Blur Radius */}
                          <div style={styles.propRowCol}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={styles.propLabel}>Blur Radius</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {selectedElement.boxShadowBlur ?? 12}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={selectedElement.boxShadowBlur ?? 12}
                              onChange={(e) => onUpdateElement(selectedElement.id, { boxShadowBlur: parseInt(e.target.value, 10) })}
                              style={{ accentColor: '#FF5500' }}
                            />
                          </div>

                          {/* Offset X & Y */}
                          <div style={styles.twoColRow}>
                            <div style={styles.propRowCol}>
                              <span style={styles.propLabel}>Offset X</span>
                              <ScrubbableInput
                                value={selectedElement.boxShadowOffsetX ?? 0}
                                onChange={(v) => onUpdateElement(selectedElement.id, { boxShadowOffsetX: v })}
                                min={-30}
                                max={30}
                                step={1}
                              />
                            </div>
                            <div style={styles.propRowCol}>
                              <span style={styles.propLabel}>Offset Y</span>
                              <ScrubbableInput
                                value={selectedElement.boxShadowOffsetY ?? 6}
                                onChange={(v) => onUpdateElement(selectedElement.id, { boxShadowOffsetY: v })}
                                min={-30}
                                max={30}
                                step={1}
                              />
                            </div>
                          </div>

                          {/* Opacity */}
                          <div style={styles.propRowCol}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={styles.propLabel}>Box Shadow Opacity</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {Math.round((selectedElement.boxShadowOpacity ?? 0.4) * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((selectedElement.boxShadowOpacity ?? 0.4) * 100)}
                              onChange={(e) => onUpdateElement(selectedElement.id, { boxShadowOpacity: parseFloat(e.target.value) / 100 })}
                              style={{ accentColor: '#FF5500' }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Geometry & Transform Section */}
            {selectedElement && (
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader} onClick={() => toggleSection('geometry')}>
                  <span style={styles.sectionTitle}>Geometry & Transform</span>
                  <ChevronIcon open={Boolean(openSections.geometry)} />
                </div>

                {openSections.geometry && (
                  <div style={styles.sectionBody}>
                    <div style={styles.twoColRow}>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>X Position (%)</span>
                        <ScrubbableInput
                          value={selectedElement.x || 0}
                          onChange={(v) => onUpdateElement(selectedElement.id, { x: v })}
                          min={-100}
                          max={200}
                          step={1}
                        />
                      </div>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Y Position (%)</span>
                        <ScrubbableInput
                          value={selectedElement.y || 0}
                          onChange={(v) => onUpdateElement(selectedElement.id, { y: v })}
                          min={-100}
                          max={200}
                          step={1}
                        />
                      </div>
                    </div>

                    <div style={styles.twoColRow}>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Width (%)</span>
                        <ScrubbableInput
                          value={selectedElement.width || 0}
                          onChange={(v) => onUpdateElement(selectedElement.id, { width: v })}
                          min={1}
                          max={200}
                          step={1}
                        />
                      </div>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Height (%)</span>
                        <ScrubbableInput
                          value={selectedElement.height || 0}
                          onChange={(v) => onUpdateElement(selectedElement.id, { height: v })}
                          min={1}
                          max={200}
                          step={1}
                        />
                      </div>
                    </div>

                    {/* Rotation Control */}
                    <div style={styles.propRowCol}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={styles.propLabel}>Rotation Angle ({selectedElement.rotation || 0}°)</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => onUpdateElement(selectedElement.id, { rotation: ((selectedElement.rotation || 0) - 90) % 360 })}
                            style={{ background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                            title="Rotate 90° Left"
                          >
                            ↺ -90°
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateElement(selectedElement.id, { rotation: ((selectedElement.rotation || 0) + 90) % 360 })}
                            style={{ background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                            title="Rotate 90° Right"
                          >
                            ↻ +90°
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={selectedElement.rotation || 0}
                        onChange={(e) => onUpdateElement(selectedElement.id, { rotation: parseInt(e.target.value, 10) })}
                        style={{ accentColor: '#FF5500' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ---- LAYER TAB -------------------------------------------------- */}
        {activeTab === 'layer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
              Layers — top first
            </span>

            {pptx && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={pptx.onGroup}
                  disabled={!pptx.canGroup}
                  style={groupButtonStyle(pptx.canGroup)}
                >
                  Group
                </button>
                <button
                  type="button"
                  onClick={pptx.onUngroup}
                  disabled={!pptx.canUngroup}
                  style={groupButtonStyle(pptx.canUngroup)}
                >
                  Ungroup
                </button>
              </div>
            )}

            {pptx ? (
              <LayerList
                rows={pptx.layers}
                onSelect={pptx.onSelectLayer}
                onReorder={pptx.onReorderLayer}
                onDelete={pptx.onDeleteLayer}
                emptyHint="This slide's artwork all comes from its layout, so there is nothing on the slide itself to restack."
              />
            ) : (
              <LayerList
                rows={nativeRows}
                onSelect={(id, additive) => onSelectElement(id, additive)}
                onReorder={handleNativeReorder}
                onDuplicateLayer={handleNativeDuplicateLayer}
                onDelete={onDeleteElement}
                onToggleLock={(id) => {
                  const target = nativeElements.find((e) => e.id === id);
                  if (target) onUpdateElement(id, { locked: !target.locked });
                }}
                emptyHint="This slide has no elements yet. Add a text box or a shape from the toolbar."
              />
            )}
          </div>
        )}

        {/* ---- AI STUDIO TAB ---------------------------------------------- */}
        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, padding: '32px 16px', textAlign: 'center', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: 'rgba(255, 85, 0, 0.12)',
                border: '1px solid rgba(255, 85, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: '#FF5500',
              }}
            >
              ✨
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
              AI Studio
            </div>
            <div
              style={{
                padding: '4px 12px',
                borderRadius: 12,
                background: 'rgba(244, 114, 182, 0.15)',
                border: '1px solid rgba(244, 114, 182, 0.3)',
                color: '#f472b6',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Coming Soon
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: 0, maxWidth: 220 }}>
              AI-powered slide generation, smart sermon layouts, and automated theme styling are currently in development.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function groupButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    height: 28,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 5,
    color: enabled ? 'var(--text-primary)' : 'var(--text-dim)',
    fontSize: 11,
    cursor: enabled ? 'pointer' : 'default',
  };
}

const styles: Record<string, React.CSSProperties> = {
  sectionCard: {
    background: 'var(--block-bg)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '10px 12px',
    background: 'var(--chrome-control)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  sectionBody: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  propRowCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  propLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  twoColRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: 8,
    minWidth: 0,
  },
  pillGroup: {
    display: 'flex',
    gap: 4,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 3,
  },
  pillBtn: {
    flex: 1,
    padding: '5px 4px',
    border: 'none',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  colorPillRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: '4px 8px',
    height: 32,
    boxSizing: 'border-box',
  },
  colorSwatch: {
    width: 20,
    height: 20,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 3,
  },
  colorHexInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 600,
    outline: 'none',
  },
  opacityBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  iconInputBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: '0 8px',
    height: 32,
  },
  iconInputBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  iconInput: {
    flex: 1,
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
  },
  segmentGroup: {
    display: 'flex',
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  numberInput: {
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    padding: '6px 8px',
    fontSize: 12,
    outline: 'none',
  },
};
