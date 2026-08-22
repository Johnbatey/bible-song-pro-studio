import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { AppleToggle } from './AppleToggle';
import type { AppSettings, AppSettingsPatch, DisplayTarget, AudioInputDevice, LocalModelStatus, NdiStatus, SermonLanguage, BibleDisplayOptions } from '../types';
import { SongPacks } from './settings/SongPacks';
import { BackupSystem } from './settings/BackupSystem';
import { createDefaultTheme } from '../utils/defaultTheme';

export type SettingsCategory =
  | 'system'
  | 'bible'
  | 'scripture'
  | 'songs'
  | 'audio'
  | 'output'
  | 'fullscreen'
  | 'lowerthird'
  | 'help'
  | 'feedback'
  | 'support'
  | 'language'
  | 'hotkeys';

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

const categories: CategoryItem[] = [
  {
    id: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    id: 'bible',
    label: 'Bible Options',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'scripture',
    label: 'Live Scripture AI',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: 'songs',
    label: 'Songs & CCLI',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: 'audio',
    label: 'Audio Input (Microphone)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    id: 'output',
    label: 'Outputs (Displays & NDI)',
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
    label: 'Full Screen display',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    ),
  },
  {
    id: 'lowerthird',
    label: 'Lower Third display',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="14" width="18" height="7" rx="2" />
      </svg>
    ),
  },
  {
    id: 'language',
    label: 'Language',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z" />
      </svg>
    ),
  },
  {
    id: 'hotkeys',
    label: 'Hotkeys',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01" />
        <path d="M10 8h.01" />
        <path d="M14 8h.01" />
        <path d="M18 8h.01" />
        <path d="M8 12h8" />
      </svg>
    ),
  },
  {
    id: 'help',
    label: 'Help',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'feedback',
    label: 'Send feedback',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'support',
    label: 'Support the Creator',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
];

/* The tutorials live on the channel; there is no in-app interactive guide,
   so the Help view links out rather than pretending to have one. */
const TUTORIALS_URL = 'https://www.youtube.com/johnsonolakotan';

function openTutorials() {
  void window.BSP?.openExternal?.(TUTORIALS_URL);
}

export function SettingsModal() {
  /* Read from the running build. A hardcoded version goes stale silently and
     then misreports itself in every bug report. */
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    let alive = true;
    window.BSP?.version?.().then((v) => { if (alive) setAppVersion(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const activeCategoryValue = useAppStore((s) => s.activeSettingsCategory) as SettingsCategory;
  const closeSettings = useAppStore((s) => s.closeSettings);

  const activeTheme = useAppStore((s) => s.activeTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const live = useAppStore((s) => s.liveScripture);
  const setLive = useAppStore((s) => s.setLiveScripture);
  const showStandbyBrand = useAppStore((s) => s.showStandbyBrand);
  const setShowStandbyBrand = useAppStore((s) => s.setShowStandbyBrand);

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(activeCategoryValue || 'scripture');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deepgramKeyDraft, setDeepgramKeyDraft] = useState('');
  const [displays, setDisplays] = useState<DisplayTarget[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<string>('auto');
  const [selectedStageDisplayId, setSelectedStageDisplayId] = useState<string>('auto');
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);
  const [outputAudioDevices, setOutputAudioDevices] = useState<AudioInputDevice[]>([]);
  /** Devices are there but unnamed — Chromium withholds labels until access is granted. */
  const [micNamesHidden, setMicNamesHidden] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);

  const handleManualUpdateCheck = async () => {
    if (!window.BSP?.updates?.check) return;
    setUpdateChecking(true);
    setUpdateStatusText(null);
    try {
      const res = await window.BSP.updates.check();
      if (res?.updateAvailable) {
        setUpdateStatusText(`v${res.latestVersion} available!`);
        if (res.releaseUrl && window.BSP?.openExternal) {
          window.BSP.openExternal(res.releaseUrl);
        }
      } else {
        setUpdateStatusText('You are on the latest version.');
      }
    } catch (err) {
      setUpdateStatusText('Unable to reach update server.');
    } finally {
      setUpdateChecking(false);
    }
  };

  /* The on-device recogniser. `aiStatus` here is the ONNX engine's own slice of
     the transcription service's status, which is the half this row is about —
     the MLX path has no model choice to offer. */
  const [aiStatus, setAiStatus] = useState<LocalModelStatus | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const localModels = aiStatus?.models || [];
  const localModel = localModels.find((m) => m.key === aiStatus?.modelKey) || null;

  const refreshAiStatus = useCallback(async () => {
    const status = await window.BSP?.ai?.status?.().catch(() => null);
    if (status?.engines?.onnx) setAiStatus(status.engines.onnx as LocalModelStatus);
  }, []);

  useEffect(() => { refreshAiStatus(); }, [refreshAiStatus]);

  const selectLocalModel = useCallback(async (key: string) => {
    await window.BSP?.ai?.setLocalModel?.(key).catch(() => null);
    await refreshAiStatus();
  }, [refreshAiStatus]);

  /* Warmup is the download: transformers.js fetches the weights the first time
     the pipeline is built and reads them off disk every time after. Polling
     while it runs is how the percentage gets out — the progress arrives on a
     callback inside the main process, not as an IPC event. */
  const downloadLocalModel = useCallback(async () => {
    setLocalBusy(true);
    const poll = window.setInterval(refreshAiStatus, 700);
    try {
      await window.BSP?.ai?.warmup?.({ engine: 'onnx' }).catch(() => null);
    } finally {
      window.clearInterval(poll);
      await refreshAiStatus();
      setLocalBusy(false);
    }
  }, [refreshAiStatus]);

  // Feedback form state
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [churchName, setChurchName] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<{ ok: boolean; msg: string; issueUrl?: string } | null>(null);
  const [wordStudy, setWordStudy] = useState(true);
  const [inputGain, setInputGain] = useState(0);
  const [voiceCommands, setVoiceCommands] = useState(true);

  // NDI Streaming State
  const [ndiStatus, setNdiStatus] = useState<NdiStatus | null>(null);
  /* Matches DEFAULT_NDI_NAME in ndi-service.cjs. Kept as a literal rather than
     imported because the renderer cannot reach into the main process's modules;
     if one moves, move the other. */
  const [ndiName, setNdiName] = useState('Bible Song Pro Studio');
  const [ndiFps, setNdiFps] = useState<number>(15);
  const [ndiResWidth, setNdiResWidth] = useState<number>(1280);
  const [ndiResHeight, setNdiResHeight] = useState<number>(720);
  const [isNdiLoading, setIsNdiLoading] = useState(false);

  const refreshNdiStatus = useCallback(() => {
    window.BSP?.ndi?.status?.().then((st) => setNdiStatus(st)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshNdiStatus();
    const interval = setInterval(refreshNdiStatus, 2000);
    return () => clearInterval(interval);
  }, [refreshNdiStatus]);

  const toggleNdiStream = async () => {
    setIsNdiLoading(true);
    if (ndiStatus?.running) {
      await window.BSP?.ndi?.stop?.();
    } else {
      await window.BSP?.ndi?.start?.({
        name: ndiName,
        fps: ndiFps,
        width: ndiResWidth,
        height: ndiResHeight,
      });
    }
    refreshNdiStatus();
    setIsNdiLoading(false);
  };

  useEffect(() => {
    if (activeCategoryValue) {
      setActiveCategory(activeCategoryValue);
    }
  }, [activeCategoryValue]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, closeSettings]);

  // Load electron IPC settings & devices
  useEffect(() => {
    refreshDisplays();
    window.BSP?.settings?.get().then((res) => { if (res?.ok) setSettings(res.settings); }).catch(() => {});
    
  }, []);

  /* Microphones, from the only place that knows about them.
   *
   * This asked the main process first and fell back to the renderer if that
   * threw — but `audio:getInputDevices` was a stub returning `[]`, and an
   * empty array is a resolved promise, so the fallback never ran and the list
   * was empty every time. It could not have worked from there anyway:
   * enumerateDevices is a renderer API and the main process has no view of the
   * hardware. The stub is gone; this is the whole implementation now.
   *
   * Labels come back blank until the user has granted microphone access, so a
   * device with no name still gets a usable one rather than an empty row.
   */
  const refreshAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices();
      const inputs = (devices || [])
        .filter((device) => device.kind === 'audioinput')
        .filter((device) => device.deviceId !== 'default')
        .map((device, index) => ({
          deviceId: device.deviceId || `input-${index}`,
          label: device.label || `Microphone ${index + 1}`,
        }));
      setAudioDevices(inputs);

      const outputs = (devices || [])
        .filter((device) => device.kind === 'audiooutput')
        .filter((device) => device.deviceId !== 'default')
        .map((device, index) => ({
          deviceId: device.deviceId || `output-${index}`,
          label: device.label || `Soundcard / Output ${index + 1}`,
        }));
      setOutputAudioDevices(outputs);

      setMicNamesHidden(inputs.length > 0 && (devices || []).every((d) => !d.label));
    } catch {
      setAudioDevices([]);
      setOutputAudioDevices([]);
    }
  }, []);

  useEffect(() => {
    refreshAudioDevices();
    /* Interfaces get plugged in mid-setup, and a list captured when the modal
       opened would still be showing the built-in mic afterwards. */
    const media = navigator.mediaDevices;
    media?.addEventListener?.('devicechange', refreshAudioDevices);
    return () => media?.removeEventListener?.('devicechange', refreshAudioDevices);
  }, [refreshAudioDevices]);

  /* Asking for the stream is what makes Chromium hand over the device names;
     it is dropped immediately, because this is a naming exercise and holding
     an open capture would light the operator's mic indicator for nothing. */
  const revealMicNames = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await refreshAudioDevices();
    } catch {
      /* Refused, or no device. The list still works — the names just stay
         generic, which the row below says. */
    }
  }, [refreshAudioDevices]);

  async function refreshDisplays() {
    try {
      const list = await window.BSP?.display?.getDisplays?.();
      if (list) setDisplays(list);
    } catch (_) {}
  }

  async function saveSettings(patch: Partial<AppSettingsPatch>) {
    const res = await window.BSP?.settings?.set(patch).catch(() => null);
    if (res?.ok) setSettings(res.settings);
  }

  async function clearDeepgramKey() {
    const res = await window.BSP?.settings?.clearSecret('deepgramApiKey').catch(() => null);
    if (res?.ok && res.settings) setSettings(res.settings);
  }

  function patchFullScreen(patch: Partial<NonNullable<typeof activeTheme>['fullScreen']>) {
    if (!activeTheme) return;
    updateTheme(activeTheme.id, {
      fullScreen: { ...activeTheme.fullScreen, ...patch },
    });
  }

  function patchBibleOptions(patch: Partial<BibleDisplayOptions>) {
    if (!activeTheme) return;
    const def = createDefaultTheme();
    const current = activeTheme.bibleOptions || def.bibleOptions!;
    updateTheme(activeTheme.id, {
      bibleOptions: {
        showVersion: patch.showVersion ?? current.showVersion,
        shortenVersions: patch.shortenVersions ?? current.shortenVersions,
        shortenBooks: patch.shortenBooks ?? current.shortenBooks,
        showVerseNumbers: patch.showVerseNumbers ?? current.showVerseNumbers,
        versionSwitchUpdatesOutput: patch.versionSwitchUpdatesOutput ?? current.versionSwitchUpdatesOutput,
      },
    });
  }

  function patchLowerThird(patch: Partial<NonNullable<typeof activeTheme>['lowerThird']>) {
    if (!activeTheme) return;
    updateTheme(activeTheme.id, {
      lowerThird: { ...activeTheme.lowerThird, ...patch },
    });
  }

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  positionRef.current = position;
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isSettingsOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isSettingsOpen]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;

    setIsDragging(true);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = moveEvent.clientX - dragStartRef.current.x;
      const newY = moveEvent.clientY - dragStartRef.current.y;
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (!isSettingsOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div
        style={{
          ...modalStyles.container,
          transform: `translate3d(${position.x}px, ${position.y}px, 0px)`,
        }}
      >
        {/* Left Sidebar */}
        <div style={modalStyles.sidebar}>
          <div>
            <div
              style={{
                ...modalStyles.sidebarHeader,
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
              onMouseDown={handleMouseDown}
            >
              Settings
            </div>
            <div style={modalStyles.menuList}>
              {categories.map((item) => {
                const isActive = activeCategory === item.id;
                return (
                  <button
                    key={item.id}
                    style={{
                      ...modalStyles.sidebarItem,
                      color: isActive ? '#FF5500' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 500,
                    }}
                    onClick={() => setActiveCategory(item.id)}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: isActive ? '#FF5500' : 'inherit',
                    }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={modalStyles.sidebarFooter}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img src="./bible-song-pro-icon-small.svg" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Bible Song Pro<sup style={{ fontFamily: 'var(--font-signal)', fontSize: 8, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', marginLeft: '0.4em', verticalAlign: '0.3em', lineHeight: 0, color: 'var(--text-dim)' }}>Studio</sup>
                </span>
              </div>
              {appVersion && (
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500 }}>
                  v{appVersion}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div style={modalStyles.contentArea}>
          {/* Top Header Bar */}
          <div
            style={{
              ...modalStyles.contentHeader,
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
          >
            <span style={modalStyles.contentTitle}>
              {categories.find((c) => c.id === activeCategory)?.label || 'Settings'}
            </span>
            <button
              style={modalStyles.closeBtn}
              onClick={closeSettings}
              title="Close Settings"
            >
              ✕
            </button>
          </div>

          <div style={modalStyles.scrollBody}>
            {/* 1. System */}
            {activeCategory === 'system' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>System Engine Specs</div>
                    <div style={modalStyles.rowSub}>macOS Metal Hardware Acceleration • Port 8942</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#2ecc71', fontWeight: 600 }}>Active</span>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Software Updates</div>
                    <div style={modalStyles.rowSub}>
                      App Version {appVersion || '3.1.0'} {updateStatusText ? `• ${updateStatusText}` : ''}
                    </div>
                  </div>
                  <button
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: '1px solid var(--settings-line)',
                      background: 'var(--settings-card)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={handleManualUpdateCheck}
                    disabled={updateChecking}
                  >
                    {updateChecking ? 'Checking...' : 'Check for updates'}
                  </button>
                </div>

                <BackupSystem />
              </div>
            )}

            {/* Bible Options */}
            {activeCategory === 'bible' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Show Bible Version</div>
                    <div style={modalStyles.rowSub}>Display the translation label (e.g. NLT, KJV) in Scripture references on screen</div>
                  </div>
                  <AppleToggle
                    checked={activeTheme?.bibleOptions?.showVersion !== false}
                    onChange={(checked) => patchBibleOptions({ showVersion: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Shorten Bible Version</div>
                    <div style={modalStyles.rowSub}>Display concise abbreviations (e.g. NLT, NIV, KJV) instead of full version names</div>
                  </div>
                  <AppleToggle
                    checked={activeTheme?.bibleOptions?.shortenVersions !== false}
                    onChange={(checked) => patchBibleOptions({ shortenVersions: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Shorten Bible Book Names</div>
                    <div style={modalStyles.rowSub}>Abbreviate book names in citations (e.g. Gen. 1:1, Matt. 5:14, 1 Cor. 13:4)</div>
                  </div>
                  <AppleToggle
                    checked={Boolean(activeTheme?.bibleOptions?.shortenBooks)}
                    onChange={(checked) => patchBibleOptions({ shortenBooks: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Show Verse Numbers</div>
                    <div style={modalStyles.rowSub}>Include superscript verse numbers in displayed Scripture text</div>
                  </div>
                  <AppleToggle
                    checked={Boolean(activeTheme?.bibleOptions?.showVerseNumbers)}
                    onChange={(checked) => patchBibleOptions({ showVerseNumbers: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Version Switch Updates Output</div>
                    <div style={modalStyles.rowSub}>Switching Bible version immediately updates the live display in Basic mode</div>
                  </div>
                  <AppleToggle
                    checked={activeTheme?.bibleOptions?.versionSwitchUpdatesOutput !== false}
                    onChange={(checked) => patchBibleOptions({ versionSwitchUpdatesOutput: checked })}
                  />
                </div>
              </div>
            )}

            {/* 2. Scripture View */}
            {activeCategory === 'scripture' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Verse display Mode</div>
                    <div style={modalStyles.rowSub}>How do you want detected verses to display?</div>
                  </div>
                  <div style={modalStyles.pillGroup}>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: live.autoProject ? '#FF5500' : 'transparent',
                        color: live.autoProject ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => setLive({ autoProject: true })}
                    >
                      Auto
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: !live.autoProject ? '#FF5500' : 'transparent',
                        color: !live.autoProject ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => setLive({ autoProject: false })}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Original Languages word study</div>
                    <div style={modalStyles.rowSub}>Detect Greek/Hebrew root words in the sermon and show meaning on screen</div>
                  </div>
                  <AppleToggle checked={wordStudy} onChange={setWordStudy} />
                </div>
              </div>
            )}

            {/* 3. Songs — packs move here; the workspace no longer carries a
                   Song Library panel. */}
            {activeCategory === 'songs' && (
              <div>
                <div style={modalStyles.sectionIntro}>
                  <div style={modalStyles.rowTitle}>Song packs</div>
                  <div style={modalStyles.rowSub}>Browse and add song packs to your library</div>
                </div>
                <SongPacks />
              </div>
            )}

            {/* 4. Audio & Speech AI View */}
            {activeCategory === 'audio' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Transcription mode</div>
                    <div style={modalStyles.rowSub}>Run transcription locally or via Cloud AI API</div>
                  </div>
                  <div style={modalStyles.pillGroup}>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: (settings?.sttEngine || 'deepgram') === 'deepgram' ? '#FF5500' : 'transparent',
                        color: (settings?.sttEngine || 'deepgram') === 'deepgram' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => saveSettings({ sttEngine: 'deepgram' })}
                    >
                      Cloud (Deepgram)
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: settings?.sttEngine === 'local' ? '#FF5500' : 'transparent',
                        color: settings?.sttEngine === 'local' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => saveSettings({ sttEngine: 'local' })}
                    >
                      On-device
                    </button>
                  </div>
                </div>

                {/* The on-device model, shown only when it is the one running.
                    Two families here: Whisper, which every install already has,
                    and Moonshine, which was built for live speech and answers
                    faster on the short utterances this app feeds it. Whichever
                    is picked is downloaded once and then runs with no network
                    at all. */}
                {settings?.sttEngine === 'local' && (
                  <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={modalStyles.rowTitle}>On-device model</div>
                        <div style={modalStyles.rowSub}>
                          {localModel?.note || 'Runs on this computer. Downloaded once, then offline.'}
                        </div>
                      </div>
                      <select
                        style={modalStyles.selectInput}
                        value={localModel?.key || ''}
                        onChange={(e) => selectLocalModel(e.target.value)}
                        disabled={localBusy}
                      >
                        {localModels.map((model) => (
                          <option key={model.key} value={model.key}>
                            {model.label}
                            {model.downloaded ? ' — on this computer' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        style={modalStyles.actionBtn}
                        onClick={downloadLocalModel}
                        disabled={localBusy || aiStatus?.ready}
                      >
                        {localBusy
                          ? aiStatus?.warmupState === 'downloading'
                            ? `Downloading… ${aiStatus?.downloadProgress ?? 0}%`
                            : 'Preparing…'
                          : aiStatus?.ready
                          ? 'Ready'
                          : localModel?.downloaded
                          ? 'Load model'
                          : 'Download model'}
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          color: aiStatus?.warmupState === 'error' ? 'var(--tally-fault)' : 'var(--text-dim)',
                        }}
                      >
                        {aiStatus?.warmupState === 'error'
                          ? aiStatus?.lastError || 'The model could not be loaded.'
                          : aiStatus?.ready
                          ? 'Loaded and ready to transcribe.'
                          : 'The first download needs the internet. After that it runs offline.'}
                      </span>
                    </div>
                  </div>
                )}

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Microphone Input</div>
                    <div style={modalStyles.rowSub}>
                      {micNamesHidden
                        ? `${audioDevices.length} found — allow microphone access to see their names`
                        : audioDevices.length === 0
                        ? 'No microphone found on this computer'
                        : `${audioDevices.length} microphone${audioDevices.length === 1 ? '' : 's'} available`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {micNamesHidden && (
                      <button style={modalStyles.actionBtn} onClick={revealMicNames}>
                        Show names
                      </button>
                    )}
                    <select
                      style={modalStyles.selectInput}
                      value={live.selectedInputId || 'default'}
                      onChange={(e) => setLive({ selectedInputId: e.target.value })}
                    >
                      <option value="default">System Default Microphone</option>
                      {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={modalStyles.rowTitle}>Deepgram API Key</div>
                      <div style={modalStyles.rowSub}>Cloud STT API key for live scripture detection</div>
                    </div>
                    {settings?.deepgramApiKeySet && (
                      <button style={{ ...modalStyles.actionBtn, color: 'var(--tally-fault)' }} onClick={clearDeepgramKey}>
                        Clear Key
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      type="password"
                      placeholder={settings?.deepgramApiKeySet ? '••••••••••••••••' : 'Paste Deepgram API Key...'}
                      value={deepgramKeyDraft}
                      onChange={(e) => setDeepgramKeyDraft(e.target.value)}
                      style={modalStyles.textInput}
                    />
                    <button
                      style={{ ...modalStyles.actionBtn, background: '#FF5500', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        if (deepgramKeyDraft.trim()) {
                          saveSettings({ deepgramApiKey: deepgramKeyDraft.trim() });
                          setDeepgramKeyDraft('');
                        }
                      }}
                    >
                      Save Key
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={modalStyles.rowTitle}>Input gain</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inputGain}dB</div>
                    </div>
                    <div style={modalStyles.rowSub}>Adjust microphone sensitivity</div>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      value={inputGain}
                      onChange={(e) => setInputGain(Number(e.target.value))}
                      style={modalStyles.rangeInput}
                    />
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Voice commands</div>
                    <div style={modalStyles.rowSub}>Allow hands-free control during sermons</div>
                  </div>
                  <AppleToggle checked={voiceCommands} onChange={setVoiceCommands} />
                </div>

                {/* Audio Output & Sound Routing Block */}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--settings-line)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
                    Audio Output & Sound Routing
                  </div>

                  {/* Program Soundcard / HDMI / Dante Output */}
                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={modalStyles.rowTitle}>Program Audio Output Device</div>
                      <div style={modalStyles.rowSub}>
                        Routes media & video soundtrack audio (e.g. HDMI to Projector, Sound Desk, Dante)
                      </div>
                    </div>
                    <select
                      style={modalStyles.selectInput}
                      value={settings?.audioOutputDeviceId || 'default'}
                      onChange={(e) => saveSettings({ audioOutputDeviceId: e.target.value })}
                    >
                      <option value="default">System Default Audio Output</option>
                      {outputAudioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cue / Headphones Output */}
                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={modalStyles.rowTitle}>Monitor / Cue Headphones Device</div>
                      <div style={modalStyles.rowSub}>
                        Operator headphones output for pre-listening to video audio in Studio Mode
                      </div>
                    </div>
                    <select
                      style={modalStyles.selectInput}
                      value={settings?.audioCueDeviceId || 'default'}
                      onChange={(e) => saveSettings({ audioCueDeviceId: e.target.value })}
                    >
                      <option value="default">System Default Headphones / Secondary Device</option>
                      {outputAudioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Master Program Volume */}
                  <div style={modalStyles.formRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={modalStyles.rowTitle}>Master Program Volume</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {settings?.audioMasterVolume ?? 100}%
                        </div>
                      </div>
                      <div style={modalStyles.rowSub}>Master output gain level for all played presentation media</div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings?.audioMasterVolume ?? 100}
                        onChange={(e) => saveSettings({ audioMasterVolume: Number(e.target.value) })}
                        style={modalStyles.rangeInput}
                      />
                    </div>
                  </div>

                  {/* Mono Mixdown Toggle */}
                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={modalStyles.rowTitle}>Mono PA Mixdown</div>
                      <div style={modalStyles.rowSub}>
                        Combine stereo L/R channels into mono for single-channel church PA systems
                      </div>
                    </div>
                    <AppleToggle
                      checked={Boolean(settings?.audioMonoMixdown)}
                      onChange={(checked) => saveSettings({ audioMonoMixdown: checked })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Displays & NDI Output */}
            {activeCategory === 'output' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Primary Audience Display</div>
                    <div style={modalStyles.rowSub}>Monitor or projector target for main program output</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      style={modalStyles.selectInput}
                      value={selectedDisplayId}
                      onChange={(e) => {
                        setSelectedDisplayId(e.target.value);
                        window.BSP?.display?.open?.(e.target.value);
                      }}
                    >
                      <option value="auto">Auto (External Monitor)</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label || `Display ${d.id}`}
                        </option>
                      ))}
                    </select>
                    <button style={modalStyles.actionBtn} onClick={() => window.BSP?.display?.open?.(selectedDisplayId)}>
                      Open Display
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Stage Display Target</div>
                    <div style={modalStyles.rowSub}>Secondary confidence monitor for pastors and worship leaders</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      style={modalStyles.selectInput}
                      value={selectedStageDisplayId}
                      onChange={(e) => setSelectedStageDisplayId(e.target.value)}
                    >
                      <option value="auto">Auto (Stage Monitor)</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label || `Display ${d.id}`}
                        </option>
                      ))}
                    </select>
                    <button style={modalStyles.actionBtn} onClick={() => window.BSP?.openStageDisplay?.()}>
                      Open Stage Display
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Standby Card on Idle Screens</div>
                    <div style={modalStyles.rowSub}>
                      Show the “Bible Song Pro — Waiting for signal” card when nothing is being projected.
                      Turn this off to leave audience screens plain black between items.
                    </div>
                  </div>
                  <AppleToggle checked={showStandbyBrand} onChange={setShowStandbyBrand} />
                </div>

                <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={modalStyles.rowTitle}>NDI® Network Video Output</div>
                      <div style={modalStyles.rowSub}>Publish program output live over local network for OBS, vMix, and NDI receivers</div>
                    </div>
                    {/* One switch, like every other output on this page.
                        A status pill reading NDI OFF next to a button reading
                        Start NDI Stream said the same thing twice and made the
                        operator read two controls to learn one fact. The
                        toggle carries both: its position is the state, and it
                        goes Signal orange when the stream is up — the same rule
                        the tally works to. The connection count is a line below
                        in the diagnostic strip, which is where the rest of the
                        run-time numbers already live.

                        Disabled when the NDI runtime is missing: there is
                        nothing to switch on, and a control that accepts the
                        click and then fails is worse than one that does not. */}
                    <AppleToggle
                      checked={Boolean(ndiStatus?.running)}
                      onChange={toggleNdiStream}
                      disabled={isNdiLoading || ndiStatus?.available === false}
                    />
                  </div>

                  {ndiStatus?.available === false && (
                    <div style={{ fontSize: 11, color: 'var(--tally-fault)' }}>
                      The NDI runtime is not installed on this computer, so there is nothing to publish to.
                    </div>
                  )}

                  {/* NDI Stream Configuration Options */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: 'var(--settings-card)', padding: 12, borderRadius: 6, border: '1px solid var(--settings-line)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>NDI Source Name</label>
                      <input
                        type="text"
                        style={{ ...modalStyles.textInput, width: '100%' }}
                        value={ndiName}
                        onChange={(e) => setNdiName(e.target.value)}
                        placeholder="Bible Song Pro Studio"
                        disabled={ndiStatus?.running}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Target Frame Rate</label>
                      <select
                        style={{ ...modalStyles.selectInput, width: '100%' }}
                        value={ndiFps}
                        onChange={(e) => setNdiFps(Number(e.target.value))}
                        disabled={ndiStatus?.running}
                      >
                        <option value={15}>15 FPS (Standard)</option>
                        <option value={30}>30 FPS (Smooth)</option>
                        <option value={60}>60 FPS (Ultra Smooth)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Capture Resolution</label>
                      <select
                        style={{ ...modalStyles.selectInput, width: '100%' }}
                        value={`${ndiResWidth}x${ndiResHeight}`}
                        onChange={(e) => {
                          const [w, h] = e.target.value.split('x').map(Number);
                          setNdiResWidth(w);
                          setNdiResHeight(h);
                        }}
                        disabled={ndiStatus?.running}
                      >
                        <option value="1280x720">720p (1280 x 720)</option>
                        <option value="1920x1080">1080p (1920 x 1080)</option>
                      </select>
                    </div>
                  </div>

                  {/* Diagnostic / Status Bar */}
                  {ndiStatus && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', background: 'var(--settings-card)', border: '1px solid var(--settings-line)', padding: '6px 10px', borderRadius: 6 }}>
                      <span>Frames Sent: <strong style={{ color: 'var(--text-primary)' }}>{ndiStatus.framesSent || 0}</strong></span>
                      <span>Connections: <strong style={{ color: 'var(--text-primary)' }}>{ndiStatus.connections || 0}</strong></span>
                      <span>Runtime: <strong style={{ color: ndiStatus.available ? 'var(--text-primary)' : 'var(--tally-fault)' }}>{ndiStatus.available ? 'NDI SDK Loaded' : 'NDI Runtime Missing'}</strong></span>
                    </div>
                  )}

                  {ndiStatus?.lastError && (
                    <div style={{ fontSize: 12, color: 'var(--tally-fault)', background: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)' }}>
                      {ndiStatus.lastError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button style={modalStyles.actionBtn} onClick={() => navigator.clipboard.writeText(`OBS NDI Source: ${ndiName}`)}>
                      Copy OBS Setup Info
                    </button>
                    <button style={modalStyles.actionBtn} onClick={() => navigator.clipboard.writeText(`vMix NDI Input: ${ndiName}`)}>
                      Copy vMix Setup Info
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Full Screen Mode (FS) */}
            {activeCategory === 'fullscreen' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Reference Font Size</div>
                    <div style={modalStyles.rowSub}>Font size for Bible book/chapter and song title text</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      style={modalStyles.actionBtn}
                      onClick={() => patchFullScreen({ referenceFontSize: Math.max(10, (activeTheme?.fullScreen.referenceFontSize || 30) - 2) })}
                    >
                      -
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', width: 36, textAlign: 'center' }}>
                      {activeTheme?.fullScreen.referenceFontSize || 30}pt
                    </span>
                    <button
                      style={modalStyles.actionBtn}
                      onClick={() => patchFullScreen({ referenceFontSize: Math.min(200, (activeTheme?.fullScreen.referenceFontSize || 30) + 2) })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Verse / Song Main Font Size</div>
                    <div style={modalStyles.rowSub}>Main text font size for scriptures and lyrics</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      style={modalStyles.actionBtn}
                      onClick={() => patchFullScreen({ fontSize: Math.max(10, (activeTheme?.fullScreen.fontSize || 50) - 2) })}
                    >
                      -
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', width: 36, textAlign: 'center' }}>
                      {activeTheme?.fullScreen.fontSize || 50}pt
                    </span>
                    <button
                      style={modalStyles.actionBtn}
                      onClick={() => patchFullScreen({ fontSize: Math.min(200, (activeTheme?.fullScreen.fontSize || 50) + 2) })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Auto-Resize Mode</div>
                    <div style={modalStyles.rowSub}>Shrink text dynamically when lines exceed display bounds</div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={activeTheme?.fullScreen.autoResize || 'shrink'}
                    onChange={(e) => patchFullScreen({ autoResize: e.target.value as 'none' | 'shrink' | 'grow' })}
                  >
                    <option value="none">None</option>
                    <option value="shrink">Shrink to Fit</option>
                    <option value="grow">Grow to Fit</option>
                  </select>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Verse Text Alignment</div>
                    <div style={modalStyles.rowSub}>Horizontal positioning of scripture text</div>
                  </div>
                  <div style={modalStyles.pillGroup}>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: (activeTheme?.fullScreen.textAlign || 'center') === 'left' ? '#FF5500' : 'transparent',
                        color: (activeTheme?.fullScreen.textAlign || 'center') === 'left' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => patchFullScreen({ textAlign: 'left' })}
                    >
                      Left
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: (activeTheme?.fullScreen.textAlign || 'center') === 'center' ? '#FF5500' : 'transparent',
                        color: (activeTheme?.fullScreen.textAlign || 'center') === 'center' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => patchFullScreen({ textAlign: 'center' })}
                    >
                      Center
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Font Color</div>
                    <div style={modalStyles.rowSub}>Main scripture and lyric text color</div>
                  </div>
                  <input
                    type="color"
                    value={activeTheme?.fullScreen.fontColor || '#ffffff'}
                    onChange={(e) => patchFullScreen({ fontColor: e.target.value })}
                    style={{ width: 40, height: 30, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            {/* 6. Lower Third Mode (LT) */}
            {activeCategory === 'lowerthird' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Lower Third Font Size</div>
                    <div style={modalStyles.rowSub}>Main text font size in Lower Third overlay mode</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      style={modalStyles.actionBtn}
                      onClick={() => patchLowerThird({ fontSize: Math.max(10, (activeTheme?.lowerThird.fontSize || 32) - 2) })}
                    >
                      -
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', width: 36, textAlign: 'center' }}>
                      {activeTheme?.lowerThird.fontSize || 32}pt
                    </span>
                    <button
                      style={modalStyles.actionBtn}
                      onClick={() => patchLowerThird({ fontSize: Math.min(120, (activeTheme?.lowerThird.fontSize || 32) + 2) })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Lower Third Position</div>
                    <div style={modalStyles.rowSub}>Screen vertical alignment</div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={activeTheme?.lowerThird.position || 'bottom-center'}
                    onChange={(e) => patchLowerThird({ position: e.target.value as any })}
                  >
                    <option value="bottom-center">Bottom Center Overlay</option>
                    <option value="bottom-left">Bottom Left Overlay</option>
                    <option value="bottom-right">Bottom Right Overlay</option>
                    <option value="top-center">Top Center Overlay</option>
                  </select>
                </div>
              </div>
            )}

            {/* 7. Language.
                This replaced a mockup: a select wired to nothing, and two
                Download buttons with no handler offering "language packs" of
                93 MB that did not exist — one of them a copyrighted text. The
                bibles now ship (see BIBLES.md), so what is left here is the one
                thing that is genuinely a choice: which language the recogniser
                is listening for. */}
            {activeCategory === 'language' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Sermon language</div>
                    <div style={modalStyles.rowSub}>
                      Naming the language is steadier than letting it be detected each time.
                    </div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={settings?.sermonLanguage || 'auto'}
                    onChange={(e) => saveSettings({ sermonLanguage: e.target.value as SermonLanguage })}
                  >
                    <option value="auto">Auto (detect per utterance)</option>
                    <option value="en">English</option>
                    <option value="fr">French — Français</option>
                    <option value="es">Spanish — Español</option>
                  </select>
                </div>

                {/* The honest caveat. Moonshine and Whisper `.en` carry
                    English-only weights, so choosing French here would do
                    nothing at all unless the operator also switches model —
                    which is exactly the sort of silent no-op the old mockup
                    was made of. */}
                {settings?.sermonLanguage && settings.sermonLanguage !== 'auto' && settings.sermonLanguage !== 'en'
                  && aiStatus && !aiStatus.multilingual && (
                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={{ ...modalStyles.rowTitle, color: 'var(--tally-fault)' }}>
                        {localModel?.label || 'The current model'} only understands English
                      </div>
                      <div style={modalStyles.rowSub}>
                        Pick a multilingual model under Scripture → On-device model, or this
                        setting will have no effect.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <div style={modalStyles.rowTitle}>Bible translations</div>
                  <div style={modalStyles.rowSub}>
                    Bundled and offline — no download. Public domain only; see BIBLES.md.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {[
                      { flag: '🇬🇧', label: 'English', texts: 'KJV · ASV · Darby · YLT' },
                      { flag: '🇫🇷', label: 'French', texts: 'Louis Segond 1910 · Ostervald' },
                      { flag: '🇪🇸', label: 'Spanish', texts: 'Reina-Valera 1909' },
                    ].map((row) => (
                      <div key={row.label} style={modalStyles.formRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{row.flag}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.texts}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Installed</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 8. Keyboard Shortcuts (Hotkeys) */}
            {activeCategory === 'hotkeys' && (
              <div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Toggle Fullscreen Output</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + F</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Toggle Blackout Screen</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + B</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Start NDI Video Stream</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + N</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Toggle search mode</span>
                  <span style={modalStyles.keyBadge}>Tab</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Toggle live sync</span>
                  <span style={modalStyles.keyBadge}>L</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Go live / Take to Program</span>
                  <span style={modalStyles.keyBadge}>Enter x2</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Close Settings / Modals</span>
                  <span style={modalStyles.keyBadge}>Esc</span>
                </div>
              </div>
            )}

            {/* 9. Help View */}
            {activeCategory === 'help' && (
              <div>
                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Dashboard tutorial</div>
                    <div style={modalStyles.rowSub}>Video walkthroughs of the console, on the channel</div>
                  </div>
                  <button style={modalStyles.actionBtn} onClick={openTutorials}>↗ Watch on YouTube</button>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Theme designer tutorial</div>
                    <div style={modalStyles.rowSub}>Learn how to use the theme designer</div>
                  </div>
                  <button style={modalStyles.actionBtn} onClick={openTutorials}>↗ Watch on YouTube</button>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Documentation</div>
                    <div style={modalStyles.rowSub}>Open guides and product help</div>
                  </div>
                  <button style={modalStyles.actionBtn}>Open docs</button>
                </div>

              </div>
            )}

            {/* 10. Send Feedback View */}
            {activeCategory === 'feedback' && (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  <button
                    style={{
                      ...modalStyles.pillBtn,
                      background: feedbackType === 'bug' ? '#FF5500' : 'transparent',
                      color: feedbackType === 'bug' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                    onClick={() => setFeedbackType('bug')}
                  >
                    🐛 Bug Report
                  </button>
                  <button
                    style={{
                      ...modalStyles.pillBtn,
                      background: feedbackType === 'feature' ? '#FF5500' : 'transparent',
                      color: feedbackType === 'feature' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                    onClick={() => setFeedbackType('feature')}
                  >
                    💡 Feature Request
                  </button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Church / Community Name <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Grace Chapel / City Youth Ministry"
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    style={modalStyles.textInput}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {feedbackType === 'bug' ? 'Describe the bug' : 'Describe the feature request'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {feedbackType === 'bug'
                      ? 'A clear report helps us reproduce and fix it quickly.'
                      : 'Let us know how this feature would help your church or media team.'}
                  </div>
                  <textarea
                    rows={5}
                    placeholder={
                      feedbackType === 'bug'
                        ? 'Describe what you were doing, what you expected, and what happened...'
                        : 'Describe the feature you would like to see in Bible Song Pro Studio...'
                    }
                    value={feedbackDesc}
                    onChange={(e) => setFeedbackDesc(e.target.value)}
                    style={modalStyles.textareaInput}
                  />
                </div>

                <div style={{ ...modalStyles.formRow, marginBottom: 16 }}>
                  <div>
                    <div style={modalStyles.rowTitle}>Blocking Issue</div>
                    <div style={modalStyles.rowSubtitle}>This issue prevents normal service or presentation setup</div>
                  </div>
                  <AppleToggle checked={isBlocking} onChange={setIsBlocking} />
                </div>

                {feedbackStatus && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: 12,
                      background: feedbackStatus.ok ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${feedbackStatus.ok ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                      color: feedbackStatus.ok ? '#22C55E' : '#EF4444',
                    }}
                  >
                    <div>{feedbackStatus.msg}</div>
                    {feedbackStatus.issueUrl && (
                      <button
                        className="btn btn-sm"
                        onClick={() => void window.BSP?.openExternal(feedbackStatus.issueUrl!)}
                        style={{ marginTop: 6, fontSize: 11, background: '#FF5500', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 10px' }}
                      >
                        🔗 Open Issue on GitHub
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    style={{
                      ...modalStyles.actionBtn,
                      background: '#FF5500',
                      color: '#FFF',
                      borderColor: '#FF5500',
                      fontWeight: 700,
                      opacity: feedbackSending || !feedbackDesc.trim() ? 0.6 : 1,
                      cursor: feedbackSending || !feedbackDesc.trim() ? 'not-allowed' : 'pointer',
                    }}
                    disabled={feedbackSending || !feedbackDesc.trim()}
                    onClick={async () => {
                      if (!feedbackDesc.trim()) return;
                      setFeedbackSending(true);
                      setFeedbackStatus(null);
                      try {
                        const res = await window.BSP?.feedback?.send({
                          type: feedbackType,
                          churchName,
                          description: feedbackDesc,
                          isBlocking,
                          includeDiag: true,
                        });
                        if (res && res.ok) {
                          setFeedbackStatus({
                            ok: true,
                            msg: 'Thank you! Your feedback has been prepared for GitHub.',
                            issueUrl: res.issueUrl,
                          });
                          setFeedbackDesc('');
                        } else {
                          setFeedbackStatus({
                            ok: false,
                            msg: res?.error || 'Failed to submit feedback. You can use the link below.',
                          });
                        }
                      } catch (err) {
                        setFeedbackStatus({
                          ok: false,
                          msg: 'Could not send directly. Click below to submit on GitHub.',
                        });
                      } finally {
                        setFeedbackSending(false);
                      }
                    }}
                  >
                    {feedbackSending ? 'Sending…' : '📤 Submit Feedback to GitHub'}
                  </button>

                  <button
                    style={modalStyles.actionBtn}
                    onClick={() => {
                      const issueTitle = `[${feedbackType.toUpperCase()}] Feedback from ${churchName ? churchName.trim() : 'App User'}`;
                      const issueBody = `### ${feedbackType === 'bug' ? '🐛 Bug Report' : '💡 Feature Request'}\n\n` +
                        `**Church / Community**: ${churchName ? churchName.trim() : 'Not specified'}\n` +
                        `**Blocking Issue**: ${isBlocking ? 'Yes' : 'No'}\n\n` +
                        `---\n### Description\n\n${feedbackDesc.trim() || '(No description)'}\n`;
                      const url = `https://github.com/Johnbatey/bible-song-pro-studio/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
                      void window.BSP?.openExternal(url);
                    }}
                  >
                    🔗 Open directly on GitHub
                  </button>
                </div>
              </div>
            )}

            {/* 11. Support the Creator View */}
            {activeCategory === 'support' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    background: 'var(--chrome-control)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 12,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'rgba(255, 85, 0, 0.15)',
                        border: '1px solid rgba(255, 85, 0, 0.4)',
                        color: '#FF5500',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        flexShrink: 0,
                      }}
                    >
                      ☕
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Johnson Olakotan
                      </h3>
                      <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#FF5500', fontWeight: 600 }}>
                        Lead Engineer & Creator of Bible Song Pro Studio
                      </p>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Bible Song Pro Studio is built to empower churches, ministries, and live production teams with reliable, modern presentation tools and live scripture AI. Your support directly helps fund ongoing engineering, hosting costs, and future feature developments.
                  </p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <button
                      className="btn"
                      onClick={() => void window.BSP?.openExternal('https://buymeacoffee.com/johnsonolakotan')}
                      style={{
                        background: '#FF5500',
                        color: '#FFF',
                        fontWeight: 700,
                        fontSize: 13,
                        padding: '10px 18px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      ☕ Buy Me a Coffee / Support
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => void window.BSP?.openExternal('https://www.instagram.com/johnsonolakotan')}
                      style={{ padding: '10px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer' }}
                    >
                      📷 Instagram @johnsonolakotan
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => void window.BSP?.openExternal(TUTORIALS_URL)}
                      style={{ padding: '10px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer' }}
                    >
                      ▶️ YouTube Tutorials
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, padding: '0 4px' }}>
                  Thank you for using Bible Song Pro Studio to serve your church and media team!
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    position: 'relative',
    width: 960,
    maxWidth: 'calc(100vw - 32px)',
    height: 640,
    maxHeight: 'calc(100vh - 48px)',
    background: 'var(--settings-panel)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8)',
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: 'var(--settings-sidebar)',
    borderRight: '1px solid var(--settings-line)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '0 0 16px',
  },
  sidebarHeader: {
    height: 54,
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--settings-line)',
    marginBottom: 8,
  },
  menuList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 20px',
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    fontFamily: 'var(--font-ui)',
  },
  sidebarFooter: {
    padding: '0 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  versionText: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--settings-panel)',
    overflow: 'hidden',
  },
  contentHeader: {
    height: 54,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--settings-line)',
  },
  contentTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 24px 24px',
  },
  formRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid var(--settings-line)',
    gap: 16,
  },
  helpRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid var(--settings-line)',
    gap: 16,
  },
  sectionIntro: {
    padding: '16px 0 14px',
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  rowSub: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  pillGroup: {
    display: 'flex',
    background: 'var(--settings-card)',
    borderRadius: 6,
    padding: 3,
    border: '1px solid var(--settings-line)',
  },
  pillBtn: {
    padding: '5px 14px',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  selectInput: {
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    padding: '6px 12px',
    outline: 'none',
    cursor: 'pointer',
  },
  toggleInput: {
    width: 38,
    height: 20,
    accentColor: '#FF5500',
    cursor: 'pointer',
  },
  rangeInput: {
    width: '100%',
    accentColor: '#FF5500',
    cursor: 'pointer',
    marginTop: 6,
  },
  actionBtn: {
    padding: '6px 14px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--settings-line)',
  },
  keyBadge: {
    padding: '3px 8px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 11,
    fontWeight: 600,
  },
  textInput: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  textareaInput: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'var(--font-ui)',
  },
  chipBadge: {
    padding: '4px 10px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 999,
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
  },
};
