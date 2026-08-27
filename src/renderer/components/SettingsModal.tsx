import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { AppleToggle } from './AppleToggle';
import type { AppSettings, AppSettingsPatch, DisplayTarget, AudioInputDevice, LocalModelStatus, NdiStatus, SermonLanguage, BibleDisplayOptions } from '../types';
import { SongPacks } from './settings/SongPacks';
import { BackupSystem } from './settings/BackupSystem';
import { createDefaultTheme } from '../utils/defaultTheme';
import { useI18n } from '../../i18n/useI18n';
import { UI_LOCALES, type UiLocale, type MessageKey } from '../../i18n';

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
  labelKey: MessageKey;
  icon: React.ReactNode;
}

const categoryDefs: CategoryItem[] = [
  {
    id: 'system',
    labelKey: 'settings.cat.system',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  },
  {
    id: 'bible',
    labelKey: 'settings.cat.bible',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'scripture',
    labelKey: 'settings.cat.scripture',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: 'songs',
    labelKey: 'settings.cat.songs',
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
    labelKey: 'settings.cat.audio',
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
    labelKey: 'settings.cat.output',
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
    labelKey: 'settings.cat.fullscreen',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    ),
  },
  {
    id: 'lowerthird',
    labelKey: 'settings.cat.lowerthird',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="14" width="18" height="7" rx="2" />
      </svg>
    ),
  },
  {
    id: 'language',
    labelKey: 'settings.cat.language',
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
    labelKey: 'settings.cat.hotkeys',
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
    labelKey: 'settings.cat.help',
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
    labelKey: 'settings.cat.feedback',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'support',
    labelKey: 'settings.cat.support',
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

const uiIconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

function IconAlertCircle() {
  return (
    <svg {...uiIconProps}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconLightbulb() {
  return (
    <svg {...uiIconProps}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function IconExternalLink({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg {...uiIconProps}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconPlay({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconCoffee({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg {...uiIconProps}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function SettingsModal() {
  const { t, locale } = useI18n();
  const setStoreUiLocale = useAppStore((s) => s.setUiLocale);
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
  const platform = useAppStore((s) => s.platform);

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
        setUpdateStatusText(t('settings.system.updateAvailable', { version: res.latestVersion || '' }));
        if (res.releaseUrl && window.BSP?.openExternal) {
          window.BSP.openExternal(res.releaseUrl);
        }
      } else {
        setUpdateStatusText(t('settings.system.latestVersion'));
      }
    } catch {
      setUpdateStatusText(t('settings.system.updateServerError'));
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
          label: device.label || t('settings.audio.fallbackMic', { n: index + 1 }),
        }));
      setAudioDevices(inputs);

      const outputs = (devices || [])
        .filter((device) => device.kind === 'audiooutput')
        .filter((device) => device.deviceId !== 'default')
        .map((device, index) => ({
          deviceId: device.deviceId || `output-${index}`,
          label: device.label || t('settings.audio.fallbackOutput', { n: index + 1 }),
        }));
      setOutputAudioDevices(outputs);

      setMicNamesHidden(inputs.length > 0 && (devices || []).every((d) => !d.label));
    } catch {
      setAudioDevices([]);
      setOutputAudioDevices([]);
    }
  }, [t]);

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
    if (res?.ok && res.settings) {
      setSettings(res.settings);
      window.dispatchEvent(new CustomEvent('bsp:settings-updated', { detail: res.settings }));
    }
  }

  async function clearDeepgramKey() {
    const res = await window.BSP?.settings?.clearSecret('deepgramApiKey').catch(() => null);
    if (res?.ok && res.settings) {
      setSettings(res.settings);
      window.dispatchEvent(new CustomEvent('bsp:settings-updated', { detail: res.settings }));
    }
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
              {t('common.settings')}
            </div>
            <div style={modalStyles.menuList}>
              {categoryDefs.map((item) => {
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
                    <span>{t(item.labelKey)}</span>
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
              {t(categoryDefs.find((c) => c.id === activeCategory)?.labelKey || 'app.settingsTitle')}
            </span>
            <button
              style={modalStyles.closeBtn}
              onClick={closeSettings}
              title={t('settings.closeTitle')}
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
                    <div style={modalStyles.rowTitle}>{t('settings.system.engineTitle')}</div>
                    <div style={modalStyles.rowSub}>
                      {platform === 'darwin'
                        ? t('settings.system.engineMac')
                        : platform === 'win32'
                        ? t('settings.system.engineWin')
                        : platform === 'linux'
                        ? t('settings.system.engineLinux')
                        : t('settings.system.engineDefault')}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#2ecc71', fontWeight: 600 }}>{t('settings.system.active')}</span>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.system.updatesTitle')}</div>
                    <div style={modalStyles.rowSub}>
                      {t('settings.system.appVersion', { version: appVersion || '3.1.0' })}{updateStatusText ? ` • ${updateStatusText}` : ''}
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
                    {updateChecking ? t('settings.system.checking') : t('settings.system.checkUpdates')}
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
                    <div style={modalStyles.rowTitle}>{t('settings.bibleOpt.showVersionTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.bibleOpt.showVersionSub')}</div>
                  </div>
                  <AppleToggle
                    checked={activeTheme?.bibleOptions?.showVersion !== false}
                    onChange={(checked) => patchBibleOptions({ showVersion: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.bibleOpt.shortenVersionTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.bibleOpt.shortenVersionSub')}</div>
                  </div>
                  <AppleToggle
                    checked={activeTheme?.bibleOptions?.shortenVersions !== false}
                    onChange={(checked) => patchBibleOptions({ shortenVersions: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.bibleOpt.shortenBooksTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.bibleOpt.shortenBooksSub')}</div>
                  </div>
                  <AppleToggle
                    checked={Boolean(activeTheme?.bibleOptions?.shortenBooks)}
                    onChange={(checked) => patchBibleOptions({ shortenBooks: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.bibleOpt.showVerseNumbersTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.bibleOpt.showVerseNumbersSub')}</div>
                  </div>
                  <AppleToggle
                    checked={Boolean(activeTheme?.bibleOptions?.showVerseNumbers)}
                    onChange={(checked) => patchBibleOptions({ showVerseNumbers: checked })}
                  />
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.bibleOpt.versionSwitchTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.bibleOpt.versionSwitchSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.scripture.verseModeTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.scripture.verseModeSub')}</div>
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
                      {t('settings.scripture.auto')}
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: !live.autoProject ? '#FF5500' : 'transparent',
                        color: !live.autoProject ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => setLive({ autoProject: false })}
                    >
                      {t('settings.scripture.manual')}
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.scripture.wordStudyTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.scripture.wordStudySub')}</div>
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
                  <div style={modalStyles.rowTitle}>{t('settings.songs.packsTitle')}</div>
                  <div style={modalStyles.rowSub}>{t('settings.songs.packsSub')}</div>
                </div>
                <SongPacks />
              </div>
            )}

            {/* 4. Audio & Speech AI View */}
            {activeCategory === 'audio' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.audio.transcriptionTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.audio.transcriptionSub')}</div>
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
                      {t('settings.audio.cloudDeepgram')}
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: settings?.sttEngine === 'local' ? '#FF5500' : 'transparent',
                        color: settings?.sttEngine === 'local' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => saveSettings({ sttEngine: 'local' })}
                    >
                      {t('settings.audio.onDevice')}
                    </button>
                  </div>
                </div>

                {settings?.sttEngine === 'local' && (
                  <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={modalStyles.rowTitle}>{t('settings.audio.localModelTitle')}</div>
                        <div style={modalStyles.rowSub}>
                          {localModel?.note || t('settings.audio.localModelDefaultNote')}
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
                            {model.label} {model.approxSize ? `(~${model.approxSize})` : ''}
                            {model.downloaded ? t('settings.audio.onThisComputer') : ''}
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
                            ? t('settings.audio.downloading', {
                                progress: aiStatus?.downloadProgress ?? 0,
                                size: localModel?.approxSize ? ` (~${localModel.approxSize})` : '',
                              })
                            : t('settings.audio.preparing')
                          : aiStatus?.ready
                          ? t('settings.audio.ready')
                          : localModel?.downloaded
                          ? t('settings.audio.loadModel')
                          : t('settings.audio.downloadModel', {
                              size: localModel?.approxSize ? ` (~${localModel.approxSize})` : '',
                            })}
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          color: aiStatus?.warmupState === 'error' ? 'var(--tally-fault)' : 'var(--text-dim)',
                        }}
                      >
                        {aiStatus?.warmupState === 'error'
                          ? aiStatus?.lastError || t('settings.audio.modelLoadError')
                          : aiStatus?.ready
                          ? t('settings.audio.modelReady')
                          : t('settings.audio.downloadSizeHint', { size: localModel?.approxSize || '~145 MB' })}
                      </span>
                    </div>
                  </div>
                )}

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.audio.micTitle')}</div>
                    <div style={modalStyles.rowSub}>
                      {micNamesHidden
                        ? t('settings.audio.micNamesHidden', { count: audioDevices.length })
                        : audioDevices.length === 0
                        ? t('settings.audio.micNone')
                        : audioDevices.length === 1
                        ? t('settings.audio.micAvailableOne', { count: audioDevices.length })
                        : t('settings.audio.micAvailableMany', { count: audioDevices.length })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {micNamesHidden && (
                      <button style={modalStyles.actionBtn} onClick={revealMicNames}>
                        {t('settings.audio.showNames')}
                      </button>
                    )}
                    <select
                      style={modalStyles.selectInput}
                      value={live.selectedInputId || 'default'}
                      onChange={(e) => setLive({ selectedInputId: e.target.value })}
                    >
                      <option value="default">{t('settings.audio.defaultMic')}</option>
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
                      <div style={modalStyles.rowTitle}>{t('settings.audio.deepgramKeyTitle')}</div>
                      <div style={modalStyles.rowSub}>{t('settings.audio.deepgramKeySub')}</div>
                    </div>
                    {settings?.deepgramApiKeySet && (
                      <button style={{ ...modalStyles.actionBtn, color: 'var(--tally-fault)' }} onClick={clearDeepgramKey}>
                        {t('settings.audio.clearKey')}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      type="password"
                      placeholder={settings?.deepgramApiKeySet ? t('settings.audio.deepgramPlaceholderSet') : t('settings.audio.deepgramPlaceholder')}
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
                      {t('settings.audio.saveKey')}
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={modalStyles.rowTitle}>{t('settings.audio.inputGainTitle')}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inputGain}dB</div>
                    </div>
                    <div style={modalStyles.rowSub}>{t('settings.audio.inputGainSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.audio.voiceCommandsTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.audio.voiceCommandsSub')}</div>
                  </div>
                  <AppleToggle checked={voiceCommands} onChange={setVoiceCommands} />
                </div>

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--settings-line)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
                    {t('settings.audio.outputSectionTitle')}
                  </div>

                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={modalStyles.rowTitle}>{t('settings.audio.programOutputTitle')}</div>
                      <div style={modalStyles.rowSub}>{t('settings.audio.programOutputSub')}</div>
                    </div>
                    <select
                      style={modalStyles.selectInput}
                      value={settings?.audioOutputDeviceId || 'default'}
                      onChange={(e) => saveSettings({ audioOutputDeviceId: e.target.value })}
                    >
                      <option value="default">{t('settings.audio.defaultOutput')}</option>
                      {outputAudioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={modalStyles.rowTitle}>{t('settings.audio.monitorTitle')}</div>
                      <div style={modalStyles.rowSub}>{t('settings.audio.monitorSub')}</div>
                    </div>
                    <select
                      style={modalStyles.selectInput}
                      value={settings?.audioCueDeviceId || 'default'}
                      onChange={(e) => saveSettings({ audioCueDeviceId: e.target.value })}
                    >
                      <option value="default">{t('settings.audio.defaultHeadphones')}</option>
                      {outputAudioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={modalStyles.formRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={modalStyles.rowTitle}>{t('settings.audio.masterVolumeTitle')}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {settings?.audioMasterVolume ?? 100}%
                        </div>
                      </div>
                      <div style={modalStyles.rowSub}>{t('settings.audio.masterVolumeSub')}</div>
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

                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={modalStyles.rowTitle}>{t('settings.audio.monoMixdownTitle')}</div>
                      <div style={modalStyles.rowSub}>{t('settings.audio.monoMixdownSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.output.primaryTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.output.primarySub')}</div>
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
                      <option value="auto">{t('settings.output.autoExternal')}</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label || t('settings.output.displayFallback', { id: d.id })}
                        </option>
                      ))}
                    </select>
                    <button style={modalStyles.actionBtn} onClick={() => window.BSP?.display?.open?.(selectedDisplayId)}>
                      {t('settings.output.openDisplay')}
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.output.stageTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.output.stageSub')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      style={modalStyles.selectInput}
                      value={selectedStageDisplayId}
                      onChange={(e) => setSelectedStageDisplayId(e.target.value)}
                    >
                      <option value="auto">{t('settings.output.autoStage')}</option>
                      {displays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label || t('settings.output.displayFallback', { id: d.id })}
                        </option>
                      ))}
                    </select>
                    <button style={modalStyles.actionBtn} onClick={() => window.BSP?.openStageDisplay?.(selectedStageDisplayId)}>
                      {t('settings.output.openStage')}
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.output.standbyTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.output.standbySub')}</div>
                  </div>
                  <AppleToggle checked={showStandbyBrand} onChange={setShowStandbyBrand} />
                </div>

                <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={modalStyles.rowTitle}>{t('settings.output.ndiTitle')}</div>
                      <div style={modalStyles.rowSub}>{t('settings.output.ndiSub')}</div>
                    </div>
                    <AppleToggle
                      checked={Boolean(ndiStatus?.running)}
                      onChange={toggleNdiStream}
                      disabled={isNdiLoading || ndiStatus?.available === false}
                    />
                  </div>

                  {ndiStatus?.available === false && (
                    <div style={{ fontSize: 11, color: 'var(--tally-fault)' }}>
                      {t('settings.output.ndiRuntimeMissing')}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: 'var(--settings-card)', padding: 12, borderRadius: 6, border: '1px solid var(--settings-line)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>{t('settings.output.ndiSourceName')}</label>
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
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>{t('settings.output.ndiFps')}</label>
                      <select
                        style={{ ...modalStyles.selectInput, width: '100%' }}
                        value={ndiFps}
                        onChange={(e) => setNdiFps(Number(e.target.value))}
                        disabled={ndiStatus?.running}
                      >
                        <option value={15}>{t('settings.output.ndiFps15')}</option>
                        <option value={30}>{t('settings.output.ndiFps30')}</option>
                        <option value={60}>{t('settings.output.ndiFps60')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>{t('settings.output.ndiResolution')}</label>
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
                        <option value="1280x720">{t('settings.output.ndi720p')}</option>
                        <option value="1920x1080">{t('settings.output.ndi1080p')}</option>
                      </select>
                    </div>
                  </div>

                  {ndiStatus && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', background: 'var(--settings-card)', border: '1px solid var(--settings-line)', padding: '6px 10px', borderRadius: 6 }}>
                      <span>{t('settings.output.ndiFramesSent')} <strong style={{ color: 'var(--text-primary)' }}>{ndiStatus.framesSent || 0}</strong></span>
                      <span>{t('settings.output.ndiConnections')} <strong style={{ color: 'var(--text-primary)' }}>{ndiStatus.connections || 0}</strong></span>
                      <span>{t('settings.output.ndiRuntimeLabel')} <strong style={{ color: ndiStatus.available ? 'var(--text-primary)' : 'var(--tally-fault)' }}>{ndiStatus.available ? t('settings.output.ndiSdkLoaded') : t('settings.output.ndiRuntimeMissingShort')}</strong></span>
                    </div>
                  )}

                  {ndiStatus?.lastError && (
                    <div style={{ fontSize: 12, color: 'var(--tally-fault)', background: 'rgba(239,68,68,0.1)', padding: 8, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)' }}>
                      {ndiStatus.lastError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button style={modalStyles.actionBtn} onClick={() => navigator.clipboard.writeText(`OBS NDI Source: ${ndiName}`)}>
                      {t('settings.output.copyObs')}
                    </button>
                    <button style={modalStyles.actionBtn} onClick={() => navigator.clipboard.writeText(`vMix NDI Input: ${ndiName}`)}>
                      {t('settings.output.copyVmix')}
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
                    <div style={modalStyles.rowTitle}>{t('settings.fs.refFontTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.fs.refFontSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.fs.mainFontTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.fs.mainFontSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.fs.autoResizeTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.fs.autoResizeSub')}</div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={activeTheme?.fullScreen.autoResize || 'shrink'}
                    onChange={(e) => patchFullScreen({ autoResize: e.target.value as 'none' | 'shrink' | 'grow' })}
                  >
                    <option value="none">{t('settings.fs.autoResizeNone')}</option>
                    <option value="shrink">{t('settings.fs.autoResizeShrink')}</option>
                    <option value="grow">{t('settings.fs.autoResizeGrow')}</option>
                  </select>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.fs.alignmentTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.fs.alignmentSub')}</div>
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
                      {t('settings.fs.alignLeft')}
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: (activeTheme?.fullScreen.textAlign || 'center') === 'center' ? '#FF5500' : 'transparent',
                        color: (activeTheme?.fullScreen.textAlign || 'center') === 'center' ? '#ffffff' : 'var(--text-secondary)',
                      }}
                      onClick={() => patchFullScreen({ textAlign: 'center' })}
                    >
                      {t('settings.fs.alignCenter')}
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.fs.fontColorTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.fs.fontColorSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.lt.fontTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.lt.fontSub')}</div>
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
                    <div style={modalStyles.rowTitle}>{t('settings.lt.positionTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.lt.positionSub')}</div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={activeTheme?.lowerThird.position || 'bottom-center'}
                    onChange={(e) => patchLowerThird({ position: e.target.value as any })}
                  >
                    <option value="bottom-center">{t('settings.lt.bottomCenter')}</option>
                    <option value="bottom-left">{t('settings.lt.bottomLeft')}</option>
                    <option value="bottom-right">{t('settings.lt.bottomRight')}</option>
                    <option value="top-center">{t('settings.lt.topCenter')}</option>
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
                    <div style={modalStyles.rowTitle}>{t('settings.language.uiTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.language.uiHint')}</div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={locale}
                    onChange={(e) => setStoreUiLocale(e.target.value as UiLocale)}
                  >
                    {UI_LOCALES.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.nativeLabel} — {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ ...modalStyles.rowSub, marginBottom: 20 }}>
                  {t('settings.language.restartHint')}
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.language.sermonTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.language.sermonHint')}</div>
                  </div>
                  <select
                    style={modalStyles.selectInput}
                    value={settings?.sermonLanguage || 'auto'}
                    onChange={(e) => saveSettings({ sermonLanguage: e.target.value as SermonLanguage })}
                  >
                    <option value="auto">{t('settings.language.auto')}</option>
                    {UI_LOCALES.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.nativeLabel}
                      </option>
                    ))}
                  </select>
                </div>

                {settings?.sermonLanguage && settings.sermonLanguage !== 'auto' && settings.sermonLanguage !== 'en'
                  && aiStatus && !aiStatus.multilingual && (
                  <div style={modalStyles.formRow}>
                    <div>
                      <div style={{ ...modalStyles.rowTitle, color: 'var(--tally-fault)' }}>
                        {t('settings.bundled.modelEnglishOnly', {
                          model: localModel?.label || t('settings.bundled.currentModel'),
                        })}
                      </div>
                      <div style={modalStyles.rowSub}>{t('settings.bundled.multilingualHint')}</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <div style={modalStyles.rowTitle}>{t('settings.bundled.translationsTitle')}</div>
                  <div style={modalStyles.rowSub}>{t('settings.bundled.translationsHint')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {[
                      { flag: '🇬🇧', labelKey: 'settings.bundled.english' as const, textsKey: 'settings.bundled.englishTexts' as const },
                      { flag: '🇫🇷', labelKey: 'settings.bundled.french' as const, textsKey: 'settings.bundled.frenchTexts' as const },
                      { flag: '🇪🇸', labelKey: 'settings.bundled.spanish' as const, textsKey: 'settings.bundled.spanishTexts' as const },
                    ].map((row) => (
                      <div key={row.labelKey} style={modalStyles.formRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{row.flag}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t(row.labelKey)}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t(row.textsKey)}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('settings.bundled.installed')}</span>
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
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.fullscreen')}</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + F</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.blackout')}</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + B</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.ndi')}</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + N</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.search')}</span>
                  <span style={modalStyles.keyBadge}>Tab</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.liveSync')}</span>
                  <span style={modalStyles.keyBadge}>L</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.take')}</span>
                  <span style={modalStyles.keyBadge}>Enter x2</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('settings.hotkeys.close')}</span>
                  <span style={modalStyles.keyBadge}>Esc</span>
                </div>
              </div>
            )}

            {/* 9. Help View */}
            {activeCategory === 'help' && (
              <div>
                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.help.dashboardTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.help.dashboardSub')}</div>
                  </div>
                  <button style={{ ...modalStyles.actionBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={openTutorials}>
                    <IconExternalLink />
                    {t('settings.help.watchYoutube')}
                  </button>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.help.themeTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.help.themeSub')}</div>
                  </div>
                  <button style={{ ...modalStyles.actionBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={openTutorials}>
                    <IconExternalLink />
                    {t('settings.help.watchYoutube')}
                  </button>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.help.docsTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.help.docsSub')}</div>
                  </div>
                  <button style={modalStyles.actionBtn}>{t('settings.help.openDocs')}</button>
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onClick={() => setFeedbackType('bug')}
                  >
                    <IconAlertCircle />
                    {t('settings.feedback.bugReport')}
                  </button>
                  <button
                    style={{
                      ...modalStyles.pillBtn,
                      background: feedbackType === 'feature' ? '#FF5500' : 'transparent',
                      color: feedbackType === 'feature' ? '#ffffff' : 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onClick={() => setFeedbackType('feature')}
                  >
                    <IconLightbulb />
                    {t('settings.feedback.featureRequest')}
                  </button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {t('settings.feedback.churchLabel')} <span style={{ color: 'var(--text-dim)' }}>{t('settings.feedback.optional')}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={t('settings.feedback.churchPlaceholder')}
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    style={modalStyles.textInput}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {feedbackType === 'bug' ? t('settings.feedback.describeBug') : t('settings.feedback.describeFeature')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {feedbackType === 'bug' ? t('settings.feedback.bugHint') : t('settings.feedback.featureHint')}
                  </div>
                  <textarea
                    rows={5}
                    placeholder={feedbackType === 'bug' ? t('settings.feedback.bugPlaceholder') : t('settings.feedback.featurePlaceholder')}
                    value={feedbackDesc}
                    onChange={(e) => setFeedbackDesc(e.target.value)}
                    style={modalStyles.textareaInput}
                  />
                </div>

                <div style={{ ...modalStyles.formRow, marginBottom: 16 }}>
                  <div>
                    <div style={modalStyles.rowTitle}>{t('settings.feedback.blockingTitle')}</div>
                    <div style={modalStyles.rowSub}>{t('settings.feedback.blockingSub')}</div>
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
                        style={{ marginTop: 6, fontSize: 11, background: '#FF5500', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <IconExternalLink size={13} />
                        {t('settings.feedback.openIssue')}
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
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
                            msg: t('settings.feedback.success'),
                            issueUrl: res.issueUrl,
                          });
                          setFeedbackDesc('');
                        } else {
                          setFeedbackStatus({
                            ok: false,
                            msg: res?.error || t('settings.feedback.fail'),
                          });
                        }
                      } catch {
                        setFeedbackStatus({
                          ok: false,
                          msg: t('settings.feedback.fallback'),
                        });
                      } finally {
                        setFeedbackSending(false);
                      }
                    }}
                  >
                    <IconSend />
                    {feedbackSending ? t('settings.feedback.sending') : t('settings.feedback.submit')}
                  </button>

                  <button
                    style={{ ...modalStyles.actionBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const issueTitle = `[${feedbackType.toUpperCase()}] Feedback from ${churchName ? churchName.trim() : 'App User'}`;
                      const issueBody = `### ${feedbackType === 'bug' ? t('settings.feedback.bugReport') : t('settings.feedback.featureRequest')}\n\n` +
                        `**Church / Community**: ${churchName ? churchName.trim() : 'Not specified'}\n` +
                        `**Blocking Issue**: ${isBlocking ? 'Yes' : 'No'}\n\n` +
                        `---\n### Description\n\n${feedbackDesc.trim() || '(No description)'}\n`;
                      const url = `https://github.com/Johnbatey/bible-song-pro-studio/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;
                      void window.BSP?.openExternal(url);
                    }}
                  >
                    <IconExternalLink />
                    {t('settings.feedback.openGithub')}
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
                      <IconCoffee size={26} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Johnson Olakotan
                      </h3>
                      <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#FF5500', fontWeight: 600 }}>
                        {t('settings.support.creatorRole')}
                      </p>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {t('settings.support.description')}
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
                      <IconCoffee size={15} />
                      {t('settings.support.buyCoffee')}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => void window.BSP?.openExternal('https://www.instagram.com/johnsonolakotan')}
                      style={{ padding: '10px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <IconCamera />
                      {t('settings.support.instagram')}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => void window.BSP?.openExternal(TUTORIALS_URL)}
                      style={{ padding: '10px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <IconPlay />
                      {t('settings.support.youtube')}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, padding: '0 4px' }}>
                  {t('settings.support.thankYou')}
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
