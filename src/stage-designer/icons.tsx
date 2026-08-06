/* =========================================================================
   Designer — icons
   -------------------------------------------------------------------------
   Drawn rather than typed. The first pass used Unicode arrows and emoji — ⇔,
   ⤒, 👁, 🔒 — and they are a lottery: the glyph a machine has for ⇕ may be a
   box, a dollar-sign lookalike, or nothing, and emoji arrive at whatever size
   and colour the platform feels like. An eye that renders as a tofu square in
   a layer row is a control nobody can identify.

   All of these inherit `currentColor` and a 1em box, so they sit in a button
   the same way a letter would.
   ========================================================================= */
import type { ReactElement } from 'react';

function Svg({ children, size = 13 }: { children: React.ReactNode; size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* Alignment. Each is a bar for the edge being aligned to, plus two blocks
   pushed against it, so the icon shows the result rather than a direction. */
export const AlignLeft = () => <Svg><path d="M4 3v18" /><rect x="8" y="6" width="12" height="4" /><rect x="8" y="14" width="8" height="4" /></Svg>;
export const AlignRight = () => <Svg><path d="M20 3v18" /><rect x="4" y="6" width="12" height="4" /><rect x="8" y="14" width="8" height="4" /></Svg>;
export const AlignHCentre = () => <Svg><path d="M12 3v18" /><rect x="4" y="6" width="16" height="4" /><rect x="7" y="14" width="10" height="4" /></Svg>;
export const AlignTop = () => <Svg><path d="M3 4h18" /><rect x="6" y="8" width="4" height="12" /><rect x="14" y="8" width="4" height="8" /></Svg>;
export const AlignBottom = () => <Svg><path d="M3 20h18" /><rect x="6" y="4" width="4" height="12" /><rect x="14" y="8" width="4" height="8" /></Svg>;
export const AlignVMiddle = () => <Svg><path d="M3 12h18" /><rect x="6" y="4" width="4" height="16" /><rect x="14" y="7" width="4" height="10" /></Svg>;

export const ArrowUp = () => <Svg><path d="M12 19V5M5 12l7-7 7 7" /></Svg>;
export const ArrowDown = () => <Svg><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>;

export const Undo = () => <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10H9" /></Svg>;
export const Redo = () => <Svg><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h6" /></Svg>;

export const Eye = () => <Svg size={12}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const EyeOff = () => (
  <Svg size={12}>
    <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6" />
    <path d="M6.2 6.6A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.4-1" />
    <path d="m2 2 20 20" />
  </Svg>
);

export const Locked = () => <Svg size={12}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>;
export const Unlocked = () => <Svg size={12}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></Svg>;

/** Marks a zone the operator's theme is currently suppressing. */
export const ThemeHidden = () => <Svg size={11}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></Svg>;
