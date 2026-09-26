import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { fontSize, fontWeight } from '../styles/type';
import { DOCK_SECTIONS, getDockTitle } from './dock/docks';
import { toggleDock } from './dock/dockController';
import { resetDockLayout } from './dock/DockHost';
import { useI18n } from '../../i18n/useI18n';

export function TitleBar() {
  const { t } = useI18n();
  const currentScene = useAppStore((s) => s.display.currentScene);
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

  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const standbyMedia = useAppStore((s) => s.standbyMedia);
  const isWorkspaceLocked = useAppStore((s) => s.isWorkspaceLocked);
  const toggleWorkspaceLocked = useAppStore((s) => s.toggleWorkspaceLocked);
  const isBlackout = useAppStore((s) => s.display.blackout);
  const setBlackout = useAppStore((s) => s.setBlackout);
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const toggleUIThemeMode = useAppStore((s) => s.toggleUIThemeMode);

  const [stageOpen, setStageOpen] = useState(false);
  const [stageBusy, setStageBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    window.BSP?.isStageDisplayOpen?.().then((open) => { if (alive) setStageOpen(open); }).catch(() => {});
    const off = window.BSP?.onStageDisplayState?.((open) => setStageOpen(open));
    return () => { alive = false; off?.(); };
  }, []);

  const toggleStageDisplay = useCallback(async () => {
    if (stageBusy) return;
    setStageBusy(true);
    try {
      if (stageOpen) {
        setStageOpen(false);
        await window.BSP?.closeStageDisplay?.();
      } else {
        setStageOpen(true);
        await window.BSP?.openStageDisplay?.();
      }
    } catch {
      /* Broadcast is source of truth */
    } finally {
      setStageBusy(false);
    }
  }, [stageOpen, stageBusy]);

  const [ndiStatus, setNdiStatus] = useState<{ running: boolean; connections: number } | null>(null);

  useEffect(() => {
    const checkNdi = () => {
      window.BSP?.ndi?.status?.().then((st) => setNdiStatus(st ? { running: Boolean(st.running), connections: st.connections || 0 } : null)).catch(() => {});
    };
    checkNdi();
    const timer = setInterval(checkNdi, 2500);
    return () => {
      clearInterval(timer);
    };
  }, []);

  // Global Logo Hotkey (Ctrl+L / Cmd+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearProgram, standbyMedia, notify]);

  // Close workspace dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        workspaceMenuOpen &&
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(e.target as Node) &&
        workspaceBtnRef.current &&
        !workspaceBtnRef.current.contains(e.target as Node)
      ) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [workspaceMenuOpen]);

  const toggleBlackout = () => {
    setBlackout(!isBlackout);
  };

  const toggleNdi = async () => {
    if (ndiStatus?.running) {
      await window.BSP?.ndi?.stop?.();
      setNdiStatus((s) => s ? { ...s, running: false } : null);
    } else {
      await window.BSP?.ndi?.start?.({ name: 'Bible Song Pro Studio', fps: 30, width: 1920, height: 1080 });
      setNdiStatus((s) => s ? { ...s, running: true } : { running: true, connections: 0 });
    }
  };

  const handleSendAlert = () => {
    if (!alertText.trim()) return;
    triggerAlert({ id: `alert-${Date.now()}`, text: alertText.trim(), type: alertType, position: alertPosition, duration: alertDuration });
    setShowAlertModal(false);
  };

  return (
    <div className="titlebar" style={styles.titlebar}>
      {/* Left: window drag region and the dock pill tabs */}
      <div className="titlebar-drag" style={styles.dragLeft}>
        <div style={styles.brand}>
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
              color: 'var(--text-dim)',
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

          {/* Workspace Layout Lock Button next to Docks */}
          <button
            className="titlebar-icon-btn"
            style={{
              ...styles.toolbarBtn,
              marginLeft: 4,
              background: isWorkspaceLocked ? 'rgba(234, 179, 8, 0.16)' : 'transparent',
              borderColor: isWorkspaceLocked ? 'rgba(234, 179, 8, 0.4)' : 'transparent',
              color: isWorkspaceLocked ? '#EAB308' : 'var(--text-dim)',
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
                    return (
                      <button
                        key={dock.id}
                        type="button"
                        onClick={() => {
                          toggleDock(dock.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '6px 12px',
                          background: 'transparent',
                          border: 'none',
                          color: isOpen ? '#ffffff' : 'var(--text-secondary, #a1a1aa)',
                          fontSize: 12,
                          fontWeight: isOpen ? 600 : 400,
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
                          e.currentTarget.style.color = isOpen ? '#ffffff' : 'var(--text-secondary, #a1a1aa)';
                        }}
                      >
                        <span>{getDockTitle(dock.id)}</span>
                        {isOpen && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #6366f1)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  resetDockLayout();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary, #a1a1aa)',
                  fontSize: 11,
                  fontWeight: 500,
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

      {/* Center: Outputs & Displays Toolbar (Audience, Stage, NDI) */}
      <div
        className="titlebar-center"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexShrink: 0,
          ...({ WebkitAppRegion: 'no-drag' } as any),
        }}
      >
        {/* Audience Display Button */}
        <button
          type="button"
          className="titlebar-icon-btn titlebar-display-btn"
          style={{
            ...styles.displayOutputBtn,
            background: isExternalDisplayActive ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
            borderColor: isExternalDisplayActive ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
            color: isExternalDisplayActive ? 'var(--accent, #6366F1)' : 'var(--text-dim)',
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            {isExternalDisplayActive && (
              <span style={{ position: 'absolute', top: -2, right: -5, width: 5, height: 5, borderRadius: '50%', background: 'var(--tally-preview, #22c55e)', boxShadow: '0 0 6px var(--tally-preview, #22c55e)' }} />
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
            Audience
          </span>
        </button>

        {/* Stage Display Button */}
        <button
          type="button"
          className="titlebar-icon-btn titlebar-display-btn"
          style={{
            ...styles.displayOutputBtn,
            background: stageOpen ? 'rgba(255, 85, 0, 0.16)' : 'transparent',
            borderColor: stageOpen ? 'rgba(255, 85, 0, 0.4)' : 'transparent',
            color: stageOpen ? 'var(--tally-program, #FF5500)' : 'var(--text-dim)',
            cursor: stageBusy ? 'progress' : 'pointer',
            opacity: stageBusy ? 0.7 : 1,
          }}
          onClick={toggleStageDisplay}
          title={stageOpen ? 'Stage Display Active (Confidence Monitor) — Click to Close' : 'Open Stage Display Window (Confidence Monitor)'}
          aria-label="Stage Display"
          aria-pressed={stageOpen}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M2 20h20" />
              <path d="M7 16l-2 4" />
              <path d="M17 16l2 4" />
            </svg>
            {stageOpen && (
              <span style={{ position: 'absolute', top: -2, right: -5, width: 5, height: 5, borderRadius: '50%', background: 'var(--tally-program, #FF5500)', boxShadow: '0 0 6px rgba(255,85,0,0.8)' }} />
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
            Stage
          </span>
        </button>

        {/* NDI Quick Toggle Button */}
        <button
          type="button"
          className="titlebar-icon-btn titlebar-display-btn"
          style={{
            ...styles.displayOutputBtn,
            background: ndiStatus?.running ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
            borderColor: ndiStatus?.running ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
            color: ndiStatus?.running ? 'var(--tally-link, #3b82f6)' : 'var(--text-dim)',
          }}
          onClick={toggleNdi}
          title={ndiStatus?.running ? `NDI Streaming Active (${ndiStatus.connections} receiver connected) - Click to Stop` : 'Start NDI Stream for OBS / vMix'}
          aria-label="NDI Stream"
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16.1A5 5 0 0 1 5.9 20" />
              <path d="M2 12.05A9 9 0 0 1 9.95 20" />
              <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
              <line x1="2" y1="20" x2="2.01" y2="20" strokeWidth="2.5" />
            </svg>
            {ndiStatus?.running && (
              <span style={{ position: 'absolute', top: -2, right: -5, width: 5, height: 5, borderRadius: '50%', background: 'var(--tally-preview, #22c55e)', boxShadow: '0 0 6px var(--tally-preview, #22c55e)' }} />
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
            NDI
          </span>
        </button>
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
              : 'transparent',
            borderColor: isBlackout
              ? 'rgba(239, 68, 68, 0.4)'
              : currentScene
              ? 'var(--bsp-signal-glow)'
              : 'transparent',
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
            background: !currentScene && standbyMedia ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            borderColor: !currentScene && standbyMedia ? 'var(--accent)' : 'transparent',
            color: !currentScene && standbyMedia ? 'var(--accent)' : 'var(--text-dim)',
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
            background: isBlackout ? 'var(--tally-fault)' : 'transparent',
            borderColor: isBlackout ? 'var(--tally-fault)' : 'transparent',
            color: isBlackout ? '#ffffff' : 'var(--text-dim)',
          }}
          onClick={toggleBlackout}
          title={isBlackout ? 'Blackout is ON — click to restore the audience screens' : 'Black out every audience screen'}
          aria-pressed={isBlackout}
        >
          BLACK
        </button>

        <div style={styles.divider} />

        {/* Quick Toolbar Action Buttons: Alerts, Settings, Theme */}
        <div style={styles.toolbarGroup}>
          {/* Alerts Button */}
          <button
            type="button"
            className="titlebar-icon-btn titlebar-display-btn"
            style={{
              ...styles.toolbarActionBtn,
              background: activeAlert || showAlertModal ? 'rgba(255, 85, 0, 0.16)' : 'transparent',
              borderColor: activeAlert || showAlertModal ? 'rgba(255, 85, 0, 0.4)' : 'transparent',
              color: activeAlert || showAlertModal ? '#FF5500' : 'var(--text-dim)',
            }}
            onClick={() => setShowAlertModal((v) => !v)}
            title={activeAlert ? `Alert ON AIR: "${activeAlert.text}" — Click to manage` : 'Broadcast On-Screen Alert to Display Screens'}
            aria-label="Alerts"
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {activeAlert && (
                <span style={{ position: 'absolute', top: -2, right: -5, width: 5, height: 5, borderRadius: '50%', background: '#FF5500', boxShadow: '0 0 6px #FF5500' }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
              Alerts
            </span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            className="titlebar-icon-btn titlebar-display-btn"
            style={styles.toolbarActionBtn}
            onClick={() => useAppStore.getState().openSettings('output')}
            title={t('app.openSettings')}
            aria-label={t('common.settings')}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
              Settings
            </span>
          </button>

          {/* UI Theme Switcher Button (Brand Identity Light / Dark Mode) */}
          <button
            type="button"
            className="titlebar-icon-btn titlebar-display-btn"
            style={{
              ...styles.toolbarActionBtn,
              color: 'var(--text-dim)',
            }}
            onClick={toggleUIThemeMode}
            title={uiThemeMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle UI Theme"
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uiThemeMode === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', lineHeight: 1 }}>
              Theme
            </span>
          </button>
        </div>
      </div>

      {/* Broadcast Alerts Modal */}
      {showAlertModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'transparent',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
          }}
        >
          <div
            style={{
              width: 440,
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              color: '#FFF',
              fontFamily: 'var(--font-ui)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Broadcast Screen Alert</span>
              </div>
              <button
                onClick={() => setShowAlertModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                Alert Message
              </label>
              <input
                type="text"
                className="input"
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendAlert();
                }}
                placeholder="e.g. Nursery Alert: #402 please come to nursery"
                autoFocus
                style={{
                  height: 38,
                  padding: '0 10px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--chrome-control)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Alert Controls Row 1: Type & Position */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                  Banner Type
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
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
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
    height: 60,
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
  controlsRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flex: 1,
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 28,
    padding: '0 10px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-primary)',
    borderRadius: 4,
    background: 'transparent',
    border: '1px solid transparent',
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
    height: 28,
    padding: '0 10px',
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 4,
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
    gap: 4,
  },
    toolbarActionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    padding: '3px 8px',
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 5,
    cursor: 'pointer',
    color: 'var(--text-dim)',
    transition: 'all 0.12s ease',
    flexShrink: 0,
    boxSizing: 'border-box',
    gap: 4,
    position: 'relative',
  },
  displayOutputBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    padding: '3px 10px',
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 5,
    cursor: 'pointer',
    color: 'var(--text-dim)',
    transition: 'all 0.12s ease',
    flexShrink: 0,
    boxSizing: 'border-box',
    gap: 4,
  },
  toolbarBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 24,
    padding: 0,
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 4,
    cursor: 'pointer',
    color: 'var(--text-dim)',
    transition: 'all 0.12s ease',
    flexShrink: 0,
    boxSizing: 'border-box',
    position: 'relative',
  },
  divider: {
    width: 1,
    height: 16,
    background: 'rgba(255, 255, 255, 0.12)',
    margin: '0 4px',
    flexShrink: 0,
  },
};
