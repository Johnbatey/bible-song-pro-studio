import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSettings, AppSettingsPatch, ObsStatus, DisplayTarget } from '../types';
import { ensureTheme } from '../utils/defaultTheme';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton, BlockSegment } from './Block';
import { AppleToggle } from './AppleToggle';

type Tab = 'output' | 'fullscreen' | 'lowerthird' | 'songs' | 'bible' | 'background' | 'fx' | 'audio' | 'ai' | 'streaming';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'output', label: 'Output' },
  { id: 'fullscreen', label: 'Fullscreen' },
  { id: 'lowerthird', label: 'LT Mode' },
  { id: 'songs', label: 'Songs' },
  { id: 'bible', label: 'Bible' },
  { id: 'background', label: 'Background' },
  { id: 'fx', label: 'Text FX' },
  { id: 'audio', label: 'Audio' },
  { id: 'ai', label: 'AI' },
  { id: 'streaming', label: 'Streaming' },
];

export function SettingsPanel() {
  const showSongCredits = useAppStore((s) => s.showSongCredits);
  const setShowSongCredits = useAppStore((s) => s.setShowSongCredits);
  const aiProviders = useAppStore((s) => s.aiProviders);
  const setAIProvider = useAppStore((s) => s.setAIProvider);
  const display = useAppStore((s) => s.display);
  const setMode = useAppStore((s) => s.setMode);
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const setOutputStatus = useAppStore((s) => s.setOutputStatus);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const themes = useAppStore((s) => s.themes);
  const live = useAppStore((s) => s.liveScripture);
  const setLive = useAppStore((s) => s.setLiveScripture);

  const [activeTab, setActiveTab] = useState<Tab>('output');
  const [displayUrl, setDisplayUrl] = useState('');
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deepgramKeyDraft, setDeepgramKeyDraft] = useState('');
  const [obsPasswordDraft, setObsPasswordDraft] = useState('');
  const [obsStatus, setObsStatus] = useState<ObsStatus | null>(null);
  const [localModelAction, setLocalModelAction] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [displays, setDisplays] = useState<DisplayTarget[]>([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState<string>('auto');
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null);
  const [displayNotice, setDisplayNotice] = useState('');

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
      setDisplayNotice(`Output sent to ${result.label || 'display'}.`);
    } else {
      setDisplayNotice(result?.error || 'Could not open the output display.');
    }
    refreshStatus();
    refreshDisplays();
  }

  useEffect(() => {
    refreshDisplays();
    // Monitors get plugged in mid-service; keep the list live rather than stale
    const off = window.BSP?.display?.onListChanged((list) => {
      setDisplays(list);
      window.BSP?.display?.getActive().then((a) => a?.ok && setActiveDisplayId(a.displayId)).catch(() => {});
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    window.BSP?.getDisplayUrl?.().then(setDisplayUrl).catch(() => {});
    window.BSP?.settings?.get().then((res) => { if (res?.ok) setSettings(res.settings); }).catch(() => {});
    window.BSP?.obs?.status().then(setObsStatus).catch(() => {});
    // OBS pushes scene/stream/record changes, so the panel stays live without polling
    const off = window.BSP?.obs?.onEvent((event) => setObsStatus(event.status));
    refreshStatus();
    return () => off?.();
  }, []);

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

  async function refreshStatus() {
    const status = await window.BSP?.display?.getStatus().catch(() => null);
    if (status) setOutputStatus(status);
    const s = await window.BSP?.ai?.status().catch(() => null);
    setAiStatus(s);
    if (s) setLive({ mlxStatus: s.engines?.mlx });
  }

  async function downloadLocalModel() {
    const accepted = window.confirm('Download the Local Whisper model now? The first download requires internet access and may take a few minutes.');
    if (!accepted) return;
    setLocalModelAction('downloading');
    const result = await window.BSP?.ai?.warmup({ engine: 'onnx' }).catch((e) => ({ ok: false, error: String(e) }));
    setAiStatus(result?.status || result);
    setLocalModelAction(result?.ok ? 'ready' : 'error');
  }

  function patchTheme(path: 'fullScreen' | 'lowerThird', updates: any) {
    const base = ensureTheme(activeTheme);
    const next = { ...base, [path]: { ...base[path], ...updates } };
    setActiveTheme(next);
    if (themes.some((theme) => theme.id === next.id)) updateTheme(next.id, next);
  }

  return (
    <Block
      title="Settings"
      tools={(
        <>
          <BlockSegment>
            {tabs.map((tab) => (
              <BlockButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </BlockButton>
            ))}
          </BlockSegment>
          <BlockButton onClick={refreshStatus} title="Refresh status">Refresh</BlockButton>
        </>
      )}
    >
      <div style={styles.body}>
          {activeTab === 'output' && (
            <Section title="Standalone Output">
              {/* Monitor picker. The old button opened display index 1 unconditionally,
                  which was wrong whenever the projector wasn't the second screen. */}
              <div className="section-title" style={{ marginBottom: 6 }}>
                Output Monitor ({displays.length} detected)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <button
                  className={`card card-hover ${selectedDisplayId === 'auto' ? 'glass-accent' : ''}`}
                  onClick={() => setSelectedDisplayId('auto')}
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    borderColor: selectedDisplayId === 'auto' ? 'var(--border-accent)' : undefined,
                  }}
                >
                  <div style={{ ...type.heading }}>Automatic</div>
                  <div style={{ ...type.caption, color: 'var(--text-dim)' }}>
                    Use the first external monitor that isn't this screen
                  </div>
                </button>

                {displays.map((d) => {
                  const isLive = activeDisplayId === d.id;
                  return (
                    <button
                      key={d.id}
                      className={`card card-hover ${selectedDisplayId === d.id ? 'glass-accent' : ''}`}
                      onClick={() => setSelectedDisplayId(d.id)}
                      onDoubleClick={() => openDisplay(d.id)}
                      style={{
                        textAlign: 'left', cursor: 'pointer',
                        borderColor: selectedDisplayId === d.id ? 'var(--border-accent)' : undefined,
                      }}
                      title="Double-click to send the output here"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ ...type.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.label}
                          </div>
                          <div style={{ ...type.caption, color: 'var(--text-dim)' }}>
                            {d.resolution}{d.scaleFactor !== 1 ? ` @${d.scaleFactor}x` : ''} · {d.bounds.x},{d.bounds.y}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {isLive && <span style={styles.badgeLive}>● OUTPUT</span>}
                          {d.isPrimary && <span style={styles.badge}>Primary</span>}
                          <span style={styles.badge}>{d.isInternal ? 'Built-in' : 'External'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={styles.row}>
                <button className="btn btn-primary" onClick={() => openDisplay(selectedDisplayId)}>
                  {display.outputStatus.isOpen ? 'Move Output Here' : 'Open External Display'}
                </button>
                <button className="btn btn-secondary" onClick={() => window.BSP?.display.close().then(() => { setActiveDisplayId(null); refreshStatus(); })}>Close Display</button>
                <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(displayUrl || display.outputStatus.browserUrl || '')}>Copy Browser URL</button>
              </div>
              {displayNotice && (
                <div style={{ ...type.caption, color: 'var(--text-dim)', margin: '6px 0' }}>{displayNotice}</div>
              )}
              <input className="input" value={displayUrl || display.outputStatus.browserUrl || 'http://localhost:8942/display.html'} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
              <div style={styles.statusLine}>Internal output: {display.outputStatus.url || 'Electron IPC display'} · Open: {String(display.outputStatus.isOpen)} · Browser clients: {display.outputStatus.clients}</div>
              <div style={styles.row}>
                <button
                  className={`btn btn-sm ${display.mode === 'studio' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMode('studio')}
                  title="Preview then Take — content is staged before it reaches the audience"
                >
                  Studio
                </button>
                <button
                  className={`btn btn-sm ${display.mode === 'basic' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMode('basic')}
                  title="Program only — everything you send goes live immediately"
                >
                  Basic
                </button>
                <button className={`btn btn-sm ${display.outputMode === 'fullscreen' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOutputMode('fullscreen')}>FS</button>
                <button className={`btn btn-sm ${display.outputMode === 'lowerThird' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOutputMode('lowerThird')}>LT</button>
              </div>
            </Section>
          )}

          {activeTab === 'fullscreen' && (
            <Section title="Full Screen Mode">
              <ControlGrid>
                <NumberField label="Verse/Song Font" value={activeTheme?.fullScreen.fontSize || 56} onChange={(v) => patchTheme('fullScreen', { fontSize: v })} />
                <NumberField label="Reference Font" value={activeTheme?.fullScreen.referenceFontSize || 26} onChange={(v) => patchTheme('fullScreen', { referenceFontSize: v })} />
                <ColorField label="Font Color" value={activeTheme?.fullScreen.fontColor || '#ffffff'} onChange={(v) => patchTheme('fullScreen', { fontColor: v })} />
                <SelectField label="Text Align" value={activeTheme?.fullScreen.textAlign || 'center'} options={['left', 'center']} onChange={(v) => patchTheme('fullScreen', { textAlign: v })} />
                <SelectField label="Y Align" value={activeTheme?.fullScreen.verticalAlign || 'middle'} options={['top', 'middle', 'bottom']} onChange={(v) => patchTheme('fullScreen', { verticalAlign: v })} />
                <SelectField label="Auto Resize" value={activeTheme?.fullScreen.autoResize || 'shrink'} options={['none', 'shrink', 'grow']} onChange={(v) => patchTheme('fullScreen', { autoResize: v })} />
              </ControlGrid>
            </Section>
          )}

          {activeTab === 'lowerthird' && (
            <Section title="Lower Third Mode">
              <ControlGrid>
                <NumberField label="LT Font" value={activeTheme?.lowerThird.fontSize || 36} onChange={(v) => patchTheme('lowerThird', { fontSize: v })} />
                <NumberField label="Width %" value={activeTheme?.lowerThird.width || 92} onChange={(v) => patchTheme('lowerThird', { width: v })} />
                <NumberField label="Radius" value={activeTheme?.lowerThird.borderRadius || 18} onChange={(v) => patchTheme('lowerThird', { borderRadius: v })} />
                <NumberField label="Offset X" value={activeTheme?.lowerThird.offsetX || 0} onChange={(v) => patchTheme('lowerThird', { offsetX: v })} />
                <NumberField label="Offset Y" value={activeTheme?.lowerThird.offsetY || 0} onChange={(v) => patchTheme('lowerThird', { offsetY: v })} />
                <ColorField label="Text Color" value={activeTheme?.lowerThird.fontColor || '#ffffff'} onChange={(v) => patchTheme('lowerThird', { fontColor: v })} />
                <SelectField label="Anchor" value={activeTheme?.lowerThird.anchor || 'bottom'} options={['bottom', 'top']} onChange={(v) => patchTheme('lowerThird', { anchor: v })} />
                <SelectField label="Align" value={activeTheme?.lowerThird.textAlign || 'left'} options={['left', 'center', 'right']} onChange={(v) => patchTheme('lowerThird', { textAlign: v })} />
              </ControlGrid>
            </Section>
          )}

          {activeTab === 'songs' && (
            <Section title="Song Options">
              <AppleToggle
                label="Show Song Credits on Display Output (Author, CCLI, Copyright)"
                description="Disabled by default. When enabled, credits will only show at the bottom of output when Auto (Section) mode is active."
                checked={showSongCredits}
                onChange={setShowSongCredits}
              />
            </Section>
          )}

          {activeTab === 'bible' && (
            <Section title="Bible Options">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Show Bible Version', 'Shorten Bible Versions', 'Shorten Book Names', 'Show Verse Numbers', 'Version Switch Updates Output'].map((label, i) => (
                  <AppleToggle
                    key={label}
                    label={label}
                    checked={i !== 2 && i !== 3}
                    onChange={() => {}}
                  />
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'background' && (
            <Section title="Background">
              <ControlGrid>
                <SelectField label="Type" value="gradient" options={['solid', 'gradient', 'image', 'video', 'transparent']} onChange={() => {}} />
                <ColorField label="Solid Color" value={activeTheme?.fullScreen.backgroundColor || '#0f172a'} onChange={(v) => patchTheme('fullScreen', { backgroundColor: v })} />
                <SelectField label="Media Fit" value="cover" options={['cover', 'contain', 'fill']} onChange={() => {}} />
                <SelectField label="Link FS/LT" value="on" options={['on', 'off']} onChange={() => {}} />
              </ControlGrid>
            </Section>
          )}

          {activeTab === 'fx' && (
            <Section title="Text FX">
              <ControlGrid>
                <SelectField label="Transition" value={activeTheme?.slideTheme.transition || 'fade'} options={['fade', 'zoom', 'type', 'zoom-type', 'slide', 'cut']} onChange={(v) => setActiveTheme(activeTheme ? { ...activeTheme, slideTheme: { ...activeTheme.slideTheme, transition: v } } : activeTheme)} />
                <SelectField label="FS Animation" value={activeTheme?.fullScreen.animation || 'fade'} options={['fade', 'zoom', 'type', 'zoom-type']} onChange={(v) => patchTheme('fullScreen', { animation: v })} />
                <SelectField label="LT Animation" value={activeTheme?.lowerThird.animation || 'slideInUp'} options={['slideInUp', 'slideInLeft', 'fade', 'zoom']} onChange={(v) => patchTheme('lowerThird', { animation: v })} />
                <SelectField label="Animate BG" value="on" options={['on', 'off']} onChange={() => {}} />
              </ControlGrid>
            </Section>
          )}

          {activeTab === 'audio' && (
            <Section title="Audio">
              <div style={styles.statusLine}>Use Live Scripture to choose microphone and view the meter.</div>
              <div style={styles.meter}><div style={{ ...styles.meterFill, width: `${Math.round(live.meter.level * 100)}%` }} /></div>
            </Section>
          )}

          {activeTab === 'ai' && (
            <Section title="AI Settings">
              <div style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...type.heading, marginBottom: 8 }}>Transcription</div>

                <div style={styles.row}>
                  <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Engine</span>
                  <select
                    className="input"
                    style={{ width: 190 }}
                    value={settings?.sttEngine || 'deepgram'}
                    onChange={(e) => saveSettings({ sttEngine: e.target.value as 'local' | 'deepgram' })}
                  >
                    <option value="deepgram">Deepgram (cloud, streaming)</option>
                    <option value="local">Local On-Device (offline)</option>
                  </select>
                </div>

                <div style={styles.row}>
                  <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Deepgram API Key</span>
                  <input
                    className="input"
                    type="password"
                    placeholder={settings?.deepgramApiKeySet ? '•••••••• (stored)' : 'Paste key to enable'}
                    value={deepgramKeyDraft}
                    onChange={(e) => setDeepgramKeyDraft(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!deepgramKeyDraft.trim()}
                    onClick={() => { saveSettings({ deepgramApiKey: deepgramKeyDraft.trim() }); setDeepgramKeyDraft(''); }}
                  >
                    Save
                  </button>
                  {settings?.deepgramApiKeySet && (
                    <button className="btn btn-sm btn-ghost" onClick={clearDeepgramKey}>Remove</button>
                  )}
                </div>
                <div style={{ ...type.caption, color: 'var(--text-dim)', marginBottom: 8 }}>
                  Stored in the app's settings file with owner-only permissions, never in the project or the UI state.
                </div>

                <div style={styles.row}>
                  <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Model</span>
                  <select
                    className="input"
                    style={{ width: 140 }}
                    value={settings?.deepgramModel || 'nova-2'}
                    onChange={(e) => saveSettings({ deepgramModel: e.target.value })}
                  >
                    <option value="nova-3">nova-3</option>
                    <option value="nova-2">nova-2</option>
                    <option value="enhanced">enhanced</option>
                    <option value="base">base</option>
                  </select>
                  <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Language</span>
                  <input
                    className="input"
                    style={{ width: 90 }}
                    value={settings?.deepgramLanguage || 'en'}
                    onChange={(e) => saveSettings({ deepgramLanguage: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ ...type.heading, marginBottom: 8 }}>Local Engines</div>

                <div style={styles.row}>
                  {/* The ONNX engine, whichever model it is running — Moonshine
                      by default. `whisper-onnx` remains its engine key. */}
                  <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>On-device (ONNX)</span>
                  <span style={{ ...type.caption, color: aiStatus?.engines?.onnx?.ready ? '#4caf50' : 'var(--text-dim)' }}>
                    {aiStatus?.engines?.onnx?.warmupState || 'idle'}
                  </span>
                  <button className="btn btn-sm btn-primary" disabled={localModelAction === 'downloading'} onClick={downloadLocalModel}>
                    {localModelAction === 'downloading' ? 'Downloading…' : aiStatus?.engines?.onnx?.ready ? 'Downloaded' : 'Download model'}
                  </button>
                  <button className="btn btn-sm" onClick={async () => setAiStatus(await window.BSP?.ai?.dispose({ engine: 'onnx' }).catch((e) => ({ ok: false, error: String(e) })))}>Dispose</button>
                </div>
                <div style={{ ...type.caption, color: localModelAction === 'error' ? 'var(--tally-fault)' : 'var(--text-dim)', marginBottom: 8 }}>
                  {localModelAction === 'error'
                    ? 'Model download failed. Check your connection and try again.'
                    : 'Required for offline Live Scripture. It is downloaded once and cached on this computer.'}
                </div>

                {aiStatus?.platform?.isAppleSilicon && (
                  <div style={styles.row}>
                    <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>MLX Whisper (Apple Silicon)</span>
                    <span style={{ ...type.caption, color: aiStatus?.engines?.mlx?.ready ? '#4caf50' : 'var(--text-dim)' }}>
                      {aiStatus?.engines?.mlx?.warmupState || 'unavailable'}
                    </span>
                    {aiStatus?.engines?.mlx?.available && (
                      <>
                        <button className="btn btn-sm" onClick={async () => setAiStatus(await window.BSP?.ai?.warmup({ engine: 'mlx' }).catch((e) => ({ ok: false, error: String(e) })))}>Warm</button>
                        <button className="btn btn-sm" onClick={async () => setAiStatus(await window.BSP?.ai?.dispose({ engine: 'mlx' }).catch((e) => ({ ok: false, error: String(e) })))}>Dispose</button>
                      </>
                    )}
                  </div>
                )}

                <div style={styles.row}>
                  <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Active Engine</span>
                  <select className="input" style={{ width: 140 }} value={aiStatus?.activeEngine || 'onnx'} onChange={(e) => window.BSP?.ai?.setEngine(e.target.value).then(refreshStatus)}>
                    <option value="onnx">ONNX (cross-platform)</option>
                    {aiStatus?.platform?.isAppleSilicon && <option value="mlx">MLX (Apple Silicon)</option>}
                  </select>
                </div>
              </div>

              <pre style={styles.pre}>{JSON.stringify(aiStatus || {}, null, 2)}</pre>
            </Section>
          )}

          {activeTab === 'streaming' && (
            <Section title="OBS Studio">
              <div style={{ ...type.caption, color: 'var(--text-dim)', marginBottom: 10 }}>
                Enable <strong>Tools → WebSocket Server Settings</strong> in OBS, then connect here.
              </div>

              <div style={styles.row}>
                <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Server</span>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="ws://127.0.0.1:4455"
                  value={settings?.obsUrl ?? 'ws://127.0.0.1:4455'}
                  onChange={(e) => saveSettings({ obsUrl: e.target.value })}
                />
              </div>

              <div style={styles.row}>
                <span style={{ ...type.secondary, color: 'var(--text-secondary)' }}>Password</span>
                <input
                  className="input"
                  type="password"
                  style={{ flex: 1 }}
                  placeholder={settings?.obsPasswordSet ? '•••••••• (stored)' : 'Leave blank if auth is off'}
                  value={obsPasswordDraft}
                  onChange={(e) => setObsPasswordDraft(e.target.value)}
                />
                <button
                  className="btn btn-sm"
                  disabled={!obsPasswordDraft.trim()}
                  onClick={() => { saveSettings({ obsPassword: obsPasswordDraft.trim() }); setObsPasswordDraft(''); }}
                >
                  Save
                </button>
              </div>

              <div style={styles.row}>
                <button
                  className={`btn btn-sm ${obsStatus?.connected ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={async () => {
                    const res = obsStatus?.connected
                      ? await window.BSP?.obs?.disconnect()
                      : await window.BSP?.obs?.connect({});
                    if (res?.status) setObsStatus(res.status);
                  }}
                >
                  {obsStatus?.connected ? 'Disconnect' : 'Connect'}
                </button>
                <span style={{ ...type.caption, color: obsStatus?.identified ? '#4caf50' : 'var(--text-dim)' }}>
                  {obsStatus?.identified
                    ? `Connected${obsStatus.obsVersion ? ' · OBS ' + obsStatus.obsVersion : ''}`
                    : obsStatus?.connected ? 'Authenticating…' : 'Not connected'}
                </span>
              </div>

              {obsStatus?.lastError && (
                <div style={{ ...type.caption, color: 'var(--tally-fault)', margin: '6px 0' }}>{obsStatus.lastError}</div>
              )}

              {obsStatus?.identified && (
                <>
                  <div style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ ...type.heading, marginBottom: 8 }}>Scenes</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {obsStatus.scenes.map((scene) => (
                        <button
                          key={scene}
                          className={`btn btn-sm ${scene === obsStatus.currentScene ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => window.BSP?.obs?.setScene(scene)}
                        >
                          {scene}
                        </button>
                      ))}
                      {obsStatus.scenes.length === 0 && (
                        <span style={{ ...type.caption, color: 'var(--text-dim)' }}>No scenes reported</span>
                      )}
                    </div>
                  </div>

                  <div style={styles.row}>
                    <button
                      className={`btn btn-sm ${obsStatus.streaming ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => window.BSP?.obs?.toggleStream()}
                    >
                      {obsStatus.streaming ? 'Stop Stream' : 'Start Stream'}
                    </button>
                    <button
                      className={`btn btn-sm ${obsStatus.recording ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => window.BSP?.obs?.toggleRecord()}
                    >
                      {obsStatus.recording ? 'Stop Recording' : 'Start Recording'}
                    </button>
                    <span style={{ ...type.caption, color: 'var(--text-dim)' }}>
                      {obsStatus.streaming ? '● Live' : ''} {obsStatus.recording ? '● Rec' : ''}
                    </span>
                  </div>
                </>
              )}
            </Section>
          )}
      </div>
    </Block>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card"><div className="section-title">{title}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div></div>;
}

function ControlGrid({ children }: { children: React.ReactNode }) {
  return <div style={styles.controlGrid}>{children}</div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label style={styles.field}><span>{label}</span><input className="input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label style={styles.field}><span>{label}</span><input className="input" type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label style={styles.field}><span>{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

const styles: Record<string, React.CSSProperties> = {
  badge: {
    ...type.label, padding: '2px 6px', borderRadius: 4,
    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  badgeLive: {
    ...type.label, fontWeight: fontWeight.bold, padding: '2px 6px', borderRadius: 4,
    background: 'rgba(231,76,60,0.15)', color: 'var(--tally-fault)',
    border: '1px solid rgba(231,76,60,0.35)', whiteSpace: 'nowrap',
  },
  body: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  statusLine: { ...type.secondary, color: 'var(--text-secondary)' },
  controlGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4, ...type.caption, color: 'var(--text-dim)' },
  check: { display: 'flex', alignItems: 'center', gap: 8, ...type.body, color: 'var(--text-secondary)' },
  meter: { height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  meterFill: { height: '100%', background: 'linear-gradient(90deg,var(--tally-preview),var(--tally-preview),var(--tally-fault))' },
  providerRow: { display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 10, alignItems: 'center' },
  providerLabel: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', ...type.body },
  pre: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', ...type.caption, fontFamily: 'var(--font-mono)', maxHeight: 180, overflow: 'auto' },
};
