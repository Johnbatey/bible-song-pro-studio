/* =========================================================================
   <LayerList> — the zones, topmost first
   -------------------------------------------------------------------------
   Zones paint in array order, so the last one in the layout is the one on top.
   The list is therefore reversed: every design tool puts the front layer at
   the top of the list, and matching that costs one `.slice().reverse()` here
   rather than a lifetime of operators reading the list upside down.

   Order is changed with buttons rather than by dragging rows. Drag-reorder is
   a second way to do a thing the canvas already does better, and it competes
   for the same pointer gestures as selection; Cmd+] and Cmd+[ do it without
   any of that.
   ========================================================================= */
import type { StageZone } from '../stage/layouts';
import { ZONE_LABELS } from '../stage/layout-model';
import { ArrowDown, ArrowUp, Eye, EyeOff, Locked, Unlocked } from './icons';

export interface LayerListProps {
  zones: StageZone[];
  selection: string[];
  hiddenTypes: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string, key: 'visible' | 'locked') => void;
  onRaise: (id: string) => void;
  onLower: (id: string) => void;
}

export function LayerList({
  zones,
  selection,
  hiddenTypes,
  onSelect,
  onToggle,
  onRaise,
  onLower,
}: LayerListProps) {
  const ordered = zones.slice().reverse();

  return (
    <div className="dz-layers">
      <h2 className="dz-panel-title">
        Layers
        <span className="dz-panel-count">{zones.length}</span>
      </h2>

      {zones.length === 0 && (
        <p className="dz-note">No zones yet. Add one from the toolbar above the canvas.</p>
      )}

      <ul className="dz-layer-list">
        {ordered.map((zone) => {
          const selected = selection.includes(zone.id);
          const index = zones.indexOf(zone);
          const typeName = ZONE_LABELS[zone.type as keyof typeof ZONE_LABELS] || zone.type;
          const title = zone.label || typeName;
          const notes = [
            title === typeName ? '' : typeName,
            hiddenTypes.has(zone.type) ? 'hidden by theme' : '',
          ].filter(Boolean);
          const subtitle = notes.join(' · ');
          return (
            <li
              key={zone.id}
              className="dz-layer"
              data-selected={selected || undefined}
              data-invisible={zone.visible === false || undefined}
            >
              <button
                type="button"
                className="dz-layer-name"
                onClick={(event) => onSelect(zone.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                title={`${ZONE_LABELS[zone.type as keyof typeof ZONE_LABELS] || zone.type} — ${Math.round(zone.w)}×${Math.round(zone.h)}%`}
              >
                <span className="dz-layer-title">{title}</span>
                {/* Only when it adds something. A row reading "Timer / Timer"
                    spends a line saying nothing. */}
                {subtitle && <span className="dz-layer-type">{subtitle}</span>}
              </button>

              <div className="dz-layer-actions">
                <button
                  type="button"
                  title="Bring forward (Cmd+])"
                  aria-label="Bring forward"
                  disabled={index === zones.length - 1}
                  onClick={() => onRaise(zone.id)}
                ><ArrowUp /></button>
                <button
                  type="button"
                  title="Send backward (Cmd+[)"
                  aria-label="Send backward"
                  disabled={index === 0}
                  onClick={() => onLower(zone.id)}
                ><ArrowDown /></button>
                <button
                  type="button"
                  title={zone.visible === false ? 'Show on the stage' : 'Hide from the stage'}
                  aria-label={zone.visible === false ? 'Show on the stage' : 'Hide from the stage'}
                  data-active={zone.visible === false || undefined}
                  onClick={() => onToggle(zone.id, 'visible')}
                >{zone.visible === false ? <EyeOff /> : <Eye />}</button>
                <button
                  type="button"
                  title={zone.locked ? 'Unlock' : 'Lock — stops the canvas selecting it'}
                  aria-label={zone.locked ? 'Unlock' : 'Lock'}
                  data-active={zone.locked || undefined}
                  onClick={() => onToggle(zone.id, 'locked')}
                >{zone.locked ? <Locked /> : <Unlocked />}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LayerList;
