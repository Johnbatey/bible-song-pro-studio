import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';

interface TranscriptPanelProps {
  onOpenLiveScripture?: () => void;
}

export function TranscriptPanel({ onOpenLiveScripture }: TranscriptPanelProps) {
  const transcription = useAppStore((s) => s.transcription);
  const aiProviders = useAppStore((s) => s.aiProviders);
  const enabledProvider = aiProviders.find((p) => p.enabled);

  function startTranscription() {
    onOpenLiveScripture?.();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('bsp:live-transcription-start'));
    }, 100);
  }

  function stopTranscription() {
    window.dispatchEvent(new CustomEvent('bsp:live-transcription-stop'));
  }

  return (
    <Block
      className="transcript-panel"
      title="Live transcript"
      tools={(
        <BlockButton icon onClick={onOpenLiveScripture} title="Open Live Scripture">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </BlockButton>
      )}
      centered
      footer={(
        <>
          {transcription.isActive ? (
            <button style={styles.stopBtn} onClick={stopTranscription}>
              <span style={styles.stopDot} />
              Stop transcribing
            </button>
          ) : (
            <button
              style={{ ...styles.startBtn, opacity: enabledProvider ? 1 : 0.6 }}
              onClick={startTranscription}
              disabled={!enabledProvider}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span style={styles.startLabel}>Start transcribing</span>
            </button>
          )}
          <span
            style={{
              ...styles.recDot,
              background: transcription.isActive ? '#ef4444' : '#3f3f46',
            }}
            title={transcription.isActive ? 'Recording' : 'Idle'}
          />
        </>
      )}
    >
      <p style={transcription.text ? styles.text : styles.placeholder}>
        {transcription.text || (transcription.isActive ? 'Listening for Bible verses...' : 'Transcript appears here')}
      </p>
    </Block>
  );
}

const styles: Record<string, React.CSSProperties> = {
  text: {
    fontSize: 13,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  placeholder: {
    fontSize: 12,
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
  startBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 10px',
    background: 'transparent',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  startLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#22c55e',
  },
  recDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid var(--block-line)',
    boxShadow: 'inset 0 0 0 5px var(--block-active)',
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#ef4444',
  },
};
