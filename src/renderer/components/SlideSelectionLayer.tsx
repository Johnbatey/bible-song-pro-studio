/* =========================================================================
   <SlideSelectionLayer> — select, move and resize shapes on a slide
   -------------------------------------------------------------------------
   Sits over <SlideCanvas> at the same size and in the same percent coordinate
   space, so a hit box is exactly the shape's box.

   PowerPoint semantics, kept: only slide-sourced shapes are selectable —
   layout and master decoration stays locked; the first click on a grouped
   shape selects the whole group, and a second click drills into the one child;
   shift-click adds or removes a unit. During a drag only this layer and the
   shape boxes move, and the XML is written once on release, so dragging across
   a 6,000-shape slide does not re-serialize anything per frame.
   ========================================================================= */
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  commitGeometryToXml,
  selectionBBox,
  unitIdsFor,
  type BBox,
  type SelectionState,
} from '../slide-engine/edit/geometry';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';

type Handle = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l';

const HANDLES: Array<{ id: Handle; cx: number; cy: number; cursor: string }> = [
  { id: 'tl', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { id: 't', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { id: 'tr', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { id: 'r', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { id: 'br', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { id: 'b', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { id: 'bl', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { id: 'l', cx: 0, cy: 0.5, cursor: 'ew-resize' },
];

/** Below this the pointer counts as a click, not a drag — so selecting a shape
    never nudges it by a pixel. */
const DRAG_THRESHOLD_PX = 3;

/** The drag border of a selected text box, in CSS px. */
const EDGE = 8;
const EDGES: Array<{ id: string; style: CSSProperties }> = [
  { id: 't', style: { left: 0, right: 0, top: -EDGE / 2, height: EDGE, cursor: 'move' } },
  { id: 'b', style: { left: 0, right: 0, bottom: -EDGE / 2, height: EDGE, cursor: 'move' } },
  { id: 'l', style: { top: 0, bottom: 0, left: -EDGE / 2, width: EDGE, cursor: 'move' } },
  { id: 'r', style: { top: 0, bottom: 0, right: -EDGE / 2, width: EDGE, cursor: 'move' } },
];

export interface SlideSelectionLayerProps {
  shapes: ParsedShape[];
  selection: SelectionState | null;
  onSelectionChange: (selection: SelectionState | null) => void;
  /** Called after geometry is committed, so the canvas can repaint. */
  onCommit: () => void;
  /** Rendered board size in CSS px — drags convert through this to percent. */
  boardWidth: number;
  boardHeight: number;
}

export function SlideSelectionLayer({
  shapes,
  selection,
  onSelectionChange,
  onCommit,
  boardWidth,
  boardHeight,
}: SlideSelectionLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<null | { cleanup: () => void }>(null);

  // A drag in flight must not outlive the component.
  useEffect(() => () => dragRef.current?.cleanup(), []);

  const members = selection
    ? shapes.filter((s) => selection.ids.includes(s.id))
    : [];
  const bbox = members.length ? selectionBBox(members) : null;
  /* One text box selected on its own: the only case where the interior has to
     stay clickable, because that is where the caret goes. */
  const selectedTextBox = members.length === 1 && members[0].kind === 'text' && !selection?.groupId;

  /* Live geometry goes straight to the DOM during a drag. Re-rendering React
     on every mousemove would re-run the whole shape tree — thousands of nodes
     on an illustration slide — for a change that is four numbers. */
  const paint = useCallback((moved: ParsedShape[]) => {
    const root = rootRef.current;
    const board = root?.previousElementSibling as HTMLElement | null;
    moved.forEach((s) => {
      const box = root?.querySelector<HTMLElement>(`[data-sel-id="${CSS.escape(s.id)}"]`);
      const live = board?.querySelector<HTMLElement>(`[data-shape-id="${CSS.escape(s.id)}"]`);
      [box, live].forEach((el) => {
        if (!el) return;
        el.style.left = `${s.left}%`;
        el.style.top = `${s.top}%`;
        el.style.width = `${s.width}%`;
        el.style.height = `${s.height}%`;
      });
    });
    const hud = root?.querySelector<HTMLElement>('[data-sel-hud]');
    if (hud && moved.length) {
      const bb = selectionBBox(moved);
      hud.style.left = `${bb.x}%`;
      hud.style.top = `${bb.y}%`;
      hud.style.width = `${bb.w}%`;
      hud.style.height = `${bb.h}%`;
    }
  }, []);

  /**
   * Shared pointer loop: `apply` moves the records, then the XML is written
   * once on release and the canvas repaints from the committed values.
   *
   * `onClick` fires when the pointer went down and up without passing the drag
   * threshold. That is how PowerPoint distinguishes moving a selected group
   * from drilling into it: press-and-drag moves, press-and-release drills.
   */
  const startPointerOp = useCallback((
    e: React.MouseEvent,
    ops: ParsedShape[],
    apply: (dxPct: number, dyPct: number, orig: Record<string, BBox>) => void,
    forSelection: SelectionState | null,
    onClick?: () => void,
  ) => {
    if (ops.length === 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origBB = selectionBBox(ops);
    const orig: Record<string, BBox> = {};
    ops.forEach((s) => { orig[s.id] = { x: s.left, y: s.top, w: s.width, h: s.height }; });
    let moved = false;

    const onMove = (mv: MouseEvent) => {
      if (!moved && Math.abs(mv.clientX - startX) + Math.abs(mv.clientY - startY) < DRAG_THRESHOLD_PX) return;
      moved = true;
      const dxPct = ((mv.clientX - startX) / boardWidth) * 100;
      const dyPct = ((mv.clientY - startY) / boardHeight) * 100;
      apply(dxPct, dyPct, orig);
      paint(ops);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      dragRef.current = null;
    };

    const onUp = () => {
      cleanup();
      if (!moved) {
        onClick?.();
        return;
      }
      commitGeometryToXml(forSelection, ops, origBB);
      onCommit();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    dragRef.current = { cleanup };
  }, [boardWidth, boardHeight, paint, onCommit]);

  const moveBy = useCallback((ops: ParsedShape[]) =>
    (dx: number, dy: number, orig: Record<string, BBox>) => {
      ops.forEach((s) => {
        const o = orig[s.id];
        s.left = o.x + dx;
        s.top = o.y + dy;
      });
    }, []);

  const beginDrag = useCallback((e: React.MouseEvent) => {
    startPointerOp(e, members, moveBy(members), selection);
  }, [members, moveBy, selection, startPointerOp]);

  const beginResize = useCallback((e: React.MouseEvent, handle: Handle) => {
    if (!bbox) return;
    const bb = bbox;
    startPointerOp(e, members, (dx, dy, orig) => {
      let nx = bb.x;
      let ny = bb.y;
      let nw = bb.w;
      let nh = bb.h;
      if (handle.includes('r')) nw = Math.max(0.3, bb.w + dx);
      if (handle.includes('l')) {
        nx = Math.min(bb.x + dx, bb.x + bb.w - 0.3);
        nw = bb.w - (nx - bb.x);
      }
      if (handle.includes('b')) nh = Math.max(0.3, bb.h + dy);
      if (handle.includes('t')) {
        ny = Math.min(bb.y + dy, bb.y + bb.h - 0.3);
        nh = bb.h - (ny - bb.y);
      }
      const kx = nw / bb.w;
      const ky = nh / bb.h;
      members.forEach((s) => {
        const o = orig[s.id];
        s.left = nx + (o.x - bb.x) * kx;
        s.top = ny + (o.y - bb.y) * ky;
        s.width = o.w * kx;
        s.height = o.h * ky;
      });
    }, selection);
  }, [bbox, members, selection, startPointerOp]);

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shape: ParsedShape) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (e.shiftKey) {
      e.preventDefault();
      const unit = unitIdsFor(shape, shapes);
      const cur = selection?.ids || [];
      const already = unit.every((id) => cur.includes(id));
      const ids = already ? cur.filter((id) => !unit.includes(id)) : [...new Set([...cur, ...unit])];
      onSelectionChange(ids.length ? { ids, groupId: null, groupNode: null } : null);
      return;
    }

    const selectSingle = (target: ParsedShape) =>
      onSelectionChange({ ids: [target.id], groupId: null, groupNode: null });

    /* Already inside the selected group: press-and-drag moves the whole group,
       press-and-release drills in and selects just this child. That ordering
       is what PowerPoint does, and it is why the drill happens on mouseUP —
       deciding on mouseDOWN would make every group drag start by drilling. */
    if (selection?.groupId && shape.groupId === selection.groupId) {
      e.preventDefault();
      const groupOps = shapes.filter((s) => selection.ids.includes(s.id));
      startPointerOp(e, groupOps, moveBy(groupOps), selection, () => selectSingle(shape));
      return;
    }

    /* A text box selected on its own passes the click through to the caret, so
       the text stays editable. Not when it is part of a group — there the
       click still belongs to the group. */
    if (selection?.ids.includes(shape.id) && !selection.groupId && shape.kind === 'text') return;

    e.preventDefault();

    // First click on a grouped shape takes the whole group.
    const asGroup = !!shape.groupId;
    const next: SelectionState = {
      ids: asGroup ? unitIdsFor(shape, shapes) : [shape.id],
      groupId: asGroup ? (shape.groupId as string) : null,
      groupNode: asGroup ? ((shape.groupNode as Element) || null) : null,
    };
    onSelectionChange(next);

    // Drag the new selection straight away, without waiting for a re-render.
    const ops = shapes.filter((s) => next.ids.includes(s.id));
    startPointerOp(e, ops, moveBy(ops), next);
  }, [shapes, selection, onSelectionChange, moveBy, startPointerOp]);

  return (
    <div
      ref={rootRef}
      style={styles.root}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onSelectionChange(null); }}
    >
      {shapes.map((shape) => {
        if (shape.editable === false) return null; // layout/master art is locked
        const selected = !!selection?.ids.includes(shape.id);
        return (
          <div
            key={shape.id}
            data-sel-id={shape.id}
            onMouseDown={(e) => handleShapeMouseDown(e, shape)}
            style={{
              position: 'absolute',
              left: `${shape.left}%`,
              top: `${shape.top}%`,
              width: `${shape.width}%`,
              height: `${shape.height}%`,
              cursor: 'move',
              // A single-shape selection outlines the shape; a group selection
              // is marked only by the one HUD box, so children stay un-outlined
              // rather than becoming a mess of nested rectangles.
              outline: selected && !selection?.groupId ? '1px solid #f97316' : undefined,
              pointerEvents: selected && shape.kind === 'text' ? 'none' : 'auto',
            }}
          />
        );
      })}

      {bbox && (
        <div data-sel-hud style={{ ...styles.hud, left: `${bbox.x}%`, top: `${bbox.y}%`, width: `${bbox.w}%`, height: `${bbox.h}%` }}>
          {/* For a group, clicks must reach the child boxes so drilling in
              stays possible; the children handle the group drag themselves. */}
          {!selection?.groupId && (
            selectedTextBox ? (
              /* A selected text box needs its interior for the caret, so the
                 border is what drags it — PowerPoint's own answer to the same
                 conflict. Without this, selecting a text box would make it
                 permanently unmovable. */
              EDGES.map((edge) => (
                <div
                  key={edge.id}
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); beginDrag(e); }}
                  style={{ ...styles.hudEdge, ...edge.style }}
                />
              ))
            ) : (
              <div style={styles.hudMove} onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); beginDrag(e); }} />
            )
          )}
          {HANDLES.map((h) => (
            <div
              key={h.id}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); beginResize(e, h.id); }}
              style={{
                ...styles.handle,
                left: `${h.cx * 100}%`,
                top: `${h.cy * 100}%`,
                cursor: h.cursor,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { position: 'absolute', inset: 0, zIndex: 2 },
  hud: { position: 'absolute', outline: '1px solid #f97316', pointerEvents: 'none' },
  /* The move surface sits inside the HUD rather than on the shape boxes, so a
     multi-shape selection drags as one from anywhere inside its bounds. */
  hudMove: { position: 'absolute', inset: 0, pointerEvents: 'auto', cursor: 'move' },
  hudEdge: { position: 'absolute', pointerEvents: 'auto' },
  handle: {
    position: 'absolute',
    width: 9,
    height: 9,
    marginLeft: -5,
    marginTop: -5,
    background: '#fff',
    border: '1px solid #f97316',
    borderRadius: 2,
    pointerEvents: 'auto',
  },
};

export default SlideSelectionLayer;
