const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, dialog, systemPreferences, session, Menu, MenuItem, nativeTheme, shell } = require('electron');
nativeTheme.themeSource = 'dark';

// Guarantee single-instance execution across all operating systems.
// If another instance is launched, focus the existing window rather than creating an invisible ghost process.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

/* -------------------------------------------------------------------------
   Nothing on the projector is allowed to pause because nobody is looking at
   the operator's window.

   Chromium assumes a window nobody can see is a window nobody is watching, and
   it is right about every window except ours. Three separate mechanisms stop a
   backgrounded page: timers are throttled to once a second, the renderer
   process itself is deprioritised, and — the one that actually froze the video
   here — a window the compositor believes is occluded stops being painted at
   all. `backgroundThrottling: false` on the window answers only the first.

   The audience display spends the whole service behind the operator's app or
   on a screen the Mac counts as covered, so all three had to go. The NDI feed
   is captured off that window's frames, which is why the stream froze with it:
   there were no new frames to send.

   Set here because switches are read when Chromium starts, and app.whenReady()
   is already too late.
   ------------------------------------------------------------------------- */
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// GPU Zero-Copy & Hardware Acceleration for 60fps Zero-Latency Camera Capture across all OSes
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

if (process.platform === 'darwin') {
  // macOS (Apple Silicon & Intel): Metal IOSurface zero-copy & hardware overlays
  app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,underlay');
  app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
} else if (process.platform === 'win32') {
  // Windows (Intel, AMD, NVIDIA): Direct3D 11 hardware decoding & prevent window occlusion throttle
  app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,underlay');
  app.commandLine.appendSwitch('enable-features', 'D3D11VideoDecoder,CanvasOopRasterization');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
} else if (process.platform === 'linux') {
  // Linux (X11 & Wayland): VA-API hardware video decode acceleration & GPU sandbox stability fallback
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,VaapiIgnoreDriverChecks');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Prevent unexpected stream destruction or network errors from showing modal crash dialogs
process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});

/* ── Where the operator's data lives, and why renaming is expensive ─────────
 *
 * Everything an operator owns — settings and API keys, the app-state store
 * with their themes, songs, scenes and workspaces, session history, stage
 * layouts, the media index, and the downloaded speech models — sits under
 * app.getPath('userData'). Nothing here hardcodes that path; it is derived.
 *
 * But Electron derives it from package.json, and from two different fields:
 *
 *   dev  (`electron .`)  →  top-level `name`         → …/bible-song-pro-studio
 *   packaged             →  `build.productName`      → …/Bible Song Pro Studio
 *
 * So renaming either field silently moves every operator to an empty folder.
 * It looks like data loss and it is indistinguishable from a bug. This already
 * happened once, when `name` went from bible-song-pro to bible-song-pro-studio.
 *
 * The two paths differing is deliberate, not an oversight: it is what keeps a
 * development run from writing over the library of an installed copy on the
 * same machine. Do not "fix" it by pinning them together.
 *
 * If either name has to change after a build ships, the rename needs a
 * migration that copies the old folder forward on first launch. There is no
 * such migration today, on purpose — nothing has shipped yet, and writing one
 * for a rename that may never happen is guesswork.
 * ─────────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const bibleService = require('./bible-service.cjs');
const { createTranscriptionService } = require('./transcription-service.cjs');
const { createVerseDetectionService } = require('./verse-detection-service.cjs');
const { createNdiService, DEFAULT_NDI_NAME } = require('./ndi-service.cjs');
const { createSessionHistoryService } = require('./session-history-service.cjs');
const { createSongImportService } = require('./song-import-service.cjs');
const { createAppStoreService } = require('./app-store-service.cjs');
const { createStageLayoutsService } = require('./stage-layouts-service.cjs');
const { createMediaService } = require('./media-service.cjs');
const deckService = require('./deck-service.cjs');
const { createSettingsService } = require('./settings-service.cjs');
const { createDeepgramService } = require('./deepgram-service.cjs');
const { createObsService } = require('./obs-service.cjs');
const { listenWithFallback } = require('./listen-with-fallback.cjs');
const lexiconService = require('./lexicon-service.cjs');
const { stripHugeDataUrls } = require('./strip-data-urls.cjs');
const { initRecordingsService } = require('./recordings-service.cjs');
let setMenuLocale = () => {};
let mt = (k, fallback) => fallback || k;
try {
  const menuMsg = require('../i18n/menu-messages.cjs');
  setMenuLocale = menuMsg.setMenuLocale || setMenuLocale;
  mt = menuMsg.mt || mt;
} catch (err) {
  console.warn('[Main] Warning: Could not load menu-messages.cjs, using default labels:', err?.message);
}

const isDev = !app.isPackaged && !fs.existsSync(path.join(__dirname, '../../dist/index.html'));
let mainWindow = null;
let displayWindow = null;
/* Stage windows are a set, not a single handle: the operator can put a
   confidence monitor on more than one screen, and each needs both feeds. */
const stageWindows = new Set();
const dockPopoutWindows = new Map();
/* Designer windows are their own set rather than members of stageWindows. Both
   receive the stage feed, but only a stage window is a stage: a designer must
   never be counted as a screen the service is going out on, and closing every
   stage while a designer stays open has to read as "no stage". */
const stageDesignerWindows = new Set();
/** webContents id → does that designer hold unsaved work. */
const dirtyDesigners = new Map();
let wss = null;
let httpServer = null;
/* The asset server's port. Not a constant: a conflict walks up the range, and
   everything that builds a URL reads this rather than the base. */
const HTTP_PORT_BASE = 8942;
const HTTP_PORT_ATTEMPTS = 8;
let displayPort = HTTP_PORT_BASE;

/* ── The key that gates everything the network can reach ────────────────────
 *
 * The asset server binds 0.0.0.0, because a phone remote and an OBS Browser
 * Source on another machine are the point of it. That used to mean anyone on
 * the church network — a volunteer's laptop, a guest on a flat VLAN — could
 * POST /api/display/project and put text on the projector, or open the
 * WebSocket and relay whatever it liked to every other client.
 *
 * So: one random token per launch, required by the REST API, by the page that
 * drives the projector, and by the WebSocket handshake. The operator never
 * types it — it travels in the URL the app shows them, and the display/remote
 * pages trade it for an HttpOnly cookie on first load so the page's own
 * fetches and its socket are covered without the token appearing in page
 * source. A link from last week's service stops working when the app restarts,
 * which is what you want for a credential that sits in a chat log.
 * ────────────────────────────────────────────────────────────────────────── */
const AUTH_COOKIE = 'bsp_token';
const remoteToken = crypto.randomBytes(18).toString('hex');
/** Set when the server could not bind at all, so the UI can say why. */
let httpServerError = null;
let activeDisplayId = null;
let ndiService = null;
let sessionHistory = null;

/* ── the End button's armed window ───────────────────────
   Ending a service clears the phone's history, so both surfaces ask for a
   second tap. Main owns the three-second window, so arming on the desk disarms
   the phone (and the other way round) at once, rather than two independent
   timers drifting apart. */
const END_ARM_MS = 3000;
let endArmExpiresAt = 0;
let endArmTimer = null;

function endArmState() {
  const armed = endArmExpiresAt > Date.now();
  return { armed, expiresAt: armed ? endArmExpiresAt : null };
}

function broadcastEndArm() {
  const payload = { type: 'endArm', ...endArmState() };
  if (wss) wss.clients.forEach((c) => { if (c.readyState === 1) c.send(JSON.stringify(payload)); });
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('session:end-arm', payload);
}

function setEndArm(armed) {
  clearTimeout(endArmTimer);
  endArmTimer = null;
  endArmExpiresAt = armed ? Date.now() + END_ARM_MS : 0;
  if (armed) {
    endArmTimer = setTimeout(() => {
      endArmExpiresAt = 0;
      endArmTimer = null;
      broadcastEndArm();
    }, END_ARM_MS);
  }
  broadcastEndArm();
  return endArmState();
}
let songImportService = null;
let appStoreService = null;
let stageLayoutsService = null;
let mediaService = null;
let settingsService = null;
let deepgramService = null;
let obsService = null;
let displayState = { type: null, outputMode: 'fullscreen', scene: null, activeAlert: null, transcription: null, theme: null };
/* The stage's own state, kept here for the same reason displayState is: a
   window opened halfway through a service has to be able to ask what is
   currently on it rather than wait for the next change. Its shape is the
   operator message vocabulary in src/stage/stage-state.ts. */
let stageState = {};
let transcriptionService = null;
let verseDetectionService = null;

/**
 * All dockable panels in display order for the native menu, grouped with
 * separators. This mirrors DOCKS in docks.tsx but lives here so the main
 * process doesn't need to parse the renderer bundle.
 */
const DOCK_DEFS = [
  /* Sources — what goes on the screen. */
  { id: 'bible' },
  { id: 'songs' },
  { id: 'presentation' },
  { id: 'media' },
  null, // separator
  /* Displays — the screens it goes to. */
  { id: 'output' },
  { id: 'stage' },
  null,
  /* Service — what is running right now. */
  { id: 'live' },
  { id: 'messages' },
  { id: 'transcript' },
  { id: 'queue' },
  { id: 'history' },
];

/**
 * What the renderer last told us about saved arrangements. Held here because
 * the Menu is rebuilt from scratch on every sync and both halves — the Dock
 * checkmarks and the Workspace list — have to be present each time.
 */
let menuWorkspaces = { list: [], activeId: null };

/* The last dock ids the renderer reported. Kept because the Menu is rebuilt
   whole on every sync, and a Workspace sync must not wipe the Dock ticks. */
let menuOpenIds = [];

/** Sends a Workspace menu action to the renderer, which owns the layout. */
function sendWorkspaceCommand(action, id) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('workspace:command', { action, id: id || null });
  }
}

/**
 * Rebuilds and installs the full application Menu. Called once at startup
 * (with an empty openIds list) and again every time the renderer pushes a
 * `dock:syncMenu` or `workspace:sync` event, so the Dock checkmarks and the
 * Workspace list both stay in step with what the renderer actually holds.
 */
function buildAppMenu(openIds) {
  const openSet = new Set(openIds || []);

  const dockItems = DOCK_DEFS.map((def) => {
    if (def === null) return new MenuItem({ type: 'separator' });
    return new MenuItem({
      label: mt(`dock.${def.id}`),
      type: 'checkbox',
      checked: openSet.has(def.id),
      click() {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dock:toggle', def.id);
        }
      },
    });
  });

  dockItems.push(new MenuItem({ type: 'separator' }));
  dockItems.push(new MenuItem({
    label: mt('menu.resetLayout'),
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
    click() {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dock:resetLayout');
      }
    },
  }));

  /* The Workspace menu.
     
     Saved arrangements come first so the list reads as the thing this menu is
     about; the verbs sit underneath. The default is a menu item rather than a
     stored record because it is generated in code — there is nothing on disk
     to update, rename or delete, and the items that would act on it are
     disabled accordingly. */
  const active = menuWorkspaces.list.find((w) => w.id === menuWorkspaces.activeId) || null;
  const activeLabel = active ? `“${active.name}”` : mt('menu.defaultLayout');

  const workspaceItems = [
    new MenuItem({
      label: mt('menu.defaultLayout'),
      type: 'checkbox',
      checked: !active,
      click() { sendWorkspaceCommand('activate', null); },
    }),
  ];

  if (menuWorkspaces.list.length > 0) {
    workspaceItems.push(new MenuItem({ type: 'separator' }));
    for (const ws of menuWorkspaces.list) {
      workspaceItems.push(new MenuItem({
        label: ws.name,
        type: 'checkbox',
        checked: ws.id === menuWorkspaces.activeId,
        click() { sendWorkspaceCommand('activate', ws.id); },
      }));
    }
  }

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.saveLayout'),
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
    click() { sendWorkspaceCommand('save'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.saveAsLayout'),
    click() { sendWorkspaceCommand('saveAs'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.updateLayout', { name: activeLabel }),
    // Nothing to update while the default is showing: it is rebuilt from code
    // every time, so a write would have nowhere to land.
    enabled: Boolean(active),
    click() { sendWorkspaceCommand('update'); },
  }));

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.renameLayout', { name: activeLabel }),
    enabled: Boolean(active),
    click() { sendWorkspaceCommand('rename'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.deleteLayout', { name: activeLabel }),
    enabled: Boolean(active),
    click() { sendWorkspaceCommand('delete'); },
  }));

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.importWorkspace'),
    click() { sendWorkspaceCommand('import'); },
  }));
  workspaceItems.push(new MenuItem({
    // Export works off whatever is on screen, so the default layout is
    // exportable too — that is often exactly what someone wants to send.
    label: mt('menu.exportLayout', { name: activeLabel }),
    click() { sendWorkspaceCommand('export'); },
  }));

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    /* Where the layouts actually live. Workspaces are records inside the app's
       store file and stage layouts are stage-layouts.json beside it, so there
       is one folder to show and it answers for both. Worth a menu item because
       the path is per-platform, buried in a Library folder macOS hides by
       default, and the usual reason for wanting it — copy this machine's setup
       onto the other two in the booth — is not a rare one. */
    label: mt('menu.showLayoutsFolder'),
    click() { revealLayoutsFolder(); },
  }));

  const template = [
    ...(process.platform === 'darwin'
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }]
      : []),
    {
      label: mt('menu.edit'),
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: mt('menu.view'),
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: mt('menu.dock'),
      submenu: dockItems,
    },
    {
      label: mt('menu.workspace'),
      submenu: workspaceItems,
    },
    {
      label: mt('menu.window'),
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * Opens the folder the app keeps its layouts in.
 *
 * `stage-layouts.json` gets picked out by name when it exists, so the window
 * lands with the file selected rather than on a folder of a dozen JSON files
 * the operator now has to read. When it does not exist yet — a machine where
 * nobody has saved a stage layout — the folder itself is still the answer,
 * because the workspaces are in the store file next to it.
 */
function revealLayoutsFolder() {
  const userData = app.getPath('userData');
  const stageLayouts = path.join(userData, 'stage-layouts.json');
  if (fs.existsSync(stageLayouts)) {
    shell.showItemInFolder(stageLayouts);
    return { ok: true, path: userData };
  }
  shell.openPath(userData);
  return { ok: true, path: userData };
}

/** Every live stage window, pruned of any that have since closed. */
function liveStageWindows() {
  for (const win of stageWindows) if (win.isDestroyed()) stageWindows.delete(win);
  return stageWindows;
}

/** Every live designer window, pruned the same way. */
function liveStageDesignerWindows() {
  for (const win of stageDesignerWindows) if (win.isDestroyed()) stageDesignerWindows.delete(win);
  return stageDesignerWindows;
}

/**
 * Everyone who renders stage state: the screens, the designers, and the
 * operator's own panel, which shows a preview of the stage in its dock.
 *
 * The stage feed used to run one way — the operator published, the screens
 * received — because the operator window was the only thing that could
 * originate a change. The designer breaks that assumption: it is a second
 * author of the same state, in its own window, and its edits have to reach
 * both the screens and the panel preview. So the feed is a bus now, and the
 * only rule is that a window never receives its own message back.
 */
function stageAudience() {
  const windows = [...liveStageWindows(), ...liveStageDesignerWindows()];
  if (mainWindow && !mainWindow.isDestroyed()) windows.push(mainWindow);
  return windows;
}

const ndiFeedWindows = new Map();

function resolveFeedThemeSection(theme, sceneType, targetMode) {
  if (!theme) return null;
  let effTheme = theme;
  if (theme.linkBibleSong === false) {
    if (sceneType === 'song') {
      effTheme = {
        ...theme,
        fullScreen: theme.songFullScreen || theme.fullScreen,
        lowerThird: theme.songLowerThird || theme.lowerThird,
      };
    } else if (sceneType === 'bible') {
      effTheme = {
        ...theme,
        fullScreen: theme.bibleFullScreen || theme.fullScreen,
        lowerThird: theme.bibleLowerThird || theme.lowerThird,
      };
    }
  }
  return targetMode === 'lowerThird' ? effTheme.lowerThird : effTheme.fullScreen;
}

function computeFeedBackgroundFields(scene, theme, targetMode) {
  const bg = scene?.background;
  const themeFs = theme?.fullScreen;
  const fields = {
    bgVideo: '',
    bgCustomImage: '',
    bgFill: '',
    bgFit: bg?.fit || (!bg ? themeFs?.backgroundFit : undefined) || 'cover',
    bgOpacity: typeof bg?.opacity === 'number' ? bg.opacity : 1,
    bgVideoLoop: bg ? bg.loop !== false : (themeFs?.backgroundLoop !== false),
  };

  const applyThemeGround = () => {
    if (targetMode !== 'fullscreen') {
      fields.bgFill = 'transparent';
      return;
    }
    if (themeFs?.backgroundMediaType === 'video' && themeFs.backgroundMediaUrl) {
      fields.bgVideo = themeFs.backgroundMediaUrl;
    } else if (themeFs?.backgroundMediaType === 'image' && themeFs.backgroundMediaUrl) {
      fields.bgCustomImage = themeFs.backgroundMediaUrl;
    } else if (themeFs?.backgroundType === 'transparent' || themeFs?.background === 'transparent' || themeFs?.backgroundColor === 'transparent') {
      fields.bgFill = 'transparent';
    } else {
      fields.bgFill = themeFs?.background || themeFs?.backgroundColor || '#0c0e14';
    }
  };

  if (targetMode === 'lowerThird') {
    fields.bgFill = 'transparent';
    return fields;
  }

  if (!bg) {
    applyThemeGround();
    return fields;
  }

  if (bg.type === 'video' && bg.mediaUrl) fields.bgVideo = bg.mediaUrl;
  else if (bg.type === 'image' && bg.mediaUrl) fields.bgCustomImage = bg.mediaUrl;
  else if (bg.type === 'gradient' && bg.gradient) fields.bgFill = bg.gradient;
  else if (bg.type === 'solid' && bg.color) fields.bgFill = bg.color;
  else if (bg.type === 'transparent') fields.bgFill = 'transparent';
  else applyThemeGround();

  return fields;
}

function transformDisplayStateForFeed(baseState, feedConfig) {
  if (!baseState) return {};
  const cloned = { ...baseState };
  const contentFilter = feedConfig.contentFilter || 'all';
  const renderMode = feedConfig.renderMode || 'follow_program';

  // Content filtering logic
  const sceneType = cloned.scene?.type || (cloned.displayVerse || cloned.verse ? 'bible' : (cloned.lyrics ? 'song' : ''));
  const isBible = sceneType === 'bible' || cloned.scene?.id?.startsWith('bible-') || Boolean(cloned.displayVerse || cloned.verse);
  const isSong = sceneType === 'song' || cloned.scene?.id?.startsWith('song-') || Boolean(cloned.lyrics);
  const isPres = sceneType === 'presentation' || cloned.scene?.id?.startsWith('slide-') || cloned.scene?.id?.startsWith('pptx-');

  let allowContent = true;
  if (contentFilter === 'bible_songs') {
    allowContent = isBible || isSong;
  } else if (contentFilter === 'bible_only') {
    allowContent = isBible;
  } else if (contentFilter === 'song_only') {
    allowContent = isSong;
  } else if (contentFilter === 'presentations_only') {
    allowContent = isPres;
  }

  if (!allowContent && cloned.scene) {
    return {
      ...cloned,
      scene: null,
      verse: null,
      displayVerse: null,
      lyrics: null,
      lowerThirdText: null,
      lowerThirdSub: null,
      outputMode: renderMode === 'full_screen_only' ? 'fullscreen' : 'lowerThird',
      mode: renderMode === 'full_screen_only' ? 'fullscreen' : 'lowerThird',
      bgFill: 'transparent',
      bgCustomImage: null,
      bgVideo: null,
      bgMotion: null,
    };
  }

  // Render Mode Overrides
  if (renderMode === 'lower_third_only' || renderMode === 'full_screen_only') {
    const targetMode = renderMode === 'lower_third_only' ? 'lowerThird' : 'fullscreen';
    cloned.outputMode = targetMode;
    cloned.mode = targetMode;

    const section = resolveFeedThemeSection(cloned.theme, sceneType, targetMode);
    const fontColor = section?.fontColor || '#ffffff';

    // Strict typography mapping for the forced mode
    cloned.fontFamily = section?.fontFamily || 'Poppins';
    cloned.fontSize = section?.fontSize ?? 0;
    cloned.fontWeight = section?.fontWeight ?? 700;
    cloned.fontColor = fontColor;
    cloned.textAlign = section?.textAlign || 'center';
    cloned.referenceColor = section?.syncRefColor
      ? fontColor
      : (section?.referenceColor || cloned.theme?.lowerThird?.accentColor || '#e8541a');
    cloned.referenceFontSize = section?.referenceFontSize ?? 0;
    cloned.showReference = true;
    cloned.showTranslation = cloned.theme?.bibleOptions?.showVersion ?? true;

    // Strict background mapping for the forced mode
    const bgFields = computeFeedBackgroundFields(cloned.scene, cloned.theme, targetMode);
    Object.assign(cloned, bgFields);
  }

  return cloned;
}

function createNdiFeedWindow(feed) {
  if (!feed || !feed.id) return null;
  if (ndiFeedWindows.has(feed.id)) {
    const existing = ndiFeedWindows.get(feed.id);
    if (existing && !existing.isDestroyed()) return existing;
  }

  const win = new BrowserWindow({
    width: feed.width || 1920,
    height: feed.height || 1080,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  win.loadURL(isDev ? 'http://localhost:5173/audience-display.html' : `file://${path.join(__dirname, '../../dist/audience-display.html')}`);
  win.setMenuBarVisibility(false);

  win.webContents.on('did-finish-load', () => {
    const feedState = transformDisplayStateForFeed(displayState, feed);
    win.webContents.send('display:message', { type: 'display:update', state: feedState });
    ndiService?.setFeedWindow(feed.id, win);
  });

  win.on('closed', () => {
    ndiFeedWindows.delete(feed.id);
  });

  ndiFeedWindows.set(feed.id, win);
  return win;
}

function broadcastDisplayState() {
  const msg = JSON.stringify({ type: 'display:update', state: displayState });
  if (wss) wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
  const payload = { type: 'display:update', state: displayState };
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.webContents.send('display:message', payload);
  /* The stage renders the program output with the same component the projector
     does, so it needs the same state — that is the whole point of the stage no
     longer embedding the legacy display page to get it. */
  for (const win of liveStageWindows()) win.webContents.send('display:message', payload);

  // Broadcast transformed state to all dedicated NDI feed windows
  const configuredFeeds = settingsService?.get('ndiFeeds') || [];
  for (const [feedId, win] of ndiFeedWindows.entries()) {
    if (win && !win.isDestroyed()) {
      const feedConfig = configuredFeeds.find((f) => f.id === feedId) || ndiService?.activeFeeds?.get(feedId) || { id: feedId, contentFilter: 'all', renderMode: 'follow_program' };
      const feedState = transformDisplayStateForFeed(displayState, feedConfig);
      win.webContents.send('display:message', { type: 'display:update', state: feedState });
    }
  }
}

function setDisplayState(next) {
  displayState = stripHugeDataUrls({ ...displayState, ...(next || {}), updatedAt: Date.now() });
  broadcastDisplayState();
  return displayState;
}

function broadcastStageState(message, senderId) {
  for (const win of stageAudience()) {
    // Skipping the sender is not an optimisation. Most messages are state and
    // fold in idempotently, but a timer command is an instruction, and a
    // window that applied its own "reset" locally would apply it twice.
    if (senderId != null && win.webContents.id === senderId) continue;
    win.webContents.send('stage:message', message);
  }
}

/* Kinds that are events rather than state, and so are passed on but never
   retained: a message the operator has long since taken down must not reappear
   on a fresh screen. Timer commands are no longer among them — the timer they
   produce is retained, and only that travels. See setStageTimer. */
const STAGE_TRANSIENT_KINDS = new Set(['program-output', 'message']);

/* ── Asking the renderer a question ────────────────────────────────────────
 * One request, one reply, a timeout so an unresponsive window costs a second
 * rather than hanging the phone's request forever.
 * ────────────────────────────────────────────────────────────────────────── */
const lexiconRequests = new Map();
let lexiconRequestSeq = 0;

function askRenderer(kind, payload, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) { resolve(null); return; }
    const id = ++lexiconRequestSeq;
    const timer = setTimeout(() => {
      lexiconRequests.delete(id);
      resolve(null);
    }, timeoutMs);
    lexiconRequests.set(id, (value) => {
      clearTimeout(timer);
      lexiconRequests.delete(id);
      resolve(value);
    });
    mainWindow.webContents.send('lexicon:remote-request', { id, kind, payload });
  });
}

/**
 * The timer a command leaves behind, or null for a command we do not know.
 *
 * The clock lives here rather than in the menu that pressed the button, because
 * there are now several of them — the operator panel, and a phone in someone's
 * pocket — and elapsed time is only elapsed time if one process counts it.
 */
function applyStageTimerCommand(command, atMs) {
  const timer = stageState.timer || {};
  const accumulated = Number(timer.accumulatedSeconds) || 0;
  const running = Boolean(timer.running);
  const startedAt = Number.isFinite(timer.startedAtMs) ? timer.startedAtMs : null;
  const elapsed = accumulated + (running && startedAt != null ? Math.max(0, atMs - startedAt) / 1000 : 0);

  if (command === 'start') {
    /* Re-starting a running timer is not a restart: it must not throw away the
       time already banked, only repair a start that was never stamped. */
    return running && startedAt != null
      ? { running: true, startedAtMs: startedAt, accumulatedSeconds: accumulated }
      : { running: true, startedAtMs: atMs, accumulatedSeconds: Math.floor(elapsed) };
  }
  /* Floored, not rounded: the running readout floors too, and a pause that
     jumped the clock a second forward would look like the timer gaining time. */
  if (command === 'stop') return { running: false, startedAtMs: null, accumulatedSeconds: Math.floor(elapsed) };
  if (command === 'reset') return { running: false, startedAtMs: null, accumulatedSeconds: 0 };
  return null;
}

/**
 * Apply a timer command and tell everyone the timer that came out of it.
 *
 * The command itself is not forwarded: "start" is an instruction with a moment
 * attached, and a screen that applied it again would restart a clock already
 * running. The timer is state — applying it twice is harmless — which is also
 * why a stage window opened an hour later catches the right reading from the
 * retained snapshot.
 */
function setStageTimer(command, senderId, atMs) {
  const timer = applyStageTimerCommand(command, Number(atMs) || Date.now());
  if (!timer) return null;
  stageState = { ...stageState, timer, updatedAt: Date.now() };
  broadcastStageState({ kind: 'timer', timer }, senderId);
  broadcastStageSummary();
  return timer;
}

/**
 * Pass an operator message to the stage windows, retaining what a window
 * opened later would need to catch up.
 *
 * The snapshot is accumulated as a plain value object — the envelope's `kind`
 * is stripped and a `config` is unwrapped — because that is exactly the shape
 * the stage's own reducer treats as "here is some state". Replaying it is then
 * a single ordinary message through the same code path as a live one, with no
 * second interpretation of the vocabulary living up here in the main process.
 */
function setStageState(message, senderId) {
  if (!message || typeof message !== 'object') return stageState;
  /* A timer instruction folds into the one clock the phone reads, then travels
     as the timer it produced rather than as the instruction. */
  if (message.kind === 'timer-command') {
    setStageTimer(message.command, senderId, message.atMs);
    return stageState;
  }
  if (!STAGE_TRANSIENT_KINDS.has(message.kind)) {
    const value = message.kind === 'config' ? (message.config || {}) : message;
    const { kind, ...rest } = value;
    void kind;
    stageState = { ...stageState, ...rest, updatedAt: Date.now() };
    /* A layout and a custom layout are two answers to the same question, so the
       snapshot keeps exactly one — with one deliberate exception. When a
       message carries both, they are a pair the renderer built together: a
       preset id plus that preset's effective configuration, which is how
       per-preset zone tweaks reach a window that opens later. Both are
       retained, and `customLayout` is authoritative when the stage applies
       them. A message with only one drops the other. */
    if ('layout' in rest && !('customLayout' in rest)) delete stageState.customLayout;
    if ('customLayout' in rest && rest.customLayout && !('layout' in rest)) delete stageState.layout;
  }
  broadcastStageState(message, senderId);
  broadcastStageSummary();
  return stageState;
}

/**
 * What the phone needs to draw the stage card, and nothing else.
 *
 * `stageState` carries a whole theme, a layout with zones and sometimes a
 * packed projection — none of which a phone needs, and all of which would be
 * handed to anything holding the session key. This is the same summary the
 * REST endpoint returns, so the socket and the endpoint cannot disagree.
 */
function stageSummary() {
  const state = stageState || {};
  const timer = state.timer || {};
  const elapsed = (Number(timer.accumulatedSeconds) || 0)
    + (timer.running && Number.isFinite(timer.startedAtMs)
      ? Math.max(0, Date.now() - timer.startedAtMs) / 1000
      : 0);
  const summary = (content) => (content
    ? { title: content.title || '', body: content.body || '' }
    : null);
  const windows = liveStageWindows().size;
  return {
    ok: true,
    open: Boolean((stageDisplayWindow && !stageDisplayWindow.isDestroyed()) || windows > 0),
    windows,
    mode: state.mode || 'confidence',
    current: summary(state.current),
    next: summary(state.next),
    timerRunning: Boolean(timer.running),
    timerSeconds: Math.floor(elapsed),
    messageCount: Array.isArray(state.messages) ? state.messages.length : 0,
    layoutId: state.layout && state.layout.id ? state.layout.id : null,
  };
}

/** Stage changes reach the operator windows over IPC; this is the phone's copy. */
function broadcastStageSummary() {
  if (!wss) return;
  const message = JSON.stringify({ type: 'stage:update', state: stageSummary() });
  wss.clients.forEach((client) => { if (client.readyState === 1) client.send(message); });
}

function serveStatic(dirName) {
  return (req, res, url) => {
    const rel = url.pathname.replace(new RegExp('^/' + dirName + '/'), '');
    const safe = path.normalize(rel).replace(/^\.\.(\/|$)/, '');
    if (isDev) { res.writeHead(302, { Location: `http://localhost:5173/${dirName}/${safe}` }); res.end(); return; }
    const fp = path.join(__dirname, '../../dist', dirName, safe);
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(fp).toLowerCase();
    const ct = ext === '.ttf' ? 'font/ttf' : ext === '.woff' ? 'font/woff' : ext === '.woff2' ? 'font/woff2' : ext === '.otf' ? 'font/otf'
      : ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.mp4' ? 'video/mp4' : ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript'
          : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=31536000', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(fp).pipe(res);
  };
}

function serveHtmlFile(filename, extraHeaders = {}) {
  return (req, res) => {
    if (isDev) {
      res.writeHead(302, { Location: `http://localhost:5173/${filename}`, ...extraHeaders });
      res.end();
      return;
    }
    const fp = path.join(__dirname, '../../dist', filename);
    if (!fs.existsSync(fp)) { res.writeHead(404, { ...extraHeaders }); res.end('Not Found'); return; }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    });
    res.end(fs.readFileSync(fp, 'utf8'));
  };
}

/* ── Authorization for the network surfaces ────────────────────────────────
 * Shared by the REST API, the gated pages and the WebSocket handshake so all
 * three answer the same question the same way. Compared with a constant-time
 * equality: the token is short-lived, but an attacker who can measure the
 * response is still an attacker.
 * ────────────────────────────────────────────────────────────────────────── */
function tokensMatch(presented, expected) {
  const a = Buffer.from(String(presented || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Every place a token can legitimately arrive from: header, query, cookie. */
function requestToken(req, url) {
  const header = req.headers['x-bsp-token'];
  if (typeof header === 'string' && header) return header;
  const query = url?.searchParams?.get('token');
  if (query) return query;
  const cookies = String(req.headers.cookie || '');
  const match = new RegExp('(?:^|;\\s*)' + AUTH_COOKIE + '=([^;]+)').exec(cookies);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

function isAuthorized(req, url) {
  return tokensMatch(requestToken(req, url), remoteToken);
}

/**
 * A page loaded with the token trades it for a cookie, so its own fetches and
 * its WebSocket handshake are authorized without the token being readable by
 * the page's script or by anything injected into it.
 */
function authorizedPageHeaders(url) {
  const fromQuery = url?.searchParams?.get('token');
  if (!fromQuery || !tokensMatch(fromQuery, remoteToken)) return {};
  return { 'Set-Cookie': `${AUTH_COOKIE}=${remoteToken}; Path=/; HttpOnly; SameSite=Strict` };
}

/**
 * What someone gets when they open an old bookmark or guess the port. Says
 * where the real link is rather than pretending the page does not exist, so an
 * operator whose OBS source stopped working can fix it without reading a log.
 */
function sendAuthRequired(res) {
  res.writeHead(403, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Bible Song Pro — locked</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0e14;color:#e8eaf0;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{max-width:40rem;padding:2rem}h1{font-size:1.25rem;margin:0 0 .75rem}p{margin:.5rem 0;color:#9aa3b2}strong{color:#e8eaf0}</style>
</head><body><main><h1>This screen needs a link from Bible Song Pro Studio</h1>
<p>Remote control and browser output are locked so nobody else on this network can drive the projector.</p>
<p>In the app, open <strong>Settings &rarr; Output</strong> and copy the Remote or Browser URL shown there. It carries a key for this session.</p>
<p>The key changes every time the app starts, so a bookmark or an OBS source saved at an earlier service has to be updated once.</p></main></body></html>`);
}

/** The address a phone on the same network should use — 127.0.0.1 is this machine only. */
function lanAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const entry of interfaces[name] || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '127.0.0.1';
}

/* ── What a renderer is allowed to become ──────────────────────────────────
 *
 * Every window here loads preload.cjs, and a contextBridge survives a
 * navigation. So a window that navigates anywhere else — a dropped link, a
 * target=_blank, a remote page that frames itself into us — hands the whole
 * `window.BSP` bridge (file dialogs, deck reads, factory reset) to whatever it
 * landed on. Nothing in the app needs to leave its own pages, so nothing is
 * allowed to.
 * ────────────────────────────────────────────────────────────────────────── */
function isAppUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    return false;
  }
  if (parsed.protocol === 'file:') {
    /* Packaged and built runs: dist/ next to src/electron. */
    return parsed.pathname.includes('/dist/');
  }
  if (isDev) return parsed.hostname === 'localhost' && parsed.port === '5173';
  return false;
}

/** Permissions a presentation app actually asks for. Everything else is refused. */
const ALLOWED_PERMISSIONS = new Set([
  'media',                    // microphone and camera, via getUserMedia
  'audioCapture',
  'videoCapture',
  /* Audio output routing. Settings → Audio picks a device and utils/audio-output
     calls setSinkId with it; Chromium gates that behind this permission, so a
     tighter allowlist would silently send every cue to the default device. */
  'speaker-selection',
  'clipboard-read',           // pasting lyrics and references into the console
  'clipboard-sanitized-write',
  'fullscreen',
  'pointerLock',
]);

/** Origin form of the same question, for the check handler. */
function permissionOriginAllowed(origin) {
  if (!origin || origin === 'null') return true; // opaque file:// main frame
  if (origin.startsWith('file://')) return true;
  return isDev && /^http:\/\/localhost:5173$/.test(origin);
}

const MEDIA_CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
};

function serveMedia(req, res, fileName) {
  const filePath = mediaService?.resolve(fileName);
  if (!filePath) { res.writeHead(404); res.end('Not Found'); return; }

  const stat = fs.statSync(filePath);
  const ct = MEDIA_CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': ct,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': ct,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
}

/**
 * Put a verse on the program screen, from wherever the instruction came — a tap
 * on the phone, or one step of Previous/Next. Returns the state that went out.
 */
function projectVerse(v) {
  /* A whole Scene, not just a content bag. The display chooses its theme by
     `scene.type` and keys its transition off `scene.id`, so a scene without
     them projects in the wrong theme and never animates in. */
  const content = { text: v.text, reference: v.reference, version: v.version || 'KJV' };
  /* Dual reading travels inside the scene, where the display already knows how
     to set a second translation beside or under the first. */
  if (v.secondary && v.secondary.text) {
    content.secondaryVerse = {
      text: v.secondary.text,
      reference: v.secondary.reference,
      version: v.secondary.version,
    };
    content.dualLayout = v.dualLayout === 'horizontal' ? 'horizontal' : 'vertical';
  }
  /* No transition of its own: the phone's FX are the app's FX now, and a scene
     carrying its own transition would quietly override the setting the phone
     had just changed. */
  const scene = {
    id: `remote-${Date.now()}`,
    name: v.reference || 'Verse',
    type: 'bible',
    content,
  };
  sessionHistory?.addEntry({ type: 'verse', reference: v.reference, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text, source: 'remote' });
  return showScene(scene);
}

/**
 * Put a scene on the program screen and tell the operator window about it.
 *
 * The operator window owns the next full state push, so it has to learn what
 * the phone put on screen. Without this it would push the scene it still
 * believed was live and quietly take the verse down again.
 */
function showScene(scene) {
  setDisplayState({ scene, type: scene.type || 'bible' });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('display:remote-project', scene);
  }
  return displayState;
}

/**
 * The word-study card the desk projects when a Strong's number is clicked.
 * Same scene id and same text, so the two surfaces cannot show different
 * definitions of the same number.
 */
function wordStudyScene(entry) {
  const transliteration = entry.transliteration || entry.strongs;
  return {
    id: `wordstudy-${entry.strongs}`,
    name: `Word Study: ${transliteration}`,
    type: 'bible',
    content: {
      text: `${entry.lemma || ''} (${transliteration} • ${entry.strongs}) — ${entry.gloss || ''}: ${entry.definition || ''}`,
      reference: `Word Study: ${transliteration} (${entry.strongs})`,
      wordStudy: entry,
    },
  };
}

/**
 * The verse one step before or after what is on screen, walking past chapter
 * and book boundaries but not off the ends of the canon.
 *
 * Derived from the projected reference rather than from a list the phone keeps:
 * the screen is the truth about what is live, and the phone may have been
 * asleep through the last three changes.
 */
function neighborVerse(direction, requestedVersion) {
  const content = displayState.scene && displayState.scene.content;
  const reference = content && content.reference;
  if (!reference) return null;
  /* The phone's own pick wins, so a reading does not change translation
     halfway through because the projector was last given a different one — but
     only if it names a translation this app can actually open. */
  const known = bibleService.getVersions().some((version) => version.id === requestedVersion);
  const version = known ? requestedVersion : (content.version || 'KJV');
  const parsed = bibleService.parseReference(reference, version);
  if (!parsed || !parsed.book) return null;

  const step = direction === 'previous' ? -1 : 1;
  const verses = bibleService.getChapter(version, parsed.book, parsed.chapter) || [];
  const index = verses.findIndex((verse) => verse.verse === parsed.verseStart);
  if (index !== -1 && verses[index + step]) return verses[index + step];

  /* Later chapters of the same book first, in the direction of travel. The
     chapter count is the book's own, so the walk cannot run off the end. */
  const books = bibleService.getBooks(version) || [];
  const at = books.findIndex((book) => book.name === parsed.book);
  const lastChapter = at === -1 ? parsed.chapter : (Number(books[at].chapters) || parsed.chapter);
  for (let chapter = parsed.chapter + step; chapter > 0 && chapter <= lastChapter; chapter += step) {
    const chapterVerses = bibleService.getChapter(version, parsed.book, chapter) || [];
    if (chapterVerses.length) return step > 0 ? chapterVerses[0] : chapterVerses[chapterVerses.length - 1];
  }

  /* Then the neighbouring book. Numbered books are entries of their own, so
     the order is simply the canon's. */
  if (at === -1) return null;
  for (let offset = at + step; offset >= 0 && offset < books.length; offset += step) {
    const book = books[offset];
    if (!book || !book.chapters) continue;
    const chapterVerses = bibleService.getChapter(version, book.name, step > 0 ? 1 : book.chapters) || [];
    if (chapterVerses.length) return step > 0 ? chapterVerses[0] : chapterVerses[chapterVerses.length - 1];
  }
  return null;
}

/**
 * The verse plus whatever the phone asked to travel with it: a second
 * translation for a dual reading, and a transition of its own.
 *
 * Resolved here rather than on the phone because the second translation's text
 * has to come from the app's bible, and because a missing verse in that
 * translation should quietly leave a single-verse projection rather than half
 * of a comparison.
 */
function remoteProjection(verse, body) {
  const projection = { ...verse };

  const secondaryVersion = body?.secondaryVersionId;
  if (secondaryVersion) {
    const chapter = bibleService.getChapter(secondaryVersion, verse.book, verse.chapter) || [];
    const match = chapter.find((entry) => entry.verse === Number(verse.verse));
    if (match) {
      projection.secondary = { text: match.text, reference: match.reference, version: match.version };
      projection.dualLayout = body?.dualLayout === 'horizontal' ? 'horizontal' : 'vertical';
    }
  }

  return projection;
}

// ── API Handlers for REST / Mobile Remote ──
const apiHandlers = {
  /* Just enough for the phone's translation picker: no book lists, which is
     most of what getVersions() carries and none of what a picker needs. */
  'GET /api/bible/versions': () => ({
    ok: true,
    versions: (bibleService.getVersions() || []).map(({ id, name, abbreviation, language, isUser }) => ({
      id, name, abbreviation, language, isUser: Boolean(isUser),
    })),
  }),
  /* A reference is a place in a chapter, not a single result. Asking for
     "John 1:1" answers with all of John 1 and names the verse that was asked
     for, which is what the desktop console does — the phone should read the
     same way, and `focus` is how it knows where to start reading. A phrase is
     still a search and still comes back as matches. */
  'POST /api/verse/search': ({ body }) => {
    const version = body?.versionId || 'KJV';
    const query = body?.query || '';
    const ref = bibleService.parseReference(query, version);
    if (ref && ref.book) {
      const chapter = bibleService.getChapter(version, ref.book, ref.chapter) || [];
      if (chapter.length) {
        const focused = chapter.find((verse) => verse.verse === ref.verseStart) || chapter[0];
        return { ok: true, results: chapter, focus: focused.reference };
      }
    }
    const results = bibleService.search(version, query, body?.limit || 20, { book: body?.book || '' });
    return { ok: true, results, focus: null };
  },
  'POST /api/verse/chapter': ({ body }) => {
    const verses = bibleService.getChapter(body?.versionId || 'KJV', body?.book, body?.chapter);
    return { ok: true, verses };
  },
  /* The book shelf for the phone's own navigator: names and chapter counts
     only, so the picker does not carry the text of the whole bible. */
  'GET /api/bible/books': ({ query }) => ({
    ok: true,
    books: (bibleService.getBooks(query?.versionId || 'KJV') || [])
      .map(({ name, chapters }) => ({ name, chapters })),
  }),
  /* Strong's numbers for the verses on screen, in one request rather than one
     per card. Tokenised by the same lexicon the desk uses, so the phone never
     invents its own idea of which word carries which number. */
  'POST /api/verse/strongs': async ({ body }) => {
    const verses = (Array.isArray(body?.verses) ? body.verses : []).slice(0, 60)
      .map((verse) => ({ text: String(verse?.text || ''), book: String(verse?.book || '') }));
    const annotations = await askRenderer('annotate', { verses });
    /* Null means the desk did not answer. Answering anyway with a second
       lexicon is how the phone ended up with numbers the desk disagreed
       with. */
    if (!Array.isArray(annotations)) return { ok: false, error: 'The app is not answering for Strong’s numbers' };
    return { ok: true, annotations };
  },
  /* A Strong's number tapped on the phone puts the desk's word-study card on
     the screen; tapping it again restores the verse from the phone's side. */
  'POST /api/display/wordstudy': async ({ body }) => {
    const code = String(body?.code || '').trim();
    if (!code) return { ok: false, error: 'No Strong’s number in the request' };
    const entry = await askRenderer('lookup', { code });
    if (!entry || !entry.strongs) return { ok: false, error: 'That number is not in the lexicon' };
    const scene = wordStudyScene(entry);
    return { ok: true, scene, state: showScene(scene) };
  },
  /* FX for the programme. The renderer owns fxSettings and pushes them outward
     with every state update, so this asks rather than writes. */
  'POST /api/fx': ({ body }) => {
    const patch = {};
    if (typeof body?.transitionType === 'string' && body.transitionType) patch.transitionType = body.transitionType;
    if (Number.isFinite(Number(body?.duration))) patch.duration = Math.min(5, Math.max(0.1, Number(body.duration)));
    if (typeof body?.animateBackground === 'boolean') patch.animateBackground = body.animateBackground;
    if (typeof body?.stageDisplayFxEnabled === 'boolean') patch.stageDisplayFxEnabled = body.stageDisplayFxEnabled;
    if (!Object.keys(patch).length) return { ok: false, error: 'No FX setting in the request' };
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: 'The app window is not open' };
    mainWindow.webContents.send('display:set-fx-settings', patch);
    return { ok: true, settings: patch };
  },
  'POST /api/display/project': ({ body }) => {
    const v = body?.verse;
    if (!v || !v.text) return { ok: false, error: 'No verse in the request' };
    return { ok: true, state: projectVerse(remoteProjection(v, body)) };
  },
  /* One step through the reading. Previous/Next on the phone is this endpoint
     with a direction, not a list the phone walks by itself. */
  'POST /api/display/step': ({ body }) => {
    const live = displayState.scene && displayState.scene.content;
    if (!live || !live.reference) return { ok: false, error: 'Nothing on screen to step from' };
    const verse = neighborVerse(body?.direction === 'previous' ? 'previous' : 'next', body?.versionId);
    if (!verse) return { ok: false, error: 'Nothing beyond that verse' };
    return { ok: true, verse, state: projectVerse(remoteProjection(verse, body)) };
  },
  'POST /api/display/clear': () => {
    setDisplayState({ scene: null, type: null });
    return { ok: true };
  },
  'POST /api/display/blackout': () => {
    // Same reason as the Cmd+Shift+B shortcut: the renderer owns the flag.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:blackout');
      return { ok: true, blackout: !displayState.blackout };
    }
    setDisplayState({ blackout: !displayState.blackout });
    return { ok: true, blackout: displayState.blackout };
  },
  /* FS/LT for the audience screen. Same reason as blackout: the renderer owns
     the mode and pushes it outward, so writing only this process's copy would
     be undone by the next state push. NDI feeds have render modes of their own
     per feed and are deliberately not reachable from here. */
  'POST /api/display/mode': ({ body }) => {
    const mode = body?.mode === 'lowerThird' ? 'lowerThird' : body?.mode === 'fullscreen' ? 'fullscreen' : null;
    if (!mode) return { ok: false, error: 'Unknown screen mode' };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('display:set-output-mode', mode);
      return { ok: true, mode };
    }
    setDisplayState({ outputMode: mode });
    return { ok: true, mode };
  },
  'GET /api/display/state': () => ({ ok: true, state: displayState }),
  /* The stage's feed, as a summary rather than the state object itself.
     `stageState` carries a whole theme, a layout with zones, and sometimes a
     packed projection — none of which a phone needs, and all of which would
     then be handed to anything holding the session key. Enough to say what
     the stage is showing, and whether it is open at all. */
  'GET /api/stage/state': () => stageSummary(),
  /* The stage clock, from the phone. Answers with the summary so the card can
     redraw from the result instead of waiting for the broadcast it caused. */
  'POST /api/stage/timer': ({ body }) => {
    const timer = setStageTimer(body?.command);
    if (!timer) return { ok: false, error: 'Unknown timer command' };
    return { ok: true, timer, state: stageSummary() };
  },
  'GET /api/status': () => ({
    ok: true, displayState, ndi: ndiService?.status() || { available: false },
    session: sessionHistory?.getStatus() || { active: false },
    endArm: endArmState(),
    ai: transcriptionService?.status() || { ok: false },
  }),
  'POST /api/session/start': ({ body }) => {
    setEndArm(false);
    return sessionHistory?.startSession(body?.name);
  },
  'POST /api/session/end': () => { setEndArm(false); return sessionHistory?.endSession(); },
  /* Arming is kept in main, not in either page, so one surface's first tap is
     visible on the other before the second tap lands. */
  'POST /api/session/end/arm': ({ body }) => ({ ok: true, ...setEndArm(body?.armed !== false) }),
  'POST /api/session/rename': ({ body }) => sessionHistory?.renameSession(body?.name),
  'GET /api/session/list': () => ({ ok: true, sessions: sessionHistory?.listSessions() || [] }),
  'GET /api/session/export': ({ query }) => sessionHistory?.exportSession(query?.id, query?.format || 'json'),
  'POST /api/ndi/start': () => {
    const result = ndiService?.start(DEFAULT_NDI_NAME);
    if (result?.ok) {
      if (!displayWindow || displayWindow.isDestroyed()) {
        createDisplayWindow();
      }
      if (displayWindow && !displayWindow.isDestroyed()) {
        ndiService.setDisplayWindow(displayWindow);
        ndiService.startCapture(30, { width: 1920, height: 1080 });
      }
    }
    return result || { ok: false, error: 'NDI not available' };
  },
  'POST /api/ndi/stop': () => ndiService?.stop() || { ok: true },
};

function startHttpServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pn = url.pathname;

    // Static files
    // ProgramSurface browser output (slides + verses). Legacy flat display.html
    // stays available at /legacy-display.html for debugging.
    /* Every page that can paint the projector or drive it is gated. The static
       asset routes below stay open: they are media and fonts, which carry no
       authority of their own. */
    if (pn === '/display.html' || pn === '/' || pn === '/browser-display.html'
      || pn === '/legacy-display.html' || pn === '/remote.html') {
      if (!isAuthorized(req, url)) { sendAuthRequired(res); return; }
      const page = pn === '/remote.html' ? 'remote.html'
        : pn === '/legacy-display.html' ? 'display.html'
          : 'browser-display.html';
      serveHtmlFile(page, authorizedPageHeaders(url))(req, res);
      return;
    }
    if (pn.startsWith('/fonts/')) { serveStatic('fonts')(req, res, url); return; }
    if (pn.startsWith('/themes/')) { serveStatic('themes')(req, res, url); return; }
    if (pn.startsWith('/lowerthirds/')) { serveStatic('lowerthirds')(req, res, url); return; }
    if (pn.startsWith('/assets/')) { serveStatic('assets')(req, res, url); return; }

    // User-imported media from userData/media. Serves byte ranges so <video> can
    // seek and loop instead of refetching the whole file.
    if (pn.startsWith('/media/')) { serveMedia(req, res, decodeURIComponent(pn.slice('/media/'.length))); return; }

    // REST API
    if (pn.startsWith('/api/')) {
      /* Checked before the body is read, so an unauthorized caller costs us
         nothing and cannot use the endpoint as a parser oracle. */
      if (!isAuthorized(req, url)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        });
        res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
        return;
      }
      const method = req.method;
      let body = '';
      req.on('data', (chunk) => body += chunk);
      req.on('end', () => {
        const key = method + ' ' + pn;
        const handler = apiHandlers[key];
        if (!handler) { res.writeHead(404); res.end(JSON.stringify({ ok: false, error: 'Not found' })); return; }
        try {
          const parsed = body ? JSON.parse(body) : {};
          const params = new URLSearchParams(url.search);
          const query = {};
          params.forEach((v, k) => query[k] = v);
          /* Awaited: some handlers answer through the renderer (the lexicon),
             and writing the response before the promise settles would send an
             empty body. */
          Promise.resolve(handler({ body: parsed, query })).then((result) => {
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            });
            res.end(JSON.stringify(result));
          }).catch((error) => {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: error && error.message ? error.message : String(error) }));
          });
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404); res.end('Not Found');
  });

  /* A port conflict costs a port number, not the app. If the whole range is
     taken the app still runs — without the phone remote and browser output —
     and display:getStatus says why. */
  listenWithFallback(server, {
    basePort: HTTP_PORT_BASE,
    attempts: HTTP_PORT_ATTEMPTS,
    onListening: (port) => {
      displayPort = port;
      httpServerError = null;
      console.log(`BSP Server: http://0.0.0.0:${port}/display.html | Remote: http://0.0.0.0:${port}/remote.html`);
    },
    onError: (message) => {
      httpServerError = message;
      console.error(`BSP Server: ${message}`);
    },
  });

  httpServer = server;
  wss = new WebSocketServer({
    server,
    perMessageDeflate: false,
    /* The socket carries program state and relays operator commands between
       clients, so it is exactly as sensitive as the REST API and is gated the
       same way. A handshake from a page that was never handed the token — or
       from a script that found the port — is refused here rather than after
       it has already been sent the current display state. */
    verifyClient: (info, done) => {
      let reqUrl;
      try {
        reqUrl = new URL(info.req.url || '/', 'http://localhost');
      } catch {
        done(false, 400, 'Bad Request');
        return;
      }
      if (isAuthorized(info.req, reqUrl)) { done(true); return; }
      done(false, 401, 'Unauthorized');
    },
  });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'display:update', state: displayState }));
    // Relay must re-send as text: forwarding the raw Buffer produces a binary frame,
    // which browsers surface as a Blob and JSON.parse silently rejects.
    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      wss.clients.forEach((c) => { if (c !== ws && c.readyState === 1) c.send(text); });
    });
  });
}

function createSplashWindow() {
  const isMac = process.platform === 'darwin';
  const s = new BrowserWindow({
    width: 1000,
    height: 620,
    frame: false,
    transparent: isMac,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#0C0B0B',
    center: true,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  /* The splash has no preload and no node access, so the version is passed in
     the URL. It is read from the running build, never hardcoded in the page. */
  const v = `?v=${encodeURIComponent(app.getVersion())}`;
  s.loadURL(isDev
    ? `http://localhost:5173/splash.html${v}`
    : `file://${path.join(__dirname, '../../dist/splash.html')}${v}`);
  s.center();
  return s;
}

function createMainWindow({ autoShow = true } = {}) {
  /* backgroundThrottling off here too: the operator's own Program pane plays
     the same clip, and an operator who alt-tabs to their notes and back should
     not find their preview a minute behind the room. */
  const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 640, minHeight: 480, frame: true, resizable: true, maximizable: true, fullscreenable: true, thickFrame: true, backgroundColor: '#0c0e14', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true, backgroundThrottling: false } });
  win.setResizable(true);
  win.setMinimumSize(640, 480);
  win.loadURL(isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../../dist/index.html')}`);
  if (isDev) win.webContents.openDevTools();
  /* Bring-up passes autoShow:false and shows the window itself, so the
     console cannot appear from behind the splash mid-animation. */
  if (autoShow) win.once('ready-to-show', () => { win.maximize(); win.show(); win.focus(); });
  return win;
}

/**
 * Monitor list for the output picker. Uses the OS-reported label ("DELL U2720Q") when
 * there is one, since "Display 2" tells an operator nothing about which screen is the
 * projector.
 */
function getDisplayPayload() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display, index) => {
    const isPrimary = display.id === primary.id;
    const isInternal = Boolean(display.internal);
    const fallback = isInternal
      ? (isPrimary ? 'Built-in Display' : `Internal Display ${index + 1}`)
      : `External Display ${index + 1}`;
    return {
      id: String(display.id),
      index,
      name: display.label || fallback,
      label: display.label || fallback,
      isPrimary,
      isInternal,
      bounds: display.bounds,
      resolution: `${Math.round(display.bounds.width * display.scaleFactor)}×${Math.round(display.bounds.height * display.scaleFactor)}`,
      scaleFactor: display.scaleFactor,
    };
  });
}

/**
 * 'auto' prefers a real external monitor — the projector — over the operator's own
 * screen, which is almost always what's wanted.
 */
function chooseDisplay(displayId) {
  const displays = screen.getAllDisplays();
  if (displays.length === 0) return null;
  const primary = screen.getPrimaryDisplay();

  if (displayId !== undefined && displayId !== null && displayId !== 'auto') {
    const exact = displays.find((d) => String(d.id) === String(displayId));
    if (exact) return exact;
    // Legacy callers passed an index
    if (typeof displayId === 'number' && displays[displayId]) return displays[displayId];
  }

  return displays.find((d) => !d.internal && d.id !== primary.id)
    || displays.find((d) => !d.internal)
    || displays.find((d) => d.id !== primary.id)
    || primary
    || displays[0];
}

function broadcastDisplayList() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('display:listChanged', getDisplayPayload());
  }
}

/**
 * Whether any stage screen is up, pushed to the operator window.
 *
 * The Stage panel used to read `isExternalDisplayActive` for this, which is
 * the projector's state — so its lamp lit when the audience output came on,
 * whether or not a stage screen existed. The stage is its own output and
 * needs its own answer.
 */
function broadcastStageWindows() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isOpen = Boolean((stageDisplayWindow && !stageDisplayWindow.isDestroyed() && stageDisplayWindow.isVisible()) || [...liveStageWindows()].some((w) => w.isVisible()));
    mainWindow.webContents.send('stage-display:state', { open: isOpen });
  }
  /* Opening or closing a stage screen changes `open` in the summary, and the
     phone has no other way to hear about it. */
  broadcastStageSummary();
}

function resizableOutputBounds(bounds) {
  const margin = 48;
  const width = Math.max(640, Math.min(1280, bounds.width - margin * 2));
  const height = Math.max(360, Math.round(width * 9 / 16));
  const fittedHeight = Math.min(height, Math.max(360, bounds.height - margin * 2));
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - fittedHeight) / 2),
    width: Math.round(width),
    height: Math.round(fittedHeight),
  };
}

let stageDisplayWindow = null;

function createDisplayWindow(targetOrBounds, options = {}) {
  const primary = screen.getPrimaryDisplay();
  let targetDisplay = null;
  let explicitBounds = null;

  if (targetOrBounds && typeof targetOrBounds.id !== 'undefined') {
    targetDisplay = targetOrBounds;
  } else if (targetOrBounds && typeof targetOrBounds.width === 'number') {
    explicitBounds = targetOrBounds;
    const allDisplays = screen.getAllDisplays();
    targetDisplay = allDisplays.find((d) =>
      d.bounds.x === explicitBounds.x && d.bounds.y === explicitBounds.y &&
      d.bounds.width === explicitBounds.width && d.bounds.height === explicitBounds.height
    ) || primary;
  } else {
    targetDisplay = chooseDisplay('auto') || primary;
  }

  const isFullScreen = options.fullscreen !== undefined ? options.fullscreen : true;

  if (displayWindow && !displayWindow.isDestroyed()) {
    const isCurrentlyFrameless = Boolean(displayWindow.__isFrameless);
    if (isCurrentlyFrameless !== isFullScreen) {
      displayWindow.close();
      displayWindow = null;
    } else {
      if (isFullScreen) {
        displayWindow.setBounds(targetDisplay.bounds);
        try { displayWindow.setContentBounds(targetDisplay.bounds); } catch {}
      } else {
        displayWindow.setBounds(explicitBounds || resizableOutputBounds(targetDisplay.bounds));
      }
      if (options.show !== false) {
        displayWindow.show();
        broadcastDisplayState();
      } else {
        displayWindow.hide();
      }
      return displayWindow;
    }
  }

  const bounds = isFullScreen
    ? targetDisplay.bounds
    : (explicitBounds || resizableOutputBounds(targetDisplay.bounds || screen.getPrimaryDisplay().workArea || screen.getPrimaryDisplay().bounds));
  const showWindow = options.show !== false;

  displayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 640,
    minHeight: 360,
    frame: !isFullScreen,
    autoHideMenuBar: true,
    resizable: !isFullScreen,
    maximizable: true,
    fullscreenable: true,
    thickFrame: !isFullScreen,
    transparent: true,
    backgroundColor: '#00000000',
    show: showWindow,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  displayWindow.__isFrameless = isFullScreen;

  if (isFullScreen) {
    displayWindow.setBounds(targetDisplay.bounds);
    try { displayWindow.setContentBounds(targetDisplay.bounds); } catch {}
  } else {
    displayWindow.setResizable(true);
    displayWindow.setMinimumSize(640, 360);
    displayWindow.setAspectRatio(16 / 9);
  }

  displayWindow.loadURL(isDev ? 'http://localhost:5173/audience-display.html' : `file://${path.join(__dirname, '../../dist/audience-display.html')}`);
  displayWindow.setMenuBarVisibility(false);
  // Audio Isolation: Secondary display/capture surfaces never output duplicate audio to system speakers
  displayWindow.webContents.setAudioMuted(true);

  displayWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      activeDisplayId = null;
      displayWindow.hide();
      broadcastDisplayState();
    }
  });

  // Crash Resilience & Auto-Recovery
  displayWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[DisplayWindow] Renderer process crash detected:', details);
    if (displayWindow && !displayWindow.isDestroyed()) {
      setTimeout(() => {
        if (displayWindow && !displayWindow.isDestroyed()) {
          console.info('[DisplayWindow] Auto-recovering display window after crash...');
          displayWindow.reload();
        }
      }, 250);
    }
  });

  displayWindow.webContents.on('unresponsive', () => {
    console.warn('[DisplayWindow] Window became unresponsive.');
  });

  displayWindow.webContents.on('did-finish-load', () => {
    broadcastDisplayState();
    if (ndiService && ndiService.status().running) {
      ndiService.setDisplayWindow(displayWindow);
      ndiService.startCapture();
    }
  });
  return displayWindow;
}

function createStageDisplayWindow(targetDisplay, options = {}) {
  const primary = screen.getPrimaryDisplay();
  const target = targetDisplay || chooseDisplay('auto') || primary;
  const isFullScreen = options.fullscreen !== undefined ? options.fullscreen : true;
  const bounds = isFullScreen ? target.bounds : resizableOutputBounds(target.bounds || screen.getPrimaryDisplay().workArea || screen.getPrimaryDisplay().bounds);
  const showWindow = options.show !== false;

  if (stageDisplayWindow && !stageDisplayWindow.isDestroyed()) {
    const isCurrentlyFrameless = Boolean(stageDisplayWindow.__isFrameless);
    if (isCurrentlyFrameless !== isFullScreen) {
      stageDisplayWindow.close();
      stageDisplayWindow = null;
    } else {
      if (isFullScreen) {
        stageDisplayWindow.setBounds(target.bounds);
        try { stageDisplayWindow.setContentBounds(target.bounds); } catch {}
      } else {
        stageDisplayWindow.setBounds(bounds);
      }
      stageWindows.add(stageDisplayWindow);
      if (showWindow) {
        stageDisplayWindow.show();
        stageDisplayWindow.webContents.send('display:message', { type: 'display:update', state: displayState });
        if (Object.keys(stageState).length > 0) stageDisplayWindow.webContents.send('stage:message', stageState);
      } else {
        if (stageDisplayWindow.isFullScreen()) {
          stageDisplayWindow.setFullScreen(false);
        }
        stageDisplayWindow.hide();
      }
      broadcastStageWindows();
      return stageDisplayWindow;
    }
  }

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 640,
    minHeight: 480,
    frame: !isFullScreen,
    autoHideMenuBar: true,
    resizable: !isFullScreen,
    maximizable: true,
    fullscreenable: true,
    thickFrame: !isFullScreen,
    enableLargerThanScreen: true,
    backgroundColor: '#000000',
    title: 'BSP Stage Display',
    show: showWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  win.__isFrameless = isFullScreen;

  if (isFullScreen) {
    win.setBounds(target.bounds);
    try {
      win.setContentBounds(target.bounds);
    } catch {}
  }

  stageDisplayWindow = win;
  win.loadURL(isDev ? 'http://localhost:5173/stage-display.html' : `file://${path.join(__dirname, '../../dist/stage-display.html')}`);
  win.setMenuBarVisibility(false);
  win.webContents.setAudioMuted(true);

  stageWindows.add(win);
  broadcastStageWindows();

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
      broadcastStageWindows();
    }
  });

  win.on('closed', () => {
    stageWindows.delete(win);
    if (stageDisplayWindow === win) stageDisplayWindow = null;
    broadcastStageWindows();
  });

  // Crash Resilience & Auto-Recovery (OBS Parity: Stage Display never stays down)
  win.webContents.on('render-process-gone', (event, details) => {
    console.error('[StageDisplay] Renderer process crash detected:', details);
    if (!win.isDestroyed()) {
      setTimeout(() => {
        if (!win.isDestroyed()) {
          console.info('[StageDisplay] Auto-recovering stage display window after crash...');
          win.reload();
        }
      }, 250);
    }
  });

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('display:message', { type: 'display:update', state: displayState });
      if (Object.keys(stageState).length > 0) win.webContents.send('stage:message', stageState);
    }
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

/**
 * The Stage Layout Designer, in a window of its own.
 *
 * Its own window rather than a modal in the operator's: designing a layout is
 * a two-screen job — the canvas here, the stage screen over there — and a
 * modal that owns the operator's whole window means the person laying out a
 * confidence monitor cannot see the confidence monitor. One at a time, and a
 * second call focuses the one already open rather than opening a rival editor
 * onto the same layouts.
 */
let prewarmedStageDesignerWindow = null;

function setupStageDesignerEvents(win) {
  const contentsId = win.webContents.id;

  win.on('closed', () => {
    stageDesignerWindows.delete(win);
    dirtyDesigners.delete(contentsId);
    if (prewarmedStageDesignerWindow === win) {
      prewarmedStageDesignerWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  let closeConfirmed = false;
  win.on('close', (event) => {
    if (closeConfirmed || !dirtyDesigners.get(contentsId)) {
      if (!app.isQuitting) {
        event.preventDefault();
        stageDesignerWindows.delete(win);
        dirtyDesigners.delete(contentsId);
        win.hide();
        prewarmedStageDesignerWindow = win;
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
      return;
    }
    event.preventDefault();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Discard changes'],
      defaultId: 0,
      cancelId: 0,
      message: 'This layout has unsaved changes.',
      detail: 'Closing the designer now will discard them.',
    }).then(({ response }) => {
      if (response !== 1 || win.isDestroyed()) {
        if (win && !win.isDestroyed()) {
          win.focus();
        }
        return;
      }
      closeConfirmed = true;
      dirtyDesigners.delete(contentsId);
      if (!app.isQuitting) {
        win.hide();
        stageDesignerWindows.delete(win);
        prewarmedStageDesignerWindow = win;
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      } else {
        win.close();
      }
    }).catch(() => {});
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('display:message', { type: 'display:update', state: displayState });
    if (Object.keys(stageState).length > 0) win.webContents.send('stage:message', stageState);
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

function prewarmStageDesignerWindow() {
  if (prewarmedStageDesignerWindow && !prewarmedStageDesignerWindow.isDestroyed()) return;
  try {
    const win = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1040,
      minHeight: 640,
      resizable: true,
      maximizable: true,
      fullscreenable: true,
      thickFrame: true,
      show: false,
      backgroundColor: '#0b0d12',
      title: 'BSP Stage Layout Designer',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });
    win.loadURL(isDev ? 'http://localhost:5173/stage-designer.html' : `file://${path.join(__dirname, '../../dist/stage-designer.html')}`);
    win.setMenuBarVisibility(false);
    setupStageDesignerEvents(win);
    prewarmedStageDesignerWindow = win;
  } catch (e) {
    console.warn('[StageDesigner] Prewarm failed:', e);
  }
}

function createStageDesignerWindow() {
  for (const existing of liveStageDesignerWindows()) {
    if (existing.isVisible()) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
      return existing;
    }
  }

  if (prewarmedStageDesignerWindow && !prewarmedStageDesignerWindow.isDestroyed()) {
    const win = prewarmedStageDesignerWindow;
    stageDesignerWindows.add(win);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('display:message', { type: 'display:update', state: displayState });
    if (Object.keys(stageState).length > 0) win.webContents.send('stage:message', stageState);
    broadcastStageLayouts();
    return win;
  }

  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1040, minHeight: 640,
    resizable: true, maximizable: true, fullscreenable: true, thickFrame: true,
    backgroundColor: '#0b0d12', title: 'BSP Stage Layout Designer',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true, backgroundThrottling: false },
  });
  win.loadURL(isDev ? 'http://localhost:5173/stage-designer.html' : `file://${path.join(__dirname, '../../dist/stage-designer.html')}`);
  win.setMenuBarVisibility(false);
  setupStageDesignerEvents(win);
  stageDesignerWindows.add(win);
  win.show();
  win.focus();
  return win;
}

/** Tell every window that the saved-layout list has changed, so the operator
    panel's dropdown and the designer's library cannot disagree about what
    exists. */
function broadcastStageLayouts() {
  const payload = stageLayoutsService.list();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('stage-layouts:changed', payload);
  }
}

function broadcastDockPopouts() {
  const ids = Array.from(dockPopoutWindows.keys());
  buildAppMenu([...menuOpenIds, ...ids]);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('dock:popouts', ids);
  }
}

function createDockPopoutWindow(dockId) {
  const id = String(dockId || '');
  const def = DOCK_DEFS.find((entry) => entry && entry.id === id);
  if (!def) return { ok: false, error: 'Unknown dock' };

  const existing = dockPopoutWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return { ok: true };
  }

  let x, y;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    x = Math.round(mainBounds.x + Math.max(20, (mainBounds.width - 540) / 2));
    y = Math.round(mainBounds.y + 60);
  }

  const win = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 340,
    minHeight: 280,
    x,
    y,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    fullscreen: false,
    alwaysOnTop: true,
    thickFrame: true,
    backgroundColor: '#b8b8bd',
    title: def.label,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();

  const query = `dock=${encodeURIComponent(id)}`;
  win.loadURL(isDev
    ? `http://localhost:5173/dock-popout.html?${query}`
    : `file://${path.join(__dirname, '../../dist/dock-popout.html')}?${query}`);
  win.setMenuBarVisibility(false);
  dockPopoutWindows.set(id, win);
  win.on('closed', () => {
    dockPopoutWindows.delete(id);
    broadcastDockPopouts();
  });
  win.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('store:syncRequest');
    }
    broadcastDockPopouts();
  });
  return { ok: true };
}

/* There is one slide editor: the in-app React one (SlideEditorModal, over
   src/renderer/components/slide-editor and the slide-engine parser). The
   legacy HTML editor that used to open in its own window — public/slide-editor,
   a prebuilt bundle — is retired. Its parser still earns its keep as the
   reference the port was verified against, so it lives on at
   scripts/slide-engine-oracle/ and is loaded only by the parity harness in dev.
   It is deliberately not in public/, because everything there is copied into
   the shipped build. */

app.whenReady().then(async () => {
  // Session permission request handler
  if (session && session.defaultSession) {
    /* Was `callback(true)` for everything. That handed camera, microphone,
       geolocation and clipboard to any frame in any window — including remote
       pages the operator embedded as a background. The allowlist is what this
       app actually uses; the origin check is what keeps it ours. */
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const pageUrl = webContents?.getURL?.() || '';
      callback(ALLOWED_PERMISSIONS.has(permission) && isAppUrl(pageUrl));
    });
    session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
      ALLOWED_PERMISSIONS.has(permission) && permissionOriginAllowed(requestingOrigin));

    // OBS Studio Browser Source Parity: Strip X-Frame-Options and frame-ancestors CSP
    // so any external web page, dashboard, timer, church stream, or overlay can be framed cleanly
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      delete responseHeaders['x-frame-options'];
      delete responseHeaders['X-Frame-Options'];
      delete responseHeaders['frame-options'];
      delete responseHeaders['Frame-Options'];

      const stripCsp = (headerKey) => {
        if (responseHeaders[headerKey] && Array.isArray(responseHeaders[headerKey])) {
          responseHeaders[headerKey] = responseHeaders[headerKey].map((csp) =>
            csp.replace(/frame-ancestors\s+[^;]+;?/gi, '')
          );
        }
      };
      stripCsp('content-security-policy');
      stripCsp('Content-Security-Policy');

      callback({ responseHeaders });
    });
  }

  // Trigger macOS system permission prompts for Microphone and Camera
  if (process.platform === 'darwin' && systemPreferences && systemPreferences.askForMediaAccess) {
    systemPreferences.askForMediaAccess('microphone').then((granted) => {
      console.log('macOS Microphone Access:', granted ? 'GRANTED' : 'DENIED');
    }).catch(() => { });
    systemPreferences.askForMediaAccess('camera').then((granted) => {
      console.log('macOS Camera Access:', granted ? 'GRANTED' : 'DENIED');
    }).catch(() => { });
  }

  transcriptionService = createTranscriptionService({ app });
  verseDetectionService = createVerseDetectionService();
  ndiService = createNdiService();
  sessionHistory = createSessionHistoryService({ app });
  songImportService = createSongImportService();
  appStoreService = createAppStoreService({ app });
  stageLayoutsService = createStageLayoutsService({ app });
  mediaService = createMediaService({ app });
  settingsService = createSettingsService({ app });
  deepgramService = createDeepgramService({
    emit: (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('stt:event', event);
    },
  });
  deepgramService.configure({
    apiKey: settingsService.get('deepgramApiKey'),
    model: settingsService.get('deepgramModel'),
    language: settingsService.get('deepgramLanguage'),
  });
  /* Restore the operator's on-device recogniser. Only when they chose one —
     an empty setting leaves the service on its own default, so the default is
     stated in exactly one place. An unknown key (a model dropped from a later
     build) is refused by setModel and simply leaves the default standing. */
  const savedLocalModel = settingsService.get('sttLocalModel');
  if (savedLocalModel) transcriptionService.setLocalModel(savedLocalModel);
  obsService = createObsService({
    emit: (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('obs:event', event);
    },
  });
  initRecordingsService(ipcMain, () => mainWindow);
  startHttpServer();
  sessionHistory.startSession('BSP Session');

  // Build the verse search index off the critical path so the first live detection
  // isn't paying for it mid-service.
  setTimeout(() => {
    try {
      const warmed = verseDetectionService.warmIndex('KJV');
      console.log(`Verse index ready: ${warmed.verses} verses, ${warmed.terms} terms in ${warmed.buildMs}ms`);
    } catch (err) {
      console.error('Verse index warm failed:', err.message);
    }
  }, 1500);

  /* Every ipcMain handler below is registered before the first window exists.
     The splash sits on an await, so a window opened while that await is
     pending would have a preload whose invokes land on a main process that has
     not registered anything yet — "No handler registered for ..." — which is
     why the bring-up now happens at the very bottom of this block. */

  // Install the initial native menu (all docks unchecked until the renderer
  // loads and pushes its first dock:syncMenu).
  buildAppMenu([]);

  // Renderer pushes the current open-dock id list on every layout change so
  // the native menu checkmarks stay in sync without polling.
  ipcMain.on('dock:syncMenu', (_, openIds) => {
    menuOpenIds = Array.isArray(openIds) ? openIds : [];
    buildAppMenu([...menuOpenIds, ...dockPopoutWindows.keys()]);
  });
  ipcMain.on('ui:setLocale', (_, locale) => {
    setMenuLocale(locale);
    buildAppMenu([...menuOpenIds, ...dockPopoutWindows.keys()]);
  });
  ipcMain.handle('dock:popOut', (_, p) => createDockPopoutWindow(p?.id));
  ipcMain.handle('dock:closePopout', (_, p) => {
    const id = String(p?.id || p || '');
    const win = dockPopoutWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    return { ok: true };
  });
  ipcMain.handle('dock:focusPopout', (_, p) => {
    const win = dockPopoutWindows.get(String(p?.id || ''));
    if (!win || win.isDestroyed()) return { ok: false };
    if (win.isMinimized()) win.restore();
    win.focus();
    return { ok: true };
  });
  ipcMain.handle('dock:listPopouts', () => Array.from(dockPopoutWindows.keys()));
  ipcMain.on('store:broadcast', (event, snapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents.id !== event.sender.id) {
        win.webContents.send('store:remote', snapshot);
      }
    }
  });
  ipcMain.on('store:requestSync', (event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents.id !== event.sender.id) {
        win.webContents.send('store:syncRequest');
      }
    }
  });

  /* And the saved arrangements, whenever one is added, renamed, deleted or
     switched to. Only id and name travel — the layout tree is the renderer's
     business and would be dead weight on this side. */
  ipcMain.on('workspace:sync', (_, payload) => {
    const list = Array.isArray(payload?.list)
      ? payload.list
          .filter((w) => w && w.id)
          .map((w) => ({ id: String(w.id), name: String(w.name || 'Untitled layout') }))
      : [];
    menuWorkspaces = { list, activeId: payload?.activeId ? String(payload.activeId) : null };
    buildAppMenu(menuOpenIds);
  });

  // ── Keyboard Shortcuts ──
  globalShortcut.register('CommandOrControl+Shift+F', () => { mainWindow?.webContents.send('shortcut:fullscreen'); });
  /* Asks the renderer to flip its own blackout rather than writing this
     process's copy: the renderer owns the flag and pushes it out with the rest
     of the display state, so a value set here alone was reverted by the next
     push. Falls back to the local toggle if the window is gone. */
  globalShortcut.register('CommandOrControl+Shift+B', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('shortcut:blackout');
    else setDisplayState({ blackout: !displayState.blackout });
  });
  globalShortcut.register('CommandOrControl+Shift+N', () => { ndiService?.start(DEFAULT_NDI_NAME); });
  globalShortcut.register('CommandOrControl+Shift+E', () => { setEndArm(false); sessionHistory?.endSession(); });
  globalShortcut.register('CommandOrControl+Shift+P', () => { sessionHistory?.startSession(); });
  globalShortcut.register('F5', () => { if (displayWindow && !displayWindow.isDestroyed()) displayWindow.reload(); });

  // ── IPC ──
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());
  ipcMain.handle('window:isFullScreen', () => mainWindow?.isFullScreen());

  ipcMain.handle('display:open', (_, arg) => {
    // Accepts { displayId } | 'auto' | legacy index
    const displayId = (arg && typeof arg === 'object') ? arg.displayId : arg;
    const target = chooseDisplay(displayId);
    if (!target) return { ok: false, error: 'No displays available' };
    activeDisplayId = String(target.id);
    createDisplayWindow(target, { show: true });
    return { ok: true, displayId: activeDisplayId, label: getDisplayPayload().find((d) => d.id === activeDisplayId)?.label || '' };
  });
  ipcMain.handle('display:toggleFullScreen', () => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      const isFull = displayWindow.isFullScreen();
      displayWindow.setFullScreen(!isFull);
      return !isFull;
    }
    return false;
  });
  ipcMain.handle('display:close', () => {
    activeDisplayId = null;
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.hide();
    }
    return { ok: true };
  });
  ipcMain.handle('display:getDisplays', () => getDisplayPayload());
  ipcMain.handle('display:getActive', () => ({ ok: true, displayId: activeDisplayId, isOpen: Boolean(activeDisplayId && displayWindow && !displayWindow.isDestroyed() && displayWindow.isVisible()) }));
  ipcMain.handle('display:sendState', (_, s) => setDisplayState(s));
  ipcMain.handle('display:getState', () => displayState);
  ipcMain.handle('display:isOpen', () => Boolean(activeDisplayId && displayWindow && !displayWindow.isDestroyed() && displayWindow.isVisible()));
  ipcMain.handle('display:getStatus', () => ({
    isOpen: !!(displayWindow && !displayWindow.isDestroyed()),
    url: 'Electron IPC display',
    // Null rather than a plausible-looking URL when nothing is listening —
    // the projector is unaffected by this, but the remote genuinely is not
    // reachable and an address that refuses the connection is worse than none.
    /* Tokenized, because these are the links the operator copies into OBS and
       into their phone. browserUrl stays loopback — it is for a browser on
       this machine. remoteUrl is the network address, which is the whole point
       of a remote: 127.0.0.1 on a phone is the phone. */
    browserUrl: httpServerError ? null : `http://127.0.0.1:${displayPort}/display.html?token=${remoteToken}`,
    remoteUrl: httpServerError ? null : `http://${lanAddress()}:${displayPort}/remote.html?token=${remoteToken}`,
    port: httpServerError ? null : displayPort,
    serverError: httpServerError,
    clients: wss ? wss.clients.size : 0,
    updatedAt: displayState.updatedAt || 0,
  }));

  ipcMain.on('display:message', (event, msg) => {
    if (!msg) return;
    if (msg.type === 'display:update') {
      setDisplayState(msg.state || msg);
    } else {
      if (displayWindow && !displayWindow.isDestroyed() && displayWindow.webContents.id !== event.sender.id) {
        displayWindow.webContents.send('display:message', msg);
      }
      for (const win of liveStageWindows()) {
        if (win && !win.isDestroyed() && win.webContents.id !== event.sender.id) {
          win.webContents.send('display:message', msg);
        }
      }
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.id !== event.sender.id) {
        mainWindow.webContents.send('display:message', msg);
      }
    }
  });

  ipcMain.handle('stage-display:open', (_, arg) => {
    const displayId = (arg && typeof arg === 'object') ? arg.displayId : arg;
    const target = chooseDisplay(displayId);
    createStageDisplayWindow(target, { show: true });
    return true;
  });
  /* Closing every stage screen, not just one: the panel's control is a single
     lamp for "the stage is up", so the off state it promises has to be the
     whole of it. `close`, not `destroy` — the window's own teardown runs. */
  ipcMain.handle('stage-display:close', () => {
    if (stageDisplayWindow && !stageDisplayWindow.isDestroyed()) {
      if (stageDisplayWindow.isFullScreen()) {
        stageDisplayWindow.setFullScreen(false);
      }
      stageDisplayWindow.hide();
    }
    for (const win of [...liveStageWindows()]) {
      if (win && !win.isDestroyed()) {
        if (win.isFullScreen()) win.setFullScreen(false);
        win.hide();
      }
    }
    broadcastStageWindows();
    return { ok: true, open: false };
  });
  ipcMain.handle('stage-display:isOpen', () => liveStageWindows().size > 0);
  ipcMain.handle('stage-designer:open', () => { createStageDesignerWindow(); return true; });
  ipcMain.on('stage-designer:dirty', (event, dirty) => dirtyDesigners.set(event.sender.id, !!dirty));

  /* Back to the app. `close` rather than `hide` so the unsaved-work guard on
     the window runs — Back and the red button must ask the same question. The
     operator window comes forward, because a designer that vanished and left
     whatever happened to be behind it is a designer that lost the operator. */
  ipcMain.handle('stage-designer:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    /* Deferred out of the handler. The reply to this invoke has to travel back
       to the very webContents the close destroys, and tearing that down inside
       the handler leaves the renderer's promise with nowhere to land.
       Returning first and closing on the next tick costs a tick. */
    setImmediate(() => {
      if (win && !win.isDestroyed()) win.close();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
    return true;
  });

  /* The stage's own feed, alongside display:* — same shape, same reasons.
     Anyone on the bus may publish; everyone else receives; a window that opens
     late asks for the retained snapshot. The sender id is passed on so the
     publisher does not receive its own message back. */
  ipcMain.handle('stage:sendState', (event, message) => setStageState(message, event.sender.id));
  ipcMain.handle('stage:getState', () => stageState);
  ipcMain.on('stage:message', (event, message) => setStageState(message, event.sender.id));

  /* Operator-authored layouts. The presets in src/stage/layouts.ts are
     compiled in and read-only; everything the designer saves lives here. */
  ipcMain.handle('stage-layouts:list', () => stageLayoutsService.list());
  ipcMain.handle('stage-layouts:save', (_, layout) => {
    const result = stageLayoutsService.save(layout);
    // Every window with a layout list open is now showing a stale one.
    if (result.ok) broadcastStageLayouts();
    return result;
  });
  ipcMain.handle('stage-layouts:delete', (_, id) => {
    const result = stageLayoutsService.remove(typeof id === 'string' ? id : id?.id);
    if (result.ok) broadcastStageLayouts();
    return result;
  });
  ipcMain.handle('stage-layouts:setActive', (_, id) => {
    const result = stageLayoutsService.setActive(typeof id === 'string' ? id : id?.id);
    /* The active id travels in the same payload as the list, so a window that
       missed this change would show the wrong layout ticked. The designer's
       save fires its own broadcast before this call, carrying the id that was
       active a moment ago — without this one, that stale id is the last word. */
    if (result.ok) broadcastStageLayouts();
    return result;
  });

  ipcMain.handle('get:platform', () => process.platform);
  ipcMain.handle('get:userDataPath', () => app.getPath('userData'));
  ipcMain.handle('get:version', () => app.getVersion());
  ipcMain.handle('get:displayUrl', () => `http://127.0.0.1:${displayPort}/display.html?token=${remoteToken}`);

  let cachedSystemFonts = null;
  ipcMain.handle('fonts:getSystemFonts', async () => {
    if (cachedSystemFonts && cachedSystemFonts.length > 0) {
      return cachedSystemFonts;
    }
    try {
      const families = new Set();
      const platform = process.platform;
      const dirs = [];
      if (platform === 'darwin') {
        dirs.push('/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts'));
      } else if (platform === 'win32') {
        const winDir = process.env.WINDIR || 'C:\\Windows';
        dirs.push(path.join(winDir, 'Fonts'));
      } else {
        dirs.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local/share/fonts'));
      }

      function scan(dir) {
        try {
          if (!fs.existsSync(dir)) return;
          const files = fs.readdirSync(dir, { withFileTypes: true });
          for (const f of files) {
            if (f.isDirectory()) {
              scan(path.join(dir, f.name));
            } else {
              const ext = path.extname(f.name).toLowerCase();
              if (['.ttf', '.otf', '.ttc', '.woff', '.woff2'].includes(ext)) {
                let name = path.basename(f.name, ext);
                name = name.replace(/[-_](Regular|Bold|Italic|Light|Medium|Black|SemiBold|ExtraBold|Thin|Heavy|Oblique)/gi, '');
                name = name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
                if (name && name.length > 1 && !name.startsWith('.')) {
                  families.add(name);
                }
              }
            }
          }
        } catch (_) {}
      }

      dirs.forEach(scan);
      cachedSystemFonts = Array.from(families).sort((a, b) => a.localeCompare(b));
      return cachedSystemFonts;
    } catch (err) {
      console.warn('[fonts:getSystemFonts] Error querying fonts:', err);
      return [];
    }
  });

  /* Opening a link hands control to the operator's browser, so the renderer
     does not get to choose freely: https only, and only hosts we ship links
     to. Anything else is refused and reported rather than opened. */
  const EXTERNAL_HOSTS = new Set([
    'www.youtube.com',
    'youtube.com',
    'github.com',
    'www.github.com',
  ]);

  ipcMain.handle('shell:openExternal', async (_, rawUrl) => {
    let url;
    try {
      url = new URL(String(rawUrl));
    } catch {
      return { ok: false, error: 'Not a valid URL.' };
    }
    if (url.protocol !== 'https:') {
      return { ok: false, error: `Refused ${url.protocol} — https only.` };
    }
    if (!EXTERNAL_HOSTS.has(url.hostname)) {
      return { ok: false, error: `Refused ${url.hostname} — host is not on the allowlist.` };
    }
    await shell.openExternal(url.toString());
    return { ok: true };
  });

  ipcMain.handle('bible:getVersions', () => bibleService.getVersions());
  ipcMain.handle('bible:getBooks', (_, v) => bibleService.getBooks(v));
  ipcMain.handle('bible:getChapter', (_, p) => bibleService.getChapter(p?.versionId, p?.book, p?.chapter));
  ipcMain.handle('bible:search', (_, p) => bibleService.search(p?.versionId, p?.query, p?.limit, { book: p?.book || '' }));
  ipcMain.handle('bible:pick', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Import Bible Translation',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Bible Files (*.xml, *.osis, *.usfx, *.xmm, *.usfm, *.sfm, *.json, *.csv, *.sqlite, *.db)', extensions: ['xml', 'osis', 'usfx', 'xmm', 'usfm', 'sfm', 'json', 'csv', 'sqlite', 'db', 'bible'] },
        { name: 'XML / OSIS / USFX / OpenSong (*.xml, *.osis, *.usfx, *.xmm)', extensions: ['xml', 'osis', 'usfx', 'xmm'] },
        { name: 'USFM Scripture Files (*.usfm, *.sfm)', extensions: ['usfm', 'sfm'] },
        { name: 'JSON & CSV Files (*.json, *.csv)', extensions: ['json', 'csv'] },
        { name: 'SQLite / OpenLP Databases (*.sqlite, *.db)', extensions: ['sqlite', 'db'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths || !res.filePaths.length) {
      return { ok: false, canceled: true };
    }
    return { ok: true, filePaths: res.filePaths };
  });
  ipcMain.handle('bible:importFile', (_, p) => bibleService.importBibleFile(p || {}));
  ipcMain.handle('bible:deleteVersion', (_, p) => bibleService.deleteVersion(p?.versionId || p));

  ipcMain.handle('verse:detect', (_, p) => verseDetectionService.detect(p?.text, p?.options || {}));
  ipcMain.handle('verse:warmIndex', (_, p) => verseDetectionService.warmIndex(p?.versionId || 'KJV'));
  ipcMain.handle('verse:indexStatus', () => verseDetectionService.indexStatus());

  /* The renderer's own Strong's tagging, asked over IPC. The word table the
     desk tags with lives in the renderer, and a second copy up here is exactly
     how the phone came to show numbers the desk disagreed with. */
  ipcMain.on('lexicon:remote-reply', (_event, reply) => {
    const done = reply && lexiconRequests.get(reply.id);
    if (done) done(reply.value);
  });

  ipcMain.handle('lexicon:lookup', (_, query) => lexiconService.lookup(query));
  ipcMain.handle('lexicon:detect', (_, text) => lexiconService.detectWordStudyTerms(text));
  ipcMain.handle('lexicon:annotate', (_, p) => lexiconService.annotateVerseWithStrongs(p?.text, p?.book));

  ipcMain.handle('ai:status', () => transcriptionService.status());
  ipcMain.handle('ai:warmup', (_, p) => transcriptionService.warmup(p));
  ipcMain.handle('ai:transcribe', (_, p) => transcriptionService.transcribe(p));
  ipcMain.handle('ai:dispose', (_, p) => transcriptionService.dispose(p));
  ipcMain.handle('ai:setEngine', (_, e) => transcriptionService.setActiveEngine(e));
  /* Remember the pick. The weights are a download, so a choice that did not
     survive a restart would cost the operator the fetch again. */
  ipcMain.handle('ai:setLocalModel', (_, m) => {
    const result = transcriptionService.setLocalModel(m);
    if (result?.ok) settingsService?.set({ sttLocalModel: m });
    return result;
  });

  // NDI IPC
  ipcMain.handle('ndi:start', async (_, p) => {
    const configuredFeeds = settingsService?.get('ndiFeeds') || [];
    const defaultFeed = configuredFeeds[0] || {
      id: 'default-ndi-feed',
      name: p?.name || DEFAULT_NDI_NAME,
      fps: p?.fps || 30,
      width: p?.width || 1920,
      height: p?.height || 1080,
      contentFilter: 'all',
      renderMode: 'follow_program',
    };
    if (p?.name) defaultFeed.name = p.name;
    if (p?.fps) defaultFeed.fps = p.fps;
    if (p?.width) defaultFeed.width = p.width;
    if (p?.height) defaultFeed.height = p.height;

    const win = createNdiFeedWindow(defaultFeed);
    const r = ndiService?.startFeed(defaultFeed, win);
    return r || { ok: false, error: 'NDI service unavailable' };
  });

  ipcMain.handle('ndi:stop', () => {
    const r = ndiService?.stopAll() || { ok: true };
    for (const win of ndiFeedWindows.values()) {
      if (win && !win.isDestroyed()) win.close();
    }
    ndiFeedWindows.clear();
    return r;
  });

  ipcMain.handle('ndi:status', () => ndiService?.status() || { ok: false });

  ipcMain.handle('ndi:startFeed', async (_, feedConfig) => {
    if (!feedConfig || !feedConfig.id) return { ok: false, error: 'Invalid feed configuration' };
    const win = createNdiFeedWindow(feedConfig);
    const r = ndiService?.startFeed(feedConfig, win);
    return r || { ok: false, error: 'NDI service unavailable' };
  });

  ipcMain.handle('ndi:stopFeed', async (_, feedId) => {
    const r = ndiService?.stopFeed(feedId);
    const win = ndiFeedWindows.get(feedId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    ndiFeedWindows.delete(feedId);
    return r || { ok: true };
  });

  ipcMain.handle('ndi:saveFeeds', async (_, feeds) => {
    if (Array.isArray(feeds)) {
      settingsService?.set({ ndiFeeds: feeds });
      return { ok: true };
    }
    return { ok: false, error: 'Invalid feeds array' };
  });

  ipcMain.handle('ndi:getFeeds', async () => {
    const feeds = settingsService?.get('ndiFeeds') || [];
    return { ok: true, feeds };
  });

  ipcMain.handle('desktop:get-sources', async (_e, opts = { types: ['window', 'screen'] }) => {
    try {
      const sources = await desktopCapturer.getSources(opts);
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
        appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      }));
    } catch (err) {
      console.error('Failed to get desktop capture sources:', err);
      return [];
    }
  });

  ipcMain.handle('dialog:open-media-file', async (_e, filters) => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Media File',
      properties: ['openFile'],
      filters: filters || [
        { name: 'Media Files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'png', 'jpg', 'jpeg', 'svg', 'mp3', 'wav', 'flac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return res.filePaths[0];
  });

  // Session history IPC
  ipcMain.handle('session:start', (_, p) => sessionHistory?.startSession(p?.name));
  ipcMain.handle('session:rename', (_, p) => sessionHistory?.renameSession(p?.name));
  ipcMain.handle('session:armEnd', (_, p) => ({ ok: true, ...setEndArm(p?.armed !== false) }));
  ipcMain.handle('session:end', () => { setEndArm(false); return sessionHistory?.endSession(); });
  ipcMain.handle('session:addEntry', (_, p) => {
    const r = sessionHistory?.addEntry(p);
    if (p?.reference) setDisplayState({ scene: { content: { text: p.text, reference: p.reference, version: p.version || 'KJV' } }, type: 'verse' });
    return r;
  });
  ipcMain.handle('session:list', () => ({ ok: true, sessions: sessionHistory?.listSessions() || [] }));
  ipcMain.handle('session:get', (_, id) => ({ ok: true, session: sessionHistory?.getSession(id) }));
  ipcMain.handle('session:export', (_, p) => sessionHistory?.exportSession(p?.id, p?.format || 'json'));
  ipcMain.handle('session:status', () => ({ ...(sessionHistory?.getStatus() || { ok: false }), endArm: endArmState() }));

  // Song import IPC
  ipcMain.handle('song:importFile', (_, p) => songImportService?.importFile(p?.filePath));
  ipcMain.handle('song:importText', (_, p) => songImportService?.importText(p?.text, p?.title));
  ipcMain.handle('song:arrangeText', (_, p) => songImportService?.arrangeText(p?.text)
    || { ok: false, error: 'Song import service unavailable' });
  ipcMain.handle('song:searchOnline', async (_, p) => {
    const query = String(p?.query || '').trim();
    if (!query) return { ok: true, results: [] };
    try {
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'BibleSongProStudio/3.4.0 (https://github.com/Johnbatey/bible-song-pro-studio)',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        return { ok: false, error: `Search service returned HTTP ${res.status}`, results: [] };
      }
      const data = await res.json();
      if (!Array.isArray(data)) return { ok: true, results: [] };

      const results = data.map((item) => {
        let plainLyrics = item.plainLyrics;
        if (!plainLyrics && item.syncedLyrics) {
          // Strip timestamp markers like [00:12.34]
          plainLyrics = item.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]\s*/g, '').trim();
        }
        return {
          id: item.id,
          title: item.trackName || item.name || 'Untitled',
          artist: item.artistName || 'Unknown Artist',
          album: item.albumName || '',
          duration: item.duration || 0,
          plainLyrics: plainLyrics || '',
          syncedLyrics: item.syncedLyrics || '',
        };
      }).filter((r) => Boolean(r.plainLyrics));

      return { ok: true, results };
    } catch (err) {
      console.warn('Online lyrics search failed:', err?.message || err);
      return { ok: false, error: err?.message || String(err), results: [] };
    }
  });
  ipcMain.handle('song:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Worship Songs & Databases',
      properties: ['openFile', 'multiSelections'],
      filters: [{
        name: 'Worship Songs & Databases (EasyWorship, OpenLP, OpenLyrics, ChordPro, Text)',
        extensions: ['db', 'ddb', 'sqlite', 'sqlite3', 'xml', 'pro', 'chordpro', 'chopro', 'txt']
      }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true, filePaths: [] };
    return { ok: true, filePaths: result.filePaths };
  });

  // Settings IPC — secrets are write-only from the renderer's point of view
  function broadcastSettings(settings) {
    if (!settings) return;
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        try { win.webContents.send('settings:updated', settings); } catch (_) {}
      }
    });
  }

  ipcMain.handle('settings:get', () => settingsService?.getPublic() || { ok: false, settings: {} });
  ipcMain.handle('settings:set', (_, patch) => {
    const result = settingsService?.set(patch) || { ok: false, settings: {} };
    // Keep the live STT service in step with any credential/model change
    deepgramService?.configure({
      apiKey: settingsService?.get('deepgramApiKey'),
      model: settingsService?.get('deepgramModel'),
      language: settingsService?.get('deepgramLanguage'),
    });
    if (result.ok && result.settings) {
      broadcastSettings(result.settings);
    }
    return result;
  });
  ipcMain.handle('settings:clearSecret', (_, p) => {
    const result = settingsService?.clearSecret(p?.key) || { ok: false };
    if (result.ok && result.settings) {
      broadcastSettings(result.settings);
    }
    return result;
  });

  // Streaming speech-to-text IPC
  ipcMain.handle('stt:start', (_, p) => deepgramService?.start({
    apiKey: settingsService?.get('deepgramApiKey'),
    model: p?.model || settingsService?.get('deepgramModel'),
    language: p?.language || settingsService?.get('deepgramLanguage'),
  }) || { ok: false, error: 'Deepgram service unavailable' });
  ipcMain.handle('stt:stop', () => deepgramService?.stop() || { ok: true });
  ipcMain.handle('stt:status', () => deepgramService?.status() || { ok: false });
  // Fire-and-forget: audio arrives every ~64ms and must not pay for a round trip
  ipcMain.on('stt:audio', (_, chunk) => {
    if (!chunk) return;
    deepgramService?.sendAudio(Buffer.from(chunk));
  });

  // OBS Studio IPC
  ipcMain.handle('obs:connect', (_, p) => obsService?.connect({
    url: p?.url || settingsService?.get('obsUrl'),
    password: typeof p?.password === 'string' ? p.password : settingsService?.get('obsPassword'),
  }) || { ok: false, error: 'OBS service unavailable' });
  ipcMain.handle('obs:disconnect', () => obsService?.disconnect() || { ok: true });
  ipcMain.handle('obs:status', () => obsService?.status() || { ok: false });
  ipcMain.handle('obs:setScene', (_, p) => obsService?.setScene(p?.sceneName) || { ok: false });
  ipcMain.handle('obs:toggleStream', () => obsService?.toggleStream() || { ok: false });
  ipcMain.handle('obs:toggleRecord', () => obsService?.toggleRecord() || { ok: false });
  ipcMain.handle('obs:refresh', () => obsService?.refreshState() || { ok: false });

  // Media library IPC
  ipcMain.handle('media:list', () => mediaService?.list() || { ok: false, items: [] });
  ipcMain.handle('media:import', (_, p) => mediaService?.importPaths(p?.paths) || { ok: false, items: [], errors: ['Media service unavailable'] });
  ipcMain.handle('media:importOptimized', (_, p) => mediaService?.importOptimizedImage(p?.path) || { ok: false, error: 'Media service unavailable' });
  ipcMain.handle('media:remove', (_, p) => mediaService?.remove(p?.id) || { ok: false });
  ipcMain.handle('media:relink', (_, p) => mediaService?.relink(p?.id, p?.path) || { ok: false, error: 'Media service unavailable' });
  /* Relink opens on the file's last known folder, because the usual cause is a
     drive that came back on a different mount point and the file is sitting
     right where the operator expects it. */
  ipcMain.handle('media:pickRelink', async (_, p) => {
    const current = String(p?.currentPath || '');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Relink Media',
      message: p?.name ? `Find "${p.name}"` : 'Find the file',
      defaultPath: current ? path.dirname(current) : undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
    return mediaService?.relink(p?.id, result.filePaths[0]) || { ok: false, error: 'Media service unavailable' };
  });
  /* Show the file in Finder/Explorer — the fastest way for an operator to see
     where a library entry actually points. */
  ipcMain.handle('media:reveal', (_, p) => {
    const target = String(p?.path || '');
    if (!target || !fs.existsSync(target)) return { ok: false, error: 'File not found' };
    shell.showItemInFolder(target);
    return { ok: true };
  });
  ipcMain.handle('media:rename', (_, p) => mediaService?.rename(p?.id, p?.name) || { ok: false });
  ipcMain.handle('media:baseUrl', () => `http://localhost:${displayPort}`);
  ipcMain.handle('media:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'] },
        { name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, items: [], errors: [], canceled: true };
    return mediaService?.importPaths(result.filePaths) || { ok: false, items: [], errors: [] };
  });
  ipcMain.handle('media:pickSingleFile', async (_, options) => {
    const isImageOnly = options?.type === 'image';
    const filters = (options?.filters && Array.isArray(options.filters) && options.filters.length > 0)
      ? options.filters
      : (isImageOnly
        ? [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : [
            {
              name: 'Media Files (Video & Audio)',
              extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'jpg', 'jpeg', 'png', 'webp'],
            },
            { name: '3D LUT Files', extensions: ['cube', 'png', 'look'] },
            { name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] },
            { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma'] },
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'] },
            { name: 'All Files', extensions: ['*'] },
          ]);

    const result = await dialog.showOpenDialog(mainWindow, {
      title: options?.title || 'Select Media Source File',
      properties: ['openFile'],
      filters,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true, filePath: '' };
    }

    const filePath = result.filePaths[0];
    let url = filePath;
    let mediaItem = null;
    const isLutFile = filePath.toLowerCase().endsWith('.cube') || options?.rawPathOnly;

    if (mediaService && !isLutFile) {
      const importRes = mediaService.importPaths([filePath]);
      if (importRes?.items?.[0]) {
        mediaItem = importRes.items[0];
        url = mediaItem.url || filePath;
      }
    }

    return {
      ok: true,
      filePath,
      url,
      mediaItem,
      name: path.basename(filePath),
    };
  });

  // Professional 3D LUT Parser (Adobe .cube Format)
  ipcMain.handle('lut:parseFile', async (_, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { ok: false, error: 'Invalid path' };
      }
      let targetPath = filePath;
      if (targetPath.startsWith('file://')) {
        try {
          const { fileURLToPath } = require('url');
          targetPath = fileURLToPath(targetPath);
        } catch {}
      }
      targetPath = path.normalize(targetPath);
      const content = await fs.promises.readFile(targetPath, 'utf8');
      const lines = content.split(/\r?\n/);
      let size = null;
      const data = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        if (line.startsWith('LUT_3D_SIZE')) {
          size = parseInt(line.split(/\s+/)[1], 10);
          continue;
        }
        if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX') || line.startsWith('TITLE')) continue;
        if (size !== null) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            data.push([parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])]);
          }
        }
      }

      if (!size || data.length < size * size * size) {
        return { ok: false, error: 'Incomplete or malformed .cube file' };
      }

      // 4x4 Least-Squares Solver for (R, G, B, 1) -> (R', G', B')
      const solveLstSq = (A, b) => {
        const AtA = [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ];
        const Atb = [0, 0, 0, 0];
        const N = A.length;
        for (let i = 0; i < N; i++) {
          const row = A[i];
          const val = b[i];
          for (let r = 0; r < 4; r++) {
            Atb[r] += row[r] * val;
            for (let c = 0; c < 4; c++) {
              AtA[r][c] += row[r] * row[c];
            }
          }
        }
        const M = AtA.map((r, i) => [...r, Atb[i]]);
        for (let i = 0; i < 4; i++) {
          let maxRow = i;
          for (let k = i + 1; k < 4; k++) {
            if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
          }
          const tmp = M[i]; M[i] = M[maxRow]; M[maxRow] = tmp;
          const pivot = M[i][i];
          if (Math.abs(pivot) < 1e-8) continue;
          for (let j = i; j <= 4; j++) M[i][j] /= pivot;
          for (let k = 0; k < 4; k++) {
            if (k !== i) {
              const factor = M[k][i];
              for (let j = i; j <= 4; j++) M[k][j] -= factor * M[i][j];
            }
          }
        }
        return [M[0][4], M[1][4], M[2][4], M[3][4]];
      };

      const A = [];
      const bR = [];
      const bG = [];
      const bB = [];
      const sampleSteps = Math.min(size, 8);
      for (let b = 0; b < sampleSteps; b++) {
        for (let g = 0; g < sampleSteps; g++) {
          for (let r = 0; r < sampleSteps; r++) {
            const rIn = r / (sampleSteps - 1);
            const gIn = g / (sampleSteps - 1);
            const bIn = b / (sampleSteps - 1);
            const ir = Math.round(rIn * (size - 1));
            const ig = Math.round(gIn * (size - 1));
            const ib = Math.round(bIn * (size - 1));
            const idx = ir + ig * size + ib * size * size;
            const out = data[idx] || [rIn, gIn, bIn];
            A.push([rIn, gIn, bIn, 1.0]);
            bR.push(out[0]);
            bG.push(out[1]);
            bB.push(out[2]);
          }
        }
      }

      const solR = solveLstSq(A, bR);
      const solG = solveLstSq(A, bG);
      const solB = solveLstSq(A, bB);

      // Neutral Tone Curve along neutral axis
      const curveSteps = 16;
      const tableR = [];
      const tableG = [];
      const tableB = [];
      for (let s = 0; s <= curveSteps; s++) {
        const t = s / curveSteps;
        const idxInSize = Math.round(t * (size - 1));
        const idx = idxInSize + idxInSize * size + idxInSize * size * size;
        const pt = data[idx] || [t, t, t];
        tableR.push(Math.max(0, Math.min(1, pt[0])).toFixed(3));
        tableG.push(Math.max(0, Math.min(1, pt[1])).toFixed(3));
        tableB.push(Math.max(0, Math.min(1, pt[2])).toFixed(3));
      }

      return {
        ok: true,
        size,
        matrix: [
          solR[0], solR[1], solR[2], 0, solR[3],
          solG[0], solG[1], solG[2], 0, solG[3],
          solB[0], solB[1], solB[2], 0, solB[3],
          0,       0,       0,       1, 0,
        ],
        tableR: tableR.join(' '),
        tableG: tableG.join(' '),
        tableB: tableB.join(' '),
        name: path.basename(filePath),
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  /* Presentation packages. An imported deck keeps only its source path — a
     .pptx is far too large to hold in the persisted renderer state — so
     reopening one in the editor means reading the file back here. The guards
     live in deck-service.cjs, where they can be tested without a window. */
  ipcMain.handle('deck:read', (_, p) => deckService.readDeck(p?.filePath));

  ipcMain.handle('deck:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Presentation',
      properties: ['openFile'],
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
    return { ok: true, filePath: result.filePaths[0] };
  });

  /* Workspace files.
     
     The dialogs live here because only the main process can raise them, but
     nothing about a layout is interpreted on this side: the renderer hands
     over finished JSON and gets a string back. That keeps the file format a
     single concern of the code that actually knows what a dock tree is. */
  ipcMain.handle('workspace:export', async (_, p) => {
    const suggested = String(p?.name || 'Workspace').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Workspace';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Workspace',
      defaultPath: `${suggested}.bspworkspace`,
      filters: [
        { name: 'Bible Song Pro Workspace', extensions: ['bspworkspace'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(result.filePath, String(p?.json || ''), 'utf8');
      return { ok: true, filePath: result.filePath };
    } catch (err) {
      return { ok: false, error: err?.message || 'Could not write the file' };
    }
  });

  ipcMain.handle('workspace:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Workspace',
      properties: ['openFile'],
      filters: [
        { name: 'Bible Song Pro Workspace', extensions: ['bspworkspace', 'json'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
    try {
      // Capped: a dock tree is a few KB, and anything of this name that is
      // megabytes long is not one.
      const stat = fs.statSync(result.filePaths[0]);
      if (stat.size > 4 * 1024 * 1024) return { ok: false, error: 'That file is too large to be a workspace' };
      return { ok: true, json: fs.readFileSync(result.filePaths[0], 'utf8'), filePath: result.filePaths[0] };
    } catch (err) {
      return { ok: false, error: err?.message || 'Could not read the file' };
    }
  });

  // Persisted renderer state IPC
  ipcMain.handle('store:load', () => appStoreService?.load() || { ok: false, state: null });
  ipcMain.handle('store:save', (_, p) => appStoreService?.save(p?.value) || { ok: false });
  ipcMain.handle('store:clear', () => {
    try {
      appStoreService?.clear();
      bibleService?.clearUserBibles();
      settingsService?.reset();
      mediaService?.clearAll();
      stageLayoutsService?.clearAll();
      sessionHistory?.clearAll();
      return { ok: true };
    } catch (err) {
      console.error('Factory reset error:', err);
      return { ok: false, error: err.message || String(err) };
    }
  });

  // In-App Feedback to GitHub handler
  ipcMain.handle('feedback:send', async (_, payload) => {
    try {
      const typeLabel = payload?.type === 'feature' ? '💡 Feature Request' : '🐛 Bug Report';
      const church = payload?.churchName ? payload.churchName.trim() : 'Not specified';
      const isBlocking = payload?.isBlocking ? 'Yes (Blocking issue)' : 'No';
      const desc = payload?.description ? payload.description.trim() : '(No description provided)';
      
      const issueTitle = `[${payload?.type === 'feature' ? 'FEATURE' : 'BUG'}] Feedback from ${church !== 'Not specified' ? church : 'App User'}`;
      const issueBody = `### ${typeLabel}\n\n` +
        `**Church / Community**: ${church}\n` +
        `**Blocking Issue**: ${isBlocking}\n` +
        `**App Version**: ${app.getVersion()}\n` +
        `**OS**: ${process.platform} (${process.arch})\n\n` +
        `---\n` +
        `### Description\n\n${desc}\n`;

      const issueUrl = `https://github.com/Johnbatey/bible-song-pro-studio/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

      const webhookUrl = process.env.BSP_FEEDBACK_WEBHOOK_URL;
      if (webhookUrl) {
        const https = require('https');
        const url = new URL(webhookUrl);
        const postData = JSON.stringify({
          title: issueTitle,
          body: issueBody,
          type: payload?.type,
          churchName: church,
          version: app.getVersion(),
        });
        const req = https.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        });
        req.on('error', () => {});
        req.write(postData);
        req.end();
      }

      return { ok: true, issueUrl };
    } catch (err) {
      console.error('Feedback handler error:', err);
      return { ok: false, error: err.message || String(err) };
    }
  });

  // Automatic GitHub Releases update check handler
  ipcMain.handle('app:checkForUpdates', async () => {
    try {
      const currentVersion = app.getVersion();
      const https = require('https');
      
      const data = await new Promise((resolve, reject) => {
        const req = https.get(
          'https://api.github.com/repos/Johnbatey/bible-song-pro-studio/releases/latest',
          {
            headers: {
              'User-Agent': 'Bible-Song-Pro-Studio-App',
              'Accept': 'application/vnd.github.v3+json',
            },
            timeout: 6000,
          },
          (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });

      const rawTag = (data?.tag_name || '').replace(/^v/, '').trim();
      if (!rawTag) return { ok: true, updateAvailable: false, currentVersion };

      const parseSemver = (v) => v.split('.').map((n) => parseInt(n, 10) || 0);
      const [curMaj, curMin, curPat] = parseSemver(currentVersion);
      const [latestMaj, latestMin, latestPat] = parseSemver(rawTag);

      let updateAvailable = false;
      if (latestMaj > curMaj) updateAvailable = true;
      else if (latestMaj === curMaj && latestMin > curMin) updateAvailable = true;
      else if (latestMaj === curMaj && latestMin === curMin && latestPat > curPat) updateAvailable = true;

      return {
        ok: true,
        updateAvailable,
        currentVersion,
        latestVersion: rawTag,
        releaseName: data?.name || `Version ${rawTag}`,
        releaseNotes: data?.body || '',
        releaseUrl: data?.html_url || 'https://github.com/Johnbatey/bible-song-pro-studio/releases/latest',
        publishedAt: data?.published_at || null,
      };
    } catch (err) {
      console.warn('Update check failed:', err.message || err);
      return { ok: false, updateAvailable: false, currentVersion: app.getVersion(), error: err.message };
    }
  });

  /* No audio:getInputDevices handler, deliberately.
     It used to return a hardcoded [] — and because that resolves rather than
     throws, the renderer's fallback to enumerateDevices never ran and the
     microphone picker was empty on every machine. The main process cannot
     answer this question anyway: device enumeration is a renderer API. The
     Settings modal asks Chromium directly now. */

  // Keep the monitor picker in step with the hardware — projectors get plugged in
  // mid-service, and a stale list is worse than none.
  screen.on('display-added', () => broadcastDisplayList());
  screen.on('display-removed', (_e, removed) => {
    // If the output screen was unplugged, tear the window down rather than leaving it
    // stranded on coordinates that no longer exist.
    if (activeDisplayId && String(removed?.id) === activeDisplayId) {
      /* destroy(), not close(): the window's own close handler calls
         preventDefault() and hides itself while the app is still running, so
         close() here left a live, hidden, IPC-connected renderer that nothing
         could reach — one per unplugged monitor. */
      if (displayWindow && !displayWindow.isDestroyed()) displayWindow.destroy();
      displayWindow = null;
      activeDisplayId = null;
    }
    broadcastDisplayList();
  });
  screen.on('display-metrics-changed', () => broadcastDisplayList());

  /* ── Bring-up ───────────────────────────────────────────────────────────
     Last, so that every handler above is in place before a renderer can call
     one — the console starts loading immediately below, so its first IPC
     call can land at any time.

     The splash gets a floor and a ceiling. The console loads *behind* it
     rather than after it, so the floor costs nothing the boot was not
     already spending — and the operator gets a screen that settles and can
     be read instead of one that is pulled the moment the window is ready. */
  const SPLASH_FLOOR_MS = 3000;
  const SPLASH_CEILING_MS = 7000;
  const splashUpAt = Date.now();

  let splash = createSplashWindow();
  mainWindow = createMainWindow({ autoShow: false });

  let handedOver = false;
  const handOver = () => {
    if (handedOver) return;
    handedOver = true;

    // 1. Show and focus main application window first
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    }

    // 2. Safely remove splash window without blocking focus
    if (splash && !splash.isDestroyed()) {
      try {
        splash.setAlwaysOnTop(false);
        splash.destroy();
      } catch (_) {}
    }
    splash = null;
    setTimeout(prewarmStageDesignerWindow, 1500);
  };
  const handOverAfterFloor = () => {
    setTimeout(handOver, Math.max(0, SPLASH_FLOOR_MS - (Date.now() - splashUpAt)));
  };

  mainWindow.once('ready-to-show', handOverAfterFloor);
  mainWindow.webContents.on('did-finish-load', handOverAfterFloor);
  mainWindow.webContents.on('did-fail-load', (e, c, d) => {
    console.error('Load fail:', c, d);
    handOver();
  });
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.error('Renderer process gone:', details);
    handOver();
  });
  /* A hung load must never leave the operator staring at a splash. */
  setTimeout(handOver, SPLASH_CEILING_MS);

  mainWindow.on('closed', () => {
    mainWindow = null;
    /* Tearing the child windows down must never be able to stop the quit: any
       throw in here used to skip app.quit(), leaving a process in Task Manager
       with no window to close. */
    try {
      /* Every child window answers close() with hide() while app.isQuitting is
         false (see the display and stage windows' close handlers), and
         before-quit only runs after this handler — so the flag is set here,
         before the chain, or each close() just hides the window and the
         reference is dropped. macOS keeps the hide-to-reopen behaviour, where
         the flag is set in before-quit instead. */
      if (process.platform !== 'darwin') app.isQuitting = true;
      ndiService?.stop();
      for (const win of ndiFeedWindows.values()) {
        if (win && !win.isDestroyed()) win.close();
      }
      ndiFeedWindows.clear();
      for (const win of stageWindows) {
        if (win && !win.isDestroyed()) win.close();
      }
      stageWindows.clear();
      for (const win of dockPopoutWindows.values()) {
        if (win && !win.isDestroyed()) win.close();
      }
      dockPopoutWindows.clear();
      for (const win of stageDesignerWindows) {
        if (win && !win.isDestroyed()) win.close();
      }
      stageDesignerWindows.clear();
      if (displayWindow && !displayWindow.isDestroyed()) displayWindow.close();
      displayWindow = null;
      /* A prewarmed designer is hidden and deliberately not in
         stageDesignerWindows until it is shown, so nothing above closes it —
         and while it lives, window-all-closed never fires and the single
         instance lock stays held, which is why a relaunch exited silently. */
      if (app.isQuitting && prewarmedStageDesignerWindow && !prewarmedStageDesignerWindow.isDestroyed()) {
        prewarmedStageDesignerWindow.close();
        prewarmedStageDesignerWindow = null;
      }
    } catch (err) {
      console.error('[Shutdown] Window teardown failed:', err);
    } finally {
      if (process.platform !== 'darwin') app.quit();
    }
  });

  // Fullscreen events
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('fullscreen:changed', true));
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('fullscreen:changed', false));
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } catch (_) {}
  }
});

app.on('web-contents-created', (_evt, contents) => {
  try {
    contents.setVisualZoomLevelLimits(1, 1);
  } catch (err) { }
  /* Rendering the app is the only thing these windows do. Anything else is
     either a mistake or an attack, and both are answered the same way: stay
     put. External links go through shell:openExternal, which has an https
     allowlist, so a denied window.open costs the operator nothing. */
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      console.warn('[Security] Blocked navigation to', String(url).slice(0, 200));
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    console.warn('[Security] Blocked window.open to', String(url).slice(0, 200));
    return { action: 'deny' };
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && (input.key === '=' || input.key === '+' || input.key === '-' || input.key === '_' || input.key === '0')) {
      event.preventDefault();
    }
  });
});

app.on('window-all-closed', () => {
  appStoreService?.flush();
  /* macOS keeps the process alive with no windows, and the dock icon is how the
     operator gets back in. Tearing the servers and the speech/NDI services
     down here left that reopen with a console whose phone remote, browser
     output and transcription were gone until a full restart. Everything below
     the early return is the "actually quitting" path, which on macOS is
     will-quit. */
  if (process.platform === 'darwin') return;
  deepgramService?.destroy();
  ndiService?.destroy();
  for (const win of ndiFeedWindows.values()) {
    if (win && !win.isDestroyed()) win.close();
  }
  ndiFeedWindows.clear();
  sessionHistory?.endSession();
  try {
    wss?.close();
    httpServer?.close();
  } catch (_) {}
  app.quit();
  setTimeout(() => {
    try { process.exit(0); } catch (_) {}
  }, 350).unref();
});
app.on('will-quit', () => {
  appStoreService?.flush();
  deepgramService?.destroy();
  globalShortcut.unregisterAll();
  ndiService?.destroy();
  for (const win of ndiFeedWindows.values()) {
    if (win && !win.isDestroyed()) win.close();
  }
  ndiFeedWindows.clear();
  sessionHistory?.endSession();
  try {
    wss?.close();
    httpServer?.close();
  } catch (_) {}
  if (process.platform !== 'darwin') {
    setTimeout(() => {
      try { process.exit(0); } catch (_) {}
    }, 350).unref();
  }
});
app.on('activate', () => {
  if (!mainWindow) mainWindow = createMainWindow();
  /* Belt and braces: if anything did close the server (a port conflict that
     was later resolved, a failed bind), reopening the app is the moment to
     retry rather than leave the remote silently dead. */
  if (!httpServer || !httpServer.listening) startHttpServer();
});
