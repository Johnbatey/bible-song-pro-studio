import { useCallback, useEffect, useRef, useState } from 'react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { createPortal } from 'react-dom';
import { resetDockLayout } from './DockHost';

export function DockTab({ api, containerApi }: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(api.title);
  
  const checkIsSelected = useCallback(() => {
    if (!api.group) return true;
    return api.group.activePanel?.id === api.id;
  }, [api]);

  const [isSelected, setIsSelected] = useState<boolean>(checkIsSelected);
  const [isFloating, setIsFloating] = useState(api.location.type !== 'grid');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const burgerBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const updateSelected = () => {
      setIsSelected(checkIsSelected());
    };

    updateSelected();

    const title$ = api.onDidTitleChange((e) => setTitle(e.title));
    const loc$ = api.onDidLocationChange(() => setIsFloating(api.location.type !== 'grid'));
    const group$ = api.onDidGroupChange?.(updateSelected);
    const active$ = api.onDidActiveChange?.(updateSelected);
    const containerPanel$ = containerApi.onDidActivePanelChange?.(updateSelected);
    const containerGroup$ = containerApi.onDidActiveGroupChange?.(updateSelected);
    const layout$ = containerApi.onDidLayoutChange?.(updateSelected);

    return () => {
      title$.dispose();
      loc$.dispose();
      group$?.dispose();
      active$?.dispose();
      containerPanel$?.dispose();
      containerGroup$?.dispose();
      layout$?.dispose();
    };
  }, [api, containerApi, checkIsSelected]);

  const togglePopOut = useCallback(() => {
    setIsMenuOpen(false);
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

    // Back into grid
    const home = containerApi.groups.find((g) => g.api.location.type === 'grid');
    panel.api.moveTo(home ? { group: home, position: 'right' } : {});
  }, [api, containerApi]);

  const closePanel = useCallback(() => {
    setIsMenuOpen(false);
    api.close();
  }, [api]);

  const toggleMaximize = useCallback(() => {
    setIsMenuOpen(false);
    const groupApi = api.group?.api;
    if (!groupApi) return;
    if (groupApi.isMaximized()) {
      groupApi.exitMaximized();
    } else {
      groupApi.maximize();
    }
  }, [api]);

  const closeOthers = useCallback(() => {
    setIsMenuOpen(false);
    const panels = api.group?.panels || [];
    for (const p of panels) {
      if (p.id !== api.id) p.api.close();
    }
  }, [api]);

  const handleResetLayout = useCallback(() => {
    setIsMenuOpen(false);
    resetDockLayout();
  }, []);

  const openMenuAt = (x: number, y: number) => {
    const menuW = 180;
    const menuH = 160;
    const left = Math.max(8, Math.min(x, window.innerWidth - menuW - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - menuH - 8));
    setMenuPos({ top, left });
    setIsMenuOpen(true);
  };

  const handleBurgerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    const rect = burgerBtnRef.current?.getBoundingClientRect();
    if (rect) {
      openMenuAt(rect.left, rect.bottom + 4);
    } else {
      openMenuAt(event.clientX, event.clientY + 4);
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    openMenuAt(event.clientX, event.clientY);
  };

  const isMaximized = api.group?.api?.isMaximized?.() || false;
  const hasOtherPanels = (api.group?.panels?.length || 0) > 1;

  const handleTabClick = () => {
    api.setActive();
  };

  return (
    <div
      className={`dock-tab ${isSelected ? 'dock-tab--active' : 'dock-tab--inactive'}`}
      onClick={handleTabClick}
      onContextMenu={handleContextMenu}
    >
      <div className="dock-tab__content">
        <span className="dock-tab__title" title={title}>
          {title}
        </span>

        {/* Burger SVG Icon (3 parallel horizontal lines) — visible on active tab of group */}
        {isSelected && (
          <button
            ref={burgerBtnRef}
            type="button"
            className="dock-tab__burger"
            onClick={handleBurgerClick}
            onMouseDown={(e) => e.stopPropagation()}
            title="Panel Options"
            aria-label="Panel Options"
          >
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="1" y1="2" x2="11" y2="2" />
              <line x1="1" y1="5" x2="11" y2="5" />
              <line x1="1" y1="8" x2="11" y2="8" />
            </svg>
          </button>
        )}

        {/* Active Underline Bar */}
        {isSelected && <div className="dock-tab__active-bar" />}
      </div>

      {/* Dropdown Menu Portal */}
      {isMenuOpen &&
        createPortal(
          <>
            <div
              className="dock-tab-menu-backdrop"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsMenuOpen(false);
              }}
            />
            <div
              className="dock-tab-menu"
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 99999,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="dock-tab-menu__item" onClick={closePanel}>
                <span>Close Panel</span>
                <span className="dock-tab-menu__shortcut">✕</span>
              </button>

              <button type="button" className="dock-tab-menu__item" onClick={togglePopOut}>
                <span>{isFloating ? 'Dock Back' : 'Pop Out Panel'}</span>
                <span className="dock-tab-menu__icon">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                  </svg>
                </span>
              </button>

              <button type="button" className="dock-tab-menu__item" onClick={toggleMaximize}>
                <span>{isMaximized ? 'Restore Panel' : 'Maximize Panel'}</span>
                <span className="dock-tab-menu__icon">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </span>
              </button>

              {hasOtherPanels && (
                <button type="button" className="dock-tab-menu__item" onClick={closeOthers}>
                  <span>Close Other Panels</span>
                </button>
              )}

              <div className="dock-tab-menu__divider" />

              <button type="button" className="dock-tab-menu__item dock-tab-menu__item--dim" onClick={handleResetLayout}>
                <span>Reset Layout</span>
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
