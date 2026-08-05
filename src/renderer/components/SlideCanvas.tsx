/* =========================================================================
   <SlideCanvas> — renders a parsed PPTX slide
   -------------------------------------------------------------------------
   Draws the parsed slide model as positioned DOM: text runs, shapes, tables,
   connectors and the original embedded media. No screenshot, no flattened
   background, no second renderer recreating the file.

   The visual rules all live in slide-engine/render/slide-render-model.ts,
   ported from the reference's DOM-mutating renderer; this component is the
   React delivery of them. Shapes are already in paint order (master, then
   layout, then slide), so document order is stacking order.
   ========================================================================= */
import { memo, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { resolveThemeColor } from '../slide-engine/core/color';
import type { ParsedSlide } from '../slide-engine/state';
import type { ParsedShape, ParsedRun } from '../slide-engine/parser/slide-parser';
import type { TextBodyLayout } from '../slide-engine/parser/shape-style';
import {
  BOARD_W,
  boardHeight,
  connectorSpec,
  imageFillStyle,
  imageRender,
  paragraphBullet,
  paragraphStyleToCss,
  runStyle,
  shapeTransform,
  shapeVisual,
  slideBackgroundStyle,
  tableRender,
  textBodyStyle,
  textCounterFlip,
  type ShapeSvgSpec,
} from '../slide-engine/render/slide-render-model';
import type { SlideSizeEmu } from '../slide-engine/state';

const WRAP: CSSProperties = { overflowWrap: 'break-word', whiteSpace: 'pre-wrap' };
const P_BASE: CSSProperties = { margin: 0, lineHeight: 1.2 };
/* Caret affordance only. No padding or border — PowerPoint's box is the exact
   box, and inflating a run would reflow the line the moment you hover it. */
const EDITABLE_RUN: CSSProperties = { outline: 'none', cursor: 'text' };

function ShapeSvg({ spec }: { spec: ShapeSvgSpec }) {
  return (
    <svg
      viewBox={spec.viewBox}
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: spec.overflowVisible ? 'visible' : undefined,
        filter: spec.filter,
      }}
    >
      {spec.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          strokeLinejoin={p.strokeLinejoin}
        />
      ))}
    </svg>
  );
}

/** One paragraph: bullet span (if any) then the runs, each keeping its own
    styling. `counters` is threaded through so auto-numbered lists count across
    paragraphs and reset when the level gets shallower.

    When `editable`, runs backed by an XML node become contentEditable and
    commit on blur. React must not re-render them while they have focus or it
    would fight the caret — which it does not, because nothing sets state until
    blur, and by then the DOM text already matches what React will produce. */
function Paragraph({
  pRuns,
  counters,
  fallbackColor,
  wrapNone,
  counterFlip,
  editable,
  onRunEdit,
}: {
  pRuns: ParsedRun[];
  counters: Record<number, number>;
  fallbackColor: string;
  wrapNone: boolean;
  counterFlip?: string;
  editable?: boolean;
  onRunEdit?: (run: ParsedRun, value: string) => void;
}) {
  const firstRun = pRuns.find((run) => run && run.text !== '\n');
  const pStyle: CSSProperties = {
    ...WRAP,
    ...P_BASE,
    ...(wrapNone ? { whiteSpace: 'pre' as const } : null),
    ...(counterFlip ? { transform: counterFlip } : null),
    ...(firstRun ? paragraphStyleToCss(firstRun.paragraphStyle || { align: firstRun.align }) : null),
  };
  const bullet = firstRun ? paragraphBullet(pRuns, firstRun.paragraphStyle, counters) : null;

  return (
    <p style={pStyle}>
      {bullet ? <span style={bullet.style}>{bullet.glyph}</span> : null}
      {pRuns.map((run, i) => {
        const canEdit = !!editable && !!run.nodeRef;
        return (
          <span
            key={i}
            style={canEdit ? { ...runStyle(run, fallbackColor), ...EDITABLE_RUN } : runStyle(run, fallbackColor)}
            contentEditable={canEdit || undefined}
            suppressContentEditableWarning={canEdit}
            spellCheck={canEdit ? false : undefined}
            onBlur={canEdit ? (e) => onRunEdit?.(run, e.currentTarget.textContent || '') : undefined}
          >
            {run.text}
          </span>
        );
      })}
    </p>
  );
}

function TableShape({ shape, outerStyle, textFallbackColor }: { shape: ParsedShape; outerStyle: CSSProperties; textFallbackColor?: string }) {
  const table = tableRender(shape);
  const fallback = textFallbackColor || resolveThemeColor('tx1', '#0f172a');
  return (
    <div data-shape-id={shape.id} style={{ ...outerStyle, ...table.style }}>
      {table.cells.map((cell) => {
        const counters: Record<number, number> = {};
        return (
          <div key={cell.key} style={cell.style}>
            {cell.paragraphs.map((pRuns, i) => (
              <Paragraph key={i} pRuns={pRuns} counters={counters} fallbackColor={fallback} wrapNone={false} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Connector({ shape, boardH }: { shape: ParsedShape; boardH: number }) {
  const c = connectorSpec(shape, boardH);
  return (
    <svg
      viewBox={c.viewBox}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${c.widthPx}px`,
        height: `${c.heightPx}px`,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {(c.head || c.tail) && (
        <defs>
          {c.head && (
            <marker
              id={`${c.markerId}_h`}
              viewBox="0 0 10 10"
              refX="1"
              refY="5"
              markerWidth={c.markerSize}
              markerHeight={c.markerSize}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c.stroke} />
            </marker>
          )}
          {c.tail && (
            <marker
              id={`${c.markerId}_t`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth={c.markerSize}
              markerHeight={c.markerSize}
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c.stroke} />
            </marker>
          )}
        </defs>
      )}
      <path
        d={c.d}
        fill="none"
        stroke={c.stroke}
        strokeWidth={c.strokeWidth}
        strokeDasharray={c.dashArray}
        markerStart={c.head ? `url(#${c.markerId}_h)` : undefined}
        markerEnd={c.tail ? `url(#${c.markerId}_t)` : undefined}
      />
    </svg>
  );
}

/**
 * PowerPoint text auto-fit.
 *   - A stored fontScale (PowerPoint persisted its computed fit) is applied
 *     directly, along with any line-spacing reduction.
 *   - normAutofit with no stored scale is computed here by measurement: shrink
 *     the runs until the content fits the box, floored at 25%. Needs the node
 *     mounted, hence the layout effect.
 */
function useTextAutofit(ref: React.RefObject<HTMLDivElement | null>, layout: TextBodyLayout | undefined, dynamic: boolean) {
  useLayoutEffect(() => {
    const div = ref.current;
    if (!div || !layout) return;
    const spans = Array.from(div.querySelectorAll('span'));
    if (spans.length === 0) return;

    const setScale = (scale: number) => {
      spans.forEach((s) => {
        let base = parseFloat(s.dataset.bspBasePx || '');
        if (!Number.isFinite(base)) {
          base = parseFloat(s.style.fontSize);
          if (Number.isFinite(base)) s.dataset.bspBasePx = String(base);
        }
        if (Number.isFinite(base)) s.style.fontSize = `${base * scale}px`;
      });
    };

    if (layout.fontScalePct != null) {
      setScale(layout.fontScalePct / 100);
      if (layout.lnSpcReductionPct) {
        const f = 1 - layout.lnSpcReductionPct / 100;
        Array.from(div.querySelectorAll('p')).forEach((p) => {
          const lh = parseFloat(getComputedStyle(p).lineHeight);
          if (Number.isFinite(lh)) p.style.lineHeight = `${lh * f}px`;
        });
      }
      return;
    }

    if (dynamic && layout.autofit === 'norm') {
      let scale = 1;
      setScale(1);
      let guard = 0;
      while (div.scrollHeight > div.clientHeight + 1 && scale > 0.25 && guard < 16) {
        scale -= 0.05;
        setScale(scale);
        guard++;
      }
    }
  });
}

/**
 * kind:"text" — a shape carrying paragraphs. Its geometry styling is painted
 * first so filled/stroked shapes keep their look.
 *
 * Fill, border, radius, insets and the flex column all belong on the SAME
 * positioned box as the shape's rect, not on a child: a nested box would put
 * the border inside the parent's `overflow: hidden` and clip it, and the
 * padding would measure against the wrong element for autofit.
 */
function TextShape({
  shape,
  boardH,
  dynamicAutofit,
  outerStyle,
  editable,
  onRunEdit,
  textFallbackColor,
}: {
  shape: ParsedShape;
  boardH: number;
  dynamicAutofit: boolean;
  outerStyle: CSSProperties;
  editable?: boolean;
  onRunEdit?: (run: ParsedRun, value: string) => void;
  textFallbackColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const box = (shape.textBoxLayout as TextBodyLayout | undefined) || ({} as TextBodyLayout);
  useTextAutofit(ref, shape.textBoxLayout as TextBodyLayout | undefined, dynamicAutofit);

  const visual = shapeVisual(shape, boardH);
  const counters: Record<number, number> = {};
  const flip = textCounterFlip(shape);
  const fallback = textFallbackColor || resolveThemeColor('tx1', '#f8fafc');

  return (
    <div ref={ref} data-shape-id={shape.id} style={{ ...outerStyle, ...visual.style, ...textBodyStyle(shape, box, boardH) }}>
      {visual.svg ? <ShapeSvg spec={visual.svg} /> : null}
      {(shape.paragraphs || []).map((pRuns, i) => (
        <Paragraph
          key={i}
          pRuns={pRuns}
          counters={counters}
          fallbackColor={fallback}
          wrapNone={box.wrap === 'none'}
          counterFlip={flip}
          editable={editable && shape.editable !== false}
          onRunEdit={onRunEdit}
        />
      ))}
    </div>
  );
}

function Shape({ shape, boardH, dynamicAutofit, editable, onRunEdit, textFallbackColor }: { shape: ParsedShape; boardH: number; dynamicAutofit: boolean; editable?: boolean; onRunEdit?: (run: ParsedRun, value: string) => void; textFallbackColor?: string }) {
  const outer: CSSProperties = {
    position: 'absolute',
    left: `${shape.left}%`,
    top: `${shape.top}%`,
    width: `${shape.width}%`,
    height: `${shape.height}%`,
    overflow: 'hidden',
    transform: shapeTransform(shape),
  };

  if (shape.kind === 'image') {
    const img = imageRender(shape);
    return (
      <div data-shape-id={shape.id} style={{ ...outer, ...img.divStyle }}>
        <img src={img.src} alt="" style={{ ...img.imgStyle, pointerEvents: 'none' }} />
      </div>
    );
  }

  if (shape.kind === 'connector') {
    return (
      <div data-shape-id={shape.id} style={{ ...outer, overflow: 'visible' }}>
        <Connector shape={shape} boardH={boardH} />
      </div>
    );
  }

  if (shape.kind === 'imagefill') {
    return <div data-shape-id={shape.id} style={{ ...outer, ...imageFillStyle(shape, boardH) }} />;
  }

  if (shape.kind === 'table') {
    return <TableShape shape={shape} outerStyle={outer} textFallbackColor={textFallbackColor} />;
  }

  if (shape.kind === 'shape') {
    const visual = shapeVisual(shape, boardH);
    return (
      <div data-shape-id={shape.id} style={{ ...outer, ...visual.style }}>
        {visual.svg ? <ShapeSvg spec={visual.svg} /> : null}
      </div>
    );
  }

  return <TextShape shape={shape} boardH={boardH} dynamicAutofit={dynamicAutofit} outerStyle={outer} editable={editable} onRunEdit={onRunEdit} textFallbackColor={textFallbackColor} />;
}

export interface SlideCanvasProps {
  slide: ParsedSlide | null;
  /** Deck slide size; drives the board aspect so 4:3 decks stay 4:3. */
  slideSizeEmu?: SlideSizeEmu | null;
  /** Board width in CSS px. The board scales as a whole; 1280 is 1:1. */
  width?: number;
  /** Off for thumbnails: measuring autofit per thumbnail is not worth it. */
  dynamicAutofit?: boolean;
  /* The colour a run with no colour of its own falls back to — the deck
     theme's tx1. Resolving it needs the open package's theme map, which only
     the window that parsed the deck has, so a projected slide carries the
     answer with it instead of letting the display guess. */
  textFallbackColor?: string;
  /** Makes XML-backed text runs contentEditable. Off everywhere by default. */
  editable?: boolean;
  /** Fires on blur with the run's new text. Write it back with edit/text. */
  onRunEdit?: (run: ParsedRun, value: string) => void;
  /* Edits mutate the parsed slide in place — that is what lets a save
     round-trip into the .pptx — so the slide's identity never changes and this
     memo would hold a stale picture. Bump this to force a repaint. */
  revision?: number;
  className?: string;
  style?: CSSProperties;
}

function SlideCanvasImpl({
  slide,
  slideSizeEmu,
  width,
  dynamicAutofit = true,
  editable = false,
  onRunEdit,
  textFallbackColor,
  className,
  style,
}: SlideCanvasProps) {
  const boardH = boardHeight(slideSizeEmu);
  const scale = (width ?? BOARD_W) / BOARD_W;

  const board = (
    <div
      className={scale === 1 ? className : undefined}
      style={{
        position: 'relative',
        width: `${BOARD_W}px`,
        height: `${boardH}px`,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'top left',
        overflow: 'hidden',
        ...slideBackgroundStyle(slide?.backgroundColor),
        ...(scale === 1 ? style : null),
      }}
    >
      {slide?.parsed
        ? ((slide.shapes as ParsedShape[]) || []).map((shape) => (
          <Shape key={shape.id} shape={shape} boardH={boardH} dynamicAutofit={dynamicAutofit} editable={editable} onRunEdit={onRunEdit} textFallbackColor={textFallbackColor} />
        ))
        : null}
    </div>
  );

  if (scale === 1) return board;

  /* A scaled board still LAYS OUT at 1280 wide — transform does not affect flow
     — so it must sit in a wrapper of its true visual size. Without this a
     thumbnail inside a centring flex parent gets pushed hundreds of pixels left
     and renders as an empty box. */
  return (
    <div
      className={className}
      style={{
        width: `${BOARD_W * scale}px`,
        height: `${boardH * scale}px`,
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {board}
    </div>
  );
}

export const SlideCanvas = memo(SlideCanvasImpl);
export default SlideCanvas;
