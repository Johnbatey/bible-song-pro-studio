/* =========================================================================
   <Menu> — a button that drops a panel
   -------------------------------------------------------------------------
   The designer's toolbar used to be fifteen buttons across two rows, which is
   a toolbar that shows you everything and tells you nothing. Grouping them
   needs a popover, and this is it: a trigger, a panel, and the three ways
   everyone expects such a thing to close — clicking away, Escape, or choosing
   something.

   The panel is portalled to the body and positioned from the trigger's own
   rect. The toolbar floats inside the canvas viewport, which clips its
   overflow; a panel rendered as a child would be clipped with it, which is
   exactly what happens the first time anyone tries this.
   ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export interface MenuProps {
  /** What the trigger says when nothing is worth summarising. */
  label: ReactNode;
  /** The current choice, shown after the label — "Grid: 2.5%". */
  value?: ReactNode;
  title?: string;
  icon?: ReactNode;
  /** Marks the trigger as carrying a non-default setting. */
  active?: boolean;
  width?: number;
  children: (close: () => void) => ReactNode;
}

export function Menu({ label, value, title, icon, active, width = 232, children }: MenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);

  const measure = useCallback(() => {
    const anchor = triggerRef.current?.getBoundingClientRect();
    if (!anchor) return;
    // Nudged back on-screen rather than allowed to hang off the right edge,
    // which is where a menu on the last button in the bar would otherwise go.
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    setRect({ top: anchor.bottom + 6, left });
  }, [width]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    // Deferred, or the click that opened this closes it again in the same tick.
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="dz-menu-trigger"
        title={title}
        data-open={open || undefined}
        data-active={active || undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        <span className="dz-menu-label">{label}</span>
        {value !== undefined && <span className="dz-menu-value">{value}</span>}
        <svg className="dz-menu-caret" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          className="dz-menu-panel"
          style={{ top: rect.top, left: rect.left, width }}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </>
  );
}

/** One row in a menu: an icon, a name, and a line saying what it is for. */
export function MenuItem({
  icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dz-menu-item" data-selected={selected || undefined} onClick={onClick} role="menuitem">
      {icon && <span className="dz-menu-item-icon">{icon}</span>}
      <span className="dz-menu-item-body">
        <span className="dz-menu-item-label">{label}</span>
        {hint && <span className="dz-menu-item-hint">{hint}</span>}
      </span>
    </button>
  );
}

export default Menu;
