/**
 * Whether this panel is the one arrow keys should drive.
 *
 * Both Bible and Songs listen for ArrowLeft/Right on `window` and used to gate
 * on `offsetParent === null`, which worked only because exactly one workspace
 * panel was ever rendered — the rest sat behind `display: none`. Docking breaks
 * that: put Bible and Songs side by side and both are visible, so both would
 * step their own list on every arrow press.
 *
 * Visibility is still necessary (a panel stacked behind another tab in the same
 * group is hidden), but no longer sufficient. The tiebreak is dockview's active
 * group — the one the operator last clicked into.
 */
export function isFocusedDock(el: HTMLElement | null): boolean {
  if (!el || el.offsetParent === null) return false;
  const group = el.closest('.dv-groupview');
  // Rendered outside a dock (tests, harnesses): nothing to arbitrate against.
  if (!group) return true;
  return group.classList.contains('dv-active-group');
}
