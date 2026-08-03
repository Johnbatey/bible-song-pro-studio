import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { TitleBar } from './components/TitleBar';
import { DockHost } from './components/dock/DockHost';
import { SettingsModal } from './components/SettingsModal';
import { ThemeDesignerModal } from './components/ThemeDesignerModal';
import { SlideEditorModal } from './components/SlideEditorModal';
import { AnimatedAlert } from './components/AnimatedAlert';
import { StatusBar } from './components/StatusBar';
import { useBroadcastSync } from './hooks/useBroadcastSync';
import type { Scene, Theme } from './types';

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
  const activeAlert = useAppStore((s) => s.activeAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const triggerAlert = useAppStore((s) => s.triggerAlert);

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
        state.transcription.text !== prev.transcription.text ||
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
      <div className="app-body">
        <div className="app-main">
          <DockHost />
        </div>
      </div>
      <StatusBar />
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
