import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';

export function TitleBar() {
  const platform = useAppStore((s) => s.platform);
  const mode = useAppStore((s) => s.display.mode);
  const setMode = useAppStore((s) => s.setMode);
  const setExternalDisplay = useAppStore((s) => s.setExternalDisplay);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (window.BSP) {
      window.BSP.window.isMaximized().then(setIsMaximized);
      window.BSP.window.isFullScreen().then(setIsFullScreen);
      window.BSP.window.onFullScreenChange(setIsFullScreen);
    }
  }, []);

  return (
    <div className="titlebar" style={styles.titlebar}>
      {/* No custom traffic lights on macOS — the window uses titleBarStyle 'hidden', so
          the system draws its own. Duplicating them just crowded the bar. The padding
          below reserves the space they occupy so the logo doesn't sit under them. */}
      <div
        className="titlebar-drag"
        style={{ ...styles.drag, paddingLeft: platform === 'darwin' ? 72 : 0 }}
      >
        <div style={styles.brand}>
          <img src="./bible-song-pro-icon.svg" alt="" style={styles.logo} />
          <span style={styles.title}>Bible Song<span style={styles.pro}>PRO</span> Max</span>
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
          title="External Display"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
        {platform !== 'darwin' && (
          <div style={styles.winControls}>
            <button style={styles.iconBtn} onClick={() => window.BSP?.window.minimize()}>
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <button style={styles.iconBtn} onClick={() => window.BSP?.window.maximize()}>
              <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <button style={{ ...styles.iconBtn, color: '#e74c3c' }} onClick={() => window.BSP?.window.close()}>
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
          </div>
        )}
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
    WebkitAppRegion: 'drag',
  } as React.CSSProperties & { WebkitAppRegion: string },
  brand: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: 'var(--text-primary)',
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 8,
    borderRadius: 6,
  },
  title: {
    WebkitAppRegion: 'no-drag',
  } as React.CSSProperties & { WebkitAppRegion: string },
  pro: {
    color: 'var(--accent)',
    fontWeight: 800,
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
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'var(--font-sans)',
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
