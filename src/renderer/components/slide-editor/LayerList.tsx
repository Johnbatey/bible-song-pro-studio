/* =========================================================================
   <LayerList> — the slide's stack, topmost first
   -------------------------------------------------------------------------
   One presentation for both deck kinds. The PowerPoint side feeds it layer
   units from the parsed shapes; the native side feeds it the slide's elements
   sorted by z-index. Either way a row is one thing the operator can select,
   drag to restack, lock, hide, or remove.

   Rows are given topmost-first, the way every layer panel reads, and the drop
   index is in that same space — the callers own the translation back to paint
   order, which is where it belongs.
   ========================================================================= */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import { IconGrip, IconX, LayerKindIcon } from './SlideEditorIcons';

export interface LayerRow {
  id: string;
  label: string;
  kind: string;
  selected: boolean;
  locked?: boolean;
  hidden?: boolean;
}

export interface LayerListProps {
  rows: LayerRow[];
  onSelect: (id: string, additive: boolean) => void;
  onReorder: (from: number, to: number) => void;
  onDuplicateLayer?: (from: number, to: number) => void;
  onDelete?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onToggleVisible?: (id: string) => void;
  emptyHint: string;
}

export function EyeIcon({ size = 13 }: { size?: number }) {
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ size = 13 }: { size?: number }) {
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
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

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

export function LayerList({
  rows,
  onSelect,
  onReorder,
  onDuplicateLayer,
  onDelete,
  onToggleLock,
  onToggleVisible,
  emptyHint,
}: LayerListProps) {
  const { t } = useI18n();
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
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              onSelect(row.id, e.shiftKey || e.metaKey || e.ctrlKey);
            }}
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
            title={
              row.label
              + (row.locked ? t('slideEditor.layer.lockedSuffix') : '')
              + (row.hidden ? t('slideEditor.layer.hiddenSuffix') : '')
            }
          >
            <button
              type="button"
              className="layer-item-vis-btn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleVisible) onToggleVisible(row.id);
              }}
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: row.hidden ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.65)',
                cursor: onToggleVisible ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
              title={row.hidden ? t('slideEditor.layer.showLayer') : t('slideEditor.layer.hideLayer')}
            >
              {row.hidden ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
            </button>

            <span style={styles.glyph}><LayerKindIcon kind={row.kind} /></span>

            <span
              style={{
                ...styles.label,
                opacity: row.hidden ? 0.45 : 1,
                textDecoration: row.hidden ? 'line-through' : 'none',
              }}
            >
              {row.label}
            </span>

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
                title={row.locked ? t('slideEditor.layer.unlock') : t('slideEditor.layer.lock')}
              >
                {row.locked ? <LockedIcon size={12} /> : <UnlockedIcon size={12} />}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row.id);
                }}
                style={styles.remove}
                title={t('slideEditor.layer.remove')}
              >
                <IconX />
              </button>
            )}

            <span style={styles.grip} title={t('slideEditor.layer.dragRestack')}>
              <IconGrip />
            </span>
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
  grip: {
    display: 'flex',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'grab',
    flexShrink: 0,
    padding: '0 2px',
  },
  glyph: {
    width: 15,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 3,
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
  },
};

export default LayerList;
