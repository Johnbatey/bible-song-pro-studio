import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type {
  Scene, Theme, Song, BibleVersion, BibleVerse,
  DisplayState, AIProvider, TranscriptionState, Alert, LiveScriptureState, AudioInputDevice,
  OperatingMode, QueueItem, PresentationDeck
} from '../types';

/**
 * Persisted slices live in a JSON file under the app's userData dir (via store:* IPC),
 * falling back to localStorage when running in a plain browser (`npm run dev`).
 */
const bspStorage: StateStorage = {
  getItem: async (name) => {
    if (window.BSP?.store) {
      const result = await window.BSP.store.load().catch(() => null);
      return result?.state ?? null;
    }
    return localStorage.getItem(name);
  },
  setItem: async (name, value) => {
    if (window.BSP?.store) {
      await window.BSP.store.save(value).catch(() => {});
      return;
    }
    localStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    if (window.BSP?.store) {
      await window.BSP.store.clear().catch(() => {});
      return;
    }
    localStorage.removeItem(name);
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
  setOutputStatus: (status: Partial<DisplayState['outputStatus']>) => void;
  setCurrentScene: (scene: Scene | null) => void;
  setPreviewScene: (scene: Scene | null) => void;
  setIsTransitioning: (v: boolean) => void;
  setExternalDisplay: (v: boolean) => void;
  cutToScene: (scene: Scene) => void;
  transitionToScene: (scene: Scene, transitionType?: string) => void;

  // Scenes
  scenes: Scene[];
  addScene: (scene: Scene) => void;
  removeScene: (id: string) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  reorderScenes: (from: number, to: number) => void;

  // Themes
  themes: Theme[];
  activeTheme: Theme | null;
  setActiveTheme: (theme: Theme | null) => void;
  addTheme: (theme: Theme) => void;
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
  updateSong: (id: string, updates: Partial<Song>) => void;
  setSongs: (songs: Song[]) => void;
  setShowSongCredits: (show: boolean) => void;

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
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;

  // AI / Transcription
  aiProviders: AIProvider[];
  transcription: TranscriptionState;
  liveScripture: LiveScriptureState;
  audioInputDevices: AudioInputDevice[];
  setAIProvider: (id: string, updates: Partial<AIProvider>) => void;
  setTranscription: (state: Partial<TranscriptionState>) => void;
  setLiveScripture: (state: Partial<LiveScriptureState>) => void;
  setAudioInputDevices: (devices: AudioInputDevice[]) => void;

  // Alerts
  alerts: Alert[];
  activeAlert: Alert | null;
  triggerAlert: (alert: Alert) => void;
  dismissAlert: () => void;

  // UI State
  /**
   * Which docks are currently open. Mirrored out of dockview so the title bar
   * tabs can light up; the layout tree itself lives in localStorage, not here.
   */
  openDockIds: string[];
  setOpenDockIds: (ids: string[]) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  activeSettingsCategory: string;
  openSettings: (category?: string) => void;
  closeSettings: () => void;

  isThemeDesignerOpen: boolean;
  openThemeDesigner: () => void;
  closeThemeDesigner: () => void;

  isSlideEditorOpen: boolean;
  activePresentationId: string | null;
  presentationDecks: PresentationDeck[];
  openSlideEditor: (id?: string) => void;
  closeSlideEditor: () => void;
  setPresentationDecks: (decks: PresentationDeck[]) => void;
  updatePresentationDeck: (id: string, updates: Partial<PresentationDeck>) => void;
  addPresentationDeck: (deck: PresentationDeck) => void;
  deletePresentationDeck: (id: string) => void;
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  isLoaded: false,
  platform: 'darwin',

  display: {
    mode: 'studio',
    outputMode: 'fullscreen',
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
  },

  setMode: (mode) => set((s) => ({ display: { ...s.display, mode } })),
  setOutputMode: (outputMode) => set((s) => ({ display: { ...s.display, outputMode } })),
  setOutputStatus: (status) => set((s) => ({ display: { ...s.display, outputStatus: { ...s.display.outputStatus, ...status } } })),
  setCurrentScene: (scene) => set((s) => ({ display: { ...s.display, currentScene: scene } })),
  setPreviewScene: (scene) => set((s) => ({ display: { ...s.display, previewScene: scene } })),
  setIsTransitioning: (v) => set((s) => ({ display: { ...s.display, isTransitioning: v } })),
  setExternalDisplay: (v) => set((s) => ({ display: { ...s.display, isExternalDisplayActive: v } })),

  cutToScene: (scene) => {
    set((s) => ({
      display: {
        ...s.display,
        currentScene: scene,
        previewScene: scene,
        isTransitioning: false,
      },
    }));
  },

  projectScene: (scene, opts = {}) => {
    const { display } = get();
    // Keep it in the scene list so it can be re-fired later
    if (!get().scenes.some((s) => s.id === scene.id)) get().addScene(scene);

    if (opts.direct || display.mode === 'basic') {
      // Straight to the audience. Preview follows so the two panes agree.
      set((s) => ({
        display: { ...s.display, currentScene: scene, previewScene: scene, isTransitioning: false },
      }));
      return;
    }
    // Studio: stage it only — nothing changes on the audience display until Take.
    set((s) => ({ display: { ...s.display, previewScene: scene } }));
  },

  takeToProgram: (transition = false) => {
    const { display } = get();
    const scene = display.previewScene;
    if (!scene) return;
    if (transition) get().transitionToScene(scene);
    else get().cutToScene(scene);
  },

  transitionToScene: (scene, transitionType = 'fade') => {
    const state = get();
    set((s) => ({
      display: { ...s.display, previewScene: scene, isTransitioning: true },
    }));
    setTimeout(() => {
      set((s) => ({
        display: {
          ...s.display,
          currentScene: scene,
          isTransitioning: false,
        },
      }));
    }, state.display.mode === 'basic' ? 0 : 400);
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

  themes: [],
  activeTheme: null,
  setActiveTheme: (theme) => set({ activeTheme: theme }),
  addTheme: (theme) => set((s) => ({ themes: [...s.themes, theme] })),
  updateTheme: (id, updates) =>
    set((s) => {
      const exists = s.themes.some((t) => t.id === id);
      const updatedThemes = exists
        ? s.themes.map((t) => (t.id === id ? { ...t, ...updates } : t))
        : [...s.themes, { id, ...updates } as Theme];
      const updatedActive = s.activeTheme?.id === id ? { ...s.activeTheme, ...updates } : s.activeTheme;
      return { themes: updatedThemes, activeTheme: updatedActive };
    }),
  removeTheme: (id) => set((s) => ({ themes: s.themes.filter((t) => t.id !== id) })),

  songs: [],
  showSongCredits: false,
  songLinesPerSlide: 'auto',
  addSong: (song) => set((s) => ({ songs: [...s.songs, song] })),
  removeSong: (id) => set((s) => ({ songs: s.songs.filter((so) => so.id !== id) })),
  updateSong: (id, updates) =>
    set((s) => ({
      songs: s.songs.map((so) => (so.id === id ? { ...so, ...updates } : so)),
    })),
  setSongs: (songs) => set({ songs }),
  setShowSongCredits: (showSongCredits) => set({ showSongCredits }),
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
    set((s) => ({
      queue: [
        ...s.queue,
        {
          ...item,
          id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
        },
      ],
    })),
  removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
  clearQueue: () => set({ queue: [] }),

  aiProviders: [
    { id: 'deepgram', name: 'Deepgram', type: 'deepgram', enabled: false },
    { id: 'speechmatics', name: 'Speechmatics', type: 'speechmatics', enabled: false },
    { id: 'local', name: 'Local AI (MLX Whisper)', type: 'local', enabled: true },
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
    provider: 'local',
    selectedInputId: '',
    transcript: '',
    bestHit: null,
    suggestions: [],
    autoProject: true,
    autoVersionSwitch: true,
    autoProjectQuoted: false,
    requestedVersion: null,
    meter: {
      level: 0,
      peak: 0,
      isMonitoring: false,
    },
  },
  audioInputDevices: [],
  setAIProvider: (id, updates) =>
    set((s) => ({
      aiProviders: s.aiProviders.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  setTranscription: (state) =>
    set((s) => ({ transcription: { ...s.transcription, ...state } })),
  setLiveScripture: (state) =>
    set((s) => ({ liveScripture: { ...s.liveScripture, ...state } })),
  setAudioInputDevices: (devices) => set({ audioInputDevices: devices }),

  alerts: [],
  activeAlert: null,
  triggerAlert: (alert) => set({ activeAlert: alert }),
  dismissAlert: () => set({ activeAlert: null }),

  openDockIds: [],
  setOpenDockIds: (ids) => set((s) => (
    // dockview fires layout changes constantly while dragging; only push a new
    // array when the set of open docks actually differs.
    s.openDockIds.length === ids.length && ids.every((id, i) => s.openDockIds[i] === id)
      ? s
      : { openDockIds: ids }
  )),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  isSettingsOpen: false,
  activeSettingsCategory: 'output',
  openSettings: (category) => set((s) => ({ isSettingsOpen: true, activeSettingsCategory: category || s.activeSettingsCategory || 'output' })),
  closeSettings: () => set({ isSettingsOpen: false }),

  isThemeDesignerOpen: false,
  openThemeDesigner: () => set({ isThemeDesignerOpen: true }),
  closeThemeDesigner: () => set({ isThemeDesignerOpen: false }),

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
}), {
  name: 'bsp-app-state',
  version: 1,
  storage: createJSONStorage(() => bspStorage),
  // See unpinSceneMedia below — applied in `merge`.

  // Only library content and user preferences survive a restart. Live display state
  // (current/preview scene, output status, active alert, meter) is deliberately transient.
  partialize: (state) => ({
    scenes: state.scenes,
    presentationDecks: state.presentationDecks,
    songLinesPerSlide: state.songLinesPerSlide,
    songs: state.songs,
    themes: state.themes,
    activeTheme: state.activeTheme,
    verseHistory: state.verseHistory,
    currentBibleVersion: state.currentBibleVersion,
    sidebarOpen: state.sidebarOpen,
    outputMode: state.display.outputMode,
    operatingMode: state.display.mode,
    liveScripturePrefs: {
      detectionMode: state.liveScripture.detectionMode,
      provider: state.liveScripture.provider,
      selectedInputId: state.liveScripture.selectedInputId,
      autoProject: state.liveScripture.autoProject,
      autoVersionSwitch: state.liveScripture.autoVersionSwitch,
      autoProjectQuoted: state.liveScripture.autoProjectQuoted,
    },
  }),

  // Custom merge: the persisted shape is flattened (outputMode, liveScripturePrefs), so a
  // shallow spread would clobber `display` and `liveScripture` with partial objects.
  merge: (persisted, current) => {
    const saved = (persisted || {}) as Partial<PersistedState>;
    return {
      ...current,
      scenes: unpinSceneMedia(saved.scenes) ?? current.scenes,
      presentationDecks: saved.presentationDecks ?? current.presentationDecks,
      songLinesPerSlide: saved.songLinesPerSlide ?? current.songLinesPerSlide,
      songs: saved.songs ?? current.songs,
      themes: saved.themes ?? current.themes,
      activeTheme: saved.activeTheme ?? current.activeTheme,
      verseHistory: saved.verseHistory ?? current.verseHistory,
      currentBibleVersion: saved.currentBibleVersion ?? current.currentBibleVersion,
      sidebarOpen: saved.sidebarOpen ?? current.sidebarOpen,
      display: {
        ...current.display,
        outputMode: saved.outputMode ?? current.display.outputMode,
        // Older builds stored 'program' | 'preview' | 'simple'. 'simple' was the
        // program-only workflow, so it maps to basic; everything else to studio.
        mode: saved.operatingMode === 'basic' || saved.operatingMode === 'simple'
          ? 'basic'
          : saved.operatingMode === 'studio' ? 'studio' : current.display.mode,
      },
      liveScripture: { ...current.liveScripture, ...(saved.liveScripturePrefs || {}) },
    };
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
  outputMode: DisplayState['outputMode'];
  /** 'simple' only appears in state written by pre-studio/basic builds. */
  operatingMode: OperatingMode | 'simple' | 'program' | 'preview';
  liveScripturePrefs: Pick<
    LiveScriptureState,
    'detectionMode' | 'provider' | 'selectedInputId' | 'autoProject' | 'autoVersionSwitch' | 'autoProjectQuoted'
  >;
}
