import type { DockviewApi } from 'dockview-react';
import { DOCKS, type DockId } from './docks';

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
  api.addPanel({ id, component: id, title: dock.title });
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
