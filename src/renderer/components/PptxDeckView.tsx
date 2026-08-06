/* =========================================================================
   <PptxDeckView> — an imported PowerPoint deck on the editor board
   -------------------------------------------------------------------------
   The centre of the editor, and only the centre: the rail, the inspector and
   the toolbar around it are the editor chrome's, shared with native decks, so
   a PowerPoint deck gets the same window rather than a parallel one.

   Selection is owned by the chrome for the same reason — the Design and Layer
   tabs act on it, and two copies of "what is selected" would be two things to
   keep in step.
   ========================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { SlideCanvas } from './SlideCanvas';
import { SlideSelectionLayer } from './SlideSelectionLayer';
import { setRunText } from '../slide-engine/edit/text';
import { markSlideDirty } from '../slide-engine/io/save';
import type { SelectionState } from '../slide-engine/edit/geometry';
import type { ParsedShape, ParsedRun } from '../slide-engine/parser/slide-parser';
import type { ParsedSlide, SlideSizeEmu } from '../slide-engine/state';
import type { DeckPackageStatus } from '../hooks/useDeckPackage';

export interface PptxDeckViewProps {
  slides: ParsedSlide[];
  slideSizeEmu: SlideSizeEmu | null;
  activeIndex: number;
  status: DeckPackageStatus | null;
  /** Board width in CSS px. Omit to fit the space the chrome leaves. */
  boardWidth?: number;
  selection: SelectionState | null;
  onSelectionChange: (selection: SelectionState | null) => void;
  /** Called after every edit, so history can take a snapshot and the canvas
      can repaint from the committed records. */
  onEdited: () => void;
  /** Called when the active slide changes, to capture its starting state. */
  onSlideShown?: () => void;
  /** Bumped by an edit or an undo, either of which rebuilds what is painted. */
  revision: number;
}

export function PptxDeckView({
  slides,
  slideSizeEmu,
  activeIndex,
  status,
  boardWidth,
  selection,
  onSelectionChange,
  onEdited,
  onSlideShown,
  revision,
}: PptxDeckViewProps) {
  const active = slides[activeIndex] || null;
  const aspect = slideSizeEmu && slideSizeEmu.cx > 0 ? slideSizeEmu.cy / slideSizeEmu.cx : 9 / 16;

  /* Measured, not assumed: the rail and inspector are the chrome's now, and
     their widths change with the window, so a fixed board width clips the
     slide on a narrow editor and wastes space on a wide one. */
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(boardWidth ?? 960);
  useEffect(() => {
    if (boardWidth) { setFitWidth(boardWidth); return; }
    const node = boardAreaRef.current;
    if (!node) return;
    const measure = () => {
      const r = node.getBoundingClientRect();
      const pad = 32;
      const byWidth = Math.max(160, r.width - pad);
      const byHeight = Math.max(160, (r.height - pad) / aspect);
      setFitWidth(Math.floor(Math.min(byWidth, byHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [boardWidth, aspect]);

  const boardPx = fitWidth;
  const boardHeight = Math.round(boardPx * aspect);

  const handleGeometryCommit = useCallback(() => {
    markSlideDirty(active);
    onEdited();
  }, [active, onEdited]);

  const handleRunEdit = useCallback((run: ParsedRun, value: string) => {
    setRunText(run, value);
    markSlideDirty(active);
    onEdited();
  }, [active, onEdited]);

  // Capture the slide's starting state the first time it is shown, so its very
  // first edit is undoable rather than being the baseline.
  useEffect(() => { if (active?.parsed) onSlideShown?.(); }, [active, onSlideShown]);

  return (
    <div ref={boardAreaRef} style={styles.board}>
      {status && (
        <div style={{ ...styles.status, color: status.level === 'error' ? '#f87171' : 'rgba(255,255,255,0.6)' }}>
          {status.text}
        </div>
      )}
      {!status && active && (
        <div style={{ ...styles.canvasFrame, position: 'relative' }}>
          <SlideCanvas
            slide={active}
            slideSizeEmu={slideSizeEmu}
            width={boardPx}
            editable
            onRunEdit={handleRunEdit}
            revision={revision}
          />
          <SlideSelectionLayer
            shapes={(active.shapes as ParsedShape[]) || []}
            selection={selection}
            onSelectionChange={onSelectionChange}
            onCommit={handleGeometryCommit}
            boardWidth={boardPx}
            boardHeight={boardHeight}
          />
        </div>
      )}
      {!status && !active && (
        <div style={styles.status}>No slides in this deck.</div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  board: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    overflow: 'auto',
    backgroundColor: '#111010',
    backgroundImage:
      'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  },
  canvasFrame: {
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    flexShrink: 0,
  },
  status: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
};

export default PptxDeckView;
