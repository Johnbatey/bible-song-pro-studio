/* =========================================================================
   <LayerList> — the slide's stack, topmost first
   -------------------------------------------------------------------------
   One presentation for both deck kinds. The PowerPoint side feeds it layer
   units from the parsed shapes; the native side feeds it the slide's elements
   sorted by z-index. Either way a row is one thing the operator can select,
   drag to restack, or remove.

   Rows are given topmost-first, the way every layer panel reads, and the drop
   index is in that same space — the callers own the translation back to paint
   order, which is where it belongs.
   ========================================================================= */
import { useState } from 'react';
import type { CSSProperties } from 'react';

export interface LayerRow {
  id: string;
  label: string;
  /** 'group', 'text', 'shape', 'image', … — drives the leading glyph. */
  kind: string;
  selected: boolean;
}

export interface LayerListProps {
  /** Topmost first. */
  rows: LayerRow[];
  onSelect: (id: string, additive: boolean) => void;
  /** Both indices are into `rows`; the dragged row lands at `to`. */
  onReorder: (from: number, to: number) => void;
  onDelete?: (id: string) => void;
  emptyHint: string;
}

const GLYPH: Record<string, string> = {
  group: '▣',
  text: 'T',
  shape: '◆',
  image: '▤',
  imagefill: '▤',
  connector: '⟋',
  table: '▦',
};

export function LayerList({ rows, onSelect, onReorder, onDelete, emptyHint }: LayerListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (rows.length === 0) {
    return <div style={styles.empty}>{emptyHint}</div>;
  }

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div style={styles.list} onDragEnd={endDrag}>
      {rows.map((row, index) => {
        const dragging = dragIndex === index;
        const isDropTarget = dragIndex !== null && overIndex === index && !dragging;
        return (
          <div
            key={row.id}
            draggable
            onDragStart={(e) => {
              setDragIndex(index);
              /* Firefox will not start a drag without payload, and the row
                 order is all this drag actually carries. */
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', row.id);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOverIndex(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
              endDrag();
            }}
            onMouseDown={(e) => onSelect(row.id, e.shiftKey || e.metaKey)}
            style={{
              ...styles.row,
              background: row.selected ? 'rgba(244,98,31,0.18)' : 'transparent',
              borderColor: isDropTarget
                ? '#f4621f'
                : row.selected
                ? 'rgba(244,98,31,0.55)'
                : 'rgba(255,255,255,0.07)',
              opacity: dragging ? 0.4 : 1,
            }}
            title={row.label}
          >
            <span style={styles.grip}>⠿</span>
            <span style={styles.glyph}>{GLYPH[row.kind] || '◆'}</span>
            <span style={styles.label}>{row.label}</span>
            {onDelete && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onDelete(row.id)}
                style={styles.remove}
                title="Remove from slide"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 3 },
  empty: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '5px 6px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 5,
    cursor: 'grab',
    userSelect: 'none',
  },
  grip: { fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'grab' },
  glyph: {
    width: 15,
    flexShrink: 0,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  remove: {
    flexShrink: 0,
    width: 18,
    height: 18,
    padding: 0,
    background: 'transparent',
    border: 'none',
    borderRadius: 3,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    lineHeight: 1,
    cursor: 'pointer',
  },
};

export default LayerList;
