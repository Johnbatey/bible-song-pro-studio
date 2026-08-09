import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontWeight } from '../styles/type';
import { NAV_DOCKS } from './dock/docks';
import { toggleDock } from './dock/dockController';
import { resetDockLayout } from './dock/DockHost';

export function TitleBar() {
  const mode = useAppStore((s) => s.display.mode);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const takeToProgram = useAppStore((s) => s.takeToProgram);
  const setExternalDisplay = useAppStore((s) => s.setExternalDisplay);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  const openDockIds = useAppStore((s) => s.openDockIds);
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
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
      triggerAlert({
        id: `ndi-${Date.now()}`,
        text: 'NDI Stream Stopped',
        type: 'info',
        duration: 3,
        animation: 'slideDown',
      });
    } else {
      const res = await window.BSP?.ndi?.start?.();
      if (res?.ok) {
        triggerAlert({
          id: `ndi-${Date.now()}`,
          text: 'NDI Stream Live (OBS / vMix)',
          type: 'info',
          duration: 4,
          animation: 'slideDown',
        });
      } else if (res?.error) {
        triggerAlert({
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
    const nextState = !isBlackout;
    setIsBlackout(nextState);
    if (nextState) {
      triggerAlert({
        id: String(Date.now()),
        text: 'BLACKOUT ACTIVE',
        type: 'warning',
        duration: 4000,
        animation: 'slide',
      });
    }
  };

  return (
    <div className="titlebar" style={styles.titlebar}>
      {/* Left: Window Drag Region & pill tabs */}
      <div className="titlebar-drag" style={styles.dragLeft}>
        <div style={styles.brand}>
          <img src="./bible-song-pro-icon.svg" alt="" style={styles.logo} />
        </div>

        {/* Dock visibility — a lit tab means that dock is on screen */}
        <div style={styles.pillContainer}>
          {NAV_DOCKS.map((dock) => {
            const isOpen = openDockIds.includes(dock.id);
            return (
              <button
                key={dock.id}
                style={{
                  ...styles.pillBtn,
                  background: isOpen ? 'var(--chrome-control-active)' : 'transparent',
                  color: isOpen ? '#ffffff' : 'var(--text-dim)',
                  fontWeight: isOpen ? fontWeight.semibold : fontWeight.medium,
                }}
                onClick={() => toggleDock(dock.id)}
                title={isOpen ? `Close the ${dock.title} dock` : `Open the ${dock.title} dock`}
              >
                {dock.title}
              </button>
            );
          })}
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

        {/* Live Status Badge */}
        <div style={styles.liveBadge}>
          <span style={styles.liveDot} />
          LIVE
        </div>

        {/* Blackout Toggle Button */}
        <button
          style={{
            ...styles.blackBtn,
            background: isBlackout ? '#ef4444' : 'var(--chrome-control)',
            color: isBlackout ? '#ffffff' : 'var(--text-secondary)',
          }}
          onClick={toggleBlackout}
        >
          BLACK
        </button>

        <div style={styles.divider} />

        {/* Quick Toolbar Action Buttons: Outputs, Copy URL, Design, Themes, Alerts, Settings */}
        <div style={styles.toolbarGroup}>
          {/* Outputs Button */}
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
            title="Toggle External Output Display"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Outputs
          </button>

          {/* NDI Quick Toggle Button */}
          <button
            style={{
              ...styles.toolbarBtn,
              background: ndiStatus?.running ? 'rgba(34, 197, 94, 0.18)' : styles.toolbarBtn.background,
              borderColor: ndiStatus?.running ? '#22c55e' : 'transparent',
              color: ndiStatus?.running ? '#22c55e' : 'var(--text-secondary)',
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
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              )}
            </span>
          </button>

          {/* Copy Display URL — sits with Outputs, the control it relates to */}
          <button
            style={{ ...styles.toolbarBtn, color: 'var(--text-secondary)' }}
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              triggerAlert({
                id: `url-${Date.now()}`,
                text: 'Display URL copied to clipboard',
                type: 'info',
                duration: 3,
                animation: 'slideDown',
              });
            }}
            title="Copy Display URL"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy URL
          </button>

          {/* Design Button (Opens Full Page Theme Designer) */}
          <button
            style={{
              ...styles.toolbarBtn,
              color: 'var(--text-secondary)',
            }}
            onClick={() => useAppStore.getState().openThemeDesigner()}
            title="Open Full Page Theme Designer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 0-10 10c0 4.42 3.58 8 8 8 1.1 0 2-.9 2-2 0-.46-.17-.88-.44-1.21-.26-.33-.44-.75-.44-1.22 0-1.1.9-2 2-2h2.8a5.2 5.2 0 0 0 5.2-5.2A10 10 0 0 0 12 2z" />
              <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" />
              <circle cx="12" cy="7.5" r="1.5" fill="currentColor" />
              <circle cx="16.5" cy="11.5" r="1.5" fill="currentColor" />
            </svg>
            Design
          </button>

          {/* Themes Button */}
          <button
            style={{
              ...styles.toolbarBtn,
              background: openDockIds.includes('themes') ? 'var(--chrome-control-active)' : styles.toolbarBtn.background,
              color: openDockIds.includes('themes') ? '#ffffff' : 'var(--text-secondary)',
            }}
            onClick={() => toggleDock('themes')}
            title="Themes Library"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
              <path d="M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
              <path d="M12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
            Themes
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

          {/* Reset the dock arrangement back to the shipped layout */}
          <button
            style={{ ...styles.toolbarBtn, color: 'var(--text-secondary)' }}
            onClick={() => resetDockLayout()}
            title="Reset panel layout"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Layout
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
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    objectFit: 'contain',
  },
  pillContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--chrome-control)',
    borderRadius: 8,
    padding: 3,
    gap: 2,
    border: '1px solid var(--chrome-control)',
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
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: 6,
    background: 'var(--chrome-control)',
    border: '1px solid var(--chrome-control)',
    letterSpacing: '0.04em',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
  },
  blackBtn: {
    padding: '4px 10px',
    border: '1px solid transparent',
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
    gap: 4,
  },
  toolbarBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '4px 10px',
    border: '1px solid var(--chrome-control)',
    background: 'var(--chrome-control)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    color: '#ffffff',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
  },
  divider: {
    width: 1,
    height: 22,
    background: 'var(--block-line)',
  },
};
