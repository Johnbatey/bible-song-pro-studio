import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
  Scene, Theme, Song, BibleVersion, BibleVerse,
  DisplayState, AIProvider, TranscriptionState, Alert, LiveScriptureState, AudioInputDevice,
  OperatingMode, QueueItem, PresentationDeck, Workspace, StandbyMedia, Background,
  FxAnimationSettings
} from '../types';
import { createDefaultTheme } from '../utils/defaultTheme';
import { parseBackgroundInfo } from '../utils/background';
import { sanitizeForIpc } from '../utils/sanitize-ipc';
import { mediaGenlock } from '../utils/mediaGenlock';
import { setUiLocale as applyUiLocale, isUiLocale, detectUiLocale, type UiLocale } from '../../i18n';

/**
 * Persisted slices live in a JSON file under the app's userData dir (via store:* IPC),
 * falling back to localStorage when running in a plain browser (`npm run dev`).
 */
let _alertTimer: any = null;

const bspStorage: StateStorage = {
  getItem: async (name) => {
    try {
      if (window.BSP?.store) {
        const result = await window.BSP.store.load().catch(() => null);
        if (result && typeof result.state === 'string' && result.state.trim().length > 0) {
          // Validate it can be parsed as JSON before Zustand tries to deserialize it
          JSON.parse(result.state);
          return result.state;
        }
        return null;
      }
      const item = localStorage.getItem(name);
      if (item && typeof item === 'string' && item.trim().length > 0) {
        JSON.parse(item);
        return item;
      }
      return null;
    } catch (err) {
      console.warn('[appStore] Persisted store read failed or was corrupted; starting with fresh defaults:', err);
      return null;
    }
  },
  setItem: async (name, value) => {
    let payload = value;
    try {
      payload = JSON.stringify(sanitizeForIpc(JSON.parse(value)));
    } catch { /* keep the original string */ }
    try {
      if (window.BSP?.store) {
        await window.BSP.store.save(payload).catch(() => {});
        return;
      }
      localStorage.setItem(name, payload);
    } catch (err) {
      console.warn('[appStore] Persisted store write failed:', err);
    }
  },
  removeItem: async (name) => {
    try {
      if (window.BSP?.store) {
        await window.BSP.store.clear().catch(() => {});
        return;
      }
      localStorage.removeItem(name);
    } catch (err) {
      console.warn('[appStore] Persisted store remove failed:', err);
    }
  },
};

/* Older builds stored a scene's media as a fully-qualified
   http://localhost:8942/media/… URL, which pinned the saved library to whatever
   port the asset server happened to hold that day. The port can now move when
   one is taken, so those are rewritten back to the server-relative form on load
   and resolved against the live origin at render time.

   127.0.0.1 as well as localhost, because the operator window and the display
   windows have not always agreed on which one they used. */
const PINNED_MEDIA_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?=\/)/i;

function unpinSceneMedia(scenes: Scene[] | undefined): Scene[] | undefined {
  if (!scenes) return scenes;
  let changed = false;
  const next = scenes.map((scene) => {
    const url = scene.background?.mediaUrl;
    if (!url || !PINNED_MEDIA_ORIGIN.test(url)) return scene;
    changed = true;
    return { ...scene, background: { ...scene.background!, mediaUrl: url.replace(PINNED_MEDIA_ORIGIN, '') } };
  });
  // Same array when nothing matched, so a library with no imported media is
  // not needlessly replaced on every start.
  return changed ? next : scenes;
}

/* A projected slide travels with its scene so every display can paint the
   design, which for an imported PowerPoint slide means every image on it as a
   base64 data URL. That is fine in memory and over IPC, and ruinous in
   localStorage: a service's worth of scenes would blow the quota and take the
   whole library down with it. The saved scene keeps its text; re-firing one
   after a restart projects the text, and reopening the deck projects the
   slide again. */
function sceneWithoutSlide(scene: Scene): Scene {
  if (!scene.content?.slide) return scene;
  const { slide: _slide, ...content } = scene.content;
  return { ...scene, content };
}

interface AppState {
  // App state
  isLoaded: boolean;
  platform: string;

  // Display
  display: DisplayState;
  setMode: (mode: OperatingMode) => void;
  /**
   * The single entry point every panel uses to put something on screen.
   * Studio routes to preview; basic goes straight to program. `direct` (double-click)
   * always goes straight to program.
   */
  projectScene: (scene: Scene, opts?: { direct?: boolean }) => void;
  /** Studio: send what's in preview to the audience. */
  takeToProgram: (transition?: boolean) => void;
  setOutputMode: (mode: 'fullscreen' | 'lowerThird') => void;
  setBibleOutputMode: (mode: 'fullscreen' | 'lowerThird') => void;
  setSongOutputMode: (mode: 'fullscreen' | 'lowerThird') => void;
  setOutputStatus: (status: Partial<DisplayState['outputStatus']>) => void;
  setCurrentScene: (scene: Scene | null) => void;
  setPreviewScene: (scene: Scene | null) => void;
  setIsTransitioning: (v: boolean) => void;
  setExternalDisplay: (v: boolean) => void;
  /** BLACK. `undefined` toggles. */
  setBlackout: (v?: boolean) => void;
  setVideoPlaying: (playing: boolean) => void;
  seekVideo: (seconds: number) => void;
  restartVideo: () => void;
  stepVideo: (deltaSeconds: number) => void;
  stopVideo: () => void;
  setVideoSpeed: (speed: number) => void;
  setVideoTransportTarget: (target: 'program' | 'preview' | null, sourceId?: string) => void;
  reportVideoClock: (clock: { currentTime: number; duration: number }) => void;
  setVideoLoop: (loop: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  cutToScene: (scene: Scene) => void;
  transitionToScene: (scene: Scene, transitionType?: string) => void;
  /** Clear Program (and matching Preview) so the output returns to standby. */
  clearProgram: () => void;

  // Scenes
  scenes: Scene[];
  addScene: (scene: Scene) => void;
  removeScene: (id: string) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  reorderScenes: (from: number, to: number) => void;

  // FX Animation
  fxSettings: FxAnimationSettings;
  setFxSettings: (settings: Partial<FxAnimationSettings> | ((prev: FxAnimationSettings) => Partial<FxAnimationSettings>)) => void;
  slideFxSettings: FxAnimationSettings;
  setSlideFxSettings: (settings: Partial<FxAnimationSettings> | ((prev: FxAnimationSettings) => Partial<FxAnimationSettings>)) => void;
  setStageDisplayFxEnabled: (enabled: boolean) => void;

  // Themes & Bible Ground
  bibleBackground?: Background;
  setBibleBackground: (bg?: Background) => void;
  isThemeFsLtLinked: boolean;
  setIsThemeFsLtLinked: (linked: boolean, activeMode?: 'fullscreen' | 'lowerThird') => void;
  toggleThemeFsLtLinked: (activeMode?: 'fullscreen' | 'lowerThird') => void;
  setThemeBackground: (bg: Background, mode: 'fullscreen' | 'lowerThird') => void;
  isThemeStudioOpen: boolean;
  themeStudioInitialOptions?: {
    contentMode?: 'bible' | 'song';
    surfaceTab?: 'full' | 'lt';
  } | null;
  openThemeStudio: (options?: { contentMode?: 'bible' | 'song'; surfaceTab?: 'full' | 'lt' }) => void;
  closeThemeStudio: () => void;

  themes: Theme[];
  activeTheme: Theme | null;
  liveTheme?: Theme | null;
  setActiveTheme: (theme: Theme | null) => void;
  commitThemeToLive: () => void;
  addTheme: (theme: Theme) => void;
  setThemes: (themes: Theme[]) => void;
  updateTheme: (id: string, updates: Partial<Theme>) => void;
  removeTheme: (id: string) => void;

  // Songs
  songs: Song[];
  showSongCredits: boolean;
  /** Shared by the Songs panel and Live's song mode so the two agree. */
  songLinesPerSlide: number | 'auto';
  setSongLinesPerSlide: (value: number | 'auto') => void;
  addSong: (song: Song) => void;
  removeSong: (id: string) => void;
  removeSongs: (ids: string[]) => void;
  updateSong: (id: string, updates: Partial<Song>) => void;
  setSongs: (songs: Song[]) => void;
  setShowSongCredits: (show: boolean) => void;

  /**
   * Whether an idle audience screen shows the "Bible Song Pro / Waiting for
   * signal" card. Off leaves it plain black, which is what a congregation
   * should see between items.
   */
  showStandbyBrand: boolean;
  setShowStandbyBrand: (show: boolean) => void;
  standbyMedia: StandbyMedia | null;
  setStandbyMedia: (media: StandbyMedia | null) => void;

  // Bible
  bibleVersions: BibleVersion[];
  currentBibleVersion: BibleVersion | null;
  verseHistory: BibleVerse[];
  setBibleVersions: (versions: BibleVersion[]) => void;
  setCurrentBibleVersion: (version: BibleVersion | null) => void;
  addVerseToHistory: (verse: BibleVerse) => void;

  // Queue
  queue: QueueItem[];
  addToQueue: (item: Omit<QueueItem, 'id' | 'timestamp'>) => void;
  insertIntoQueue: (item: Omit<QueueItem, 'id' | 'timestamp'>, atIndex?: number) => void;
  updateQueueItem: (id: string, patch: Partial<QueueItem>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  setQueue: (items: QueueItem[]) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  // AI / Transcription
  aiProviders: AIProvider[];
  transcription: TranscriptionState;
  liveScripture: LiveScriptureState;
  audioInputDevices: AudioInputDevice[];
  syncTranscriptWithLive: boolean;
  setAIProvider: (id: string, updates: Partial<AIProvider>) => void;
  setTranscription: (state: Partial<TranscriptionState>) => void;
  setLiveScripture: (state: Partial<LiveScriptureState>) => void;
  setAudioInputDevices: (devices: AudioInputDevice[]) => void;
  setSyncTranscriptWithLive: (enabled: boolean) => void;

  // Alerts
  alerts: Alert[];
  activeAlert: Alert | null;
  triggerAlert: (alert: Alert) => void;
  dismissAlert: () => void;
  notices: Alert[];
  /** Post an operator notice. Never leaves this window. */
  notify: (notice: Alert) => void;
  dismissNotice: (id: string) => void;

  // UI State
  openDockIds: string[];
  poppedOutDockIds: string[];
  setPoppedOutDockIds: (ids: string[]) => void;
  setOpenDockIds: (ids: string[]) => void;

  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  saveWorkspace: (name: string, layout: unknown) => Workspace;
  updateWorkspace: (id: string, layout: unknown) => void;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string | null) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  activeSettingsCategory: string;
  openSettings: (category?: string) => void;
  closeSettings: () => void;

  isShortcutsOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  toggleShortcuts: () => void;

  isSlideEditorOpen: boolean;
  activePresentationId: string | null;
  presentationDecks: PresentationDeck[];
  openSlideEditor: (id?: string) => void;
  closeSlideEditor: () => void;
  setPresentationDecks: (decks: PresentationDeck[]) => void;
  updatePresentationDeck: (id: string, updates: Partial<PresentationDeck>) => void;
  addPresentationDeck: (deck: PresentationDeck) => void;
  deletePresentationDeck: (id: string) => void;

  uiThemeMode: 'dark' | 'light';
  isThemeTransitioning: boolean;
  themeTransitionTarget: 'dark' | 'light';
  setUIThemeMode: (mode: 'dark' | 'light') => void;
  toggleUIThemeMode: () => void;

  isWorkspaceLocked: boolean;
  setIsWorkspaceLocked: (locked: boolean) => void;
  toggleWorkspaceLocked: () => void;
  doubleClickToGoLive: boolean;
  setDoubleClickToGoLive: (enabled: boolean) => void;

  /** Operator console language (menus / chrome). Independent of sermonLanguage. */
  uiLocale: UiLocale;
  setUiLocale: (locale: UiLocale) => void;
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  isLoaded: false,
  platform: 'darwin',

  display: {
    mode: 'basic',
    outputMode: 'fullscreen',
    bibleOutputMode: 'fullscreen',
    songOutputMode: 'fullscreen',
    outputStatus: {
      isOpen: false,
      url: '',
      clients: 0,
      updatedAt: 0,
    },
    currentScene: null,
    previewScene: null,
    isTransitioning: false,
    isExternalDisplayActive: false,
    videoTransport: { target: null, playing: true, seekTo: null, seekNonce: 0 },
    videoClock: { currentTime: 0, duration: 0 },
    blackout: false,
  },

  setMode: (mode) => set((s) => ({
    display: { ...s.display, mode },
    liveTheme: mode === 'basic' ? (s.activeTheme ? { ...s.activeTheme } : null) : (s.liveTheme || s.activeTheme),
  })),
  setBibleOutputMode: (bibleOutputMode) =>
    set((s) => ({
      display: {
        ...s.display,
        bibleOutputMode,
        outputMode: s.display.currentScene?.type === 'bible' || s.display.previewScene?.type === 'bible'
          ? bibleOutputMode
          : s.display.outputMode,
      },
    })),
  setSongOutputMode: (songOutputMode) =>
    set((s) => ({
      display: {
        ...s.display,
        songOutputMode,
        outputMode: s.display.currentScene?.type === 'song' || s.display.previewScene?.type === 'song'
          ? songOutputMode
          : s.display.outputMode,
      },
    })),
  setOutputMode: (outputMode) =>
    set((s) => {
      const activeType = s.display.previewScene?.type || s.display.currentScene?.type;
      return {
        display: {
          ...s.display,
          outputMode,
          ...(activeType === 'bible' ? { bibleOutputMode: outputMode } : {}),
          ...(activeType === 'song' ? { songOutputMode: outputMode } : {}),
        },
      };
    }),
  setOutputStatus: (status) => set((s) => ({ display: { ...s.display, outputStatus: { ...s.display.outputStatus, ...status } } })),
  setCurrentScene: (scene) => set((s) => ({ display: { ...s.display, currentScene: scene } })),
  setPreviewScene: (scene) => set((s) => ({ display: { ...s.display, previewScene: scene } })),
  setIsTransitioning: (v) => set((s) => ({ display: { ...s.display, isTransitioning: v } })),
  setExternalDisplay: (v) => set((s) => ({ display: { ...s.display, isExternalDisplayActive: v } })),
  setBlackout: (v) =>
    set((s) => ({ display: { ...s.display, blackout: v === undefined ? !s.display.blackout : v } })),

  /* ── Video transport ────────────────────────────────────────────────── */
  setVideoPlaying: (playing) => {
    const transport = get().display.videoTransport;
    const sourceId = transport.sourceId || (transport.target === 'program' ? 'program-bg-video' : 'program-bg-video');
    mediaGenlock.broadcastCommand(
      sourceId,
      playing ? 'play' : 'pause',
      { playing, currentTime: get().display.videoClock.currentTime }
    );
    set((s) => ({ display: { ...s.display, videoTransport: { ...s.display.videoTransport, playing } } }));
  },
  seekVideo: (seconds) => {
    const transport = get().display.videoTransport;
    const sourceId = transport.sourceId || (transport.target === 'program' ? 'program-bg-video' : 'program-bg-video');
    mediaGenlock.broadcastCommand(
      sourceId,
      'seek',
      { currentTime: seconds, playing: transport.playing }
    );
    set((s) => ({
      display: {
        ...s.display,
        videoClock: { ...s.display.videoClock, currentTime: seconds },
        videoTransport: {
          ...s.display.videoTransport,
          seekTo: seconds,
          seekNonce: s.display.videoTransport.seekNonce + 1,
        },
      },
    }));
  },
  restartVideo: () => {
    const transport = get().display.videoTransport;
    const sourceId = transport.sourceId || (transport.target === 'program' ? 'program-bg-video' : 'program-bg-video');
    mediaGenlock.broadcastCommand(
      sourceId,
      'restart',
      { currentTime: 0, playing: true }
    );
    set((s) => ({
      display: {
        ...s.display,
        videoClock: { ...s.display.videoClock, currentTime: 0 },
        videoTransport: {
          ...s.display.videoTransport,
          playing: true,
          seekTo: 0,
          seekNonce: s.display.videoTransport.seekNonce + 1,
        },
      },
    }));
  },
  stepVideo: (deltaSeconds) => {
    const clock = get().display.videoClock;
    const dur = clock.duration || 0;
    const target = Math.max(0, Math.min(dur > 0 ? dur : Infinity, clock.currentTime + deltaSeconds));
    get().seekVideo(target);
  },
  stopVideo: () => {
    const transport = get().display.videoTransport;
    const sourceId = transport.sourceId || (transport.target === 'program' ? 'program-bg-video' : 'program-bg-video');
    mediaGenlock.broadcastCommand(
      sourceId,
      'stop',
      { currentTime: 0, playing: false }
    );
    set((s) => ({
      display: {
        ...s.display,
        videoClock: { ...s.display.videoClock, currentTime: 0 },
        videoTransport: {
          ...s.display.videoTransport,
          playing: false,
          seekTo: 0,
          seekNonce: s.display.videoTransport.seekNonce + 1,
        },
      },
    }));
  },
  setVideoSpeed: (speed) => {
    const transport = get().display.videoTransport;
    const sourceId = transport.sourceId || (transport.target === 'program' ? 'program-bg-video' : 'program-bg-video');
    mediaGenlock.broadcastCommand(
      sourceId,
      'speed',
      { playbackRate: speed }
    );
    set((s) => ({
      display: {
        ...s.display,
        videoTransport: {
          ...s.display.videoTransport,
          speed,
        },
      },
    }));
  },
  setVideoTransportTarget: (target, sourceId) =>
    set((s) => {
      if (s.display.videoTransport.target === target && s.display.videoTransport.sourceId === sourceId) return s;
      const scene = target === 'program' ? s.display.currentScene : target === 'preview' ? s.display.previewScene : null;
      const initialMuted = Boolean(scene?.background?.muted);
      return {
        display: {
          ...s.display,
          videoClock: { currentTime: 0, duration: 0 },
          videoTransport: { target, sourceId, playing: true, seekTo: null, seekNonce: 0, muted: initialMuted },
        },
      };
    }),
  setVideoLoop: (loop) =>
    set((s) => {
      const target = s.display.videoTransport.target;
      if (!target) return s;
      const key = target === 'program' ? 'currentScene' : 'previewScene';
      const scene = s.display[key];
      if (!scene?.background) return s;
      const next = { ...scene, background: { ...scene.background, loop } };
      return {
        display: { ...s.display, [key]: next },
        scenes: s.scenes.map((sc) => (sc.id === next.id ? next : sc)),
      };
    }),
  setVideoMuted: (muted) =>
    set((s) => {
      const target = s.display.videoTransport.target;
      const updatedTransport = {
        ...s.display.videoTransport,
        muted,
      };
      if (!target) {
        return { display: { ...s.display, videoTransport: updatedTransport } };
      }
      const key = target === 'program' ? 'currentScene' : 'previewScene';
      const scene = s.display[key];
      if (!scene?.background) {
        return { display: { ...s.display, videoTransport: updatedTransport } };
      }
      const next = { ...scene, background: { ...scene.background, muted } };
      return {
        display: { ...s.display, [key]: next, videoTransport: updatedTransport },
        scenes: s.scenes.map((sc) => (sc.id === next.id ? next : sc)),
      };
    }),

  reportVideoClock: (clock) =>
    set((s) => (
      Math.abs(s.display.videoClock.currentTime - clock.currentTime) < 0.05 &&
      s.display.videoClock.duration === clock.duration
        ? s
        : { display: { ...s.display, videoClock: clock } }
    )),

  cutToScene: (scene) => {
    set((s) => ({
      display: {
        ...s.display,
        currentScene: scene,
        previewScene: scene,
        isTransitioning: false,
      },
      liveTheme: s.activeTheme ? { ...s.activeTheme } : null,
    }));
  },

  clearProgram: () => {
    set((s) => {
      const curId = s.display.currentScene?.id;
      const previewMatches = Boolean(curId && s.display.previewScene?.id === curId);
      return {
        display: {
          ...s.display,
          currentScene: null,
          previewScene: previewMatches ? null : s.display.previewScene,
          isTransitioning: false,
        },
      };
    });
  },

  projectScene: (scene, opts = {}) => {
    const { display, fxSettings } = get();
    const effectiveScene = scene.transition ? scene : {
      ...scene,
      transition: {
        type: fxSettings?.transitionType || 'fade',
        duration: fxSettings?.duration || 0.4,
        easing: 'ease',
        animateBackground: fxSettings?.animateBackground ?? false,
      },
      animateBackground: scene.animateBackground ?? fxSettings?.animateBackground ?? false,
    };

    // Keep it in the scene list so it can be re-fired later
    if (!get().scenes.some((s) => s.id === effectiveScene.id)) get().addScene(effectiveScene);

    if (opts.direct || display.mode === 'basic') {
      // Straight to the audience. Preview follows so the two panes agree.
      set((s) => ({
        display: { ...s.display, currentScene: effectiveScene, previewScene: effectiveScene, isTransitioning: false },
        liveTheme: s.activeTheme ? { ...s.activeTheme } : null,
      }));
      return;
    }
    // Studio: stage it only — nothing changes on the audience display until Take.
    set((s) => ({ display: { ...s.display, previewScene: effectiveScene } }));
  },

  takeToProgram: (transition = false) => {
    const { display } = get();
    const scene = display.previewScene;
    if (!scene) return;
    set((s) => ({ liveTheme: s.activeTheme ? { ...s.activeTheme } : null }));
    if (transition) get().transitionToScene(scene);
    else get().cutToScene(scene);
  },

  transitionToScene: (scene, transitionType = 'fade') => {
    set((s) => ({
      display: {
        ...s.display,
        currentScene: scene,
        previewScene: scene,
        isTransitioning: true,
      },
      liveTheme: s.activeTheme ? { ...s.activeTheme } : null,
    }));
    setTimeout(() => {
      set((s) => ({
        display: {
          ...s.display,
          isTransitioning: false,
        },
      }));
    }, 350);
  },

  scenes: [],
  addScene: (scene) => set((s) => ({ scenes: [...s.scenes, scene] })),
  removeScene: (id) => set((s) => ({ scenes: s.scenes.filter((sc) => sc.id !== id) })),
  updateScene: (id, updates) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, ...updates } : sc)),
    })),
  reorderScenes: (from, to) =>
    set((s) => {
      const scenes = [...s.scenes];
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      return { scenes };
    }),

  bibleBackground: (() => {
    try {
      const saved = localStorage.getItem('bsp_bible_background');
      return saved ? JSON.parse(saved) : undefined;
    } catch {
      return undefined;
    }
  })(),
  setBibleBackground: (bibleBackground) => {
    try {
      if (bibleBackground) localStorage.setItem('bsp_bible_background', JSON.stringify(bibleBackground));
      else localStorage.removeItem('bsp_bible_background');
    } catch {}
    set((s) => {
      const updates: Partial<AppState> = { bibleBackground };
      if (s.display.currentScene?.type === 'bible') {
        updates.display = {
          ...s.display,
          currentScene: {
            ...s.display.currentScene,
            background: bibleBackground,
          },
        };
      }
      return updates;
    });
  },
  isThemeFsLtLinked: true,
  setIsThemeFsLtLinked: (linked, activeMode) => {
    if (!linked) {
      set({ isThemeFsLtLinked: false });
      return;
    }
    useAppStore.getState().toggleThemeFsLtLinked(activeMode);
  },
  toggleThemeFsLtLinked: (activeMode) => {
    set((s) => {
      const nextLinked = !s.isThemeFsLtLinked;
      if (!nextLinked) {
        return { isThemeFsLtLinked: false };
      }

      // Transitioning to linked:
      // Match the other mode's background to that of the active mode!
      const currentMode = activeMode || (s.display.outputMode === 'lowerThird' || s.display.bibleOutputMode === 'lowerThird' ? 'lowerThird' : 'fullscreen');

      const theme = s.activeTheme ? { ...s.activeTheme } : createDefaultTheme();
      const lt = { ...theme.lowerThird };

      if (currentMode === 'fullscreen') {
        // Copy Fullscreen background settings to Lower-Third
        const fs = theme.fullScreen;
        const isFsTransparent = fs.backgroundType === 'transparent' || fs.background === 'transparent' || fs.backgroundColor === 'transparent';
        lt.background = isFsTransparent ? 'transparent' : (fs.background || '');
        lt.backgroundColor = isFsTransparent ? 'transparent' : (fs.backgroundColor || '#000000');
        lt.backgroundType = isFsTransparent ? 'transparent' : (fs.backgroundType || 'solid');
        lt.backgroundMediaUrl = isFsTransparent ? '' : fs.backgroundMediaUrl;
        lt.backgroundMediaType = isFsTransparent ? undefined : fs.backgroundMediaType;
        lt.backgroundFit = fs.backgroundFit;
        lt.backgroundLoop = fs.backgroundLoop;
        lt.backgroundOpacity = typeof fs.backgroundOpacity === 'number' ? fs.backgroundOpacity : 0.95;
        lt.savedSolidColor = fs.savedSolidColor;
        lt.savedGradientStart = fs.savedGradientStart;
        lt.savedGradientEnd = fs.savedGradientEnd;
        lt.savedGradientDir = fs.savedGradientDir;
        theme.lowerThird = lt;
        if (theme.songLowerThird) theme.songLowerThird = { ...theme.songLowerThird, ...lt };
        if (theme.bibleLowerThird) theme.bibleLowerThird = { ...theme.bibleLowerThird, ...lt };
      } else {
        // Copy Lower-Third background settings to Fullscreen
        const fs = { ...theme.fullScreen };
        const isLtTransparent = lt.backgroundType === 'transparent' || lt.background === 'transparent' || lt.backgroundColor === 'transparent';
        fs.background = isLtTransparent ? 'transparent' : (lt.background || '');
        fs.backgroundColor = isLtTransparent ? 'transparent' : (lt.backgroundColor || '#000000');
        fs.backgroundType = isLtTransparent ? 'transparent' : (lt.backgroundType || 'solid');
        fs.backgroundMediaUrl = isLtTransparent ? '' : lt.backgroundMediaUrl;
        fs.backgroundMediaType = isLtTransparent ? undefined : lt.backgroundMediaType;
        fs.backgroundFit = lt.backgroundFit;
        fs.backgroundLoop = lt.backgroundLoop;
        fs.backgroundOpacity = typeof lt.backgroundOpacity === 'number' ? lt.backgroundOpacity : 1;
        fs.savedSolidColor = lt.savedSolidColor;
        fs.savedGradientStart = lt.savedGradientStart;
        fs.savedGradientEnd = lt.savedGradientEnd;
        fs.savedGradientDir = lt.savedGradientDir;
        theme.fullScreen = fs;
        if (theme.songFullScreen) theme.songFullScreen = { ...theme.songFullScreen, ...fs };
        if (theme.bibleFullScreen) theme.bibleFullScreen = { ...theme.bibleFullScreen, ...fs };
      }

      const updatedThemes = s.themes.some((t) => t.id === theme.id)
        ? s.themes.map((t) => (t.id === theme.id ? theme : t))
        : [...s.themes, theme];

      return {
        isThemeFsLtLinked: true,
        activeTheme: theme,
        liveTheme: s.display.mode === 'studio' ? s.liveTheme : theme,
        themes: updatedThemes,
      };
    });
  },

  setThemeBackground: (bg: Background, mode: 'fullscreen' | 'lowerThird') => {
    set((s) => {
      const isStudio = s.display.mode === 'studio';
      const theme: Theme = s.activeTheme ? { ...s.activeTheme } : createDefaultTheme();
      const currentLive = s.liveTheme || (s.activeTheme ? { ...s.activeTheme } : createDefaultTheme());
      const liveTheme = isStudio ? currentLive : theme;
      const isLinked = s.isThemeFsLtLinked !== false;

      const convertBgToSurface = (existingSurface: any, newBg: Background) => {
        let backgroundType: string = newBg.type || 'solid';
        let background: string = existingSurface?.background || '';
        let backgroundColor: string = existingSurface?.backgroundColor || '';
        let backgroundMediaUrl: string = existingSurface?.backgroundMediaUrl || '';
        let backgroundMediaType: 'image' | 'video' | undefined = existingSurface?.backgroundMediaType;

        if (newBg.type === 'transparent') {
          backgroundType = 'transparent';
          background = 'transparent';
          backgroundColor = 'transparent';
          backgroundMediaUrl = '';
          backgroundMediaType = undefined;
        } else if (newBg.type === 'solid' || (newBg.type as string) === 'color') {
          backgroundType = 'solid';
          const color = newBg.color && newBg.color !== 'transparent' ? newBg.color : (existingSurface?.backgroundColor && existingSurface.backgroundColor !== 'transparent' ? existingSurface.backgroundColor : '#0f172a');
          background = color;
          backgroundColor = color;
          backgroundMediaUrl = '';
          backgroundMediaType = undefined;
        } else if (newBg.type === 'gradient') {
          backgroundType = 'gradient';
          const grad = newBg.gradient && newBg.gradient !== 'transparent' ? newBg.gradient : (existingSurface?.background && existingSurface.background.includes('gradient') ? existingSurface.background : 'linear-gradient(135deg, #0f172a, #312e81)');
          background = grad;
          backgroundColor = (grad ? parseBackgroundInfo(grad, undefined).start : undefined) || '#0f172a';
          backgroundMediaUrl = '';
          backgroundMediaType = undefined;
        } else if (newBg.type === 'image') {
          backgroundType = 'image';
          backgroundMediaType = 'image';
          backgroundMediaUrl = newBg.mediaUrl || existingSurface?.backgroundMediaUrl || '';
          background = '';
          backgroundColor = '#000000';
        } else if (newBg.type === 'video') {
          backgroundType = 'video';
          backgroundMediaType = 'video';
          backgroundMediaUrl = newBg.mediaUrl || existingSurface?.backgroundMediaUrl || '';
          background = '';
          backgroundColor = '#000000';
        }

        return {
          ...existingSurface,
          backgroundType,
          background,
          backgroundColor,
          backgroundMediaUrl,
          backgroundMediaType,
          backgroundFit: newBg.fit || existingSurface?.backgroundFit || 'cover',
          backgroundLoop: newBg.loop !== false,
          backgroundOpacity: typeof newBg.opacity === 'number' ? newBg.opacity : (existingSurface?.backgroundOpacity ?? 1),
        };
      };

      if (isLinked) {
        theme.fullScreen = convertBgToSurface(theme.fullScreen, bg);
        theme.lowerThird = convertBgToSurface(theme.lowerThird, bg);
        if (theme.songFullScreen) theme.songFullScreen = convertBgToSurface(theme.songFullScreen, bg);
        if (theme.songLowerThird) theme.songLowerThird = convertBgToSurface(theme.songLowerThird, bg);
        if (theme.bibleFullScreen) theme.bibleFullScreen = convertBgToSurface(theme.bibleFullScreen, bg);
        if (theme.bibleLowerThird) theme.bibleLowerThird = convertBgToSurface(theme.bibleLowerThird, bg);
      } else if (mode === 'lowerThird') {
        theme.lowerThird = convertBgToSurface(theme.lowerThird, bg);
        if (theme.songLowerThird) theme.songLowerThird = convertBgToSurface(theme.songLowerThird, bg);
        if (theme.bibleLowerThird) theme.bibleLowerThird = convertBgToSurface(theme.bibleLowerThird, bg);
      } else {
        theme.fullScreen = convertBgToSurface(theme.fullScreen, bg);
        if (theme.songFullScreen) theme.songFullScreen = convertBgToSurface(theme.songFullScreen, bg);
        if (theme.bibleFullScreen) theme.bibleFullScreen = convertBgToSurface(theme.bibleFullScreen, bg);
      }

      const updatedThemes = s.themes.map((t) => (t.id === theme.id ? theme : t));

      let displayUpdates = s.display;
      if (s.display.currentScene && (s.display.currentScene.type === 'song' || s.display.currentScene.type === 'bible')) {
        if (s.display.currentScene.background) {
          displayUpdates = {
            ...displayUpdates,
            currentScene: {
              ...s.display.currentScene,
              background: undefined,
            },
          };
        }
      }
      if (s.display.previewScene && (s.display.previewScene.type === 'song' || s.display.previewScene.type === 'bible')) {
        if (s.display.previewScene.background) {
          displayUpdates = {
            ...displayUpdates,
            previewScene: {
              ...s.display.previewScene,
              background: undefined,
            },
          };
        }
      }

      const cleanedSongs = s.songs.map((so) => so.background ? { ...so, background: undefined } : so);

      return {
        activeTheme: theme,
        liveTheme: isStudio ? liveTheme : theme,
        themes: updatedThemes.length > 0 ? updatedThemes : [theme],
        display: displayUpdates,
        songs: cleanedSongs,
      };
    });
  },

  isThemeStudioOpen: false,
  themeStudioInitialOptions: null,
  openThemeStudio: (options) => set({ isThemeStudioOpen: true, themeStudioInitialOptions: options || null }),
  closeThemeStudio: () => set({ isThemeStudioOpen: false, themeStudioInitialOptions: null }),

  fxSettings: {
    transitionType: 'fade',
    duration: 0.8,
    animateBackground: false,
    stageDisplayFxEnabled: true,
  },
  setFxSettings: (settings) =>
    set((s) => ({
      fxSettings: typeof settings === 'function' ? { ...s.fxSettings, ...settings(s.fxSettings) } : { ...s.fxSettings, ...settings },
    })),

  slideFxSettings: {
    transitionType: 'fade',
    duration: 0.5,
    animateBackground: false,
    stageDisplayFxEnabled: true,
  },
  setSlideFxSettings: (settings) =>
    set((s) => ({
      slideFxSettings: typeof settings === 'function' ? { ...s.slideFxSettings, ...settings(s.slideFxSettings) } : { ...s.slideFxSettings, ...settings },
    })),

  setStageDisplayFxEnabled: (enabled: boolean) =>
    set((s) => ({
      fxSettings: { ...s.fxSettings, stageDisplayFxEnabled: enabled },
      slideFxSettings: { ...s.slideFxSettings, stageDisplayFxEnabled: enabled },
    })),

  themes: [],
  activeTheme: createDefaultTheme(),
  liveTheme: createDefaultTheme(),
  commitThemeToLive: () => set((s) => ({ liveTheme: s.activeTheme ? { ...s.activeTheme } : null })),
  setActiveTheme: (theme) => set((s) => ({
    activeTheme: theme,
    liveTheme: s.display.mode === 'basic' ? (theme ? { ...theme } : null) : (s.liveTheme || s.activeTheme),
  })),
  addTheme: (theme) => set((s) => ({ themes: [...s.themes, theme] })),
  setThemes: (themes) => set({ themes }),
  updateTheme: (id, updates) =>
    set((s) => {
      const exists = s.themes.some((t) => t.id === id);
      const updatedThemes = exists
        ? s.themes.map((t) => (t.id === id ? { ...t, ...updates } : t))
        : [...s.themes, { id, ...updates } as Theme];
      const updatedActive = s.activeTheme?.id === id ? { ...s.activeTheme, ...updates } : s.activeTheme;
      const isStudio = s.display.mode === 'studio';

      let displayUpdates = s.display;
      if (!isStudio && s.display.currentScene && (s.display.currentScene.type === 'song' || s.display.currentScene.type === 'bible')) {
        if (s.display.currentScene.background) {
          displayUpdates = {
            ...displayUpdates,
            currentScene: {
              ...s.display.currentScene,
              background: undefined,
            },
          };
        }
      }
      if (s.display.previewScene && (s.display.previewScene.type === 'song' || s.display.previewScene.type === 'bible')) {
        if (s.display.previewScene.background) {
          displayUpdates = {
            ...displayUpdates,
            previewScene: {
              ...s.display.previewScene,
              background: undefined,
            },
          };
        }
      }

      return {
        themes: updatedThemes,
        activeTheme: updatedActive,
        liveTheme: isStudio ? s.liveTheme : updatedActive,
        display: displayUpdates,
      };
    }),
  removeTheme: (id) => set((s) => ({ themes: s.themes.filter((t) => t.id !== id) })),

  songs: [],
  showSongCredits: false,
  songLinesPerSlide: 'auto',
  addSong: (song) => set((s) => ({ songs: [...s.songs, song] })),
  removeSong: (id) => set((s) => ({ songs: s.songs.filter((so) => so.id !== id) })),
  removeSongs: (ids) => set((s) => {
    const idSet = new Set(ids);
    return { songs: s.songs.filter((so) => !idSet.has(so.id)) };
  }),
  updateSong: (id, updates) =>
    set((s) => ({
      songs: s.songs.map((so) => (so.id === id ? { ...so, ...updates } : so)),
    })),
  setSongs: (songs) => set({ songs }),
  setShowSongCredits: (showSongCredits) => set({ showSongCredits }),

  showStandbyBrand: true,
  setShowStandbyBrand: (showStandbyBrand) => set({ showStandbyBrand }),
  standbyMedia: null,
  setStandbyMedia: (standbyMedia) => set({ standbyMedia }),
  setSongLinesPerSlide: (songLinesPerSlide) => set({ songLinesPerSlide }),

  bibleVersions: [],
  currentBibleVersion: null,
  verseHistory: [],
  setBibleVersions: (versions) => set({ bibleVersions: versions }),
  setCurrentBibleVersion: (version) => set({ currentBibleVersion: version }),
  addVerseToHistory: (verse) =>
    set((s) => ({ verseHistory: [verse, ...s.verseHistory].slice(0, 100) })),

  queue: [],
  addToQueue: (item) =>
    set((s) => {
      const sceneId = item.scene?.id;
      const alreadyQueued = s.queue.some((q) => {
        if (sceneId && q.scene?.id === sceneId) return true;
        return q.type === item.type && q.reference === item.reference && q.text === item.text;
      });
      if (alreadyQueued) return s;
      return {
        queue: [
          ...s.queue,
          {
            ...item,
            id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
          },
        ],
      };
    }),
  insertIntoQueue: (item, atIndex) =>
    set((s) => {
      const newItem: QueueItem = {
        ...item,
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
      };
      const updated = [...s.queue];
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= updated.length) {
        updated.splice(atIndex, 0, newItem);
      } else {
        updated.push(newItem);
      }
      return { queue: updated };
    }),
  updateQueueItem: (id, patch) =>
    set((s) => ({
      queue: s.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    })),
  removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
  clearQueue: () => set({ queue: [] }),
  setQueue: (items) => set({ queue: items }),
  reorderQueue: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex < 0 || fromIndex >= s.queue.length || toIndex < 0 || toIndex >= s.queue.length || fromIndex === toIndex) {
        return s;
      }
      const updated = [...s.queue];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { queue: updated };
    }),

  aiProviders: [
    { id: 'deepgram', name: 'Deepgram Nova-2', type: 'deepgram', enabled: true },
    { id: 'local', name: 'Local AI (On-Device)', type: 'local', enabled: true },
  ],
  transcription: {
    isActive: false,
    provider: null,
    text: '',
    interimText: '',
    confidence: 0,
  },
  liveScripture: {
    isActive: false,
    detectionMode: 'bible',
    provider: 'deepgram',
    selectedInputId: '',
    transcript: '',
    bestHit: null,
    suggestions: [],
    autoProject: true,
    autoVersionSwitch: true,
    autoProjectQuoted: false,
    syncBibleOnDetection: true,
    allowParaphrase: true,
    requestedVersion: null,
    meter: {
      level: 0,
      peak: 0,
      isMonitoring: false,
    },
  },
  audioInputDevices: [],
  syncTranscriptWithLive: true,
  setAIProvider: (id, updates) =>
    set((s) => ({
      aiProviders: s.aiProviders.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  setTranscription: (state) =>
    set((s) => ({ transcription: { ...s.transcription, ...state } })),
  setLiveScripture: (state) =>
    set((s) => ({ liveScripture: { ...s.liveScripture, ...state } })),
  setAudioInputDevices: (devices) => set({ audioInputDevices: devices }),
  setSyncTranscriptWithLive: (syncTranscriptWithLive) => set({ syncTranscriptWithLive }),

  alerts: [],
  activeAlert: null,
  triggerAlert: (alert) => {
    if (_alertTimer) clearTimeout(_alertTimer);
    set({ activeAlert: alert });
    try {
      if (window.BSP?.display?.sendState) {
        window.BSP.display.sendState({ activeAlert: alert });
      }
    } catch (_) {}
    let durationMs = 0;
    const speed = alert.speed || 1;
    const singleLoopSec = 16 / speed;
    if (alert.cycles && alert.cycles > 0) {
      durationMs = alert.cycles * singleLoopSec * 1000;
    } else if (alert.duration) {
      const sec = alert.duration;
      durationMs = sec > 100 ? sec : sec * 1000;
    }
    if (durationMs > 0 && durationMs < 86400000) {
      _alertTimer = setTimeout(() => {
        set({ activeAlert: null });
        try {
          if (window.BSP?.display?.sendState) {
            window.BSP.display.sendState({ activeAlert: null });
          }
        } catch (_) {}
      }, durationMs);
    }
  },
  dismissAlert: () => {
    if (_alertTimer) clearTimeout(_alertTimer);
    set({ activeAlert: null });
    try {
      if (window.BSP?.display?.sendState) {
        window.BSP.display.sendState({ activeAlert: null });
      }
    } catch (_) {}
  },
  notices: [],
  notify: (notice) =>
    set((s) => ({
      notices: [...s.notices.filter((n) => n.id !== notice.id), notice].slice(-4),
    })),
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

  openDockIds: [],
  poppedOutDockIds: [],
  setPoppedOutDockIds: (ids) => set((s) => (
    s.poppedOutDockIds.length === ids.length && ids.every((id, i) => s.poppedOutDockIds[i] === id)
      ? s
      : { poppedOutDockIds: ids }
  )),
  setOpenDockIds: (ids) => set((s) => (
    s.openDockIds.length === ids.length && ids.every((id, i) => s.openDockIds[i] === id)
      ? s
      : { openDockIds: ids }
  )),
  workspaces: [],
  activeWorkspaceId: null,
  saveWorkspace: (name, layout) => {
    const now = Date.now();
    const workspace: Workspace = {
      id: `ws-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      layout,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ workspaces: [...s.workspaces, workspace], activeWorkspaceId: workspace.id }));
    return workspace;
  },
  updateWorkspace: (id, layout) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, layout, updatedAt: Date.now() } : w)),
    })),
  renameWorkspace: (id, name) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name, updatedAt: Date.now() } : w)),
    })),
  deleteWorkspace: (id) =>
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
    })),
  setActiveWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  isSettingsOpen: false,
  activeSettingsCategory: 'output',
  openSettings: (category) => set((s) => ({ isSettingsOpen: true, activeSettingsCategory: category || s.activeSettingsCategory || 'output' })),
  closeSettings: () => set({ isSettingsOpen: false }),

  isShortcutsOpen: false,
  openShortcuts: () => set({ isShortcutsOpen: true }),
  closeShortcuts: () => set({ isShortcutsOpen: false }),
  toggleShortcuts: () => set((s) => ({ isShortcutsOpen: !s.isShortcutsOpen })),

  isSlideEditorOpen: false,
  activePresentationId: null,
  presentationDecks: [],
  openSlideEditor: (id) => set({ isSlideEditorOpen: true, activePresentationId: id || null }),
  closeSlideEditor: () => set({ isSlideEditorOpen: false, activePresentationId: null }),
  setPresentationDecks: (presentationDecks) => set({ presentationDecks }),
  updatePresentationDeck: (id, updates) =>
    set((s) => ({
      presentationDecks: s.presentationDecks.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d)),
    })),
  addPresentationDeck: (deck) =>
    set((s) => ({
      presentationDecks: [...s.presentationDecks.filter((d) => d.id !== deck.id), deck],
    })),
  deletePresentationDeck: (id) =>
    set((s) => ({
      presentationDecks: s.presentationDecks.filter((d) => d.id !== id),
    })),

  uiThemeMode: 'dark',
  isThemeTransitioning: false,
  themeTransitionTarget: 'light',
  setUIThemeMode: (uiThemeMode) => {
    document.documentElement.setAttribute('data-ui-theme', uiThemeMode);
    if (uiThemeMode === 'light') {
      document.documentElement.setAttribute('data-bsp-surface', 'paper');
      document.body.classList.add('light-theme');
    } else {
      document.documentElement.removeAttribute('data-bsp-surface');
      document.body.classList.remove('light-theme');
    }
    try {
      localStorage.setItem('bsp_theme_mode', uiThemeMode);
    } catch {}
    set({ uiThemeMode });
  },
  toggleUIThemeMode: () => {
    const current = get().uiThemeMode;
    const next = current === 'dark' ? 'light' : 'dark';

    // Trigger brand signature curtain animation first
    set({ isThemeTransitioning: true, themeTransitionTarget: next });

    // Swap actual DOM theme state right at the peak of the Cue Wipe cover (260ms)
    setTimeout(() => {
      get().setUIThemeMode(next);
    }, 260);
  },

  isWorkspaceLocked: false,
  setIsWorkspaceLocked: (isWorkspaceLocked) => set({ isWorkspaceLocked }),
  toggleWorkspaceLocked: () => set((s) => ({ isWorkspaceLocked: !s.isWorkspaceLocked })),
  doubleClickToGoLive: true,
  setDoubleClickToGoLive: (doubleClickToGoLive) => set({ doubleClickToGoLive }),

  uiLocale: typeof navigator !== 'undefined' ? detectUiLocale() : 'en',
  setUiLocale: (uiLocale) => {
    applyUiLocale(uiLocale);
    set({ uiLocale });
  },
}), {
  name: 'bsp-app-state',
  version: 1,
  storage: createJSONStorage(() => bspStorage),

  partialize: (state) => ({
    scenes: state.scenes.map(sceneWithoutSlide),
    presentationDecks: state.presentationDecks,
    songLinesPerSlide: state.songLinesPerSlide,
    songs: state.songs,
    themes: state.themes,
    activeTheme: state.activeTheme,
    verseHistory: state.verseHistory,
    currentBibleVersion: state.currentBibleVersion,
    sidebarOpen: state.sidebarOpen,
    showStandbyBrand: state.showStandbyBrand,
    standbyMedia: state.standbyMedia,
    workspaces: state.workspaces,
    activeWorkspaceId: state.activeWorkspaceId,
    isWorkspaceLocked: state.isWorkspaceLocked,
    doubleClickToGoLive: state.doubleClickToGoLive,
    outputMode: state.display.outputMode,
    bibleOutputMode: state.display.bibleOutputMode ?? 'fullscreen',
    songOutputMode: state.display.songOutputMode ?? 'fullscreen',
    operatingMode: state.display.mode,
    syncTranscriptWithLive: state.syncTranscriptWithLive,
    liveScripturePrefs: {
      detectionMode: state.liveScripture.detectionMode,
      provider: state.liveScripture.provider,
      selectedInputId: state.liveScripture.selectedInputId,
      autoProject: state.liveScripture.autoProject,
      autoVersionSwitch: state.liveScripture.autoVersionSwitch,
      autoProjectQuoted: state.liveScripture.autoProjectQuoted,
      syncBibleOnDetection: state.liveScripture.syncBibleOnDetection ?? true,
    },
    uiLocale: state.uiLocale,
    uiThemeMode: state.uiThemeMode,
    fxSettings: state.fxSettings,
    slideFxSettings: state.slideFxSettings,
  }),

  onRehydrateStorage: () => (state) => {
    if (state?.uiLocale && isUiLocale(state.uiLocale)) {
      applyUiLocale(state.uiLocale);
    }
    if (state?.uiThemeMode) {
      document.documentElement.setAttribute('data-ui-theme', state.uiThemeMode);
      if (state.uiThemeMode === 'light') {
        document.documentElement.setAttribute('data-bsp-surface', 'paper');
        document.body.classList.add('light-theme');
      } else {
        document.documentElement.removeAttribute('data-bsp-surface');
        document.body.classList.remove('light-theme');
      }
      try {
        localStorage.setItem('bsp_theme_mode', state.uiThemeMode);
      } catch {}
    }
  },

  merge: (persisted, current) => {
    try {
      if (!persisted || typeof persisted !== 'object') {
        return current;
      }
      const saved = persisted as Partial<PersistedState>;
      const nextTheme = saved.uiThemeMode === 'light' ? 'light' : (saved.uiThemeMode === 'dark' ? 'dark' : current.uiThemeMode);
      document.documentElement.setAttribute('data-ui-theme', nextTheme);
      if (nextTheme === 'light') {
        document.documentElement.setAttribute('data-bsp-surface', 'paper');
        document.body.classList.add('light-theme');
      } else {
        document.documentElement.removeAttribute('data-bsp-surface');
        document.body.classList.remove('light-theme');
      }
      try {
        localStorage.setItem('bsp_theme_mode', nextTheme);
      } catch {}
      return {
        ...current,
        uiThemeMode: nextTheme,
        scenes: (Array.isArray(saved.scenes) ? unpinSceneMedia(saved.scenes) : null) ?? current.scenes,
        presentationDecks: Array.isArray(saved.presentationDecks) ? saved.presentationDecks : current.presentationDecks,
        songLinesPerSlide: (typeof saved.songLinesPerSlide === 'number' || saved.songLinesPerSlide === 'auto') ? saved.songLinesPerSlide : current.songLinesPerSlide,
        songs: Array.isArray(saved.songs) ? saved.songs : current.songs,
        themes: Array.isArray(saved.themes) ? saved.themes : current.themes,
        activeTheme: saved.activeTheme ?? current.activeTheme,
        verseHistory: Array.isArray(saved.verseHistory) ? saved.verseHistory : current.verseHistory,
        currentBibleVersion: saved.currentBibleVersion ?? current.currentBibleVersion,
        sidebarOpen: typeof saved.sidebarOpen === 'boolean' ? saved.sidebarOpen : current.sidebarOpen,
        showStandbyBrand: typeof saved.showStandbyBrand === 'boolean' ? saved.showStandbyBrand : current.showStandbyBrand,
        standbyMedia: saved.standbyMedia && typeof saved.standbyMedia === 'object' && saved.standbyMedia.url ? saved.standbyMedia : null,
        workspaces: Array.isArray(saved.workspaces) ? saved.workspaces : current.workspaces,
        activeWorkspaceId: typeof saved.activeWorkspaceId === 'string' ? saved.activeWorkspaceId : current.activeWorkspaceId,
        isWorkspaceLocked: typeof saved.isWorkspaceLocked === 'boolean' ? saved.isWorkspaceLocked : current.isWorkspaceLocked,
        doubleClickToGoLive: typeof saved.doubleClickToGoLive === 'boolean' ? saved.doubleClickToGoLive : current.doubleClickToGoLive,
        syncTranscriptWithLive: typeof saved.syncTranscriptWithLive === 'boolean' ? saved.syncTranscriptWithLive : current.syncTranscriptWithLive,
        display: {
          ...current.display,
          outputMode: saved.outputMode ?? current.display.outputMode,
          bibleOutputMode: saved.bibleOutputMode ?? current.display.bibleOutputMode ?? 'fullscreen',
          songOutputMode: saved.songOutputMode ?? current.display.songOutputMode ?? 'fullscreen',
          mode: saved.operatingMode === 'basic' || saved.operatingMode === 'simple'
            ? 'basic'
            : saved.operatingMode === 'studio' ? 'studio' : current.display.mode,
        },
        liveScripture: {
          ...current.liveScripture,
          ...(saved.liveScripturePrefs && typeof saved.liveScripturePrefs === 'object' ? saved.liveScripturePrefs : {})
        },
        uiLocale: isUiLocale(saved.uiLocale) ? saved.uiLocale : current.uiLocale,
        fxSettings: saved.fxSettings && typeof saved.fxSettings === 'object'
          ? { ...current.fxSettings, ...saved.fxSettings }
          : current.fxSettings,
        slideFxSettings: saved.slideFxSettings && typeof saved.slideFxSettings === 'object'
          ? { ...current.slideFxSettings, ...saved.slideFxSettings }
          : current.slideFxSettings,
      };
    } catch (err) {
      console.warn('[appStore] Exception in merge persisted state; recovering with defaults:', err);
      return current;
    }
  },
}));

interface PersistedState {
  scenes: Scene[];
  presentationDecks: PresentationDeck[];
  songLinesPerSlide: number | 'auto';
  songs: Song[];
  themes: Theme[];
  activeTheme: Theme | null;
  verseHistory: BibleVerse[];
  currentBibleVersion: BibleVersion | null;
  sidebarOpen: boolean;
  showStandbyBrand: boolean;
  standbyMedia?: StandbyMedia | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isWorkspaceLocked?: boolean;
  doubleClickToGoLive?: boolean;
  outputMode: DisplayState['outputMode'];
  bibleOutputMode?: DisplayState['outputMode'];
  songOutputMode?: DisplayState['outputMode'];
  operatingMode: OperatingMode | 'simple' | 'program' | 'preview';
  syncTranscriptWithLive?: boolean;
  liveScripturePrefs: Pick<
    LiveScriptureState,
    'detectionMode' | 'provider' | 'selectedInputId' | 'autoProject' | 'autoVersionSwitch' | 'autoProjectQuoted' | 'syncBibleOnDetection'
  >;
  uiLocale?: UiLocale;
  uiThemeMode?: 'dark' | 'light';
  fxSettings?: FxAnimationSettings;
  slideFxSettings?: FxAnimationSettings;
}
