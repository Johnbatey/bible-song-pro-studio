/* =========================================================================
   <Inspector> — Theme Studio Standard Right Sidebar for Stage Designer
   -------------------------------------------------------------------------
   Completely redesigned to match the clean Theme Studio & Pro Slides Editor
   design language (studio-section accordions, emerald/orange progress sliders,
   stroke-only inputs, custom color swatches, and alignment grids).
   ========================================================================= */
import React, { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
import type { StageLayout, StageZone, ZoneType } from '../stage/layouts';
import { defaultTheme, type StageTheme } from '../stage/theme';
import { ZONE_HINTS, ZONE_LABELS, ZONE_TYPES } from '../stage/layout-model';
import { fetchInstalledSystemFonts, type FontOptionItem } from '../renderer/utils/system-fonts';
import {
  AlignBottom,
  AlignHCentre,
  AlignLeft,
  AlignRight,
  AlignTop,
  AlignVMiddle,
  ZONE_ICONS,
} from './icons';


const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: 'Theme default', value: '' },
  { label: 'Inter / System UI', value: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: 'Outfit', value: 'Outfit, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'SF Pro Display', value: "-apple-system, 'SF Pro Display', sans-serif" },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New (Mono)', value: "'Courier New', Courier, monospace" },
];

const WEIGHT_OPTIONS = [
  { weight: 100, label: 'Thin' },
  { weight: 200, label: 'Extra Light' },
  { weight: 300, label: 'Light' },
  { weight: 400, label: 'Regular' },
  { weight: 500, label: 'Medium' },
  { weight: 600, label: 'Semi Bold' },
  { weight: 700, label: 'Bold' },
  { weight: 800, label: 'Extra Bold' },
  { weight: 900, label: 'Black' },
];

const COLOR_TOKENS: Array<{ token: string; label: string; hint: string; dot: string }> = [
  { token: 'text', label: 'Text', hint: 'Theme main text color', dot: '#ffffff' },
  { token: 'accent', label: 'Accent', hint: 'Theme accent color', dot: '#FF5500' },
  { token: 'muted', label: 'Muted', hint: 'Secondary text (42%)', dot: '#94a3b8' },
  { token: 'faint', label: 'Faint', hint: 'Clock & subtle chrome (28%)', dot: '#64748b' },
];

const HAS_REFERENCE = new Set<ZoneType>(['current-text', 'slide']);

/* ── Studio Reusable Slider Component ── */
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

function StudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '%',
  displayValue,
  defaultValue,
  hardMax = 5000,
  onChange,
}: StudioSliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const safeVal = Number.isFinite(value) ? value : min;
  const [draft, setDraft] = useState(String(safeVal));

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(safeVal));
    }
  }, [safeVal, isEditing]);

  const effectiveMax = Math.max(max, safeVal);
  const percentage = Math.max(0, Math.min(100, ((safeVal - min) / (effectiveMax - min || 1)) * 100));
  const sliderBg = `linear-gradient(to right, #FF5500 0%, #FF5500 ${percentage}%, rgba(255, 255, 255, 0.12) ${percentage}%, rgba(255, 255, 255, 0.12) 100%)`;

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
      onChange(min);
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
              border: '1px solid #FF5500',
              borderRadius: 4,
              color: '#fff',
              outline: 'none',
            }}
          />
        ) : (
          <span
            className="studio-slider-value"
            onClick={() => {
              setDraft(String(safeVal));
              setIsEditing(true);
            }}
            title="Click to type exact value (up to 5000px)"
            style={{ cursor: 'pointer' }}
          >
            {displayValue ?? `${Math.round(safeVal * 10) / 10}${unit}`}
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

/* ── Studio Color Picker Component ── */
interface StudioColorPickerProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (color: string) => void;
  onClear?: () => void;
}

function StudioColorPicker({ label, value, disabled = false, onChange, onClear }: StudioColorPickerProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="studio-field-label">{label}</span>
        {onClear && value && (
          <button type="button" className="studio-reset-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div
        className="studio-color-picker-btn"
        style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'default', position: 'relative' }}
      >
        <div
          className="studio-color-swatch"
          style={{
            position: 'relative',
            background: safeVal,
            cursor: disabled ? 'not-allowed' : 'pointer',
            overflow: 'hidden',
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          title="Click to pick color"
        >
          <input
            ref={inputRef}
            type="color"
            value={safeVal}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              setDraft(e.target.value.toUpperCase());
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              border: 'none',
              padding: 0,
              margin: 0,
            }}
          />
        </div>
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
            if (e.key === 'Enter') commitHex(draft);
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

/* ── Studio Font Picker with Search, Recents & Live Canvas Preview ── */
interface StudioFontPickerProps {
  label?: string;
  value: string;
  onChange: (fontValue: string) => void;
}

function StudioFontPicker({ label = 'Font Family', value, onChange }: StudioFontPickerProps) {
  const [fontOptions, setFontOptions] = useState<FontOptionItem[]>([]);
  const [recentFonts, setRecentFonts] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('bsp_recent_fonts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedFont, setHighlightedFont] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initialFontRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;
    fetchInstalledSystemFonts().then((fonts) => {
      if (mounted && fonts) {
        setFontOptions(fonts);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (initialFontRef.current !== undefined && initialFontRef.current !== value) {
          onChange(initialFontRef.current);
        }
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onChange, value]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const defaultBundledFonts: FontOptionItem[] = useMemo(() => [
    { value: '', label: 'Theme default' },
    { value: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif", label: 'Inter / System UI' },
    { value: 'Outfit, sans-serif', label: 'Outfit' },
    { value: 'Roboto, sans-serif', label: 'Roboto' },
    { value: "-apple-system, 'SF Pro Display', sans-serif", label: 'SF Pro Display' },
    { value: 'Poppins, sans-serif', label: 'Poppins' },
    { value: "'Playfair Display', serif", label: 'Playfair Display' },
    { value: "'Montserrat', sans-serif", label: 'Montserrat' },
    { value: "'Cinzel', serif", label: 'Cinzel' },
    { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
    { value: "'Crimson Pro', serif", label: 'Crimson Pro' },
    { value: "'Lora', serif", label: 'Lora' },
    { value: "'Oswald', sans-serif", label: 'Oswald' },
    { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: "'Times New Roman', serif", label: 'Times New Roman' },
    { value: "'Courier New', Courier, monospace", label: 'Courier New (Mono)' },
  ], []);

  const bundledFonts = useMemo(() => {
    return fontOptions.length > 0
      ? [
          { value: '', label: 'Theme default' },
          ...fontOptions.filter((f) => !f.isSystemFont && f.value !== ''),
        ]
      : defaultBundledFonts;
  }, [fontOptions, defaultBundledFonts]);

  const installedSystemFonts = useMemo(() => {
    return fontOptions.filter((f) => f.isSystemFont);
  }, [fontOptions]);

  const q = searchQuery.toLowerCase().trim();

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
    onChange(fontValue);
  };

  const handleCommitFont = (fontValue: string) => {
    onChange(fontValue);
    setHighlightedFont(fontValue);
    if (fontValue) {
      try {
        const raw = localStorage.getItem('bsp_recent_fonts');
        const list: string[] = raw ? JSON.parse(raw) : [];
        const updated = [fontValue, ...list.filter((f) => f !== fontValue)].slice(0, 3);
        localStorage.setItem('bsp_recent_fonts', JSON.stringify(updated));
        setRecentFonts(updated);
      } catch {}
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (initialFontRef.current !== undefined) {
      onChange(initialFontRef.current);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatVisibleFonts.length === 0) return;
      const currentVal = highlightedFont !== null ? highlightedFont : value;
      const currentIndex = flatVisibleFonts.findIndex((f) => f.value === currentVal);
      const nextIndex = currentIndex < flatVisibleFonts.length - 1 ? currentIndex + 1 : 0;
      const nextFont = flatVisibleFonts[nextIndex];
      if (nextFont) {
        handlePreviewFont(nextFont.value);
        const el = listRef.current?.querySelector(`[data-font-idx="${nextIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatVisibleFonts.length === 0) return;
      const currentVal = highlightedFont !== null ? highlightedFont : value;
      const currentIndex = flatVisibleFonts.findIndex((f) => f.value === currentVal);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : flatVisibleFonts.length - 1;
      const prevFont = flatVisibleFonts[prevIndex];
      if (prevFont) {
        handlePreviewFont(prevFont.value);
        const el = listRef.current?.querySelector(`[data-font-idx="${prevIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedFont !== null) {
        handleCommitFont(highlightedFont);
      } else if (flatVisibleFonts.length > 0) {
        handleCommitFont(flatVisibleFonts[0].value);
      }
      return;
    }
  };

  const currentVal = value || '';
  const matchedOpt = fontOptions.find((f) => f.value === currentVal) || defaultBundledFonts.find((f) => f.value === currentVal);
  const currentLabel = matchedOpt ? matchedOpt.label : (currentVal ? currentVal.split(',')[0].replace(/['"]/g, '').trim() : 'Theme default');

  let globalIdxCounter = 0;

  return (
    <div className="studio-field-box" style={{ position: 'relative' }} ref={containerRef}>
      {label && <span className="studio-field-label">{label}</span>}
      <button
        type="button"
        className="studio-select"
        onClick={() => {
          if (!isOpen) {
            initialFontRef.current = value || '';
            setHighlightedFont(initialFontRef.current);
            setIsOpen(true);
            setSearchQuery('');
          } else {
            setIsOpen(false);
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
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: currentVal || 'inherit' }}>
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
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            opacity: 0.6,
            flexShrink: 0,
            marginLeft: 6,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--dz-panel, #18181b)',
            border: '1px solid var(--dz-line-strong, #333235)',
            borderRadius: 8,
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0,0,0,0.3)',
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
              borderBottom: '1px solid var(--dz-line, #2A282A)',
              background: 'var(--dz-raised, #161516)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--dz-line, #2A282A)',
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
                stroke="var(--dz-faint, #717075)"
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fonts..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--dz-text, #fff)',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  padding: 0,
                  minWidth: 0,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--dz-faint, #717075)',
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
            ref={listRef}
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
              <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--dz-faint, #717075)' }}>
                No fonts found matching "{searchQuery}"
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
                        color: 'var(--dz-faint, #717075)',
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
                      const lbl = matched ? matched.label : (rf ? rf.split(',')[0].replace(/['"]/g, '').trim() : 'Theme default');
                      const isSelected = (value || '') === rf;
                      const isHighlighted = (highlightedFont !== null ? highlightedFont : value || '') === rf;

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
                              ? 'rgba(255, 85, 0, 0.16)'
                              : isHighlighted
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'transparent',
                            color: isSelected ? '#FF5500' : 'var(--dz-text, #E4E3E5)',
                            transition: 'background 0.08s ease',
                          }}
                        >
                          <span style={{ fontFamily: rf || 'inherit', fontSize: 13 }}>{lbl}</span>
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
                        color: 'var(--dz-faint, #717075)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                      }}
                    >
                      Bundled Fonts
                    </div>
                    {filteredBundled.map((f) => {
                      const idx = globalIdxCounter++;
                      const isSelected = (value || '') === f.value;
                      const isHighlighted = (highlightedFont !== null ? highlightedFont : value || '') === f.value;

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
                              ? 'rgba(255, 85, 0, 0.16)'
                              : isHighlighted
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'transparent',
                            color: isSelected ? '#FF5500' : 'var(--dz-text, #E4E3E5)',
                            transition: 'background 0.08s ease',
                          }}
                        >
                          <span style={{ fontFamily: f.value || 'inherit', fontSize: 13 }}>{f.label}</span>
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

                {/* 3. System & Installed Fonts */}
                {filteredInstalled.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '6px 8px 3px 8px',
                        fontSize: 10,
                        color: 'var(--dz-faint, #717075)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                      }}
                    >
                      System & Installed Fonts ({filteredInstalled.length})
                    </div>
                    {filteredInstalled.map((f) => {
                      const idx = globalIdxCounter++;
                      const isSelected = (value || '') === f.value;
                      const isHighlighted = (highlightedFont !== null ? highlightedFont : value || '') === f.value;

                      return (
                        <div
                          key={`installed-${f.value}`}
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
                              ? 'rgba(255, 85, 0, 0.16)'
                              : isHighlighted
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'transparent',
                            color: isSelected ? '#FF5500' : 'var(--dz-text, #E4E3E5)',
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
    </div>
  );
}

const ACCENT_SWATCHES = ['#fbbf24', '#0a84ff', '#30d158', '#ff453a', '#bf5af2', '#ff9f0a'];
const BG_SWATCHES = ['#000000', '#0d1b2a', '#1e293b', '#2e1a1a', '#ffffff', '#f4f2ef'];
const TEXT_SWATCHES = ['#ffffff', '#f5f5f7', '#fbbf24', '#a1a1aa'];

interface StageStyleEditorProps {
  layout: StageLayout;
  theme: StageTheme;
  onLayoutChange: (patch: Partial<StageLayout>) => void;
  onThemeChange: (patch: Partial<StageTheme>) => void;
  onAddZone?: (type: ZoneType) => void;
}

function StageStyleEditor({
  layout,
  theme,
  onLayoutChange,
  onThemeChange,
  onAddZone,
}: StageStyleEditorProps) {
  const [openSections, setOpenSections] = useState({
    background: false,
    colors: false,
    scale: true,
    elements: true,
    quickAdd: true,
  });

  const toggle = (k: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));

  const currentBg = layout.bgColor || theme.background || '#000000';
  const currentAccent = theme.accent || '#fbbf24';
  const currentText = theme.text || '#ffffff';

  const handleBg = (color: string) => {
    onLayoutChange({ bgColor: color });
    onThemeChange({ background: color });
  };

  const handleAccent = (color: string) => {
    onThemeChange({ accent: color });
  };

  const handleText = (color: string) => {
    onThemeChange({ text: color });
  };

  const handleFontScale = (scalePercent: number) => {
    onThemeChange({ fontScale: Math.round(scalePercent) / 100 });
  };

  const handleToggle = (key: 'showClock' | 'showTimer' | 'showLabels') => {
    onThemeChange({ [key]: !theme[key] });
  };

  return (
    <div className="studio-sidebar-scroll">
      {/* Background Section */}
      <div className="studio-section">
        <button type="button" className="studio-section-header" onClick={() => toggle('background')}>
          <div className="studio-section-title-wrap">
            <div className={`studio-section-chevron ${openSections.background ? 'open' : 'closed'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <span>Stage Background</span>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: currentBg, border: '1px solid var(--dz-line-strong)' }} />
        </button>
        {openSections.background && (
          <div className="studio-section-content">
            <div className="studio-field-box">
              <span className="studio-field-label">Preset Ground Colors</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {BG_SWATCHES.map((color) => {
                  const active = currentBg.toLowerCase() === color.toLowerCase();
                  const isLight = color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#f4f2ef';
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleBg(color)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: color,
                        border: active ? '2px solid #FF5500' : '1px solid var(--dz-line-strong, rgba(128,128,128,0.3))',
                        boxShadow: active ? '0 0 0 2px rgba(255,85,0,0.45)' : '0 1px 3px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isLight ? '#000000' : '#ffffff',
                        fontSize: 10,
                        fontWeight: 'bold',
                        padding: 0,
                      }}
                      title={color}
                    >
                      {active ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
            <StudioColorPicker
              label="Custom Background Fill"
              value={currentBg}
              onChange={handleBg}
            />
          </div>
        )}
      </div>

      {/* Theme Colors Section */}
      <div className="studio-section">
        <button type="button" className="studio-section-header" onClick={() => toggle('colors')}>
          <div className="studio-section-title-wrap">
            <div className={`studio-section-chevron ${openSections.colors ? 'open' : 'closed'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <span>Theme Colors</span>
          </div>
        </button>
        {openSections.colors && (
          <div className="studio-section-content">
            <div className="studio-field-box">
              <span className="studio-field-label">Accent Color</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, marginBottom: 8 }}>
                {ACCENT_SWATCHES.map((color) => {
                  const active = currentAccent.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleAccent(color)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: color,
                        border: active ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                        boxShadow: active ? '0 0 0 2px #FF5500' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: color === '#ffffff' || color === '#fbbf24' ? '#000' : '#fff',
                        fontSize: 10,
                        fontWeight: 'bold',
                        padding: 0,
                      }}
                      title={color}
                    >
                      {active ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
              <StudioColorPicker
                label="Custom Accent Color"
                value={currentAccent}
                onChange={handleAccent}
              />
            </div>

            <div className="studio-field-box" style={{ marginTop: 8 }}>
              <span className="studio-field-label">Primary Text Color</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, marginBottom: 8 }}>
                {TEXT_SWATCHES.map((color) => {
                  const active = currentText.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleText(color)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: color,
                        border: active ? '2px solid #FF5500' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: active ? '0 0 0 2px rgba(255,85,0,0.45)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: color === '#ffffff' || color === '#f5f5f7' || color === '#fbbf24' ? '#000' : '#fff',
                        fontSize: 10,
                        fontWeight: 'bold',
                        padding: 0,
                      }}
                      title={color}
                    >
                      {active ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
              <StudioColorPicker
                label="Custom Text Color"
                value={currentText}
                onChange={handleText}
              />
            </div>
          </div>
        )}
      </div>

      {/* Font Scaling Section */}
      <div className="studio-section">
        <button type="button" className="studio-section-header" onClick={() => toggle('scale')}>
          <div className="studio-section-title-wrap">
            <div className={`studio-section-chevron ${openSections.scale ? 'open' : 'closed'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <span>Global Font Scaling</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FF5500' }}>{Math.round((theme.fontScale || 1) * 100)}%</span>
        </button>
        {openSections.scale && (
          <div className="studio-section-content">
            <StudioSlider
              label="Stage Scale"
              value={Math.round((theme.fontScale || 1) * 100)}
              min={50}
              max={200}
              step={5}
              unit="%"
              defaultValue={100}
              displayValue={`${Math.round((theme.fontScale || 1) * 100)}%`}
              onChange={handleFontScale}
            />
          </div>
        )}
      </div>

      {/* Display Elements Section */}
      <div className="studio-section">
        <button type="button" className="studio-section-header" onClick={() => toggle('elements')}>
          <div className="studio-section-title-wrap">
            <div className={`studio-section-chevron ${openSections.elements ? 'open' : 'closed'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <span>Display Elements</span>
          </div>
        </button>
        {openSections.elements && (
          <div className="studio-section-content">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['showClock', 'showTimer', 'showLabels'] as const).map((key) => {
                const label = key === 'showClock' ? 'Clock' : key === 'showTimer' ? 'Timer' : 'Labels';
                const active = Boolean(theme[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleToggle(key)}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: active ? '1.5px solid #FF5500' : '1px solid var(--dz-line)',
                      background: active ? 'rgba(255,85,0,0.14)' : 'var(--dz-raised)',
                      color: active ? '#FF5500' : 'var(--dz-dim)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label} {active ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Zones Section */}
      {onAddZone && (
        <div className="studio-section">
          <button type="button" className="studio-section-header" onClick={() => toggle('quickAdd')}>
            <div className="studio-section-title-wrap">
              <div className={`studio-section-chevron ${openSections.quickAdd ? 'open' : 'closed'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <span>Add Stage Zone</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dz-faint)' }}>{layout.zones.length} active</span>
          </button>
          {openSections.quickAdd && (
            <div className="studio-section-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {ZONE_TYPES.map((type) => {
                  const Icon = ZONE_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onAddZone(type)}
                      className="studio-group-btn"
                      style={{ height: 32, padding: '0 8px', gap: 6, justifyContent: 'flex-start', fontSize: 11, fontWeight: 600 }}
                      title={`Add ${ZONE_LABELS[type]}`}
                    >
                      <span style={{ color: '#FF5500', display: 'inline-flex' }}><Icon /></span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ZONE_LABELS[type]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      <div style={{ marginTop: 12, padding: '0 4px' }}>
        <button
          type="button"
          className="studio-btn-secondary"
          style={{ width: '100%', fontSize: 11, padding: '8px' }}
          onClick={() => {
            const def = defaultTheme(layout.id, layout.bgColor);
            onThemeChange(def);
            onLayoutChange({ bgColor: def.background, theme: def });
          }}
        >
          Reset Theme Defaults
        </button>
      </div>
    </div>
  );
}

export interface InspectorProps {
  zone: StageZone | null;
  selectionCount: number;
  layout: StageLayout;
  theme: StageTheme;
  onChange: (patch: Partial<StageZone>, coalesceKey?: string) => void;
  onLayoutChange: (patch: Partial<StageLayout>) => void;
  onThemeChange: (patch: Partial<StageTheme>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (edge: 'left' | 'hcentre' | 'right' | 'top' | 'vmiddle' | 'bottom') => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onFill: () => void;
  onAddZone?: (type: ZoneType) => void;
}

export function Inspector({
  zone,
  selectionCount,
  layout,
  theme,
  onChange,
  onLayoutChange,
  onThemeChange,
  onDuplicate,
  onDelete,
  onAlign,
  onDistribute,
  onFill,
  onAddZone,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'style' | 'align'>('design');

  const [openSections, setOpenSections] = useState<{
    geometry: boolean;
    typography: boolean;
    appearance: boolean;
    identity: boolean;
  }>({
    geometry: false,
    typography: true,
    appearance: false,
    identity: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── Align Controls Component ── */
  const alignTools = (
    <div className="studio-field-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span className="studio-field-label">
          {selectionCount > 1 ? `Align (${selectionCount} zones)` : 'Align Stage'}
        </span>
        <button
          type="button"
          onClick={onFill}
          className="studio-reset-btn"
          style={{ color: '#FF5500' }}
          title="Stretch selected zone to 100% width and height"
        >
          Fill Stage (100%)
        </button>
      </div>

      <div className="studio-button-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <button type="button" className="studio-group-btn" onClick={() => onAlign('left')} title="Align left edges"><AlignLeft /></button>
        <button type="button" className="studio-group-btn" onClick={() => onAlign('hcentre')} title="Center horizontally"><AlignHCentre /></button>
        <button type="button" className="studio-group-btn" onClick={() => onAlign('right')} title="Align right edges"><AlignRight /></button>
        <button type="button" className="studio-group-btn" onClick={() => onAlign('top')} title="Align top edges"><AlignTop /></button>
        <button type="button" className="studio-group-btn" onClick={() => onAlign('vmiddle')} title="Center vertically"><AlignVMiddle /></button>
        <button type="button" className="studio-group-btn" onClick={() => onAlign('bottom')} title="Align bottom edges"><AlignBottom /></button>
      </div>

      {selectionCount > 2 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button type="button" className="studio-action-card" style={{ flex: 1, padding: '8px' }} onClick={() => onDistribute('h')}>
            Distribute Across
          </button>
          <button type="button" className="studio-action-card" style={{ flex: 1, padding: '8px' }} onClick={() => onDistribute('v')}>
            Distribute Down
          </button>
        </div>
      )}
    </div>
  );

  /* Multi-Selection View */
  if (selectionCount > 1) {
    return (
      <div className="studio-right-sidebar">
        <div className="studio-sidebar-header">
          <div className="studio-sidebar-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FF5500' }}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>{selectionCount} Zones Selected</span>
          </div>
        </div>

        <div className="studio-sidebar-scroll">
          {alignTools}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="studio-btn-secondary" style={{ flex: 1 }} onClick={onDuplicate}>
              Duplicate ({selectionCount})
            </button>
            <button type="button" className="studio-btn-danger" style={{ flex: 1 }} onClick={onDelete}>
              Delete All
            </button>
          </div>

          <p className="studio-help-text" style={{ marginTop: 16 }}>
            Drag selected zones on the canvas to move them together. Select an individual zone to customize its text, fonts, and appearance.
          </p>
        </div>
      </div>
    );
  }

  /* Empty Selection View -> Shows Layout & Stage Style Inspector */
  if (!zone) {
    return (
      <div className="studio-right-sidebar">
        <div className="studio-sidebar-header">
          <div className="studio-sidebar-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Stage & Layout Style</span>
          </div>
          <span className="studio-badge-pill">{layout.name}</span>
        </div>

        <StageStyleEditor
          layout={layout}
          theme={theme}
          onLayoutChange={onLayoutChange}
          onThemeChange={onThemeChange}
          onAddZone={onAddZone}
        />
      </div>
    );
  }

  const ZoneIcon = ZONE_ICONS[zone.type as ZoneType];

  return (
    <div className="studio-right-sidebar">
      {/* Sidebar Header */}
      <div className="studio-sidebar-header">
        <div className="studio-sidebar-title">
          {ZoneIcon && <span style={{ color: '#FF5500', display: 'inline-flex' }}><ZoneIcon /></span>}
          <span>{zone.label || ZONE_LABELS[zone.type as ZoneType] || zone.type}</span>
        </div>
        <span className="studio-badge-pill">
          {ZONE_LABELS[zone.type as ZoneType] || zone.type}
        </span>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="studio-tabs-row">
        <div className="studio-segmented-pill">
          <button
            type="button"
            className={`studio-segmented-tab ${activeTab === 'design' ? 'active' : ''}`}
            onClick={() => setActiveTab('design')}
          >
            Zone
          </button>
          <button
            type="button"
            className={`studio-segmented-tab ${activeTab === 'style' ? 'active' : ''}`}
            onClick={() => setActiveTab('style')}
          >
            Stage Style
          </button>
          <button
            type="button"
            className={`studio-segmented-tab ${activeTab === 'align' ? 'active' : ''}`}
            onClick={() => setActiveTab('align')}
          >
            Align
          </button>
        </div>
      </div>

      {activeTab === 'style' ? (
        <StageStyleEditor
          layout={layout}
          theme={theme}
          onLayoutChange={onLayoutChange}
          onThemeChange={onThemeChange}
          onAddZone={onAddZone}
        />
      ) : (
        <div className="studio-sidebar-scroll">
          {activeTab === 'align' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {alignTools}
            </div>
          ) : (
            <>
              {/* Section 1: Geometry & Position */}
              <div className="studio-section">
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
                  <span>Geometry & Position</span>
                </div>
                <div className="studio-section-actions">
                  <span style={{ fontSize: 11, color: 'var(--dz-faint)', fontFamily: 'monospace' }}>
                    {Math.round(zone.w)}×{Math.round(zone.h)}%
                  </span>
                </div>
              </button>

              {openSections.geometry && (
                <div className="studio-section-content">
                  <div className="studio-grid-2">
                    <div className="studio-field-box">
                      <span className="studio-field-label">X Position</span>
                      <div className="studio-input-wrap">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={roundForInput(zone.x)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            if (e.target.value === '') return;
                            onChange({ x: Number(e.target.value) }, `x:${zone.id}`);
                          }}
                          className="studio-input"
                        />
                        <span className="studio-input-suffix">%</span>
                      </div>
                    </div>

                    <div className="studio-field-box">
                      <span className="studio-field-label">Y Position</span>
                      <div className="studio-input-wrap">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={roundForInput(zone.y)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            if (e.target.value === '') return;
                            onChange({ y: Number(e.target.value) }, `y:${zone.id}`);
                          }}
                          className="studio-input"
                        />
                        <span className="studio-input-suffix">%</span>
                      </div>
                    </div>

                    <div className="studio-field-box">
                      <span className="studio-field-label">Width</span>
                      <div className="studio-input-wrap">
                        <input
                          type="number"
                          min={3}
                          max={100}
                          step={0.5}
                          value={roundForInput(zone.w)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            if (e.target.value === '') return;
                            onChange({ w: Number(e.target.value) }, `w:${zone.id}`);
                          }}
                          className="studio-input"
                        />
                        <span className="studio-input-suffix">%</span>
                      </div>
                    </div>

                    <div className="studio-field-box">
                      <span className="studio-field-label">Height</span>
                      <div className="studio-input-wrap">
                        <input
                          type="number"
                          min={3}
                          max={100}
                          step={0.5}
                          value={roundForInput(zone.h)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            if (e.target.value === '') return;
                            onChange({ h: Number(e.target.value) }, `h:${zone.id}`);
                          }}
                          className="studio-input"
                        />
                        <span className="studio-input-suffix">%</span>
                      </div>
                    </div>
                  </div>

                  <StudioSlider
                    label="Width Percentage"
                    value={zone.w}
                    min={5}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(w) => onChange({ w }, `w:${zone.id}`)}
                  />

                  <StudioSlider
                    label="Height Percentage"
                    value={zone.h}
                    min={5}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(h) => onChange({ h }, `h:${zone.id}`)}
                  />
                </div>
              )}
            </div>

            {/* Section 2: Typography & Text */}
            <div className="studio-section">
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
                  <span>Typography & Text</span>
                </div>
              </button>

              {openSections.typography && (
                <div className="studio-section-content">
                  {/* Font Family Custom Selector with Live Hover/Navigation Canvas Preview */}
                  <StudioFontPicker
                    value={zone.fontFamily || ''}
                    onChange={(fontFamily) => onChange({ fontFamily: fontFamily || undefined }, `font:${zone.id}`)}
                  />

                  {/* Font Size Slider */}
                  <StudioSlider
                    label="Font Size"
                    value={zone.fontSize ?? 48}
                    min={12}
                    max={200}
                    defaultValue={48}
                    step={1}
                    unit="px"
                    onChange={(fontSize) => onChange({ fontSize }, `fontSize:${zone.id}`)}
                  />

                  {/* Font Weight */}
                  <div className="studio-field-box">
                    <span className="studio-field-label">Font Weight</span>
                    <select
                      className="studio-select"
                      value={zone.fontWeight ?? 600}
                      onChange={(e) => onChange({ fontWeight: Number(e.currentTarget.value) })}
                    >
                      {WEIGHT_OPTIONS.map((w) => (
                        <option key={w.weight} value={w.weight}>{w.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Text Alignment */}
                  <div className="studio-field-box">
                    <span className="studio-field-label">Text Alignment</span>
                    <div className="studio-button-group">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          className={`studio-group-btn ${(zone.textAlign || 'left') === align ? 'active' : ''}`}
                          onClick={() => onChange({ textAlign: align })}
                        >
                          {align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Scale */}
                  {HAS_REFERENCE.has(zone.type as ZoneType) && (
                    <StudioSlider
                      label="Reference Scale"
                      value={zone.referenceFontScale ?? 42}
                      min={10}
                      max={150}
                      step={1}
                      unit="% of body"
                      onChange={(referenceFontScale) => onChange({ referenceFontScale }, `ref:${zone.id}`)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Appearance & Colors */}
            <div className="studio-section">
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('appearance')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.appearance ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>Appearance & Colors</span>
                </div>
              </button>

              {openSections.appearance && (
                <div className="studio-section-content">
                  {/* Color Tokens */}
                  <div className="studio-field-box">
                    <span className="studio-field-label">Theme Text Color Token</span>
                    <div className="studio-token-grid">
                      {COLOR_TOKENS.map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          className={`studio-token-btn ${zone.color === item.token ? 'active' : ''}`}
                          title={item.hint}
                          onClick={() => onChange({ color: item.token })}
                        >
                          <span className="studio-token-dot" style={{ background: item.dot }} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Hex Color */}
                  <StudioColorPicker
                    label="Custom Text Color"
                    value={/^#[0-9a-f]{6}$/i.test(zone.color || '') ? (zone.color as string) : '#ffffff'}
                    onChange={(color) => onChange({ color }, `color:${zone.id}`)}
                  />

                  {/* Background Fill */}
                  <StudioColorPicker
                    label="Zone Background Fill"
                    value={zone.bgColor || '#000000'}
                    onChange={(bgColor) => onChange({ bgColor }, `bg:${zone.id}`)}
                    onClear={() => onChange({ bgColor: undefined })}
                  />

                  {/* Corner Radius */}
                  <StudioSlider
                    label="Corner Radius"
                    value={zone.borderRadius ?? 0}
                    min={0}
                    max={60}
                    step={1}
                    unit="px"
                    onChange={(borderRadius) => onChange({ borderRadius: borderRadius || undefined }, `radius:${zone.id}`)}
                  />

                  {/* Internal Padding */}
                  <StudioSlider
                    label="Internal Padding"
                    value={zone.padding ?? 0}
                    min={0}
                    max={60}
                    step={1}
                    unit="px"
                    onChange={(padding) => onChange({ padding: padding || undefined }, `padding:${zone.id}`)}
                  />
                </div>
              )}
            </div>

            {/* Section 4: Zone Identity & Config */}
            <div className="studio-section">
              <button
                type="button"
                className="studio-section-header"
                onClick={() => toggleSection('identity')}
              >
                <div className="studio-section-title-wrap">
                  <div className={`studio-section-chevron ${openSections.identity ? 'open' : 'closed'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <span>Zone Type & Details</span>
                </div>
              </button>

              {openSections.identity && (
                <div className="studio-section-content">
                  <div className="studio-field-box">
                    <span className="studio-field-label">Zone Type</span>
                    <select
                      className="studio-select"
                      value={zone.type}
                      onChange={(e) => onChange({ type: e.currentTarget.value as ZoneType })}
                    >
                      {ZONE_TYPES.map((t) => (
                        <option key={t} value={t}>{ZONE_LABELS[t]}</option>
                      ))}
                    </select>
                    <p className="studio-help-text" style={{ marginTop: 2, marginBottom: 0 }}>
                      {ZONE_HINTS[zone.type as ZoneType] || ''}
                    </p>
                  </div>

                  <div className="studio-field-box">
                    <span className="studio-field-label">Custom Zone Label</span>
                    <input
                      type="text"
                      className="studio-input"
                      value={zone.label || ''}
                      placeholder={ZONE_LABELS[zone.type as ZoneType] || zone.type}
                      onChange={(e) => onChange({ label: e.target.value }, `label:${zone.id}`)}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        {activeTab !== 'align' && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button type="button" className="studio-btn-secondary" style={{ flex: 1 }} onClick={onDuplicate}>
              Duplicate Zone
            </button>
            <button type="button" className="studio-btn-danger" style={{ flex: 1 }} onClick={onDelete}>
              Delete Zone
            </button>
          </div>
        )}
      </div>
    )}
  </div>
);

}

function roundForInput(value: number): number {
  return Math.round((Number(value) || 0) * 10) / 10;
}

export default Inspector;
