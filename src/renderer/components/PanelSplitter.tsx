import { useCallback, useRef, useState } from 'react';

interface PanelSplitterProps {
  /** Current width of the panel to the splitter's left, in px. */
  width: number;
  onChange: (width: number) => void;
  min?: number;
  max?: number;
  title?: string;
}

/**
 * A drag handle between two side-by-side blocks inside one panel.
 *
 * Distinct from the dock seams, which dockview owns: this splits the *contents*
 * of a single dock (song list vs lyrics, best match vs candidate index), so it
 * lives with the panel rather than the layout.
 */
export function PanelSplitter({ width, onChange, min = 180, max = 640, title }: PanelSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, width: 0 });

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    startRef.current = { x: event.clientX, width };
    setIsDragging(true);

    const onMove = (move: PointerEvent) => {
      const next = startRef.current.width + (move.clientX - startRef.current.x);
      onChange(Math.min(max, Math.max(min, next)));
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [width, onChange, min, max]);

  return (
    <div
      className={`panel-splitter ${isDragging ? 'is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      aria-label={title || 'Drag to resize'}
      role="separator"
    />
  );
}
