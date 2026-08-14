import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontSize, fontWeight } from '../styles/type';
import { NAV_DOCK_SECTIONS } from './dock/docks';
import { toggleDock } from './dock/dockController';

export function TitleBar() {
  const mode = useAppStore((s) => s.display.mode);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const takeToProgram = useAppStore((s) => s.takeToProgram);
  const setExternalDisplay = useAppStore((s) => s.setExternalDisplay);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  const notify = useAppStore((s) => s.notify);
  const openDockIds = useAppStore((s) => s.openDockIds);

  /* Blackout lives in the store, not in this component.
   *
   * It was `useState` here, which is why the button did nothing: the title bar
   * turned red and no surface ever heard about it. ProgramSurface has always
   * drawn `state.blackout`, and the display window and NDI feed have always
   * been fed from the store — the one thing missing was the button writing
   * there. */
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const isBlackout = useAppStore((s) => s.display.blackout);
  const setBlackout = useAppStore((s) => s.setBlackout);
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const toggleUIThemeMode = useAppStore((s) => s.toggleUIThemeMode);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const isStudio = mode === 'studio';
  const hasPendingTake = isStudio && Boolean(previewScene) && currentScene?.id !== previewScene?.id;

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

  const toggleNdi = async () => {
    if (ndiStatus?.running) {
      await window.BSP?.ndi?.stop?.();
      notify({
        id: `ndi-${Date.now()}`,
        text: 'NDI Stream Stopped',
        type: 'info',
        duration: 3,
        animation: 'slideDown',
      });
    } else {
      const res = await window.BSP?.ndi?.start?.();
      if (res?.ok) {
        notify({
          id: `ndi-${Date.now()}`,
          text: 'NDI Stream Live (OBS / vMix)',
          type: 'info',
          duration: 4,
          animation: 'slideDown',
        });
      } else if (res?.error) {
        notify({
          id: `ndi-${Date.now()}`,
          text: `NDI Error: ${res.error}`,
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
      text: next ? 'Blackout active — audience screens are black' : 'Blackout cleared',
      type: next ? 'warning' : 'info',
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

        {/* Dock visibility — a lit tab means that dock is on screen.
            Sectioned by a hairline rather than a heading: the groups are worth
            seeing at a glance, and this bar has no room to name them. The
            section is in the tooltip for anyone who wants it spelled out. */}
        <div style={styles.pillContainer}>
          {NAV_DOCK_SECTIONS.map((section, index) => (
            <div key={section.id} style={styles.pillGroup}>
              {index > 0 && <span style={styles.pillDivider} aria-hidden="true" />}
              {section.docks.map((dock) => {
                const isOpen = openDockIds.includes(dock.id);
                return (
                  <button
                    key={dock.id}
                    style={{
                      ...styles.pillBtn,
                      background: isOpen ? 'var(--chrome-control-active)' : 'transparent',
                      color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isOpen ? fontWeight.semibold : fontWeight.medium,
                    }}
                    onClick={() => toggleDock(dock.id)}
                    title={`${section.label} · ${isOpen ? `Close the ${dock.title} dock` : `Open the ${dock.title} dock`}`}
                  >
                    {dock.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right Controls: Live status, Black, Toolbar & Window Actions */}
      <div style={styles.controlsRight}>
        {/* Cut / Take Buttons if Studio Pending */}
        {hasPendingTake && (
          <div style={styles.takeGroup}>
            <button
              className="btn btn-sm btn-secondary"
              style={styles.takeBtn}
              onClick={() => takeToProgram(false)}
            >
              Cut
            </button>
            <button
              className="btn btn-sm btn-primary"
              style={{ ...styles.takeBtn, background: 'var(--accent)', borderColor: 'var(--accent)' }}
              onClick={() => takeToProgram(true)}
            >
              Take
            </button>
          </div>
        )}

        {/* Live / Standby / Blackout Dynamic Status Pill */}
        <button
          type="button"
          style={{
            ...styles.liveBadge,
            cursor: 'pointer',
            background: isBlackout
              ? 'rgba(239, 68, 68, 0.15)'
              : currentScene
              ? 'rgba(16, 185, 129, 0.15)'
              : 'var(--chrome-control)',
            borderColor: isBlackout
              ? 'rgba(239, 68, 68, 0.4)'
              : currentScene
              ? 'rgba(16, 185, 129, 0.4)'
              : 'var(--border-primary)',
            color: isBlackout
              ? '#EF4444'
              : currentScene
              ? '#10B981'
              : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
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
              background: isBlackout ? '#EF4444' : currentScene ? '#10B981' : '#6B7280',
              boxShadow: isBlackout
                ? '0 0 8px rgba(239, 68, 68, 0.8)'
                : currentScene
                ? '0 0 8px rgba(16, 185, 129, 0.8)'
                : 'none',
            }}
          />
          {isBlackout ? 'BLACKOUT' : currentScene ? 'LIVE' : 'STANDBY'}
        </button>

        {/* Blackout Toggle Button */}
        <button
          style={{
            ...styles.blackBtn,
            background: isBlackout ? 'var(--tally-fault)' : 'var(--chrome-control)',
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
          {/* Audience Display Button */}
          <button
            style={{
              ...styles.toolbarBtn,
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
            title="Toggle Audience Display Window (Projector/Screen)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Audience
          </button>

          {/* NDI Quick Toggle Button */}
          <button
            style={{
              ...styles.toolbarBtn,
              background: ndiStatus?.running ? 'rgba(59, 130, 246, 0.18)' : styles.toolbarBtn.background,
              borderColor: ndiStatus?.running ? 'var(--tally-link)' : 'transparent',
              color: ndiStatus?.running ? 'var(--tally-link)' : 'var(--text-secondary)',
              fontWeight: ndiStatus?.running ? 700 : 500,
            }}
            onClick={toggleNdi}
            title={ndiStatus?.running ? `NDI Streaming Active (${ndiStatus.connections} receiver connected) - Click to Stop` : 'Start NDI Stream for OBS / vMix'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              NDI
              {ndiStatus?.running && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tally-preview)', boxShadow: '0 0 6px var(--tally-preview)' }} />
              )}
            </span>
          </button>

          {/* Alerts Button */}
          <button
            style={styles.toolbarBtn}
            onClick={() => {
              const msg = prompt('Enter Alert Message for Screen:', 'Nursery Call #402');
              if (msg) {
                triggerAlert({
                  id: String(Date.now()),
                  text: msg,
                  type: 'announcement',
                  duration: 6000,
                  animation: 'fade',
                });
              }
            }}
            title="Trigger On-Screen Lower-Third Alert"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Alerts
          </button>

          {/* Settings Button */}
          <button
            style={styles.toolbarBtn}
            onClick={() => useAppStore.getState().openSettings('output')}
            title="Open Application Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>

          {/* UI Theme Switcher Button (Brand Identity Light / Dark Mode) */}
          <button
            style={{
              ...styles.toolbarBtn,
              color: uiThemeMode === 'light' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={toggleUIThemeMode}
            title={uiThemeMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle UI Theme"
          >
            {uiThemeMode === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {uiThemeMode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* No window controls here — the OS frame already draws them. */}
      </div>
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
    background: 'var(--chrome-control)',
    borderRadius: 6,
    padding: 3,
    gap: 2,
    border: '1px solid var(--chrome-control)',
  },
  pillGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  /* A hairline, not a rule: enough to read as a break between groups from a
     metre away, not enough to look like a control. */
  pillDivider: {
    width: 1,
    height: 16,
    margin: '0 6px',
    /* Not --border-primary: that rule is #262628, which is a hairline against
       the app's ground but all but invisible on the raised fill this pill
       strip sits on. Mute, held back, is the same idea at a contrast the
       operator can actually see from where they sit. */
    background: 'var(--bsp-mute)',
    opacity: 0.5,
    flexShrink: 0,
  },
  pillBtn: {
    padding: '5px 14px',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
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
    height: 28,
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-primary)',
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--chrome-control)',
    border: '1px solid var(--border-primary)',
    letterSpacing: '0.04em',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--tally-preview)',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
  },
  blackBtn: {
    padding: '4px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'all 0.15s ease',
  },
  toolbarGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  toolbarBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 42,
    gap: 3,
    padding: 0,
    border: '1px solid var(--border-primary)',
    background: 'var(--chrome-control)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    color: 'var(--text-primary)',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  divider: {
    width: 1,
    height: 22,
    background: 'var(--block-line)',
  },
};
