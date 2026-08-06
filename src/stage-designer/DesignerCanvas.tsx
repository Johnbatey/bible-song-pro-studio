/* =========================================================================
   <DesignerCanvas> — direct manipulation over the real stage
   -------------------------------------------------------------------------
   The layer underneath is not a drawing of the stage. It is <StageSurface>,
   the same component the stage window mounts, rendered at 1920x1080 and
   scaled — so a zone that clips its verse here clips it on Sunday, and there
   is no second renderer that can drift from the first. The reference editor
   this replaces drew its own preview out of sample <span>s with a hardcoded
   0.32 font multiplier, which is a picture of a stage rather than a stage, and
   a picture cannot tell you your text does not fit.

   Everything editable lives in a transparent overlay on top: selection boxes,
   eight handles, snap guides, the marquee. The stage below never receives a
   pointer event, so nothing about editing can perturb what is being edited.
   ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { StageSurface } from '../stage/StageSurface';
import type { StageLayout, StageZone } from '../stage/layouts';
import { clamp, MIN_ZONE_SIZE, ZONE_LABELS } from '../stage/layout-model';
import type { StageState } from '../stage/stage-state';
import type { ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { isTypingTarget } from './keyboard';
import { EyeOff, Locked, ThemeHidden } from './icons';
import {
  boundingRect,
  HANDLES,
  rectsIntersect,
  snapMove,
  snapResize,
  type Guide,
  type HandleEdges,
  type Rect,
} from './snapping';

const STAGE_W = 1920;
const STAGE_H = 1080;

/** How near a line has to be, in screen pixels, before it catches. Converted
    to stage percent per drag so the feel does not change with zoom. */
const SNAP_PX = 7;

export interface DesignerCanvasProps {
  layout: StageLayout;
  /** What the stage would look like, minus the layout the designer is editing. */
  stageState: StageState;
  programState: ProgramSurfaceState;
  assetBaseUrl?: string;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Silent while a drag is open; the history entry is opened by begin(). */
  onChange: (zones: StageZone[], silent: boolean) => void;
  onBegin: () => void;
  onEnd: () => void;
  /** Percent per grid step. 0 turns the grid and its snapping off. */
  grid: number;
  showGrid: boolean;
  snapEnabled: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Zone types the operator's theme is currently hiding, so the overlay can
      say why a zone is drawing nothing. */
  hiddenTypes: Set<string>;
}

type Drag =
  | { kind: 'move'; ids: string[]; startX: number; startY: number; origin: Map<string, Rect>; group: Rect }
  | { kind: 'resize'; id: string; edges: HandleEdges; startX: number; startY: number; origin: Rect }
  | { kind: 'marquee'; startX: number; startY: number; additive: boolean }
  | { kind: 'pan'; startX: number; startY: number; scrollLeft: number; scrollTop: number };

function zoneRect(zone: StageZone): Rect {
  return { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
}

export function DesignerCanvas({
  layout,
  stageState,
  programState,
  assetBaseUrl,
  selection,
  onSelectionChange,
  onChange,
  onBegin,
  onEnd,
  grid,
  showGrid,
  snapEnabled,
  zoom,
  onZoomChange,
  hiddenTypes,
}: DesignerCanvasProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /* The layout at the instant the drag began. Reading zones out of props
     mid-drag would compound each frame's rounding into the next one's origin,
     and a zone dragged in a slow circle would drift away from the pointer. */
  const dragZonesRef = useRef<StageZone[]>([]);

  const [fitScale, setFitScale] = useState(0.4);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  /* ---- fit ---------------------------------------------------------------- */
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const pad = 56;
    const availableW = Math.max(240, viewport.clientWidth - pad);
    const availableH = Math.max(160, viewport.clientHeight - pad);
    const next = Math.min(availableW / STAGE_W, availableH / STAGE_H);
    setFitScale((current) => (Math.abs(current - next) < 0.0005 ? current : next));
  }, []);

  useLayoutEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure]);

  const scale = fitScale * zoom;
  const boxW = STAGE_W * scale;
  const boxH = STAGE_H * scale;

  /* ---- pointer maths ------------------------------------------------------ */
  /** Client pixels to stage percent, read off the overlay's own rect so zoom
      and scroll are already accounted for. */
  const toPercent = useCallback((clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const threshold = useCallback(() => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return (SNAP_PX / rect.width) * 100;
  }, []);

  /* ---- drag --------------------------------------------------------------- */
  const startMove = useCallback(
    (event: ReactPointerEvent, zoneId: string) => {
      const ids = selection.includes(zoneId) ? selection : [zoneId];
      const zones = layout.zones.filter((zone) => ids.includes(zone.id));
      const group = boundingRect(zones);
      if (!group) return;
      const point = toPercent(event.clientX, event.clientY);
      dragZonesRef.current = layout.zones;
      dragRef.current = {
        kind: 'move',
        ids,
        startX: point.x,
        startY: point.y,
        origin: new Map(zones.map((zone) => [zone.id, zoneRect(zone)])),
        group,
      };
      onBegin();
    },
    [layout.zones, selection, toPercent, onBegin],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent, zoneId: string, edges: HandleEdges) => {
      const zone = layout.zones.find((item) => item.id === zoneId);
      if (!zone) return;
      const point = toPercent(event.clientX, event.clientY);
      dragZonesRef.current = layout.zones;
      dragRef.current = {
        kind: 'resize',
        id: zoneId,
        edges,
        startX: point.x,
        startY: point.y,
        origin: zoneRect(zone),
      };
      onBegin();
    },
    [layout.zones, toPercent, onBegin],
  );

  const onZonePointerDown = useCallback(
    (event: ReactPointerEvent, zone: StageZone) => {
      if (spaceHeld) return;
      event.stopPropagation();
      event.preventDefault();
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;

      if (additive) {
        // Toggle without dragging: an operator building a selection is not
        // also trying to move it, and a two-pixel wobble should not move six
        // zones they had just finished picking.
        onSelectionChange(
          selection.includes(zone.id)
            ? selection.filter((id) => id !== zone.id)
            : [...selection, zone.id],
        );
        return;
      }

      if (!selection.includes(zone.id)) onSelectionChange([zone.id]);
      startMove(event, zone.id);
    },
    [selection, onSelectionChange, startMove, spaceHeld],
  );

  const onSurfacePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      const viewport = viewportRef.current;
      if ((spaceHeld || event.button === 1) && viewport) {
        event.preventDefault();
        dragRef.current = {
          kind: 'pan',
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
        };
        return;
      }
      if (event.button !== 0) return;
      const point = toPercent(event.clientX, event.clientY);
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      if (!additive) onSelectionChange([]);
      dragRef.current = { kind: 'marquee', startX: point.x, startY: point.y, additive };
      setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
    },
    [onSelectionChange, toPercent, spaceHeld],
  );

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === 'pan') {
        const viewport = viewportRef.current;
        if (!viewport) return;
        viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
        viewport.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
        return;
      }

      const point = toPercent(event.clientX, event.clientY);
      const noSnap = !snapEnabled || event.altKey;

      if (drag.kind === 'marquee') {
        setMarquee({
          x: Math.min(drag.startX, point.x),
          y: Math.min(drag.startY, point.y),
          w: Math.abs(point.x - drag.startX),
          h: Math.abs(point.y - drag.startY),
        });
        return;
      }

      const zones = dragZonesRef.current;

      if (drag.kind === 'move') {
        let dx = point.x - drag.startX;
        let dy = point.y - drag.startY;
        // Shift locks to whichever axis has moved further, the way every other
        // canvas does it — decided per frame from the larger displacement, so
        // the lock follows the gesture rather than the first pixel of it.
        if (event.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        const group = drag.group;
        const proposed: Rect = {
          x: clamp(group.x + dx, 0, 100 - group.w),
          y: clamp(group.y + dy, 0, 100 - group.h),
          w: group.w,
          h: group.h,
        };
        const others = zones.filter((zone) => !drag.ids.includes(zone.id) && zone.visible !== false);
        const snapped = snapMove(proposed, {
          others,
          grid: grid,
          threshold: threshold(),
          disabled: noSnap,
        });
        const finalX = clamp(snapped.rect.x, 0, 100 - group.w);
        const finalY = clamp(snapped.rect.y, 0, 100 - group.h);
        const shiftX = finalX - group.x;
        const shiftY = finalY - group.y;

        setGuides(snapped.guides);
        onChange(
          zones.map((zone) => {
            const origin = drag.origin.get(zone.id);
            if (!origin) return zone;
            return { ...zone, x: round2(origin.x + shiftX), y: round2(origin.y + shiftY) };
          }),
          true,
        );
        return;
      }

      // resize
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      const origin = drag.origin;
      const proposed: Rect = { ...origin };
      if (drag.edges.left) {
        proposed.x = origin.x + dx;
        proposed.w = origin.w - dx;
      } else if (drag.edges.right) {
        proposed.w = origin.w + dx;
      }
      if (drag.edges.top) {
        proposed.y = origin.y + dy;
        proposed.h = origin.h - dy;
      } else if (drag.edges.bottom) {
        proposed.h = origin.h + dy;
      }

      const others = zones.filter((zone) => zone.id !== drag.id && zone.visible !== false);
      const snapped = snapResize(proposed, drag.edges, {
        others,
        grid,
        threshold: threshold(),
        disabled: noSnap,
      });
      const rect = constrainRect(snapped.rect, origin, drag.edges);

      setGuides(snapped.guides);
      onChange(
        zones.map((zone) =>
          zone.id === drag.id
            ? { ...zone, x: round2(rect.x), y: round2(rect.y), w: round2(rect.w), h: round2(rect.h) }
            : zone,
        ),
        true,
      );
    }

    function onPointerUp() {
      const drag = dragRef.current;
      dragRef.current = null;
      setGuides([]);
      if (!drag) return;

      if (drag.kind === 'marquee') {
        setMarquee(null);
        const box = marqueeRef.current;
        if (box && (box.w > 0.4 || box.h > 0.4)) {
          const hit = layout.zones
            .filter((zone) => !zone.locked && zone.visible !== false && rectsIntersect(box, zoneRect(zone)))
            .map((zone) => zone.id);
          onSelectionChange(
            drag.additive ? Array.from(new Set([...selection, ...hit])) : hit,
          );
        }
        return;
      }

      if (drag.kind === 'pan') return;
      onEnd();
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [grid, layout.zones, onChange, onEnd, onSelectionChange, selection, snapEnabled, threshold, toPercent]);

  /* The marquee rect is needed by the pointerup handler, which is registered
     once and would otherwise close over the rect as it was at registration. */
  const marqueeRef = useRef<Rect | null>(null);
  marqueeRef.current = marquee;

  /* ---- space to pan, wheel to zoom --------------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false);
    };
    // Losing the window while space is down would otherwise leave the canvas
    // stuck in pan mode with no key event coming to release it.
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      onZoomChange(clamp(zoom * (event.deltaY > 0 ? 0.94 : 1.06), 0.25, 4));
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [onZoomChange, zoom]);

  /* ---- render ------------------------------------------------------------- */
  /* The draft layout and its background go in; everything else about the stage
     — theme, live text, the program feed — is whatever the stage actually has. */
  const previewState: StageState = {
    ...stageState,
    layout,
    backgroundColor: layout.bgColor,
  };

  const gridStyle: CSSProperties | undefined = showGrid && grid > 0
    ? {
      backgroundImage:
        'linear-gradient(to right, rgba(255,255,255,0.11) 1px, transparent 1px),'
        + 'linear-gradient(to bottom, rgba(255,255,255,0.11) 1px, transparent 1px)',
      backgroundSize: `${grid}% ${grid}%`,
    }
    : undefined;

  return (
    <div className="dz-viewport" ref={viewportRef} data-panning={spaceHeld || undefined}>
      <div className="dz-canvas" style={{ width: boxW, height: boxH }}>
        <div
          className="dz-stage"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
        >
          <StageSurface
            state={previewState}
            program={programState}
            chrome={false}
            assetBaseUrl={assetBaseUrl}
          />
        </div>

        <div
          className="dz-overlay"
          ref={overlayRef}
          onPointerDown={onSurfacePointerDown}
          style={gridStyle}
        >
          {/* Thirds and centre lines, always on. Placing a confidence monitor
              is mostly about the middle of the screen and the eye is bad at
              finding it unaided. */}
          <div className="dz-centre dz-centre-v" />
          <div className="dz-centre dz-centre-h" />

          {layout.zones.map((zone) => {
            const selected = selection.includes(zone.id);
            const hiddenByTheme = hiddenTypes.has(zone.type);
            return (
              <div
                key={zone.id}
                className="dz-zone"
                data-selected={selected || undefined}
                data-locked={zone.locked || undefined}
                data-invisible={zone.visible === false || undefined}
                data-theme-hidden={hiddenByTheme || undefined}
                /* A zone near the top of the stage has no room for a tag above
                   it, and the overlay clips its overflow — the tag would
                   simply not be there. Those wear it on the inside. */
                data-tag-inside={zone.y < 3 || undefined}
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
                onPointerDown={(event) => {
                  if (zone.locked) return;
                  onZonePointerDown(event, zone);
                }}
              >
                <span className="dz-zone-tag">
                  {zone.label || ZONE_LABELS[zone.type as keyof typeof ZONE_LABELS] || zone.type}
                  {zone.locked && <span className="dz-tag-icon" title="Locked"><Locked /></span>}
                  {zone.visible === false && <span className="dz-tag-icon" title="Hidden"><EyeOff /></span>}
                  {hiddenByTheme && (
                    <span className="dz-tag-icon" title="Hidden by the stage theme's Show toggles">
                      <ThemeHidden />
                    </span>
                  )}
                </span>

                {selected && selection.length === 1 && !zone.locked && HANDLES.map((handle) => (
                  <span
                    key={handle.id}
                    className={`dz-handle dz-handle-${handle.id}`}
                    style={{ cursor: handle.cursor }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      startResize(event, zone.id, handle.edges);
                    }}
                  />
                ))}
              </div>
            );
          })}

          {guides.map((guide, index) => (
            <div
              key={`${guide.axis}-${guide.at}-${index}`}
              className={`dz-guide dz-guide-${guide.axis}`}
              style={
                guide.axis === 'x'
                  ? { left: `${guide.at}%`, top: `${guide.from}%`, height: `${guide.to - guide.from}%` }
                  : { top: `${guide.at}%`, left: `${guide.from}%`, width: `${guide.to - guide.from}%` }
              }
            />
          ))}

          {marquee && (
            <div
              className="dz-marquee"
              style={{
                left: `${marquee.x}%`,
                top: `${marquee.y}%`,
                width: `${marquee.w}%`,
                height: `${marquee.h}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Keep a resized rect on the stage and above the minimum size.
 *
 * Clamping width alone is not enough. Dragging the left handle past the right
 * edge inverts the rect, and a naive `Math.max(w, min)` leaves x where the
 * pointer put it — the zone jumps across the screen. So a shrinking edge stops
 * at the fixed edge's minimum instead.
 */
function constrainRect(rect: Rect, origin: Rect, edges: HandleEdges): Rect {
  const next = { ...rect };

  if (edges.left) {
    const right = origin.x + origin.w;
    next.x = clamp(next.x, 0, right - MIN_ZONE_SIZE);
    next.w = right - next.x;
  } else if (edges.right) {
    next.w = clamp(next.w, MIN_ZONE_SIZE, 100 - next.x);
  }

  if (edges.top) {
    const bottom = origin.y + origin.h;
    next.y = clamp(next.y, 0, bottom - MIN_ZONE_SIZE);
    next.h = bottom - next.y;
  } else if (edges.bottom) {
    next.h = clamp(next.h, MIN_ZONE_SIZE, 100 - next.y);
  }

  return next;
}

export default DesignerCanvas;
