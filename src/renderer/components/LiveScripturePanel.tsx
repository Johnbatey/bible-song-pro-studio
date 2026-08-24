import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { startAudioCapture, toPcm16Buffer, STT_SAMPLE_RATE, type AudioCaptureHandle } from '../services/audio-capture';
import type { AudioInputDevice, BibleSearchResult, Scene, SttState, SttStatus, VerseDetection, WordStudyEntry } from '../types';
import { WordStudyCard } from './WordStudyCard';
import { type, fontWeight, numeric } from '../styles/type';
import { Block } from './Block';
import { SlidingSwitch } from './SlidingSwitch';
import { CustomDropdown } from './CustomDropdown';
import { AppleToggle } from './AppleToggle';
import { PanelSplitter } from './PanelSplitter';
import { SongDeck } from './song/SongDeck';
import { useBarPosition, MoveBarButton } from '../hooks/useBarPosition';
import { detectSongs, type SongDetection } from '../utils/song-detection';

/** Short enough to feel live, while still giving Whisper/Moonshine full speech and reference context. */
const LOCAL_CHUNK_SECONDS = 2.0;
const DETECT_DEBOUNCE_MS = 60;
/** Focused active utterance window for high-precision live matching without historical sermon pollution. */
const DETECT_WINDOW_WORDS = 18;
/** Roughly an hour of speech; the panel only ever shows the tail anyway. */
const TRANSCRIPT_MAX_CHARS = 20000;

const STATE_LABELS: Record<SttState, { text: string; color: string }> = {
  idle: { text: 'Idle', color: 'var(--text-dim)' },
  connecting: { text: 'Connecting…', color: 'var(--tally-hold)' },
  live: { text: 'Live', color: 'var(--tally-preview)' },
  reconnecting: { text: 'Reconnecting…', color: 'var(--tally-hold)' },
  stalled: { text: 'Stalled', color: 'var(--tally-fault)' },
  error: { text: 'Error', color: 'var(--tally-fault)' },
};

export function LiveScripturePanel() {
  const live = useAppStore((s) => s.liveScripture);
  const setLive = useAppStore((s) => s.setLiveScripture);
  const setTranscription = useAppStore((s) => s.setTranscription);
  const projectScene = useAppStore((s) => s.projectScene);
  const songs = useAppStore((s) => s.songs);

  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [version, setVersion] = useState('KJV');
  const [versions, setVersions] = useState<Array<{ id: string; abbreviation: string; name: string }>>([]);
  const [engine, setEngine] = useState<'local' | 'deepgram'>('deepgram');
  const [sttStatus, setSttStatus] = useState<SttStatus | null>(null);
  const [keyConfigured, setKeyConfigured] = useState(false);
  // A notice reports either a fault or a plain fact, and it is coloured as
  // whichever it is. There is no warning colour in this system and inventing
  // one would put a sixth hue next to a five-state tally.
  const [notice, setNotice] = useState<{ text: string; tone: 'fault' | 'info' }>({ text: '', tone: 'info' });
  const reportFault = (text: string) => setNotice({ text, tone: 'fault' });
  const reportInfo = (text: string) => setNotice({ text, tone: 'info' });
  const [rankedDetections, setRankedDetections] = useState<VerseDetection[]>([]);
  const [detectionIsFinal, setDetectionIsFinal] = useState(false);
  const [detectionLatencyMs, setDetectionLatencyMs] = useState(0);
  const [songMatches, setSongMatches] = useState<SongDetection[]>([]);
  const [pickedSongId, setPickedSongId] = useState<string | null>(null);
  const [activeWordStudy, setActiveWordStudy] = useState<WordStudyEntry | null>(null);
  const { position: barPosition, move: moveBar } = useBarPosition('bsp_liveBarPosition', 'top');
  const [primaryWidth, setPrimaryWidth] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_livePrimaryWidth');
    return saved ? parseInt(saved, 10) : 230;
  });

  const setPrimaryWidthPersisted = (next: number) => {
    setPrimaryWidth(next);
    localStorage.setItem('bsp_livePrimaryWidth', String(next));
  };

  const captureRef = useRef<AudioCaptureHandle | null>(null);
  const candidateStabilityRef = useRef<{
    ref: string;
    count: number;
    firstSeen: number;
    retainedHit: BibleSearchResult | null;
    retainedSuggestions: BibleSearchResult[];
    retainedDetections: VerseDetection[];
    retainedAt: number;
  }>({
    ref: '',
    count: 0,
    firstSeen: 0,
    retainedHit: null,
    retainedSuggestions: [],
    retainedDetections: [],
    retainedAt: 0,
  });
  const localBufferRef = useRef<Float32Array[]>([]);
  const localSamplesRef = useRef(0);
  const localBusyRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectSequenceRef = useRef(0);
  const lastDetectionTextRef = useRef('');
  const lastProjectedRef = useRef({ key: '', at: 0 });
  /* A ref, not state: this is read inside the transcription loop, which must
     not be re-created — and re-rendering the panel every time Settings is
     touched would restart the recogniser mid-service. */
  const sermonLanguageRef = useRef<string>('auto');

  useEffect(() => {
    refreshInputs();
    window.BSP?.bible?.getVersions().then(setVersions).catch(() => {});

    const applySettings = (settingsData: any) => {
      if (!settingsData) return;
      const isKeySet = Boolean(settingsData.deepgramApiKeySet);
      setKeyConfigured(isKeySet);
      if (settingsData.sttEngine) {
        setEngine(settingsData.sttEngine === 'deepgram' ? 'deepgram' : 'local');
      } else {
        setEngine(isKeySet ? 'deepgram' : 'local');
      }
      if (settingsData.sermonLanguage) sermonLanguageRef.current = settingsData.sermonLanguage;
      if (isKeySet || settingsData.sttEngine === 'local') {
        setNotice((prev) => (prev.text.includes('API key') || prev.text.includes('Deepgram') ? { text: '', tone: 'info' } : prev));
      }
    };

    const refreshSettings = () => {
      window.BSP?.settings?.get().then((res) => {
        if (res?.ok && res.settings) applySettings(res.settings);
      }).catch(() => {});
    };
    refreshSettings();

    const offSettings = window.BSP?.settings?.onUpdated?.((updated) => {
      applySettings(updated);
    });

    const onSettingsCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) applySettings(detail);
      else refreshSettings();
    };

    window.BSP?.stt?.status().then(setSttStatus).catch(() => {});

    const off = window.BSP?.stt?.onEvent((event) => {
      if (event.type === 'state') {
        setSttStatus(event.status);
        if (event.state === 'stalled' || event.state === 'error') {
          reportFault(event.status.lastError || event.detail);
          teardownCapture();
          setLive({ isActive: false });
        }
      } else if (event.type === 'transcript') {
        handleTranscript(event.text, event.isFinal);
      } else if (event.type === 'error') {
        reportFault(event.error);
      }
    });

    const startFromTranscriptPanel = () => {
      if (!useAppStore.getState().liveScripture.isActive) startLive();
    };
    const stopFromTranscriptPanel = () => {
      stopLive();
      setTranscription({ isActive: false, text: '', interimText: '' });
    };
    window.addEventListener('bsp:live-transcription-start', startFromTranscriptPanel);
    window.addEventListener('bsp:live-transcription-stop', stopFromTranscriptPanel);
    window.addEventListener('bsp:settings-updated', onSettingsCustomEvent);
    window.addEventListener('focus', refreshSettings);

    return () => {
      off?.();
      offSettings?.();
      window.removeEventListener('bsp:live-transcription-start', startFromTranscriptPanel);
      window.removeEventListener('bsp:live-transcription-stop', stopFromTranscriptPanel);
      window.removeEventListener('bsp:settings-updated', onSettingsCustomEvent);
      window.removeEventListener('focus', refreshSettings);
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
      reportFault('Microphone access was denied. Grant it in System Settings → Privacy → Microphone.');
    }
  }

  /**
   * Deepgram streams interim results that revise themselves, so only finals are
   * appended to the running transcript; interims are shown but not accumulated.
   */
  function handleTranscript(text: string, isFinal: boolean) {
    if (isFinal) {
      const appended = `${finalTranscriptRef.current} ${text}`.trim();
      // A service runs for hours; keep the tail rather than growing forever.
      finalTranscriptRef.current = appended.length > TRANSCRIPT_MAX_CHARS
        ? appended.slice(appended.length - TRANSCRIPT_MAX_CHARS).replace(/^\S*\s/, '')
        : appended;
      interimTranscriptRef.current = '';
    } else {
      interimTranscriptRef.current = text;
    }
    const combined = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
    setLive({ transcript: combined });
    // Sent apart so the panel can hold settled text still and only redraw the
    // tail the engine is still revising.
    setTranscription({
      isActive: true,
      text: finalTranscriptRef.current,
      interimText: interimTranscriptRef.current,
    });
    // Feed the active recent utterance with rolling window across chunk boundaries
    const activeUtterance = isFinal
      ? `${finalTranscriptRef.current.split(/\s+/).slice(-14).join(' ')} ${text}`.trim()
      : `${finalTranscriptRef.current.split(/\s+/).slice(-6).join(' ')} ${interimTranscriptRef.current}`.trim();
    scheduleDetection(activeUtterance, isFinal);
  }

  function scheduleDetection(activeText: string, isFinal: boolean) {
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    const cleaned = activeText.trim();
    if (!cleaned) return;
    const words = cleaned.split(/\s+/).filter(Boolean);
    const rollingText = words.slice(-DETECT_WINDOW_WORDS).join(' ');
    if (!rollingText || (!isFinal && rollingText.split(/\s+/).length < 2)) return;
    // Direct references in interim streams are evaluated with minimal delay (60ms)
    detectTimerRef.current = setTimeout(() => detectFromText(rollingText, isFinal), isFinal ? 0 : DETECT_DEBOUNCE_MS);
  }

  async function detectFromText(text: string, isFinal: boolean) {
    const cleaned = text.trim();
    if (!cleaned) return;
    const transcriptKey = `${isFinal ? 'final' : 'interim'}|${cleaned}`;
    if (transcriptKey === lastDetectionTextRef.current) return;
    const sequence = ++detectSequenceRef.current;
    const detectionStartedAt = performance.now();
    const prefsBeforeDetection = useAppStore.getState().liveScripture;

    // 1. Spoken verse navigation commands ("next verse", "previous verse", "first verse", "last verse")
    const navCmd = isFinal ? detectNavigationCommand(cleaned) : null;
    if (navCmd) {
      lastDetectionTextRef.current = transcriptKey;
      await handleNavigationCommand(navCmd);
      reportInfo(
        navCmd === 'next' ? 'Navigated to next verse.' :
        navCmd === 'prev' ? 'Navigated to previous verse.' :
        navCmd === 'first' ? 'Navigated to first verse of chapter.' : 'Navigated to last verse of chapter.'
      );
      return;
    }

    const versionRequest = isFinal ? detectVersionRequest(cleaned, versions) : null;
    let detectionVersion = version;
    if (versionRequest) {
      if (prefsBeforeDetection.autoVersionSwitch) {
        detectionVersion = versionRequest.versionId;
        await handleVersionChange(detectionVersion);
        reportInfo(`Bible version switched to ${versionRequest.label}.`);
      } else {
        setLive({ requestedVersion: versionRequest.versionId });
        reportInfo(`${versionRequest.label} was requested. Enable Auto version switch or click Switch Version.`);
      }
    }

    const allowedModes: Array<'direct' | 'contextual' | 'verbatim' | 'semantic'> = ['direct', 'contextual', 'verbatim'];
    if (prefsBeforeDetection.allowParaphrase !== false) {
      allowedModes.push('semantic');
    }

    const result = await window.BSP?.verse?.detect({
      text: cleaned,
      options: {
        versionId: detectionVersion,
        modes: allowedModes,
        limit: 6,
        minConfidence: isFinal ? 0.35 : 0.45,
        isFinal,
      },
    }).catch(() => null);
    if (sequence !== detectSequenceRef.current) return;
    const detections = result?.detections || [];
    const suggestions: BibleSearchResult[] = detections.map((d) => ({
      reference: d.displayRef,
      text: d.text,
      book: d.book,
      chapter: d.chapter,
      verse: d.verseStart,
      version: detectionVersion,
    }));
    
    let effectiveDetections = detections;
    let effectiveSuggestions = suggestions;
    let topHit = effectiveSuggestions[0] || null;
    const topDetection = effectiveDetections[0] || null;
    const now = Date.now();

    if (topHit && topDetection) {
      const modeClass = classifyProjectionMode(topDetection.mode);
      const isStrongDirect = modeClass === 'direct' && topDetection.confidence >= 0.85;

      if (isStrongDirect) {
        // Direct spoken citations lock in immediately and reset decay
        candidateStabilityRef.current = {
          ref: topHit.reference,
          count: 1,
          firstSeen: now,
          retainedHit: topHit,
          retainedSuggestions: effectiveSuggestions,
          retainedDetections: effectiveDetections,
          retainedAt: now,
        };
      } else if (modeClass === 'semantic') {
        const refKey = topHit.reference;
        if (candidateStabilityRef.current.ref === refKey) {
          candidateStabilityRef.current.count += 1;
        } else {
          // If a new loose semantic candidate arrives with low-to-moderate confidence,
          // don't immediately thrash the previously retained stable hit if it's fresh (within 3500ms)
          if (
            topDetection.confidence < 0.72 &&
            candidateStabilityRef.current.retainedHit &&
            now - candidateStabilityRef.current.retainedAt < 3500
          ) {
            topHit = candidateStabilityRef.current.retainedHit;
            effectiveSuggestions = candidateStabilityRef.current.retainedSuggestions;
            effectiveDetections = candidateStabilityRef.current.retainedDetections;
          } else {
            candidateStabilityRef.current = {
              ref: refKey,
              count: 1,
              firstSeen: now,
              retainedHit: topHit,
              retainedSuggestions: effectiveSuggestions,
              retainedDetections: effectiveDetections,
              retainedAt: now,
            };
          }
        }
      } else {
        // Verbatim or contextual
        if (topDetection.confidence >= 0.65) {
          candidateStabilityRef.current = {
            ref: topHit.reference,
            count: 1,
            firstSeen: now,
            retainedHit: topHit,
            retainedSuggestions: effectiveSuggestions,
            retainedDetections: effectiveDetections,
            retainedAt: now,
          };
        }
      }
    } else {
      // No immediate candidate found in this small chunk/breath pause or after a version command.
      // Hold previously retained match for 3500ms (or refresh timestamp on version request) so results do NOT flicker or disappear!
      if (
        candidateStabilityRef.current.retainedHit &&
        (now - candidateStabilityRef.current.retainedAt < 3500 || Boolean(versionRequest))
      ) {
        topHit = candidateStabilityRef.current.retainedHit;
        effectiveSuggestions = candidateStabilityRef.current.retainedSuggestions;
        effectiveDetections = candidateStabilityRef.current.retainedDetections;
        candidateStabilityRef.current.retainedAt = now;
      }
    }

    lastDetectionTextRef.current = transcriptKey;
    setRankedDetections(effectiveDetections);
    setDetectionIsFinal(isFinal);
    setDetectionLatencyMs(Math.max(0, Math.round(performance.now() - detectionStartedAt)));
    setLive({ bestHit: topHit, suggestions: effectiveSuggestions });
    setTranscription({ isActive: true, confidence: effectiveDetections[0]?.confidence ?? (topHit ? 0.65 : 0.45) });

    // Live Word Study / Lexicon term detection
    window.BSP?.lexicon?.detect(cleaned).then((match) => {
      if (match) setActiveWordStudy(match);
    }).catch(() => {});

    // Auto-projection guard:
    // Direct spoken citations trigger instantly; verbatim quotes trigger on confidence;
    // Semantic paraphrases are NEVER auto-projected to live screens without explicit operator click.
    if (topHit && effectiveDetections[0]) {
      const mode = String(effectiveDetections[0]?.mode || '');
      const prefs = useAppStore.getState().liveScripture;
      const matchClass = classifyProjectionMode(mode);
      const shouldProject = (matchClass === 'direct' && prefs.autoProject && effectiveDetections[0].confidence >= 0.90) ||
                            (matchClass === 'quoted' && prefs.autoProjectQuoted && isFinal && effectiveDetections[0].confidence >= 0.85);

      const key = `${detectionVersion}|${topHit.reference}`;
      if (shouldProject && (lastProjectedRef.current.key !== key || now - lastProjectedRef.current.at > 3500)) {
        lastProjectedRef.current = { key, at: now };
        sendHit(topHit, { goLive: true, confidence: effectiveDetections[0].confidence, sourceMode: mode });
      }
    }
  }

  /** Local engine: batch ~1.5s of audio, then run one Whisper/Moonshine pass over it. */
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
      const result = await window.BSP?.ai?.transcribe({
        audioData: merged,
        language: sermonLanguageRef.current,
      });
      if (result?.ok && result.text?.trim()) handleTranscript(result.text.trim(), true);
      else if (result && !result.ok) reportFault(result.error || 'Local transcription failed');
    } catch (err) {
      reportFault(err instanceof Error ? err.message : String(err));
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
    window.BSP?.settings?.get().then((res) => {
      if (res?.ok && res.settings.sermonLanguage) {
        sermonLanguageRef.current = res.settings.sermonLanguage;
      }
    }).catch(() => {});
    setNotice({ text: '', tone: 'info' });
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    lastDetectionTextRef.current = '';
    detectSequenceRef.current += 1;
    candidateStabilityRef.current = {
      ref: '',
      count: 0,
      firstSeen: 0,
      retainedHit: null,
      retainedSuggestions: [],
      retainedDetections: [],
      retainedAt: 0,
    };
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    detectTimerRef.current = null;

    if (engine === 'deepgram') {
      const started = await window.BSP?.stt?.start({});
      if (!started?.ok) {
        reportFault(started?.error || 'Could not connect to Deepgram — check your API key in Settings.');
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
        onError: (err) => reportFault(err.message),
      });
      setLive({ isActive: true, provider: engine });
      const provider = useAppStore.getState().aiProviders.find((entry) => entry.type === (engine === 'deepgram' ? 'deepgram' : 'local')) || null;
      setTranscription({ isActive: true, provider });
    } catch (err) {
      reportFault(err instanceof Error ? err.message : 'Could not open the microphone');
      if (engine === 'deepgram') window.BSP?.stt?.stop();
    }
  }

  function stopLive() {
    teardownCapture();
    if (engine === 'deepgram') {
      window.BSP?.stt?.stop()
        .then(() => window.BSP?.stt?.status().then(setSttStatus))
        .catch(() => {});
    }
    setLive({ isActive: false });
    setTranscription({ isActive: false });
  }

  function sendHit(hit: BibleSearchResult, options: { goLive?: boolean; confidence?: number; sourceMode?: string } = {}) {
    const scene: Scene = {
      id: `live-${Date.now()}`,
      name: `Live ${hit.reference}`,
      type: live.detectionMode === 'song' ? 'song' : 'bible',
      content: {
        text: hit.text,
        reference: `${hit.reference} (${hit.version})`,
        version: hit.version,
      },
      /* No background on purpose.
       *
       * A scene's own background beats the theme's — that is the rule the
       * output renderer works to, and it is the right one: an operator who
       * puts a picture behind a verse means it. But this scene named a flat
       * near-black nobody chose, on every verse the detector fired, so the
       * theme's ground never got a look in and Live sent black to the screen
       * while the Bible panel sent the same verse on the theme.
       *
       * The Bible panel's scenes carry no background either. Detection is a
       * different way to reach a verse, not a different way to dress one. */
      transition: { type: 'fade', duration: 0.15 },
    };
    // Auto-project means Program/Audience, including in Studio mode. Without `direct`
    // the shared projector intentionally stages the scene in Preview only.
    projectScene(scene, { direct: options.goLive === true });
    window.BSP?.session?.addEntry({
      type: 'verse', reference: hit.reference, book: hit.book, chapter: hit.chapter, verse: hit.verse,
      text: hit.text, version: hit.version, mode: options.sourceMode || live.detectionMode, source: 'detection',
      confidence: options.confidence ?? (live.bestHit === hit ? 0.9 : 0.6),
    }).catch(() => {});
  }

  function setDirectAutoProject(enabled: boolean) {
    setLive({ autoProject: enabled });
    const detection = rankedDetections[0];
    if (enabled && live.bestHit && detection && classifyProjectionMode(detection.mode) === 'direct') {
      sendHit(live.bestHit, { goLive: true, confidence: detection.confidence, sourceMode: detection.mode });
    }
  }

  function setQuotedAutoProject(enabled: boolean) {
    setLive({ autoProjectQuoted: enabled });
    const detection = rankedDetections[0];
    if (enabled && live.bestHit && detection && classifyProjectionMode(detection.mode) === 'quoted') {
      sendHit(live.bestHit, { goLive: true, confidence: detection.confidence, sourceMode: detection.mode });
    }
  }

  function extractVerses(res: unknown): Array<{ book: string; chapter: number; verse: number; text: string; version?: string; reference?: string }> {
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object' && Array.isArray((res as any).verses)) return (res as any).verses;
    return [];
  }

  async function handleVersionChange(targetVersionId: string) {
    if (!targetVersionId) return;
    setVersion(targetVersionId);
    setLive({ requestedVersion: null });

    const currentHit = live.bestHit || candidateStabilityRef.current.retainedHit;
    if (!currentHit) return;

    try {
      const chapterRes = await window.BSP?.bible?.getChapter({
        versionId: targetVersionId,
        book: currentHit.book,
        chapter: currentHit.chapter,
      }).catch(() => null);

      const verses = extractVerses(chapterRes);
      const matchedVerse = verses.find((v) => Number(v.verse) === Number(currentHit.verse));
      const newText = matchedVerse?.text || currentHit.text;

      const updatedHit: BibleSearchResult = {
        ...currentHit,
        text: newText,
        version: targetVersionId,
      };

      setLive({ bestHit: updatedHit });
      candidateStabilityRef.current = {
        ...candidateStabilityRef.current,
        ref: updatedHit.reference,
        retainedHit: updatedHit,
        retainedAt: Date.now(),
      };

      const prevSuggestions = live.suggestions || [];
      if (prevSuggestions.length) {
        const updatedSuggestions = await Promise.all(
          prevSuggestions.map(async (sug) => {
            if (sug.book === currentHit.book && sug.chapter === currentHit.chapter) {
              const v = verses.find((x) => Number(x.verse) === Number(sug.verse));
              return { ...sug, text: v?.text || sug.text, version: targetVersionId };
            }
            const chRes = await window.BSP?.bible?.getChapter({
              versionId: targetVersionId,
              book: sug.book,
              chapter: sug.chapter,
            }).catch(() => null);
            const v = extractVerses(chRes).find((x) => Number(x.verse) === Number(sug.verse));
            return { ...sug, text: v?.text || sug.text, version: targetVersionId };
          })
        );
        setLive({ suggestions: updatedSuggestions });
        candidateStabilityRef.current.retainedSuggestions = updatedSuggestions;
      }

      // If active scene on program/audience display is a bible verse, re-project it with the updated version text
      const activeScene = useAppStore.getState().display.currentScene;
      if (activeScene && activeScene.type === 'bible') {
        sendHit(updatedHit, { goLive: true, confidence: 1.0, sourceMode: 'version-switch' });
      }
    } catch (err) {
      console.error('Failed to update verse for version switch:', err);
    }
  }

  async function handleNavigationCommand(command: 'next' | 'prev' | 'first' | 'last') {
    const currentHit = live.bestHit || candidateStabilityRef.current.retainedHit;
    if (!currentHit || !currentHit.book || !currentHit.chapter || !currentHit.verse) return;

    const currentVersion = version || currentHit.version || 'KJV';
    const book = currentHit.book;
    const chapter = Number(currentHit.chapter);
    const verse = Number(currentHit.verse);

    let targetBook = book;
    let targetChapter = chapter;
    let targetVerse = verse;

    try {
      const currentChapterRes = await window.BSP?.bible?.getChapter({
        versionId: currentVersion,
        book,
        chapter,
      }).catch(() => null);

      const verses = extractVerses(currentChapterRes);
      const maxVerse = verses.length || verse;

      if (command === 'first') {
        targetVerse = 1;
      } else if (command === 'last') {
        targetVerse = maxVerse;
      } else if (command === 'next') {
        if (verse < maxVerse) {
          targetVerse = verse + 1;
        } else {
          // Advance to chapter + 1
          const nextChapterRes = await window.BSP?.bible?.getChapter({
            versionId: currentVersion,
            book,
            chapter: chapter + 1,
          }).catch(() => null);
          const nextVerses = extractVerses(nextChapterRes);
          if (nextVerses.length > 0) {
            targetChapter = chapter + 1;
            targetVerse = 1;
          } else {
            // Advance to next canonical book
            const bookIdx = ALL_CANON_BOOKS.findIndex((b) => b.toLowerCase() === book.toLowerCase());
            if (bookIdx !== -1 && bookIdx < ALL_CANON_BOOKS.length - 1) {
              targetBook = ALL_CANON_BOOKS[bookIdx + 1];
              targetChapter = 1;
              targetVerse = 1;
            }
          }
        }
      } else if (command === 'prev') {
        if (verse > 1) {
          targetVerse = verse - 1;
        } else {
          // Go to chapter - 1
          if (chapter > 1) {
            const prevChapterRes = await window.BSP?.bible?.getChapter({
              versionId: currentVersion,
              book,
              chapter: chapter - 1,
            }).catch(() => null);
            const prevVerses = extractVerses(prevChapterRes);
            targetChapter = chapter - 1;
            targetVerse = prevVerses.length || 1;
          } else {
            // Go to previous canonical book
            const bookIdx = ALL_CANON_BOOKS.findIndex((b) => b.toLowerCase() === book.toLowerCase());
            if (bookIdx > 0) {
              targetBook = ALL_CANON_BOOKS[bookIdx - 1];
              const booksList = await window.BSP?.bible?.getBooks(currentVersion).catch(() => []);
              const targetBookMeta = (booksList as any[])?.find(
                (b: any) => b.name?.toLowerCase() === targetBook.toLowerCase()
              );
              targetChapter = targetBookMeta?.chapters || 1;
              const targetChapterRes = await window.BSP?.bible?.getChapter({
                versionId: currentVersion,
                book: targetBook,
                chapter: targetChapter,
              }).catch(() => null);
              const targetVerses = extractVerses(targetChapterRes);
              targetVerse = targetVerses.length || 1;
            }
          }
        }
      }

      // Fetch text for target (targetBook, targetChapter, targetVerse)
      const targetChapterRes = (targetBook === book && targetChapter === chapter)
        ? currentChapterRes
        : await window.BSP?.bible?.getChapter({
            versionId: currentVersion,
            book: targetBook,
            chapter: targetChapter,
          }).catch(() => null);

      const targetVerses = extractVerses(targetChapterRes);
      const matchedVerse = targetVerses.find((v) => Number(v.verse) === Number(targetVerse));
      const verseText = matchedVerse?.text || '';

      const newHit: BibleSearchResult = {
        reference: `${targetBook} ${targetChapter}:${targetVerse}`,
        text: verseText,
        book: targetBook,
        chapter: targetChapter,
        verse: targetVerse,
        version: currentVersion,
      };

      setLive({ bestHit: newHit, suggestions: [newHit] });
      candidateStabilityRef.current = {
        ref: newHit.reference,
        count: 1,
        firstSeen: Date.now(),
        retainedHit: newHit,
        retainedSuggestions: [newHit],
        retainedDetections: [],
        retainedAt: Date.now(),
      };

      // If active scene is bible or direct auto-project is enabled, project immediately
      const activeScene = useAppStore.getState().display.currentScene;
      const prefs = useAppStore.getState().liveScripture;
      if (prefs.autoProject || (activeScene && activeScene.type === 'bible')) {
        sendHit(newHit, { goLive: true, confidence: 1.0, sourceMode: 'spoken-navigation' });
      }
    } catch (err) {
      console.error('Failed to navigate verse:', err);
    }
  }

  function setAutoVersionSwitch(enabled: boolean) {
    setLive({ autoVersionSwitch: enabled });
    if (!enabled || !live.requestedVersion) return;
    const requested = versions.find((entry) => entry.id === live.requestedVersion);
    if (!requested) return;
    handleVersionChange(requested.id);
    reportInfo(`Bible version switched to ${requested.abbreviation}.`);
  }

  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const isSongMode = live.detectionMode === 'song';
  /* The operator's pick wins; otherwise follow the detector's leader so the
     deck tracks the singing without a click. */
  const activeSongMatch = pickedSongId
    ? songMatches.find((m) => m.song.id === pickedSongId) || songMatches[0]
    : songMatches[0];
  const pickedSong = (pickedSongId ? songs.find((x) => x.id === pickedSongId) : null)
    || activeSongMatch?.song
    || null;

  /* Derived from the transcript rather than fired inside the STT callback, so
     flipping to Song mid-service ranks what has already been heard. */
  useEffect(() => {
    if (!isSongMode) {
      if (songMatches.length) setSongMatches([]);
      return;
    }
    setSongMatches(detectSongs(live.transcript || '', songs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSongMode, live.transcript, songs]);

  const statusInfo = STATE_LABELS[sttStatus?.state || 'idle'];
  const deepgramUnavailable = engine === 'deepgram' && !keyConfigured;

  /* Built once and rendered into whichever slot is active — the same element in
     both places, so scrolling and every control behave identically. */
  const toolbar = (
      <div className="blk blk--bar" style={styles.controlBar}>
        <SlidingSwitch
          value={live.detectionMode === 'song' ? 'song' : 'bible'}
          onChange={(val) => setLive({ detectionMode: val as 'bible' | 'song' })}
          options={[
            {
              value: 'bible',
              label: 'Bible',
              title: 'Detect scripture references in speech',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              ),
            },
            {
              value: 'song',
              label: 'Song',
              title: 'Detect song lyrics in speech',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              ),
            },
          ]}
        />

        {/* Play (▶) / Stop (■) Button */}
        {live.isActive ? (
          <button
            onClick={stopLive}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              background: 'var(--tally-fault)',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
            title="Stop Live Scripture"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={startLive}
            disabled={deepgramUnavailable}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              background: 'var(--tally-preview)',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: deepgramUnavailable ? 'not-allowed' : 'pointer',
              opacity: deepgramUnavailable ? 0.5 : 1,
              fontFamily: 'var(--font-ui)',
            }}
            title={deepgramUnavailable ? 'Add a Deepgram API key in Settings first' : 'Start Live Scripture'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Play</span>
          </button>
        )}

        {/* Config Button */}
        <button
          onClick={() => setIsConfigOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            padding: '0 12px',
            background: 'var(--chrome-control)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title="Live Scripture Settings & Audio Inputs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Config</span>
        </button>

        {/* Level and state read as one status cluster */}
        <div style={styles.statusCluster}>
          <div style={styles.meter} aria-label="Mic meter">
            <div style={{ ...styles.meterFill, width: `${Math.round(live.meter.level * 100)}%` }} />
            <div style={{ ...styles.meterPeak, left: `${Math.round(live.meter.peak * 100)}%` }} />
          </div>

          <span style={{ ...type.caption, color: statusInfo.color, fontWeight: fontWeight.semibold, whiteSpace: 'nowrap' }}>
            ● {engine === 'deepgram' ? statusInfo.text : live.isActive ? 'Listening' : 'Idle'}
          </span>

          <MoveBarButton
            position={barPosition}
            onMove={moveBar}
            label="Live Scripture"
            style={styles.moveBarBtn}
          />
        </div>
      </div>
  );

  return (
    <div className="blk-col" style={styles.root}>
      {barPosition === 'top' && toolbar}

      {deepgramUnavailable && (
        <div style={styles.noticeFault}>
          Deepgram needs an API key — add one under <strong>Settings → Transcription</strong>, or switch to Local.
        </div>
      )}
      {live.requestedVersion && !live.autoVersionSwitch && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 6,
            margin: '6px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
        >
          <span>
            <strong>{versions.find((v) => v.id === live.requestedVersion)?.abbreviation || live.requestedVersion}</strong> translation requested.
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleVersionChange(live.requestedVersion!)}
              style={{
                padding: '4px 10px',
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 4,
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Switch Version
            </button>
            <button
              onClick={() => setLive({ requestedVersion: null })}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                color: 'var(--text-dim)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {notice.text && (
        <div style={notice.tone === 'fault' ? styles.noticeFault : styles.notice}>{notice.text}</div>
      )}

      {/* Professional Live Scripture Configuration Modal */}
      {isConfigOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsConfigOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 580,
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'scaleIn 0.15s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Live Scripture Config
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 16,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-dim)';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body with Parallel Horizontal Section Lines */}
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
              {/* Row 1: Audio Input Microphone */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Audio Input Microphone</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Hardware device used for speech transcription
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <CustomDropdown
                    value={live.selectedInputId}
                    onChange={(val) => {
                      setLive({ selectedInputId: val });
                      if (live.isActive) {
                        stopLive();
                        setTimeout(() => startLive(), 100);
                      }
                    }}
                    options={
                      devices.length === 0
                        ? [{ value: '', label: 'No microphone available' }]
                        : devices.map((d) => ({ value: d.deviceId, label: d.label }))
                    }
                    buttonStyle={{ width: 220, justifyContent: 'space-between' }}
                    title="Select Microphone"
                  />
                  <button
                    onClick={refreshInputs}
                    style={{
                      padding: '0 12px',
                      height: 34,
                      background: 'var(--chrome-control)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    title="Refresh audio inputs"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Row 2: AI Speech Model Engine */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Speech Model Engine</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Engine used for live speech recognition
                  </div>
                </div>
                <CustomDropdown
                  value={engine}
                  onChange={(val) => {
                    const next = val as 'local' | 'deepgram';
                    setEngine(next);
                    setLive({ provider: next });
                    window.BSP?.settings?.set({ sttEngine: next }).catch(() => {});
                    if (live.isActive) {
                      stopLive();
                      setTimeout(() => startLive(), 100);
                    }
                  }}
                  options={[
                    { value: 'deepgram', label: 'Deepgram (Cloud Nova-2)', sublabel: 'Sub-250ms streaming (recommended)' },
                    { value: 'local', label: 'Local On-Device (ONNX)', sublabel: 'Runs 100% offline on this computer' },
                  ]}
                  buttonStyle={{ width: 240, justifyContent: 'space-between' }}
                  title="Select AI Speech Model"
                />
              </div>

              {/* Row 3: Bible Version */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Bible Version</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Default Bible version for verse detection
                  </div>
                </div>
                <CustomDropdown
                  value={version}
                  onChange={(val) => {
                    handleVersionChange(val);
                  }}
                  options={(versions.length ? versions : [{ id: 'KJV', abbreviation: 'KJV', name: 'King James Version' }]).map((v) => ({
                    value: v.id,
                    label: `${v.abbreviation} - ${v.name}`,
                  }))}
                  buttonStyle={{ width: 220, justifyContent: 'space-between' }}
                  title="Select Bible Version"
                />
              </div>

              {/* Row 4: Auto project direct references */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto project direct references</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Automatically project scripture references when detected
                  </div>
                </div>
                <AppleToggle
                  checked={live.autoProject}
                  onChange={(val) => setDirectAutoProject(val)}
                />
              </div>

              {/* Row 5: Project quoted matches */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Project quoted matches</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Project verbatim spoken matches in continuous speech
                  </div>
                </div>
                <AppleToggle
                  checked={live.autoProjectQuoted}
                  onChange={(val) => setQuotedAutoProject(val)}
                />
              </div>

              {/* Row 6: Auto-version switch */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-primary)', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-version switch</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Automatically switch Bible version when spoken in speech
                  </div>
                </div>
                <AppleToggle
                  checked={live.autoVersionSwitch}
                  onChange={(val) => setAutoVersionSwitch(val)}
                />
              </div>

              {/* Row 7: Paraphrase & Semantic Matching */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Paraphrase & Semantic Matching</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
                    Detect topical and semantic paraphrases when scriptures are not quoted verbatim
                  </div>
                </div>
                <AppleToggle
                  checked={live.allowParaphrase !== false}
                  onChange={(val) => {
                    setLive({ allowParaphrase: val });
                    reportInfo(val ? 'Paraphrase detection enabled.' : 'Paraphrase detection disabled (verbatim & citations only).');
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', background: 'var(--bg-primary)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsConfigOpen(false)}
                style={{
                  padding: '7px 20px',
                  background: '#FF5500',
                  border: 'none',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 8px rgba(255, 85, 0, 0.3)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF7728'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF5500'; }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isSongMode ? (
        <div className="blk-row" style={styles.matchDashboard}>
          {/* Left, where Bible shows Best Match: the ranked song candidates. */}
          <Block
            style={{ ...styles.primaryColumn, flex: `0 0 ${primaryWidth}px` }}
            title="Candidate Index"
            tools={<span style={styles.countBadge}>{songMatches.length} matches</span>}
          >
            {songMatches.length === 0 ? (
              <div style={styles.emptyHint}>
                {songs.length === 0
                  ? 'No songs in the library yet. Import songs to match against.'
                  : live.isActive
                    ? 'Listening for lyrics…'
                    : 'Start listening to match what is being sung.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {songMatches.map((match) => {
                  const isPicked = pickedSong?.id === match.song.id;
                  return (
                    <button
                      key={match.song.id}
                      onClick={() => setPickedSongId(match.song.id)}
                      style={{
                        ...styles.songCandidate,
                        borderColor: isPicked ? 'var(--chrome-control-active)' : 'var(--border-primary)',
                        background: isPicked ? 'var(--chrome-control-active)' : 'var(--bg-surface)',
                      }}
                      title={`Show the lyrics for ${match.song.title}`}
                    >
                      <div style={styles.songCandidateHead}>
                        <span style={styles.songCandidateTitle}>{match.song.title}</span>
                        <span style={styles.songConfidence}>
                          <span style={styles.songConfidenceDot} />
                          {Math.round(match.confidence * 100)}%
                        </span>
                      </div>
                      <div style={styles.songCandidateMeta}>
                        {match.song.artist || 'Unknown Artist'}
                        {match.slideLabel ? ` · ${match.slideLabel}` : ''}
                      </div>
                      {match.excerpt && (
                        <div style={styles.songCandidateExcerpt}>“{match.excerpt}”</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Block>

          <PanelSplitter
            width={primaryWidth}
            onChange={setPrimaryWidthPersisted}
            min={220}
            max={620}
            title="Drag to resize the song panels"
          />

          {/* Right: the same deck the Songs panel uses, tools and all. */}
          <SongDeck
            song={pickedSong}
            title="Lyrics"
            targetText={activeSongMatch?.excerpt}
            emptyLabel="Pick a song from the candidate index to project its lyrics."
          />
        </div>
      ) : (
        <div className="blk-row" style={styles.matchDashboard}>
          <Block
            style={{ ...styles.primaryColumn, flex: `0 0 ${primaryWidth}px` }}
            title="Best Match"
            tools={(
              <span style={detectionIsFinal ? styles.finalBadge : styles.trackingBadge}>
                {detectionIsFinal ? 'Final' : 'Tracking'}
              </span>
            )}
            bodyStyle={{ display: 'flex', flexDirection: 'column' }}
          >
            {live.bestHit ? (
              <button style={styles.hit} onClick={() => sendHit(live.bestHit!, { goLive: true, confidence: rankedDetections[0]?.confidence, sourceMode: rankedDetections[0]?.mode })}>
                <div style={styles.primaryReferenceRow}>
                  <strong style={styles.primaryReference}>{live.bestHit.reference}</strong>
                  <span style={styles.versionBadge}>{live.bestHit.version || version}</span>
                </div>
                <span style={styles.primaryText}>{live.bestHit.text}</span>
              </button>
            ) : <div style={styles.placeholder}>Top detected verse will appear here.</div>}
            {rankedDetections[0] && (
              <div style={styles.primaryMetrics}>
                <Metric label="Confidence" value={`${confidencePercent(rankedDetections[0].confidence)}%`} />
                <Metric label="Match tier" value={formatMatchMode(rankedDetections[0].mode)} />
                <Metric label="Words matched" value={rankedDetections[0].wordOverlap != null ? `${Math.round(rankedDetections[0].wordOverlap * 100)}%` : 'Direct'} />
                <Metric label="Search time" value={`${detectionLatencyMs} ms`} />
              </div>
            )}
            {activeWordStudy && (
              <WordStudyCard entry={activeWordStudy} onClose={() => setActiveWordStudy(null)} />
            )}
          </Block>

          <PanelSplitter
            width={primaryWidth}
            onChange={setPrimaryWidthPersisted}
            min={220}
            max={620}
            title="Drag to resize the match panels"
          />

          <Block
            title="Candidate Index"
            style={styles.indexColumn}
            tools={<span style={styles.countBadge}>{Math.max(0, live.suggestions.length - 1)} matches</span>}
            bodyStyle={{ display: 'flex', flexDirection: 'column' }}
          >
            {live.suggestions.length > 1 ? (
              <div style={styles.suggestions}>
                {live.suggestions.slice(1).map((hit, index) => {
                  const detection = rankedDetections[index + 1];
                  const confidence = detection?.confidence;
                  return (
                    <button key={`${hit.reference}-${index}`} style={styles.suggestionCard} onClick={() => sendHit(hit, { goLive: true, confidence: detection?.confidence, sourceMode: detection?.mode })}>
                      <div style={styles.candidateTopRow}>
                        <span style={styles.rankBadge}>#{index + 2}</span>
                        <strong style={styles.suggestionReference}>{hit.reference}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                          {confidence != null && <span style={styles.candidateConfidence}>{confidencePercent(confidence)}%</span>}
                          <span style={styles.abbrevBadge}>{formatMatchModeAbbrev(detection?.mode || 'search')}</span>
                          <span style={styles.candidateVersionBadge}>{hit.version || version}</span>
                        </div>
                      </div>
                      <span style={styles.suggestionText}>
                        {hit.text || detection?.text || 'Verse content is unavailable for this Bible version.'}
                      </span>
                      {confidence != null && (
                        <span style={styles.confidenceTrack}>
                          <span style={{ ...styles.confidenceFill, width: `${Math.max(4, Math.min(100, confidence * 100))}%` }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={styles.placeholder}>Close matches will be indexed here as words arrive.</div>
            )}
          </Block>
        </div>
      )}

      {barPosition === 'bottom' && toolbar}
    </div>
  );
}

function formatMatchMode(mode: string) {
  const labels: Record<string, string> = {
    direct: 'Direct reference',
    'direct-reference': 'Direct reference',
    'spoken-reference': 'Spoken reference',
    'phonetic-reference': 'Phonetic reference',
    'context-verse-reference': 'Chapter context',
    contextual: 'Context match',
    verbatim: 'Verbatim quote',
    'quoted-verse-exact': 'Exact quotation',
    'quoted-verse-interim': 'Prefix quotation',
    'quoted-verse-bm25': 'Word index',
    semantic: 'Semantic match',
    search: 'Text search',
  };
  return labels[mode] || mode.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMatchModeAbbrev(mode: string) {
  const abbrevs: Record<string, string> = {
    direct: 'REF',
    'direct-reference': 'REF',
    'spoken-reference': 'REF',
    'phonetic-reference': 'REF',
    'context-verse-reference': 'CTX',
    contextual: 'CTX',
    verbatim: 'VQ',
    'quoted-verse-exact': 'VQ',
    'quoted-verse-interim': 'VQ',
    'quoted-verse-bm25': 'KM',
    semantic: 'SM',
    search: 'KM',
  };
  return abbrevs[mode] || 'MATCH';
}

function classifyProjectionMode(mode: string): 'direct' | 'quoted' | 'semantic' | 'none' {
  const normalized = String(mode || '').toLowerCase();
  if (
    normalized === 'direct' ||
    normalized === 'direct-reference' ||
    normalized === 'spoken-reference' ||
    normalized === 'phonetic-reference' ||
    normalized === 'context-verse-reference'
  ) return 'direct';
  if (normalized.includes('quoted') || normalized === 'verbatim') return 'quoted';
  if (normalized === 'semantic' || normalized.includes('paraphrase')) return 'semantic';
  return 'none';
}

const ALL_CANON_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

function detectNavigationCommand(transcript: string): 'next' | 'prev' | 'first' | 'last' | null {
  const normalized = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  // First verse command
  if (
    /\b(first verse|read the first verse|go to first verse|from the beginning|start from verse one|verse one of this chapter)\b/.test(normalized) ||
    normalized === 'first verse' ||
    normalized === 'verse one'
  ) {
    return 'first';
  }

  // Last verse command
  if (
    /\b(last verse|read the last verse|go to the last verse|to the end of the chapter|final verse|read to the end)\b/.test(normalized) ||
    normalized === 'last verse'
  ) {
    return 'last';
  }

  // Next verse command
  if (
    /\b(next verse|go to next verse|move to next verse|read next verse|the next verse|next one)\b/.test(normalized) ||
    normalized === 'next verse' ||
    normalized === 'next'
  ) {
    return 'next';
  }

  // Previous verse command
  if (
    /\b(previous verse|prev verse|go back a verse|prior verse|the previous verse|back to previous verse)\b/.test(normalized) ||
    normalized === 'previous verse' ||
    normalized === 'prev verse'
  ) {
    return 'prev';
  }

  return null;
}

function detectVersionRequest(
  transcript: string,
  availableVersions: Array<{ id: string; abbreviation: string; name: string }>,
) {
  const normalized = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const hasIntent = /\b(switch|change|set|use|show|give|give me|give us|let s have|lets have|can i have|can we have|read from|read in|read|turn to|open in|open to|put up|display|bring up)\b/.test(normalized);
  const hasContext = /\b(version|translation|bible|trans)\b/.test(normalized);
  if (!hasIntent && !hasContext) return null;

  const builtInAliases: Record<string, string[]> = {
    KJV: ['kjv', 'king james', 'king james version', 'king james bible'],
    NKJV: ['nkjv', 'new king james', 'new king james version'],
    NASB: ['nasb', 'new american standard', 'new american standard bible'],
    NLT: ['nlt', 'new living translation', 'new living'],
    NIV: ['niv', 'new international version', 'new international'],
    ESV: ['esv', 'english standard version', 'english standard'],
    ASV: ['asv', 'american standard version', 'american standard'],
    Darby: ['dby', 'darby', 'darby translation'],
    YLT: ['ylt', 'youngs literal', 'young s literal translation'],
    LSG: ['lsg', 'louis segond', 'segond'],
    OST: ['ost', 'ostervald'],
    RV1909: ['rvr', 'reina valera', 'rv1909', 'valera'],
  };
  const candidates = availableVersions.flatMap((entry) => {
    const aliases = new Set([
      entry.id.toLowerCase(),
      entry.abbreviation.toLowerCase(),
      entry.name.toLowerCase().replace(/\([^)]*\)/g, '').trim(),
      ...(builtInAliases[entry.id] || []),
    ]);
    return [...aliases].map((alias) => ({ entry, alias }));
  }).sort((a, b) => b.alias.length - a.alias.length);

  const match = candidates.find(({ alias }) => new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(normalized));
  return match ? { versionId: match.entry.id, label: match.entry.abbreviation } : null;
}

function confidencePercent(confidence: number) {
  return Math.max(0, Math.min(100, Math.round(Number(confidence || 0) * 100)));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { height: '100%', minHeight: 0, overflow: 'hidden' },
  controlBar: { flexWrap: 'nowrap', minWidth: '100%' },
  moveBarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: 'transparent', border: 'none', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0, padding: 0 },
  statusCluster: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 },
  meter: { position: 'relative', flexShrink: 0, width: 96, height: 6, background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', borderRadius: 999, overflow: 'hidden' },
  meterFill: { height: '100%', background: 'linear-gradient(90deg,var(--tally-preview),var(--tally-preview),var(--tally-fault))', borderRadius: 999, transition: 'width 90ms linear' },
  meterPeak: { position: 'absolute', top: 0, width: 2, height: '100%', background: 'var(--text-primary)', transition: 'left 140ms ease-out' },
  check: { display: 'flex', alignItems: 'center', gap: 6, ...type.caption, color: 'var(--text-secondary)' },
  emptyHint: { ...type.secondary, color: 'var(--text-dim)', textAlign: 'center', padding: 20 },
  songCandidate: {
    display: 'flex', flexDirection: 'column', gap: 3, width: '100%',
    padding: '9px 11px', borderRadius: 6, border: '1px solid var(--border-primary)',
    background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'var(--font-ui)', transition: 'all 0.15s ease',
  },
  songCandidateHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  songCandidateTitle: { ...type.secondary, fontWeight: fontWeight.semibold, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songCandidateMeta: { ...type.caption, color: 'var(--text-dim)' },
  songCandidateExcerpt: { ...type.caption, color: 'var(--text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songConfidence: { display: 'inline-flex', alignItems: 'center', gap: 5, ...numeric, ...type.caption, color: 'var(--tally-preview)', fontWeight: fontWeight.semibold, flexShrink: 0 },
  songConfidenceDot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--tally-preview)' },
  matchDashboard: { flex: '1 1 auto', minHeight: 0, overflow: 'hidden' },
  primaryColumn: { minWidth: 220 },
  indexColumn: { flex: '1 1 0%', minWidth: 220 },
  finalBadge: { padding: '3px 7px', borderRadius: 4, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(46,204,113,.25)', ...type.label, fontWeight: fontWeight.bold },
  trackingBadge: { padding: '3px 7px', borderRadius: 4, background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(52,152,219,.25)', ...type.label, fontWeight: fontWeight.bold },
  countBadge: { padding: '3px 7px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', ...type.caption, ...numeric, whiteSpace: 'nowrap' },
  hit: { width: '100%', border: '1px solid var(--border-accent)', background: 'var(--accent-dim)', color: 'var(--text-primary)', borderRadius: 6, padding: 14, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 9, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  primaryReferenceRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  primaryReference: { color: 'var(--accent-light)', ...type.title },
  versionBadge: { ...type.caption, color: 'var(--text-secondary)', background: 'rgba(0,0,0,.18)', borderRadius: 4, padding: '2px 5px' },
  primaryText: { ...type.body },
  primaryMetrics: { marginTop: 'auto', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  metric: { background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 2 },
  metricLabel: { color: 'var(--text-dim)', ...type.label, fontWeight: fontWeight.regular },
  metricValue: { color: 'var(--text-primary)', ...type.caption, ...numeric, fontWeight: fontWeight.semibold },
  placeholder: { color: 'var(--text-dim)', ...type.secondary, padding: 18, textAlign: 'center' },
  suggestions: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable', paddingRight: 4, alignContent: 'start', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  suggestionCard: { minWidth: 0, border: '1px solid var(--border-primary)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderRadius: 6, padding: '10px 11px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 7, cursor: 'pointer', fontFamily: 'var(--font-ui)', overflow: 'hidden' },
  candidateTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' },
  rankBadge: { ...type.caption, ...numeric, color: 'var(--text-dim)' },
  suggestionReference: { ...type.secondary, fontWeight: fontWeight.semibold, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  suggestionText: { ...type.secondary, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4, fontSize: 12, marginTop: 2 },
  candidateConfidence: { color: 'var(--green)', ...type.caption, ...numeric, fontWeight: fontWeight.bold },
  abbrevBadge: { fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em' },
  candidateVersionBadge: { fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em' },
  confidenceTrack: { display: 'block', height: 3, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' },
  confidenceFill: { display: 'block', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,var(--blue),var(--green))' },
  notice: { flex: '0 0 auto', ...type.caption, color: 'var(--text-dim)', background: 'var(--bsp-raised)', border: '1px solid var(--border-primary)', borderRadius: 'var(--block-radius)', padding: '8px 10px' },
  noticeFault: { flex: '0 0 auto', ...type.caption, color: 'var(--tally-fault)', background: 'rgba(239, 68, 68, 0.10)', border: '1px solid rgba(239, 68, 68, 0.28)', borderRadius: 'var(--block-radius)', padding: '8px 10px' },
};
