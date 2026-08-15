/* =========================================================================
   <LayerList> — the slide's stack, topmost first
   -------------------------------------------------------------------------
   One presentation for both deck kinds. The PowerPoint side feeds it layer
   units from the parsed shapes; the native side feeds it the slide's elements
   sorted by z-index. Either way a row is one thing the operator can select,
   drag to restack, lock, or remove.

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
  locked?: boolean;
}

export interface LayerListProps {
  /** Topmost first. */
  rows: LayerRow[];
  onSelect: (id: string, additive: boolean) => void;
  /** Both indices are into `rows`; the dragged row lands at `to`. */
  onReorder: (from: number, to: number) => void;
  onDuplicateLayer?: (from: number, to: number) => void;
  onDelete?: (id: string) => void;
  onToggleLock?: (id: string) => void;
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

export function LockedIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function UnlockedIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

export function LayerList({ rows, onSelect, onReorder, onDuplicateLayer, onDelete, onToggleLock, emptyHint }: LayerListProps) {
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
            draggable={!row.locked}
            onDragStart={(e) => {
              if (row.locked) {
                e.preventDefault();
                return;
              }
              setDragIndex(index);
              e.dataTransfer.effectAllowed = e.altKey ? 'copy' : 'move';
              e.dataTransfer.setData('text/plain', row.id);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
              setOverIndex(index);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) {
                if (e.altKey && onDuplicateLayer) {
                  onDuplicateLayer(dragIndex, index);
                } else if (dragIndex !== index) {
                  onReorder(dragIndex, index);
                }
              }
              endDrag();
            }}
            onMouseDown={(e) => onSelect(row.id, e.shiftKey || e.metaKey)}
            style={{
              ...styles.row,
              background: row.selected ? 'rgba(244,98,31,0.18)' : 'transparent',
              borderColor: isDropTarget
                ? '#FF5500'
                : row.selected
                ? 'rgba(244,98,31,0.55)'
                : 'rgba(255,255,255,0.07)',
              opacity: dragging ? 0.4 : 1,
            }}
            title={row.label + (row.locked ? ' (Locked)' : '')}
          >
            <span style={styles.grip}>⠿</span>
            <span style={styles.glyph}>{GLYPH[row.kind] || '◆'}</span>
            <span style={styles.label}>{row.label}</span>

            {/* Lock / Unlock Toggle Button */}
            {onToggleLock && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(row.id);
                }}
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  background: row.locked ? 'rgba(255, 85, 0, 0.2)' : 'transparent',
                  border: row.locked ? '1px solid rgba(255, 85, 0, 0.4)' : 'none',
                  borderRadius: 4,
                  color: row.locked ? '#FF5500' : 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={row.locked ? 'Unlock layer' : 'Lock layer — stops canvas selection/movement'}
              >
                {row.locked ? <LockedIcon size={12} /> : <UnlockedIcon size={12} />}
              </button>
            )}

            {/* Remove Button */}
            {onDelete && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row.id);
                }}
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
