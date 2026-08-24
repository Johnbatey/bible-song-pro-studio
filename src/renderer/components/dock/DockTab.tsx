import { useCallback, useEffect, useState } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';

/**
 * The dock's title bar: name, a pop-out toggle, and close.
 *
 * dockview supports floating groups but ships no control to create one — you
 * can only drag a dock onto another dock's edge, which always re-docks it.
 * This is the OBS affordance: pop the dock out so it floats above the layout,
 * and press again to put it back.
 */
export function DockTab({ api, containerApi }: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(api.title);
  const [isFloating, setIsFloating] = useState(api.location.type !== 'grid');

  useEffect(() => {
    const title$ = api.onDidTitleChange((e) => setTitle(e.title));
    const loc$ = api.onDidLocationChange(() => setIsFloating(api.location.type !== 'grid'));
    return () => {
      title$.dispose();
      loc$.dispose();
    };
  }, [api]);

  const toggleFloat = useCallback((event: React.MouseEvent) => {
    // The tab is a drag source; without this the press starts a drag instead.
    event.stopPropagation();
    event.preventDefault();

    const panel = containerApi.getPanel(api.id);
    if (!panel) return;

    if (api.location.type === 'grid') {
      if (window.BSP?.dock?.popOut) {
        void window.BSP.dock.popOut(api.id).then((result) => {
          if (result?.ok) api.close();
        });
        return;
      }
      containerApi.addFloatingGroup(panel, {
        x: 80,
        y: 80,
        width: 520,
        height: 380,
      });
      return;
    }

    // Back into the grid, next to whichever group is currently docked.
    const home = containerApi.groups.find((g) => g.api.location.type === 'grid');
    panel.api.moveTo(home ? { group: home, position: 'right' } : {});
  }, [api, containerApi]);

  const close = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    api.close();
  }, [api]);

  return (
    <div className="dock-tab">
      <span className="dock-tab__title">{title}</span>
      <button
        type="button"
        className="dock-tab__action"
        onClick={toggleFloat}
        onMouseDown={(e) => e.stopPropagation()}
        title={isFloating ? 'Dock this window back into the layout' : 'Open this panel in its own window'}
        aria-label={isFloating ? 'Dock window' : 'Pop out window'}
      >
        {isFloating ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 15 3 21" />
            <path d="M3 15h6v6" />
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="dock-tab__action"
        onClick={close}
        onMouseDown={(e) => e.stopPropagation()}
        title="Close this window"
        aria-label="Close window"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
