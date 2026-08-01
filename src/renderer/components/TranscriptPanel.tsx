import { useAppStore } from '../stores/appStore';

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
    <section className="transcript-panel">
      <div className="transcript-panel__header">
        <span className="transcript-panel__label">Transcript</span>
        <span className={transcription.isActive ? 'transcript-panel__status is-live' : 'transcript-panel__status'}>
          {transcription.isActive ? 'Live' : 'Off'}
        </span>
      </div>

      <div className="transcript-panel__body">
        <p className={transcription.text ? 'transcript-panel__text' : 'transcript-panel__placeholder'}>
          {transcription.text || (transcription.isActive ? 'Listening...' : 'Transcript appears here')}
        </p>
      </div>

      <div className="transcript-panel__footer">
        {transcription.isActive || transcription.text ? (
          <>
            <span className="transcript-panel__confidence">
              {Math.round((transcription.confidence || 0) * 100)}%
            </span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={stopTranscription}
            >
              Stop
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-sm btn-secondary"
              onClick={startTranscription}
              disabled={!enabledProvider}
            >
              Start Transcription
            </button>
            {!enabledProvider && <span className="transcript-panel__hint">Enable a provider in Settings</span>}
          </>
        )}
      </div>
    </section>
  );
}
