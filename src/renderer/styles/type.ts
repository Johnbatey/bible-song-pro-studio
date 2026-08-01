import type { CSSProperties } from 'react';

/**
 * Bible Song Pro — operator UI type system.
 *
 * Six sizes, four weights, three tracking values. Hierarchy comes from weight
 * and color, not size: at 11–15px a 2px step is nearly invisible, a 400→600
 * step is not.
 *
 * This covers the app chrome only. Projected output (ProgramSurface, theme
 * presets, the audience/stage windows) is user-controlled and uses its own
 * fluid sizing — do not reach for these tokens there.
 *
 * The CSS mirror of this lives in styles/global.css as `.t-*` utility classes.
 * Use the classes where an element already has a className; use these objects
 * where the component builds inline style records.
 */

export const fontSize = {
  display: 20,
  title: 15,
  heading: 13,
  body: 13,
  secondary: 12,
  caption: 11,
  label: 11,
} as const;

export const fontWeight = {
  /** Body, descriptions, inactive nav. */
  regular: 400,
  /** Interactive labels, buttons, emphasis. */
  medium: 500,
  /** Titles, headings, active nav, uppercase labels. */
  semibold: 600,
  /** Reserved for LIVE / critical status badges only. */
  bold: 700,
} as const;

/** Icon and glyph sizing — not type, but kept here so it stops leaking into the scale. */
export const iconSize = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

export const type = {
  /** Transcript readout, session timer. The only text in the UI above 15px. */
  display: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  /** Panel titles, modal header brand. */
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
  },
  /** Section headings, settings group titles, list-item primary line. */
  heading: {
    fontSize: fontSize.heading,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.4,
  },
  /** Default UI text, inputs, buttons, sidebar nav. */
  body: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: 1.5,
  },
  /** Supporting text, field descriptions, meta rows. */
  secondary: {
    fontSize: fontSize.secondary,
    fontWeight: fontWeight.regular,
    lineHeight: 1.45,
  },
  /** Metadata, hints, timestamps, helper text. */
  caption: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: 1.4,
  },
  /** Uppercase micro-labels, section rails, badges. */
  label: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.2,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
} satisfies Record<string, CSSProperties>;

/**
 * Tabular figures. Spread onto counters, confidence %, timecodes and verse
 * numbers so digits stop shifting width as they update.
 */
export const numeric: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** Monospace readouts (timers, counters that need the mono voice). */
export const mono: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};
