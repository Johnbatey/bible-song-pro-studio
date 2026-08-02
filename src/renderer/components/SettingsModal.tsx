import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSettings, AppSettingsPatch, DisplayTarget, AudioInputDevice } from '../types';
import { SongPacks } from './settings/SongPacks';

export type SettingsCategory =
  | 'account'
  | 'scripture'
  | 'songs'
  | 'audio'
  | 'output'
  | 'fullscreen'
  | 'lowerthird'
  | 'language'
  | 'usage'
  | 'help'
  | 'feedback'
  | 'hotkeys';

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

const categories: CategoryItem[] = [
  {
    id: 'account',
    label: 'Account',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-2-2l2 2M3 21l8-8" />
        <circle cx="7.5" cy="16.5" r="3.5" />
        <path d="M16 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
      </svg>
    ),
  },
  {
    id: 'scripture',
    label: 'Scripture',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'songs',
    label: 'Songs',
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
    label: 'Audio & Speech AI',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    ),
  },
  {
    id: 'output',
    label: 'Displays & NDI',
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
    id: 'usage',
    label: 'Usage & Stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
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
];

export function SettingsModal() {
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const activeCategoryValue = useAppStore((s) => s.activeSettingsCategory) as SettingsCategory;
  const closeSettings = useAppStore((s) => s.closeSettings);

  const activeTheme = useAppStore((s) => s.activeTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const live = useAppStore((s) => s.liveScripture);
  const setLive = useAppStore((s) => s.setLiveScripture);

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(activeCategoryValue || 'scripture');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deepgramKeyDraft, setDeepgramKeyDraft] = useState('');
  const [displays, setDisplays] = useState<DisplayTarget[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<string>('auto');
  const [selectedStageDisplayId, setSelectedStageDisplayId] = useState<string>('auto');
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);

  // Feedback form state
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [wordStudy, setWordStudy] = useState(true);
  const [inputGain, setInputGain] = useState(0);
  const [voiceCommands, setVoiceCommands] = useState(true);

  useEffect(() => {
    if (activeCategoryValue) {
      setActiveCategory(activeCategoryValue);
    }
  }, [activeCategoryValue]);

  // Load electron IPC settings & devices
  useEffect(() => {
    refreshDisplays();
    window.BSP?.settings?.get().then((res) => { if (res?.ok) setSettings(res.settings); }).catch(() => {});
    
    // Audio device enumeration
    window.BSP?.audio?.getInputDevices?.().then((devs) => {
      setAudioDevices(devs || []);
    }).catch(() => {
      navigator.mediaDevices?.enumerateDevices().then((devs) => {
        const inputs = devs.filter((d) => d.kind === 'audioinput').map((d, i) => ({
          deviceId: d.deviceId || `dev-${i}`,
          label: d.label || `Microphone Input ${i + 1}`,
        }));
        setAudioDevices(inputs);
      }).catch(() => {});
    });
  }, []);

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

  function patchLowerThird(patch: Partial<NonNullable<typeof activeTheme>['lowerThird']>) {
    if (!activeTheme) return;
    updateTheme(activeTheme.id, {
      lowerThird: { ...activeTheme.lowerThird, ...patch },
    });
  }

  if (!isSettingsOpen) return null;

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        {/* Left Sidebar */}
        <div style={modalStyles.sidebar}>
          <div>
            <div style={modalStyles.sidebarHeader}>Settings</div>
            <div style={modalStyles.menuList}>
              {categories.map((item) => {
                const isActive = activeCategory === item.id;
                return (
                  <button
                    key={item.id}
                    style={{
                      ...modalStyles.sidebarItem,
                      color: isActive ? '#FF5500' : '#a1a1aa',
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

          {/* Bottom Upgrade Footer Box */}
          <div style={modalStyles.sidebarFooter}>
            <div style={modalStyles.planCard}>
              <span style={modalStyles.planLabel}>Free Plan</span>
              <button
                style={modalStyles.upgradeBtn}
                onClick={() => alert('Bible Song Pro Max Unlimited Edition Unlocked!')}
              >
                Upgrade
              </button>
            </div>
            <span style={modalStyles.versionText}>version 2.1.9</span>
          </div>
        </div>

        {/* Right Content Area */}
        <div style={modalStyles.contentArea}>
          {/* Top Header Bar */}
          <div style={modalStyles.contentHeader}>
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
            {/* 1. Account & System */}
            {activeCategory === 'account' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Account License Level</div>
                    <div style={modalStyles.rowSub}>Logged in as Administrator (Pro Edition)</div>
                  </div>
                  <button style={modalStyles.actionBtn}>Manage Account</button>
                </div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Subscription Tier</div>
                    <div style={modalStyles.rowSub}>Free Edition • Upgrade for NDI 60fps & cloud Deepgram AI</div>
                  </div>
                  <button style={{ ...modalStyles.actionBtn, background: '#FF5500', color: '#ffffff', border: 'none' }}>
                    Upgrade Plan
                  </button>
                </div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>System Engine Specs</div>
                    <div style={modalStyles.rowSub}>macOS Metal Hardware Acceleration • Port 8942</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>Active</span>
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
                        color: live.autoProject ? '#ffffff' : '#a1a1aa',
                      }}
                      onClick={() => setLive({ autoProject: true })}
                    >
                      Auto
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: !live.autoProject ? '#FF5500' : 'transparent',
                        color: !live.autoProject ? '#ffffff' : '#a1a1aa',
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
                  <input
                    type="checkbox"
                    checked={wordStudy}
                    onChange={(e) => setWordStudy(e.target.checked)}
                    style={modalStyles.toggleInput}
                  />
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
                        color: (settings?.sttEngine || 'deepgram') === 'deepgram' ? '#ffffff' : '#a1a1aa',
                      }}
                      onClick={() => saveSettings({ sttEngine: 'deepgram' })}
                    >
                      Cloud (Deepgram)
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: settings?.sttEngine === 'local' ? '#FF5500' : 'transparent',
                        color: settings?.sttEngine === 'local' ? '#ffffff' : '#a1a1aa',
                      }}
                      onClick={() => saveSettings({ sttEngine: 'local' })}
                    >
                      On-device (Whisper)
                    </button>
                  </div>
                </div>

                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Microphone Input</div>
                    <div style={modalStyles.rowSub}>{audioDevices.length || 1} audio devices available</div>
                  </div>
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

                <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={modalStyles.rowTitle}>Deepgram API Key</div>
                      <div style={modalStyles.rowSub}>Cloud STT API key for live scripture detection</div>
                    </div>
                    {settings?.deepgramApiKeySet && (
                      <button style={{ ...modalStyles.actionBtn, color: '#ef4444' }} onClick={clearDeepgramKey}>
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
                      style={{ ...modalStyles.actionBtn, background: '#FF5500', color: '#fff', border: 'none' }}
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
                      <div style={{ fontSize: 12, color: '#a1a1aa' }}>{inputGain}dB</div>
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
                  <input
                    type="checkbox"
                    checked={voiceCommands}
                    onChange={(e) => setVoiceCommands(e.target.checked)}
                    style={modalStyles.toggleInput}
                  />
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

                <div style={{ ...modalStyles.formRow, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={modalStyles.rowTitle}>NDI® Network Video Output</div>
                      <div style={modalStyles.rowSub}>Publish program output live for OBS, vMix, and network receivers</div>
                    </div>
                    <span style={{ fontSize: 11, background: '#22c55e', color: '#000', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                      NDI LIVE
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button style={modalStyles.actionBtn} onClick={() => navigator.clipboard.writeText('OBS NDI Source: Bible Song Pro')}>
                      Copy OBS Setup
                    </button>
                    <button style={modalStyles.actionBtn} onClick={() => navigator.clipboard.writeText('vMix NDI Input: Bible Song Pro')}>
                      Copy vMix Setup
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', width: 36, textAlign: 'center' }}>
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', width: 36, textAlign: 'center' }}>
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
                        color: (activeTheme?.fullScreen.textAlign || 'center') === 'left' ? '#ffffff' : '#a1a1aa',
                      }}
                      onClick={() => patchFullScreen({ textAlign: 'left' })}
                    >
                      Left
                    </button>
                    <button
                      style={{
                        ...modalStyles.pillBtn,
                        background: (activeTheme?.fullScreen.textAlign || 'center') === 'center' ? '#FF5500' : 'transparent',
                        color: (activeTheme?.fullScreen.textAlign || 'center') === 'center' ? '#ffffff' : '#a1a1aa',
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', width: 36, textAlign: 'center' }}>
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

            {/* 7. Language View */}
            {activeCategory === 'language' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Sermon language</div>
                    <div style={modalStyles.rowSub}>Lock transcription to a one language for optimal performance</div>
                  </div>
                  <select style={modalStyles.selectInput} defaultValue="auto">
                    <option value="auto">Auto (multi-language)</option>
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={modalStyles.rowTitle}>Language packs</div>
                  <div style={modalStyles.rowSub}>Add additional languages for transcription and bible verses</div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                    <div style={modalStyles.langCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>🇫🇷</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>French</div>
                          <div style={{ fontSize: 11, color: '#a1a1aa' }}>LSG & OST</div>
                        </div>
                      </div>
                      <button style={modalStyles.downloadBtn}>Download (93.1 MB)</button>
                    </div>

                    <div style={modalStyles.langCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>🇪🇸</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Spanish</div>
                          <div style={{ fontSize: 11, color: '#a1a1aa' }}>RV1909 & VBL</div>
                        </div>
                      </div>
                      <button style={modalStyles.downloadBtn}>Download (91.1 MB)</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. Keyboard Shortcuts (Hotkeys) */}
            {activeCategory === 'hotkeys' && (
              <div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Toggle Fullscreen Output</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + F</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Toggle Blackout Screen</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + B</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Start NDI Video Stream</span>
                  <span style={modalStyles.keyBadge}>Cmd + Shift + N</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Toggle search mode</span>
                  <span style={modalStyles.keyBadge}>Tab</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Toggle live sync</span>
                  <span style={modalStyles.keyBadge}>L</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Go live / Take to Program</span>
                  <span style={modalStyles.keyBadge}>Enter x2</span>
                </div>
                <div style={modalStyles.shortcutRow}>
                  <span style={{ fontSize: 13, color: '#ffffff' }}>Close Settings / Modals</span>
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
                    <div style={modalStyles.rowSub}>Learn how to use the app with an interactive guide</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={modalStyles.actionBtn}>Restart Tutorial</button>
                    <button style={modalStyles.actionBtn}>↗ Watch video</button>
                  </div>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Theme designer tutorial</div>
                    <div style={modalStyles.rowSub}>Learn how to use the theme designer</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={modalStyles.actionBtn}>Watch Tutorial</button>
                    <button style={modalStyles.actionBtn}>↗ Watch video</button>
                  </div>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Documentation</div>
                    <div style={modalStyles.rowSub}>Open guides and product help</div>
                  </div>
                  <button style={modalStyles.actionBtn}>Open docs</button>
                </div>

                <div style={modalStyles.helpRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Contact support</div>
                    <div style={modalStyles.rowSub}>Email the support team for help</div>
                  </div>
                  <button style={modalStyles.actionBtn}>Email support</button>
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
                      color: feedbackType === 'bug' ? '#ffffff' : '#a1a1aa',
                    }}
                    onClick={() => setFeedbackType('bug')}
                  >
                    🐛 Bug
                  </button>
                  <button
                    style={{
                      ...modalStyles.pillBtn,
                      background: feedbackType === 'feature' ? '#FF5500' : 'transparent',
                      color: feedbackType === 'feature' ? '#ffffff' : '#a1a1aa',
                    }}
                    onClick={() => setFeedbackType('feature')}
                  >
                    💡 Feature request
                  </button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 6 }}>
                    Email <span style={{ color: '#71717a' }}>(optional)</span>
                  </div>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    style={modalStyles.textInput}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>Report a bug</div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8 }}>A clear report helps us reproduce it quickly.</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={modalStyles.chipBadge}>What you were doing</span>
                    <span style={modalStyles.chipBadge}>What you expected</span>
                    <span style={modalStyles.chipBadge}>What actually happened</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Describe the issue in a few sentences..."
                    value={feedbackDesc}
                    onChange={(e) => setFeedbackDesc(e.target.value)}
                    style={modalStyles.textareaInput}
                  />
                </div>

                <button style={modalStyles.actionBtn}>
                  📤 Add screenshot
                </button>

                <div style={{ ...modalStyles.formRow, marginTop: 16 }}>
                  <div>
                    <div style={modalStyles.rowTitle}>Blocking issue</div>
                    <div style={modalStyles.rowSub}>The app cannot be used until this is fixed</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isBlocking}
                    onChange={(e) => setIsBlocking(e.target.checked)}
                    style={modalStyles.toggleInput}
                  />
                </div>
              </div>
            )}

            {/* Fallback for Usage & Stats */}
            {activeCategory === 'usage' && (
              <div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Live STT Audio Ingestion</div>
                    <div style={modalStyles.rowSub}>Continuous streaming audio buffer processing</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Active • 16kHz</span>
                </div>
                <div style={modalStyles.formRow}>
                  <div>
                    <div style={modalStyles.rowTitle}>Local Verse Index Size</div>
                    <div style={modalStyles.rowSub}>31,102 Bible verses indexed in memory</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>6.2 MB</span>
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
    borderRadius: 10,
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
    padding: '20px 0 16px',
  },
  sidebarHeader: {
    padding: '0 20px 14px',
    fontSize: 16,
    fontWeight: 700,
    color: '#ffffff',
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
  planCard: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--settings-card)',
    borderRadius: 999,
    padding: '4px 6px 4px 14px',
    border: '1px solid var(--settings-line)',
  },
  planLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ffffff',
  },
  upgradeBtn: {
    padding: '5px 14px',
    borderRadius: 999,
    border: 'none',
    background: '#ffffff',
    color: '#000000',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  versionText: {
    fontSize: 11,
    color: '#71717a',
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--settings-panel)',
    overflow: 'hidden',
  },
  contentHeader: {
    height: 56,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--settings-line)',
  },
  contentTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#ffffff',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: '#a1a1aa',
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
    color: '#ffffff',
  },
  rowSub: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  pillGroup: {
    display: 'flex',
    background: 'var(--settings-card)',
    borderRadius: 8,
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
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  langCard: {
    flex: 1,
    background: 'var(--settings-card)',
    borderRadius: 8,
    border: '1px solid var(--settings-line)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  downloadBtn: {
    width: '100%',
    padding: '6px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
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
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 600,
  },
  textInput: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 13,
    outline: 'none',
  },
  textareaInput: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--settings-card)',
    border: '1px solid var(--settings-line)',
    borderRadius: 6,
    color: '#ffffff',
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
    color: '#a1a1aa',
    fontSize: 11,
    cursor: 'pointer',
  },
};
