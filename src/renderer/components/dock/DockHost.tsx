import { useCallback, useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react';
import { useAppStore } from '../../stores/appStore';
import { DOCK_COMPONENTS, DOCKS, type DockId } from './docks';
import { getDockApi, setDockApi, toggleDock } from './dockController';
import { DockTab } from './DockTab';
import { DockEmptyState } from './DockEmptyState';

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
    title: 'Scripture',
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
  const openDockIds = useAppStore((s) => s.openDockIds);

  const syncOpenDocks = useCallback((api: DockviewApi) => {
    const ids = api.panels.map((p) => p.id);
    setOpenDockIds(ids);
    // Keep the native Electron menu checkmarks in sync. Guarded so the
    // web-browser dev fallback (no BSP bridge) is a silent no-op.
    window.BSP?.dock?.syncMenu(ids);
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

    /* Titles come from DOCKS, not from the saved file.
     *
     * dockview serialises each panel's title along with the arrangement, and
     * fromJSON restores it verbatim — so a panel renamed in a later build kept
     * the name it had on the day the operator last moved a splitter. Renaming
     * Scripture to Bible would have reached nobody who had ever arranged their
     * workspace, which is everybody.
     *
     * The id is the identity and the title is derived from it, so this simply
     * restates the current one. The arrangement itself is untouched. */
    for (const panel of api.panels) {
      const dock = DOCKS.find((d) => d.id === panel.id);
      if (dock && panel.title !== dock.title) panel.api.setTitle(dock.title);
    }

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

  // Subscribe to native-menu events. The main process sends a dock id when
  // the user clicks a Dock menu item, and a reset signal for Reset Layout.
  // Returns are cleanup functions so React removes the listeners on unmount.
  useEffect(() => {
    const unsubToggle = window.BSP?.dock?.onToggle((id: string) => {
      toggleDock(id as DockId);
    });
    const unsubReset = window.BSP?.dock?.onResetLayout(() => {
      resetDockLayout();
    });
    return () => {
      unsubToggle?.();
      unsubReset?.();
    };
  }, []);

  /* Closing the last dock used to leave the window blank, which is
     indistinguishable from a failed render. The empty state sits over
     dockview rather than replacing it: dockview has to stay mounted or its
     api — and every panel the chips are about to open — goes with it. */
  const isEmpty = openDockIds.length === 0;

  return (
    <div className="dock-stage">
      <DockviewReact
        className="bsp-dock-root"
        components={DOCK_COMPONENTS}
        theme={BSP_THEME}
        onReady={onReady}
        defaultTabComponent={DockTab}
        singleTabMode="fullwidth"
        disableFloatingGroups={false}
        floatingGroupDragHandle="titlebar"
        floatingGroupBounds="boundedWithinViewport"
      />
      {isEmpty && <DockEmptyState onRestoreLayout={resetDockLayout} />}
    </div>
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
