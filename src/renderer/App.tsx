import { useState, useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { PreviewProgramView } from './components/PreviewProgramView';
import { ScenePanel } from './components/ScenePanel';
import { BiblePanel } from './components/BiblePanel';
import { SongsPanel } from './components/SongsPanel';
import { ThemePanel } from './components/ThemePanel';
import { MediaPanel } from './components/MediaPanel';
import { PresentationPanel } from './components/PresentationPanel';
import { SongLibrary } from './components/SongLibrary';
import { SettingsPanel } from './components/SettingsPanel';
import { AnimatedAlert } from './components/AnimatedAlert';
import { AIConsole } from './components/AIConsole';
import { TranscriptionBar } from './components/TranscriptionBar';
import { StatusBar } from './components/StatusBar';
import { LiveScripturePanel } from './components/LiveScripturePanel';
import { SessionHistoryPanel } from './components/SessionHistoryPanel';
import { useBroadcastSync } from './hooks/useBroadcastSync';
import type { Scene } from './types';

type PanelView = 'scenes' | 'bible' | 'songs' | 'live' | 'media' | 'themes' | 'presentation' | 'songlibrary' | 'settings' | 'history';

/**
 * display.html consumes flat background fields (bgVideo / bgCustomImage / bgFill), not
 * the Scene.background object. Translate here so imported media and gradients actually
 * reach the output. Every field is sent on each update — an explicit empty string is
 * what clears a previous background.
 */
function backgroundFieldsFor(scene: Scene | null) {
  const bg = scene?.background;
  const fields = {
    bgVideo: '' as string,
    bgCustomImage: '' as string,
    bgFill: '' as string,
    bgFit: bg?.fit || 'cover',
    bgOpacity: typeof bg?.opacity === 'number' ? bg.opacity : 1,
    bgVideoLoop: bg?.loop !== false,
  };
  if (!bg) return fields;

  if (bg.type === 'video' && bg.mediaUrl) fields.bgVideo = bg.mediaUrl;
  else if (bg.type === 'image' && bg.mediaUrl) fields.bgCustomImage = bg.mediaUrl;
  else if (bg.type === 'gradient' && bg.gradient) fields.bgFill = bg.gradient;
  else if (bg.type === 'solid' && bg.color) fields.bgFill = bg.color;
  else if (bg.type === 'transparent') fields.bgFill = 'transparent';

  return fields;
}

export function App() {
  const platform = useAppStore((s) => s.platform);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const triggerAlert = useAppStore((s) => s.triggerAlert);

  const [activePanel, setActivePanel] = useState<PanelView>('scenes');
  const [showAIConsole, setShowAIConsole] = useState(false);

  useEffect(() => {
    async function init() {
      if (window.BSP) {
        const p = await window.BSP.platform();
        const status = await window.BSP.display.getStatus().catch(() => null);
        useAppStore.setState((state) => ({
          platform: p,
          isLoaded: true,
          display: status ? { ...state.display, outputStatus: status } : state.display,
        }));
      } else {
        useAppStore.setState({ platform: 'web', isLoaded: true });
      }
    }
    init();
  }, []);

  useBroadcastSync();

  useEffect(() => {
    if (!window.BSP?.display?.sendState) return;
    const sendState = () => {
      const state = useAppStore.getState();
      window.BSP.display.sendState({
        scene: state.display.currentScene,
        outputMode: state.display.outputMode,
        theme: state.activeTheme,
        activeAlert: state.activeAlert,
        transcription: state.transcription.text,
        ...backgroundFieldsFor(state.display.currentScene),
      }).then((nextState) => {
        useAppStore.getState().setOutputStatus({
          updatedAt: nextState?.updatedAt || Date.now(),
        });
      }).catch(() => {});
    };
    sendState();
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (
        state.display.currentScene !== prev.display.currentScene ||
        state.display.outputMode !== prev.display.outputMode ||
        state.activeTheme !== prev.activeTheme ||
        state.activeAlert !== prev.activeAlert ||
        state.transcription.text !== prev.transcription.text
      ) {
        sendState();
      }
    });
    return unsubscribe;
  }, []);

  const panelViews: Record<PanelView, React.ReactNode> = {
    scenes: <ScenePanel />,
    bible: <BiblePanel />,
    songs: <SongsPanel />,
    live: <LiveScripturePanel />,
    media: <MediaPanel />,
    themes: <ThemePanel />,
    presentation: <PresentationPanel />,
    songlibrary: <SongLibrary />,
    settings: <SettingsPanel />,
    history: <SessionHistoryPanel />,
  };

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar
          activePanel={activePanel as PanelView}
          onPanelChange={(p) => setActivePanel(p)}
          collapsed={!sidebarOpen}
        />
        <div className="app-main">
          <PreviewProgramView />
          <div className="app-content">
            <div className="app-content-inner">
              {panelViews[activePanel as PanelView] || <ScenePanel />}
            </div>
          </div>
        </div>
      </div>
      <StatusBar />
      <TranscriptionBar />
      <div style={{ position: 'fixed', bottom: 60, right: 20, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{
            width: 36,
            height: 36,
            padding: 0,
            borderRadius: '50%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onClick={() => setShowAIConsole(!showAIConsole)}
          title="AI Console"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
        <button
          className="btn btn-sm btn-secondary"
          style={{
            width: 36,
            height: 36,
            padding: 0,
            borderRadius: '50%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            triggerAlert({
              id: `url-${Date.now()}`,
              text: 'Display URL copied to clipboard',
              type: 'info',
              duration: 3,
              animation: 'slideDown',
            });
          }}
          title="Copy Display URL"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
      </div>
      {showAIConsole && <AIConsole onClose={() => setShowAIConsole(false)} />}
      {activeAlert && (
        <AnimatedAlert
          alert={activeAlert}
          onDismiss={dismissAlert}
        />
      )}
    </div>
  );
}
