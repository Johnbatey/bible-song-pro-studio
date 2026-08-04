/* =========================================================================
   <PptxDeckView> — an imported PowerPoint deck on the editor canvas
   -------------------------------------------------------------------------
   Slide rail on the left, the active slide on the board. Both are the same
   <SlideCanvas>, so a thumbnail is the slide, not a separate approximation of
   it — nothing can drift between the two.

   Slides arrive progressively: slide 1 parses immediately so the deck opens at
   once, and the rest fill from an idle queue. A rail entry that has not been
   reached yet shows its number and parses on demand the moment it is selected.
   ========================================================================= */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { SlideCanvas } from './SlideCanvas';
import { editableTextShapes, setShapeText, setRunText, shapeFullText } from '../slide-engine/edit/text';
import { markSlideDirty } from '../slide-engine/io/save';
import type { ParsedShape, ParsedRun } from '../slide-engine/parser/slide-parser';
import type { ParsedSlide, SlideSizeEmu } from '../slide-engine/state';
import type { DeckPackageStatus } from '../hooks/useDeckPackage';

const RAIL_THUMB_W = 168;

interface RailItemProps {
  slide: ParsedSlide;
  index: number;
  active: boolean;
  slideSizeEmu: SlideSizeEmu | null;
  onSelect: (index: number) => void;
  /* Edits mutate the slide record in place, so its identity never changes and
     memo would hold a stale thumbnail. Only the active slide can be edited, so
     only it needs a revision to break through. */
  revision: number;
}

const RailItem = memo(function RailItem({ slide, index, active, slideSizeEmu, onSelect, revision }: RailItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Keep the selected slide visible when navigating with the rail collapsed
  // past the fold.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const aspect = slideSizeEmu && slideSizeEmu.cx > 0 ? slideSizeEmu.cy / slideSizeEmu.cx : 9 / 16;

  return (
    <button
      ref={ref}
      onClick={() => onSelect(index)}
      style={{
        ...styles.railItem,
        borderColor: active ? 'var(--accent, #f97316)' : 'rgba(255,255,255,0.08)',
      }}
      title={`Slide ${index + 1}`}
    >
      <span style={styles.railNumber}>{index + 1}</span>
      <div style={{ ...styles.railThumb, height: Math.round(RAIL_THUMB_W * aspect) }}>
        {slide.parsed ? (
          <SlideCanvas
            slide={slide}
            slideSizeEmu={slideSizeEmu}
            width={RAIL_THUMB_W}
            dynamicAutofit={false}
            revision={revision}
          />
        ) : (
          <span style={styles.railPending}>…</span>
        )}
      </div>
    </button>
  );
});

/**
 * One field per real text box — PowerPoint's own unit — never one per split
 * run. Decorative custGeom art carries a throwaway txBody and is skipped, or a
 * single illustration slide would list hundreds of empty fields.
 */
function TextPanel({
  shapes,
  onEdit,
}: {
  shapes: ParsedShape[];
  onEdit: (shape: ParsedShape, value: string) => void;
}) {
  const boxes = editableTextShapes(shapes);

  if (boxes.length === 0) {
    return <div style={styles.panelEmpty}>No editable text on this slide.</div>;
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHead}>
        {boxes.length} text box{boxes.length === 1 ? '' : 'es'}
      </div>
      {boxes.map((shape, i) => {
        const label = shape.paragraphs[0].map((r) => r.text).join('').trim().slice(0, 28) || `Text box ${i + 1}`;
        return (
          <label key={shape.id} style={styles.field}>
            <span style={styles.fieldLabel}>{label}</span>
            <textarea
              /* Controlled, so editing a run on the canvas is reflected here
                 too. Uncontrolled would go stale, and the next keystroke in
                 this field would then write the old text back over the canvas
                 edit. onEdit writes through synchronously and bumps the
                 revision, so the value is always what the box actually says. */
              value={shapeFullText(shape)}
              rows={Math.min(4, shape.paragraphs.length)}
              onChange={(e) => onEdit(shape, e.target.value)}
              style={styles.textarea}
              spellCheck={false}
            />
          </label>
        );
      })}
    </div>
  );
}

export interface PptxDeckViewProps {
  slides: ParsedSlide[];
  slideSizeEmu: SlideSizeEmu | null;
  activeIndex: number;
  onSelectSlide: (index: number) => void;
  status: DeckPackageStatus | null;
  /** Board width in CSS px; the canvas scales to it. */
  boardWidth: number;
}

export function PptxDeckView({
  slides,
  slideSizeEmu,
  activeIndex,
  onSelectSlide,
  status,
  boardWidth,
}: PptxDeckViewProps) {
  const active = slides[activeIndex] || null;

  /* Edits mutate the parsed records and the XML nodes behind them in place —
     that is what lets a save round-trip into the .pptx — so React needs an
     explicit nudge to repaint. */
  const [revision, bump] = useState(0);
  const repaint = useCallback(() => bump((n) => n + 1), []);

  const handlePanelEdit = useCallback((shape: ParsedShape, value: string) => {
    setShapeText(shape, value);
    markSlideDirty(active);
    repaint();
  }, [active, repaint]);

  const handleRunEdit = useCallback((run: ParsedRun, value: string) => {
    setRunText(run, value);
    markSlideDirty(active);
    repaint();
  }, [active, repaint]);

  return (
    <div style={styles.wrap}>
      <div style={styles.rail}>
        {slides.map((slide, i) => (
          <RailItem
            key={slide.filename || i}
            slide={slide}
            index={i}
            active={i === activeIndex}
            slideSizeEmu={slideSizeEmu}
            onSelect={onSelectSlide}
            revision={i === activeIndex ? revision : 0}
          />
        ))}
      </div>

      <div style={styles.board}>
        {status && (
          <div style={{ ...styles.status, color: status.level === 'error' ? '#f87171' : 'rgba(255,255,255,0.6)' }}>
            {status.text}
          </div>
        )}
        {!status && active && (
          <div style={styles.canvasFrame}>
            <SlideCanvas
              slide={active}
              slideSizeEmu={slideSizeEmu}
              width={boardWidth}
              editable
              onRunEdit={handleRunEdit}
              revision={revision}
            />
          </div>
        )}
        {!status && !active && (
          <div style={styles.status}>No slides in this deck.</div>
        )}
      </div>

      {!status && active?.parsed && (
        <TextPanel
          key={active.filename as string}
          shapes={(active.shapes as ParsedShape[]) || []}
          onEdit={handlePanelEdit}
        />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { flex: 1, display: 'flex', minHeight: 0, minWidth: 0 },
  rail: {
    width: RAIL_THUMB_W + 32,
    flexShrink: 0,
    overflowY: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#0e1117',
    borderRight: '1px solid rgba(255,255,255,0.08)',
  },
  railItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: 4,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
  },
  railNumber: { fontSize: 10, color: 'rgba(255,255,255,0.45)', width: 16, flexShrink: 0, paddingTop: 2 },
  railThumb: {
    width: RAIL_THUMB_W,
    overflow: 'hidden',
    borderRadius: 3,
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  railPending: { fontSize: 16, color: 'rgba(255,255,255,0.3)' },
  board: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    overflow: 'auto',
  },
  canvasFrame: {
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    flexShrink: 0,
  },
  status: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  panel: {
    width: 280,
    flexShrink: 0,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#0e1117',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  },
  panelEmpty: {
    width: 280,
    flexShrink: 0,
    padding: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    background: '#0e1117',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  },
  panelHead: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    background: '#16191f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5,
    color: '#fff',
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '6px 8px',
    outline: 'none',
  },
};

export default PptxDeckView;
