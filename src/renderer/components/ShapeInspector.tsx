/* =========================================================================
   <ShapeInspector> — fill, outline, text colour, order and delete
   -------------------------------------------------------------------------
   Acts on the current selection. Only the controls that apply to what is
   selected are shown: a picture has no fill, a connector has no text, and
   offering either would be a control that silently does nothing.
   ========================================================================= */
import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';

export interface ShapeInspectorProps {
  selected: ParsedShape[];
  onFill: (hex: string) => void;
  onStroke: (hex: string, widthPx?: number | null) => void;
  onTextColor: (hex: string) => void;
  onReorder: (toFront: boolean) => void;
  onDelete: () => void;
}

const FILLABLE = new Set(['shape', 'text']);
const STROKEABLE = new Set(['shape', 'text', 'connector', 'imagefill']);

/** A colour input needs #rrggbb; anything else (a theme name, rgba, null)
    would silently reset the swatch to black. */
function toSwatch(value: unknown, fallback: string): string {
  const s = String(value || '');
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

export function ShapeInspector({
  selected,
  onFill,
  onStroke,
  onTextColor,
  onReorder,
  onDelete,
}: ShapeInspectorProps) {
  const canFill = selected.some((s) => FILLABLE.has(s.kind));
  const canStroke = selected.some((s) => STROKEABLE.has(s.kind));
  const textShapes = selected.filter((s) => s.kind === 'text');

  const firstFill = toSwatch(selected.find((s) => s.fillColor)?.fillColor, '#3b82f6');
  const firstStroke = toSwatch(selected.find((s) => s.strokeColor)?.strokeColor, '#111827');
  const firstRunColor = toSwatch(
    textShapes[0]?.paragraphs?.[0]?.find((r) => r.color)?.color,
    '#111827',
  );
  const strokeWidth = Math.max(1, Math.round((selected.find((s) => s.strokeWidthPx)?.strokeWidthPx as number) || 1));

  const handleStrokeWidth = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const px = Math.max(0, Number(e.target.value) || 0);
    onStroke(firstStroke, px);
  }, [firstStroke, onStroke]);

  if (selected.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.head}>Shape</div>
        <div style={styles.hint}>Select a shape on the slide to restyle it.</div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.head}>
        {selected.length === 1 ? (selected[0].name as string) || selected[0].kind : `${selected.length} shapes`}
      </div>

      {canFill && (
        <label style={styles.row}>
          <span style={styles.label}>Fill</span>
          <input type="color" value={firstFill} onChange={(e) => onFill(e.target.value)} style={styles.color} />
        </label>
      )}

      {canStroke && (
        <>
          <label style={styles.row}>
            <span style={styles.label}>Outline</span>
            <input type="color" value={firstStroke} onChange={(e) => onStroke(e.target.value)} style={styles.color} />
          </label>
          <label style={styles.row}>
            <span style={styles.label}>Width</span>
            <input
              type="number"
              min={0}
              max={64}
              value={strokeWidth}
              onChange={handleStrokeWidth}
              style={styles.number}
            />
          </label>
        </>
      )}

      {textShapes.length > 0 && (
        <label style={styles.row}>
          <span style={styles.label}>Text</span>
          <input type="color" value={firstRunColor} onChange={(e) => onTextColor(e.target.value)} style={styles.color} />
        </label>
      )}

      <div style={styles.buttons}>
        <button style={styles.button} onClick={() => onReorder(true)}>Bring to front</button>
        <button style={styles.button} onClick={() => onReorder(false)}>Send to back</button>
      </div>
      <button style={{ ...styles.button, ...styles.danger }} onClick={onDelete}>
        Remove from slide
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 12,
    marginBottom: 4,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  head: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  color: {
    width: 44,
    height: 26,
    padding: 0,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    cursor: 'pointer',
  },
  number: {
    width: 60,
    height: 26,
    background: '#16191f',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    color: '#fff',
    fontSize: 12,
    padding: '0 6px',
    outline: 'none',
  },
  buttons: { display: 'flex', gap: 6 },
  button: {
    flex: 1,
    height: 28,
    background: '#1c2029',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5,
    color: '#fff',
    fontSize: 11,
    cursor: 'pointer',
  },
  danger: { flex: 'none', color: '#f87171' },
};

export default ShapeInspector;
