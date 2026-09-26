import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { MediaGrid } from './MediaGrid';
import { CircularAngleDial, PRO_GRADIENT_PRESETS } from './BackgroundPicker';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { assetUrl } from '../utils/asset-url';
import { gradientCss, parseBackgroundInfo } from '../utils/background';
import { fetchInstalledSystemFonts, type FontOptionItem } from '../utils/system-fonts';
import './ThemeStudio.css';

export type ThemeSurface = 'full' | 'lt';

interface StudioSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  defaultValue?: number;
  hardMax?: number;
  onChange: (val: number) => void;
}

export function StudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  displayValue,
  defaultValue,
  hardMax = 5000,
  onChange,
}: StudioSliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const safeVal = Number.isFinite(value) ? value : min;
  const [draft, setDraft] = useState(String(safeVal));

  const isDraggingValRef = useRef(false);
  const startXRef = useRef(0);
  const startValRef = useRef(0);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(safeVal));
    }
  }, [safeVal, isEditing]);

  const effectiveMax = Math.max(max, safeVal);
  const percentage = Math.max(0, Math.min(100, ((safeVal - min) / (effectiveMax - min || 1)) * 100));
  const sliderBg = `linear-gradient(to right, #10B981 0%, #10B981 ${percentage}%, var(--studio-track-bg, #272B33) ${percentage}%, var(--studio-track-bg, #272B33) 100%)`;

  const commitDraft = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(hardMax, parsed));
      onChange(clamped);
    }
    setIsEditing(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    } else {
      onChange(min <= 0 && max >= 0 ? 0 : min);
    }
  };

  const handleValuePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    isDraggingValRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    startValRef.current = safeVal;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleValuePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!isDraggingValRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 2) {
      hasMovedRef.current = true;
    }
    const multiplier = e.shiftKey ? 10 : 1;
    const delta = Math.round((dx / 2) * step * multiplier);
    let nextVal = startValRef.current + delta;
    nextVal = Math.max(min, Math.min(hardMax, nextVal));
    onChange(nextVal);
  };

  const handleValuePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!isDraggingValRef.current) return;
    isDraggingValRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!hasMovedRef.current) {
      setDraft(String(safeVal));
      setIsEditing(true);
    }
  };

  return (
    <div className="studio-slider-row">
      <div className="studio-slider-labels">
        <span className="studio-slider-name">{label}</span>
        {isEditing ? (
          <input
            type="number"
            autoFocus
            min={min}
            max={hardMax}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            style={{
              width: 58,
              padding: '1px 4px',
              fontSize: 11,
              fontWeight: 700,
              textAlign: 'right',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid #10B981',
              borderRadius: 4,
              color: '#fff',
              outline: 'none',
            }}
          />
        ) : (
          <span
            className="studio-slider-value"
            onPointerDown={handleValuePointerDown}
            onPointerMove={handleValuePointerMove}
            onPointerUp={handleValuePointerUp}
            onPointerCancel={handleValuePointerUp}
            title="Drag left/right to adjust, click to type exact value"
            style={{ cursor: 'ew-resize', userSelect: 'none' }}
          >
            {displayValue ?? `${safeVal}${unit}`}
          </span>
        )}
      </div>
      <div className="studio-slider-track-wrap">
        <input
          type="range"
          min={min}
          max={effectiveMax}
          step={step}
          value={Math.min(safeVal, effectiveMax)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onDoubleClick={handleReset}
          title={defaultValue !== undefined ? `Double-click to reset to default (${defaultValue}${unit})` : 'Double-click to reset'}
          className="studio-range-slider"
          style={{ background: sliderBg, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

interface StudioToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function StudioToggle({ checked, onChange, label }: StudioToggleProps) {
  return (
    <div className="studio-toggle-row">
      {label && <span className="studio-slider-name">{label}</span>}
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={`studio-toggle-switch ${checked ? 'active' : ''}`}
      >
        <div className="studio-toggle-thumb" />
      </div>
    </div>
  );
}

interface StudioColorPickerProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}

export function StudioColorPicker({ label, value, disabled = false, onChange }: StudioColorPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const safeVal = value && value.startsWith('#') ? value : '#ffffff';
  const [draft, setDraft] = useState(safeVal.toUpperCase());

  useEffect(() => {
    setDraft(safeVal.toUpperCase());
  }, [safeVal]);

  const commitHex = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean) || /^#[0-9A-Fa-f]{3}$/.test(clean)) {
      onChange(clean.toLowerCase());
    }
  };

  return (
    <div className="studio-field-box">
      <span className="studio-field-label">{label}</span>
      <div
        className="studio-color-picker-btn"
        style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'default' }}
      >
        <div
          className="studio-color-swatch"
          style={{ background: safeVal, cursor: disabled ? 'not-allowed' : 'pointer' }}
          onClick={() => !disabled && inputRef.current?.click()}
          title="Click to open color picker"
        />
        <input
          type="text"
          className="studio-color-hex-input"
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            commitHex(e.target.value);
          }}
          onBlur={() => {
            commitHex(draft);
            setDraft(safeVal.toUpperCase());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitHex(draft);
            }
          }}
          spellCheck={false}
        />
        <input
          ref={inputRef}
          type="color"
          value={safeVal}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setDraft(e.target.value.toUpperCase());
          }}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
}

interface StudioGradientRampProps {
  startColor: string;
  endColor: string;
  direction?: string;
  isRadial?: boolean;
  startPos?: number;
  endPos?: number;
  onColorChange: (updates: { start?: string; end?: string; startPos?: number; endPos?: number }) => void;
  onSwapColors: () => void;
}

export function StudioGradientRamp({
  startColor,
  endColor,
  direction = '135deg',
  isRadial = false,
  startPos: propStartPos = 0,
  endPos: propEndPos = 100,
  onColorChange,
  onSwapColors,
}: StudioGradientRampProps) {
  const [activeStop, setActiveStop] = useState<'start' | 'end'>('start');
  const [startPos, setStartPos] = useState<number>(propStartPos);
  const [endPos, setEndPos] = useState<number>(propEndPos);

  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [startDraft, setStartDraft] = useState(startColor.toUpperCase());
  const [endDraft, setEndDraft] = useState(endColor.toUpperCase());

  useEffect(() => {
    setStartPos(propStartPos);
  }, [propStartPos]);

  useEffect(() => {
    setEndPos(propEndPos);
  }, [propEndPos]);

  useEffect(() => {
    setStartDraft(startColor.toUpperCase());
  }, [startColor]);

  useEffect(() => {
    setEndDraft(endColor.toUpperCase());
  }, [endColor]);

  const commitStartHex = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean) || /^#[0-9A-Fa-f]{3}$/.test(clean)) {
      onColorChange({ start: clean.toLowerCase() });
    }
  };

  const commitEndHex = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean) || /^#[0-9A-Fa-f]{3}$/.test(clean)) {
      onColorChange({ end: clean.toLowerCase() });
    }
  };

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
    if (stopToMove === 'start') {
      setStartPos(clickPos);
      onColorChange({ startPos: clickPos });
    } else {
      setEndPos(clickPos);
      onColorChange({ endPos: clickPos });
    }

    const activeStopRef = stopToMove;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const pos = calculatePos(moveEvt.clientX);
      if (activeStopRef === 'start') {
        setStartPos(pos);
        onColorChange({ startPos: pos });
      } else {
        setEndPos(pos);
        onColorChange({ endPos: pos });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="studio-field-box" style={{ gap: 10 }}>
      {/* Header Row: Label & Flip Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span className="studio-field-label" style={{ marginBottom: 0 }}>Gradient Ramp</span>
        <button
          type="button"
          onClick={onSwapColors}
          title="Flip Highlight & Shadow Colors"
          className="studio-reset-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 6px',
            fontSize: 11,
            color: 'var(--text-secondary, #94a3b8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 5h18" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 19H3" />
          </svg>
          <span>Flip</span>
        </button>
      </div>

      {/* Visual Gradient Ramp Track with Movable / Clickable Stop Pins */}
      <div
        ref={trackRef}
        onPointerDown={(e) => handlePointerDownTrack(e)}
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: 4,
          paddingBottom: 18,
          cursor: 'ew-resize',
          touchAction: 'none',
        }}
      >
        {/* Gradient Bar */}
        <div
          style={{
            height: 22,
            width: '100%',
            borderRadius: 5,
            background: isRadial
              ? `radial-gradient(circle, ${startColor} ${startPos}%, ${endColor} ${endPos}%)`
              : `linear-gradient(to right, ${startColor} ${startPos}%, ${endColor} ${endPos}%)`,
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), 0 2px 8px rgba(0, 0, 0, 0.4)',
          }}
        />

        {/* Start / Highlight Stop Handle Pin */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDownTrack(e, 'start');
          }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveStop('start');
            startInputRef.current?.click();
          }}
          style={{
            position: 'absolute',
            left: `calc(${startPos}% - 8px)`,
            bottom: 0,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: activeStop === 'start' ? 10 : 2,
          }}
          title={`Highlight Color: ${startColor} (Click handle to choose color)`}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `6px solid ${activeStop === 'start' ? '#10B981' : '#ffffff'}`,
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: startColor,
              border: activeStop === 'start' ? '2px solid #10B981' : '1px solid #ffffff',
              boxShadow: activeStop === 'start' ? '0 0 8px rgba(16, 185, 129, 0.8)' : '0 1px 4px rgba(0,0,0,0.6)',
            }}
          />
        </div>

        {/* End / Shadow Stop Handle Pin */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDownTrack(e, 'end');
          }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveStop('end');
            endInputRef.current?.click();
          }}
          style={{
            position: 'absolute',
            left: `calc(${endPos}% - 8px)`,
            bottom: 0,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: activeStop === 'end' ? 10 : 2,
          }}
          title={`Shadow Color: ${endColor} (Click handle to choose color)`}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `6px solid ${activeStop === 'end' ? '#10B981' : '#ffffff'}`,
            }}
          />
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: endColor,
              border: activeStop === 'end' ? '2px solid #10B981' : '1px solid #ffffff',
              boxShadow: activeStop === 'end' ? '0 0 8px rgba(16, 185, 129, 0.8)' : '0 1px 4px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      </div>

      {/* Hidden Native Color Pickers */}
      <input
        ref={startInputRef}
        type="color"
        value={startColor.startsWith('#') ? startColor : '#0f172a'}
        onChange={(e) => onColorChange({ start: e.target.value })}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
      />
      <input
        ref={endInputRef}
        type="color"
        value={endColor.startsWith('#') ? endColor : '#312e81'}
        onChange={(e) => onColorChange({ end: e.target.value })}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
      />

      {/* Stop Hex Color Inputs (Highlight vs Shadow) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, width: '100%', boxSizing: 'border-box' }}>
        {/* Highlight Stop Chip */}
        <div
          className={`studio-color-picker-btn ${activeStop === 'start' ? 'active' : ''}`}
          style={{
            height: 30,
            padding: '2px 6px',
            gap: 6,
            minWidth: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            borderColor: activeStop === 'start' ? '#10B981' : undefined,
          }}
          onClick={() => setActiveStop('start')}
        >
          <div
            className="studio-color-swatch"
            style={{ width: 16, height: 16, borderRadius: 3, background: startColor, cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveStop('start');
              startInputRef.current?.click();
            }}
            title="Click to choose Highlight color"
          />
          <input
            type="text"
            className="studio-color-hex-input"
            value={startDraft}
            onChange={(e) => {
              setStartDraft(e.target.value);
              commitStartHex(e.target.value);
            }}
            onBlur={() => {
              commitStartHex(startDraft);
              setStartDraft(startColor.toUpperCase());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitStartHex(startDraft);
            }}
            spellCheck={false}
            title="Highlight hex code"
          />
        </div>

        {/* Shadow Stop Chip */}
        <div
          className={`studio-color-picker-btn ${activeStop === 'end' ? 'active' : ''}`}
          style={{
            height: 30,
            padding: '2px 6px',
            gap: 6,
            minWidth: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            borderColor: activeStop === 'end' ? '#10B981' : undefined,
          }}
          onClick={() => setActiveStop('end')}
        >
          <div
            className="studio-color-swatch"
            style={{ width: 16, height: 16, borderRadius: 3, background: endColor, cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveStop('end');
              endInputRef.current?.click();
            }}
            title="Click to choose Shadow color"
          />
          <input
            type="text"
            className="studio-color-hex-input"
            value={endDraft}
            onChange={(e) => {
              setEndDraft(e.target.value);
              commitEndHex(e.target.value);
            }}
            onBlur={() => {
              commitEndHex(endDraft);
              setEndDraft(endColor.toUpperCase());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEndHex(endDraft);
            }}
            spellCheck={false}
            title="Shadow hex code"
          />
        </div>
      </div>
    </div>
  );
}

function StudioSection({
  title,
  open,
  onToggle,
  onReset,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="studio-section">
      <div className="studio-section-header">
        <button
          type="button"
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            color: 'inherit',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span className={`studio-section-chevron ${open ? 'open' : 'closed'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
          <span className="studio-section-title-wrap">{title}</span>
        </button>
        <div className="studio-section-actions">
          {onReset && (
            <button type="button" onClick={onReset} className="studio-reset-btn">
              Reset
            </button>
          )}
        </div>
      </div>
      {open && <div className="studio-section-content">{children}</div>}
    </div>
  );
}

/**
 * Redesigned Right Sidebar Theme Inspector.
 * Clean modern dark styling with high-precision emerald progress sliders,
 * segmented controls, and collapsible sections.
 */
export function ThemeEditorForm({
  values,
  onChange,
  surface,
}: {
  values: any;
  onChange: (updates: any) => void;
  surface: ThemeSurface;
}) {
  const assetBaseUrl = useAssetBaseUrl();
  const previewMedia = values.backgroundMediaUrl
    ? assetUrl(values.backgroundMediaUrl, assetBaseUrl)
    : '';

  // Collapsible section state with default Typography open and others closed, persisted in localStorage
  const [open, setOpen] = useState<{ text: boolean; shadow: boolean; background: boolean; placement: boolean }>(() => {
    try {
      const saved = localStorage.getItem('bsp_theme_studio_sections_open');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          text: parsed.text ?? true,
          shadow: parsed.shadow ?? false,
          background: parsed.background ?? false,
          placement: parsed.placement ?? false,
        };
      }
    } catch {}
    return {
      text: true,
      shadow: false,
      background: false,
      placement: false,
    };
  });

  const toggle = (key: keyof typeof open) => {
    setOpen((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        localStorage.setItem('bsp_theme_studio_sections_open', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // System & Installed Fonts loading + Recently used fonts (up to 3)
  const [fontOptions, setFontOptions] = useState<FontOptionItem[]>([]);
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
    let mounted = true;
    fetchInstalledSystemFonts().then((fonts) => {
      if (mounted) {
        setFontOptions(fonts);
      }
    });
    return () => {
      mounted = false;
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

  const defaultBundledFonts: FontOptionItem[] = useMemo(() => [
    { value: '-apple-system, SF Pro Display, sans-serif', label: 'SF Pro Display' },
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Poppins, sans-serif', label: 'Poppins' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: "'Playfair Display', serif", label: 'Playfair Display' },
    { value: "'Montserrat', sans-serif", label: 'Montserrat' },
    { value: "'Cinzel', serif", label: 'Cinzel' },
    { value: "'Roboto', sans-serif", label: 'Roboto' },
    { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
    { value: "'Crimson Pro', serif", label: 'Crimson Pro' },
    { value: "'Lora', serif", label: 'Lora' },
    { value: "'Oswald', sans-serif", label: 'Oswald' },
  ], []);

  const bundledFonts = useMemo(() => {
    return fontOptions.length > 0
      ? fontOptions.filter((f) => !f.isSystemFont)
      : defaultBundledFonts;
  }, [fontOptions, defaultBundledFonts]);

  const installedSystemFonts = useMemo(() => {
    return fontOptions.filter((f) => f.isSystemFont);
  }, [fontOptions]);

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

  // Flattened list for keyboard navigation and preview tracking
  const flatVisibleFonts = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    filteredRecent.forEach((rf) => {
      if (!seen.has(rf)) {
        seen.add(rf);
        const match = fontOptions.find((f) => f.value === rf) || defaultBundledFonts.find((f) => f.value === rf);
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
  }, [filteredRecent, filteredBundled, filteredInstalled, fontOptions, defaultBundledFonts]);

  const handlePreviewFont = (fontValue: string) => {
    setHighlightedFont(fontValue);
    onChange({ fontFamily: fontValue });
  };

  const handleFontSelect = (fontName: string) => {
    onChange({ fontFamily: fontName });
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
      onChange({ fontFamily: initialFontRef.current });
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
      const currentVal = highlightedFont || values.fontFamily || '-apple-system, SF Pro Display, sans-serif';
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
      const currentVal = highlightedFont || values.fontFamily || '-apple-system, SF Pro Display, sans-serif';
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
      if (highlightedFont) {
        handleCommitFont(highlightedFont);
      } else if (flatVisibleFonts.length > 0) {
        handleCommitFont(flatVisibleFonts[0].value);
      }
      return;
    }
  };

  const safeInt = (val: string | number, fallback = 0) => {
    if (val === '' || val === undefined || val === null) return 0;
    const parsed = typeof val === 'number' ? val : parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
  };

  const bgInfo = parseBackgroundInfo(values.background, values.backgroundColor);
  const currentBgType =
    values.backgroundMediaType === 'image' || values.backgroundMediaType === 'video'
      ? values.backgroundMediaType
      : (values.backgroundType || bgInfo.type);

  const lastGradStart = values.gradientStart || (bgInfo.type === 'gradient' ? bgInfo.start : undefined) || values.savedGradientStart || '#0f172a';
  const lastGradEnd = values.gradientEnd || (bgInfo.type === 'gradient' ? bgInfo.end : undefined) || values.savedGradientEnd || '#312e81';
  const lastGradDir = values.gradientDirection || (bgInfo.type === 'gradient' ? bgInfo.dir : undefined) || values.savedGradientDir || '135deg';

  const currentStart = lastGradStart;
  const currentEnd = lastGradEnd;
  const currentDir = lastGradDir;
  const currentSolid = values.backgroundColor && values.backgroundColor !== 'transparent'
    ? values.backgroundColor
    : values.savedSolidColor || (bgInfo.type === 'solid' ? bgInfo.color : undefined) || '#0c0e14';
  const currentOpacity = typeof values.backgroundOpacity === 'number' ? values.backgroundOpacity : 0.95;

  const CLEAR_MEDIA = { backgroundMediaUrl: '', backgroundMediaType: undefined };

  const handleBgTypeChange = (newType: string) => {
    if (newType === 'image' || newType === 'video') {
      onChange({
        backgroundType: newType,
        backgroundMediaType: newType,
        backgroundMediaUrl: values.backgroundMediaUrl || '',
        savedGradientStart: currentStart,
        savedGradientEnd: currentEnd,
        savedGradientDir: currentDir,
        savedSolidColor: currentSolid,
      });
    } else if (newType === 'transparent') {
      onChange({
        ...CLEAR_MEDIA,
        backgroundType: 'transparent',
        background: 'transparent',
        backgroundColor: 'transparent',
        savedGradientStart: currentStart,
        savedGradientEnd: currentEnd,
        savedGradientDir: currentDir,
        savedSolidColor: currentSolid,
      });
    } else if (newType === 'solid') {
      const solidColor = currentSolid && currentSolid !== 'transparent' ? currentSolid : currentStart;
      onChange({
        ...CLEAR_MEDIA,
        backgroundType: 'solid',
        background: solidColor,
        backgroundColor: solidColor,
        gradientStart: currentStart,
        gradientEnd: currentEnd,
        gradientDirection: currentDir,
        savedGradientStart: currentStart,
        savedGradientEnd: currentEnd,
        savedGradientDir: currentDir,
        savedSolidColor: solidColor,
      });
    } else if (newType === 'gradient') {
      const start = currentStart;
      const end = currentEnd;
      const dir = currentDir;
      const gradCss = gradientCss(start, end, dir);
      onChange({
        ...CLEAR_MEDIA,
        backgroundType: 'gradient',
        background: gradCss,
        backgroundColor: start,
        gradientStart: start,
        gradientEnd: end,
        gradientDirection: dir,
        savedGradientStart: start,
        savedGradientEnd: end,
        savedGradientDir: dir,
        savedSolidColor: currentSolid,
      });
    }
  };

  const currentStartPos = bgInfo.startPos ?? 0;
  const currentEndPos = bgInfo.endPos ?? 100;

  const isRadial = currentDir === 'radial';
  const numericAngle = parseInt(currentDir.replace('deg', ''), 10) || 135;

  const handleGradientChange = (updates: {
    start?: string;
    end?: string;
    dir?: string;
    startPos?: number;
    endPos?: number;
  }) => {
    const s = updates.start ?? currentStart;
    const e = updates.end ?? currentEnd;
    const d = updates.dir ?? currentDir;
    const sp = updates.startPos ?? currentStartPos;
    const ep = updates.endPos ?? currentEndPos;
    const gradCss = gradientCss(s, e, d, sp, ep);
    onChange({
      backgroundType: 'gradient',
      background: gradCss,
      backgroundColor: s,
      gradientStart: s,
      gradientEnd: e,
      gradientDirection: d,
      savedGradientStart: s,
      savedGradientEnd: e,
      savedGradientDir: d,
    });
  };

  const handleSwapGradient = () => {
    handleGradientChange({ start: currentEnd, end: currentStart });
  };

  const handleAngleChange = (deg: number) => {
    handleGradientChange({ dir: `${deg}deg` });
  };

  const handleToggleRadial = () => {
    if (isRadial) {
      handleGradientChange({ dir: '135deg' });
    } else {
      handleGradientChange({ dir: 'radial' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* ── SECTION 1: TYPOGRAPHY & TEXT ── */}
      <StudioSection
        title="Typography & Text"
        open={open.text}
        onToggle={() => toggle('text')}
        onReset={() => {
          onChange({
            fontFamily: '-apple-system, SF Pro Display, sans-serif',
            fontSize: surface === 'full' ? 65 : 36,
            referenceFontSize: surface === 'full' ? 40 : 24,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.35,
          });
        }}
      >
        {/* Font Family Custom Selector with Live Hover/Navigation Canvas Preview */}
        <div className="studio-field-box" style={{ position: 'relative' }} ref={fontMenuRef}>
          <span className="studio-field-label">Font Family</span>
          {(() => {
            const currentVal = values.fontFamily || '-apple-system, SF Pro Display, sans-serif';
            const matchedOpt = fontOptions.find((f) => f.value === currentVal) || defaultBundledFonts.find((f) => f.value === currentVal);
            const currentLabel = matchedOpt ? matchedOpt.label : (currentVal.split(',')[0].replace(/['"]/g, '').trim() || 'SF Pro Display');

            let globalIdxCounter = 0;

            return (
              <>
                <button
                  type="button"
                  className="studio-select"
                  onClick={() => {
                    if (!isFontMenuOpen) {
                      initialFontRef.current = values.fontFamily || '-apple-system, SF Pro Display, sans-serif';
                      setHighlightedFont(initialFontRef.current);
                      setIsFontMenuOpen(true);
                      setFontSearchQuery('');
                    } else {
                      setIsFontMenuOpen(false);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    paddingRight: 8,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: currentVal }}>
                    {currentLabel}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isFontMenuOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                      opacity: 0.6,
                      flexShrink: 0,
                      marginLeft: 6,
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown Popover */}
                {isFontMenuOpen && (
                  <div
                    tabIndex={0}
                    onKeyDown={handleFontKeyDown}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: 'var(--bg-elevated, #1c1b1d)',
                      border: '1px solid var(--border-primary, #333235)',
                      borderRadius: 8,
                      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 2px 8px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 340,
                      outline: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {/* Search Input Bar */}
                    <div
                      style={{
                        padding: '6px 8px',
                        borderBottom: '1px solid var(--border-primary, #2A282A)',
                        background: 'var(--bsp-raised, #161516)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-primary, #2A282A)',
                          borderRadius: 4,
                          padding: '2px 6px',
                          height: 26,
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--text-dim, #717075)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ marginRight: 6, flexShrink: 0 }}
                        >
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={fontSearchQuery}
                          onChange={(e) => setFontSearchQuery(e.target.value)}
                          placeholder="Search fonts..."
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#fff',
                            fontSize: 11,
                            fontFamily: 'inherit',
                            padding: 0,
                            minWidth: 0,
                          }}
                        />
                        {fontSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setFontSearchQuery('')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-dim, #717075)',
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable Font List */}
                    <div
                      ref={fontListRef}
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      {flatVisibleFonts.length === 0 ? (
                        <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-dim, #717075)' }}>
                          No fonts found matching "{fontSearchQuery}"
                        </div>
                      ) : (
                        <>
                          {/* 1. Recently Used Fonts */}
                          {filteredRecent.length > 0 && (
                            <div>
                              <div
                                style={{
                                  padding: '6px 8px 3px 8px',
                                  fontSize: 10,
                                  color: 'var(--text-dim, #717075)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  fontWeight: 600,
                                }}
                              >
                                Recently Used
                              </div>
                              {filteredRecent.map((rf) => {
                                const idx = globalIdxCounter++;
                                const matched = fontOptions.find((f) => f.value === rf) || defaultBundledFonts.find((f) => f.value === rf);
                                const lbl = matched ? matched.label : rf.split(',')[0].replace(/['"]/g, '').trim();
                                const isSelected = (values.fontFamily || '-apple-system, SF Pro Display, sans-serif') === rf;
                                const isHighlighted = (highlightedFont || values.fontFamily) === rf;

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
                                        ? 'var(--accent-dim, rgba(235, 94, 40, 0.2))'
                                        : isHighlighted
                                        ? 'rgba(255, 255, 255, 0.08)'
                                        : 'transparent',
                                      color: isSelected ? 'var(--accent, #EB5E28)' : 'var(--text-primary, #E4E3E5)',
                                      transition: 'background 0.08s ease',
                                    }}
                                  >
                                    <span style={{ fontFamily: rf, fontSize: 13 }}>{lbl}</span>
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
                                  padding: '6px 8px 3px 8px',
                                  fontSize: 10,
                                  color: 'var(--text-dim, #717075)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  fontWeight: 600,
                                }}
                              >
                                Bundled Fonts
                              </div>
                              {filteredBundled.map((f) => {
                                const idx = globalIdxCounter++;
                                const isSelected = (values.fontFamily || '-apple-system, SF Pro Display, sans-serif') === f.value;
                                const isHighlighted = (highlightedFont || values.fontFamily) === f.value;

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
                                        ? 'var(--accent-dim, rgba(235, 94, 40, 0.2))'
                                        : isHighlighted
                                        ? 'rgba(255, 255, 255, 0.08)'
                                        : 'transparent',
                                      color: isSelected ? 'var(--accent, #EB5E28)' : 'var(--text-primary, #E4E3E5)',
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

                          {/* 3. Installed System Fonts */}
                          {filteredInstalled.length > 0 && (
                            <div>
                              <div
                                style={{
                                  padding: '6px 8px 3px 8px',
                                  fontSize: 10,
                                  color: 'var(--text-dim, #717075)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  fontWeight: 600,
                                }}
                              >
                                Installed PC Fonts ({installedSystemFonts.length})
                              </div>
                              {filteredInstalled.map((f) => {
                                const idx = globalIdxCounter++;
                                const isSelected = (values.fontFamily || '-apple-system, SF Pro Display, sans-serif') === f.value;
                                const isHighlighted = (highlightedFont || values.fontFamily) === f.value;

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
                                        ? 'var(--accent-dim, rgba(235, 94, 40, 0.2))'
                                        : isHighlighted
                                        ? 'rgba(255, 255, 255, 0.08)'
                                        : 'transparent',
                                      color: isSelected ? 'var(--accent, #EB5E28)' : 'var(--text-primary, #E4E3E5)',
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
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Font Size Slider */}
        <StudioSlider
          label="Font Size"
          value={values.fontSize ?? (surface === 'full' ? 65 : 36)}
          min={16}
          max={200}
          defaultValue={surface === 'full' ? 65 : 36}
          unit="px"
          onChange={(val) => onChange({ fontSize: val })}
        />

        {/* Font Weight Dropdown */}
        <div className="studio-field-box">
          <span className="studio-field-label">Font Weight</span>
          <select
            className="studio-select"
            value={values.fontWeight ? String(values.fontWeight) : '700'}
            onChange={(e) => onChange({ fontWeight: parseInt(e.target.value, 10) || 700 })}
          >
            <option value="300">Light</option>
            <option value="400">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semi Bold</option>
            <option value="700">Bold</option>
            <option value="800">Extra Bold</option>
            <option value="900">Black</option>
          </select>
        </div>

        {/* Text Alignment */}
        <div className="studio-field-box">
          <span className="studio-field-label">Text Alignment</span>
          <div className="studio-button-group">
            {[
              {
                val: 'left',
                label: 'Left',
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                  </svg>
                ),
              },
              {
                val: 'center',
                label: 'Center',
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" />
                  </svg>
                ),
              },
              {
                val: 'right',
                label: 'Right',
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" />
                  </svg>
                ),
              },
            ].map((al) => (
              <button
                key={al.val}
                type="button"
                className={`studio-group-btn ${(values.textAlign || 'center') === al.val ? 'active' : ''}`}
                onClick={() => onChange({ textAlign: al.val })}
              >
                {al.icon}
                <span>{al.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Verse Colour */}
        <StudioColorPicker
          label="Verse Colour"
          value={values.fontColor || '#ffffff'}
          onChange={(col) => onChange({ fontColor: col })}
        />

        {/* Reference Size Slider */}
        <StudioSlider
          label="Reference Size"
          value={values.referenceFontSize ?? (surface === 'full' ? 40 : 24)}
          min={12}
          max={200}
          defaultValue={surface === 'full' ? 40 : 24}
          unit="px"
          onChange={(val) => onChange({ referenceFontSize: val })}
        />

        {/* Reference Colour & Match Verse Toggle */}
        <div className="studio-grid-2">
          <StudioColorPicker
            label="Reference Colour"
            disabled={Boolean(values.syncRefColor)}
            value={values.syncRefColor ? (values.fontColor || '#ffffff') : (values.referenceColor || values.savedRefColor || '#FF5500')}
            onChange={(col) => onChange({ referenceColor: col, savedRefColor: col, syncRefColor: false })}
          />
          <div className="studio-field-box" style={{ justifyContent: 'center', height: '100%', paddingBottom: 6 }}>
            <StudioToggle
              label="Match Verse"
              checked={Boolean(values.syncRefColor)}
              onChange={(checked) => {
                const rememberedRefColor = values.referenceColor && values.referenceColor !== values.fontColor
                  ? values.referenceColor
                  : (values.savedRefColor || values.accentColor || '#FF5500');
                onChange({
                  syncRefColor: checked,
                  savedRefColor: rememberedRefColor,
                  referenceColor: checked ? (values.fontColor || '#ffffff') : rememberedRefColor,
                });
              }}
            />
          </div>
        </div>

        {surface === 'full' && (
          <StudioSlider
            label="Line Height"
            value={values.lineHeight ?? 1.35}
            min={1.0}
            max={2.4}
            step={0.05}
            defaultValue={1.35}
            unit="x"
            displayValue={`${(values.lineHeight ?? 1.35).toFixed(2)}x`}
            onChange={(val) => onChange({ lineHeight: val })}
          />
        )}
      </StudioSection>

      {/* ── SECTION 2: CUSTOM SHADOW ── */}
      <StudioSection
        title="Custom Shadow"
        open={open.shadow}
        onToggle={() => toggle('shadow')}
        onReset={() => {
          onChange({
            textShadowEnabled: false,
            textShadowLevel: 'medium',
            textShadowBlur: 8,
            textShadowColor: '#000000',
          });
        }}
      >
        <StudioToggle
          label="Enable Drop Shadow"
          checked={Boolean(values.textShadowEnabled)}
          onChange={(checked) => onChange({ textShadowEnabled: checked })}
        />

        {values.textShadowEnabled && (
          <>
            {/* Shadow Level Preset */}
            <div className="studio-field-box">
              <span className="studio-field-label">Shadow Level</span>
              <div className="studio-button-group">
                {[
                  { val: 'subtle', label: 'Subtle', blur: 4 },
                  { val: 'medium', label: 'Medium', blur: 8 },
                  { val: 'heavy', label: 'Heavy', blur: 16 },
                ].map((lvl) => (
                  <button
                    key={lvl.val}
                    type="button"
                    className={`studio-group-btn ${(values.textShadowLevel || 'medium') === lvl.val ? 'active' : ''}`}
                    onClick={() => onChange({ textShadowLevel: lvl.val, textShadowBlur: lvl.blur })}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shadow Blur Slider */}
            <StudioSlider
              label="Blur"
              value={values.textShadowBlur ?? 8}
              min={0}
              max={40}
              defaultValue={8}
              unit="px"
              onChange={(val) => onChange({ textShadowBlur: safeInt(val, 8) })}
            />

            {/* Shadow Color */}
            <StudioColorPicker
              label="Shadow Colour"
              value={values.textShadowColor || '#000000'}
              onChange={(col) => onChange({ textShadowColor: col })}
            />
          </>
        )}
      </StudioSection>

      {/* ── SECTION 3: BACKGROUND & SURFACE ── */}
      <StudioSection
        title="Background"
        open={open.background}
        onToggle={() => toggle('background')}
        onReset={() => {
          handleBgTypeChange('gradient');
        }}
      >
        {/* Fill Type Dropdown */}
        <div className="studio-field-box">
          <span className="studio-field-label">Fill Type</span>
          <select
            className="studio-select"
            value={currentBgType || 'solid'}
            onChange={(e) => handleBgTypeChange(e.target.value)}
          >
            <option value="solid">Solid Color</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="transparent">Alpha</option>
          </select>
        </div>

        {/* Opacity Slider */}
        <StudioSlider
          label="Opacity"
          value={currentOpacity}
          min={0}
          max={1}
          step={0.05}
          defaultValue={surface === 'lt' ? 0.95 : 1}
          unit="%"
          displayValue={`${Math.round(currentOpacity * 100)}%`}
          onChange={(val) => onChange({ backgroundOpacity: val })}
        />

        {/* Conditional Controls per Fill Type */}
        {(currentBgType === 'image' || currentBgType === 'video') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MediaGrid
              kind={currentBgType}
              selectedUrl={values.backgroundMediaUrl || ''}
              onSelect={(item) => onChange({
                backgroundMediaUrl: item.url,
                backgroundMediaType: item.type,
                backgroundFit: values.backgroundFit || 'cover',
              })}
            />
            <div className="studio-field-box">
              <span className="studio-field-label">Media Fit</span>
              <div className="studio-button-group">
                {[
                  { val: 'cover', label: 'Cover' },
                  { val: 'contain', label: 'Contain' },
                  { val: 'fill', label: 'Stretch' },
                ].map((fit) => (
                  <button
                    key={fit.val}
                    type="button"
                    className={`studio-group-btn ${(values.backgroundFit || 'cover') === fit.val ? 'active' : ''}`}
                    onClick={() => onChange({ backgroundFit: fit.val })}
                  >
                    {fit.label}
                  </button>
                ))}
              </div>
            </div>
            {currentBgType === 'video' && (
              <StudioToggle
                label="Loop Video Background"
                checked={values.backgroundLoop !== false}
                onChange={(checked) => onChange({ backgroundLoop: checked })}
              />
            )}
          </div>
        )}

        {currentBgType === 'solid' && (
          <StudioColorPicker
            label="Background Colour"
            value={currentSolid.startsWith('#') ? currentSolid : '#0c0e14'}
            onChange={(col) => onChange({ backgroundColor: col, background: col })}
          />
        )}

        {currentBgType === 'gradient' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Gradient Type Dropdown */}
            <div className="studio-field-box">
              <div className="studio-field-label">Gradient Type</div>
              <select
                className="studio-select"
                value={isRadial ? 'radial' : 'linear'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'radial' && !isRadial) handleToggleRadial();
                  if (val === 'linear' && isRadial) handleToggleRadial();
                }}
              >
                <option value="linear">Linear Gradient</option>
                <option value="radial">Radial Gradient (Circular)</option>
              </select>
            </div>

            {/* Visual Gradient Ramp Slider with Dual Movable Handles & Click-to-Pick Color */}
            <StudioGradientRamp
              startColor={currentStart}
              endColor={currentEnd}
              direction={currentDir}
              isRadial={isRadial}
              startPos={currentStartPos}
              endPos={currentEndPos}
              onColorChange={handleGradientChange}
              onSwapColors={handleSwapGradient}
            />

            {/* Gradient Angle (Linear Mode) */}
            {!isRadial && (
              <div className="studio-field-box">
                <div className="studio-slider-labels">
                  <span className="studio-slider-name">Gradient Angle</span>
                  <span className="studio-slider-value">{numericAngle}°</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CircularAngleDial
                    angleDeg={numericAngle}
                    isRadial={false}
                    onChangeAngle={handleAngleChange}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="studio-slider-track-wrap">
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={numericAngle}
                        onChange={(e) => handleAngleChange(Number(e.target.value))}
                        className="studio-range-slider"
                        style={{
                          background: `linear-gradient(to right, #10B981 0%, #10B981 ${(numericAngle / 360) * 100}%, var(--studio-track-bg, rgba(255, 255, 255, 0.12)) ${(numericAngle / 360) * 100}%, var(--studio-track-bg, rgba(255, 255, 255, 0.12)) 100%)`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Angle Preset Dropdown */}
                <select
                  className="studio-select"
                  value={[0, 45, 90, 135, 180, 225, 270, 315].includes(numericAngle) ? String(numericAngle) : 'custom'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== 'custom') {
                      handleAngleChange(Number(v));
                    }
                  }}
                  style={{ marginTop: 4 }}
                >
                  <option value="custom" disabled={![0, 45, 90, 135, 180, 225, 270, 315].includes(numericAngle)}>
                    Custom Angle ({numericAngle}°)
                  </option>
                  <option value="0">0° — Top to Bottom</option>
                  <option value="45">45° — Bottom-Left to Top-Right</option>
                  <option value="90">90° — Left to Right</option>
                  <option value="135">135° — Top-Left to Bottom-Right</option>
                  <option value="180">180° — Bottom to Top</option>
                  <option value="225">225° — Top-Right to Bottom-Left</option>
                  <option value="270">270° — Right to Left</option>
                  <option value="315">315° — Bottom-Right to Top-Left</option>
                </select>
              </div>
            )}

            {/* Presets Grid (Full Width 6-Column) */}
            <div className="studio-field-box">
              <div className="studio-field-label">Color Presets</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {PRO_GRADIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    onClick={() => handleGradientChange({
                      start: preset.start,
                      end: preset.end,
                      dir: isRadial ? 'radial' : preset.dir,
                    })}
                    style={{
                      height: 24,
                      borderRadius: 5,
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      background: isRadial
                        ? `radial-gradient(circle, ${preset.start}, ${preset.end})`
                        : `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.08)';
                      e.currentTarget.style.borderColor = '#10b981';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </StudioSection>

      {/* ── SECTION 4: PLACEMENT & GEOMETRY ── */}
      <StudioSection
        title="Placement & Geometry"
        open={open.placement}
        onToggle={() => toggle('placement')}
        onReset={() => {
          if (surface === 'lt') {
            onChange({
              width: 75,
              borderRadius: 6,
              padding: 20,
              position: 'bottom-center',
              offsetX: 0,
              offsetY: 0,
            });
          } else {
            onChange({
              verticalAlign: 'center',
              offsetX: 0,
              offsetY: 0,
            });
          }
        }}
      >
        {surface === 'lt' ? (
          <>
            {/* Lower Third Width Slider */}
            <StudioSlider
              label="Banner Width"
              value={values.width ?? 75}
              min={20}
              max={100}
              defaultValue={75}
              unit="%"
              onChange={(val) => onChange({ width: val })}
            />

            {/* Lower Third Corner Radius Slider */}
            <StudioSlider
              label="Corner Radius"
              value={values.borderRadius ?? 6}
              min={0}
              max={40}
              defaultValue={6}
              unit="px"
              onChange={(val) => onChange({ borderRadius: val })}
            />

            {/* Lower Third Padding Slider */}
            <StudioSlider
              label="Inner Padding"
              value={values.padding ?? 20}
              min={0}
              max={60}
              defaultValue={20}
              unit="px"
              onChange={(val) => onChange({ padding: val })}
            />

            {/* Banner Screen Location: Top / Bottom */}
            <div className="studio-field-box">
              <span className="studio-field-label">Screen Location</span>
              <div className="studio-button-group">
                {[
                  { val: 'bottom', label: 'Bottom' },
                  { val: 'top', label: 'Top' },
                ].map((loc) => {
                  const curPos = values.position || 'bottom-center';
                  const isTop = curPos.startsWith('top');
                  const isActive = loc.val === 'top' ? isTop : !isTop;
                  return (
                    <button
                      key={loc.val}
                      type="button"
                      className={`studio-group-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        const horiz = curPos.includes('left') ? 'left' : curPos.includes('right') ? 'right' : 'center';
                        onChange({ position: `${loc.val}-${horiz}` });
                      }}
                    >
                      {loc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Banner Horizontal Alignment: Left / Center / Right */}
            <div className="studio-field-box">
              <span className="studio-field-label">Horizontal Position</span>
              <div className="studio-button-group">
                {[
                  { val: 'left', label: 'Left' },
                  { val: 'center', label: 'Center' },
                  { val: 'right', label: 'Right' },
                ].map((align) => {
                  const curPos = values.position || 'bottom-center';
                  const isTop = curPos.startsWith('top');
                  const curAlign = curPos.includes('left') ? 'left' : curPos.includes('right') ? 'right' : 'center';
                  return (
                    <button
                      key={align.val}
                      type="button"
                      className={`studio-group-btn ${curAlign === align.val ? 'active' : ''}`}
                      onClick={() => {
                        const vert = isTop ? 'top' : 'bottom';
                        onChange({ position: `${vert}-${align.val}` });
                      }}
                    >
                      {align.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="studio-field-box">
            <span className="studio-field-label">Vertical Alignment</span>
            <div className="studio-button-group">
              {[
                { val: 'top', label: 'Top' },
                { val: 'center', label: 'Center' },
                { val: 'bottom', label: 'Bottom' },
              ].map((v) => (
                <button
                  key={v.val}
                  type="button"
                  className={`studio-group-btn ${(values.verticalAlign || 'center') === v.val ? 'active' : ''}`}
                  onClick={() => onChange({ verticalAlign: v.val })}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Offset X & Offset Y Sliders */}
        <StudioSlider
          label="Offset X"
          value={values.offsetX ?? 0}
          min={-500}
          max={500}
          defaultValue={0}
          unit="px"
          onChange={(val) => onChange({ offsetX: val })}
        />

        <StudioSlider
          label="Offset Y"
          value={values.offsetY ?? 0}
          min={-500}
          max={500}
          defaultValue={0}
          unit="px"
          onChange={(val) => onChange({ offsetY: val })}
        />
      </StudioSection>
    </div>
  );
}
