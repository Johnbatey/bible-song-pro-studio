import { useState, useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Block } from './components/Block';
import { PreviewProgramView } from './components/PreviewProgramView';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ScenePanel } from './components/ScenePanel';
import { BiblePanel } from './components/BiblePanel';
import { SongsPanel } from './components/SongsPanel';
import { ThemePanel } from './components/ThemePanel';
import { MediaPanel } from './components/MediaPanel';
import { PresentationPanel } from './components/PresentationPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsModal } from './components/SettingsModal';
import { ThemeDesignerModal } from './components/ThemeDesignerModal';
import { SlideEditorModal } from './components/SlideEditorModal';
import { AnimatedAlert } from './components/AnimatedAlert';
import { AIConsole } from './components/AIConsole';
import { StatusBar } from './components/StatusBar';
import { LiveScripturePanel } from './components/LiveScripturePanel';
import { SessionHistoryPanel } from './components/SessionHistoryPanel';
import { QueuePanel } from './components/QueuePanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useBroadcastSync } from './hooks/useBroadcastSync';
import type { Scene, Theme } from './types';

type PanelView = 'scenes' | 'bible' | 'songs' | 'live' | 'media' | 'themes' | 'presentation' | 'settings' | 'history';

/**
 * The audience display renderer consumes flat background fields
 * (bgVideo / bgCustomImage / bgFill), not the Scene.background object. Translate here
 * so imported media and gradients actually reach the output. Every field is sent on
 * each update — an explicit empty string is what clears a previous background.
 */
/**
 * The audience display keeps a flat config (fontFamily, fontSize, mode, …) — it has no
 * concept of our nested Theme object. Two mismatches meant the external output ignored both:
 *   - the theme was sent as `theme: {...}`, so every font/colour field was dropped
 *   - the output mode was sent as `outputMode`, but the page reads `mode`
 * so FS/LT switching and the whole Theme designer only ever affected the Program pane.
 */
function displayFieldsFor(theme: Theme | null, outputMode: 'fullscreen' | 'lowerThird') {
  const section = outputMode === 'lowerThird' ? theme?.lowerThird : theme?.fullScreen;
  const bible = theme?.bibleOptions;
  const fontColor = section?.fontColor || '#ffffff';

  return {
    // The display renderer calls this `mode`
    mode: outputMode,
    fontFamily: section?.fontFamily || 'Poppins',
    fontSize: section?.fontSize ?? 0,
    fontWeight: section?.fontWeight ?? 700,
    fontColor,
    textAlign: section?.textAlign || 'center',
    // These flat fields take precedence over the theme on the display side, so
    // they have to resolve the reference exactly the way ProgramSurface does for
    // the Program pane: sync follows the verse colour, otherwise the *active*
    // section's own reference colour wins. Reading lowerThird/fullScreen
    // unconditionally is what made the external output disagree with Program.
    referenceColor: section?.syncRefColor
      ? fontColor
      : (section?.referenceColor || theme?.lowerThird?.accentColor || '#e8541a'),
    referenceFontSize: section?.referenceFontSize ?? 0,
    // No theme control hides the reference today, so it always shows.
    showReference: true,
    showTranslation: bible?.showVersion ?? true,
  };
}

function backgroundFieldsFor(scene: Scene | null, theme: Theme | null, outputMode: 'fullscreen' | 'lowerThird') {
  const bg = scene?.background;
  const fields = {
    bgVideo: '' as string,
    bgCustomImage: '' as string,
    bgFill: '' as string,
    bgFit: bg?.fit || 'cover',
    bgOpacity: typeof bg?.opacity === 'number' ? bg.opacity : 1,
    bgVideoLoop: bg?.loop !== false,
  };
  if (!bg) {
    if (outputMode === 'fullscreen') {
      fields.bgFill = theme?.fullScreen?.backgroundColor || '#0c0e14';
    }
    return fields;
  }

  if (bg.type === 'video' && bg.mediaUrl) fields.bgVideo = bg.mediaUrl;
  else if (bg.type === 'image' && bg.mediaUrl) fields.bgCustomImage = bg.mediaUrl;
  else if (bg.type === 'gradient' && bg.gradient) fields.bgFill = bg.gradient;
  else if (bg.type === 'solid' && bg.color) fields.bgFill = bg.color;
  else if (bg.type === 'transparent') fields.bgFill = 'transparent';
  else if (outputMode === 'fullscreen') {
    fields.bgFill = theme?.fullScreen?.backgroundColor || '#0c0e14';
  }

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
        ...displayFieldsFor(state.activeTheme, state.display.outputMode),
        ...backgroundFieldsFor(state.display.currentScene, state.activeTheme, state.display.outputMode),
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

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_sidebarWidth');
    return saved ? parseInt(saved, 10) : 280;
  });

  const [transcriptHeight, setTranscriptHeight] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_transcriptHeight');
    return saved ? parseInt(saved, 10) : 360;
  });

  const [programDockHeight, setProgramDockHeight] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_programDockHeight');
    return saved ? parseInt(saved, 10) : 360;
  });

  const [historyHeight, setHistoryHeight] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_historyHeight');
    return saved ? parseInt(saved, 10) : 220;
  });

  const [queueWidth, setQueueWidth] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_queueWidth');
    return saved ? parseInt(saved, 10) : 340;
  });

  const [activeDrag, setActiveDrag] = useState<'sidebar' | 'transcript' | 'history' | 'program' | 'queue' | null>(null);

  const startResizing = (type: 'sidebar' | 'transcript' | 'history' | 'program' | 'queue', e: React.PointerEvent) => {
    e.preventDefault();
    setActiveDrag(type);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialSidebarW = sidebarWidth;
    const initialTranscriptH = transcriptHeight;
    const initialHistoryH = historyHeight;
    const initialProgramH = programDockHeight;
    const initialQueueW = queueWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (type === 'sidebar') {
        const deltaX = moveEvent.clientX - startX;
        const nextW = Math.min(500, Math.max(160, initialSidebarW + deltaX));
        setSidebarWidth(nextW);
        localStorage.setItem('bsp_sidebarWidth', String(nextW));
      } else if (type === 'transcript') {
        const deltaY = moveEvent.clientY - startY;
        const nextH = Math.min(700, Math.max(120, initialTranscriptH + deltaY));
        setTranscriptHeight(nextH);
        localStorage.setItem('bsp_transcriptHeight', String(nextH));
      } else if (type === 'history') {
        const deltaY = startY - moveEvent.clientY;
        const nextH = Math.min(600, Math.max(100, initialHistoryH + deltaY));
        setHistoryHeight(nextH);
        localStorage.setItem('bsp_historyHeight', String(nextH));
      } else if (type === 'queue') {
        // Queue sits to the right of the panel, so dragging left widens it.
        const deltaX = startX - moveEvent.clientX;
        const nextW = Math.min(640, Math.max(220, initialQueueW + deltaX));
        setQueueWidth(nextW);
        localStorage.setItem('bsp_queueWidth', String(nextW));
      } else if (type === 'program') {
        const deltaY = moveEvent.clientY - startY;
        const nextH = Math.min(800, Math.max(140, initialProgramH + deltaY));
        setProgramDockHeight(nextH);
        localStorage.setItem('bsp_programDockHeight', String(nextH));
      }
    };

    const onPointerUp = () => {
      setActiveDrag(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const [visitedPanels, setVisitedPanels] = useState<Set<string>>(() => new Set([activePanel]));

  useEffect(() => {
    setVisitedPanels((prev) => {
      if (prev.has(activePanel)) return prev;
      const next = new Set(prev);
      next.add(activePanel);
      return next;
    });
  }, [activePanel]);

  const workspaceStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--transcript-height': `${transcriptHeight}px`,
  } as React.CSSProperties;

  return (
    <div className="app-shell">
      <TitleBar activePanel={activePanel} onPanelChange={(p) => setActivePanel(p)} />
      <div className="app-body">
        <div className="app-main">
          <div className="operator-workspace" style={workspaceStyle}>
            <div className="left-column-region">
              <div className="transcript-region" style={{ height: transcriptHeight }}>
                <TranscriptPanel onOpenLiveScripture={() => setActivePanel('live')} />
              </div>

              {/* Vertical resizer between Live transcript and Workspace */}
              <div
                className={`resizer-handle resizer-handle-v ${activeDrag === 'transcript' ? 'is-dragging' : ''}`}
                onPointerDown={(e) => startResizing('transcript', e)}
                title="Drag to resize transcript height"
              />

              <div className="sidebar-region">
                <Block title="Workspace" flush>
                  <Sidebar
                    activePanel={activePanel as PanelView}
                    onPanelChange={(p) => setActivePanel(p)}
                    collapsed={!sidebarOpen}
                  />
                </Block>
              </div>

              {/* Vertical resizer between Workspace and History */}
              <div
                className={`resizer-handle resizer-handle-v ${activeDrag === 'history' ? 'is-dragging' : ''}`}
                onPointerDown={(e) => startResizing('history', e)}
                title="Drag to resize history height"
              />

              <div className="history-region" style={{ height: historyHeight }}>
                <SessionHistoryPanel />
              </div>
            </div>

            {/* Horizontal resizer between Sidebar and Left Workspace */}
            <div
              className={`resizer-handle resizer-handle-h sidebar-resizer ${activeDrag === 'sidebar' ? 'is-dragging' : ''}`}
              onPointerDown={(e) => startResizing('sidebar', e)}
              title="Drag to resize Sidebar width"
            />

            <div className="right-column-region">
              <section className="program-dock" style={{ height: programDockHeight }}>
                <ErrorBoundary label="Preview / Program">
                  <PreviewProgramView />
                </ErrorBoundary>
              </section>

              {/* Vertical resizer between Main Output display and Main Workspace Panel */}
              <div
                className={`resizer-handle resizer-handle-v ${activeDrag === 'program' ? 'is-dragging' : ''}`}
                onPointerDown={(e) => startResizing('program', e)}
                title="Drag to resize display height"
              />

              <div className="lower-dock-region">
                <main className="left-workspace">
                  <div className="app-content">
                    <div className="app-content-inner">
                      <ErrorBoundary label="Panel">
                      <div style={{ display: activePanel === 'scenes' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('scenes') && <ScenePanel />}
                      </div>
                      <div style={{ display: activePanel === 'bible' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('bible') && <BiblePanel />}
                      </div>
                      <div style={{ display: activePanel === 'songs' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('songs') && <SongsPanel />}
                      </div>
                      <div style={{ display: activePanel === 'live' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('live') && <LiveScripturePanel />}
                      </div>
                      <div style={{ display: activePanel === 'media' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('media') && <MediaPanel />}
                      </div>
                      <div style={{ display: activePanel === 'themes' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('themes') && <ThemePanel />}
                      </div>
                      <div style={{ display: activePanel === 'presentation' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('presentation') && <PresentationPanel />}
                      </div>
                      <div style={{ display: activePanel === 'settings' ? 'block' : 'none', height: '100%' }}>
                        {visitedPanels.has('settings') && <SettingsPanel />}
                      </div>
                      </ErrorBoundary>
                    </div>
                  </div>
                </main>

                {/* Horizontal resizer between the Workspace panel and Queue */}
                <div
                  className={`resizer-handle resizer-handle-h ${activeDrag === 'queue' ? 'is-dragging' : ''}`}
                  onPointerDown={(e) => startResizing('queue', e)}
                  title="Drag to resize Queue width"
                />

                <div className="queue-region" style={{ width: queueWidth }}>
                  <QueuePanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {activeDrag && (
        <div
          className="resize-drag-overlay"
          style={{
            cursor: activeDrag === 'transcript' ? 'ns-resize' : 'ew-resize',
          }}
        />
      )}
      <StatusBar />
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
      <SettingsModal />
      <ThemeDesignerModal />
      <SlideEditorModal />
      {activeAlert && (
        <AnimatedAlert
          alert={activeAlert}
          onDismiss={dismissAlert}
        />
      )}
    </div>
  );
}
