/* =========================================================================
   Stage layouts — the shape, and how to trust one
   -------------------------------------------------------------------------
   A layout arrives from three places that have nothing in common: the preset
   table compiled into the app, a JSON file the operator's own designer wrote
   last month, and an IPC message from another window. Only the first is known
   good. Everything here exists so the other two land in the same shape as the
   first before anything tries to render them — a zone with `w: "40"` or a
   layout whose zones are an object rather than an array must be repaired at
   the door, not discovered by the stage screen mid-service.

   The designer, the operator panel and the stage reducer all normalise through
   these functions, so "what a layout is" is answered once.
   ========================================================================= */
import { LAYOUTS, type StageLayout, type StageZone, type ZoneType } from './layouts';

/** Every zone type the designer can place, in the order it offers them. */
export const ZONE_TYPES: ZoneType[] = [
  'current-text',
  'slide',
  'next-item',
  'playlist',
  'clock',
  'timer',
  'messages',
];

export const ZONE_LABELS: Record<ZoneType, string> = {
  'current-text': 'Current text',
  slide: 'Slide',
  'next-item': 'Next item',
  playlist: 'Song cue',
  clock: 'Clock',
  timer: 'Timer',
  messages: 'Messages',
};

/** One line in the designer's Add-zone menu, so an operator picking a zone is
    told what it draws rather than left to place one and find out. */
export const ZONE_HINTS: Record<ZoneType, string> = {
  'current-text': 'What is live now — the verse, the lyric, its reference.',
  slide: 'A projected slide, edge to edge. Falls back to the live text.',
  'next-item': 'What is queued behind the live item.',
  playlist: 'The song title and subtitle, as a cue line.',
  clock: 'Wall clock, to the minute.',
  timer: 'The service timer the operator starts from the desk.',
  messages: 'Broadcast notes from the desk, as red pills.',
};

/** The smallest zone the designer will let you make, in stage percent. Below
    this a zone is easy to lose behind another and impossible to grab again. */
export const MIN_ZONE_SIZE = 3;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** A number, or the fallback when the input is anything else. Strings from a
    JSON file and NaN from an emptied number input both take the fallback. */
export function num(raw: unknown, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

let idCounter = 0;

export function uid(prefix = 'zone'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** Round to two decimals. Drag maths produces percentages with sixteen of
    them, and a layout file full of 41.66666666666667 is unreadable for no
    gain — a hundredth of a stage is a fifth of a pixel on a 1080p screen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeZone(raw: Partial<StageZone> | Record<string, unknown>): StageZone {
  const z = (raw || {}) as Partial<StageZone>;
  const type = ZONE_TYPES.includes(z.type as ZoneType) ? (z.type as ZoneType) : 'current-text';

  /* Size before position: a zone is clamped to the stage by pinning its far
     edge, and doing that against an unclamped width lets a 300%-wide zone drag
     its x negative. */
  const w = clamp(round2(num(z.w, 30)), MIN_ZONE_SIZE, 100);
  const h = clamp(round2(num(z.h, 20)), MIN_ZONE_SIZE, 100);

  return {
    id: String(z.id || uid()),
    type,
    x: clamp(round2(num(z.x, 0)), 0, 100 - w),
    y: clamp(round2(num(z.y, 0)), 0, 100 - h),
    w,
    h,
    fontSize: clamp(round2(num(z.fontSize, 32)), 4, 400),
    fontWeight: clamp(Math.round(num(z.fontWeight, 600)), 100, 900),
    color: typeof z.color === 'string' && z.color ? z.color : 'text',
    textAlign: z.textAlign === 'center' || z.textAlign === 'right' ? z.textAlign : 'left',
    visible: z.visible !== false,
    // The optional half. Written only when set, so a layout file says what the
    // operator chose rather than restating every default on every zone.
    ...(typeof z.bgColor === 'string' && z.bgColor ? { bgColor: z.bgColor } : {}),
    ...(typeof z.fontFamily === 'string' && z.fontFamily ? { fontFamily: z.fontFamily } : {}),
    ...(Number.isFinite(Number(z.borderRadius)) ? { borderRadius: clamp(Math.round(Number(z.borderRadius)), 0, 200) } : {}),
    ...(Number.isFinite(Number(z.padding)) ? { padding: clamp(Math.round(Number(z.padding)), 0, 200) } : {}),
    ...(Number.isFinite(Number(z.referenceFontScale))
      ? { referenceFontScale: clamp(Math.round(Number(z.referenceFontScale)), 10, 200) }
      : {}),
    ...(typeof z.label === 'string' && z.label ? { label: z.label } : {}),
    ...(z.locked ? { locked: true } : {}),
  };
}

export function normalizeLayout(raw: unknown): StageLayout {
  const obj = (raw || {}) as Record<string, unknown>;
  const zones = Array.isArray(obj.zones) ? obj.zones : [];
  return {
    id: String(obj.id || uid('layout')),
    name: String(obj.name || 'Untitled layout').slice(0, 60) || 'Untitled layout',
    bgColor: typeof obj.bgColor === 'string' && obj.bgColor ? obj.bgColor : '#000000',
    zones: zones.map((zone) => normalizeZone(zone as Partial<StageZone>)),
  };
}

/** A deep copy with fresh ids, for "duplicate" and for opening a preset in the
    designer. Sharing zone objects with the preset table would let an edit in
    the designer mutate the compiled-in preset for the rest of the session. */
export function cloneLayout(layout: StageLayout, patch: Partial<StageLayout> = {}): StageLayout {
  return normalizeLayout({
    ...layout,
    id: uid('layout'),
    zones: layout.zones.map((zone) => ({ ...zone, id: uid() })),
    ...patch,
  });
}

/** Is this the id of a preset compiled into the app? Presets can be opened and
    copied but never overwritten — an operator who has bent Default out of
    shape needs something to come back to. */
export function isPresetId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(LAYOUTS, id);
}

/** Layouts are equal when they would render the same. Used to decide whether
    the designer has unsaved work, so the check has to ignore key order and
    the difference between an absent optional and an explicit undefined. */
export function layoutsEqual(a: StageLayout | null, b: StageLayout | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return stableJson(a) === stableJson(b);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          const inner = (val as Record<string, unknown>)[key];
          if (inner !== undefined) acc[key] = inner;
          return acc;
        }, {});
    }
    return val;
  });
}
