/* =========================================================================
   TallyBadge — the lamp on a thumbnail
   -------------------------------------------------------------------------
   Pro Slides drew this first and got it right, so its shape is the one every
   panel with a thumbnail now uses: top-right of the frame, small enough that
   it never competes with the picture it is labelling, and coloured by the
   tally rules — orange is on the screen, green is cued and safe.

   One component rather than a copy per panel. A badge that means "live" in
   Media and "live" in Pro Slides but is a different size in each is a badge
   the operator has to read twice, and the whole point of a tally is that it
   is read without being read.
   ========================================================================= */
import type { CSSProperties } from 'react';

export type TallyState = 'live' | 'cued';

const FACE: Record<TallyState, { label: string; background: string; glow: string }> = {
  /* Program orange and preview green come from the tokens, not from the hex
     they happen to resolve to — the tally palette is one decision, made in
     tokens.css, and a panel is not a place to re-make it. */
  live: { label: 'LIVE', background: 'var(--tally-program)', glow: '0 2px 6px var(--bsp-signal-glow)' },
  cued: { label: 'CUED', background: 'var(--tally-preview)', glow: '0 2px 6px rgba(34, 197, 94, 0.5)' },
};

/**
 * Draws into the nearest positioned ancestor — give the thumbnail wrapper
 * `position: relative` and this sits in its top-right corner.
 */
export function TallyBadge({ state, style }: { state: TallyState; style?: CSSProperties }) {
  const face = FACE[state];
  return (
    <div style={{ ...styles.badge, background: face.background, boxShadow: face.glow, ...style }}>
      <span style={styles.dot} />
      {face.label}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    /* The badge is a label, never a target — clicking where it happens to
       cover must still reach the tile underneath. */
    pointerEvents: 'none',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#ffffff',
  },
};
