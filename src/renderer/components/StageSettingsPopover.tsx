/* =========================================================================
   <StageSettingsPopover> — the stage's appearance, from the operator's desk
   -------------------------------------------------------------------------
   Accent, background, text colour, font scale and the show/hide toggles.

   These used to be an overlay on the stage screen itself, opened with a
   keypress on the stage machine. That is the wrong end of the room: the person
   who wants a bigger font is at the desk, and the screen they are adjusting is
   across the hall. The controls moved here; the overlay is gone.
   ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, RefObject } from 'react';
import { fontWeight } from '../styles/type';
import { defaultTheme, persistTheme, type StageTheme } from '../../stage/theme';

const ACCENTS = ['#fbbf24', '#0a84ff', '#30d158', '#ff453a', '#bf5af2', '#ff9f0a'];
const BACKGROUNDS = ['#000000', '#05070d', '#0a0a0a', '#0d1b2a', '#1a1a1a'];
const TEXTS = ['#ffffff', '#f5f5f7', '#fbbf24', '#a1a1aa'];

const TOGGLES: Array<{ key: 'showClock' | 'showTimer' | 'showLabels'; label: string }> = [
  { key: 'showClock', label: 'Clock' },
  { key: 'showTimer', label: 'Timer' },
  { key: 'showLabels', label: 'Labels' },
];

export interface StageSettingsPopoverProps {
  theme: StageTheme;
  onChange: (patch: Partial<StageTheme>) => void;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

const POPOVER_WIDTH = 270;

export function StageSettingsPopover({ theme, onChange, onClose, anchorRef }: StageSettingsPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

  const handlePatch = (patch: Partial<StageTheme>) => {
    const next = { ...theme, ...patch };
    persistTheme(next);
    onChange(patch);
  };

  const measure = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const estimatedHeight = 360;
    const computedTop = anchor.top - estimatedHeight - 8;
    const safeTop = Math.max(12, Math.min(computedTop, window.innerHeight - estimatedHeight - 12));
    const safeLeft = Math.max(12, Math.min(anchor.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 12));
    setRect({ top: safeTop, left: safeLeft });
  }, [anchorRef]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const swatchRow = (
    label: string,
    colors: string[],
    current: string,
    key: 'accent' | 'background' | 'text',
  ) => (
    <div style={styles.section}>
      <div style={styles.label}>{label}</div>
      <div style={styles.row}>
        {colors.map((color) => {
          const isSelected = current.toLowerCase() === color.toLowerCase();
          const isLight = color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fbbf24' || color.toLowerCase() === '#f5f5f7';
          return (
            <button
              key={color}
              type="button"
              onClick={() => handlePatch({ [key]: color } as Partial<StageTheme>)}
              title={color}
              aria-label={`${label} ${color}`}
              style={{
                ...styles.swatch,
                background: color,
                borderColor: isSelected ? '#FF5500' : 'rgba(255,255,255,0.18)',
                boxShadow: isSelected ? '0 0 0 2px rgba(255,85,0,0.5)' : 'none',
              }}
            >
              {isSelected && (
                <span
                  style={{
                    color: isLight ? '#000000' : '#ffffff',
                    fontSize: 10,
                    fontWeight: 'bold',
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#000000'}
          onChange={(e) => handlePatch({ [key]: e.currentTarget.value } as Partial<StageTheme>)}
          style={styles.nativeColor}
          title={`Custom ${label.toLowerCase()}`}
        />
      </div>
    </div>
  );

  if (!rect) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ ...styles.popover, top: rect.top, left: rect.left }}
      role="dialog"
      aria-label="Stage display appearance"
    >
      {/* Fixed Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={styles.title}>Stage Style</span>
        </div>
        <button type="button" onClick={onClose} style={styles.closeBtn} title="Close">
          ✕
        </button>
      </div>

      {/* Scrollable Body */}
      <div style={styles.scrollBody}>
        {swatchRow('Accent', ACCENTS, theme.accent, 'accent')}
        {swatchRow('Background', BACKGROUNDS, theme.background, 'background')}
        {swatchRow('Text', TEXTS, theme.text, 'text')}

        {/* Font Scale */}
        <div style={styles.section}>
          <div style={styles.label}>Font Scale</div>
          <div style={styles.row}>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={theme.fontScale}
              onChange={(e) => handlePatch({ fontScale: Number(e.currentTarget.value) })}
              style={{ width: 64, height: 4, accentColor: 'rgba(255, 255, 255, 0.85)', cursor: 'pointer' }}
              title="Stage font scale"
            />
            <span style={styles.scaleValue}>{Math.round(theme.fontScale * 100)}%</span>
          </div>
        </div>

        {/* Display Elements Segmented Chips */}
        <div style={styles.section}>
          <div style={styles.label}>Display Elements</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {TOGGLES.map(({ key, label }) => {
              const active = Boolean(theme[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePatch({ [key]: !theme[key] } as Partial<StageTheme>)}
                  style={{
                    ...styles.chip,
                    background: active ? 'rgba(255, 85, 0, 0.18)' : '#141416',
                    borderColor: active ? '#FF5500' : 'rgba(255, 255, 255, 0.12)',
                    color: active ? '#ffffff' : '#a1a1aa',
                  }}
                >
                  {label} {active ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div style={styles.section}>
          <div style={styles.shortcutBox}>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>
              <strong style={{ color: '#ffffff' }}>L</strong> Layout Picker  •  <strong style={{ color: '#ffffff' }}>Esc</strong> Clear Message
            </span>
          </div>
        </div>

        {/* Reset Theme Button */}
        <button type="button" onClick={() => handlePatch(defaultTheme())} style={styles.reset}>
          Reset Theme
        </button>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  popover: {
    position: 'fixed',
    zIndex: 1500,
    width: POPOVER_WIDTH,
    maxHeight: 'min(400px, calc(100vh - 80px))',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 8,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  header: {
    flex: '0 0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--chrome-control)',
  },
  title: { fontSize: 13, fontWeight: fontWeight.bold, color: 'var(--text-primary)' },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '2px 4px',
  },
  scrollBody: {
    flex: '1 1 auto',
    overflowY: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '1px solid',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  nativeColor: {
    width: 22,
    height: 22,
    padding: 0,
    border: '1px solid var(--border-primary)',
    borderRadius: '50%',
    background: 'none',
    cursor: 'pointer',
  },
  scaleValue: {
    minWidth: 32,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  chip: {
    flex: 1,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  shortcutBox: {
    padding: '6px 8px',
    borderRadius: 6,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    textAlign: 'center',
  },
  reset: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-primary)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
};

export default StageSettingsPopover;
