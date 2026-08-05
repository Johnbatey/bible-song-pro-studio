/* =========================================================================
   <SlideStage> — a projected slide, fitted to the surface it lands on
   -------------------------------------------------------------------------
   The same slide has to fill a 4K projector, a 300px Program thumbnail and a
   browser window on the web display, and look identical in all three. Both
   boards render at a fixed 1280px logical width and scale as a whole, so all
   this does is measure the box it was given, work out the largest whole-board
   scale that fits, and centre it.

   Letterbox bars are black rather than the theme's background: a 4:3 deck on a
   16:9 screen is the projector's problem, not the theme's, and a coloured bar
   down each side reads as a rendering fault.
   ========================================================================= */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SlideCanvas } from '../SlideCanvas';
import { NativeSlideBoard, NATIVE_BOARD_W } from '../NativeSlideBoard';
import type { ParsedSlide } from '../../slide-engine/state';
import type { SlideProjection } from '../../types';
import './SlideStage.css';

/** Board height at 1:1 for a projection's aspect. 16:9 unless told otherwise. */
function boardHeightFor(projection: SlideProjection): number {
  const size = projection.sizeEmu;
  if (size && size.cx > 0 && size.cy > 0) {
    return Math.round(NATIVE_BOARD_W * (size.cy / size.cx));
  }
  return Math.round(NATIVE_BOARD_W * (9 / 16));
}

export function SlideStage({ projection, className = '' }: { projection: SlideProjection; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  /* offsetWidth, not getBoundingClientRect: the Program pane paints its surface
     at full size and scales it down with a CSS transform to fit the operator's
     window. A bounding rect there reports the scaled-down size, and fitting the
     board to it renders the slide a second time smaller — a postage stamp in
     the middle of the pane. Offset sizes are layout pixels and ignore the
     transform, which is the space the board lays out in anyway. */
  const measure = () => {
    const node = ref.current;
    if (!node) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
  };

  /* Measured after every commit, not once on mount. The box a stage sits in is
     not always settled when the stage first mounts — on the stage display the
     zone's reference line arrives in a later commit and takes 21px off the
     cell — and a stage that measured once would keep fitting the board to a
     height that no longer exists. Re-measuring converges in one extra pass and
     then stops, because an unchanged size returns the same state object. */
  useLayoutEffect(measure);

  /* And an observer for the resizes no render of ours is involved in: the
     operator dragging a dock divider, or a display window changing screens. */
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boardH = boardHeightFor(projection);
  const fit = box.width > 0 && box.height > 0
    ? Math.min(box.width / NATIVE_BOARD_W, box.height / boardH)
    : 0;
  const width = fit > 0 ? NATIVE_BOARD_W * fit : 0;

  return (
    <div ref={ref} className={`slide-stage ${className}`.trim()}>
      {width > 0 && (
        projection.kind === 'native' ? (
          <NativeSlideBoard
            elements={projection.elements || []}
            background={projection.background}
            width={width}
            boardHeight={boardH}
          />
        ) : projection.parsed ? (
          <SlideCanvas
            slide={projection.parsed as unknown as ParsedSlide}
            slideSizeEmu={projection.sizeEmu || null}
            width={width}
            dynamicAutofit
            textFallbackColor={projection.textFallbackColor}
          />
        ) : projection.previewDataUrl ? (
          /* Nothing parsed — the import's own picture of the slide is all
             there is, and showing it beats showing nothing. */
          <img
            className="slide-stage-preview"
            src={projection.previewDataUrl}
            alt=""
            style={{ width, height: boardH * fit }}
          />
        ) : null
      )}
    </div>
  );
}

export default SlideStage;
