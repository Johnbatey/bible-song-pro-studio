import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { TitleBar } from './components/TitleBar';
import { UpdateBanner } from './components/UpdateBanner';
import { DockHost } from './components/dock/DockHost';
import { SettingsModal } from './components/SettingsModal';
import { SlideEditorModal } from './components/SlideEditorModal';
import { ThemeStudioModal } from './components/ThemeStudioModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
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
import { resolveEffectiveOutputMode } from './utils/outputMode';
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
    window.BSP?.i18n?.setLocale?.(uiLocale);
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

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const isShortcutsOpen = useAppStore((s) => s.isShortcutsOpen);
  const closeShortcuts = useAppStore((s) => s.closeShortcuts);

  /* Global Keyboard Shortcuts (Spotlight, Cheat Sheet, Take, Settings, Output Mode, Studio Mode, Blackout, Logo, ESC, Next/Prev) */
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;

      // 1. Spotlight Command Palette (Cmd+K / Ctrl+K)
      if (isMod && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. Keyboard Shortcuts Cheat Sheet: '?', 'Shift+/', 'Cmd+/', 'Ctrl+/', 'F1'
      const isShortcutsKey =
        e.key === '?' ||
        e.key === 'F1' ||
        (isMod && (e.key === '/' || e.code === 'Slash' || e.key === '?')) ||
        (e.shiftKey && (e.key === '/' || e.code === 'Slash'));

      if (isShortcutsKey) {
        if (isInput && !(isMod || e.key === 'F1')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().toggleShortcuts();
        return;
      }

      // 3. Open Application Settings (Cmd+, / Ctrl+,)
      if (isMod && !e.shiftKey && (e.key === ',' || e.key === '<')) {
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().openSettings();
        return;
      }

      // 4. Emergency Audience Blackout (Cmd+Shift+B / Ctrl+Shift+B)
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        e.stopPropagation();
        const next = !useAppStore.getState().display.blackout;
        useAppStore.getState().setBlackout(next);
        useAppStore.getState().notify({
          id: `blackout-${Date.now()}`,
          text: next ? 'Emergency Blackout Active' : 'Blackout Deactivated',
          type: next ? 'warning' : 'info',
          duration: 3,
          animation: 'slideDown',
        });
        return;
      }

      // 5. Studio Mode Take / Transition (F5 / Cmd+T / Ctrl+T)
      if (e.key === 'F5' || (isMod && !e.shiftKey && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().takeToProgram(true);
        return;
      }

      // 6. Toggle Output Mode: Fullscreen <-> Lower-Third (Cmd+D / Ctrl+D)
      if (isMod && !e.shiftKey && e.key.toLowerCase() === 'd' && !useAppStore.getState().isSlideEditorOpen) {
        e.preventDefault();
        e.stopPropagation();
        const current = useAppStore.getState().display.outputMode;
        const next = current === 'fullscreen' ? 'lowerThird' : 'fullscreen';
        useAppStore.getState().setOutputMode(next);
        useAppStore.getState().notify({
          id: `mode-toggle-${Date.now()}`,
          text: `Output Mode: ${next === 'fullscreen' ? 'Fullscreen' : 'Lower-Third'}`,
          type: 'info',
          duration: 2.5,
          animation: 'slideDown',
        });
        return;
      }

      // 7. Toggle Studio Mode: Basic <-> Studio (Cmd+M / Ctrl+M)
      if (isMod && !e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        e.stopPropagation();
        const current = useAppStore.getState().display.mode;
        const next = current === 'studio' ? 'basic' : 'studio';
        useAppStore.getState().setMode(next);
        useAppStore.getState().notify({
          id: `studio-toggle-${Date.now()}`,
          text: `Operating Mode: ${next === 'studio' ? 'Studio Mode (Live / Preview)' : 'Basic Mode (Direct)'}`,
          type: 'info',
          duration: 2.5,
          animation: 'slideDown',
        });
        return;
      }

      // 8. Launch Pro Slide Editor (Cmd+E / Ctrl+E)
      if (isMod && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().openSlideEditor();
        return;
      }

      // 9. Logo / Standby Screen (Cmd+L / Ctrl+L)
      if (isMod && !e.shiftKey && e.key.toLowerCase() === 'l') {
        if (isInput) return;
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().clearProgram();
        const standbyMedia = useAppStore.getState().standbyMedia;
        useAppStore.getState().notify({
          id: `logo-${Date.now()}`,
          text: standbyMedia ? 'Logo Standby Screen Active' : 'Standby Screen Active',
          type: 'info',
          duration: 3,
          animation: 'slideDown',
        });
        return;
      }

      // 10. Escape (ESC) key
      if (e.key === 'Escape') {
        const store = useAppStore.getState();
        if (isCommandPaletteOpen) {
          e.preventDefault();
          setIsCommandPaletteOpen(false);
          return;
        }
        if (store.isShortcutsOpen) {
          e.preventDefault();
          store.closeShortcuts();
          return;
        }
        if (store.isSettingsOpen) {
          e.preventDefault();
          store.closeSettings();
          return;
        }
        if (store.isSlideEditorOpen) {
          e.preventDefault();
          store.closeSlideEditor();
          return;
        }
        if (store.isThemeStudioOpen) {
          e.preventDefault();
          store.closeThemeStudio();
          return;
        }
        // If no modal is open, ESC clears live program output (Standby screen)
        if (!isInput) {
          e.preventDefault();
          store.clearProgram();
          store.notify({
            id: `clear-${Date.now()}`,
            text: 'Live Output Cleared (Standby Active)',
            type: 'info',
            duration: 2.5,
            animation: 'slideDown',
          });
          return;
        }
      }

      // 11. Next & Previous Navigation (ArrowRight / Space / PageDown & ArrowLeft / PageUp)
      if (!isInput && !isMod) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('bsp:step-next'));
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('bsp:step-prev'));
          return;
        }
      }
    }
    // Listen in capture phase so focused panels cannot stop propagation before global shortcuts execute
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [isCommandPaletteOpen]);

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
      const effectiveOutputMode = resolveEffectiveOutputMode(state.display.currentScene, state.display);
      window.BSP.display.sendState(sanitizeForIpc({
        scene: state.display.currentScene,
        outputMode: effectiveOutputMode,
        theme: activeTheme,
        /* Only a room announcement travels. Operator notices live in
           `state.notice` and are deliberately absent from this payload. */
        activeAlert: state.activeAlert,
        blackout: state.display.blackout,
        showStandbyBrand: state.showStandbyBrand,
        standbyMedia: state.standbyMedia,
        transcription: state.transcription.text,
        /* Only a program transport travels: a clip cued in preview has not
           reached the audience, and seeking it must not move what is on air. */
        videoTransport: state.display.videoTransport.target === 'program'
          ? state.display.videoTransport
          : null,
        fxAnimation: state.fxSettings,
        ...displayFieldsFor(activeTheme, effectiveOutputMode),
        ...backgroundFieldsFor(state.display.currentScene, activeTheme, effectiveOutputMode),
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
        state.display.bibleOutputMode !== prev.display.bibleOutputMode ||
        state.display.songOutputMode !== prev.display.songOutputMode ||
        state.activeTheme !== prev.activeTheme ||
        state.fxSettings !== prev.fxSettings ||
        state.activeAlert !== prev.activeAlert ||
        state.display.blackout !== prev.display.blackout ||
        state.showStandbyBrand !== prev.showStandbyBrand ||
        state.standbyMedia !== prev.standbyMedia ||
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
      <ThemeStudioModal />
      <CommandPaletteModal isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={closeShortcuts} />
      <WorkspaceBridge />
      {/* One notification surface for the whole app. It reads activeAlert and
          the notice list out of the store itself. */}
      <NoticeStack />
      <ThemeTransitionOverlay />
    </div>
  );
}
