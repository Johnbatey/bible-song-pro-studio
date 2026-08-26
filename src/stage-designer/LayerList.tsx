/* =========================================================================
   <LayerList> — the zones, topmost first, dragged into order
   -------------------------------------------------------------------------
   Zones paint in array order, so the last one in the layout is the one on top.
   The list is therefore reversed: every design tool puts the front layer at
   the top of the list, and matching that costs one `.slice().reverse()` here
   rather than a lifetime of operators reading the list upside down.

   Reordering is a drag. The first version used a pair of arrow buttons per
   row, which meant four controls fighting for a 230px rail and a move of three
   places costing three clicks. Dragging is what the gesture is, so the row
   carries a grip and the list shows where the row would land.

   The drag is pointer-based rather than HTML5 drag-and-drop: DnD in Electron
   brings its own ghost image, its own cursor rules and a dragover event that
   fires on the wrong element half the time. Pointer events are the same ones
   the canvas already uses, and they behave.
   ========================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { StageZone } from '../stage/layouts';
import { ZONE_LABELS } from '../stage/layout-model';
import { Eye, EyeOff, GripDots, Locked, Unlocked, ZONE_ICONS } from './icons';

/** How far the pointer travels before a press becomes a drag. Below this a
    press is a click that selects, which is what most presses are. */
const DRAG_THRESHOLD_PX = 4;

export interface LayerListProps {
  zones: StageZone[];
  selection: string[];
  hiddenTypes: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string, key: 'visible' | 'locked') => void;
  /** Both indices are into `zones` — array order, not display order. */
  onReorder: (from: number, to: number) => void;
}

interface DragState {
  /** Index into `zones` of the row being dragged. */
  from: number;
  startY: number;
  active: boolean;
}

export function LayerList({ zones, selection, hiddenTypes, onSelect, onToggle, onReorder }: LayerListProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  /** Display order: front layer first. */
  const ordered = zones.slice().reverse();
  const toDisplayIndex = (arrayIndex: number) => zones.length - 1 - arrayIndex;

  /** Which gap the pointer is currently over, in display positions 0..n. */
  const gapUnderPointer = useCallback((clientY: number): number => {
    const list = listRef.current;
    if (!list) return 0;
    const rows = [...list.children] as HTMLElement[];
    for (let i = 0; i < rows.length; i += 1) {
      const rect = rows[i].getBoundingClientRect();
      // Past a row's midpoint means the drop goes below it, which is the gap
      // after it. Testing against the midpoint rather than the edges is what
      // makes the indicator flip once per row instead of flickering in the
      // dead space between them.
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rows.length;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent, arrayIndex: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { from: arrayIndex, startY: event.clientY, active: false };
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const state = dragRef.current;
      if (!state) return;
      if (!state.active) {
        if (Math.abs(event.clientY - state.startY) < DRAG_THRESHOLD_PX) return;
        state.active = true;
      }
      setDrag({ from: state.from, over: gapUnderPointer(event.clientY) });
    }

    function onUp() {
      const state = dragRef.current;
      dragRef.current = null;
      if (!state?.active) { setDrag(null); return; }

      setDrag((current) => {
        if (current) commit(current.from, current.over);
        return null;
      });
    }

    function commit(fromArray: number, overDisplay: number) {
      const fromDisplay = toDisplayIndex(fromArray);
      /* A row dropped into a gap below itself lands one place higher than the
         gap index suggests, because removing it first shifts everything after
         it up. Every list-reorder bug is some version of forgetting this. */
      const target = overDisplay > fromDisplay ? overDisplay - 1 : overDisplay;
      if (target === fromDisplay) return;
      onReorder(fromArray, zones.length - 1 - target);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gapUnderPointer, onReorder, zones.length]);

  return (
    <div className="dz-layers">
      <h2 className="dz-panel-title">
        Layers
        <span className="dz-panel-count">{zones.length}</span>
      </h2>

      {zones.length === 0 && (
        <p className="dz-note">No zones yet. Add one from the toolbar over the canvas.</p>
      )}

      <ul className="dz-layer-list" ref={listRef} data-dragging={drag ? '' : undefined}>
        {ordered.map((zone, displayIndex) => {
          const arrayIndex = zones.length - 1 - displayIndex;
          const selected = selection.includes(zone.id);
          const typeName = ZONE_LABELS[zone.type as keyof typeof ZONE_LABELS] || zone.type;
          const title = zone.label || typeName;
          const notes = [
            title === typeName ? '' : typeName,
            hiddenTypes.has(zone.type) ? 'hidden by theme' : '',
          ].filter(Boolean);
          const Icon = ZONE_ICONS[zone.type];
          const beingDragged = drag?.from === arrayIndex;

          return (
            <li
              key={zone.id}
              className="dz-layer"
              data-selected={selected || undefined}
              data-invisible={zone.visible === false || undefined}
              data-dragged={beingDragged || undefined}
              data-drop-before={drag?.over === displayIndex || undefined}
              data-drop-after={(drag && drag.over === ordered.length && displayIndex === ordered.length - 1) || undefined}
            >
              {/* 1. Visibility (Eye) Toggle Button on Far Left */}
              <button
                type="button"
                className="dz-layer-vis-btn"
                title={zone.visible === false ? 'Show on the stage' : 'Hide from the stage'}
                aria-label={zone.visible === false ? 'Show on the stage' : 'Hide from the stage'}
                data-active={zone.visible === false || undefined}
                onClick={() => onToggle(zone.id, 'visible')}
              >
                {zone.visible === false ? <EyeOff /> : <Eye />}
              </button>

              {/* 2. Zone Name & Icon */}
              <button
                type="button"
                className="dz-layer-name"
                onClick={(event) => onSelect(zone.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                title={`${typeName} — ${Math.round(zone.w)}×${Math.round(zone.h)}%`}
              >
                {Icon && <span className="dz-layer-icon"><Icon /></span>}
                <span className="dz-layer-text">
                  <span className="dz-layer-title">{title}</span>
                  {notes.length > 0 && <span className="dz-layer-type">{notes.join(' · ')}</span>}
                </span>
              </button>

              {/* 3. Actions (Lock/Unlock) */}
              <div className="dz-layer-actions">
                <button
                  type="button"
                  title={zone.locked ? 'Unlock' : 'Lock — stops the canvas selecting it'}
                  aria-label={zone.locked ? 'Unlock' : 'Lock'}
                  data-active={zone.locked || undefined}
                  onClick={() => onToggle(zone.id, 'locked')}
                >
                  {zone.locked ? <Locked /> : <Unlocked />}
                </button>
              </div>

              {/* 4. Drag Grip Handle on Far Right */}
              <span
                className="dz-layer-grip"
                title="Drag to reorder — the top of this list is the front of the stage"
                onPointerDown={(event) => onPointerDown(event, arrayIndex)}
              >
                <GripDots />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LayerList;
