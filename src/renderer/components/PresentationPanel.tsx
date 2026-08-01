import { type, fontWeight } from '../styles/type';

export function PresentationPanel() {
  const handleOpen = () => {
    window.BSP.openSlideEditor();
  };

  const handleStageDisplay = () => {
    window.BSP.openStageDisplay();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Presentation</h2>
        <div style={styles.btnGroup}>
          <button style={styles.openBtn} onClick={handleStageDisplay}>
            Stage Display
          </button>
          <button style={styles.openBtn} onClick={handleOpen}>
            Open Slide Editor
          </button>
        </div>
      </div>
      <div style={styles.content}>
        <div style={styles.infoCard}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, color: 'var(--accent)', opacity: 0.5 }}>
            <rect x="3" y="4" width="18" height="14" rx="2"/>
            <path d="M8 21h8"/>
            <path d="M12 18v3"/>
            <path d="M7 9h10"/>
          </svg>
          <p style={styles.infoText}>
            Create and edit slide presentations with the full-screen Slide Editor.
          </p>
          <ul style={styles.featureList}>
            <li>Import PPTX, PDF, images, text files</li>
            <li>Full inspector with per-slide controls</li>
            <li>List and grid view modes</li>
            <li>Per-slide transitions and timing</li>
            <li>Speaker notes for each slide</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btnGroup: {
    display: 'flex',
    gap: 8,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: {
    ...type.title,
    margin: 0,
    color: 'var(--text-primary)',
  },
  openBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--border-accent)',
    background: 'var(--accent)',
    color: '#fff',
    ...type.secondary,
    fontWeight: fontWeight.semibold,
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 32,
    borderRadius: 16,
    border: '1px dashed var(--border-primary)',
    background: 'var(--bg-secondary)',
    maxWidth: 400,
    textAlign: 'center',
  },
  infoText: {
    ...type.body,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  featureList: {
    textAlign: 'left',
    ...type.caption,
    color: 'var(--text-dim)',
    lineHeight: 1.8,
    margin: 0,
    paddingLeft: 16,
  },
};
