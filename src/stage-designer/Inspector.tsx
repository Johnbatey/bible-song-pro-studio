/* =========================================================================
   <Inspector> — every property of the selected zone
   -------------------------------------------------------------------------
   The canvas is for geometry you can see; this is for the rest, plus numeric
   geometry for when "roughly there" is not good enough.

   Two things here are less obvious than they look. Colour is a token by
   default — `accent`, `text`, `muted` — because a zone that stores #fbbf24
   stops following the operator's theme the moment they change their accent,
   and a layout built in the office then looks wrong in the room. A literal
   colour is still allowed, deliberately, as an escape hatch.

   And number fields commit on change with a coalesce key rather than on blur,
   so the canvas tracks the arrow keys live while the whole run of them stays
   a single undo.
   ========================================================================= */
import type { ChangeEvent } from 'react';
import type { StageZone, ZoneType } from '../stage/layouts';
import { ZONE_HINTS, ZONE_LABELS, ZONE_TYPES } from '../stage/layout-model';
import {
  AlignBottom,
  AlignHCentre,
  AlignLeft,
  AlignRight,
  AlignTop,
  AlignVMiddle,
} from './icons';

/** Kept to faces that exist on a bare machine: the stage window may be on a
    box that never loaded the app's own fonts. */
const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: 'Theme default', value: '' },
  { label: 'Inter / system', value: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Courier New', value: "'Courier New', Courier, monospace" },
];

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

const COLOR_TOKENS: Array<{ token: string; label: string; hint: string }> = [
  { token: 'text', label: 'Text', hint: "The theme's text colour" },
  { token: 'accent', label: 'Accent', hint: "The theme's accent colour" },
  { token: 'muted', label: 'Muted', hint: 'Text at 42% — for secondary lines' },
  { token: 'faint', label: 'Faint', hint: 'Text at 28% — for the clock and chrome' },
];

/** Zone types that draw a reference line above their body. */
const HAS_REFERENCE = new Set<ZoneType>(['current-text', 'slide']);

export interface InspectorProps {
  zone: StageZone | null;
  /** How many zones are selected, so the panel can offer the group tools
      instead of pretending one of them is "the" selection. */
  selectionCount: number;
  onChange: (patch: Partial<StageZone>, coalesceKey?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (edge: 'left' | 'hcentre' | 'right' | 'top' | 'vmiddle' | 'bottom') => void;
  onDistribute: (axis: 'h' | 'v') => void;
  onFill: () => void;
}

export function Inspector({
  zone,
  selectionCount,
  onChange,
  onDuplicate,
  onDelete,
  onAlign,
  onDistribute,
  onFill,
}: InspectorProps) {
  const alignTools = (
    <div className="dz-field">
      <span className="dz-field-label">
        {selectionCount > 1 ? `Align ${selectionCount} zones` : 'Align to stage'}
      </span>
      <div className="dz-btn-row dz-icon-row">
        <button type="button" onClick={() => onAlign('left')} title="Align left edges" aria-label="Align left edges"><AlignLeft /></button>
        <button type="button" onClick={() => onAlign('hcentre')} title="Centre horizontally" aria-label="Centre horizontally"><AlignHCentre /></button>
        <button type="button" onClick={() => onAlign('right')} title="Align right edges" aria-label="Align right edges"><AlignRight /></button>
        <button type="button" onClick={() => onAlign('top')} title="Align top edges" aria-label="Align top edges"><AlignTop /></button>
        <button type="button" onClick={() => onAlign('vmiddle')} title="Centre vertically" aria-label="Centre vertically"><AlignVMiddle /></button>
        <button type="button" onClick={() => onAlign('bottom')} title="Align bottom edges" aria-label="Align bottom edges"><AlignBottom /></button>
      </div>
      {selectionCount > 2 && (
        <div className="dz-btn-row">
          <button type="button" onClick={() => onDistribute('h')}>Distribute across</button>
          <button type="button" onClick={() => onDistribute('v')}>Distribute down</button>
        </div>
      )}
    </div>
  );

  if (selectionCount > 1) {
    return (
      <div className="dz-inspector">
        <h2 className="dz-panel-title">{selectionCount} zones selected</h2>
        {alignTools}
        <div className="dz-btn-row">
          <button type="button" onClick={onDuplicate}>Duplicate</button>
          <button type="button" className="dz-danger" onClick={onDelete}>Delete</button>
        </div>
        <p className="dz-note">
          Drag on the canvas to move them together. Select a single zone to edit its properties.
        </p>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="dz-inspector">
        <h2 className="dz-panel-title">Inspector</h2>
        <p className="dz-note">
          Select a zone on the canvas or in the layer list. Drag on empty stage to marquee-select.
        </p>
      </div>
    );
  }

  const numberField = (
    label: string,
    key: 'x' | 'y' | 'w' | 'h' | 'fontSize',
    min: number,
    max: number,
    step = 1,
    suffix = '%',
  ) => (
    <label className="dz-field dz-field-inline" key={key}>
      <span className="dz-field-label">{label}</span>
      <span className="dz-input-suffix">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={roundForInput(zone[key] as number)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const raw = event.currentTarget.value;
            if (raw === '') return;
            onChange({ [key]: Number(raw) } as Partial<StageZone>, `${key}:${zone.id}`);
          }}
        />
        <em>{suffix}</em>
      </span>
    </label>
  );

  return (
    <div className="dz-inspector">
      <h2 className="dz-panel-title">Zone</h2>

      <label className="dz-field">
        <span className="dz-field-label">Type</span>
        <select
          value={zone.type}
          onChange={(event) => onChange({ type: event.currentTarget.value as ZoneType })}
        >
          {ZONE_TYPES.map((type) => (
            <option key={type} value={type}>{ZONE_LABELS[type]}</option>
          ))}
        </select>
      </label>
      <p className="dz-note dz-note-tight">{ZONE_HINTS[zone.type as ZoneType] || ''}</p>

      <label className="dz-field">
        <span className="dz-field-label">Name</span>
        <input
          type="text"
          value={zone.label || ''}
          placeholder={ZONE_LABELS[zone.type as ZoneType] || zone.type}
          onChange={(event) => onChange({ label: event.currentTarget.value }, `label:${zone.id}`)}
        />
      </label>

      <div className="dz-section-title">Geometry</div>
      <div className="dz-grid-2">
        {numberField('X', 'x', 0, 100, 0.5)}
        {numberField('Y', 'y', 0, 100, 0.5)}
        {numberField('Width', 'w', 3, 100, 0.5)}
        {numberField('Height', 'h', 3, 100, 0.5)}
      </div>
      <div className="dz-btn-row">
        <button type="button" onClick={onFill}>Fill stage</button>
      </div>
      {alignTools}

      <div className="dz-section-title">Type</div>
      <div className="dz-grid-2">
        {numberField('Size', 'fontSize', 4, 400, 1, 'px')}
        <label className="dz-field dz-field-inline">
          <span className="dz-field-label">Weight</span>
          <select
            value={zone.fontWeight ?? 600}
            onChange={(event) => onChange({ fontWeight: Number(event.currentTarget.value) })}
          >
            {WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
          </select>
        </label>
      </div>
      <p className="dz-note dz-note-tight">
        Sizes are for a 1920&times;1080 stage and are multiplied by the theme&rsquo;s font scale.
      </p>

      <label className="dz-field">
        <span className="dz-field-label">Font</span>
        <select
          value={zone.fontFamily || ''}
          onChange={(event) => onChange({ fontFamily: event.currentTarget.value || undefined })}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.label} value={font.value}>{font.label}</option>
          ))}
        </select>
      </label>

      <div className="dz-field">
        <span className="dz-field-label">Align</span>
        <div className="dz-segmented">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              type="button"
              data-active={(zone.textAlign || 'left') === align || undefined}
              onClick={() => onChange({ textAlign: align })}
            >
              {align === 'left' ? 'Left' : align === 'center' ? 'Centre' : 'Right'}
            </button>
          ))}
        </div>
      </div>

      {HAS_REFERENCE.has(zone.type as ZoneType) && (
        <label className="dz-field dz-field-inline">
          <span className="dz-field-label">Reference size</span>
          <span className="dz-input-suffix">
            <input
              type="number"
              min={10}
              max={200}
              value={zone.referenceFontScale ?? 42}
              onChange={(event) => {
                const raw = event.currentTarget.value;
                if (raw === '') return;
                onChange({ referenceFontScale: Number(raw) }, `ref:${zone.id}`);
              }}
            />
            <em>% of body</em>
          </span>
        </label>
      )}

      <div className="dz-section-title">Colour</div>
      <div className="dz-field">
        <span className="dz-field-label">Text</span>
        <div className="dz-segmented dz-segmented-wrap">
          {COLOR_TOKENS.map((item) => (
            <button
              key={item.token}
              type="button"
              title={item.hint}
              data-active={zone.color === item.token || undefined}
              onClick={() => onChange({ color: item.token })}
            >
              {item.label}
            </button>
          ))}
          <input
            type="color"
            className="dz-color"
            title="A literal colour — stops following the theme"
            value={/^#[0-9a-f]{6}$/i.test(zone.color || '') ? (zone.color as string) : '#ffffff'}
            onChange={(event) => onChange({ color: event.currentTarget.value }, `color:${zone.id}`)}
          />
        </div>
        {/^#/.test(zone.color || '') && (
          <p className="dz-note dz-note-tight dz-warn">
            A fixed colour ignores the operator&rsquo;s theme.
          </p>
        )}
      </div>

      <div className="dz-field">
        <span className="dz-field-label">Background</span>
        <div className="dz-btn-row">
          <input
            type="color"
            className="dz-color"
            value={/^#[0-9a-f]{6}$/i.test(zone.bgColor || '') ? (zone.bgColor as string) : '#000000'}
            onChange={(event) => onChange({ bgColor: event.currentTarget.value }, `bg:${zone.id}`)}
          />
          <button type="button" onClick={() => onChange({ bgColor: undefined })}>Clear</button>
          <span className="dz-swatch-note">{zone.bgColor || 'transparent'}</span>
        </div>
      </div>

      <div className="dz-grid-2">
        <label className="dz-field dz-field-inline">
          <span className="dz-field-label">Radius</span>
          <span className="dz-input-suffix">
            <input
              type="number"
              min={0}
              max={200}
              value={zone.borderRadius ?? 0}
              onChange={(event) => onChange({ borderRadius: Number(event.currentTarget.value) || undefined }, `radius:${zone.id}`)}
            />
            <em>px</em>
          </span>
        </label>
        <label className="dz-field dz-field-inline">
          <span className="dz-field-label">Padding</span>
          <span className="dz-input-suffix">
            <input
              type="number"
              min={0}
              max={200}
              value={zone.padding ?? 0}
              onChange={(event) => onChange({ padding: Number(event.currentTarget.value) || undefined }, `padding:${zone.id}`)}
            />
            <em>px</em>
          </span>
        </label>
      </div>

      <div className="dz-btn-row dz-btn-row-end">
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="dz-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function roundForInput(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export default Inspector;
