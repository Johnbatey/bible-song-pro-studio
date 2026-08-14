import { useState } from 'react';

export type BarPosition = 'top' | 'bottom';

/**
 * Lets a panel's control bar sit above its content or below it, remembering the
 * choice per panel.
 *
 * The panel is expected to build its bar once into a variable and render that
 * same element into whichever slot is active, rather than writing it twice —
 * one element means the scrolling and every control behave identically in both
 * positions, with no second copy to drift.
 */
export function useBarPosition(storageKey: string, defaultPosition: BarPosition = 'top') {
  const [position, setPosition] = useState<BarPosition>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'bottom' || saved === 'top') return saved;
    return defaultPosition;
  });

  const move = () => {
    const next: BarPosition = position === 'top' ? 'bottom' : 'top';
    setPosition(next);
    localStorage.setItem(storageKey, next);
  };

  return { position, move };
}

interface MoveBarButtonProps {
  position: BarPosition;
  onMove: () => void;
  /** Names the window in the tooltip, e.g. "Bible". */
  label: string;
  style?: React.CSSProperties;
}

/** The arrow that sends a bar to the other end of its panel. */
export function MoveBarButton({ position, onMove, label, style }: MoveBarButtonProps) {
  return (
    <button
      style={{ color: 'var(--text-primary)', ...style }}
      onClick={onMove}
      title={position === 'top'
        ? `Move this toolbar to the bottom of the ${label} window`
        : `Move this toolbar back to the top of the ${label} window`}
      aria-label="Move toolbar"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {position === 'top' ? (
          <>
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </>
        ) : (
          <>
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </>
        )}
      </svg>
    </button>
  );
}
