import { useAppStore } from '../stores/appStore';

export function PreviewProgramView() {
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const isTransitioning = useAppStore((s) => s.display.isTransitioning);
  const mode = useAppStore((s) => s.display.mode);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const takeToProgram = useAppStore((s) => s.takeToProgram);
  const activeTheme = useAppStore((s) => s.activeTheme);

  const isStudio = mode === 'studio';
  // Something is staged that the audience isn't seeing yet
  const hasPendingTake = isStudio && Boolean(previewScene) && currentScene?.id !== previewScene?.id;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>{isStudio ? 'Preview / Program' : 'Program'}</span>
        <div style={styles.actions}>
          <div style={styles.modeSwitch}>
            <button
              style={{ ...styles.modeBtn, ...(outputMode === 'fullscreen' ? styles.modeBtnActive : {}) }}
              onClick={() => setOutputMode('fullscreen')}
              title="Fullscreen output"
            >
              FS
            </button>
            <button
              style={{ ...styles.modeBtn, ...(outputMode === 'lowerThird' ? styles.modeBtnActive : {}) }}
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
                onClick={() => takeToProgram(false)}
                title="Cut to program (no transition)"
              >
                Cut
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => takeToProgram(true)}
                title="Take to program with a transition"
              >
                Take
              </button>
            </>
          )}
          {!isStudio && (
            <span style={styles.liveBadge} title="Basic mode — everything you send goes live immediately">
              ● LIVE
            </span>
          )}
        </div>
      </div>
      <div style={styles.canvasWrapper}>
        {/* Preview exists only in studio mode */}
        {isStudio && (
          <div style={styles.previewCol}>
            <div style={styles.label}>
              <span style={{ ...styles.dot, background: hasPendingTake ? '#f1c40f' : '#2ecc71' }} />
              Preview{hasPendingTake ? ' · ready to take' : ''}
            </div>
            <div style={{ ...styles.displayBox, borderColor: hasPendingTake ? '#f1c40f' : undefined }}>
              <DisplayContent scene={previewScene} outputMode={outputMode} theme={activeTheme} />
            </div>
          </div>
        )}
        {/* Program */}
        <div style={isStudio ? styles.previewCol : styles.programColSolo}>
          <div style={styles.label}>
            <span style={{ ...styles.dot, background: '#e74c3c' }} />
            Program{!isStudio ? ' · live' : ''}
          </div>
          <div style={{ ...styles.displayBox, borderColor: 'var(--border-accent)' }}>
            {isTransitioning && (
              <div style={styles.transitionOverlay}>
                <div style={styles.transitionSpinner} />
              </div>
            )}
            <DisplayContent scene={currentScene} outputMode={outputMode} theme={activeTheme} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DisplayContent({ scene, outputMode, theme }: { scene: any; outputMode: 'fullscreen' | 'lowerThird'; theme: any }) {
  if (!scene) {
    return (
      <div style={styles.emptyState}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          No scene selected
        </span>
      </div>
    );
  }

  const bg = scene.background || {};
  const bgStyle: React.CSSProperties = {};
  if (bg.type === 'gradient') {
    bgStyle.background = bg.gradient || 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)';
  } else if (bg.type === 'solid') {
    bgStyle.background = bg.color || '#000';
  } else if (bg.type === 'transparent') {
    bgStyle.background = 'transparent';
  } else {
    bgStyle.background = 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)';
  }

  return (
    <div style={{ ...styles.displayInner, ...bgStyle }}>
      {outputMode === 'lowerThird' ? (
        <div
          style={{
            ...styles.lowerThird,
            background: theme?.lowerThird?.background || 'linear-gradient(135deg, rgba(10,18,32,0.94), rgba(37,52,78,0.94))',
            color: theme?.lowerThird?.fontColor || '#fff',
            borderRadius: `${theme?.lowerThird?.borderRadius ?? 8}px`,
            width: `${theme?.lowerThird?.width ?? 92}%`,
            fontFamily: theme?.lowerThird?.fontFamily || 'inherit',
          }}
        >
          <div style={{ ...styles.ltText, fontSize: theme?.lowerThird?.fontSize ? Math.max(10, theme.lowerThird.fontSize / 3) : undefined }}>
            {scene.content?.text || ''}
          </div>
          {scene.content?.reference && <div style={styles.ltRef}>{scene.content.reference}</div>}
        </div>
      ) : (
        <>
          {scene.content?.html ? (
            <div style={styles.slidePreview} dangerouslySetInnerHTML={{ __html: scene.content.html }} />
          ) : scene.content?.text && (
            <div
              style={{
                ...styles.displayText,
                color: theme?.fullScreen?.fontColor || '#fff',
                fontFamily: theme?.fullScreen?.fontFamily || 'inherit',
                textAlign: theme?.fullScreen?.textAlign || 'center',
              }}
            >
              {scene.content.text}
            </div>
          )}
          {scene.content?.reference && (
            <div style={styles.displayRef}>
              {scene.content.reference}
            </div>
          )}
          {scene.content?.version && (
            <div style={styles.displayVersion}>
              {scene.content.version}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flexShrink: 0,
    padding: '12px 16px 14px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
  },
  actions: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  modeSwitch: {
    display: 'flex',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    padding: 2,
    background: 'rgba(255,255,255,0.04)',
  },
  modeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 4,
    padding: '4px 9px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  modeBtnActive: {
    background: 'var(--accent)',
    color: '#17120a',
  },
  canvasWrapper: {
    display: 'flex',
    gap: 12,
  },
  previewCol: {
    flex: 1,
    minWidth: 0,
  },
  // Basic mode: one pane, but capped so it doesn't dominate the window
  programColSolo: {
    flex: 1,
    minWidth: 0,
    maxWidth: '52%',
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#e74c3c',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(231,76,60,0.12)',
    border: '1px solid rgba(231,76,60,0.3)',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  displayBox: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: '#000',
    border: '1px solid var(--border-primary)',
  },
  displayInner: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    textAlign: 'center',
  },
  lowerThird: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 12,
    padding: '10px 14px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    textAlign: 'left',
  },
  ltText: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.25,
    whiteSpace: 'pre-line',
  },
  ltRef: {
    marginTop: 4,
    fontSize: 9,
    opacity: 0.68,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  slidePreview: {
    color: '#fff',
    fontSize: 'clamp(12px, 1.6vw, 22px)',
    lineHeight: 1.35,
    maxWidth: '88%',
  },
  displayText: {
    fontSize: 'clamp(14px, 1.8vw, 24px)',
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.4,
    textShadow: '0 2px 10px rgba(0,0,0,0.3)',
  },
  displayRef: {
    fontSize: 'clamp(10px, 0.9vw, 13px)',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  displayVersion: {
    fontSize: 'clamp(8px, 0.7vw, 10px)',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  emptyState: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transitionOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  transitionSpinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
};
