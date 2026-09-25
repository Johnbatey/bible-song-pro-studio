import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import type { MessageKey } from '../../../i18n/types';
import { IconFolder, IconCheck, IconSparkles } from './SlideEditorIcons';
import { LayerList, type LayerRow } from './LayerList';
import { ShapeInspector } from '../ShapeInspector';
import { SlideTextPanel } from '../SlideTextPanel';
import { CustomDropdown } from '../CustomDropdown';
import { slideElementsFor } from '../NativeSlideBoard';
import type { ParsedShape } from '../../slide-engine/parser/slide-parser';
import type { PresentationSlide, SlideElement } from '../../types';
import { useAppStore } from '../../stores/appStore';
import { parseBackgroundInfo, gradientCss } from '../../utils/background';
import { fetchInstalledSystemFonts, type FontOptionItem } from '../../utils/system-fonts';
import { importSlideImage } from '../../utils/import-slide-image';
import {
  StudioSlider,
  StudioToggle,
  StudioColorPicker,
  StudioGradientRamp,
} from '../ThemeEditorForm';
import { CircularAngleDial } from '../BackgroundPicker';
import '../ThemeStudio.css';

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

function nativeLayerRows(elements: SlideElement[], selectedIds: string[], t: (key: MessageKey) => string): LayerRow[] {
  return [...elements]
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    .map((el) => ({
      id: el.id,
      label: el.type === 'pencil' ? t('slideEditor.layer.freehandDrawing') : el.type === 'bezier' ? t('slideEditor.layer.penCurve') : (el.content || '').trim().slice(0, 34) || el.type,
      kind: el.type === 'text' ? 'text' : el.type === 'image' ? 'image' : el.type === 'pencil' ? 'pencil' : el.type === 'bezier' ? 'bezier' : 'shape',
      selected: selectedIds.includes(el.id),
      locked: Boolean(el.locked),
      hidden: Boolean(el.hidden),
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

function fontWeightOptions(t: (key: MessageKey) => string) {
  return [
    { value: '100', label: t('slideEditor.fontWeight.thin') },
    { value: '300', label: t('slideEditor.fontWeight.light') },
    { value: '400', label: t('slideEditor.fontWeight.regular') },
    { value: '500', label: t('slideEditor.fontWeight.medium') },
    { value: '600', label: t('slideEditor.fontWeight.semiBold') },
    { value: '700', label: t('slideEditor.fontWeight.bold') },
    { value: '800', label: t('slideEditor.fontWeight.extraBold') },
    { value: '900', label: t('slideEditor.fontWeight.black') },
  ];
}

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
  const { t } = useI18n();
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
      title={title || t('slideEditor.sidebar.scrubTitle')}
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

function GradientRampPicker({ value, onChange, t }: GradientRampPickerProps & { t: (key: MessageKey, vars?: Record<string, string | number>) => string }) {
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

  const trackRef = useRef<HTMLDivElement>(null);

  const handlePointerDownTrack = (e: React.PointerEvent<HTMLDivElement>, targetStop?: 'start' | 'end') => {
    if (!trackRef.current) return;
    e.preventDefault();
    const rect = trackRef.current.getBoundingClientRect();
    const calculatePos = (clientX: number) => {
      const pct = ((clientX - rect.left) / rect.width) * 100;
      return Math.round(Math.max(0, Math.min(100, pct)));
    };

    const clickPos = calculatePos(e.clientX);
    let stopToMove = targetStop;
    if (!stopToMove) {
      const distStart = Math.abs(clickPos - startPos);
      const distEnd = Math.abs(clickPos - endPos);
      stopToMove = distStart <= distEnd ? 'start' : 'end';
    }

    setActiveStop(stopToMove);
    handlePosChange(stopToMove, clickPos);

    const activeStopRef = stopToMove;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const pos = calculatePos(moveEvt.clientX);
      handlePosChange(activeStopRef, pos);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const activeColor = activeStop === 'start' ? startColor : endColor;
  const activePos = activeStop === 'start' ? startPos : endPos;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4, width: '100%', boxSizing: 'border-box' }}>
      {/* Visual Gradient Ramp Track Bar with Movable Stop Pins */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={styles.propLabel}>{t('slideEditor.sidebar.gradientRamp')}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)' }}>
            {isRadial ? t('slideEditor.sidebar.radial') : `${angleDeg}°`}
          </span>
        </div>

        {/* Ramp Track Bar Container */}
        <div
          ref={trackRef}
          onPointerDown={(e) => handlePointerDownTrack(e)}
          style={{ position: 'relative', width: '100%', paddingTop: 6, paddingBottom: 16, cursor: 'ew-resize', touchAction: 'none' }}
        >
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
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDownTrack(e, 'start');
            }}
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
            title={t('slideEditor.sidebar.highlightStopTitle')}
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
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDownTrack(e, 'end');
            }}
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
            title={t('slideEditor.sidebar.shadowStopTitle')}
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
          {t('slideEditor.sidebar.highlight')} ({startPos}%)
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
          {t('slideEditor.sidebar.shadow')} ({endPos}%)
        </button>
      </div>

      {/* Active Stop Color & Position Editor Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        {/* Color Swatch & Hex */}
        <div style={styles.propRowCol}>
          <span style={styles.propLabel}>{activeStop === 'start' ? t('slideEditor.sidebar.highlightColor') : t('slideEditor.sidebar.shadowColor')}</span>
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
            <span style={styles.propLabel}>{t('slideEditor.sidebar.location')}</span>
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
          <span style={styles.propLabel}>{t('slideEditor.sidebar.angleDirection')}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isRadial ? t('slideEditor.sidebar.radial') : `${angleDeg}°`}
          </span>
        </div>

        {/* Direction Presets */}
        <div style={styles.segmentGroup}>
          {[
            { label: t('slideEditor.sidebar.dir135'), dir: '135deg' },
            { label: t('slideEditor.sidebar.dir90'), dir: '90deg' },
            { label: t('slideEditor.sidebar.dir180'), dir: '180deg' },
            { label: t('slideEditor.sidebar.dir0'), dir: '0deg' },
            { label: t('slideEditor.sidebar.dirRadial'), dir: 'radial' },
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
        <span style={styles.propLabel}>{t('slideEditor.sidebar.presets')}</span>
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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'design' | 'layer' | 'ai'>('design');
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [systemFontItems, setSystemFontItems] = useState<FontOptionItem[]>([]);
  const [recentFonts, setRecentFonts] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('bsp_recent_fonts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [highlightedFont, setHighlightedFont] = useState<string | null>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const fontListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initialFontRef = useRef<string>('');

  useEffect(() => {
    let isMounted = true;
    fetchInstalledSystemFonts().then((items) => {
      if (isMounted) setSystemFontItems(items);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isFontMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setIsFontMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isFontMenuOpen]);

  useEffect(() => {
    if (isFontMenuOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isFontMenuOpen]);

  // Accordion Section Expansion States (collapsed by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    canvas: false,
    typography: false,
    shape: false,
    effects: false,
    geometry: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const defaultThemeBgColor = uiThemeMode !== 'light' ? '#ffffff' : '#18181b';
  const bgType = slide.background?.type || 'color';
  const bgValue = slide.background?.value || defaultThemeBgColor;

  // Canvas background memory tracking (restores settings when turning back on or switching modes)
  const lastColorRef = useRef<string>(bgType === 'color' && bgValue !== 'transparent' ? bgValue : defaultThemeBgColor);
  const lastGradientRef = useRef<string>(bgType === 'gradient' ? bgValue : 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)');
  const lastImageRef = useRef<string>(bgType === 'image' ? bgValue : '');
  const lastNonAlphaModeRef = useRef<'color' | 'gradient' | 'image'>(bgType === 'gradient' ? 'gradient' : bgType === 'image' ? 'image' : 'color');

  useEffect(() => {
    if (bgType === 'color' && bgValue !== 'transparent' && bgValue !== 'none') {
      lastColorRef.current = bgValue;
      lastNonAlphaModeRef.current = 'color';
    } else if (bgType === 'gradient') {
      lastGradientRef.current = bgValue;
      lastNonAlphaModeRef.current = 'gradient';
    } else if (bgType === 'image') {
      lastImageRef.current = bgValue;
      lastNonAlphaModeRef.current = 'image';
    }
  }, [bgType, bgValue]);

  // Shape and vector fill & border color memory tracking
  const lastFillColorMap = useRef<Record<string, string>>({});
  const lastBorderColorMap = useRef<Record<string, string>>({});
  const lastBorderWidthMap = useRef<Record<string, number>>({});

  useEffect(() => {
    if (selectedElement) {
      const fill = selectedElement.backgroundColor || selectedElement.fillColor;
      if (fill && fill !== 'transparent' && fill !== 'none') {
        lastFillColorMap.current[selectedElement.id] = fill;
      }
      const borderCol = selectedElement.borderColor || selectedElement.strokeColor;
      if (borderCol && borderCol !== 'transparent' && borderCol !== 'none') {
        lastBorderColorMap.current[selectedElement.id] = borderCol;
      }
      const borderW = selectedElement.borderWidth ?? selectedElement.strokeWidth;
      if (borderW && borderW > 0) {
        lastBorderWidthMap.current[selectedElement.id] = borderW;
      }
    }
  }, [selectedElement]);

  /* Through the same helper both canvases render with, so a slide that has
     never been touched still shows its default title and body here — reading
     `slide.elements` straight gave an empty list for exactly those slides, and
     the inspector had nothing to point at. */
  const nativeElements = slideElementsFor(slide);
  const activeSelectionIds = selectedElementIds.length > 0
    ? selectedElementIds
    : (selectedElement ? [selectedElement.id] : []);
  const nativeRows = nativeLayerRows(nativeElements, activeSelectionIds, t);

  const firstPptxText = pptx
    ? (pptx.selected.find((s) => s.paragraphs && s.paragraphs.length > 0) ||
       pptx.shapes.find((s) => s.paragraphs && s.paragraphs.length > 0) || null)
    : null;
  const firstPptxRun = firstPptxText?.paragraphs?.[0]?.[0];

  const firstTextElement = nativeElements.find((e) => e.type === 'text') || null;
  const firstShapeElement = nativeElements.find((e) => e.type === 'shape' || e.type === 'bezier' || e.type === 'image') || null;
  const pptxShape = pptx && pptx.selected && pptx.selected.length > 0 ? pptx.selected[0] : null;

  const targetTextElement = pptx
    ? null
    : (selectedElement
        ? (selectedElement.type === 'text' ? selectedElement : null)
        : firstTextElement);

  const targetShapeElement = pptxShape
    ? null
    : (selectedElement
        ? selectedElement
        : firstShapeElement);

  const targetEffectElement = selectedElement || firstTextElement || firstShapeElement || nativeElements[0] || null;
  const targetGeomElement = selectedElement || nativeElements[0] || null;

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

  const defaultBundledFonts: FontOptionItem[] = useMemo(() => [
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
    { value: 'Cinzel', label: 'Cinzel' },
    { value: 'Crimson Pro', label: 'Crimson Pro' },
    { value: 'Lora', label: 'Lora' },
    { value: 'Courier New', label: 'Courier New' },
  ], []);

  const bundledFonts = useMemo(() => {
    return systemFontItems.length > 0
      ? systemFontItems.filter((f) => !f.isSystemFont)
      : defaultBundledFonts;
  }, [systemFontItems, defaultBundledFonts]);

  const installedSystemFonts = useMemo(() => {
    return systemFontItems.filter((f) => f.isSystemFont);
  }, [systemFontItems]);

  const q = fontSearchQuery.toLowerCase().trim();

  const filteredRecent = useMemo(() => {
    return recentFonts.filter((rf) => !q || rf.toLowerCase().includes(q));
  }, [recentFonts, q]);

  const filteredBundled = useMemo(() => {
    return bundledFonts.filter((f) => !q || f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
  }, [bundledFonts, q]);

  const filteredInstalled = useMemo(() => {
    return installedSystemFonts.filter((f) => !q || f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
  }, [installedSystemFonts, q]);

  const flatVisibleFonts = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    filteredRecent.forEach((rf) => {
      if (!seen.has(rf)) {
        seen.add(rf);
        const match = systemFontItems.find((f) => f.value === rf) || defaultBundledFonts.find((f) => f.value === rf);
        list.push({ value: rf, label: match ? match.label : rf.split(',')[0].replace(/['"]/g, '').trim() });
      }
    });
    filteredBundled.forEach((f) => {
      if (!seen.has(f.value)) {
        seen.add(f.value);
        list.push(f);
      }
    });
    filteredInstalled.forEach((f) => {
      if (!seen.has(f.value)) {
        seen.add(f.value);
        list.push(f);
      }
    });
    return list;
  }, [filteredRecent, filteredBundled, filteredInstalled, systemFontItems, defaultBundledFonts]);

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

  const handlePreviewFont = (fontValue: string) => {
    setHighlightedFont(fontValue);
    setText({ fontFamily: fontValue });
  };

  const handleFontSelect = (fontName: string) => {
    setText({ fontFamily: fontName });
    setHighlightedFont(fontName);
    try {
      const raw = localStorage.getItem('bsp_recent_fonts');
      const list: string[] = raw ? JSON.parse(raw) : [];
      const updated = [fontName, ...list.filter((f) => f !== fontName)].slice(0, 3);
      localStorage.setItem('bsp_recent_fonts', JSON.stringify(updated));
      setRecentFonts(updated);
    } catch {}
  };

  const handleCommitFont = (fontValue: string) => {
    handleFontSelect(fontValue);
    setIsFontMenuOpen(false);
  };

  const handleCancelFont = () => {
    if (initialFontRef.current) {
      setText({ fontFamily: initialFontRef.current });
    }
    setIsFontMenuOpen(false);
  };

  const handleFontKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancelFont();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatVisibleFonts.length === 0) return;
      const currentVal = highlightedFont || currentFontFamily || 'Inter';
      const currentIndex = flatVisibleFonts.findIndex((f) => f.value === currentVal);
      const nextIndex = currentIndex < flatVisibleFonts.length - 1 ? currentIndex + 1 : 0;
      const nextFont = flatVisibleFonts[nextIndex];
      if (nextFont) {
        handlePreviewFont(nextFont.value);
        const el = fontListRef.current?.querySelector(`[data-font-idx="${nextIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatVisibleFonts.length === 0) return;
      const currentVal = highlightedFont || currentFontFamily || 'Inter';
      const currentIndex = flatVisibleFonts.findIndex((f) => f.value === currentVal);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : flatVisibleFonts.length - 1;
      const prevFont = flatVisibleFonts[prevIndex];
      if (prevFont) {
        handlePreviewFont(prevFont.value);
        const el = fontListRef.current?.querySelector(`[data-font-idx="${prevIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = highlightedFont || currentFontFamily;
      if (chosen) handleCommitFont(chosen);
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

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imported = await importSlideImage(file);
    if ('error' in imported) {
      window.alert(imported.error);
      return;
    }
    onUpdateSlide({ background: { type: 'image', value: imported.url } });
  };

  const bgInfo = parseBackgroundInfo(bgValue, undefined);
  let globalFontIdxCounter = 0;

  return (
    <aside
      style={{
        width: 290,
        minWidth: 290,
        background: '#141416',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
        color: '#f4f4f5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <input
        type="file"
        ref={bgFileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgImageUpload}
      />

      {/* Tri-Tab Header Row Styled with Theme Studio Pill */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#141416' }}>
        <div className="studio-segmented-pill">
          {(['design', 'layer', 'ai'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`studio-segmented-tab ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'design' ? t('slideEditor.sidebar.tabDesign') : tab === 'layer' ? t('slideEditor.sidebar.tabLayer') : t('slideEditor.sidebar.tabAi')}
            </button>
          ))}
        </div>
      </div>

      {/* Viewport Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }} className="bar-scroll">
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
            {/* Canvas Background Section (Aspect ratio removed as requested) */}
            <div className="studio-section" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('canvas')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.canvas ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>{t('slideEditor.sidebar.canvasBackground')}</span>
                </div>
              </button>

              {openSections.canvas && (
                <div className="studio-section-content" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
                  {/* Canvas Background Toggle & Mode Pills */}
                  <div className="studio-toggle-row">
                    <span className="studio-toggle-label">{t('slideEditor.sidebar.canvasBackground')}</span>
                    <StudioToggle
                      checked={bgValue !== 'transparent'}
                      onChange={(on) => {
                        if (!on) {
                          onUpdateSlide({ background: { type: 'color', value: 'transparent' } });
                        } else {
                          const mode = lastNonAlphaModeRef.current || 'color';
                          if (mode === 'gradient') {
                            onUpdateSlide({ background: { type: 'gradient', value: lastGradientRef.current || 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)' } });
                          } else if (mode === 'image') {
                            onUpdateSlide({ background: { type: 'image', value: lastImageRef.current || '' } });
                          } else {
                            onUpdateSlide({ background: { type: 'color', value: lastColorRef.current || '#18181b' } });
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Background Mode Pills */}
                  <div className="studio-segmented-pill">
                    {(['color', 'gradient', 'image', 'none'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          if (type === 'none') {
                            onUpdateSlide({ background: { type: 'color', value: 'transparent' } });
                          } else if (type === 'color') {
                            onUpdateSlide({ background: { type: 'color', value: lastColorRef.current || '#18181b' } });
                          } else if (type === 'gradient') {
                            onUpdateSlide({ background: { type: 'gradient', value: lastGradientRef.current || 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)' } });
                          } else if (type === 'image') {
                            onUpdateSlide({ background: { type: 'image', value: lastImageRef.current || '' } });
                          }
                        }}
                        className={`studio-segmented-tab ${
                          (type === 'none' && bgValue === 'transparent') ||
                          (type !== 'none' && bgType === type && bgValue !== 'transparent')
                            ? 'active'
                            : ''
                        }`}
                        style={{ fontSize: 11 }}
                      >
                        {type === 'none' ? 'Alpha' : type === 'color' ? t('slideEditor.sidebar.bgColor') : type === 'gradient' ? t('slideEditor.sidebar.bgGradient') : t('slideEditor.sidebar.bgImage')}
                      </button>
                    ))}
                  </div>

                  {/* Solid Color Picker with Selectable/Copyable Hex */}
                  {bgType === 'color' && bgValue !== 'transparent' && (
                    <StudioColorPicker
                      label={t('slideEditor.sidebar.bgColor')}
                      value={bgValue.startsWith('#') ? bgValue : '#18181b'}
                      onChange={(c) => onUpdateSlide({ background: { type: 'color', value: c } })}
                    />
                  )}

                  {/* Gradient Ramp & Stop Controls */}
                  {bgType === 'gradient' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <StudioGradientRamp
                        startColor={bgInfo.start || '#F97316'}
                        endColor={bgInfo.end || '#7C2D12'}
                        direction={bgInfo.dir || '135deg'}
                        isRadial={bgInfo.dir === 'radial'}
                        startPos={bgInfo.startPos ?? 0}
                        endPos={bgInfo.endPos ?? 100}
                        onColorChange={({ start, end, startPos, endPos }) => {
                          const s = start ?? bgInfo.start ?? '#F97316';
                          const e = end ?? bgInfo.end ?? '#7C2D12';
                          const d = bgInfo.dir ?? '135deg';
                          const sp = startPos ?? bgInfo.startPos ?? 0;
                          const ep = endPos ?? bgInfo.endPos ?? 100;
                          const nextCss = gradientCss(s, e, d, sp, ep);
                          lastGradientRef.current = nextCss;
                          onUpdateSlide({ background: { type: 'gradient', value: nextCss } });
                        }}
                        onSwapColors={() => {
                          const s = bgInfo.start || '#F97316';
                          const e = bgInfo.end || '#7C2D12';
                          const d = bgInfo.dir ?? '135deg';
                          const sp = bgInfo.startPos ?? 0;
                          const ep = bgInfo.endPos ?? 100;
                          const nextCss = gradientCss(e, s, d, 100 - ep, 100 - sp);
                          lastGradientRef.current = nextCss;
                          onUpdateSlide({ background: { type: 'gradient', value: nextCss } });
                        }}
                      />

                      {/* Gradient Angle Controls with Circular Dial (Linear Mode) */}
                      {bgInfo.dir !== 'radial' && (
                        <div className="studio-field-box">
                          <div className="studio-slider-labels">
                            <span className="studio-slider-name">{t('slideEditor.sidebar.gradientAngle')}</span>
                            <span className="studio-slider-value">
                              {(parseInt(bgInfo.dir.replace('deg', ''), 10) || 135)}°
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CircularAngleDial
                              angleDeg={parseInt(bgInfo.dir.replace('deg', ''), 10) || 135}
                              isRadial={false}
                              onChangeAngle={(deg) => {
                                const s = bgInfo.start || '#F97316';
                                const e = bgInfo.end || '#7C2D12';
                                const nextCss = gradientCss(s, e, `${deg}deg`, bgInfo.startPos ?? 0, bgInfo.endPos ?? 100);
                                lastGradientRef.current = nextCss;
                                onUpdateSlide({ background: { type: 'gradient', value: nextCss } });
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div className="studio-slider-track-wrap">
                                <input
                                  type="range"
                                  min={0}
                                  max={360}
                                  step={1}
                                  value={parseInt(bgInfo.dir.replace('deg', ''), 10) || 135}
                                  onChange={(evt) => {
                                    const deg = Number(evt.target.value);
                                    const s = bgInfo.start || '#F97316';
                                    const endColor = bgInfo.end || '#7C2D12';
                                    const nextCss = gradientCss(s, endColor, `${deg}deg`, bgInfo.startPos ?? 0, bgInfo.endPos ?? 100);
                                    lastGradientRef.current = nextCss;
                                    onUpdateSlide({ background: { type: 'gradient', value: nextCss } });
                                  }}
                                  className="studio-range-slider"
                                  style={{
                                    background: `linear-gradient(to right, #10B981 0%, #10B981 ${(((parseInt(bgInfo.dir.replace('deg', ''), 10) || 135)) / 360) * 100}%, var(--studio-track-bg, rgba(255, 255, 255, 0.12)) ${(((parseInt(bgInfo.dir.replace('deg', ''), 10) || 135)) / 360) * 100}%, var(--studio-track-bg, rgba(255, 255, 255, 0.12)) 100%)`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Direction Presets */}
                      <div className="studio-segmented-pill">
                        {[
                          { label: '135°', dir: '135deg' },
                          { label: '90°', dir: '90deg' },
                          { label: '180°', dir: '180deg' },
                          { label: '0°', dir: '0deg' },
                          { label: 'Radial', dir: 'radial' },
                        ].map((preset) => {
                          const on = (bgInfo.dir || '135deg') === preset.dir;
                          return (
                            <button
                              key={preset.dir}
                              type="button"
                              onClick={() => {
                                const s = bgInfo.start || '#F97316';
                                const e = bgInfo.end || '#7C2D12';
                                const nextCss = gradientCss(s, e, preset.dir, bgInfo.startPos ?? 0, bgInfo.endPos ?? 100);
                                lastGradientRef.current = nextCss;
                                onUpdateSlide({ background: { type: 'gradient', value: nextCss } });
                              }}
                              className={`studio-segmented-tab ${on ? 'active' : ''}`}
                              style={{ fontSize: 10, padding: '4px 0' }}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Quick Gradient Presets Grid */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        <span className="studio-field-label" style={{ marginBottom: 0 }}>{t('slideEditor.sidebar.presets')}</span>
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
                              onClick={() => {
                                lastGradientRef.current = grad;
                                onUpdateSlide({ background: { type: 'gradient', value: grad } });
                              }}
                              style={{
                                height: 26,
                                background: grad,
                                border: bgValue === grad ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: 5,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Background Image Upload & Presets */}
                  {bgType === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => bgFileInputRef.current?.click()}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px dashed rgba(255, 255, 255, 0.18)',
                          borderRadius: 6,
                          color: '#f4f4f5',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <IconFolder size={14} /> {t('slideEditor.sidebar.chooseImage')}
                      </button>

                      {bgValue && bgValue.startsWith('data:') && (
                        <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <IconCheck size={12} /> {t('slideEditor.sidebar.imageLoaded')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Multi-Selection Alignment & Operations Card */}
            {selectedElementIds.length > 1 && (
              <div className="studio-section" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
                <div className="studio-section-header">
                  <span className="studio-slider-name">
                    {t('slideEditor.sidebar.multiSelection', { count: selectedElementIds.length })}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
                  <div className="studio-field-box">
                    <span className="studio-field-label">{t('slideEditor.sidebar.alignment')}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, width: '100%' }}>
                      {[
                        { label: t('slideEditor.sidebar.alignLeft'), align: 'left' },
                        { label: t('slideEditor.sidebar.alignCenter'), align: 'center' },
                        { label: t('slideEditor.sidebar.alignRight'), align: 'right' },
                        { label: t('slideEditor.sidebar.alignTop'), align: 'top' },
                        { label: t('slideEditor.sidebar.alignMiddle'), align: 'middle' },
                        { label: t('slideEditor.sidebar.alignBottom'), align: 'bottom' },
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
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 5,
                            color: '#f4f4f5',
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title={t('slideEditor.sidebar.alignTitle', { align: item.align })}
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
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 5,
                        color: '#10B981',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t('slideEditor.sidebar.duplicateAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedElementIds.forEach((id) => onDeleteElement(id))}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: 5,
                        color: '#f87171',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Delete All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Typography Section */}
            <div className="studio-section" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('typography')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.typography ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>
                    {t('slideEditor.sidebar.typography')}
                    {targetTextElement && (
                      <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 400, fontSize: 11 }}>
                        {' '}— {(targetTextElement.content || t('slideEditor.sidebar.firstTextBlock')).toString().trim().slice(0, 16) || t('slideEditor.sidebar.firstTextBlock')}
                      </span>
                    )}
                  </span>
                </div>
              </button>

              {openSections.typography && (
                !targetTextElement && !pptx ? (
                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 11, padding: '10px 4px 4px 4px' }}>
                    {t('slideEditor.sidebar.selectTextHint')}
                  </div>
                ) : (
                  <div className="studio-section-content" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
                    {/* Font Family Dropdown with Live Canvas Preview */}
                    <div className="studio-field-box">
                    <span className="studio-field-label">{t('slideEditor.sidebar.font')}</span>
                    <div style={{ position: 'relative', width: '100%' }} ref={fontMenuRef}>
                      <button
                        type="button"
                        className="studio-dropdown-btn"
                        onClick={() => {
                          if (!isFontMenuOpen) {
                            initialFontRef.current = currentFontFamily;
                            setHighlightedFont(currentFontFamily);
                          }
                          setIsFontMenuOpen(!isFontMenuOpen);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '7px 10px',
                          background: '#1c1c1f',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: 6,
                          color: '#f4f4f5',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontFamily: currentFontFamily, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentFontFamily}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {isFontMenuOpen && (
                        <div
                          className="studio-font-menu-popover"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            maxHeight: 280,
                            background: '#18181b',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                            zIndex: 100005,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Search Bar */}
                          <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <input
                              ref={searchInputRef}
                              type="text"
                              placeholder="Search fonts..."
                              value={fontSearchQuery}
                              onChange={(e) => setFontSearchQuery(e.target.value)}
                              onKeyDown={handleFontKeyDown}
                              style={{
                                width: '100%',
                                background: '#27272a',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                color: '#ffffff',
                                fontSize: 12,
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>

                          {/* Scrollable Font List */}
                          <div ref={fontListRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0', maxHeight: 220 }}>
                            {/* 1. Recent Fonts */}
                            {filteredRecent.length > 0 && (
                              <div>
                                <div
                                  style={{
                                    padding: '4px 8px 2px 8px',
                                    fontSize: 10,
                                    color: '#71717a',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontWeight: 600,
                                  }}
                                >
                                  Recent Fonts
                                </div>
                                {filteredRecent.map((rf) => {
                                  const idx = globalFontIdxCounter++;
                                  const isSelected = currentFontFamily === rf;
                                  const isHighlighted = (highlightedFont || currentFontFamily) === rf;

                                  return (
                                    <div
                                      key={`recent-${rf}`}
                                      data-font-idx={idx}
                                      onClick={() => handleCommitFont(rf)}
                                      onMouseEnter={() => handlePreviewFont(rf)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: isSelected
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : isHighlighted
                                          ? 'rgba(255, 255, 255, 0.08)'
                                          : 'transparent',
                                        color: isSelected ? '#10B981' : '#f4f4f5',
                                        transition: 'background 0.08s ease',
                                      }}
                                    >
                                      <span style={{ fontFamily: rf, fontSize: 13 }}>
                                        {rf.split(',')[0].replace(/['"]/g, '').trim()}
                                      </span>
                                      {isSelected && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 2. Bundled Fonts */}
                            {filteredBundled.length > 0 && (
                              <div>
                                <div
                                  style={{
                                    padding: '6px 8px 2px 8px',
                                    fontSize: 10,
                                    color: '#71717a',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontWeight: 600,
                                  }}
                                >
                                  Bundled Fonts
                                </div>
                                {filteredBundled.map((f) => {
                                  const idx = globalFontIdxCounter++;
                                  const isSelected = currentFontFamily === f.value;
                                  const isHighlighted = (highlightedFont || currentFontFamily) === f.value;

                                  return (
                                    <div
                                      key={`bundled-${f.value}`}
                                      data-font-idx={idx}
                                      onClick={() => handleCommitFont(f.value)}
                                      onMouseEnter={() => handlePreviewFont(f.value)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: isSelected
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : isHighlighted
                                          ? 'rgba(255, 255, 255, 0.08)'
                                          : 'transparent',
                                        color: isSelected ? '#10B981' : '#f4f4f5',
                                        transition: 'background 0.08s ease',
                                      }}
                                    >
                                      <span style={{ fontFamily: f.value, fontSize: 13 }}>{f.label}</span>
                                      {isSelected && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 3. Installed PC Fonts */}
                            {filteredInstalled.length > 0 && (
                              <div>
                                <div
                                  style={{
                                    padding: '6px 8px 2px 8px',
                                    fontSize: 10,
                                    color: '#71717a',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontWeight: 600,
                                  }}
                                >
                                  Installed PC Fonts ({installedSystemFonts.length})
                                </div>
                                {filteredInstalled.map((f) => {
                                  const idx = globalFontIdxCounter++;
                                  const isSelected = currentFontFamily === f.value;
                                  const isHighlighted = (highlightedFont || currentFontFamily) === f.value;

                                  return (
                                    <div
                                      key={`sys-${f.value}`}
                                      data-font-idx={idx}
                                      onClick={() => handleCommitFont(f.value)}
                                      onMouseEnter={() => handlePreviewFont(f.value)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: isSelected
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : isHighlighted
                                          ? 'rgba(255, 255, 255, 0.08)'
                                          : 'transparent',
                                        color: isSelected ? '#10B981' : '#f4f4f5',
                                        transition: 'background 0.08s ease',
                                      }}
                                    >
                                      <span style={{ fontFamily: `"${f.value}", sans-serif`, fontSize: 13 }}>{f.label}</span>
                                      {isSelected && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Font Weight */}
                  <div className="studio-field-box">
                    <span className="studio-field-label">{t('slideEditor.sidebar.fontStyle')}</span>
                    <CustomDropdown
                      value={String(currentFontWeight)}
                      options={fontWeightOptions(t)}
                      onChange={(wt) => setText({ fontWeight: parseInt(wt, 10) })}
                      style={{ width: '100%' }}
                      zIndex={100004}
                    />
                  </div>

                  {/* Font Size with StudioSlider */}
                  <StudioSlider
                    label={t('slideEditor.sidebar.size')}
                    value={currentFontSize}
                    min={10}
                    max={200}
                    defaultValue={48}
                    step={1}
                    unit="px"
                    onChange={(size) => setText({ fontSize: size })}
                  />

                  {/* Line Height & Letter Spacing */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.lineHeight')}</span>
                      <ScrubbableInput
                        value={currentLineHeight}
                        onChange={(v) => setText({ lineHeight: v })}
                        min={0.1}
                        max={5.0}
                        step={0.05}
                        precision={2}
                        badge="⤌⤍"
                      />
                    </div>
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.letterSpacing')}</span>
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

                  {/* Text Color Picker with Selectable/Copyable Hex */}
                  <StudioColorPicker
                    label={t('slideEditor.sidebar.color')}
                    value={normalizeHex(currentColor) || '#ffffff'}
                    onChange={(c) => setText({ color: c })}
                  />

                  {/* Horizontal Alignment */}
                  <div className="studio-field-box">
                    <span className="studio-field-label">{t('slideEditor.sidebar.alignmentStyles')}</span>
                    <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                      <div className="studio-segmented-pill" style={{ flex: 1 }}>
                        {(['left', 'center', 'right', 'justify'] as const).map((align) => {
                          const on = currentTextAlign === align;
                          return (
                            <button
                              key={align}
                              type="button"
                              onClick={() => setText({ textAlign: align })}
                              className={`studio-segmented-tab ${on ? 'active' : ''}`}
                              title={t('slideEditor.sidebar.alignTitle', { align })}
                            >
                              <AlignIcon align={align} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Italic & Underline Toggles */}
                      <div className="studio-segmented-pill" style={{ width: 68 }}>
                        <button
                          type="button"
                          onClick={() => setText({ fontStyle: targetTextElement?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                          className={`studio-segmented-tab ${targetTextElement?.fontStyle === 'italic' ? 'active' : ''}`}
                          style={{ fontStyle: 'italic', fontFamily: 'serif', fontWeight: 700 }}
                          title={t('slideEditor.sidebar.italic')}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => setText({ textDecoration: targetTextElement?.textDecoration === 'underline' ? 'none' : 'underline' })}
                          className={`studio-segmented-tab ${targetTextElement?.textDecoration === 'underline' ? 'active' : ''}`}
                          style={{ textDecoration: 'underline', fontWeight: 700 }}
                          title={t('slideEditor.sidebar.underline')}
                        >
                          U
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Vertical Alignment */}
                  <div className="studio-field-box">
                    <span className="studio-field-label">Vertical Alignment</span>
                    <div className="studio-segmented-pill">
                      {(['top', 'middle', 'bottom'] as const).map((vAlign) => {
                        const on = (targetTextElement?.vAlign || 'middle') === vAlign;
                        return (
                          <button
                            key={vAlign}
                            type="button"
                            onClick={() => setText({ vAlign })}
                            className={`studio-segmented-tab ${on ? 'active' : ''}`}
                            title={t('slideEditor.sidebar.verticalAlign', { align: vAlign })}
                          >
                            <VAlignIcon vAlign={vAlign} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Decoration & Case */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {/* Decoration */}
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.decoration')}</span>
                      <div className="studio-segmented-pill">
                        {(['none', 'underline', 'line-through'] as const).map((deco) => {
                          const on = (targetTextElement?.textDecoration || 'none') === deco;
                          return (
                            <button
                              key={deco}
                              type="button"
                              onClick={() => setText({ textDecoration: deco })}
                              className={`studio-segmented-tab ${on ? 'active' : ''}`}
                              title={deco === 'none' ? t('slideEditor.sidebar.noDecoration') : deco === 'underline' ? t('slideEditor.sidebar.underline') : t('slideEditor.sidebar.strikethrough')}
                            >
                              {deco === 'none' ? '―' : deco === 'underline' ? 'U' : 'S'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Text Transform Case */}
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.case')}</span>
                      <div className="studio-segmented-pill">
                        {(['none', 'uppercase', 'capitalize', 'lowercase'] as const).map((tc) => {
                          const on = (targetTextElement?.textTransform || 'none') === tc;
                          return (
                            <button
                              key={tc}
                              type="button"
                              onClick={() => setText({ textTransform: tc })}
                              className={`studio-segmented-tab ${on ? 'active' : ''}`}
                              style={{ fontWeight: tc === 'uppercase' ? 700 : 500 }}
                              title={t('slideEditor.sidebar.caseTitle', { tc })}
                            >
                              {tc === 'none' ? '―' : tc === 'uppercase' ? 'AA' : tc === 'capitalize' ? 'Aa' : 'aa'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Shape, Fill & Border Section */}
            <div className="studio-section" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('shape')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.shape ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>
                    {targetShapeElement?.type === 'bezier'
                      ? t('slideEditor.sidebar.vectorPathFillStroke')
                      : t('slideEditor.sidebar.shapeFillBorder')}
                  </span>
                </div>
              </button>

              {openSections.shape && (
                <div className="studio-section-content" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
                  {/* Path Closed/Open Loop Toggle for Bezier curves */}
                  {!pptxShape && targetShapeElement?.type === 'bezier' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="studio-slider-name">Path State</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextClosed = !targetShapeElement.closed;
                          onUpdateElement(targetShapeElement.id, {
                            closed: nextClosed,
                            isLoopFilled: nextClosed,
                            backgroundColor: nextClosed ? (targetShapeElement.backgroundColor !== 'transparent' ? targetShapeElement.backgroundColor : '#10B981') : targetShapeElement.backgroundColor,
                            fillColor: nextClosed ? (targetShapeElement.fillColor !== 'transparent' ? targetShapeElement.fillColor : '#10B981') : targetShapeElement.fillColor,
                          });
                        }}
                        className="studio-reset-btn"
                        style={{
                          background: targetShapeElement.closed ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          border: `1px solid ${targetShapeElement.closed ? '#10B981' : 'rgba(255, 255, 255, 0.12)'}`,
                          color: targetShapeElement.closed ? '#10B981' : 'rgba(255, 255, 255, 0.5)',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {targetShapeElement.closed ? '● Closed Loop (Shape)' : '○ Open Curve'}
                      </button>
                    </div>
                  )}

                  {/* Fill Color */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="studio-field-label" style={{ marginBottom: 0 }}>{t('slideEditor.sidebar.fillColor')}</span>
                      {!pptxShape && targetShapeElement && (
                        <button
                          type="button"
                          onClick={() => {
                            const currentFill = targetShapeElement.backgroundColor || targetShapeElement.fillColor;
                            const isClear = !currentFill || currentFill === 'transparent' || currentFill === 'none';
                            if (isClear) {
                              const restored = lastFillColorMap.current[targetShapeElement.id] || '#FF5500';
                              onUpdateElement(targetShapeElement.id, {
                                backgroundColor: restored,
                                fillColor: restored,
                                isLoopFilled: true,
                              });
                            } else {
                              lastFillColorMap.current[targetShapeElement.id] = currentFill;
                              onUpdateElement(targetShapeElement.id, {
                                backgroundColor: 'transparent',
                                fillColor: 'transparent',
                                isLoopFilled: false,
                              });
                            }
                          }}
                          className="studio-reset-btn"
                          style={{ fontSize: 11 }}
                        >
                          {(!targetShapeElement.backgroundColor || targetShapeElement.backgroundColor === 'transparent') ? t('slideEditor.sidebar.noFillActive') : t('slideEditor.sidebar.clearFill')}
                        </button>
                      )}
                    </div>
                    <StudioColorPicker
                      label=""
                      value={
                        pptxShape
                          ? (normalizeHex(typeof pptxShape.fillColor === 'string' ? pptxShape.fillColor : undefined) || '#10B981')
                          : (normalizeHex(targetShapeElement?.backgroundColor || targetShapeElement?.fillColor) || '#10B981')
                      }
                      onChange={(c) => {
                        if (pptxShape) (pptx as PptxInspector | null)?.onFill(c);
                        else if (targetShapeElement) {
                          if (c && c !== 'transparent' && c !== 'none') {
                            lastFillColorMap.current[targetShapeElement.id] = c;
                          }
                          onUpdateElement(targetShapeElement.id, {
                            backgroundColor: c,
                            fillColor: c,
                            isLoopFilled: c !== 'transparent' && c !== 'none',
                          });
                        }
                      }}
                    />
                  </div>

                  {/* Fill Opacity Slider */}
                  {targetShapeElement && (
                    <StudioSlider
                      label={t('slideEditor.sidebar.fillOpacity')}
                      value={Math.round((targetShapeElement.fillOpacity ?? 1) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(val) => onUpdateElement(targetShapeElement.id, { fillOpacity: val / 100 })}
                    />
                  )}

                  {/* Border / Stroke Color */}
                  <StudioColorPicker
                    label={
                      targetShapeElement?.type === 'bezier'
                        ? t('slideEditor.sidebar.strokeColor')
                        : t('slideEditor.sidebar.borderColor')
                    }
                    value={
                      pptxShape
                        ? (normalizeHex(typeof pptxShape.strokeColor === 'string' ? pptxShape.strokeColor : undefined) || '#10B981')
                        : (normalizeHex(targetShapeElement?.borderColor || targetShapeElement?.strokeColor) || '#10B981')
                    }
                    onChange={(c) => {
                      if (pptxShape) (pptx as PptxInspector | null)?.onStroke(c, (pptxShape?.strokeWidthPx as number) || 2);
                      else if (targetShapeElement) {
                        if (c && c !== 'transparent' && c !== 'none') {
                          lastBorderColorMap.current[targetShapeElement.id] = c;
                        }
                        onUpdateElement(targetShapeElement.id, {
                          borderColor: c,
                          strokeColor: c,
                        });
                      }
                    }}
                  />

                  {/* Stroke Opacity Slider */}
                  {targetShapeElement && (
                    <StudioSlider
                      label={t('slideEditor.sidebar.strokeOpacity')}
                      value={Math.round((targetShapeElement.strokeOpacity ?? 1) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(val) => onUpdateElement(targetShapeElement.id, { strokeOpacity: val / 100 })}
                    />
                  )}

                  {/* Border / Stroke Width Slider */}
                  <StudioSlider
                    label={
                      targetShapeElement?.type === 'bezier'
                        ? t('slideEditor.sidebar.strokeWidth')
                        : t('slideEditor.sidebar.borderWidth')
                    }
                    value={pptxShape ? ((pptxShape.strokeWidthPx as number) || 0) : (targetShapeElement ? (targetShapeElement.borderWidth ?? targetShapeElement.strokeWidth ?? (targetShapeElement.type === 'shape' ? 3 : 4)) : 0)}
                    min={0}
                    max={30}
                    step={1}
                    unit="px"
                    onChange={(bw) => {
                      if (pptxShape) (pptx as PptxInspector | null)?.onStroke((typeof pptxShape?.strokeColor === 'string' ? pptxShape.strokeColor : '#10B981'), bw);
                      else if (targetShapeElement) {
                        if (bw > 0) lastBorderWidthMap.current[targetShapeElement.id] = bw;
                        onUpdateElement(targetShapeElement.id, { borderWidth: bw, strokeWidth: bw });
                      }
                    }}
                  />

                  {/* Corner Radius Slider */}
                  <StudioSlider
                    label={t('slideEditor.sidebar.cornerRadius')}
                    value={targetShapeElement?.borderRadius ?? 0}
                    min={0}
                    max={50}
                    step={1}
                    unit="px"
                    onChange={(radius) => {
                      if (targetShapeElement) onUpdateElement(targetShapeElement.id, { borderRadius: radius });
                    }}
                  />

                  {/* Layer Opacity Slider */}
                  <StudioSlider
                    label={t('slideEditor.sidebar.layerOpacity')}
                    value={Math.round((targetShapeElement?.opacity ?? 1) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(val) => {
                      if (targetShapeElement) onUpdateElement(targetShapeElement.id, { opacity: val / 100 });
                    }}
                  />
                </div>
              )}
            </div>

            {/* Effects & Shadows Section */}
            <div className="studio-section" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('effects')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.effects ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>{t('slideEditor.sidebar.effectsShadows')}</span>
                </div>
              </button>

              {openSections.effects && (
                <div className="studio-section-content" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
                  {/* Text Drop Shadow */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="studio-toggle-row">
                      <span className="studio-toggle-label">{t('slideEditor.sidebar.textDropShadow')}</span>
                      <StudioToggle
                        checked={Boolean(targetEffectElement?.shadowEnabled)}
                        onChange={(checked) => targetEffectElement && onUpdateElement(targetEffectElement.id, { shadowEnabled: checked })}
                      />
                    </div>

                    {targetEffectElement?.shadowEnabled && (
                      <>
                        <StudioColorPicker
                          label="Shadow Color"
                          value={normalizeHex(targetEffectElement.shadowColor) || '#000000'}
                          onChange={(c) => onUpdateElement(targetEffectElement.id, { shadowColor: c })}
                        />

                        <StudioSlider
                          label={t('slideEditor.sidebar.blurRadius')}
                          value={targetEffectElement.shadowBlur ?? 8}
                          min={0}
                          max={40}
                          step={1}
                          unit="px"
                          onChange={(v) => onUpdateElement(targetEffectElement.id, { shadowBlur: v })}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div className="studio-field-box">
                            <span className="studio-field-label">{t('slideEditor.sidebar.offsetX')}</span>
                            <ScrubbableInput
                              value={targetEffectElement.shadowOffsetX ?? 0}
                              onChange={(v) => onUpdateElement(targetEffectElement.id, { shadowOffsetX: v })}
                              min={-30}
                              max={30}
                              step={1}
                            />
                          </div>
                          <div className="studio-field-box">
                            <span className="studio-field-label">{t('slideEditor.sidebar.offsetY')}</span>
                            <ScrubbableInput
                              value={targetEffectElement.shadowOffsetY ?? 4}
                              onChange={(v) => onUpdateElement(targetEffectElement.id, { shadowOffsetY: v })}
                              min={-30}
                              max={30}
                              step={1}
                            />
                          </div>
                        </div>

                        <StudioSlider
                          label={t('slideEditor.sidebar.shadowOpacity')}
                          value={Math.round((targetEffectElement.shadowOpacity ?? 0.5) * 100)}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          onChange={(val) => onUpdateElement(targetEffectElement.id, { shadowOpacity: val / 100 })}
                        />
                      </>
                    )}
                  </div>

                  {/* Container Box Shadow */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="studio-toggle-row">
                      <span className="studio-toggle-label">{t('slideEditor.sidebar.containerBoxShadow')}</span>
                      <StudioToggle
                        checked={Boolean(targetEffectElement?.boxShadowEnabled)}
                        onChange={(checked) => targetEffectElement && onUpdateElement(targetEffectElement.id, { boxShadowEnabled: checked })}
                      />
                    </div>

                    {targetEffectElement?.boxShadowEnabled && (
                      <>
                        <StudioColorPicker
                          label={t('slideEditor.sidebar.boxShadowColor')}
                          value={normalizeHex(targetEffectElement.boxShadowColor) || '#000000'}
                          onChange={(c) => onUpdateElement(targetEffectElement.id, { boxShadowColor: c })}
                        />

                        <StudioSlider
                          label={t('slideEditor.sidebar.blurRadius')}
                          value={targetEffectElement.boxShadowBlur ?? 12}
                          min={0}
                          max={50}
                          step={1}
                          unit="px"
                          onChange={(v) => onUpdateElement(targetEffectElement.id, { boxShadowBlur: v })}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div className="studio-field-box">
                            <span className="studio-field-label">{t('slideEditor.sidebar.offsetX')}</span>
                            <ScrubbableInput
                              value={targetEffectElement.boxShadowOffsetX ?? 0}
                              onChange={(v) => onUpdateElement(targetEffectElement.id, { boxShadowOffsetX: v })}
                              min={-30}
                              max={30}
                              step={1}
                            />
                          </div>
                          <div className="studio-field-box">
                            <span className="studio-field-label">{t('slideEditor.sidebar.offsetY')}</span>
                            <ScrubbableInput
                              value={targetEffectElement.boxShadowOffsetY ?? 6}
                              onChange={(v) => onUpdateElement(targetEffectElement.id, { boxShadowOffsetY: v })}
                              min={-30}
                              max={30}
                              step={1}
                            />
                          </div>
                        </div>

                        <StudioSlider
                          label={t('slideEditor.sidebar.boxShadowOpacity')}
                          value={Math.round((targetEffectElement.boxShadowOpacity ?? 0.4) * 100)}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          onChange={(val) => onUpdateElement(targetEffectElement.id, { boxShadowOpacity: val / 100 })}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Geometry & Transform Section */}
            <div className="studio-section" style={{ borderBottom: 'none', paddingBottom: 14 }}>
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('geometry')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.geometry ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>{t('slideEditor.sidebar.geometryTransform')}</span>
                </div>
              </button>

              {openSections.geometry && (
                <div className="studio-section-content" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.xPosition')}</span>
                      <ScrubbableInput
                        value={targetGeomElement?.x || 0}
                        onChange={(v) => targetGeomElement && onUpdateElement(targetGeomElement.id, { x: v })}
                        min={-100}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.yPosition')}</span>
                      <ScrubbableInput
                        value={targetGeomElement?.y || 0}
                        onChange={(v) => targetGeomElement && onUpdateElement(targetGeomElement.id, { y: v })}
                        min={-100}
                        max={200}
                        step={1}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.width')}</span>
                      <ScrubbableInput
                        value={targetGeomElement?.width || 0}
                        onChange={(v) => targetGeomElement && onUpdateElement(targetGeomElement.id, { width: v })}
                        min={1}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div className="studio-field-box">
                      <span className="studio-field-label">{t('slideEditor.sidebar.height')}</span>
                      <ScrubbableInput
                        value={targetGeomElement?.height || 0}
                        onChange={(v) => targetGeomElement && onUpdateElement(targetGeomElement.id, { height: v })}
                        min={1}
                        max={200}
                        step={1}
                      />
                    </div>
                  </div>

                  {/* Rotation Control */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="studio-field-label" style={{ marginBottom: 0 }}>
                        {t('slideEditor.sidebar.rotationAngle', { deg: targetGeomElement?.rotation || 0 })}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => targetGeomElement && onUpdateElement(targetGeomElement.id, { rotation: ((targetGeomElement.rotation || 0) - 90) % 360 })}
                          className="studio-reset-btn"
                          style={{ fontSize: 10 }}
                          title={t('slideEditor.sidebar.rotateLeft')}
                        >
                          ↺ -90°
                        </button>
                        <button
                          type="button"
                          onClick={() => targetGeomElement && onUpdateElement(targetGeomElement.id, { rotation: ((targetGeomElement.rotation || 0) + 90) % 360 })}
                          className="studio-reset-btn"
                          style={{ fontSize: 10 }}
                          title={t('slideEditor.sidebar.rotateRight')}
                        >
                          ↻ +90°
                        </button>
                      </div>
                    </div>
                    <StudioSlider
                      label=""
                      value={targetGeomElement?.rotation || 0}
                      min={-180}
                      max={180}
                      step={1}
                      unit="°"
                      onChange={(rot) => targetGeomElement && onUpdateElement(targetGeomElement.id, { rotation: rot })}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ---- LAYER TAB -------------------------------------------------- */}
        {activeTab === 'layer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
              {t('slideEditor.sidebar.layersTopFirst')}
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
                emptyHint={t('slideEditor.sidebar.emptyLayersPptx')}
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
                onToggleVisible={(id) => {
                  const target = nativeElements.find((e) => e.id === id);
                  if (target) onUpdateElement(id, { hidden: !target.hidden });
                }}
                emptyHint={t('slideEditor.sidebar.emptyLayersNative')}
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
              <IconSparkles size={22} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {t('slideEditor.sidebar.tabAi')}
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
              {t('slideEditor.sidebar.aiComingSoon')}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, margin: 0, maxWidth: 220 }}>
              {t('slideEditor.sidebar.aiDescription')}
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
