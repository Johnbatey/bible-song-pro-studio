import { useState, type ReactNode } from 'react';
import { type } from '../styles/type';
import { AppleToggle } from './AppleToggle';
import { MediaGrid } from './MediaGrid';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { assetUrl } from '../utils/asset-url';
import { gradientCss, parseBackgroundInfo } from '../utils/background';

export type ThemeSurface = 'full' | 'lt';

const SECTION_HINTS = {
  text: {
    full: 'Typeface, size and colour for the verse on a full screen.',
    lt: 'Typeface, size and colour for the verse on the banner.',
  },
  shadow: {
    full: 'Lift the text off a busy still or clip.',
    lt: 'Lift the text off the banner fill.',
  },
  background: {
    full: 'What fills the whole 16:9 stage.',
    lt: 'What fills the banner only. The rest of the screen stays transparent.',
  },
  placement: {
    full: 'Nudge the verse on the stage.',
    lt: 'Width, corners and position of the banner.',
  },
} as const;

function FormSection({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>
          <span className="section-title" style={{ marginBottom: 2 }}>{title}</span>
          <span style={{ ...type.caption, color: 'var(--text-dim)', display: 'block' }}>{hint}</span>
        </span>
        <span
          aria-hidden
          style={{
            ...type.caption,
            color: 'var(--text-dim)',
            width: 22,
            height: 22,
            borderRadius: 11,
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>
      {children}
    </label>
  );
}

/**
 * One surface of a theme — full screen or lower third — grouped so an operator
 * can find type, shadow, fill and placement without scrolling two copies of
 * the same wall of controls.
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
  const [open, setOpen] = useState({
    text: true,
    shadow: false,
    background: true,
    placement: surface === 'lt',
  });

  const toggle = (key: keyof typeof open) => {
    setOpen((current) => ({ ...current, [key]: !current[key] }));
  };

  const safeInt = (val: string, fallback = 0) => {
    if (val === '' || val === undefined || val === null) return 0;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const bgInfo = parseBackgroundInfo(values.background, values.backgroundColor);
  const currentBgType = values.backgroundMediaUrl && values.backgroundMediaType
    ? values.backgroundMediaType
    : values.backgroundType || bgInfo.type;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FormSection
        title="Text"
        hint={SECTION_HINTS.text[surface]}
        open={open.text}
        onToggle={() => toggle('text')}
      >
        <div>
          <FieldLabel>Font family</FieldLabel>
          <select
            className="input"
            value={values.fontFamily || ''}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
          >
            <option value="-apple-system, SF Pro Display, sans-serif">SF Pro Display</option>
            <option value="Inter, sans-serif">Inter</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Playfair Display', serif">Playfair Display</option>
            <option value="'Montserrat', sans-serif">Montserrat</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Size</FieldLabel>
            <input
              className="input"
              type="number"
              value={values.fontSize === 0 ? '' : (values.fontSize ?? '')}
              onChange={(e) => onChange({ fontSize: safeInt(e.target.value, 32) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Weight</FieldLabel>
            <select
              className="input"
              value={values.fontWeight || 400}
              onChange={(e) => onChange({ fontWeight: safeInt(e.target.value, 400) })}
            >
              <option value="300">Light (300)</option>
              <option value="400">Regular (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">Semi-Bold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">Extra Bold (800)</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Verse colour</FieldLabel>
            <input
              className="input"
              type="color"
              value={values.fontColor || '#ffffff'}
              onChange={(e) => onChange({ fontColor: e.target.value })}
              style={{ height: 34, padding: 2 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Alignment</FieldLabel>
            <select
              className="input"
              value={values.textAlign || 'center'}
              onChange={(e) => onChange({ textAlign: e.target.value })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Reference size</FieldLabel>
            <input
              className="input"
              type="number"
              value={values.referenceFontSize === 0 ? '' : (values.referenceFontSize ?? '')}
              onChange={(e) => onChange({ referenceFontSize: safeInt(e.target.value, 26) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Animation</FieldLabel>
            <select
              className="input"
              value={values.animation || 'fadeIn'}
              onChange={(e) => onChange({ animation: e.target.value })}
            >
              <option value="fadeIn">Fade In</option>
              <option value="slideInLeft">Slide Left</option>
              <option value="slideInRight">Slide Right</option>
              <option value="slideInUp">Slide Up</option>
              <option value="slideInDown">Slide Down</option>
              <option value="zoomIn">Zoom In</option>
              <option value="scaleIn">Scale In</option>
              <option value="flipIn">Flip In</option>
              {(values.animation === 'bounceIn' || values.animation === 'elasticIn') && (
                <option value={values.animation}>
                  {values.animation === 'bounceIn' ? 'Bounce In' : 'Elastic In'} (retired)
                </option>
              )}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Reference colour</FieldLabel>
            <input
              className="input"
              type="color"
              disabled={Boolean(values.syncRefColor)}
              value={values.syncRefColor ? (values.fontColor || '#ffffff') : (values.referenceColor || values.savedRefColor || values.accentColor || '#C9A96E')}
              onChange={(e) => onChange({ referenceColor: e.target.value, savedRefColor: e.target.value, syncRefColor: false })}
              style={{ height: 34, padding: 2, opacity: values.syncRefColor ? 0.4 : 1, cursor: values.syncRefColor ? 'not-allowed' : 'pointer' }}
            />
          </div>
          <div style={{ flex: 1, paddingBottom: 6 }}>
            <AppleToggle
              label="Match verse colour"
              checked={Boolean(values.syncRefColor)}
              onChange={(checked) => {
                const rememberedRefColor = values.referenceColor && values.referenceColor !== values.fontColor
                  ? values.referenceColor
                  : (values.savedRefColor || values.accentColor || '#FFCF66');
                onChange({
                  syncRefColor: checked,
                  savedRefColor: rememberedRefColor,
                  referenceColor: checked ? (values.fontColor || '#ffffff') : rememberedRefColor,
                });
              }}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Shadow"
        hint={SECTION_HINTS.shadow[surface]}
        open={open.shadow}
        onToggle={() => toggle('shadow')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...type.label, color: 'var(--text-dim)', fontWeight: 600 }}>Drop shadow</span>
          <AppleToggle
            label="On"
            checked={Boolean(values.textShadowEnabled)}
            onChange={(checked) => onChange({ textShadowEnabled: checked })}
          />
        </div>
        {values.textShadowEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Level</FieldLabel>
                <select
                  className="input"
                  value={values.textShadowLevel || 'medium'}
                  onChange={(e) => {
                    const lvl = e.target.value;
                    const blur = lvl === 'heavy' ? 16 : lvl === 'subtle' ? 4 : 8;
                    onChange({ textShadowLevel: lvl, textShadowBlur: blur });
                  }}
                >
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Colour</FieldLabel>
                <input
                  className="input"
                  type="color"
                  value={values.textShadowColor || '#000000'}
                  onChange={(e) => onChange({ textShadowColor: e.target.value })}
                  style={{ height: 34, padding: 2 }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <FieldLabel>Blur</FieldLabel>
                <span style={{ ...type.caption, color: 'var(--text-dim)' }}>{values.textShadowBlur ?? 8}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={values.textShadowBlur ?? 8}
                onChange={(e) => onChange({ textShadowBlur: safeInt(e.target.value, 8) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Background"
        hint={SECTION_HINTS.background[surface]}
        open={open.background}
        onToggle={() => toggle('background')}
      >
        <div
          style={{
            height: 72,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            background: values.background || values.backgroundColor || '#0c0e14',
            backgroundImage: previewMedia && currentBgType === 'image'
              ? `url("${previewMedia.replace(/"/g, '%22')}")`
              : undefined,
            backgroundSize: values.backgroundFit || 'cover',
            backgroundPosition: 'center',
            opacity: currentOpacity,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {previewMedia && currentBgType === 'video' && (
            <video
              src={previewMedia}
              muted
              playsInline
              preload="metadata"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: values.backgroundFit || 'cover' }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>
            {currentBgType === 'image' ? (previewMedia ? 'Image selected' : 'Choose an image')
              : currentBgType === 'video' ? (previewMedia ? 'Video selected' : 'Choose a video')
              : currentBgType === 'gradient' ? 'Gradient'
              : currentBgType === 'transparent' ? 'Transparent'
              : 'Solid colour'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Fill</FieldLabel>
            <select
              className="input"
              value={currentBgType}
              onChange={(e) => handleBgTypeChange(e.target.value)}
            >
              <option value="solid">Solid colour</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="transparent">Transparent</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Opacity ({Math.round(currentOpacity * 100)}%)</FieldLabel>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={currentOpacity}
              onChange={(e) => onChange({ backgroundOpacity: parseFloat(e.target.value) })}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
        </div>

        {(currentBgType === 'image' || currentBgType === 'video') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MediaGrid
              kind={currentBgType}
              selectedUrl={values.backgroundMediaUrl || ''}
              onSelect={(item) => onChange({
                backgroundMediaUrl: item.url,
                backgroundMediaType: item.type,
                backgroundFit: values.backgroundFit || 'cover',
              })}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Fit</FieldLabel>
                <select
                  className="input"
                  value={values.backgroundFit || 'cover'}
                  onChange={(e) => onChange({ backgroundFit: e.target.value })}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Stretch</option>
                </select>
              </div>
              {currentBgType === 'video' && (
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, ...type.caption, color: 'var(--text-secondary)', paddingBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={values.backgroundLoop !== false}
                    onChange={(e) => onChange({ backgroundLoop: e.target.checked })}
                  />
                  Loop
                </label>
              )}
            </div>
          </div>
        )}

        {currentBgType === 'solid' && (
          <div>
            <FieldLabel>Colour</FieldLabel>
            <input
              className="input"
              type="color"
              value={currentSolid.startsWith('#') ? currentSolid : '#0c0e14'}
              onChange={(e) => onChange({ backgroundColor: e.target.value, background: e.target.value })}
              style={{ height: 34, padding: 2, width: '100%' }}
            />
          </div>
        )}

        {currentBgType === 'gradient' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <FieldLabel>Presets</FieldLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {[
                  { name: 'Sapphire', start: '#0f172a', end: '#312e81', dir: '135deg' },
                  { name: 'Purple', start: '#1a0033', end: '#7b1fa2', dir: '135deg' },
                  { name: 'Emerald', start: '#001a0a', end: '#178e4c', dir: '135deg' },
                  { name: 'Crimson', start: '#1b0000', end: '#e65100', dir: '135deg' },
                  { name: 'Gold', start: '#1a140a', end: '#c9a96e', dir: '135deg' },
                  { name: 'Midnight', start: '#070913', end: '#0f172a', dir: '180deg' },
                ].map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 10, padding: '3px 6px', background: `linear-gradient(${p.dir}, ${p.start}, ${p.end})`, color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                    onClick={() => handleGradientChange({ start: p.start, end: p.end, dir: p.dir })}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Start</FieldLabel>
                <input
                  className="input"
                  type="color"
                  value={currentStart.startsWith('#') ? currentStart : '#0f172a'}
                  onChange={(e) => handleGradientChange({ start: e.target.value })}
                  style={{ height: 32, padding: 2 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>End</FieldLabel>
                <input
                  className="input"
                  type="color"
                  value={currentEnd.startsWith('#') ? currentEnd : '#312e81'}
                  onChange={(e) => handleGradientChange({ end: e.target.value })}
                  style={{ height: 32, padding: 2 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Direction</FieldLabel>
                <select
                  className="input"
                  value={currentDir}
                  onChange={(e) => handleGradientChange({ dir: e.target.value })}
                >
                  <option value="135deg">Diagonal</option>
                  <option value="180deg">Top → bottom</option>
                  <option value="90deg">Left → right</option>
                  <option value="45deg">Reverse diagonal</option>
                  <option value="radial">Radial</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Placement"
        hint={SECTION_HINTS.placement[surface]}
        open={open.placement}
        onToggle={() => toggle('placement')}
      >
        {surface === 'lt' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Width %</FieldLabel>
              <input
                className="input"
                type="number"
                max="100"
                value={values.width === 0 ? '' : (values.width ?? '')}
                onChange={(e) => onChange({ width: safeInt(e.target.value, 75) })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Corner radius</FieldLabel>
              <input
                className="input"
                type="number"
                value={values.borderRadius === 0 ? '' : (values.borderRadius ?? '')}
                onChange={(e) => onChange({ borderRadius: safeInt(e.target.value, 0) })}
              />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Offset X (px)</FieldLabel>
            <input
              className="input"
              type="number"
              value={values.offsetX === 0 ? '' : (values.offsetX ?? '')}
              onChange={(e) => onChange({ offsetX: safeInt(e.target.value, 0) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Offset Y (px)</FieldLabel>
            <input
              className="input"
              type="number"
              value={values.offsetY === 0 ? '' : (values.offsetY ?? '')}
              onChange={(e) => onChange({ offsetY: safeInt(e.target.value, 0) })}
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}
