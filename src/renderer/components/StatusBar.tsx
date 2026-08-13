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
              background: 'var(--tally-hold)',
            }}
          />
          {mode === 'basic' ? 'Basic — goes live instantly' : 'Studio — preview then take'}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: isExternalDisplayActive ? 'var(--tally-program)' : 'var(--tally-hold)',
            }}
          />
          {isExternalDisplayActive ? 'Ext Display' : 'No Ext Display'}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: ndiStatus?.running ? 'var(--tally-link)' : 'var(--tally-hold)',
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
        {/* The wordmark is monochrome. Signal is reserved for program state —
            on a bar that reports live status it must not be decorative. */}
        <span style={styles.item}>
          {/* styles.item is a flex container, so the wordmark needs its own
              inline box — a bare <sup> becomes a flex item and vertical-align
              is ignored. */}
          <span>Bible Song Pro<sup style={styles.sup}>Studio</sup></span>
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sup: {
    fontFamily: 'var(--font-signal)',
    fontSize: 8,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginLeft: '0.4em',
    verticalAlign: '0.3em',
    lineHeight: 0,
  },
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
