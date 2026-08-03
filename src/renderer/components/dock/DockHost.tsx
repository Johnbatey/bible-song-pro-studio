import { useCallback, useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react';
import { useAppStore } from '../../stores/appStore';
import { DOCK_COMPONENTS, DOCKS, type DockId } from './docks';
import { getDockApi, setDockApi } from './dockController';

const LAYOUT_KEY = 'bsp_dockLayout';

/**
 * Colours come from the app's own tokens via the .bsp-dock class in global.css;
 * this object only carries the behavioural bits dockview reads in JS.
 */
const BSP_THEME: DockviewTheme = {
  name: 'bsp',
  className: 'bsp-dock',
  colorScheme: 'dark',
  gap: 4,
  dndPanelOverlay: 'group',
};

/**
 * Reproduces the fixed layout the app shipped with, so a first run (or a reset)
 * lands somewhere familiar rather than on an empty grid.
 */
function buildDefaultLayout(api: DockviewApi) {
  api.addPanel({ id: 'transcript', component: 'transcript', title: 'Live transcript' });

  api.addPanel({
    id: 'output',
    component: 'output',
    title: 'Output',
    position: { referencePanel: 'transcript', direction: 'right' },
  });

  api.addPanel({
    id: 'history',
    component: 'history',
    title: 'History',
    position: { referencePanel: 'transcript', direction: 'below' },
  });

  api.addPanel({
    id: 'bible',
    component: 'bible',
    title: 'Bible',
    position: { referencePanel: 'output', direction: 'below' },
  });

  api.addPanel({
    id: 'queue',
    component: 'queue',
    title: 'Queue',
    position: { referencePanel: 'bible', direction: 'right' },
  });

  // Roughly the proportions of the old grid: a narrow left column, and a
  // program dock deeper than the panel beneath it.
  api.getPanel('transcript')?.api.setSize({ width: 320 });
  api.getPanel('output')?.api.setSize({ height: 380 });
  api.getPanel('queue')?.api.setSize({ width: 340 });
}

export function DockHost() {
  const apiRef = useRef<DockviewApi | null>(null);
  const setOpenDockIds = useAppStore((s) => s.setOpenDockIds);

  const syncOpenDocks = useCallback((api: DockviewApi) => {
    setOpenDockIds(api.panels.map((p) => p.id));
  }, [setOpenDockIds]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api;
    apiRef.current = api;
    setDockApi(api);

    const saved = localStorage.getItem(LAYOUT_KEY);
    let restored = false;
    if (saved) {
      try {
        api.fromJSON(JSON.parse(saved));
        restored = api.panels.length > 0;
      } catch {
        // A layout saved against an older set of dock ids throws here. Falling
        // back is the whole point — a stale layout must never white-screen the
        // app — so drop it and rebuild.
        localStorage.removeItem(LAYOUT_KEY);
        api.clear();
      }
    }
    if (!restored) buildDefaultLayout(api);

    syncOpenDocks(api);
  }, [syncOpenDocks]);

  // Persist on any structural change. Debounced because dragging a splitter
  // fires this continuously.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    let timer: number | undefined;

    const disposable = api.onDidLayoutChange(() => {
      syncOpenDocks(api);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON()));
        } catch {
          // Serialising a layout mid-teardown can throw; the next change saves.
        }
      }, 250);
    });

    return () => {
      window.clearTimeout(timer);
      disposable.dispose();
    };
  }, [syncOpenDocks]);

  useEffect(() => () => setDockApi(null), []);

  return (
    <DockviewReact
      className="bsp-dock-root"
      components={DOCK_COMPONENTS}
      theme={BSP_THEME}
      onReady={onReady}
      singleTabMode="fullwidth"
      disableFloatingGroups={false}
    />
  );
}

/** Throws away the saved tree and rebuilds the shipped arrangement. */
export function resetDockLayout() {
  localStorage.removeItem(LAYOUT_KEY);
  const api = getDockApi();
  if (!api) return;
  api.clear();
  buildDefaultLayout(api);
}

export { DOCKS };
export type { DockId };
