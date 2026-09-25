import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { type } from '../styles/type';
import { useI18n } from '../../i18n/useI18n';

export function StatusBar() {
  const { t } = useI18n();
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
          {mode === 'basic' ? t('status.mode.basic') : t('status.mode.studio')}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: isExternalDisplayActive ? 'var(--tally-program)' : 'var(--tally-hold)',
            }}
          />
          {isExternalDisplayActive ? t('status.output.on') : t('status.output.off')}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <span
            style={{
              ...styles.dot,
              background: ndiStatus?.running ? 'var(--tally-link)' : 'var(--tally-hold)',
            }}
          />
          {ndiStatus?.running
            ? t('status.ndi.on', { count: ndiStatus.connections })
            : t('status.ndi.off')}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {transcription.isActive ? t('status.transcribing') : t('status.transcriptionOff')}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
          {t('status.scenes', { count: scenes.length })}
        </span>
        {currentScene && (
          <>
            <span style={styles.separator} />
            <span style={styles.item}>
              {t('status.live', { name: currentScene.name })}
            </span>
          </>
        )}
      </div>
      <div style={styles.right}>
        <span style={styles.item}>
          {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform}
        </span>
        <span style={styles.separator} />
        <span style={styles.item}>
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
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  item: {
    ...type.caption,
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--text-dim)',
    whiteSpace: 'nowrap',
  },
  separator: {
    width: 1,
    height: 12,
    background: 'var(--border-primary)',
    margin: '0 10px',
    flexShrink: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 'var(--radius-dot)',
    marginRight: 6,
    flexShrink: 0,
  },
};
