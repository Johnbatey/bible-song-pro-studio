import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontSize, fontWeight } from '../styles/type';
import { DOCKS, DOCK_SECTIONS, getDockTitle, type DockId } from './dock/docks';
import { toggleDock } from './dock/dockController';
import { resetDockLayout } from './dock/DockHost';
import { useI18n } from '../../i18n/useI18n';

export function TitleBar() {
  const { t } = useI18n();
  const mode = useAppStore((s) => s.display.mode);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const setExternalDisplay = useAppStore((s) => s.setExternalDisplay);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const notify = useAppStore((s) => s.notify);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertText, setAlertText] = useState('Nursery Call #402');
  const [alertType, setAlertType] = useState<'announcement' | 'warning' | 'info'>('announcement');
  const [alertPosition, setAlertPosition] = useState<'bottom' | 'top'>('top');
  const [alertDuration, setAlertDuration] = useState<number>(15);
  const openDockIds = useAppStore((s) => s.openDockIds);
  const poppedOutDockIds = useAppStore((s) => s.poppedOutDockIds);

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceBtnRef = useRef<HTMLButtonElement | null>(null);

  /* Blackout lives in the store, not in this component.
   *
   * It was `useState` here, which is why the button did nothing: the title bar
   * turned red and no surface ever heard about it. ProgramSurface has always
   * drawn `state.blackout`, and the display window and NDI feed have always
   * been fed from the store — the one thing missing was the button writing
   * there. */
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const standbyMedia = useAppStore((s) => s.standbyMedia);
  const isWorkspaceLocked = useAppStore((s) => s.isWorkspaceLocked);
  const toggleWorkspaceLocked = useAppStore((s) => s.toggleWorkspaceLocked);
  const isBlackout = useAppStore((s) => s.display.blackout);
  const setBlackout = useAppStore((s) => s.setBlackout);
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const toggleUIThemeMode = useAppStore((s) => s.toggleUIThemeMode);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const isStudio = mode === 'studio';

  useEffect(() => {
    if (window.BSP) {
      window.BSP.window.isFullScreen().then(setIsFullScreen);
      window.BSP.window.onFullScreenChange(setIsFullScreen);
    }
  }, []);

  const [ndiStatus, setNdiStatus] = useState<{ running: boolean; connections: number } | null>(null);

  useEffect(() => {
    const checkNdi = () => {
      window.BSP?.ndi?.status?.().then((st) => setNdiStatus(st ? { running: Boolean(st.running), connections: st.connections || 0 } : null)).catch(() => {});
    };
    checkNdi();
    const timer = setInterval(checkNdi, 2500);
    return () => clearInterval(timer);
  }, []);

  // Global Logo Hotkey (Ctrl+L / Cmd+L)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
        e.preventDefault();
        clearProgram();
        notify({
          id: `logo-${Date.now()}`,
          text: standbyMedia ? 'Logo Standby Screen Active' : 'Standby Screen Active',
          type: 'info',
          duration: 3,
          animation: 'slideDown',
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearProgram, standbyMedia, notify]);

  // Click-outside and escape listener for Workspace Dropdown
  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(target) &&
        workspaceBtnRef.current &&
        !workspaceBtnRef.current.contains(target)
      ) {
        setWorkspaceMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWorkspaceMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [workspaceMenuOpen]);

  const toggleNdi = async () => {
    if (ndiStatus?.running) {
      await window.BSP?.ndi?.stop?.();
      notify({
        id: `ndi-${Date.now()}`,
        text: t('app.ndiStopped'),
        type: 'info',
        duration: 3,
        animation: 'slideDown',
      });
    } else {
      const res = await window.BSP?.ndi?.start?.();
      if (res?.ok) {
        notify({
          id: `ndi-${Date.now()}`,
          text: t('app.ndiLive'),
          type: 'info',
          duration: 4,
          animation: 'slideDown',
        });
      } else if (res?.error) {
        notify({
          id: `ndi-${Date.now()}`,
          text: t('app.ndiError', { error: res.error }),
          type: 'warning',
          duration: 5,
          animation: 'slideDown',
        });
      }
    }
    window.BSP?.ndi?.status?.().then((st) => setNdiStatus(st ? { running: Boolean(st.running), connections: st.connections || 0 } : null)).catch(() => {});
  };


  const toggleBlackout = () => {
    const next = !isBlackout;
    setBlackout(next);
    /* The operator's own confirmation. It must not go out as a room alert —
       painting "BLACKOUT ACTIVE" across the screen you just blacked out is
       the one thing blackout exists to prevent. */
    notify({
      id: `blackout-${Date.now()}`,
      text: next ? t('app.blackoutActive') : t('app.blackoutCleared'),
      type: next ? 'warning' : 'info',
      duration: 3,
      animation: 'slideDown',
    });
  };

  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const modalPosRef = useRef({ x: 0, y: 0 });
  modalPosRef.current = modalPosition;
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (showAlertModal) {
      setModalPosition({ x: 0, y: 0 });
    }
  }, [showAlertModal]);

  useEffect(() => {
    if (!showAlertModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAlertModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAlertModal]);

  const handleModalMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;

    setIsModalDragging(true);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - modalPosRef.current.x,
      y: e.clientY - modalPosRef.current.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = moveEvent.clientX - dragStartRef.current.x;
      const newY = moveEvent.clientY - dragStartRef.current.y;
      setModalPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsModalDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSendAlert = () => {
    if (!alertText.trim()) return;
    triggerAlert({
      id: String(Date.now()),
      text: alertText.trim(),
      type: alertType,
      position: alertPosition,
      duration: alertDuration,
      animation: 'slideDown',
    });
    notify({
      id: `alert-sent-${Date.now()}`,
      text: `Alert broadcast to screens: "${alertText.trim()}"`,
      type: 'info',
      duration: 3,
      animation: 'slideDown',
    });
  };

  return (
    <div className="titlebar" style={styles.titlebar}>
      {/* Left: window drag region and the dock pill tabs */}
      <div className="titlebar-drag" style={styles.dragLeft}>
        <div style={styles.brand}>
          {/* The small cut: at 24px the six-element mark collapses into a blob. */}
          <img src="./bible-song-pro-icon-small.svg" alt="" style={styles.logo} />
          <span style={styles.wordmark}>
            Bible Song Pro<sup style={styles.sup}>Studio</sup>
          </span>
        </div>

        {/* Workspaces & Panels layout button and dropdown menu */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 10, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
          <button
            ref={workspaceBtnRef}
            type="button"
            className="titlebar-workspace-btn"
            onClick={() => setWorkspaceMenuOpen((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 24,
              padding: '0 8px',
              background: workspaceMenuOpen ? 'var(--chrome-control-active, rgba(255, 255, 255, 0.12))' : 'transparent',
              border: '1px solid',
              borderColor: workspaceMenuOpen ? 'var(--border-primary, rgba(255, 255, 255, 0.18))' : 'transparent',
              borderRadius: 4,
              color: 'var(--text-secondary, #d4d4d8)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            title="Docks & Panels layout"
          >
            <span style={{ fontSize: 11, fontWeight: 600 }}>
              DOCKS
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.9, flexShrink: 0 }}
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="8.5" y1="4" x2="8.5" y2="20" />
              <circle cx="5.75" cy="8" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="5.75" cy="12" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="5.75" cy="16" r="0.8" fill="currentColor" stroke="none" />
            </svg>
          </button>

          {workspaceMenuOpen && (
            <div
              ref={workspaceMenuRef}
              className="workspace-dock-dropdown"
              style={{
                position: 'absolute',
                top: 28,
                left: 0,
                width: 220,
                maxHeight: 'calc(100vh - 48px)',
                overflowY: 'auto',
                background: '#18181b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4)',
                padding: '6px 0',
                zIndex: 99999,
                userSelect: 'none',
              }}
            >
              {DOCK_SECTIONS.map((section, sectionIdx) => (
                <div key={section.id}>
                  {sectionIdx > 0 && (
                    <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '6px 0' }} />
                  )}
                  {section.docks.map((dock) => {
                    const isPopped = poppedOutDockIds.includes(dock.id);
                    const isOpen = isPopped || openDockIds.includes(dock.id);
                    const title = getDockTitle(dock.id);
                    return (
                      <button
                        key={dock.id}
                        type="button"
                        className="workspace-menu-item"
                        onClick={() => {
                          if (isPopped) {
                            void window.BSP?.dock?.focusPopout?.(dock.id);
                          } else {
                            toggleDock(dock.id as DockId);
                          }
                        }}
                        style={{
                          width: '100%',
                          height: 28,
                          padding: '0 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'transparent',
                          border: 'none',
                          color: isOpen ? '#38bdf8' : '#e4e4e7',
                          fontSize: 12,
                          fontWeight: isOpen ? 500 : 400,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span>{title}</span>
                        {isOpen && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '6px 0' }} />

              <button
                type="button"
                className="workspace-menu-item"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  resetDockLayout();
                }}
                style={{
                  width: '100%',
                  height: 28,
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary, #a1a1aa)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #a1a1aa)';
                }}
              >
                Reset to default layout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Live status, Black, Toolbar & Window Actions */}
      <div style={styles.controlsRight}>
        {/* Live / Standby / Blackout Dynamic Status Pill */}
        <button
          type="button"
          className="titlebar-live-btn"
          style={{
            ...styles.liveBadge,
            cursor: 'pointer',
            background: isBlackout
              ? 'rgba(239, 68, 68, 0.15)'
              : currentScene
              ? 'var(--bsp-signal-wash)'
              : 'var(--chrome-control)',
            borderColor: isBlackout
              ? 'rgba(239, 68, 68, 0.4)'
              : currentScene
              ? 'var(--bsp-signal-glow)'
              : 'var(--border-primary)',
            color: isBlackout
              ? '#EF4444'
              : currentScene
              ? 'var(--bsp-signal)'
              : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
          }}
          onClick={() => {
            if (isBlackout) {
              setBlackout(false);
            } else if (currentScene) {
              setCurrentScene(null);
            }
          }}
          title={
            isBlackout
              ? 'Blackout is ACTIVE — click to restore live presentation'
              : currentScene
              ? 'Content is LIVE on air — click to clear program slide'
              : 'STANDBY — no slide is currently projected'
          }
        >
          <span
            style={{
              ...styles.liveDot,
              background: isBlackout ? '#EF4444' : currentScene ? 'var(--bsp-signal)' : 'var(--bsp-tally-hold)',
              boxShadow: isBlackout
                ? '0 0 8px rgba(239, 68, 68, 0.8)'
                : currentScene
                ? '0 0 8px var(--bsp-signal-glow)'
                : 'none',
            }}
          />
          {isBlackout ? 'BLACKOUT' : currentScene ? 'LIVE' : 'STANDBY'}
        </button>

        {/* Logo / Standby Mode Button */}
        <button
          className="titlebar-logo-btn"
          style={{
            ...styles.blackBtn,
            background: !currentScene && standbyMedia ? 'rgba(99, 102, 241, 0.2)' : 'var(--chrome-control)',
            borderColor: !currentScene && standbyMedia ? 'var(--accent)' : 'var(--border-primary)',
            color: !currentScene && standbyMedia ? 'var(--accent)' : 'var(--text-secondary)',
          }}
          onClick={() => {
            clearProgram();
            notify({
              id: `logo-${Date.now()}`,
              text: standbyMedia ? 'Logo Standby Screen Active' : 'Standby Screen Active',
              type: 'info',
              duration: 3,
              animation: 'slideDown',
            });
          }}
          title={standbyMedia ? 'Display Church Logo / Standby Screen (Ctrl+L)' : 'Clear program to default standby (Ctrl+L)'}
        >
          LOGO
        </button>

        {/* Blackout Toggle Button */}
        <button
          className="titlebar-black-btn"
          style={{
            ...styles.blackBtn,
            background: isBlackout ? 'var(--tally-fault)' : 'var(--chrome-control)',
            borderColor: isBlackout ? 'var(--tally-fault)' : 'var(--border-primary)',
            color: isBlackout ? '#ffffff' : 'var(--text-secondary)',
          }}
          onClick={toggleBlackout}
          title={isBlackout ? 'Blackout is ON — click to restore the audience screens' : 'Black out every audience screen'}
          aria-pressed={isBlackout}
        >
          BLACK
        </button>

        <div style={styles.divider} />

        {/* Quick Toolbar Action Buttons: Outputs, NDI, Alerts, Settings */}
        <div style={styles.toolbarGroup}>
          {/* Workspace Layout Lock Button */}
          <button
            className="titlebar-icon-btn"
            style={{
              ...styles.toolbarBtn,
              background: isWorkspaceLocked ? 'rgba(234, 179, 8, 0.18)' : styles.toolbarBtn.background,
              borderColor: isWorkspaceLocked ? '#EAB308' : 'var(--border-primary)',
              color: isWorkspaceLocked ? '#EAB308' : 'var(--text-secondary)',
            }}
            onClick={toggleWorkspaceLocked}
            title={isWorkspaceLocked ? 'Workspace Locked — Layout and docks cannot be moved (Click to Unlock)' : 'Lock Workspace Layout to prevent accidental moves'}
            aria-label="Lock Workspace"
          >
            {isWorkspaceLocked ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            )}
          </button>

          {/* Audience Display Button */}
          <button
            className="titlebar-icon-btn"
            style={{
              ...styles.toolbarBtn,
              background: isExternalDisplayActive ? 'rgba(99, 102, 241, 0.18)' : styles.toolbarBtn.background,
              borderColor: isExternalDisplayActive ? 'var(--accent)' : 'var(--border-primary)',
              color: isExternalDisplayActive ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={async () => {
              if (isExternalDisplayActive) {
                await window.BSP?.display.close();
                setExternalDisplay(false);
              } else {
                await window.BSP?.display.open();
                setExternalDisplay(true);
              }
            }}
            title={isExternalDisplayActive ? 'Audience Display Active (Projector/Screen) — Click to Close' : 'Open Audience Display Window (Projector/Screen)'}
            aria-label="Audience Display"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            {isExternalDisplayActive && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--tally-preview)', boxShadow: '0 0 6px var(--tally-preview)' }} />
            )}
          </button>

          {/* NDI Quick Toggle Button */}
          <button
            className="titlebar-icon-btn"
            style={{
              ...styles.toolbarBtn,
              background: ndiStatus?.running ? 'rgba(59, 130, 246, 0.18)' : styles.toolbarBtn.background,
              borderColor: ndiStatus?.running ? 'var(--tally-link)' : 'var(--border-primary)',
              color: ndiStatus?.running ? 'var(--tally-link)' : 'var(--text-secondary)',
            }}
            onClick={toggleNdi}
            title={ndiStatus?.running ? `NDI Streaming Active (${ndiStatus.connections} receiver connected) - Click to Stop` : 'Start NDI Stream for OBS / vMix'}
            aria-label="NDI Stream"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16.1A5 5 0 0 1 5.9 20" />
              <path d="M2 12.05A9 9 0 0 1 9.95 20" />
              <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
              <line x1="2" y1="20" x2="2.01" y2="20" strokeWidth="2.5" />
            </svg>
            {ndiStatus?.running && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--tally-preview)', boxShadow: '0 0 6px var(--tally-preview)' }} />
            )}
          </button>

          {/* Alerts Button */}
          <button
            className="titlebar-icon-btn"
            style={{
              ...styles.toolbarBtn,
              background: activeAlert ? 'rgba(255, 85, 0, 0.2)' : styles.toolbarBtn.background,
              borderColor: activeAlert ? '#FF5500' : 'var(--border-primary)',
              color: activeAlert ? '#FF5500' : 'var(--text-secondary)',
            }}
            onClick={() => setShowAlertModal((v) => !v)}
            title={activeAlert ? `Alert ON AIR: "${activeAlert.text}" — Click to manage` : 'Broadcast On-Screen Alert to Display Screens'}
            aria-label="Alerts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {activeAlert && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: '#FF5500', boxShadow: '0 0 6px #FF5500' }} />
            )}
          </button>

          {/* Setlists & Service Schedule Manager Button */}
          <button
            className="titlebar-icon-btn"
            style={styles.toolbarBtn}
            onClick={() => window.dispatchEvent(new CustomEvent('bsp:open-setlists'))}
            title="Service Setlists & Schedules Manager"
            aria-label="Service Setlists"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Keyboard Shortcuts Button */}
          <button
            className="titlebar-icon-btn"
            style={styles.toolbarBtn}
            onClick={() => useAppStore.getState().openShortcuts()}
            title="Keyboard Shortcuts Cheat Sheet (? / ⌘/ / F1)"
            aria-label="Keyboard Shortcuts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Settings Button */}
          <button
            className="titlebar-icon-btn"
            style={styles.toolbarBtn}
            onClick={() => useAppStore.getState().openSettings('output')}
            title={t('app.openSettings')}
            aria-label={t('common.settings')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* UI Theme Switcher Button (Brand Identity Light / Dark Mode) */}
          <button
            className="titlebar-icon-btn"
            style={{
              ...styles.toolbarBtn,
              color: uiThemeMode === 'light' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={toggleUIThemeMode}
            title={uiThemeMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle UI Theme"
          >
            {uiThemeMode === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>

        {/* No window controls here — the OS frame already draws them. */}
      </div>

      {/* On-Screen Display Alert Trigger Modal Dialog */}
      {showAlertModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'transparent',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              pointerEvents: 'auto',
              transform: `translate3d(${modalPosition.x}px, ${modalPosition.y}px, 0px)`,
            }}
          >
            {/* Header (Draggable Handle) */}
            <div
              onMouseDown={handleModalMouseDown}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: isModalDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(255, 85, 0, 0.15)',
                    border: '1px solid rgba(255, 85, 0, 0.4)',
                    color: '#FF5500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Project On-Screen Alert
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
                    Broadcast a ticker alert to audience and stage display screens
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAlertModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 16,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Active Alert Banner if running */}
            {activeAlert && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(255, 85, 0, 0.12)',
                  border: '1px solid rgba(255, 85, 0, 0.4)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13, color: '#FF5500', fontWeight: 600 }}>
                  Active On Air: <strong>"{activeAlert.text}"</strong>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => dismissAlert()}
                  style={{
                    background: '#EF4444',
                    color: '#FFF',
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Clear Alert
                </button>
              </div>
            )}

            {/* Input Message */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Alert Message
              </label>
              <input
                className="input"
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                placeholder="Enter alert text..."
                style={{
                  height: 38,
                  padding: '0 12px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--chrome-control)',
                  color: 'var(--text-primary)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendAlert();
                  }
                }}
              />
            </div>

            {/* Alert Controls Row 1: Severity & Position */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Alert Style / Severity
                </label>
                <select
                  className="input"
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value as any)}
                  style={{
                    height: 36,
                    padding: '0 8px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border-primary)',
                    background: 'var(--chrome-control)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="announcement">Announcement (Orange)</option>
                  <option value="warning">Warning (Red)</option>
                  <option value="info">Info (Blue)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Screen Position
                </label>
                <select
                  className="input"
                  value={alertPosition}
                  onChange={(e) => setAlertPosition(e.target.value as any)}
                  style={{
                    height: 36,
                    padding: '0 8px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border-primary)',
                    background: 'var(--chrome-control)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="top">Top Badge (Recommended)</option>
                  <option value="bottom">Bottom Badge</option>
                </select>
              </div>
            </div>

            {/* Alert Controls Row 2: Duration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Display Duration
              </label>
              <select
                className="input"
                value={alertDuration}
                onChange={(e) => setAlertDuration(Number(e.target.value))}
                style={{
                  height: 36,
                  padding: '0 8px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--chrome-control)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds (Recommended)</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds (1 minute)</option>
                <option value={0}>Until Cleared (Manual Dismiss)</option>
              </select>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              {activeAlert && (
                <button
                  className="btn btn-secondary"
                  onClick={() => dismissAlert()}
                  style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, color: '#EF4444' }}
                >
                  Clear Active Alert
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setShowAlertModal(false)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6 }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleSendAlert}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 6,
                  background: '#FF5500',
                  color: '#FFF',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Send Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  titlebar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    padding: '0 16px',
    background: 'var(--bg-primary)',
    borderBottom: '1px solid var(--block-line)',
    flexShrink: 0,
    zIndex: 100,
    userSelect: 'none',
  },
  dragLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
  },
  wordmark: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    letterSpacing: '-0.02em',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  },
  /* Studio superscript — Signal face, monochrome. */
  sup: {
    fontFamily: 'var(--font-signal)',
    /* Fixed, not relative: 0.62em of an 11px wordmark lands at 6.8px. */
    fontSize: 8,
    fontWeight: fontWeight.regular,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginLeft: '0.4em',
    verticalAlign: '0.3em',
    lineHeight: 0,
    color: 'var(--text-dim)',
  },
  pillContainer: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    background: 'var(--chrome-control)',
    borderRadius: 7,
    padding: 2,
    gap: 2,
    border: '1px solid var(--border-primary)',
    boxSizing: 'border-box',
  },
  pillGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    height: '100%',
  },
  /* A hairline break between groups */
  pillDivider: {
    width: 1,
    height: 16,
    margin: '0 4px',
    background: 'var(--block-line)',
    opacity: 0.8,
    flexShrink: 0,
  },
  pillBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    padding: '0 11px',
    border: '1px solid transparent',
    borderRadius: 5,
    fontSize: 12,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
    boxSizing: 'border-box',
    userSelect: 'none',
  },
  controlsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  takeGroup: {
    display: 'flex',
    gap: 6,
  },
  takeBtn: {
    height: 32,
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 7,
    boxSizing: 'border-box',
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    padding: '0 11px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-primary)',
    borderRadius: 7,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    letterSpacing: '0.06em',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-ui)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--tally-preview)',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
    flexShrink: 0,
  },
  blackBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    padding: '0 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.06em',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-ui)',
  },
  toolbarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  toolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    border: '1px solid var(--border-primary)',
    background: 'var(--chrome-control)',
    borderRadius: 7,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    boxSizing: 'border-box',
    position: 'relative',
  },
  divider: {
    width: 1,
    height: 20,
    background: 'var(--block-line)',
    margin: '0 2px',
    flexShrink: 0,
  },
};
