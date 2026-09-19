import { useState, useEffect, useRef, type ReactNode } from 'react';
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
  onChange,
}: StudioSliderProps) {
  const safeVal = Number.isFinite(value) ? value : min;
  const percentage = Math.max(0, Math.min(100, ((safeVal - min) / (max - min)) * 100));
  const sliderBg = `linear-gradient(to right, #10B981 0%, #10B981 ${percentage}%, var(--studio-track-bg, #272B33) ${percentage}%, var(--studio-track-bg, #272B33) 100%)`;

  return (
    <div className="studio-slider-row">
      <div className="studio-slider-labels">
        <span className="studio-slider-name">{label}</span>
        <span className="studio-slider-value">
          {displayValue ?? `${safeVal}${unit}`}
        </span>
      </div>
      <div className="studio-slider-track-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeVal}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="studio-range-slider"
          style={{ background: sliderBg }}
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

  return (
    <div className="studio-field-box">
      <span className="studio-field-label">{label}</span>
      <div
        className="studio-color-picker-btn"
        onClick={() => !disabled && inputRef.current?.click()}
        style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <div className="studio-color-swatch" style={{ background: safeVal }} />
        <span className="studio-color-hex">{safeVal}</span>
        <input
          ref={inputRef}
          type="color"
          value={safeVal}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
        />
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
  contentMode = 'bible',
}: {
  values: any;
  onChange: (updates: any) => void;
  surface: ThemeSurface;
  contentMode?: 'bible' | 'song';
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

  const handleFontSelect = (fontName: string) => {
    onChange({ fontFamily: fontName });
    try {
      const raw = localStorage.getItem('bsp_recent_fonts');
      const list: string[] = raw ? JSON.parse(raw) : [];
      const updated = [fontName, ...list.filter((f) => f !== fontName)].slice(0, 3);
      localStorage.setItem('bsp_recent_fonts', JSON.stringify(updated));
      setRecentFonts(updated);
    } catch {}
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

  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const isRadial = currentDir === 'radial';
  const numericAngle = parseInt(currentDir.replace('deg', ''), 10) || 135;

  const handleGradientChange = (updates: { start?: string; end?: string; dir?: string }) => {
    const s = updates.start ?? currentStart;
    const e = updates.end ?? currentEnd;
    const d = updates.dir ?? currentDir;
    const gradCss = gradientCss(s, e, d);
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
            fontSize: surface === 'full' ? 54 : 36,
            referenceFontSize: surface === 'full' ? 34 : 24,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.35,
          });
        }}
      >
        {/* Font Family Dropdown with System & Installed Fonts */}
        <div className="studio-field-box">
          <span className="studio-field-label">Font Family</span>
          <select
            className="studio-select"
            value={values.fontFamily || '-apple-system, SF Pro Display, sans-serif'}
            onChange={(e) => handleFontSelect(e.target.value)}
          >
            {/* 1. Recently Used Fonts (Up to 3) */}
            {recentFonts.length > 0 && (
              <optgroup label="── Recently Used ──">
                {recentFonts.map((rf) => (
                  <option key={`recent-${rf}`} value={rf}>
                    {rf}
                  </option>
                ))}
              </optgroup>
            )}

            {/* 2. Bundled & Google Fonts */}
            <optgroup label="── Bundled Fonts ──">
              {(fontOptions.length > 0 ? fontOptions.filter((f) => !f.isSystemFont) : [
                { value: '-apple-system, SF Pro Display, sans-serif', label: 'SF Pro Display' },
                { value: 'Inter, sans-serif', label: 'Inter' },
                { value: 'Poppins, sans-serif', label: 'Poppins' },
                { value: 'Georgia, serif', label: 'Georgia' },
                { value: "'Playfair Display', serif", label: 'Playfair Display' },
                { value: "'Montserrat', sans-serif", label: 'Montserrat' },
                { value: "'Cinzel', serif", label: 'Cinzel' },
                { value: "'Roboto', sans-serif", label: 'Roboto' },
              ]).map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>

            {/* 3. Locally Installed System Fonts */}
            {fontOptions.filter((f) => f.isSystemFont).length > 0 && (
              <optgroup label="── Installed PC Fonts ──">
                {fontOptions
                  .filter((f) => f.isSystemFont)
                  .map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Font Size Slider */}
        <StudioSlider
          label="Font Size"
          value={values.fontSize ?? (surface === 'full' ? 54 : 36)}
          min={16}
          max={120}
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

        {/* Verse / Text Colour */}
        <StudioColorPicker
          label={contentMode === 'song' ? 'Text Colour' : 'Verse Colour'}
          value={values.fontColor || '#ffffff'}
          onChange={(col) => onChange({ fontColor: col })}
        />

        {contentMode === 'bible' && (
          <>
            {/* Reference Size Slider */}
            <StudioSlider
              label="Reference Size"
              value={values.referenceFontSize ?? (surface === 'full' ? 34 : 24)}
              min={12}
              max={60}
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
          </>
        )}

        {surface === 'full' && (
          <StudioSlider
            label="Line Height"
            value={values.lineHeight ?? 1.35}
            min={1.0}
            max={2.4}
            step={0.05}
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

            {/* Live Gradient Color Stops & Spectrum Bar */}
            <div className="studio-field-box">
              <div className="studio-field-label">Color Stops & Spectrum</div>
              <div className="studio-gradient-bar-row">
                {/* Start Color Swatch */}
                <div
                  onClick={() => startInputRef.current?.click()}
                  className="studio-gradient-swatch-chip"
                  style={{
                    background: currentStart.startsWith('#') ? currentStart : '#0f172a',
                  }}
                  title={`Start Color: ${currentStart}`}
                >
                  <input
                    ref={startInputRef}
                    type="color"
                    value={currentStart.startsWith('#') ? currentStart : '#0f172a'}
                    onChange={(e) => handleGradientChange({ start: e.target.value })}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
                  />
                </div>

                {/* Live Gradient Track */}
                <div
                  className="studio-gradient-spectrum-track"
                  style={{
                    background: isRadial
                      ? `radial-gradient(circle, ${currentStart}, ${currentEnd})`
                      : `linear-gradient(to right, ${currentStart}, ${currentEnd})`,
                  }}
                />

                {/* Swap Colors Button */}
                <button
                  type="button"
                  onClick={handleSwapGradient}
                  title="Swap Start & End Colors"
                  className="studio-gradient-swap-btn"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 5h18" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 19H3" />
                  </svg>
                </button>

                {/* End Color Swatch */}
                <div
                  onClick={() => endInputRef.current?.click()}
                  className="studio-gradient-swatch-chip"
                  style={{
                    background: currentEnd.startsWith('#') ? currentEnd : '#312e81',
                  }}
                  title={`End Color: ${currentEnd}`}
                >
                  <input
                    ref={endInputRef}
                    type="color"
                    value={currentEnd.startsWith('#') ? currentEnd : '#312e81'}
                    onChange={(e) => handleGradientChange({ end: e.target.value })}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
                  />
                </div>
              </div>
            </div>

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
              unit="%"
              onChange={(val) => onChange({ width: val })}
            />

            {/* Lower Third Corner Radius Slider */}
            <StudioSlider
              label="Corner Radius"
              value={values.borderRadius ?? 6}
              min={0}
              max={40}
              unit="px"
              onChange={(val) => onChange({ borderRadius: val })}
            />

            {/* Lower Third Padding Slider */}
            <StudioSlider
              label="Inner Padding"
              value={values.padding ?? 20}
              min={0}
              max={60}
              unit="px"
              onChange={(val) => onChange({ padding: val })}
            />

            {/* Banner Position */}
            <div className="studio-field-box">
              <span className="studio-field-label">Position</span>
              <div className="studio-button-group">
                {[
                  { val: 'bottom-center', label: 'Center' },
                  { val: 'bottom-left', label: 'Left' },
                  { val: 'bottom-right', label: 'Right' },
                ].map((pos) => (
                  <button
                    key={pos.val}
                    type="button"
                    className={`studio-group-btn ${(values.position || 'bottom-center') === pos.val ? 'active' : ''}`}
                    onClick={() => onChange({ position: pos.val })}
                  >
                    {pos.label}
                  </button>
                ))}
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
          min={-200}
          max={200}
          unit="px"
          onChange={(val) => onChange({ offsetX: val })}
        />

        <StudioSlider
          label="Offset Y"
          value={values.offsetY ?? 0}
          min={-200}
          max={200}
          unit="px"
          onChange={(val) => onChange({ offsetY: val })}
        />
      </StudioSection>
    </div>
  );
}
