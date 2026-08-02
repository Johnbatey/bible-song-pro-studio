import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontWeight } from '../styles/type';

interface TitleBarProps {
  activePanel?: string;
  onPanelChange?: (panel: any) => void;
}

export function TitleBar({ activePanel = 'bible', onPanelChange }: TitleBarProps) {
  const mode = useAppStore((s) => s.display.mode);
  const setMode = useAppStore((s) => s.setMode);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const takeToProgram = useAppStore((s) => s.takeToProgram);
  const setExternalDisplay = useAppStore((s) => s.setExternalDisplay);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const isStudio = mode === 'studio';
  const hasPendingTake = isStudio && Boolean(previewScene) && currentScene?.id !== previewScene?.id;

  useEffect(() => {
    if (window.BSP) {
      window.BSP.window.isMaximized().then(setIsMaximized);
      window.BSP.window.isFullScreen().then(setIsFullScreen);
      window.BSP.window.onFullScreenChange(setIsFullScreen);
    }
  }, []);

  const handleTabClick = (tab: 'bible' | 'presentation' | 'songs') => {
    if (onPanelChange) {
      onPanelChange(tab);
    }
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

        {/* Segmented pill switcher */}
        <div style={styles.pillContainer}>
          <button
            style={{
              ...styles.pillBtn,
              background: activePanel === 'bible' ? 'var(--accent)' : 'transparent',
              color: activePanel === 'bible' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: activePanel === 'bible' ? fontWeight.semibold : fontWeight.medium,
            }}
            onClick={() => handleTabClick('bible')}
          >
            Scriptures
          </button>
          <button
            style={{
              ...styles.pillBtn,
              background: activePanel === 'presentation' ? 'var(--accent)' : 'transparent',
              color: activePanel === 'presentation' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: activePanel === 'presentation' ? fontWeight.semibold : fontWeight.medium,
            }}
            onClick={() => handleTabClick('presentation')}
          >
            Slides
          </button>
          <button
            style={{
              ...styles.pillBtn,
              background: activePanel === 'songs' || activePanel === 'songlibrary' ? 'var(--accent)' : 'transparent',
              color: activePanel === 'songs' || activePanel === 'songlibrary' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: activePanel === 'songs' || activePanel === 'songlibrary' ? fontWeight.semibold : fontWeight.medium,
            }}
            onClick={() => handleTabClick('songs')}
          >
            Songs
          </button>
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
            background: isBlackout ? '#ef4444' : 'rgba(255, 255, 255, 0.06)',
            color: isBlackout ? '#ffffff' : 'var(--text-secondary)',
          }}
          onClick={toggleBlackout}
        >
          BLACK
        </button>

        <div style={styles.divider} />

        {/* Quick Toolbar Action Buttons: Outputs, Themes, Studio, Alerts, Settings */}
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

          {/* Themes Button */}
          <button
            style={{
              ...styles.toolbarBtn,
              color: activePanel === 'themes' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={() => onPanelChange && onPanelChange('themes')}
            title="Themes Designer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
              <path d="M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
              <path d="M12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
            Themes
          </button>

          {/* Studio Toggle Button */}
          <button
            style={{
              ...styles.toolbarBtn,
              color: isStudio || activePanel === 'scenes' ? 'var(--accent)' : 'var(--text-secondary)',
              background: isStudio || activePanel === 'scenes' ? 'var(--accent-dim)' : 'transparent',
            }}
            onClick={() => {
              if (isStudio) {
                setMode('basic');
                if (onPanelChange) onPanelChange('bible');
              } else {
                setMode('studio');
                if (onPanelChange) onPanelChange('scenes');
              }
            }}
            title="Toggle Studio Mode & Canvas Editor"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            Studio
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
        </div>

        <div style={styles.divider} />

        {/* macOS / Window Control Buttons */}
        <div style={styles.winControls}>
          <button
            style={styles.winIconBtn}
            onClick={() => window.BSP?.window.minimize()}
            title="Minimize"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            style={styles.winIconBtn}
            onClick={async () => {
              await window.BSP?.window.maximize();
              const maxed = await window.BSP?.window.isMaximized();
              setIsMaximized(!!maxed);
            }}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMaximized ? (
                <rect x="5" y="5" width="14" height="14" rx="1" />
              ) : (
                <rect x="3" y="3" width="18" height="18" rx="2" />
              )}
            </svg>
          </button>
          <button
            style={{ ...styles.winIconBtn, color: 'var(--red)' }}
            onClick={() => window.BSP?.window.close()}
            title="Close"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  titlebar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    padding: '0 14px',
    background: '#121214',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
    background: '#1a1a1e',
    borderRadius: 8,
    padding: 3,
    gap: 2,
    border: '1px solid rgba(255, 255, 255, 0.06)',
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
    background: '#1c1c1f',
    border: '1px solid rgba(255, 255, 255, 0.1)',
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
    border: '1px solid rgba(255, 255, 255, 0.1)',
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
    border: 'none',
    background: 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
  },
  divider: {
    width: 1,
    height: 22,
    background: 'rgba(255, 255, 255, 0.08)',
  },
  winControls: {
    display: 'flex',
    gap: 4,
    marginLeft: 2,
  },
  winIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    border: 'none',
    background: 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  },
};
