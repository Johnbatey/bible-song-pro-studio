import { useCallback, useEffect, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react';
import { useAppStore } from '../../stores/appStore';
import { DOCK_COMPONENTS, DOCKS, type DockId } from './docks';
import { getDockApi, setDockApi, toggleDock, openDock } from './dockController';
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
const DEFAULT_LAYOUT_JSON = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'branch',
          data: [
            {
              type: 'branch',
              data: [
                {
                  type: 'leaf',
                  data: {
                    views: ['transcript'],
                    activeView: 'transcript',
                    id: '1',
                  },
                  size: 292.3333333333333,
                },
                {
                  type: 'leaf',
                  data: {
                    views: ['bible', 'songs'],
                    activeView: 'bible',
                    id: '3',
                  },
                  size: 718.3333333333334,
                },
                {
                  type: 'leaf',
                  data: {
                    views: ['output'],
                    activeView: 'output',
                    id: '5',
                  },
                  size: 653.3333333333334,
                },
              ],
              size: 535,
            },
            {
              type: 'branch',
              data: [
                {
                  type: 'leaf',
                  data: {
                    views: ['history'],
                    activeView: 'history',
                    id: '2',
                  },
                  size: 292,
                },
                {
                  type: 'leaf',
                  data: {
                    views: ['live'],
                    activeView: 'live',
                    id: '4',
                  },
                  size: 624,
                },
                {
                  type: 'leaf',
                  data: {
                    views: ['media'],
                    activeView: 'media',
                    id: '6',
                  },
                  size: 400,
                },
                {
                  type: 'leaf',
                  data: {
                    views: ['queue'],
                    activeView: 'queue',
                    id: '7',
                  },
                  size: 344,
                },
              ],
              size: 421,
            },
          ],
          size: 1672,
        },
      ],
      size: 960,
    },
    width: 1672,
    height: 960,
    orientation: 'HORIZONTAL',
  },
  panels: {
    transcript: {
      id: 'transcript',
      contentComponent: 'transcript',
      tabComponent: 'props.defaultTabComponent',
      title: 'Live transcript',
    },
    bible: {
      id: 'bible',
      contentComponent: 'bible',
      tabComponent: 'props.defaultTabComponent',
      title: 'Bible',
    },
    songs: {
      id: 'songs',
      contentComponent: 'songs',
      tabComponent: 'props.defaultTabComponent',
      title: 'Songs',
    },
    output: {
      id: 'output',
      contentComponent: 'output',
      tabComponent: 'props.defaultTabComponent',
      title: 'Output',
    },
    history: {
      id: 'history',
      contentComponent: 'history',
      tabComponent: 'props.defaultTabComponent',
      title: 'History',
    },
    live: {
      id: 'live',
      contentComponent: 'live',
      tabComponent: 'props.defaultTabComponent',
      title: 'Live',
    },
    media: {
      id: 'media',
      contentComponent: 'media',
      tabComponent: 'props.defaultTabComponent',
      title: 'Media',
    },
    queue: {
      id: 'queue',
      contentComponent: 'queue',
      tabComponent: 'props.defaultTabComponent',
      title: 'Queue',
    },
  },
  activeGroup: '4',
};

function buildDefaultLayout(api: DockviewApi) {
  try {
    api.fromJSON(DEFAULT_LAYOUT_JSON as any);
  } catch {
    // If deserialization fails, fallback to fresh API clears
  }
}

export function DockHost() {
  const apiRef = useRef<DockviewApi | null>(null);
  const setOpenDockIds = useAppStore((s) => s.setOpenDockIds);
  const setPoppedOutDockIds = useAppStore((s) => s.setPoppedOutDockIds);
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
    // On first launch, start with empty workspace canvas so the user sees the
    // DockEmptyState welcome canvas and can choose "Start from default layout"
    // or open individual panels.
    // (Restoring previous user arrangement continues to work whenever saved layout exists).

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
      if (useAppStore.getState().poppedOutDockIds.includes(id)) {
        void window.BSP?.dock?.focusPopout?.(id);
        return;
      }
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

  useEffect(() => {
    const apply = (ids: string[]) => {
      const prev = useAppStore.getState().poppedOutDockIds;
      setPoppedOutDockIds(ids);
      const api = apiRef.current;
      if (!api) return;
      for (const id of ids) {
        const panel = api.getPanel(id);
        if (panel) panel.api.close();
      }
      for (const id of prev) {
        if (!ids.includes(id)) openDock(id as DockId);
      }
    };
    void window.BSP?.dock?.listPopouts?.().then((ids) => {
      if (Array.isArray(ids)) apply(ids);
    });
    return window.BSP?.dock?.onPopoutsChanged?.((ids) => {
      apply(Array.isArray(ids) ? ids : []);
    });
  }, [setPoppedOutDockIds]);

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
  useAppStore.getState().setMode('basic');
  const api = getDockApi();
  if (!api) return;
  api.clear();
  buildDefaultLayout(api);
}

export { DOCKS };
export type { DockId };
