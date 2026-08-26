import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { TitleBar } from './components/TitleBar';
import { UpdateBanner } from './components/UpdateBanner';
import { DockHost } from './components/dock/DockHost';
import { SettingsModal } from './components/SettingsModal';
import { SlideEditorModal } from './components/SlideEditorModal';
import { NoticeStack } from './components/NoticeStack';
import { WorkspaceBridge } from './components/dock/WorkspaceBridge';
import { StatusBar } from './components/StatusBar';
import { ThemeTransitionOverlay } from './components/ThemeTransitionOverlay';
import { useBroadcastSync } from './hooks/useBroadcastSync';
import { useStageSync } from './hooks/useStageSync';
import { useStoreSync } from './hooks/useStoreSync';
/* Flattening for the browser display lives in its own module: it is pure, it
   is the only description of what that page shows, and a check can call it
   there without pulling the store and the component tree in behind it. */
export { displayFieldsFor, backgroundFieldsFor } from './utils/display-fields';
import { displayFieldsFor, backgroundFieldsFor } from './utils/display-fields';
import { ensureTheme } from './utils/defaultTheme';
import { sanitizeForIpc } from './utils/sanitize-ipc';
import { setUiLocale as applyI18nLocale } from '../i18n';

export function App() {
  const platform = useAppStore((s) => s.platform);
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const uiLocale = useAppStore((s) => s.uiLocale);

  useEffect(() => {
    const mode = uiThemeMode || 'dark';
    document.documentElement.setAttribute('data-ui-theme', mode);
    if (mode === 'light') {
      document.documentElement.setAttribute('data-bsp-surface', 'paper');
      document.body.classList.add('light-theme');
    } else {
      document.documentElement.removeAttribute('data-bsp-surface');
      document.body.classList.remove('light-theme');
    }
  }, [uiThemeMode]);

  useEffect(() => {
    applyI18nLocale(uiLocale);
  }, [uiLocale]);

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

  /* Cmd+Shift+B and the remote blackout endpoint both land here, so all three
     ways of blacking out go through the same store field. */
  useEffect(() => {
    if (!window.BSP?.onBlackoutToggle) return;
    return window.BSP.onBlackoutToggle(() => useAppStore.getState().setBlackout());
  }, []);

  useBroadcastSync();
  // Feeds the stage display's zones: current, next, song cue and messages.
  useStageSync();
  useStoreSync();

  useEffect(() => {
    if (!window.BSP?.display?.sendState) return;
    const sendState = () => {
      const state = useAppStore.getState();
      const activeTheme = ensureTheme(state.activeTheme);
      window.BSP.display.sendState(sanitizeForIpc({
        scene: state.display.currentScene,
        outputMode: state.display.outputMode,
        theme: activeTheme,
        /* Only a room announcement travels. Operator notices live in
           `state.notice` and are deliberately absent from this payload. */
        activeAlert: state.activeAlert,
        blackout: state.display.blackout,
        showStandbyBrand: state.showStandbyBrand,
        transcription: state.transcription.text,
        /* Only a program transport travels: a clip cued in preview has not
           reached the audience, and seeking it must not move what is on air. */
        videoTransport: state.display.videoTransport.target === 'program'
          ? state.display.videoTransport
          : null,
        ...displayFieldsFor(activeTheme, state.display.outputMode),
        ...backgroundFieldsFor(state.display.currentScene, activeTheme, state.display.outputMode),
      })).then((nextState) => {
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
        state.display.blackout !== prev.display.blackout ||
        state.showStandbyBrand !== prev.showStandbyBrand ||
        state.transcription.text !== prev.transcription.text ||
        state.display.videoTransport !== prev.display.videoTransport ||
        // Opening the output window has to push current state at it, or the
        // display shows a stale background until something else changes.
        state.display.isExternalDisplayActive !== prev.display.isExternalDisplayActive
      ) {
        sendState();
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className="app-shell">
      <TitleBar />
      <UpdateBanner />
      <div className="app-body">
        <div className="app-main">
          <DockHost />
        </div>
      </div>
      <StatusBar />
      <SettingsModal />
      <SlideEditorModal />
      <WorkspaceBridge />
      {/* One notification surface for the whole app. It reads activeAlert and
          the notice list out of the store itself. */}
      <NoticeStack />
      <ThemeTransitionOverlay />
    </div>
  );
}
