import { useEffect } from 'react';
import { DOCKS, DOCK_COMPONENTS, type DockId } from '../renderer/components/dock/docks';
import { useAppStore } from '../renderer/stores/appStore';
import { useStoreSync } from '../renderer/hooks/useStoreSync';
function dockIdFromUrl(): DockId | null {
  const raw = new URLSearchParams(window.location.search).get('dock') || '';
  return DOCKS.some((dock) => dock.id === raw) ? (raw as DockId) : null;
}

export function DockPopoutApp() {
  const id = dockIdFromUrl();
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  useStoreSync();

  useEffect(() => {
    const mode = uiThemeMode || 'dark';
    document.documentElement.setAttribute('data-ui-theme', mode);
    if (mode === 'light') {
      document.documentElement.setAttribute('data-bsp-surface', 'paper');
      document.body.classList.add('light-theme');
    } else {
      document.documentElement.removeAttribute('data-bsp-surface');
      document.body.classList.remove('light-theme');
    }
  }, [uiThemeMode]);

  if (!id) {
    return (
      <div className="dock-panel" style={{ padding: 24, color: 'var(--text-secondary)' }}>
        Unknown dock.
      </div>
    );
  }

  const Panel = DOCK_COMPONENTS[id];
  return (
    <div className="dock-popout">
      {Panel ? <Panel {...({} as never)} /> : null}
    </div>
  );
}
