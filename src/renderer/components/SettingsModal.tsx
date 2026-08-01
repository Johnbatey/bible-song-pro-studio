import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSettings, AppSettingsPatch, ObsStatus, DisplayTarget } from '../types';
import { ensureTheme } from '../utils/defaultTheme';
import { type, fontWeight, mono } from '../styles/type';

export type SettingsCategory =
  | 'output'
  | 'fullscreen'
  | 'lowerthird'
  | 'video'
  | 'streaming'
  | 'bible'
  | 'audio'
  | 'ai'
  | 'hotkeys'
  | 'about';

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

const categories: CategoryItem[] = [
  {
    id: 'output',
    label: 'Output & Displays',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'fullscreen',
    label: 'Full Screen Mode',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    ),
  },
  {
    id: 'lowerthird',
    label: 'Lower Third Mode',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    ),
  },
  {
    id: 'bible',
    label: 'Bible & Scripture',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'ai',
    label: 'AI & Speech (STT)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M9 2v2" />
        <path d="M15 2v2" />
        <path d="M9 20v2" />
        <path d="M15 20v2" />
        <path d="M2 9h2" />
        <path d="M2 15h2" />
        <path d="M20 9h2" />
        <path d="M20 15h2" />
        <path d="M9 9h6v6H9z" />
      </svg>
    ),
  },
  {
    id: 'hotkeys',
    label: 'Keyboard Shortcuts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01" />
        <path d="M10 8h.01" />
        <path d="M14 8h.01" />
        <path d="M18 8h.01" />
        <path d="M8 12h8" />
        <path d="M6 16h12" />
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About & System',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
];

export function SettingsModal() {
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const activeCategoryValue = useAppStore((s) => s.activeSettingsCategory) as SettingsCategory;
  const openSettings = useAppStore((s) => s.openSettings);
  const closeSettings = useAppStore((s) => s.closeSettings);

  const display = useAppStore((s) => s.display);
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const setOutputStatus = useAppStore((s) => s.setOutputStatus);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const themes = useAppStore((s) => s.themes);
  const live = useAppStore((s) => s.liveScripture);
  const setLive = useAppStore((s) => s.setLiveScripture);

  const [aiStatus, setAiStatus] = useState<any>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deepgramKeyDraft, setDeepgramKeyDraft] = useState('');
  const [obsPasswordDraft, setObsPasswordDraft] = useState('');
  const [streamKeyDraft, setStreamKeyDraft] = useState('');
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const [displays, setDisplays] = useState<DisplayTarget[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<string>('auto');
  const [selectedStageDisplayId, setSelectedStageDisplayId] = useState<string>('auto');
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null);
  const [displayNotice, setDisplayNotice] = useState('');
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Stage Display Timer state
  const [stageTimerSeconds, setStageTimerSeconds] = useState(0);
  const [stageTimerRunning, setStageTimerRunning] = useState(false);
  const [stageDisplayMode, setStageDisplayMode] = useState<'confidence' | 'program' | 'hybrid'>('confidence');
  const [stageShowTimer, setStageShowTimer] = useState(true);
  const [stageShowClock, setStageShowClock] = useState(true);

  // Video & Canvas settings
  const [baseCanvasRes, setBaseCanvasRes] = useState('1920x1080');
  const [outputScaledRes, setOutputScaledRes] = useState('1920x1080');
  const [autoRecordStream, setAutoRecordStream] = useState(false);
  const [recordFormat, setRecordFormat] = useState<'mkv' | 'mp4'>('mkv');
  const [replayBufferSec, setReplayBufferSec] = useState(30);
  const [crossfadeMs, setCrossfadeMs] = useState(300);
  const [transitionType, setTransitionType] = useState('fade');
  const [transitionMs, setTransitionMs] = useState(300);

  // Stream & RTMP settings
  const [streamPlatform, setStreamPlatform] = useState('youtube');
  const [streamServerUrl, setStreamServerUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [videoBitrate, setVideoBitrate] = useState('6000');

  // Audio settings
  const [audioMonitorMode, setAudioMonitorMode] = useState('monitor-off');
  const [audioBufferSamples, setAudioBufferSamples] = useState('256');

  // Bible options
  const [showVerseNumbers, setShowVerseNumbers] = useState(true);
  const [redLetterWords, setRedLetterWords] = useState(true);
  const visibleCategoryIds = new Set(categories.map((category) => category.id));
  const activeCategory = visibleCategoryIds.has(activeCategoryValue) ? activeCategoryValue : 'output';

  async function refreshDisplays() {
    const list = await window.BSP?.display?.getDisplays().catch(() => []);
    if (list) setDisplays(list);
    const active = await window.BSP?.display?.getActive().catch(() => null);
    if (active?.ok) setActiveDisplayId(active.displayId);
  }

  async function openDisplay(target: string) {
    const result = await window.BSP?.display?.open({ displayId: target }).catch(() => null);
    if (result?.ok) {
      setActiveDisplayId(result.displayId || null);
      setDisplayNotice(`Output window opened on ${result.label || 'display'}.`);
    } else {
      setDisplayNotice(result?.error || 'Could not open the output display window.');
    }
    refreshStatus();
    refreshDisplays();
  }

  useEffect(() => {
    if (!isSettingsOpen) return;
    if (!visibleCategoryIds.has(activeCategoryValue)) openSettings('output');
    refreshDisplays();
    window.BSP?.settings?.get().then((res) => { if (res?.ok) setSettings(res.settings); }).catch(() => {});
    window.BSP?.obs?.status().then(setObsStatus).catch(() => {});
    refreshStatus();
  }, [isSettingsOpen, activeCategoryValue]);

  useEffect(() => {
    if (!isSettingsOpen || windowPosition) return;
    const width = Math.min(960, Math.floor(window.innerWidth * 0.94));
    const height = Math.min(780, Math.floor(window.innerHeight * 0.75));
    setWindowPosition({
      x: Math.max(12, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(12, Math.round((window.innerHeight - height) / 2)),
    });
  }, [isSettingsOpen, windowPosition]);

  useEffect(() => {
    let interval: any = null;
    if (stageTimerRunning) {
      interval = setInterval(() => {
        setStageTimerSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [stageTimerRunning]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        closeSettings();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSettingsOpen, closeSettings]);

  async function saveSettings(patch: Partial<AppSettingsPatch>) {
    const res = await window.BSP?.settings?.set(patch).catch(() => null);
    if (res?.ok) setSettings(res.settings);
  }

  async function refreshStatus() {
    const status = await window.BSP?.display?.getStatus().catch(() => null);
    if (status) setOutputStatus(status);
    const s = await window.BSP?.ai?.status().catch(() => null);
    setAiStatus(s);
  }

  function patchTheme(section: 'fullScreen' | 'lowerThird' | 'bibleOptions', patch: any) {
    const base = ensureTheme(activeTheme);
    const next = {
      ...base,
      [section]: { ...base[section], ...patch },
    };
    setActiveTheme(next);
    if (themes.some((theme) => theme.id === next.id)) updateTheme(next.id, next);
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !windowPosition) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    dragOffsetRef.current = {
      x: e.clientX - windowPosition.x,
      y: e.clientY - windowPosition.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = modalRef.current?.getBoundingClientRect();
    const width = rect?.width || 960;
    const height = rect?.height || 640;
    const nextX = e.clientX - dragOffsetRef.current.x;
    const nextY = e.clientY - dragOffsetRef.current.y;
    setWindowPosition({
      x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, nextY), Math.max(8, window.innerHeight - height - 8)),
    });
  }

  function stopDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  if (!isSettingsOpen) return null;

  return (
    <div className="settings-modal-overlay">
      <div
        ref={modalRef}
        className="settings-modal-window"
        style={windowPosition ? { left: windowPosition.x, top: windowPosition.y } : undefined}
      >
        {/* Header */}
        <div
          className="sm-header"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <div className="sm-header-brand">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>General Settings</span>
          </div>
          <div className="sm-header-controls">
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 3, borderRadius: 6 }}>
              <button
                className={`btn btn-sm ${display.outputMode === 'fullscreen' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setOutputMode('fullscreen')}
              >
                FS Mode
              </button>
              <button
                className={`btn btn-sm ${display.outputMode === 'lowerThird' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setOutputMode('lowerThird')}
              >
                LT Mode
              </button>
            </div>
            <button className="sm-close-btn" onClick={closeSettings} title="Close Settings (Esc)">
              ✕
            </button>
          </div>
        </div>

        {/* Two-Pane Body */}
        <div className="sm-body">
          {/* Left Sidebar */}
          <div className="sm-sidebar">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`sm-sidebar-item ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => openSettings(cat.id)}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </div>
            ))}
          </div>

          {/* Right Content Area */}
          <div className="sm-content">
            {/* Category 1: Output & Displays */}
            {activeCategory === 'output' && (
              <div>
                <div className="sm-content-title">Standalone Output Screen</div>
                <div className="sm-content-sub">Choose where to launch the live audience projector window.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Output Screen</div>
                      <div className="sm-form-desc">Select an external projector or secondary monitor</div>
                    </div>
                    <select
                      className="input"
                      style={{ width: 220 }}
                      value={selectedDisplayId}
                      onChange={(e) => setSelectedDisplayId(e.target.value)}
                    >
                      <option value="auto">Auto (External preferred)</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label} {d.resolution ? `(${d.resolution})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 24 }}>
                  <button className="btn btn-primary" onClick={() => openDisplay(selectedDisplayId)}>
                    Open External Display
                  </button>
                  <button className="btn btn-secondary" onClick={() => window.BSP?.display?.close()}>
                    Close Output
                  </button>
                  <button className="btn btn-ghost" onClick={refreshDisplays}>
                    Refresh Displays
                  </button>
                </div>

                {displayNotice && (
                  <div style={{ marginBottom: 20, padding: '8px 12px', background: 'rgba(201, 169, 110, 0.1)', border: '1px solid var(--accent)', borderRadius: 6, ...type.secondary }}>
                    {displayNotice}
                  </div>
                )}

                {/* Stage Display Block */}
                <div className="sm-content-title" style={{ marginTop: 24 }}>Stage Confidence Display</div>
                <div className="sm-content-sub">On-stage confidence monitor for presenters and vocalists — shows current/next slide, notes, timer, and clock.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Stage Monitor</div>
                      <div className="sm-form-desc">Select display screen for stage confidence monitor</div>
                    </div>
                    <select
                      className="input"
                      style={{ width: 220 }}
                      value={selectedStageDisplayId}
                      onChange={(e) => setSelectedStageDisplayId(e.target.value)}
                    >
                      <option value="auto">Auto (Secondary Display)</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Display Mode</div>
                      <div className="sm-form-desc">Layout mode for stage confidence screen</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['confidence', 'program', 'hybrid'] as const).map((m) => (
                        <button
                          key={m}
                          className={`btn btn-sm ${stageDisplayMode === m ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setStageDisplayMode(m)}
                        >
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Display Overlay Options</div>
                      <div className="sm-form-desc">Toggle timer and clock overlays on stage monitor</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...type.secondary, cursor: 'pointer' }}>
                        <input type="checkbox" checked={stageShowTimer} onChange={(e) => setStageShowTimer(e.target.checked)} />
                        Timer Visible
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...type.secondary, cursor: 'pointer' }}>
                        <input type="checkbox" checked={stageShowClock} onChange={(e) => setStageShowClock(e.target.checked)} />
                        Clock Visible
                      </label>
                    </div>
                  </div>

                  {/* Stage Timer Controls */}
                  <div className="sm-form-row" style={{ background: 'var(--bg-elevated)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ ...type.display, ...mono, color: 'var(--accent)' }}>
                        {formatTimer(stageTimerSeconds)}
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={() => setStageTimerRunning(!stageTimerRunning)}>
                        {stageTimerRunning ? 'Pause' : 'Start'}
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setStageTimerRunning(false); setStageTimerSeconds(0); }}>
                        Reset
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ ...type.caption, color: 'var(--text-dim)' }}>Set Start:</span>
                      {[5, 10, 15, 20].map((mins) => (
                        <button
                          key={mins}
                          className="btn btn-sm btn-ghost"
                          onClick={() => { setStageTimerSeconds(mins * 60); setStageTimerRunning(true); }}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => window.BSP?.openStageDisplay()}>
                    Open Stage Display
                  </button>
                </div>

                {/* NDI Status Metrics */}
                <div className="sm-content-title" style={{ marginTop: 28 }}>NDI® Network Video Output</div>
                <div className="sm-content-sub">Program output is published as an NDI® source for OBS, vMix, and network receivers.</div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', ...type.secondary, fontWeight: fontWeight.semibold }}>
                      <span className="badge badge-active">NDI LIVE</span>
                      <span>Bible Song Pro Max Output</span>
                    </div>
                    <span style={{ ...type.caption, color: 'var(--text-dim)' }}>1920×1080 @ 60fps</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigator.clipboard.writeText('OBS NDI Source: Bible Song Pro Max')}
                    >
                      Copy OBS Setup
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigator.clipboard.writeText('vMix NDI Input: Bible Song Pro Max')}
                    >
                      Copy vMix Setup
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category 2: Full Screen Mode */}
            {activeCategory === 'fullscreen' && (
              <div>
                <div className="sm-content-title">Full Screen Mode (FS)</div>
                <div className="sm-content-sub">Configure main text scaling, font sizes, alignments, and auto-fit behaviors for Full Screen mode.</div>

                <div className="sm-form-group">
                  {/* Font Size Steppers */}
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Reference Font Size</div>
                      <div className="sm-form-desc">Font size for Bible book/chapter and song title text</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => patchTheme('fullScreen', { referenceFontSize: Math.max(10, (activeTheme?.fullScreen.referenceFontSize || 30) - 2) })}>-</button>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 70, textAlign: 'center' }}
                        value={activeTheme?.fullScreen.referenceFontSize || 30}
                        onChange={(e) => patchTheme('fullScreen', { referenceFontSize: parseInt(e.target.value, 10) || 30 })}
                      />
                      <button className="btn btn-sm btn-secondary" onClick={() => patchTheme('fullScreen', { referenceFontSize: Math.min(200, (activeTheme?.fullScreen.referenceFontSize || 30) + 2) })}>+</button>
                      <span style={{ ...type.caption, color: 'var(--text-dim)' }}>pt</span>
                    </div>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Verse / Song Main Font Size</div>
                      <div className="sm-form-desc">Main text font size for scriptures and lyrics</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => patchTheme('fullScreen', { fontSize: Math.max(10, (activeTheme?.fullScreen.fontSize || 50) - 2) })}>-</button>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 70, textAlign: 'center' }}
                        value={activeTheme?.fullScreen.fontSize || 50}
                        onChange={(e) => patchTheme('fullScreen', { fontSize: parseInt(e.target.value, 10) || 50 })}
                      />
                      <button className="btn btn-sm btn-secondary" onClick={() => patchTheme('fullScreen', { fontSize: Math.min(200, (activeTheme?.fullScreen.fontSize || 50) + 2) })}>+</button>
                      <span style={{ ...type.caption, color: 'var(--text-dim)' }}>pt</span>
                    </div>
                  </div>

                  {/* Auto-Resize & Text Transform */}
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Auto-Resize Mode</div>
                      <div className="sm-form-desc">Shrink text dynamically when lines exceed display bounds</div>
                    </div>
                    <select
                      className="input"
                      style={{ width: 180 }}
                      value={activeTheme?.fullScreen.autoResize || 'shrink'}
                      onChange={(e) => patchTheme('fullScreen', { autoResize: e.target.value })}
                    >
                      <option value="none">None</option>
                      <option value="shrink">Shrink to Fit</option>
                      <option value="grow">Grow to Fit</option>
                    </select>
                  </div>

                  {/* Alignments */}
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Verse Text Alignment</div>
                      <div className="sm-form-desc">Horizontal positioning of scripture text</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['left', 'center'] as const).map((align) => (
                        <button
                          key={align}
                          className={`btn btn-sm ${(activeTheme?.fullScreen.textAlign || 'center') === align ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => patchTheme('fullScreen', { textAlign: align })}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Font Color</div>
                      <div className="sm-form-desc">Main scripture and lyric color in Full Screen mode</div>
                    </div>
                    <input
                      type="color"
                      value={activeTheme?.fullScreen.fontColor || '#ffffff'}
                      onChange={(e) => patchTheme('fullScreen', { fontColor: e.target.value })}
                      style={{ width: 44, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Background Color</div>
                      <div className="sm-form-desc">Fallback full-screen background when the scene has no custom media</div>
                    </div>
                    <input
                      type="color"
                      value={activeTheme?.fullScreen.backgroundColor || '#0f172a'}
                      onChange={(e) => patchTheme('fullScreen', { backgroundColor: e.target.value })}
                      style={{ width: 44, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Line Height</div>
                      <div className="sm-form-desc">Spacing between multi-line scripture and lyric text</div>
                    </div>
                    <input
                      type="number"
                      min="0.8"
                      max="2"
                      step="0.05"
                      className="input"
                      style={{ width: 90, textAlign: 'center' }}
                      value={activeTheme?.fullScreen.lineHeight || 1.25}
                      onChange={(e) => patchTheme('fullScreen', { lineHeight: parseFloat(e.target.value) || 1.25 })}
                    />
                  </div>

                  {/* Vertical Align */}
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Vertical Alignment</div>
                      <div className="sm-form-desc">Place full-screen content toward the top, middle, or bottom</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['top', 'middle', 'bottom'] as const).map((align) => (
                        <button
                          key={align}
                          className={`btn btn-sm ${(activeTheme?.fullScreen.verticalAlign || 'middle') === align ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => patchTheme('fullScreen', { verticalAlign: align })}
                        >
                          {align.charAt(0).toUpperCase() + align.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 3: Lower Third Mode */}
            {activeCategory === 'lowerthird' && (
              <div>
                <div className="sm-content-title">Lower Third Mode (LT)</div>
                <div className="sm-content-sub">Configure lower-third banner height, fonts, accent colors, and background overlays.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Accent Color</div>
                      <div className="sm-form-desc">Color for lower-third accent bar and references</div>
                    </div>
                    <input
                      type="color"
                      value={activeTheme?.lowerThird.accentColor || '#e8541a'}
                      onChange={(e) => patchTheme('lowerThird', { accentColor: e.target.value })}
                      style={{ width: 44, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Lower Third Main Font Size</div>
                      <div className="sm-form-desc">Font size for lower-third scripture text</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => patchTheme('lowerThird', { fontSize: Math.max(10, (activeTheme?.lowerThird.fontSize || 32) - 2) })}>-</button>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 70, textAlign: 'center' }}
                        value={activeTheme?.lowerThird.fontSize || 32}
                        onChange={(e) => patchTheme('lowerThird', { fontSize: parseInt(e.target.value, 10) || 32 })}
                      />
                      <button className="btn btn-sm btn-secondary" onClick={() => patchTheme('lowerThird', { fontSize: Math.min(100, (activeTheme?.lowerThird.fontSize || 32) + 2) })}>+</button>
                      <span style={{ ...type.caption, color: 'var(--text-dim)' }}>pt</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 4: Video & Canvas */}
            {activeCategory === 'video' && (
              <div>
                <div className="sm-content-title">Video Canvas & Recording Settings</div>
                <div className="sm-content-sub">Base canvas resolution, streaming output scale, recording formats, and transition controls.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Base (Canvas) Resolution</div>
                      <div className="sm-form-desc">Main rendering canvas resolution for projectors and streams</div>
                    </div>
                    <select className="input" style={{ width: 180 }} value={baseCanvasRes} onChange={(e) => setBaseCanvasRes(e.target.value)}>
                      <option value="1920x1080">1920×1080 (16:9 HD)</option>
                      <option value="1080x1920">1080×1920 (9:16 Vertical)</option>
                      <option value="2560x1440">2560×1440 (2K QHD)</option>
                      <option value="1280x720">1280×720 (720p HD)</option>
                    </select>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Recording Format</div>
                      <div className="sm-form-desc">Crash-safe MKV container or standard MP4</div>
                    </div>
                    <select className="input" style={{ width: 180 }} value={recordFormat} onChange={(e) => setRecordFormat(e.target.value as any)}>
                      <option value="mkv">MKV (.mkv - crash-safe)</option>
                      <option value="mp4">MP4 (.mp4)</option>
                    </select>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Auto-Record when Streaming</div>
                      <div className="sm-form-desc">Start recording automatically when stream broadcast begins</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoRecordStream}
                      onChange={(e) => setAutoRecordStream(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Slide Crossfade Duration</div>
                      <div className="sm-form-desc">Transition duration (ms) when changing slides</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 90, textAlign: 'center' }}
                        value={crossfadeMs}
                        onChange={(e) => setCrossfadeMs(parseInt(e.target.value, 10) || 0)}
                        min={0}
                        max={3000}
                        step={50}
                      />
                      <span style={{ ...type.caption, color: 'var(--text-dim)' }}>ms</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 5: Stream & OBS */}
            {activeCategory === 'streaming' && (
              <div>
                <div className="sm-content-title">Streaming & OBS Integration</div>
                <div className="sm-content-sub">Configure live RTMP broadcast credentials and OBS Studio WebSocket linkage.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Streaming Platform</div>
                      <div className="sm-form-desc">Select streaming destination</div>
                    </div>
                    <select className="input" style={{ width: 220 }} value={streamPlatform} onChange={(e) => setStreamPlatform(e.target.value)}>
                      <option value="youtube">YouTube Live</option>
                      <option value="facebook">Facebook Live</option>
                      <option value="twitch">Twitch</option>
                      <option value="custom">Custom RTMP Server</option>
                    </select>
                  </div>

                  <div className="sm-form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="sm-form-label">Stream Key</div>
                    <div className="sm-form-desc">Secret stream key provided by your streaming provider</div>
                    <input
                      type="password"
                      className="input"
                      style={{ marginTop: 6 }}
                      placeholder="Paste Stream Key..."
                      value={streamKeyDraft}
                      onChange={(e) => setStreamKeyDraft(e.target.value)}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">OBS WebSocket Status</div>
                      <div className="sm-form-desc">{obsStatus?.connected ? 'Connected to OBS Studio' : 'Not Connected'}</div>
                    </div>
                    <span className={`badge ${obsStatus?.connected ? 'badge-active' : 'badge-off'}`}>
                      {obsStatus?.connected ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Category 6: Bible & Scripture */}
            {activeCategory === 'bible' && (
              <div>
                <div className="sm-content-title">Bible & Scripture Options</div>
                <div className="sm-content-sub">Translation badges, verse numbering, and quotation formatting.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Show Translation Badge</div>
                      <div className="sm-form-desc">Include Bible version name (KJV, NIV, NLT) with reference</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeTheme?.bibleOptions?.showVersion ?? true}
                      onChange={(e) => patchTheme('bibleOptions', { showVersion: e.target.checked })}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Verse Numbering</div>
                      <div className="sm-form-desc">Display verse numbers in multi-verse scripture passages</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showVerseNumbers}
                      onChange={(e) => setShowVerseNumbers(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Words of Christ in Red</div>
                      <div className="sm-form-desc">Highlight Jesus' spoken words in red styling</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={redLetterWords}
                      onChange={(e) => setRedLetterWords(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Category 7: Audio Input */}
            {activeCategory === 'audio' && (
              <div>
                <div className="sm-content-title">Audio Input & Monitoring</div>
                <div className="sm-content-sub">Microphone selection, monitoring paths, and buffer sizes.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Audio Input Source</div>
                      <div className="sm-form-desc">Microphone input used for live AI scripture detection</div>
                    </div>
                    <select className="input" style={{ width: 240 }} value={live.selectedInputId || 'default'} onChange={(e) => setLive({ selectedInputId: e.target.value })}>
                      <option value="default">System Default Input</option>
                    </select>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Audio Monitoring Mode</div>
                      <div className="sm-form-desc">Route audio to operator headphones</div>
                    </div>
                    <select className="input" style={{ width: 200 }} value={audioMonitorMode} onChange={(e) => setAudioMonitorMode(e.target.value)}>
                      <option value="monitor-off">Monitor Off</option>
                      <option value="monitor-only">Monitor Only</option>
                      <option value="monitor-and-output">Monitor & Output</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Category 8: AI Speech STT */}
            {activeCategory === 'ai' && (
              <div>
                <div className="sm-content-title">AI Speech Recognition (STT)</div>
                <div className="sm-content-sub">Configure Deepgram cloud transcription and local Whisper AI models.</div>

                <div className="sm-form-group">
                  <div className="sm-form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="sm-form-label">Deepgram API Key</div>
                    <div className="sm-form-desc">Cloud speech-to-text API key for ultra low-latency live scripture detection</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        type="password"
                        className="input"
                        placeholder={settings?.deepgramApiKeySet ? '••••••••••••••••' : 'Paste Deepgram API Key...'}
                        value={deepgramKeyDraft}
                        onChange={(e) => setDeepgramKeyDraft(e.target.value)}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={async () => {
                          if (deepgramKeyDraft.trim()) {
                            await saveSettings({ deepgramApiKey: deepgramKeyDraft.trim() });
                            setDeepgramKeyDraft('');
                          }
                        }}
                      >
                        Save Key
                      </button>
                    </div>
                  </div>

                  <div className="sm-form-row">
                    <div>
                      <div className="sm-form-label">Auto-Project Detected Scriptures</div>
                      <div className="sm-form-desc">Automatically project detected Bible verses live on screen</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={live.autoProject ?? false}
                      onChange={(e) => setLive({ autoProject: e.target.checked })}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Category 9: Hotkeys */}
            {activeCategory === 'hotkeys' && (
              <div>
                <div className="sm-content-title">Keyboard Shortcuts</div>
                <div className="sm-content-sub">Global and workspace hotkeys for quick live operator control.</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="card"><strong>Cmd + Shift + F</strong>: Toggle Fullscreen Output</div>
                  <div className="card"><strong>Cmd + Shift + B</strong>: Toggle Blackout</div>
                  <div className="card"><strong>Cmd + Shift + N</strong>: Start NDI Video Stream</div>
                  <div className="card"><strong>F5</strong>: Reload Display Window</div>
                  <div className="card"><strong>Esc</strong>: Close Settings / Modals</div>
                  <div className="card"><strong>Right Arrow</strong>: Next Slide</div>
                  <div className="card"><strong>Left Arrow</strong>: Previous Slide</div>
                  <div className="card"><strong>Spacebar</strong>: Take to Program (Studio)</div>
                </div>
              </div>
            )}

            {/* Category 10: About */}
            {activeCategory === 'about' && (
              <div>
                <div className="sm-content-title">About & System Information</div>
                <div className="sm-content-sub">System runtime diagnostics and software details.</div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><strong>Application:</strong> Bible Song Pro Max</div>
                  <div><strong>Version:</strong> v1.0.0 (Pro Max Edition)</div>
                  <div><strong>Graphics Backend:</strong> macOS Metal Hardware Acceleration</div>
                  <div><strong>Server Port:</strong> 8942</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
