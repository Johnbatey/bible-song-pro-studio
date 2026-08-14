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

const CHOICES: { id: Choice; label: string }[] = [
  { id: 'theme', label: 'Theme' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'solid', label: 'Colour' },
  { id: 'gradient', label: 'Gradient' },
];

interface BackgroundPickerProps {
  value: Background | undefined;
  /** `undefined` means "no background of its own" — fall through to the theme. */
  onChange: (next: Background | undefined) => void;
}

export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const choice: Choice = value?.type === 'transparent' ? 'theme' : (value?.type ?? 'theme');
  const info = parseBackgroundInfo(value?.gradient, value?.color);

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
      /* Media needs a file before it means anything, and there is no sensible
         default file to guess. The type is staged and the grid below asks. */
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
      /* Server-relative, the same rule the Media panel follows when it takes a
         clip: an absolute url pins this to whatever port the server held the
         day it was chosen. */
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Wraps rather than clips: this panel is a dock an operator can drag
          down to 180px, and five segments on one line lose the last of them. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: '#202024', borderRadius: 6, padding: 2 }}>
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChoice(c.id)}
            style={{
              flex: '1 1 auto',
              minWidth: 54,
              padding: '4px 6px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: choice === c.id ? 'var(--accent)' : 'transparent',
              color: choice === c.id ? '#fff' : 'var(--text-secondary)',
              ...typeStyles.label,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {choice === 'theme' && (
        <div style={{ ...typeStyles.caption, color: 'var(--text-dim)' }}>
          Follows the active theme, the same as Scripture does.
        </div>
      )}

      {(choice === 'image' || choice === 'video') && (
        <>
          <MediaGrid kind={choice} selectedUrl={value?.mediaUrl || ''} onSelect={pickMedia} />
          {choice === 'video' && value?.mediaUrl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...typeStyles.caption, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={value?.loop !== false}
                onChange={(e) => onChange({ ...value, loop: e.target.checked })}
              />
              Loop
            </label>
          )}
        </>
      )}

      {choice === 'solid' && (
        <input
          className="input"
          type="color"
          value={(value?.color || DEFAULT_GROUND).startsWith('#') ? (value?.color || DEFAULT_GROUND) : DEFAULT_GROUND}
          onChange={(e) => onChange({ type: 'solid', color: e.target.value })}
          style={{ height: 34, padding: 2, width: '100%' }}
        />
      )}

      {choice === 'gradient' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...typeStyles.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Start</label>
            <input
              className="input"
              type="color"
              value={info.start.startsWith('#') ? info.start : DEFAULT_GRADIENT_START}
              onChange={(e) => setGradient({ start: e.target.value })}
              style={{ height: 32, padding: 2, width: '100%' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...typeStyles.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>End</label>
            <input
              className="input"
              type="color"
              value={info.end.startsWith('#') ? info.end : DEFAULT_GRADIENT_END}
              onChange={(e) => setGradient({ end: e.target.value })}
              style={{ height: 32, padding: 2, width: '100%' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...typeStyles.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Direction</label>
            <select className="input" value={info.dir} onChange={(e) => setGradient({ dir: e.target.value })}>
              <option value="135deg">Diagonal</option>
              <option value="180deg">Top to bottom</option>
              <option value="90deg">Left to right</option>
              <option value="45deg">Reverse diagonal</option>
              <option value="radial">Radial</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
