export interface Scene {
  id: string;
  name: string;
  type: 'bible' | 'song' | 'media' | 'presentation' | 'custom';
  content: SceneContent;
  background?: Background;
  transition?: Transition;
}

export interface QueueItem {
  id: string;
  reference: string;
  text: string;
  type: 'bible' | 'song' | 'slide' | 'media';
  source?: 'Manual' | 'Auto';
  scene: Scene;
  timestamp: number;
}

export interface SceneContent {
  text?: string;
  reference?: string;
  version?: string;
  html?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'youtube';
  slides?: Slide[];
  slideId?: string;
  /** Second translation, rendered side by side with the primary text. */
  secondaryVerse?: SecondaryVerse;
  /** Shown as a small footer on song scenes — required by most CCLI licences. */
  songCredit?: SongCredit;
  /** The slide itself, for scenes that project a designed slide rather than
      text. Every surface paints this instead of `text` when it is present. */
  slide?: SlideProjection;
  /** Detailed original language Word Study entry for audience display projection. */
  wordStudy?: WordStudyEntry;
}

/**
 * A slide, packed so it survives the trip to a display.
 *
 * The Program pane, the audience window and the web display are three separate
 * documents; a scene reaches the last two through structured clone over IPC and
 * through JSON over the wire. Neither carries a live XML node, so a projection
 * holds only data — a parsed PowerPoint slide with its DOM references stripped,
 * or a native slide's elements — and the board that paints it is the same
 * component in all three.
 */
export interface SlideProjection {
  kind: 'pptx' | 'native';
  /** Board aspect. Absent means 16:9. */
  sizeEmu?: { cx: number; cy: number };
  /** kind 'pptx': the parsed slide, stripped of xmlDoc and run node refs. */
  parsed?: Record<string, unknown>;
  /** kind 'pptx': the deck theme's tx1, resolved while the package was open.
      The display never parsed the package, so it cannot look this up itself,
      and guessing it wrong puts white text on a white slide. */
  textFallbackColor?: string;
  /** kind 'pptx': a rendered preview, for slides that failed to parse. */
  previewDataUrl?: string;
  /** kind 'native': the slide's own layers, in percent-of-board geometry. */
  elements?: SlideElement[];
  /** kind 'native': the slide's background. */
  background?: SlideBackground;
}

export interface SecondaryVerse {
  text: string;
  reference: string;
  version: string;
}

export interface SongCredit {
  title?: string;
  author?: string;
  copyright?: string;
  ccli?: string;
}

export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape';
  /* Geometry is PERCENT of the slide, not pixels — the canvas writes these
     straight into left/top/width/height as `%`, and dragging converts pointer
     pixels back through the board size. Passing pixel values here puts the
     element somewhere off the board with no error anywhere. */
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  vAlign?: 'top' | 'middle' | 'bottom';
  textShadow?: string;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  boxShadow?: string;
  boxShadowEnabled?: boolean;
  boxShadowColor?: string;
  boxShadowBlur?: number;
  boxShadowOffsetX?: number;
  boxShadowOffsetY?: number;
  boxShadowOpacity?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
  lineHeight?: number;
  letterSpacing?: number;
  backgroundColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  strokeOpacity?: number;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  zIndex?: number;
  locked?: boolean;
}

export interface SlideBackground {
  type: 'color' | 'gradient' | 'image' | 'video';
  value: string;
  overlayColor?: string;
  overlayOpacity?: number;
}

export interface Slide {
  id: string;
  text: string;
  html?: string;
  notes?: string;
  title?: string;
  label?: string;
  transition?: 'cut' | 'fade' | 'crossfade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out';
  durationMs?: number;
  hidden?: boolean;
  buildCount?: number;
  buildStep?: number;
  previewDataUrl?: string;
  thumbDataUrl?: string;
  thumbText?: string;
  elements?: SlideElement[];
  background?: SlideBackground;
  aspectRatio?: '16:9' | '4:3' | 'lower-third';
}

export interface PresentationDeck {
  id: string;
  title: string;
  slides: PresentationSlide[];
  createdAt: number;
  updatedAt: number;
  sourceType?: 'internal' | 'pptx' | 'pdf' | 'image' | 'txt' | 'md';
  sourcePath?: string;
  aspectRatio?: '16:9' | '4:3' | 'lower-third';
}

export interface PresentationSlide {
  id: string;
  title: string;
  body: string;
  label: string;
  notes: string;
  transition: 'cut' | 'fade' | 'crossfade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out';
  durationMs: number;
  hidden: boolean;
  buildCount: number;
  buildStep: number;
  previewDataUrl?: string;
  thumbDataUrl?: string;
  thumbText?: string;
  elements?: SlideElement[];
  background?: SlideBackground;
  aspectRatio?: '16:9' | '4:3' | 'lower-third';
  /* Edits to an imported PowerPoint slide, kept as the slide part's OOXML.
     Written back into the package when the deck is reopened, so an edited
     slide re-parses through the same pipeline as an untouched one. Only
     slides actually edited carry this. */
  editor?: { filename: string; xml: string };
}

export interface Background {
  type: 'solid' | 'gradient' | 'image' | 'video' | 'transparent';
  color?: string;
  gradient?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  fit?: 'cover' | 'contain' | 'fill';
  loop?: boolean;
  muted?: boolean;
  opacity?: number;
}

export interface Transition {
  type: 'fade' | 'crossfade' | 'slide' | 'zoom' | 'cut' | 'custom';
  duration: number;
  easing?: string;
}

export interface Theme {
  id: string;
  name: string;
  lowerThird: LowerThirdTheme;
  fullScreen: FullScreenTheme;
  slideTheme: SlideTheme;
  bibleOptions?: BibleDisplayOptions;
  songOptions?: SongDisplayOptions;
}

export interface LowerThirdTheme {
  background: string;
  backgroundColor: string;
  backgroundType?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: string;
  savedGradientStart?: string;
  savedGradientEnd?: string;
  savedGradientDir?: string;
  savedSolidColor?: string;
  backgroundOpacity: number;
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontColor: string;
  referenceColor?: string;
  savedRefColor?: string;
  syncRefColor?: boolean;
  textShadowEnabled?: boolean;
  textShadowLevel?: 'subtle' | 'medium' | 'heavy' | 'custom';
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textAlign: 'left' | 'center' | 'right';
  padding: number;
  borderRadius: number;
  animation: string;
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';
  width?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  anchor?: 'top' | 'bottom';
  referenceFontSize?: number;
}

export interface FullScreenTheme {
  background?: string;
  backgroundColor: string;
  backgroundType?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: string;
  savedGradientStart?: string;
  savedGradientEnd?: string;
  savedGradientDir?: string;
  savedSolidColor?: string;
  backgroundOpacity?: number;
  /** Server-relative, e.g. `/media/<id>` — see MediaItem.url. An absolute url
      would pin the theme to whatever port the server held when it was set. */
  backgroundMediaUrl?: string;
  backgroundMediaType?: 'image' | 'video';
  backgroundFit?: 'cover' | 'contain' | 'fill';
  backgroundLoop?: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontColor: string;
  referenceColor?: string;
  savedRefColor?: string;
  syncRefColor?: boolean;
  textShadowEnabled?: boolean;
  textShadowLevel?: 'subtle' | 'medium' | 'heavy' | 'custom';
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textAlign: 'left' | 'center' | 'right';
  animation: string;
  referenceFontSize?: number;
  lineHeight?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  autoResize?: 'none' | 'shrink' | 'grow';
  offsetX?: number;
  offsetY?: number;
}

export interface SlideTheme {
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontColor: string;
  accentColor: string;
  transition: string;
}

export interface BibleDisplayOptions {
  showVersion: boolean;
  shortenVersions: boolean;
  shortenBooks: boolean;
  showVerseNumbers: boolean;
  versionSwitchUpdatesOutput: boolean;
}

export interface SongDisplayOptions {
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  showCategoryName: boolean;
  displayBySections: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  slides: SongSlide[];
  categories?: string[];
  /** Licensing metadata — displayed as a credit footer when projecting. */
  author?: string;
  copyright?: string;
  ccli?: string;
  /** The song's own ground, carried onto every slide it projects. Absent means
      it follows the theme, which is what Scripture does and what a song
      imported from OpenLyrics or ChordPro will always do. */
  background?: Background;
  /** Play order, as slide ids; an id may repeat (V1 C V2 C B C).
   *
   *  Ids rather than labels because labels are operator-editable and not
   *  unique — two slides can both read "Chorus", and renaming one would
   *  silently re-point the order at the other.
   *
   *  Absent or empty means "play the slides in list order", which is what
   *  every song written before this field existed does — so nothing needs
   *  migrating and the persist version must not be bumped for it. Ids that no
   *  longer name a slide are dropped when the order is expanded, so deleting a
   *  slide can never leave a song unprojectable. */
  arrangement?: string[];
}

export interface SongSlide {
  id: string;
  label: string;
  text: string;
}

/** Shape returned by song-import-service.cjs (OpenLyrics / ChordPro / plain text). */
export interface ImportedSong {
  title: string;
  verses: Array<{ name: string; lines: string[] }>;
  format: 'openlyrics' | 'chordpro' | 'plain';
  author?: string;
  copyright?: string;
  ccli?: string;
  /** Play order as verse *names*, because slide ids do not exist until `toSong`
   *  mints them. Comes from OpenLyrics' own `<verseOrder>` element, or from the
   *  repetition pass on a plain sheet. Empty when the order would just be each
   *  verse once. */
  verseOrder?: string[];
  /** Non-fatal notes from the parser — a `<verseOrder>` naming a verse the file
   *  does not contain, for instance. The import still succeeds. */
  warnings?: string[];
}

/** What the section detector returns for a pasted or imported lyric sheet. */
export interface ArrangeResult {
  ok: boolean;
  sections?: Array<{ name: string; lines: string[] }>;
  verseOrder?: string[];
  /** 1 when the sheet labelled its own sections, down to 0.25 when the split
   *  was guessed from line count. Below 0.6 the UI says so rather than
   *  presenting a guess as a fact. */
  confidence?: number;
  warnings?: string[];
  error?: string;
}

export interface SongImportResult {
  ok: boolean;
  songs?: ImportedSong[];
  format?: string;
  error?: string;
}

export interface AppSettings {
  /** Secrets never come back from main — only whether one is stored. */
  deepgramApiKeySet?: boolean;
  speechmaticsApiKeySet?: boolean;
  obsPasswordSet?: boolean;
  deepgramModel: string;
  deepgramLanguage: string;
  sttEngine: 'local' | 'deepgram';
  /** Which on-device recogniser runs. Empty means the service's own default. */
  sttLocalModel: string;
  /** The preacher's language. Only a multilingual model can honour it. */
  sermonLanguage: SermonLanguage;
  obsUrl: string;
  obsAutoConnect: boolean;
}

/** 'auto' lets Whisper detect the language per utterance. */
export type SermonLanguage = 'auto' | 'en' | 'fr' | 'es';

export interface AppSettingsPatch {
  deepgramApiKey: string;
  deepgramModel: string;
  deepgramLanguage: string;
  sttEngine: 'local' | 'deepgram';
  sttLocalModel: string;
  sermonLanguage: SermonLanguage;
  obsUrl: string;
  obsPassword: string;
  obsAutoConnect: boolean;
}

export interface ObsStatus {
  ok: boolean;
  connected: boolean;
  identified: boolean;
  url: string;
  hasPassword: boolean;
  currentScene: string;
  scenes: string[];
  streaming: boolean;
  recording: boolean;
  obsVersion: string;
  reconnectAttempts: number;
  lastError: string;
}

export type SttState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stalled' | 'error';

export interface SttStatus {
  ok: boolean;
  provider: string;
  state: SttState;
  running: boolean;
  configured: boolean;
  model: string;
  language: string;
  sampleRate: number;
  bytesSent: number;
  lastResultAt: number;
  reconnectAttempts: number;
  handshakeFailures: number;
  lastError: string;
}

export type SttEvent =
  | { type: 'state'; state: SttState; detail: string; status: SttStatus }
  | { type: 'transcript'; text: string; isFinal: boolean; speechFinal: boolean; confidence: number }
  | { type: 'utterance-end' }
  | { type: 'error'; error: string };

/** A monitor the output window can be sent to. */
export interface DisplayTarget {
  id: string;
  index: number;
  name: string;
  label: string;
  isPrimary: boolean;
  isInternal: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  resolution: string;
  scaleFactor: number;
}

export interface MediaItem {
  id: string;
  /** Where the file actually lives. The library points at it; it is never copied. */
  sourcePath?: string;
  /** Only on entries imported by builds that copied into userData/media. */
  file?: string;
  name: string;
  type: 'image' | 'video';
  size: number;
  addedAt: number;
  /** Server-relative path, e.g. /media/<id>. Prefix with the app server origin to use. */
  url: string;
  /** True when the file is not at its path right now — offer a relink, not a delete. */
  missing?: boolean;
}

export interface MediaImportResult {
  ok: boolean;
  items: MediaItem[];
  errors: string[];
  canceled?: boolean;
}

export interface BibleVersion {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  books: BibleBook[];
}

export interface BibleBook {
  name: string;
  chapters: number;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  version: string;
  reference: string;
}

export interface BibleSearchResult extends BibleVerse {
  score?: number;
}

/**
 * studio — preview and program side by side; content lands in preview and only reaches
 *          the audience when you Take it (double-click bypasses straight to program).
 * basic  — program only; content goes live the moment you send it.
 */
export type OperatingMode = 'studio' | 'basic';

export interface DisplayState {
  mode: OperatingMode;
  outputMode: 'fullscreen' | 'lowerThird';
  outputStatus: {
    isOpen: boolean;
    url: string;
    browserUrl?: string;
    remoteUrl?: string;
    clients: number;
    updatedAt: number;
  };
  currentScene: Scene | null;
  previewScene: Scene | null;
  isTransitioning: boolean;
  isExternalDisplayActive: boolean;
  /** Transport for a video background. See VideoTransport. */
  videoTransport: VideoTransport;
  /** Where the transport's clock has got to. Local only — never sent out. */
  videoClock: VideoClock;
  /** BLACK: every audience surface covered, program held underneath. */
  blackout: boolean;
}

/**
 * The operator's command to whichever surface is playing a video background.
 *
 * `target` says which pane owns the video: a clip cued in Studio is on the
 * preview surface and has not reached the audience, so scrubbing it must not
 * touch what is on air. When the target is `program` this travels out to the
 * audience, stage and browser surfaces with the rest of the display state.
 *
 * A seek is an event rather than a state — scrubbing back to the same second
 * twice has to fire twice — so it carries a nonce and the surfaces act on the
 * change in that, not on the value.
 */
export interface VideoTransport {
  target: 'program' | 'preview' | null;
  playing: boolean;
  seekTo: number | null;
  seekNonce: number;
  muted?: boolean;
}

/** What the playing surface reports back. Duration is 0 until metadata lands. */
export interface VideoClock {
  currentTime: number;
  duration: number;
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface AudioMeterState {
  level: number;
  peak: number;
  isMonitoring: boolean;
}

export interface LiveScriptureState {
  isActive: boolean;
  detectionMode: 'bible' | 'song';
  provider: 'deepgram' | 'local' | 'mlx-whisper';
  selectedInputId: string;
  transcript: string;
  bestHit: BibleSearchResult | null;
  suggestions: BibleSearchResult[];
  autoProject: boolean;
  autoVersionSwitch: boolean;
  autoProjectQuoted: boolean;
  requestedVersion: string | null;
  meter: AudioMeterState;
  mlxStatus?: any;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'deepgram' | 'speechmatics' | 'local';
  enabled: boolean;
  apiKey?: string;
}

export interface TranscriptionState {
  isActive: boolean;
  provider: AIProvider | null;
  /** Finalised speech only. Never rewritten, so it can render as settled text. */
  text: string;
  /**
   * The tail the engine is still revising. Kept apart from `text` because
   * interims rewrite themselves on every packet — folding them into one string
   * is what made the whole paragraph reflow several times a second.
   */
  interimText: string;
  confidence: number;
}

export interface Alert {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'announcement' | 'custom';
  duration: number;
  animation: string;
}

/**
 * A named dock arrangement the operator saved.
 *
 * `layout` is dockview's own serialised tree, kept opaque on purpose: it is
 * dockview's format to change, and nothing here has any business reading into
 * it. The only contract is that whatever `api.toJSON()` produced goes back
 * into `api.fromJSON()` unaltered.
 */
export interface Workspace {
  id: string;
  name: string;
  layout: unknown;
  createdAt: number;
  updatedAt: number;
}

/** The on-disk shape of an exported workspace. */
export interface WorkspaceFile {
  format: 'bsp.workspace';
  version: 1;
  name: string;
  layout: unknown;
  exportedAt: number;
  app?: string;
}

export interface WordStudyEntry {
  strongs: string;
  language: 'Greek' | 'Hebrew';
  lemma: string;
  transliteration: string;
  pronunciation: string;
  gloss: string;
  definition: string;
  etymology?: string;
  kjvUsage?: string;
  triggers: string[];
}

declare global {
  interface Window {
    BSP: {
      platform: () => Promise<string>;
      userDataPath: () => Promise<string>;
      version: () => Promise<string>;
      getDisplayUrl: () => Promise<string>;
      lexicon?: {
        lookup: (query: string) => Promise<WordStudyEntry | null>;
        detect: (text: string) => Promise<WordStudyEntry | null>;
        annotate: (text: string, book?: string) => Promise<Array<{ word: string; strongs?: WordStudyEntry }>>;
      };
      /** Cmd+Shift+B and POST /api/display/blackout arrive here. Returns an unsubscribe. */
      onBlackoutToggle?: (cb: () => void) => (() => void);
      /* Refused by the main process unless https and on its allowlist. */
      openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        isFullScreen: () => Promise<boolean>;
        onFullScreenChange: (cb: (val: boolean) => void) => void;
      };
      display: {
        open: (target?: { displayId?: string } | string | number) => Promise<{ ok: boolean; displayId?: string; label?: string; error?: string }>;
        close: () => Promise<{ ok: boolean }>;
        getDisplays: () => Promise<DisplayTarget[]>;
        getActive: () => Promise<{ ok: boolean; displayId: string | null; isOpen: boolean }>;
        onListChanged: (cb: (displays: DisplayTarget[]) => void) => () => void;
        sendState: (state: any) => Promise<any>;
        getState: () => Promise<any>;
        isOpen: () => Promise<boolean>;
        getStatus: () => Promise<{ isOpen: boolean; url: string; browserUrl?: string; remoteUrl?: string; clients: number; updatedAt: number }>;
        onMessage: (cb: (message: any) => void) => () => void;
      };
      /** The stage display's feed — the operator message vocabulary in
          src/stage/stage-state.ts, carried the same way display state is. */
      stage: {
        sendState: (message: Record<string, unknown>) => Promise<Record<string, unknown>>;
        getState: () => Promise<Record<string, unknown>>;
        onMessage: (cb: (message: unknown) => void) => () => void;
      };
      /** The operator's saved stage layouts, in userData rather than renderer
          storage — the designer window and the panel share one library. */
      stageLayouts: {
        list: () => Promise<{ ok: boolean; layouts: unknown[]; activeId: string | null }>;
        save: (layout: unknown) => Promise<{ ok: boolean; layout?: unknown; error?: string }>;
        delete: (id: string) => Promise<{ ok: boolean; error?: string }>;
        setActive: (id: string | null) => Promise<{ ok: boolean; activeId: string | null }>;
        onChanged: (cb: (payload: { layouts: unknown[]; activeId: string | null }) => void) => () => void;
      };
      bible: {
        getVersions: () => Promise<BibleVersion[]>;
        getBooks: (versionId: string) => Promise<BibleBook[]>;
        getChapter: (payload: { versionId: string; book: string; chapter: number }) => Promise<BibleVerse[]>;
        search: (payload: { versionId: string; query: string; limit?: number; book?: string }) => Promise<BibleSearchResult[]>;
      };

      verse: {
        detect: (payload: { text: string; options?: { versionId?: string; modes?: string[]; limit?: number; minConfidence?: number; isFinal?: boolean } }) => Promise<VerseDetectionResult>;
      };
      ai: {
        // Unified API
        status: () => Promise<TranscriptionStatus>;
        warmup: (payload?: any) => Promise<any>;
        transcribe: (payload?: any) => Promise<TranscriptionResult>;
        dispose: (payload?: any) => Promise<any>;
        setEngine: (engine: string) => Promise<any>;
        setLocalModel: (model: string) => Promise<any>;
        // Backward-compatible aliases
        getMlxWhisperStatus: () => Promise<any>;
        warmupMlxWhisper: (payload?: any) => Promise<any>;
        transcribeMlxWhisper: (payload?: any) => Promise<any>;
        disposeMlxWhisper: () => Promise<any>;
      };
      ndi: {
        start: (payload?: { name?: string; fps?: number; width?: number; height?: number }) => Promise<{ ok: boolean; error?: string; source?: string; status?: NdiStatus }>;
        stop: () => Promise<{ ok: boolean; status?: NdiStatus }>;
        status: () => Promise<NdiStatus>;
      };
      session: {
        start: (payload?: { name?: string }) => Promise<any>;
        end: () => Promise<any>;
        addEntry: (payload: { type: string; reference: string; book?: string; chapter?: number; verse?: number; text: string; version?: string; mode?: string; source?: string; confidence?: number }) => Promise<any>;
        list: () => Promise<{ ok: boolean; sessions: Array<{ id: string; name: string; startedAt: string; endedAt: string | null; entries: number }> }>;
        get: (id: string) => Promise<any>;
        export: (payload: { id: string; format?: 'json' | 'csv' }) => Promise<any>;
        status: () => Promise<any>;
      };
      song: {
        importFile: (payload: { filePath: string }) => Promise<SongImportResult>;
        importText: (payload: { text: string }) => Promise<SongImportResult>;
        arrangeText: (payload: { text: string }) => Promise<ArrangeResult>;
      };
      deck: {
        /** Reads a .pptx back from disk. Only the path is persisted with a deck. */
        read: (filePath: string) => Promise<{ ok: boolean; data?: Uint8Array; name?: string; size?: number; error?: string }>;
        pick: () => Promise<{ ok: boolean; filePath?: string; canceled?: boolean }>;
        /** Electron 32+ removed File.path; this is the sanctioned replacement. */
        pathForFile: (file: File) => string;
      };
      store: {
        load: () => Promise<{ ok: boolean; state: string | null; error?: string }>;
        save: (value: string) => Promise<{ ok: boolean }>;
        clear: () => Promise<{ ok: boolean }>;
      };
      settings: {
        get: () => Promise<{ ok: boolean; settings: AppSettings }>;
        set: (patch: Partial<AppSettingsPatch>) => Promise<{ ok: boolean; settings: AppSettings }>;
        clearSecret: (key: string) => Promise<{ ok: boolean; settings?: AppSettings }>;
      };
      stt: {
        start: (payload?: { model?: string; language?: string }) => Promise<{ ok: boolean; error?: string; status: SttStatus }>;
        stop: () => Promise<{ ok: boolean }>;
        status: () => Promise<SttStatus>;
        sendAudio: (chunk: ArrayBuffer) => void;
        onEvent: (cb: (event: SttEvent) => void) => () => void;
      };
      obs: {
        connect: (payload?: { url?: string; password?: string }) => Promise<{ ok: boolean; error?: string; status: ObsStatus }>;
        disconnect: () => Promise<{ ok: boolean; status: ObsStatus }>;
        status: () => Promise<ObsStatus>;
        setScene: (sceneName: string) => Promise<{ ok: boolean; error?: string }>;
        toggleStream: () => Promise<{ ok: boolean; active?: boolean; error?: string }>;
        toggleRecord: () => Promise<{ ok: boolean; active?: boolean; error?: string }>;
        refresh: () => Promise<unknown>;
        onEvent: (cb: (event: { type: string; status: ObsStatus }) => void) => () => void;
      };
      media: {
        list: () => Promise<{ ok: boolean; items: MediaItem[] }>;
        pick: () => Promise<MediaImportResult>;
        import: (paths: string[]) => Promise<MediaImportResult>;
        remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
        rename: (id: string, name: string) => Promise<{ ok: boolean; item?: MediaItem }>;
        relink: (id: string, path: string) => Promise<{ ok: boolean; item?: MediaItem; error?: string }>;
        pickRelink: (id: string, currentPath: string, name: string) => Promise<{ ok: boolean; item?: MediaItem; error?: string; canceled?: boolean }>;
        reveal: (path: string) => Promise<{ ok: boolean; error?: string }>;
        baseUrl: () => Promise<string>;
        pathForFile: (file: File) => string;
      };
      openSlideEditor: () => Promise<boolean>;
      openStageDisplay: () => Promise<boolean>;
      closeStageDisplay: () => Promise<{ ok: boolean; open: boolean }>;
      isStageDisplayOpen: () => Promise<boolean>;
      onStageDisplayState: (cb: (open: boolean) => void) => () => void;
      openStageDesigner: () => Promise<boolean>;
      stageDesigner: {
        setDirty: (dirty: boolean) => void;
        close: () => Promise<boolean>;
      };
      dock?: {
        /**
         * Push the current set of open dock ids to the main process so the
         * native Electron menu can update its checkmarks. Fire-and-forget.
         */
        syncMenu: (openIds: string[]) => void;
        /**
         * Subscribe to native-menu "Dock › <panel>" click events. The callback
         * receives the dock id that was toggled. Returns an unsubscribe function.
         */
        onToggle: (cb: (id: string) => void) => () => void;
        /**
         * Subscribe to native-menu "Dock › Reset Layout" click events. Returns
         * an unsubscribe function.
         */
        onResetLayout: (cb: () => void) => () => void;
      };
      /** Named dock arrangements. See WorkspaceBridge. */
      workspace?: {
        /** Push the list and the active id so the Workspace menu can rebuild. */
        sync: (payload: { list: Array<{ id: string; name: string }>; activeId: string | null }) => void;
        /** Subscribe to Workspace menu clicks. Returns an unsubscribe function. */
        onCommand: (cb: (payload: { action: string; id: string | null }) => void) => () => void;
        exportFile: (payload: { name: string; json: string }) =>
          Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }>;
        importFile: () =>
          Promise<{ ok: boolean; canceled?: boolean; json?: string; filePath?: string; error?: string }>;
      };
    };
  }
}

/** One of the on-device recognisers an operator can pick from. */
export interface LocalModelChoice {
  key: string;
  /** The Hugging Face repo it comes from. */
  id: string;
  label: string;
  note: string;
  family: 'whisper' | 'moonshine';
  /** Understands more than English, so the sermon language means something. */
  multilingual: boolean;
  /** Already on this computer, so switching to it needs no internet. */
  downloaded: boolean;
}

export interface LocalModelStatus {
  ok: boolean;
  name: string;
  modelId: string;
  modelKey: string;
  modelLabel: string;
  family: 'whisper' | 'moonshine';
  available: boolean;
  ready: boolean;
  warmupState: string;
  /** 0–100 while the weights are coming down. */
  downloadProgress: number;
  cacheDir: string;
  lastError: string;
  /** Whether the running model can be told a language at all. */
  multilingual: boolean;
  /** Language codes a multilingual model may be locked to. */
  supportedLanguages: string[];
  models: LocalModelChoice[];
}

export interface TranscriptionStatus {
  ok: boolean;
  activeEngine: string;
  platform: { os: string; arch: string; isAppleSilicon: boolean };
  engines: {
    onnx: LocalModelStatus;
    mlx: {
      ok: boolean;
      name: string;
      available: boolean;
      ready: boolean;
      warmupState: string;
      lastError: string;
    };
  };
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface VerseDetection {
  mode: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  displayRef: string;
  text: string;
  verses: Array<{ verse: number; text: string }>;
  confidence: number;
  hintText?: string;
  wordOverlap?: number;
  semanticScore?: number;
}

export interface VerseDetectionResult {
  ok: boolean;
  text: string;
  detections: VerseDetection[];
  totalFound: number;
  modes: string[];
}

export interface TranscriptionResult {
  ok: boolean;
  provider?: string;
  text: string;
  segments?: TranscriptionSegment[];
  confidence: number;
  isPassthrough?: boolean;
  activeEngine?: string;
  error?: string;
}

export interface NdiStatus {
  ok: boolean;
  available: boolean;
  libraryLoaded: boolean;
  running: boolean;
  source: string;
  instanceActive: boolean;
  framesSent: number;
  width: number;
  height: number;
  connections: number;
  lastError: string;
}
