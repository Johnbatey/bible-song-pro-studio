import { useState, useEffect } from 'react';
import type { UpdateCheckResult } from '../types';
import { useI18n } from '../../i18n/useI18n';

export function UpdateBanner() {
  const { t } = useI18n();
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      if (!window.BSP?.updates?.check) return;
      try {
        const res = await window.BSP.updates.check();
        if (res?.updateAvailable) {
          setUpdateInfo(res);
        }
      } catch (err) {
        // Silent catch for offline or non-GitHub builds
      }
    }
    // Check 3 seconds after startup so it doesn't block initial rendering
    const timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!updateInfo || !updateInfo.updateAvailable || dismissed) {
    return null;
  }

  const handleOpenRelease = () => {
    if (updateInfo.releaseUrl && window.BSP?.openExternal) {
      window.BSP.openExternal(updateInfo.releaseUrl);
    }
  };

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <span style={styles.badge}>{t('update.badge')}</span>
        <span style={styles.text}>
          {t('update.text', { version: updateInfo.latestVersion || '' })}
        </span>
      </div>
      <div style={styles.actions}>
        <button style={styles.updateBtn} onClick={handleOpenRelease}>
          {t('update.download')}
        </button>
        <button style={styles.closeBtn} onClick={() => setDismissed(true)} title={t('update.dismiss')}>
          ✕
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '8px 16px',
    background: 'linear-gradient(90deg, #1e1b4b 0%, #31103f 50%, #431407 100%)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'var(--font-ui)',
    zIndex: 9999,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  badge: {
    background: '#FF5500',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 10,
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  text: {
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  updateBtn: {
    background: '#ffffff',
    color: '#0f172a',
    border: 'none',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  closeBtn: {
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
  },
};
