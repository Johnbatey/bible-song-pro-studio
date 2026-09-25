import React, { useRef, useState } from 'react';
import type { StageZone } from '../stage/layouts';
import { ZONE_LABELS } from '../stage/layout-model';
import { Eye, EyeOff, GripDots, Locked, Unlocked, ZONE_ICONS } from './icons';

export interface LayerListProps {
  zones: StageZone[];
  selection: string[];
  hiddenTypes: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string, key: 'visible' | 'locked') => void;
  /** Both indices are into `zones` — array order, not display order. */
  onReorder: (from: number, to: number) => void;
}

export function LayerList({ zones, selection, hiddenTypes, onSelect, onToggle, onReorder }: LayerListProps) {
  const listRef = useRef<HTMLUListElement | null>(null);

  // Pointer-based fluid drag state
  const [dragState, setDragState] = useState<{
    draggedIndex: number;
    overIndex: number;
    deltaY: number;
    itemHeight: number;
  } | null>(null);

  const dragInfoRef = useRef<{
    startIndex: number;
    startY: number;
    rects: { center: number; height: number }[];
    itemHeight: number;
    hasMoved: boolean;
  } | null>(null);

  /** Display order: front layer first. */
  const ordered = zones.slice().reverse();

  const handlePointerDown = (e: React.PointerEvent, displayIndex: number) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, a, select')) return;

    const container = listRef.current;
    if (!container) return;

    const children = Array.from(container.children) as HTMLElement[];
    const rects = children.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        height: r.height,
        center: r.top + r.height / 2,
      };
    });

    const itemHeight = rects[displayIndex]?.height || 36;
    dragInfoRef.current = {
      startIndex: displayIndex,
      startY: e.clientY,
      rects,
      itemHeight,
      hasMoved: false,
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!dragInfoRef.current) return;
      const { startIndex, startY, rects: itemRects, itemHeight: h } = dragInfoRef.current;
      const deltaY = moveEv.clientY - startY;

      if (!dragInfoRef.current.hasMoved && Math.abs(deltaY) > 3) {
        dragInfoRef.current.hasMoved = true;
      }

      if (dragInfoRef.current.hasMoved) {
        const currentCenter = (itemRects[startIndex]?.center || 0) + deltaY;
        let newOver = startIndex;
        let minDiff = Infinity;

        for (let i = 0; i < itemRects.length; i++) {
          const diff = Math.abs(itemRects[i].center - currentCenter);
          if (diff < minDiff) {
            minDiff = diff;
            newOver = i;
          }
        }

        setDragState({
          draggedIndex: startIndex,
          overIndex: newOver,
          deltaY,
          itemHeight: h,
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      const info = dragInfoRef.current;
      dragInfoRef.current = null;

      if (info && info.hasMoved) {
        setDragState((prev) => {
          if (prev && prev.draggedIndex !== prev.overIndex) {
            const fromArray = zones.length - 1 - prev.draggedIndex;
            const toArray = zones.length - 1 - prev.overIndex;
            onReorder(fromArray, toArray);
          }
          return null;
        });
      } else {
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="dz-layers">
      <h2 className="dz-panel-title">
        Layers
        <span className="dz-panel-count">{zones.length}</span>
      </h2>

      {zones.length === 0 && (
        <p className="dz-note">No zones yet. Add one from the toolbar over the canvas.</p>
      )}

      <ul className="dz-layer-list" ref={listRef}>
        {ordered.map((zone, displayIndex) => {
          const selected = selection.includes(zone.id);
          const typeName = ZONE_LABELS[zone.type as keyof typeof ZONE_LABELS] || zone.type;
          const title = zone.label || typeName;
          const notes = [
            title === typeName ? '' : typeName,
            hiddenTypes.has(zone.type) ? 'hidden by theme' : '',
          ].filter(Boolean);
          const Icon = ZONE_ICONS[zone.type];
          const isThisDragged = dragState?.draggedIndex === displayIndex;

          // Fluid animated displacement calculation
          let transform = 'none';
          if (dragState) {
            const { draggedIndex, overIndex, deltaY, itemHeight } = dragState;
            const shift = itemHeight + 4; // gap between items
            if (isThisDragged) {
              transform = `translateY(${deltaY}px) scale(1.02)`;
            } else if (draggedIndex < overIndex && displayIndex > draggedIndex && displayIndex <= overIndex) {
              transform = `translateY(-${shift}px)`;
            } else if (draggedIndex > overIndex && displayIndex < draggedIndex && displayIndex >= overIndex) {
              transform = `translateY(${shift}px)`;
            }
          }

          return (
            <li
              key={zone.id}
              className="dz-layer"
              data-selected={selected || undefined}
              data-invisible={zone.visible === false || undefined}
              data-dragged={isThisDragged || undefined}
              onPointerDown={(e) => handlePointerDown(e, displayIndex)}
              style={{
                transform,
                zIndex: isThisDragged ? 50 : 1,
                boxShadow: isThisDragged ? '0 12px 28px rgba(0, 0, 0, 0.5)' : undefined,
                opacity: isThisDragged ? 0.95 : 1,
                transition: isThisDragged
                  ? 'box-shadow 0.15s ease, opacity 0.15s ease'
                  : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), background 0.15s ease, border-color 0.15s ease',
              }}
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
                title="Drag to reorder layers"
                style={{ cursor: isThisDragged ? 'grabbing' : 'grab' }}
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
