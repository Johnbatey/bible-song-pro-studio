import { useCallback, useEffect, useRef, useState } from 'react';
import { DOCKS, DOCK_COMPONENTS, getDockTitle, type DockId } from '../renderer/components/dock/docks';
import { useAppStore } from '../renderer/stores/appStore';
import { useStoreSync } from '../renderer/hooks/useStoreSync';
import { createPortal } from 'react-dom';

function dockIdFromUrl(): DockId | null {
  const raw = new URLSearchParams(window.location.search).get('dock') || '';
  return DOCKS.some((dock) => dock.id === raw) ? (raw as DockId) : null;
}

export function DockPopoutApp() {
  const id = dockIdFromUrl();
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const burgerBtnRef = useRef<HTMLButtonElement | null>(null);
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

  const handleDockBack = useCallback(() => {
    setIsMenuOpen(false);
    window.close();
  }, []);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
    window.close();
  }, []);

  const handleBurgerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    const rect = burgerBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
    } else {
      setMenuPos({ top: event.clientY + 4, left: event.clientX });
    }
    setIsMenuOpen(true);
  };

  if (!id) {
    return (
      <div className="dock-panel" style={{ padding: 24, color: 'var(--text-secondary)' }}>
        Unknown dock.
      </div>
    );
  }

  const title = getDockTitle(id);
  const Panel = DOCK_COMPONENTS[id];

  const handleDragStart = (e: React.DragEvent) => {
    if (!id) return;
    e.dataTransfer.setData('application/bsp-dock-id', id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="dock-popout-window">
      {/* Top light silver wrap bar for macOS window drag & traffic lights */}
      <div className="dock-popout-top-bar">
        <div className="dock-popout-drag" />
      </div>

      {/* Popout Inner Frame with 1px Blue Border */}
      <div className="dock-popout-frame">
        {/* Tab Row */}
        <div className="dock-popout-tab-row">
          <div
            className="dock-popout-tab"
            draggable
            onDragStart={handleDragStart}
            style={{ cursor: 'grab' }}
            title="Drag to dock back into main window"
          >
            <span className="dock-tab__title">{title}</span>
            <button
              ref={burgerBtnRef}
              type="button"
              className="dock-tab__burger"
              onClick={handleBurgerClick}
              title="Panel Options"
              aria-label="Panel Options"
            >
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <line x1="1" y1="2" x2="11" y2="2" />
                <line x1="1" y1="5" x2="11" y2="5" />
                <line x1="1" y1="8" x2="11" y2="8" />
              </svg>
            </button>
            <div className="dock-tab__active-bar" />
          </div>
        </div>

        {/* Popout Body Panel */}
        <div className="dock-popout-body">
          {Panel ? <Panel {...({} as never)} /> : null}
        </div>
      </div>

      {/* Dropdown Menu */}
      {isMenuOpen &&
        createPortal(
          <>
            <div
              className="dock-tab-menu-backdrop"
              onClick={() => setIsMenuOpen(false)}
            />
            <div
              className="dock-tab-menu"
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 99999,
              }}
            >
              <button type="button" className="dock-tab-menu__item" onClick={handleDockBack}>
                <span>Dock Back into Window</span>
                <span className="dock-tab-menu__icon">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 15 3 21" />
                    <path d="M3 15h6v6" />
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </span>
              </button>

              <button type="button" className="dock-tab-menu__item" onClick={handleClose}>
                <span>Close Window</span>
                <span className="dock-tab-menu__shortcut">✕</span>
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
