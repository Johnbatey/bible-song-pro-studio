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
import { memo, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { SlideCanvas } from './SlideCanvas';
import type { ParsedSlide, SlideSizeEmu } from '../slide-engine/state';
import type { DeckPackageStatus } from '../hooks/useDeckPackage';

const RAIL_THUMB_W = 168;

interface RailItemProps {
  slide: ParsedSlide;
  index: number;
  active: boolean;
  slideSizeEmu: SlideSizeEmu | null;
  onSelect: (index: number) => void;
}

const RailItem = memo(function RailItem({ slide, index, active, slideSizeEmu, onSelect }: RailItemProps) {
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
          />
        ) : (
          <span style={styles.railPending}>…</span>
        )}
      </div>
    </button>
  );
});

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
            <SlideCanvas slide={active} slideSizeEmu={slideSizeEmu} width={boardWidth} />
          </div>
        )}
        {!status && !active && (
          <div style={styles.status}>No slides in this deck.</div>
        )}
      </div>
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
};

export default PptxDeckView;
