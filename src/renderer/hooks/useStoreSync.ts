/* =========================================================================
   useStoreSync — keep the operator window and popped-out docks on one store
   -------------------------------------------------------------------------
   Each BrowserWindow has its own Zustand instance. Persist already shares the
   library on disk; this hop carries the live slice (what is on Program, the
   theme being edited, the verse just taken) so a Bible panel in its own
   window can still drive the Output dock and OBS.
   ========================================================================= */
import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { sanitizeForIpc } from '../utils/sanitize-ipc';

let applyingRemote = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function takeSnapshot() {
  const state = useAppStore.getState();
  return {
    scenes: state.scenes,
    presentationDecks: state.presentationDecks,
    songs: state.songs,
    themes: state.themes,
    activeTheme: state.activeTheme,
    verseHistory: state.verseHistory,
    currentBibleVersion: state.currentBibleVersion,
    showStandbyBrand: state.showStandbyBrand,
    standbyMedia: state.standbyMedia,
    songLinesPerSlide: state.songLinesPerSlide,
    display: state.display,
    liveScripture: state.liveScripture,
    transcription: state.transcription,
    activeAlert: state.activeAlert,
    uiThemeMode: state.uiThemeMode,
  };
}

function applySnapshot(snapshot: ReturnType<typeof takeSnapshot>) {
  applyingRemote = true;
  useAppStore.setState({
    scenes: snapshot.scenes,
    presentationDecks: snapshot.presentationDecks,
    songs: snapshot.songs,
    themes: snapshot.themes,
    activeTheme: snapshot.activeTheme,
    verseHistory: snapshot.verseHistory,
    currentBibleVersion: snapshot.currentBibleVersion,
    showStandbyBrand: snapshot.showStandbyBrand,
    standbyMedia: snapshot.standbyMedia,
    songLinesPerSlide: snapshot.songLinesPerSlide,
    display: snapshot.display,
    liveScripture: snapshot.liveScripture,
    transcription: snapshot.transcription,
    activeAlert: snapshot.activeAlert,
    uiThemeMode: snapshot.uiThemeMode,
  });
  applyingRemote = false;
}

function flush() {
  if (applyingRemote) return;
  window.BSP?.store?.broadcast?.(sanitizeForIpc(takeSnapshot()));
}

export function useStoreSync() {
  useEffect(() => {
    if (!window.BSP?.store?.broadcast) return;

    const unsubStore = useAppStore.subscribe(() => {
      if (applyingRemote) return;
      window.clearTimeout(timer);
      timer = setTimeout(flush, 40);
    });

    const unsubRemote = window.BSP.store.onRemote?.((snapshot) => {
      if (!snapshot) return;
      applySnapshot(snapshot);
    });

    const unsubRequest = window.BSP.store.onSyncRequest?.(() => {
      window.clearTimeout(timer);
      flush();
    });

    window.BSP.store.requestSync?.();

    return () => {
      window.clearTimeout(timer);
      unsubStore();
      unsubRemote?.();
      unsubRequest?.();
    };
  }, []);
}
