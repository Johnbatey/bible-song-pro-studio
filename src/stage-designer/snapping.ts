/* =========================================================================
   Designer — snapping and alignment guides
   -------------------------------------------------------------------------
   Pure geometry, deliberately kept out of the canvas component. A zone being
   dragged offers up its own edges and centre as candidates; everything it is
   not dragging offers targets — the stage's own edges and centre lines, the
   other zones' edges and centres, and the grid. The closest pair inside the
   threshold wins, and the caller gets back one number to add and one line to
   draw.

   Threshold arrives in stage-percent but is computed from pixels by the
   caller, so snapping feels the same at 40% zoom as at 200%: a snap that gets
   stickier as you zoom in is a snap that fights you when you are trying to be
   precise, which is exactly when you have zoomed in.
   ========================================================================= */
import type { StageZone } from '../stage/layouts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A line the canvas draws while a snap is holding, in stage percent. */
export interface Guide {
  axis: 'x' | 'y';
  at: number;
  /** Where the guide is drawn from and to, so it spans the pair it relates
      rather than the whole stage — a full-height line through a busy layout
      says "something snapped" without saying to what. */
  from: number;
  to: number;
}

export interface SnapAxisResult {
  delta: number;
  guides: Guide[];
}

interface Target {
  at: number;
  /** The cross-axis span of whatever produced this line, for drawing. */
  from: number;
  to: number;
}

/** Candidate lines an axis of the stage offers: both edges and the centre. */
function stageTargets(): Target[] {
  return [
    { at: 0, from: 0, to: 100 },
    { at: 50, from: 0, to: 100 },
    { at: 100, from: 0, to: 100 },
  ];
}

function zoneTargets(zones: StageZone[], axis: 'x' | 'y'): Target[] {
  const targets: Target[] = [];
  for (const zone of zones) {
    const start = axis === 'x' ? zone.x : zone.y;
    const size = axis === 'x' ? zone.w : zone.h;
    const crossStart = axis === 'x' ? zone.y : zone.x;
    const crossSize = axis === 'x' ? zone.h : zone.w;
    const span = { from: crossStart, to: crossStart + crossSize };
    targets.push({ at: start, ...span });
    targets.push({ at: start + size / 2, ...span });
    targets.push({ at: start + size, ...span });
  }
  return targets;
}

/**
 * Snap one axis.
 *
 * `moving` are the positions on this axis that should look for a line — a
 * move offers left/centre/right, a resize offers only the edge under the
 * pointer. Every candidate is tested against every target and the smallest
 * distance wins; ties keep the first, which is why stage targets are listed
 * before zone targets and grid last. Landing on the stage's centre line should
 * beat landing on some zone that happens to sit there too.
 */
export function snapAxis(
  moving: number[],
  targets: Target[],
  threshold: number,
  movingSpan: { from: number; to: number },
  axis: 'x' | 'y',
): SnapAxisResult {
  let best: { delta: number; target: Target } | null = null;
  for (const candidate of moving) {
    for (const target of targets) {
      const delta = target.at - candidate;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, target };
    }
  }
  if (!best) return { delta: 0, guides: [] };

  /* The guide spans both the thing that snapped and the thing it snapped to,
     so the line visibly connects the pair. */
  const from = Math.min(best.target.from, movingSpan.from);
  const to = Math.max(best.target.to, movingSpan.to);
  return {
    delta: best.delta,
    guides: [{ axis, at: best.target.at, from, to }],
  };
}

export interface SnapOptions {
  /** Zones the drag is not touching. Their edges and centres are targets. */
  others: StageZone[];
  /** Percent per grid step, or 0 for no grid. */
  grid: number;
  /** How near a line has to be to catch, in stage percent. */
  threshold: number;
  /** Alt/Option held: the operator is asking for exactly where the pointer is. */
  disabled: boolean;
}

function gridTargets(grid: number): Target[] {
  if (grid <= 0) return [];
  const targets: Target[] = [];
  for (let at = 0; at <= 100.0001; at += grid) {
    targets.push({ at: Math.round(at * 100) / 100, from: 0, to: 100 });
  }
  return targets;
}

/** Snap a whole rectangle that is being moved: both axes, three candidates
    each. Returns the corrected rect and the lines to draw. */
export function snapMove(rect: Rect, options: SnapOptions): { rect: Rect; guides: Guide[] } {
  if (options.disabled) return { rect, guides: [] };

  const xTargets = [...stageTargets(), ...zoneTargets(options.others, 'x'), ...gridTargets(options.grid)];
  const yTargets = [...stageTargets(), ...zoneTargets(options.others, 'y'), ...gridTargets(options.grid)];

  const x = snapAxis(
    [rect.x, rect.x + rect.w / 2, rect.x + rect.w],
    xTargets,
    options.threshold,
    { from: rect.y, to: rect.y + rect.h },
    'x',
  );
  const y = snapAxis(
    [rect.y, rect.y + rect.h / 2, rect.y + rect.h],
    yTargets,
    options.threshold,
    { from: rect.x, to: rect.x + rect.w },
    'y',
  );

  return {
    rect: { ...rect, x: rect.x + x.delta, y: rect.y + y.delta },
    guides: [...x.guides, ...y.guides],
  };
}

/** Which edges a handle moves. The centre handles move one axis only, which is
    why this is a pair of booleans per side rather than a corner name. */
export interface HandleEdges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export const HANDLES: Array<{ id: string; edges: HandleEdges; cursor: string }> = [
  { id: 'nw', edges: { left: true, right: false, top: true, bottom: false }, cursor: 'nwse-resize' },
  { id: 'n', edges: { left: false, right: false, top: true, bottom: false }, cursor: 'ns-resize' },
  { id: 'ne', edges: { left: false, right: true, top: true, bottom: false }, cursor: 'nesw-resize' },
  { id: 'e', edges: { left: false, right: true, top: false, bottom: false }, cursor: 'ew-resize' },
  { id: 'se', edges: { left: false, right: true, top: false, bottom: true }, cursor: 'nwse-resize' },
  { id: 's', edges: { left: false, right: false, top: false, bottom: true }, cursor: 'ns-resize' },
  { id: 'sw', edges: { left: true, right: false, top: false, bottom: true }, cursor: 'nesw-resize' },
  { id: 'w', edges: { left: true, right: false, top: false, bottom: false }, cursor: 'ew-resize' },
];

/**
 * Snap a resize: only the edges the handle actually moves look for a line.
 *
 * A resize that snapped its fixed edge would drag the whole zone sideways
 * while the operator was trying to change its width, which is the single most
 * confusing thing a snapping implementation can do.
 */
export function snapResize(rect: Rect, edges: HandleEdges, options: SnapOptions): { rect: Rect; guides: Guide[] } {
  if (options.disabled) return { rect, guides: [] };

  const xTargets = [...stageTargets(), ...zoneTargets(options.others, 'x'), ...gridTargets(options.grid)];
  const yTargets = [...stageTargets(), ...zoneTargets(options.others, 'y'), ...gridTargets(options.grid)];
  const guides: Guide[] = [];
  const next = { ...rect };
  const ySpan = { from: rect.y, to: rect.y + rect.h };
  const xSpan = { from: rect.x, to: rect.x + rect.w };

  if (edges.left) {
    const snap = snapAxis([next.x], xTargets, options.threshold, ySpan, 'x');
    next.x += snap.delta;
    next.w -= snap.delta;
    guides.push(...snap.guides);
  } else if (edges.right) {
    const snap = snapAxis([next.x + next.w], xTargets, options.threshold, ySpan, 'x');
    next.w += snap.delta;
    guides.push(...snap.guides);
  }

  if (edges.top) {
    const snap = snapAxis([next.y], yTargets, options.threshold, xSpan, 'y');
    next.y += snap.delta;
    next.h -= snap.delta;
    guides.push(...snap.guides);
  } else if (edges.bottom) {
    const snap = snapAxis([next.y + next.h], yTargets, options.threshold, xSpan, 'y');
    next.h += snap.delta;
    guides.push(...snap.guides);
  }

  return { rect: next, guides };
}

/** The box that contains every zone given, for multi-select drags. */
export function boundingRect(zones: StageZone[]): Rect | null {
  if (zones.length === 0) return null;
  const x = Math.min(...zones.map((z) => z.x));
  const y = Math.min(...zones.map((z) => z.y));
  const right = Math.max(...zones.map((z) => z.x + z.w));
  const bottom = Math.max(...zones.map((z) => z.y + z.h));
  return { x, y, w: right - x, h: bottom - y };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
