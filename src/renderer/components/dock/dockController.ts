import type { DockviewApi } from 'dockview-react';
import { DOCKS, getDockTitle, type DockId } from './docks';

/**
 * dockview's API is imperative and lives inside DockHost, but the title bar
 * needs to open and close docks. Rather than thread the api through props or
 * park a non-serialisable object in the store, DockHost publishes it here and
 * the store carries only the ids that are open (so React re-renders on change).
 */
let api: DockviewApi | null = null;

export function setDockApi(next: DockviewApi | null) {
  api = next;
}

export function getDockApi() {
  return api;
}

/** Bring a dock into view, adding it back if it was closed. */
export function openDock(id: DockId) {
  if (!api) return;
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const dock = DOCKS.find((d) => d.id === id);
  if (!dock) return;
  api.addPanel({ id, component: id, title: getDockTitle(id) });
}

/**
 * The current arrangement, in dockview's own serialised form.
 *
 * Returns null when there is nothing to capture — no api yet, or every dock
 * closed. Saving an empty arrangement as a named workspace is never what the
 * operator meant, and restoring one later would look exactly like the app
 * failing to load the layout.
 */
export function captureLayout(): unknown | null {
  if (!api || api.panels.length === 0) return null;
  try {
    return api.toJSON();
  } catch {
    // Serialising mid-teardown can throw; the caller reports the miss.
    return null;
  }
}

/**
 * Replaces the arrangement wholesale. Returns false if the tree was rejected,
 * having put back what was on screen before the attempt.
 *
 * The rollback is the point. `fromJSON` tears the existing tree down before it
 * builds the new one, so a layout written against a different set of dock ids
 * — an import from an older build, most likely — throws *after* the operator's
 * working arrangement is already gone. Failing loudly and leaving them on an
 * empty grid mid-service is not an acceptable way to reject a file.
 */
export function applyLayout(layout: unknown): boolean {
  if (!api || !layout) return false;
  const fallback = captureLayout();
  try {
    api.fromJSON(layout as Parameters<DockviewApi['fromJSON']>[0]);
    if (api.panels.length > 0) return true;
  } catch {
    // Handled below, the same way an empty result is.
  }
  if (fallback) {
    try {
      api.fromJSON(fallback as Parameters<DockviewApi['fromJSON']>[0]);
    } catch {
      // Nothing left to try; DockHost's empty state covers the operator.
    }
  }
  return false;
}

/** Title-bar tab behaviour: open if closed, close if already open. */
export function toggleDock(id: DockId) {
  if (!api) return;
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.close();
    return;
  }
  openDock(id);
}
