import { useAppStore } from '../stores/appStore';
import { type, numeric } from '../styles/type';

export function TranscriptionBar() {
  const transcription = useAppStore((s) => s.transcription);
  const setTranscription = useAppStore((s) => s.setTranscription);
  const aiProviders = useAppStore((s) => s.aiProviders);

  const enabledProvider = aiProviders.find((p) => p.enabled);

  if (!transcription.isActive && !transcription.text) {
    return (
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '0 16px',
          borderTop: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => {
            if (enabledProvider) {
              setTranscription({ isActive: true, provider: enabledProvider });
            }
          }}
          disabled={!enabledProvider}
        >
          Start Transcription
        </button>
        {!enabledProvider && (
          <span style={{ ...type.caption, color: 'var(--text-dim)' }}>
            Enable an AI provider in Settings
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        borderTop: '1px solid var(--border-primary)',
        background: 'rgba(201, 169, 110, 0.04)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: transcription.isActive ? '#2ecc71' : 'var(--text-dim)',
          animation: transcription.isActive ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ ...type.secondary, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {transcription.text || 'Listening...'}
      </span>
      <span style={{ ...type.caption, ...numeric, color: 'var(--text-dim)' }}>
        {(transcription.confidence * 100).toFixed(0)}%
      </span>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => setTranscription({ isActive: false, text: '' })}
        style={{ color: 'var(--red)' }}
      >
        Stop
      </button>
    </div>
  );
}
