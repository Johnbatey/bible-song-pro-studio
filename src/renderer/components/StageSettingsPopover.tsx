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
import { defaultTheme, type StageTheme } from '../../stage/theme';

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
  /** The control this hangs off, for positioning. */
  anchorRef: RefObject<HTMLElement | null>;
}

const POPOVER_WIDTH = 268;

export function StageSettingsPopover({ theme, onChange, onClose, anchorRef }: StageSettingsPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

  /* Portalled to the body and positioned from the button's own rect. A dock
     panel clips its overflow, and a popover anchored inside the footer is
     clipped with it — which is exactly what happened the first time. */
  const measure = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    setRect({
      top: anchor.top - 8,
      left: Math.max(8, Math.min(anchor.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8)),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    // Capture phase so scrolling any ancestor repositions this too.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Click-away and Escape, the two ways anyone expects a popover to close.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Deferred: the click that opened this must not immediately close it.
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
    wide = false,
  ) => (
    <div style={styles.section}>
      <div style={styles.label}>{label}</div>
      <div style={styles.row}>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ [key]: color } as Partial<StageTheme>)}
            title={color}
            aria-label={`${label} ${color}`}
            style={{
              ...styles.swatch,
              width: wide ? 34 : 22,
              background: color,
              borderColor: current.toLowerCase() === color.toLowerCase() ? '#fff' : 'rgba(255,255,255,0.18)',
              boxShadow: current.toLowerCase() === color.toLowerCase() ? '0 0 0 2px rgba(255,255,255,0.35)' : 'none',
            }}
          />
        ))}
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#000000'}
          onChange={(e) => onChange({ [key]: e.currentTarget.value } as Partial<StageTheme>)}
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
      aria-label="Stage display settings"
    >
      <div style={styles.title}>Stage Display</div>

      {swatchRow('Accent', ACCENTS, theme.accent, 'accent')}
      {swatchRow('Background', BACKGROUNDS, theme.background, 'background', true)}
      {swatchRow('Text', TEXTS, theme.text, 'text')}

      <div style={styles.section}>
        <div style={styles.label}>Font scale</div>
        <div style={styles.row}>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={theme.fontScale}
            onChange={(e) => onChange({ fontScale: Number(e.currentTarget.value) })}
            style={{ flex: 1, accentColor: theme.accent }}
            title="Stage font scale"
          />
          <span style={styles.scaleValue}>{Math.round(theme.fontScale * 100)}%</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Show</div>
        <div style={styles.row}>
          {TOGGLES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ [key]: !theme[key] } as Partial<StageTheme>)}
              style={{
                ...styles.chip,
                background: theme[key] ? 'rgba(244,98,31,0.18)' : 'transparent',
                borderColor: theme[key] ? 'var(--accent, #f4621f)' : 'var(--block-line, rgba(255,255,255,0.14))',
                color: theme[key] ? '#fff' : 'var(--text-dim, rgba(255,255,255,0.55))',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => onChange(defaultTheme())} style={styles.reset}>
        Reset to defaults
      </button>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  popover: {
    position: 'fixed',
    transform: 'translateY(-100%)',
    zIndex: 1500,
    width: POPOVER_WIDTH,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    borderRadius: 12,
    background: 'var(--chrome-raised, #1c1e26)',
    border: '1px solid var(--block-line, rgba(255,255,255,0.14))',
    boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
  },
  title: { fontSize: 12, fontWeight: fontWeight.bold, color: '#fff' },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-dim, rgba(255,255,255,0.5))',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  swatch: {
    height: 22,
    borderRadius: 6,
    border: '1px solid',
    cursor: 'pointer',
    padding: 0,
  },
  nativeColor: {
    width: 26,
    height: 22,
    padding: 0,
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 6,
    background: 'none',
    cursor: 'pointer',
  },
  scaleValue: {
    width: 38,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
  },
  chip: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid',
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    cursor: 'pointer',
  },
  reset: {
    alignSelf: 'flex-start',
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--block-line, rgba(255,255,255,0.14))',
    background: 'transparent',
    color: 'var(--text-dim, rgba(255,255,255,0.55))',
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    cursor: 'pointer',
  },
};

export default StageSettingsPopover;
