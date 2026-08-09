import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { type } from '../styles/type';

export function StatusBar() {
  const platform = useAppStore((s) => s.platform);
  const mode = useAppStore((s) => s.display.mode);
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);
  const transcription = useAppStore((s) => s.transcription);
  const scenes = useAppStore((s) => s.scenes);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const [ndiStatus, setNdiStatus] = useState<{ running: boolean; connections: number } | null>(null);

  useEffect(() => {
    const check = () => {
      window.BSP?.ndi?.status?.().then((st) => {
        setNdiStatus(st ? { running: Boolean(st.running), connections: st.connections || 0 } : null);
      }).catch(() => {});
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: mode === 'basic' ? '#e74c3c' : '#3498db',
            }}
          />
          {mode === 'basic' ? 'Basic — goes live instantly' : 'Studio — preview then take'}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: isExternalDisplayActive ? '#2ecc71' : 'var(--text-dim)',
            }}
          />
          {isExternalDisplayActive ? 'Ext Display' : 'No Ext Display'}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: ndiStatus?.running ? '#2ecc71' : 'var(--text-dim)',
            }}
          />
          {ndiStatus?.running ? `NDI Stream (${ndiStatus.connections})` : 'NDI Off'}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {transcription.isActive ? 'Transcribing' : 'Transcription Off'}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          {scenes.length} Scenes
        </span>
        {currentScene && (
          <>
            <span style={styles.separator} />
            <span style={styles.item}>
              Live: {currentScene.name}
            </span>
          </>
        )}
      </div>
      <div style={styles.right}>
        <span style={styles.item}>
          {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform}
        </span>
        <span style={styles.separator} />
        <span style={{ ...styles.item, color: 'var(--accent)' }}>
          Bible Song Pro
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    padding: '0 12px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-primary)',
    flexShrink: 0,
    ...type.caption,
    color: 'var(--text-dim)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  separator: {
    width: 1,
    height: 12,
    background: 'var(--border-primary)',
  },
};
