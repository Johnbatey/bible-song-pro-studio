import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontWeight, iconSize } from '../styles/type';

export function TitleBar() {
  const mode = useAppStore((s) => s.display.mode);
  const setMode = useAppStore((s) => s.setMode);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const takeToProgram = useAppStore((s) => s.takeToProgram);
  const setExternalDisplay = useAppStore((s) => s.setExternalDisplay);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isStudio = mode === 'studio';
  const hasPendingTake = isStudio && Boolean(previewScene) && currentScene?.id !== previewScene?.id;

  useEffect(() => {
    if (window.BSP) {
      window.BSP.window.isMaximized().then(setIsMaximized);
      window.BSP.window.isFullScreen().then(setIsFullScreen);
      window.BSP.window.onFullScreenChange(setIsFullScreen);
    }
  }, []);

  return (
    <div className="titlebar" style={styles.titlebar}>
      <div
        className="titlebar-drag"
        style={styles.drag}
      >
        <div style={styles.brand}>
          <img src="./bible-song-pro-icon.svg" alt="" style={styles.logo} />
          <span style={styles.title}>Bible Song Pro</span>
        </div>
      </div>
      <div style={styles.controls}>
        <div style={styles.modeSwitch}>
          <button
            style={{
              ...styles.modeBtn,
              background: mode === 'studio' ? 'var(--accent-dim)' : 'transparent',
              color: mode === 'studio' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={() => setMode('studio')}
            title="Studio — stage to Preview, then Take it live. Double-click goes straight to Program."
          >
            <span style={styles.modeDotPreview} />
            Studio
          </button>
          <button
            style={{
              ...styles.modeBtn,
              background: mode === 'basic' ? 'var(--accent-dim)' : 'transparent',
              color: mode === 'basic' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={() => setMode('basic')}
            title="Basic — everything you send goes live immediately."
          >
            <span style={styles.modeDotProgram} />
            Basic
          </button>
        </div>
        <div style={styles.divider} />
        <div style={styles.outputControls}>
          <div style={styles.outputModeSwitch}>
            <button
              style={{ ...styles.outputModeBtn, ...(outputMode === 'fullscreen' ? styles.outputModeBtnActive : {}) }}
              onClick={() => setOutputMode('fullscreen')}
              title="Fullscreen output"
            >
              FS
            </button>
            <button
              style={{ ...styles.outputModeBtn, ...(outputMode === 'lowerThird' ? styles.outputModeBtnActive : {}) }}
              onClick={() => setOutputMode('lowerThird')}
              title="Lower third output"
            >
              LT
            </button>
          </div>
          {hasPendingTake && (
            <>
              <button
                className="btn btn-sm btn-secondary"
                style={styles.takeBtn}
                onClick={() => takeToProgram(false)}
                title="Cut to program"
              >
                Cut
              </button>
              <button
                className="btn btn-sm btn-primary"
                style={styles.takeBtn}
                onClick={() => takeToProgram(true)}
                title="Take to program"
              >
                Take
              </button>
            </>
          )}
          {!isStudio && (
            <span style={styles.liveBadge} title="Basic mode sends directly to Program">
              ● LIVE
            </span>
          )}
        </div>
        <div style={styles.divider} />
        <button
          style={styles.iconBtn}
          onClick={async () => {
            await window.BSP?.openStageDisplay();
          }}
          title="Stage Display"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="6" width="16" height="12" rx="1" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="9" y1="22" x2="15" y2="22" />
            <circle cx="12" cy="10" r="1.5" />
          </svg>
        </button>
        <button
          style={{
            ...styles.iconBtn,
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
          title="External Display Window"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
        <button
          style={styles.iconBtn}
          onClick={() => useAppStore.getState().openSettings('output')}
          title="General Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <div style={styles.divider} />
        <div style={styles.winControls}>
          <button
            style={styles.iconBtn}
            onClick={() => window.BSP?.window.minimize()}
            title="Minimize Window"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            style={styles.iconBtn}
            onClick={async () => {
              await window.BSP?.window.maximize();
              const maxed = await window.BSP?.window.isMaximized();
              setIsMaximized(!!maxed);
            }}
            title={isMaximized ? "Restore Window" : "Maximize Window"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMaximized ? (
                <rect x="5" y="5" width="14" height="14" rx="1" />
              ) : (
                <rect x="3" y="3" width="18" height="18" rx="2" />
              )}
            </svg>
          </button>
          <button
            style={{ ...styles.iconBtn, color: 'var(--red)' }}
            onClick={() => window.BSP?.window.close()}
            title="Close Window"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    height: 44,
    padding: '0 12px',
    background: 'rgba(12, 14, 20, 0.95)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
    zIndex: 100,
  },
  drag: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    ...type.title,
    color: 'var(--text-primary)',
  },
  logo: {
    width: iconSize.lg,
    height: iconSize.lg,
    marginRight: 8,
    borderRadius: 6,
  },
  title: {
  },
  pro: {
    color: 'var(--accent)',
    fontWeight: fontWeight.semibold,
    marginLeft: 3,
    marginRight: 3,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  modeSwitch: {
    display: 'flex',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    padding: 2,
    gap: 1,
  },
  modeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 4,
    ...type.secondary,
    fontWeight: fontWeight.medium,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-ui)',
  },
  modeDotProgram: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#e74c3c',
  },
  modeDotPreview: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#2ecc71',
  },
  modeDotSimple: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#3498db',
  },
  outputControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  outputModeSwitch: {
    display: 'flex',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 2,
    background: 'rgba(255,255,255,0.04)',
  },
  outputModeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 4,
    padding: '4px 9px',
    ...type.label,
    cursor: 'pointer',
  },
  outputModeBtnActive: {
    background: 'var(--accent)',
    color: '#17120a',
  },
  takeBtn: {
    height: 26,
    padding: '0 12px',
  },
  liveBadge: {
    ...type.label,
    fontWeight: fontWeight.bold,
    color: '#e74c3c',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(231,76,60,0.12)',
    border: '1px solid rgba(231,76,60,0.3)',
  },
  divider: {
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.06)',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    background: 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s',
  },
  winControls: {
    display: 'flex',
    gap: 4,
    marginLeft: 4,
  },
};
