import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { startAudioCapture, toPcm16Buffer, STT_SAMPLE_RATE, type AudioCaptureHandle } from '../services/audio-capture';
import type { AudioInputDevice, BibleSearchResult, Scene, SttState, SttStatus } from '../types';

/** Short enough to feel live, while still giving Whisper enough speech context. */
const LOCAL_CHUNK_SECONDS = 3;
const DETECT_DEBOUNCE_MS = 90;
const DETECT_WINDOW_WORDS = 48;

const STATE_LABELS: Record<SttState, { text: string; color: string }> = {
  idle: { text: 'Idle', color: 'var(--text-dim)' },
  connecting: { text: 'Connecting…', color: 'var(--amber, #f1c40f)' },
  live: { text: 'Live', color: 'var(--green, #2ecc71)' },
  reconnecting: { text: 'Reconnecting…', color: 'var(--amber, #f1c40f)' },
  stalled: { text: 'Stalled', color: 'var(--red, #e74c3c)' },
  error: { text: 'Error', color: 'var(--red, #e74c3c)' },
};

export function LiveScripturePanel() {
  const live = useAppStore((s) => s.liveScripture);
  const setLive = useAppStore((s) => s.setLiveScripture);
  const setTranscription = useAppStore((s) => s.setTranscription);
  const projectScene = useAppStore((s) => s.projectScene);

  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [version, setVersion] = useState('KJV');
  const [versions, setVersions] = useState<Array<{ id: string; abbreviation: string; name: string }>>([]);
  const [engine, setEngine] = useState<'local' | 'deepgram'>('local');
  const [sttStatus, setSttStatus] = useState<SttStatus | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [notice, setNotice] = useState('');

  const captureRef = useRef<AudioCaptureHandle | null>(null);
  const localBufferRef = useRef<Float32Array[]>([]);
  const localSamplesRef = useRef(0);
  const localBusyRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectSequenceRef = useRef(0);
  const lastDetectionTextRef = useRef('');

  useEffect(() => {
    refreshInputs();
    window.BSP?.bible?.getVersions().then(setVersions).catch(() => {});
    window.BSP?.settings?.get().then((res) => {
      if (!res?.ok) return;
      setKeyConfigured(Boolean(res.settings.deepgramApiKeySet));
      if (res.settings.sttEngine) setEngine(res.settings.sttEngine);
    }).catch(() => {});
    window.BSP?.stt?.status().then(setSttStatus).catch(() => {});

    const off = window.BSP?.stt?.onEvent((event) => {
      if (event.type === 'state') {
        setSttStatus(event.status);
        if (event.state === 'stalled' || event.state === 'error') {
          setNotice(event.status.lastError || event.detail);
          teardownCapture();
          setLive({ isActive: false });
        }
      } else if (event.type === 'transcript') {
        handleTranscript(event.text, event.isFinal);
      } else if (event.type === 'error') {
        setNotice(event.error);
      }
    });

    return () => {
      off?.();
      stopLive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshInputs() {
    try {
      await navigator.mediaDevices?.getUserMedia({ audio: true });
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }));
      setDevices(inputs);
      useAppStore.getState().setAudioInputDevices(inputs);
      if (!live.selectedInputId && inputs[0]) setLive({ selectedInputId: inputs[0].deviceId });
    } catch {
      setDevices([]);
      setNotice('Microphone access was denied. Grant it in System Settings → Privacy → Microphone.');
    }
  }

  /**
   * Deepgram streams interim results that revise themselves, so only finals are
   * appended to the running transcript; interims are shown but not accumulated.
   */
  function handleTranscript(text: string, isFinal: boolean) {
    if (isFinal) {
      finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.trim();
      interimTranscriptRef.current = '';
    } else {
      interimTranscriptRef.current = text;
    }
    const combined = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
    setLive({ transcript: combined });
    setTranscription({ isActive: true, text: combined });
    scheduleDetection(combined, isFinal);
  }

  function scheduleDetection(text: string, isFinal: boolean) {
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    const words = text.trim().split(/\s+/).filter(Boolean);
    const rollingText = words.slice(-DETECT_WINDOW_WORDS).join(' ');
    if (!rollingText || (!isFinal && rollingText.split(/\s+/).length < 3)) return;
    detectTimerRef.current = setTimeout(() => detectFromText(rollingText, isFinal), isFinal ? 0 : DETECT_DEBOUNCE_MS);
  }

  async function detectFromText(text: string, isFinal: boolean) {
    const cleaned = text.trim();
    if (!cleaned) return;
    if (cleaned === lastDetectionTextRef.current) return;
    const sequence = ++detectSequenceRef.current;
    const result = await window.BSP?.verse?.detect({
      text: cleaned,
      options: { versionId: version, modes: ['direct', 'contextual', 'verbatim', 'semantic'], limit: 6, minConfidence: isFinal ? 0.3 : 0.4 },
    }).catch(() => null);
    if (sequence !== detectSequenceRef.current) return;
    const detections = result?.detections || [];
    const suggestions = await window.BSP?.bible?.search({ versionId: version, query: cleaned, limit: 6 }).catch(() => []) as BibleSearchResult[];
    if (sequence !== detectSequenceRef.current) return;
    const bestHit = detections.length > 0
      ? { reference: detections[0].displayRef, text: detections[0].text, book: detections[0].book, chapter: detections[0].chapter, verse: detections[0].verseStart, version } as BibleSearchResult
      : suggestions[0] || null;
    lastDetectionTextRef.current = cleaned;
    setLive({ bestHit, suggestions });
    setTranscription({ isActive: true, text: cleaned, confidence: detections[0]?.confidence ?? (bestHit ? 0.65 : 0.45) });
    // Interim hypotheses revise themselves. Surface their suggestions immediately,
    // but wait for a final result before changing the live output.
    if (isFinal && bestHit && useAppStore.getState().liveScripture.autoProject) sendHit(bestHit);
  }

  /** Local engine: batch ~5s of audio, then run one Whisper pass over it. */
  async function flushLocalBuffer() {
    if (localBusyRef.current || localBufferRef.current.length === 0) return;
    localBusyRef.current = true;
    const chunks = localBufferRef.current;
    const total = localSamplesRef.current;
    localBufferRef.current = [];
    localSamplesRef.current = 0;

    const merged = new Float32Array(total);
    let offset = 0;
    chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.length; });

    try {
      // Sent as a typed array — structured clone handles it, and Array.from() on
      // ~80k samples per pass is pure overhead.
      const result = await window.BSP?.ai?.transcribe({ audioData: merged, language: 'en' });
      if (result?.ok && result.text?.trim()) handleTranscript(result.text.trim(), true);
      else if (result && !result.ok) setNotice(result.error || 'Local transcription failed');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      localBusyRef.current = false;
    }
  }

  function teardownCapture() {
    captureRef.current?.stop();
    captureRef.current = null;
    localBufferRef.current = [];
    localSamplesRef.current = 0;
    setLive({ meter: { level: 0, peak: 0, isMonitoring: false } });
  }

  async function startLive() {
    setNotice('');
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    lastDetectionTextRef.current = '';
    detectSequenceRef.current += 1;
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    detectTimerRef.current = null;

    if (engine === 'deepgram') {
      const started = await window.BSP?.stt?.start({});
      if (!started?.ok) {
        setNotice(started?.error || 'Could not start Deepgram');
        setSttStatus(started?.status || null);
        return;
      }
      setSttStatus(started.status);
    } else {
      // Warm the local model up front so the first utterance isn't swallowed by a download
      window.BSP?.ai?.warmup({ engine: 'onnx' }).catch(() => {});
    }

    try {
      captureRef.current = await startAudioCapture({
        deviceId: live.selectedInputId || undefined,
        onLevel: (level) => {
          const peak = Math.max(level, useAppStore.getState().liveScripture.meter.peak * 0.94);
          setLive({ meter: { level, peak, isMonitoring: true } });
        },
        onAudio: (frames) => {
          if (engine === 'deepgram') {
            window.BSP?.stt?.sendAudio(toPcm16Buffer(frames));
          } else {
            localBufferRef.current.push(frames);
            localSamplesRef.current += frames.length;
            if (localSamplesRef.current >= STT_SAMPLE_RATE * LOCAL_CHUNK_SECONDS) flushLocalBuffer();
          }
        },
        onError: (err) => setNotice(err.message),
      });
      setLive({ isActive: true, provider: engine === 'deepgram' ? 'deepgram' : 'local' });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not open the microphone');
      if (engine === 'deepgram') window.BSP?.stt?.stop();
    }
  }

  function stopLive() {
    teardownCapture();
    window.BSP?.stt?.stop()
      .then(() => window.BSP?.stt?.status().then(setSttStatus))
      .catch(() => {});
    setLive({ isActive: false });
    setTranscription({ isActive: false });
  }

  function sendHit(hit: BibleSearchResult) {
    const scene: Scene = {
      id: `live-${Date.now()}`,
      name: `Live ${hit.reference}`,
      type: live.detectionMode === 'song' ? 'song' : 'bible',
      content: {
        text: hit.text,
        reference: `${hit.reference} (${hit.version})`,
        version: hit.version,
      },
      background: { type: 'gradient', gradient: 'linear-gradient(135deg,#0f172a,#1e1b4b,#312e81)' },
      transition: { type: 'fade', duration: 0.4 },
    };
    projectScene(scene);
    window.BSP?.session?.addEntry({
      type: 'verse', reference: hit.reference, book: hit.book, chapter: hit.chapter, verse: hit.verse,
      text: hit.text, version: hit.version, mode: live.detectionMode, source: 'detection',
      confidence: live.bestHit === hit ? 0.9 : 0.6,
    }).catch(() => {});
  }

  const statusInfo = STATE_LABELS[sttStatus?.state || 'idle'];
  const deepgramUnavailable = engine === 'deepgram' && !keyConfigured;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Live Scripture</h2>
        <div style={styles.actions}>
          <button className={`btn btn-sm ${live.detectionMode === 'bible' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLive({ detectionMode: 'bible' })}>Bible</button>
          <button className={`btn btn-sm ${live.detectionMode === 'song' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLive({ detectionMode: 'song' })}>Song</button>
          <button className="btn btn-sm btn-secondary" onClick={refreshInputs}>Refresh Inputs</button>
          <button
            className={`btn btn-sm ${live.isActive ? 'btn-secondary' : 'btn-primary'}`}
            onClick={live.isActive ? stopLive : startLive}
            disabled={deepgramUnavailable}
            title={deepgramUnavailable ? 'Add a Deepgram API key in Settings first' : undefined}
          >
            {live.isActive ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      <div className="glass" style={styles.controlCard}>
        <select className="input" value={live.selectedInputId} onChange={(e) => setLive({ selectedInputId: e.target.value })} disabled={live.isActive}>
          {devices.length === 0 && <option value="">No microphone available</option>}
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
        <select
          className="input"
          value={engine}
          onChange={(e) => {
            const next = e.target.value as 'local' | 'deepgram';
            setEngine(next);
            window.BSP?.settings?.set({ sttEngine: next }).catch(() => {});
          }}
          disabled={live.isActive}
          style={{ maxWidth: 150 }}
        >
          <option value="local">Local (Whisper)</option>
          <option value="deepgram">Deepgram (cloud)</option>
        </select>
        <select className="input" value={version} onChange={(e) => setVersion(e.target.value)} style={{ maxWidth: 110 }}>
          {(versions.length ? versions : [{ id: 'KJV', abbreviation: 'KJV', name: 'King James Version' }]).map((v) => <option key={v.id} value={v.id}>{v.abbreviation}</option>)}
        </select>
        <div style={styles.meter} aria-label="Mic meter">
          <div style={{ ...styles.meterFill, width: `${Math.round(live.meter.level * 100)}%` }} />
          <div style={{ ...styles.meterPeak, left: `${Math.round(live.meter.peak * 100)}%` }} />
        </div>
        <span style={{ fontSize: 11, color: statusInfo.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
          ● {engine === 'deepgram' ? statusInfo.text : live.isActive ? 'Listening' : 'Idle'}
        </span>
      </div>

      {deepgramUnavailable && (
        <div style={styles.warn}>
          Deepgram needs an API key — add one under <strong>Settings → Transcription</strong>, or switch to Local.
        </div>
      )}
      {notice && <div style={styles.warn}>{notice}</div>}

      <div style={styles.options}>
        <label style={styles.check}><input type="checkbox" checked={live.autoProject} onChange={(e) => setLive({ autoProject: e.target.checked })} /> Auto project direct references</label>
        <label style={styles.check}><input type="checkbox" checked={live.autoVersionSwitch} onChange={(e) => setLive({ autoVersionSwitch: e.target.checked })} /> Auto version switch</label>
        <label style={styles.check}><input type="checkbox" checked={live.autoProjectQuoted} onChange={(e) => setLive({ autoProjectQuoted: e.target.checked })} /> Project quoted matches</label>
      </div>

      <div style={styles.split}>
        <div className="card" style={styles.panel}>
          <div className="section-title">Live Transcript</div>
          <textarea
            className="input"
            value={live.transcript}
            onChange={(e) => { finalTranscriptRef.current = e.target.value; setLive({ transcript: e.target.value }); }}
            onBlur={(e) => detectFromText(e.target.value, true)}
            placeholder="Speech appears here as it is recognised. You can also type or paste sermon text and click away to detect."
            style={styles.transcript}
          />
        </div>
        <div className="card" style={styles.panel}>
          <div className="section-title">Detected Verses</div>
          {live.bestHit ? (
            <button style={styles.hit} onClick={() => sendHit(live.bestHit!)}>
              <strong>{live.bestHit.reference}</strong>
              <span>{live.bestHit.text}</span>
            </button>
          ) : <div style={styles.placeholder}>Top detected verse will appear here.</div>}
          <div style={styles.suggestions}>
            {live.suggestions.slice(1).map((hit) => (
              <button key={hit.reference} className="btn btn-sm btn-secondary" onClick={() => sendHit(hit)}>{hit.reference}</button>
            ))}
          </div>
        </div>
      </div>

      {sttStatus && engine === 'deepgram' && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-title">Deepgram Status</div>
          <div style={styles.statusGrid}>
            <span>State</span><span style={{ color: statusInfo.color }}>{statusInfo.text}</span>
            <span>Model</span><span>{sttStatus.model} · {sttStatus.language}</span>
            <span>Audio sent</span><span>{(sttStatus.bytesSent / 1024 / 1024).toFixed(2)} MB @ {sttStatus.sampleRate / 1000} kHz</span>
            <span>Reconnects</span><span>{sttStatus.reconnectAttempts}</span>
            {sttStatus.lastError ? (<><span>Last error</span><span style={{ color: 'var(--red, #e74c3c)' }}>{sttStatus.lastError}</span></>) : null}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: 600 },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  controlCard: { display: 'flex', gap: 8, alignItems: 'center', padding: 12, borderRadius: 'var(--radius-md)' },
  meter: { position: 'relative', flex: 1, height: 12, minWidth: 100, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' },
  meterFill: { height: '100%', background: 'linear-gradient(90deg,#2ecc71,#f1c40f,#e74c3c)', borderRadius: 999 },
  meterPeak: { position: 'absolute', top: 0, width: 2, height: '100%', background: '#fff' },
  options: { display: 'flex', gap: 14, flexWrap: 'wrap', margin: '10px 0', fontSize: 11, color: 'var(--text-secondary)' },
  check: { display: 'flex', alignItems: 'center', gap: 6 },
  split: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 },
  panel: { minHeight: 270 },
  transcript: { minHeight: 210, resize: 'vertical', lineHeight: 1.5 },
  hit: { width: '100%', border: '1px solid var(--border-accent)', background: 'var(--accent-dim)', color: 'var(--text-primary)', borderRadius: 8, padding: 12, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  placeholder: { color: 'var(--text-dim)', fontSize: 12, padding: 18, textAlign: 'center' },
  suggestions: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  warn: { fontSize: 11, color: 'var(--amber, #f1c40f)', background: 'rgba(241,196,15,0.08)', border: '1px solid rgba(241,196,15,0.25)', borderRadius: 8, padding: '8px 10px', margin: '10px 0' },
  statusGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 11, color: 'var(--text-secondary)' },
};
