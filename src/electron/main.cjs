const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, dialog, systemPreferences, session, Menu, MenuItem, nativeTheme } = require('electron');
nativeTheme.themeSource = 'dark';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');
const bibleService = require('./bible-service.cjs');
const { createTranscriptionService } = require('./transcription-service.cjs');
const { createVerseDetectionService } = require('./verse-detection-service.cjs');
const { createNdiService } = require('./ndi-service.cjs');
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

const isDev = !app.isPackaged && !fs.existsSync(path.join(__dirname, '../../dist/index.html'));
let mainWindow = null;
let displayWindow = null;
/* Stage windows are a set, not a single handle: the operator can put a
   confidence monitor on more than one screen, and each needs both feeds. */
const stageWindows = new Set();
/* Designer windows are their own set rather than members of stageWindows. Both
   receive the stage feed, but only a stage window is a stage: a designer must
   never be counted as a screen the service is going out on, and closing every
   stage while a designer stays open has to read as "no stage". */
const stageDesignerWindows = new Set();
/** webContents id → does that designer hold unsaved work. */
const dirtyDesigners = new Map();
let wss = null;
/* The asset server's port. Not a constant: a conflict walks up the range, and
   everything that builds a URL reads this rather than the base. */
const HTTP_PORT_BASE = 8942;
const HTTP_PORT_ATTEMPTS = 8;
let displayPort = HTTP_PORT_BASE;
/** Set when the server could not bind at all, so the UI can say why. */
let httpServerError = null;
let activeDisplayId = null;
let ndiService = null;
let sessionHistory = null;
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
  // Workspace panels — always present; no TitleBar pill for some of these,
  // so the native menu is the primary way to re-open them.
  { id: 'output', label: 'Output' },
  { id: 'transcript', label: 'Live Transcript' },
  { id: 'history', label: 'History' },
  { id: 'queue', label: 'Queue' },
  null, // separator
  // Content panels — all have TitleBar pill tabs too.
  { id: 'bible', label: 'Bible' },
  { id: 'songs', label: 'Songs' },
  { id: 'presentation', label: 'Pro Slides' },
  { id: 'live', label: 'Live Scripture' },
  { id: 'media', label: 'Media' },
  { id: 'stage', label: 'Stage Display' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'themes', label: 'Themes' },
];

/**
 * Rebuilds and installs the full application Menu. Called once at startup
 * (with an empty openIds list) and again every time the renderer pushes a
 * `dock:syncMenu` event so checkmarks stay in sync with the dockview layout.
 */
function buildAppMenu(openIds) {
  const openSet = new Set(openIds || []);

  const dockItems = DOCK_DEFS.map((def) => {
    if (def === null) return new MenuItem({ type: 'separator' });
    return new MenuItem({
      label: def.label,
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
    label: 'Reset Layout',
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
    click() {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dock:resetLayout');
      }
    },
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
      label: 'Edit',
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
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Dock',
      submenu: dockItems,
    },
    {
      label: 'Window',
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

function broadcastDisplayState() {
  const msg = JSON.stringify({ type: 'display:update', state: displayState });
  if (wss) wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
  const payload = { type: 'display:update', state: displayState };
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.webContents.send('display:message', payload);
  /* The stage renders the program output with the same component the projector
     does, so it needs the same state — that is the whole point of the stage no
     longer embedding the legacy display page to get it. */
  for (const win of liveStageWindows()) win.webContents.send('display:message', payload);
}

function setDisplayState(next) {
  displayState = { ...displayState, ...(next || {}), updatedAt: Date.now() };
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
   retained. Replaying "start the timer" to a window opened twenty minutes
   later would start it twenty minutes late, and a broadcast message the
   operator has long since taken down would reappear on a fresh screen. */
const STAGE_TRANSIENT_KINDS = new Set(['timer-command', 'program-output', 'message']);

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
  if (!STAGE_TRANSIENT_KINDS.has(message.kind)) {
    const value = message.kind === 'config' ? (message.config || {}) : message;
    const { kind, ...rest } = value;
    void kind;
    stageState = { ...stageState, ...rest, updatedAt: Date.now() };
    /* A layout and a custom layout are two answers to the same question, and
       the snapshot must not carry both: a window catching up would apply the
       preset and then have the stale custom layout drawn over it. Whichever
       one this message set wins, and the other is dropped. */
    if ('layout' in rest && !('customLayout' in rest)) delete stageState.customLayout;
    if ('customLayout' in rest && rest.customLayout && !('layout' in rest)) delete stageState.layout;
  }
  broadcastStageState(message, senderId);
  return stageState;
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

function serveHtmlFile(filename) {
  return (req, res) => {
    if (isDev) { res.writeHead(302, { Location: `http://localhost:5173/${filename}` }); res.end(); return; }
    const fp = path.join(__dirname, '../../dist', filename);
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(fp, 'utf8'));
  };
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

// ── API Handlers for REST / Mobile Remote ──
const apiHandlers = {
  'POST /api/verse/search': ({ body }) => {
    const results = bibleService.search(body?.versionId || 'KJV', body?.query || '', body?.limit || 20, { book: body?.book || '' });
    return { ok: true, results };
  },
  'POST /api/verse/chapter': ({ body }) => {
    const verses = bibleService.getChapter(body?.versionId || 'KJV', body?.book, body?.chapter);
    return { ok: true, verses };
  },
  'POST /api/display/project': ({ body }) => {
    if (body?.verse) {
      const v = body.verse;
      setDisplayState({
        scene: { content: { text: v.text, reference: v.reference, version: v.version || 'KJV' } },
        type: 'verse',
      });
      sessionHistory?.addEntry({ type: 'verse', reference: v.reference, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text, source: 'remote' });
    }
    return { ok: true, state: displayState };
  },
  'POST /api/display/clear': () => {
    setDisplayState({ scene: null, type: null });
    return { ok: true };
  },
  'POST /api/display/blackout': () => {
    displayState.blackout = !displayState.blackout;
    setDisplayState({ blackout: displayState.blackout });
    return { ok: true, blackout: displayState.blackout };
  },
  'GET /api/display/state': () => ({ ok: true, state: displayState }),
  'GET /api/status': () => ({
    ok: true, displayState, ndi: ndiService?.status() || { available: false },
    session: sessionHistory?.getStatus() || { active: false },
    ai: transcriptionService?.status() || { ok: false },
  }),
  'POST /api/session/start': ({ body }) => sessionHistory?.startSession(body?.name),
  'POST /api/session/end': () => sessionHistory?.endSession(),
  'GET /api/session/list': () => ({ ok: true, sessions: sessionHistory?.listSessions() || [] }),
  'GET /api/session/export': ({ query }) => sessionHistory?.exportSession(query?.id, query?.format || 'json'),
  'POST /api/ndi/start': () => {
    const result = ndiService?.start('Bible Song Pro');
    if (result?.ok) {
      if (!displayWindow || displayWindow.isDestroyed()) {
        createDisplayWindow();
      }
      if (displayWindow && !displayWindow.isDestroyed()) {
        ndiService.setDisplayWindow(displayWindow);
        ndiService.startCapture(15, { width: 1280, height: 720 });
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
    if (pn === '/display.html' || pn === '/') { serveHtmlFile('display.html')(req, res); return; }
    if (pn === '/remote.html') { serveHtmlFile('remote.html')(req, res); return; }
    if (pn.startsWith('/fonts/')) { serveStatic('fonts')(req, res, url); return; }
    if (pn.startsWith('/themes/')) { serveStatic('themes')(req, res, url); return; }
    if (pn.startsWith('/lowerthirds/')) { serveStatic('lowerthirds')(req, res, url); return; }
    if (pn.startsWith('/assets/')) { serveStatic('assets')(req, res, url); return; }

    // User-imported media from userData/media. Serves byte ranges so <video> can
    // seek and loop instead of refetching the whole file.
    if (pn.startsWith('/media/')) { serveMedia(req, res, decodeURIComponent(pn.slice('/media/'.length))); return; }

    // REST API
    if (pn.startsWith('/api/')) {
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
          const result = handler({ body: parsed, query });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(result));
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

  wss = new WebSocketServer({ server });
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
  const s = new BrowserWindow({ width: 700, height: 500, frame: false, transparent: true, resizable: false, alwaysOnTop: true, backgroundColor: '#03040a', webPreferences: { nodeIntegration: false, contextIsolation: true } });
  s.loadURL(isDev ? 'http://localhost:5173/splash.html' : `file://${path.join(__dirname, '../../dist/splash.html')}`);
  s.center();
  return s;
}

function createMainWindow() {
  const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 640, minHeight: 480, frame: true, resizable: true, maximizable: true, fullscreenable: true, thickFrame: true, backgroundColor: '#0c0e14', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true } });
  win.setResizable(true);
  win.setMinimumSize(640, 480);
  win.loadURL(isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../../dist/index.html')}`);
  if (isDev) win.webContents.openDevTools();
  win.once('ready-to-show', () => { win.show(); win.focus(); });
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

function createDisplayWindow(bounds) {
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.close();
  const d = resizableOutputBounds(bounds || screen.getPrimaryDisplay().workArea || screen.getPrimaryDisplay().bounds);
  displayWindow = new BrowserWindow({ x: d.x, y: d.y, width: d.width, height: d.height, minWidth: 640, minHeight: 360, frame: true, autoHideMenuBar: true, resizable: true, maximizable: true, fullscreenable: true, thickFrame: true, backgroundColor: '#000000', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
  displayWindow.setResizable(true);
  displayWindow.setMinimumSize(640, 360);
  displayWindow.setAspectRatio(16 / 9);
  displayWindow.loadURL(isDev ? 'http://localhost:5173/audience-display.html' : `file://${path.join(__dirname, '../../dist/audience-display.html')}`);
  displayWindow.setMenuBarVisibility(false);
  displayWindow.webContents.once('did-finish-load', () => {
    broadcastDisplayState();
    if (ndiService && ndiService.status().running) {
      ndiService.setDisplayWindow(displayWindow);
      ndiService.startCapture();
    }
  });
  return displayWindow;
}

function createStageDisplayWindow() {
  /* webSecurity is on, unlike the page this replaced. It was off only so a
     file:// stage page could embed http://localhost:8942/display.html in an
     iframe for its program pane; the pane is a React component now, so there
     is nothing cross-origin left to allow. */
  const win = new BrowserWindow({ width: 1600, height: 1000, minWidth: 640, minHeight: 480, resizable: true, maximizable: true, fullscreenable: true, thickFrame: true, backgroundColor: '#000000', title: 'BSP Stage Display', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true } });
  win.loadURL(isDev ? 'http://localhost:5173/stage-display.html' : `file://${path.join(__dirname, '../../dist/stage-display.html')}`);

  stageWindows.add(win);
  win.on('closed', () => stageWindows.delete(win));

  // Catch the window up on both feeds the moment it can receive them, so one
  // opened mid-service shows the service rather than an idle screen.
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('display:message', { type: 'display:update', state: displayState });
    if (Object.keys(stageState).length > 0) win.webContents.send('stage:message', stageState);
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
function createStageDesignerWindow() {
  for (const existing of liveStageDesignerWindows()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1040, minHeight: 640,
    resizable: true, maximizable: true, fullscreenable: true, thickFrame: true,
    backgroundColor: '#0b0d12', title: 'BSP Stage Layout Designer',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true },
  });
  win.loadURL(isDev ? 'http://localhost:5173/stage-designer.html' : `file://${path.join(__dirname, '../../dist/stage-designer.html')}`);
  win.setMenuBarVisibility(false);

  stageDesignerWindows.add(win);

  /* Captured now, not read later. By the time `closed` fires the window is
     destroyed and `win.webContents` is gone, so reaching through it there
     throws — and an uncaught throw in the main process puts up Electron's
     own modal error box, which blocks the projector and the stage along with
     everything else. The id is a number; hold the number. */
  const contentsId = win.webContents.id;
  win.on('closed', () => {
    stageDesignerWindows.delete(win);
    dirtyDesigners.delete(contentsId);
  });

  /* An hour of layout work is not something to lose to a stray Cmd+W. The
     renderer keeps this flag current; the check has to live up here because a
     renderer cannot hold a window open long enough to ask a question.

     Asked asynchronously, and that is not a style preference.
     showMessageBoxSync blocks the main process — every timer, every IPC hop,
     the projector feed and the stage feed with it — for as long as the prompt
     is on screen. A confirmation about one window is not worth freezing the
     service running on the other two, so the close is cancelled, the question
     is asked, and the window closes again on the answer. */
  let closeConfirmed = false;
  win.on('close', (event) => {
    if (closeConfirmed || !dirtyDesigners.get(contentsId)) return;
    event.preventDefault();
    dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Discard changes'],
      defaultId: 0,
      cancelId: 0,
      message: 'This layout has unsaved changes.',
      detail: 'Closing the designer now will discard them.',
    }).then(({ response }) => {
      if (response !== 1 || win.isDestroyed()) return;
      closeConfirmed = true;
      dirtyDesigners.delete(contentsId);
      win.close();
    }).catch(() => { /* the window went away while we were asking */ });
  });

  /* The designer draws the real stage, so it needs the real feeds — the same
     catch-up a stage window gets, for the same reason. A designer opened
     mid-service should be laying out over what is actually on the screen. */
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('display:message', { type: 'display:update', state: displayState });
    if (Object.keys(stageState).length > 0) win.webContents.send('stage:message', stageState);
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
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

function createSlideEditorWindow() {
  const win = new BrowserWindow({ width: 1600, height: 1000, minWidth: 640, minHeight: 480, resizable: true, maximizable: true, fullscreenable: true, thickFrame: true, backgroundColor: '#0b0d12', title: 'BSP Slide Editor', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: false } });
  win.loadURL(isDev ? 'http://localhost:5173/slide-editor/index.html' : `file://${path.join(__dirname, '../../dist/slide-editor/index.html')}`);
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

app.whenReady().then(async () => {
  // Session permission request handler
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler(() => true);
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
  obsService = createObsService({
    emit: (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('obs:event', event);
    },
  });
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
  ipcMain.on('dock:syncMenu', (_, openIds) => buildAppMenu(openIds));

  // ── Keyboard Shortcuts ──
  globalShortcut.register('CommandOrControl+Shift+F', () => { mainWindow?.webContents.send('shortcut:fullscreen'); });
  globalShortcut.register('CommandOrControl+Shift+B', () => { setDisplayState({ blackout: !displayState.blackout }); });
  globalShortcut.register('CommandOrControl+Shift+N', () => { ndiService?.start('Bible Song Pro'); });
  globalShortcut.register('CommandOrControl+Shift+E', () => sessionHistory?.endSession());
  globalShortcut.register('CommandOrControl+Shift+P', () => { sessionHistory?.startSession('Session ' + new Date().toLocaleString()); });
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
    createDisplayWindow(target.bounds);
    activeDisplayId = String(target.id);
    return { ok: true, displayId: activeDisplayId, label: getDisplayPayload().find((d) => d.id === activeDisplayId)?.label || '' };
  });
  ipcMain.handle('display:close', () => { if (displayWindow && !displayWindow.isDestroyed()) { displayWindow.close(); displayWindow = null; } activeDisplayId = null; return { ok: true }; });
  ipcMain.handle('display:getDisplays', () => getDisplayPayload());
  ipcMain.handle('display:getActive', () => ({ ok: true, displayId: activeDisplayId, isOpen: !!(displayWindow && !displayWindow.isDestroyed()) }));
  ipcMain.handle('display:sendState', (_, s) => setDisplayState(s));
  ipcMain.handle('display:getState', () => displayState);
  ipcMain.handle('display:isOpen', () => !!(displayWindow && !displayWindow.isDestroyed()));
  ipcMain.handle('display:getStatus', () => ({
    isOpen: !!(displayWindow && !displayWindow.isDestroyed()),
    url: 'Electron IPC display',
    // Null rather than a plausible-looking URL when nothing is listening —
    // the projector is unaffected by this, but the remote genuinely is not
    // reachable and an address that refuses the connection is worse than none.
    browserUrl: httpServerError ? null : `http://localhost:${displayPort}/display.html`,
    remoteUrl: httpServerError ? null : `http://localhost:${displayPort}/remote.html`,
    port: httpServerError ? null : displayPort,
    serverError: httpServerError,
    clients: wss ? wss.clients.size : 0,
    updatedAt: displayState.updatedAt || 0,
  }));
  ipcMain.on('display:message', (_, msg) => { if (msg && msg.type === 'display:update') setDisplayState(msg.state || msg); });

  ipcMain.handle('slide-editor:open', () => { createSlideEditorWindow(); return true; });
  ipcMain.handle('stage-display:open', () => { createStageDisplayWindow(); return true; });
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
  ipcMain.handle('get:displayUrl', () => `http://localhost:${displayPort}/display.html`);

  ipcMain.handle('bible:getVersions', () => bibleService.getVersions());
  ipcMain.handle('bible:getBooks', (_, v) => bibleService.getBooks(v));
  ipcMain.handle('bible:getChapter', (_, p) => bibleService.getChapter(p?.versionId, p?.book, p?.chapter));
  ipcMain.handle('bible:search', (_, p) => bibleService.search(p?.versionId, p?.query, p?.limit, { book: p?.book || '' }));

  ipcMain.handle('verse:detect', (_, p) => verseDetectionService.detect(p?.text, p?.options || {}));
  ipcMain.handle('verse:warmIndex', (_, p) => verseDetectionService.warmIndex(p?.versionId || 'KJV'));
  ipcMain.handle('verse:indexStatus', () => verseDetectionService.indexStatus());

  ipcMain.handle('ai:status', () => transcriptionService.status());
  ipcMain.handle('ai:warmup', (_, p) => transcriptionService.warmup(p));
  ipcMain.handle('ai:transcribe', (_, p) => transcriptionService.transcribe(p));
  ipcMain.handle('ai:dispose', (_, p) => transcriptionService.dispose(p));
  ipcMain.handle('ai:setEngine', (_, e) => transcriptionService.setActiveEngine(e));

  // NDI IPC
  ipcMain.handle('ndi:start', async (_, p) => {
    const r = ndiService?.start(p?.name || 'Bible Song Pro');
    if (r?.ok) {
      if (!displayWindow || displayWindow.isDestroyed()) {
        createDisplayWindow();
      }
      if (displayWindow && !displayWindow.isDestroyed()) {
        ndiService.setDisplayWindow(displayWindow);
        ndiService.startCapture(p?.fps || 15, { width: p?.width || 1280, height: p?.height || 720 });
      }
    }
    return r || { ok: false, error: 'NDI service unavailable' };
  });
  ipcMain.handle('ndi:stop', () => ndiService?.stop() || { ok: true });
  ipcMain.handle('ndi:status', () => ndiService?.status() || { ok: false });

  // Session history IPC
  ipcMain.handle('session:start', (_, p) => sessionHistory?.startSession(p?.name));
  ipcMain.handle('session:end', () => sessionHistory?.endSession());
  ipcMain.handle('session:addEntry', (_, p) => {
    const r = sessionHistory?.addEntry(p);
    if (p?.reference) setDisplayState({ scene: { content: { text: p.text, reference: p.reference, version: p.version || 'KJV' } }, type: 'verse' });
    return r;
  });
  ipcMain.handle('session:list', () => ({ ok: true, sessions: sessionHistory?.listSessions() || [] }));
  ipcMain.handle('session:get', (_, id) => ({ ok: true, session: sessionHistory?.getSession(id) }));
  ipcMain.handle('session:export', (_, p) => sessionHistory?.exportSession(p?.id, p?.format || 'json'));
  ipcMain.handle('session:status', () => sessionHistory?.getStatus() || { ok: false });

  // Song import IPC
  ipcMain.handle('song:importFile', (_, p) => songImportService?.importFile(p?.filePath));
  ipcMain.handle('song:importText', (_, p) => songImportService?.importText(p?.text));

  // Settings IPC — secrets are write-only from the renderer's point of view
  ipcMain.handle('settings:get', () => settingsService?.getPublic() || { ok: false, settings: {} });
  ipcMain.handle('settings:set', (_, patch) => {
    const result = settingsService?.set(patch) || { ok: false, settings: {} };
    // Keep the live STT service in step with any credential/model change
    deepgramService?.configure({
      apiKey: settingsService?.get('deepgramApiKey'),
      model: settingsService?.get('deepgramModel'),
      language: settingsService?.get('deepgramLanguage'),
    });
    return result;
  });
  ipcMain.handle('settings:clearSecret', (_, p) => settingsService?.clearSecret(p?.key) || { ok: false });

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
  ipcMain.handle('media:remove', (_, p) => mediaService?.remove(p?.id) || { ok: false });
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

  // Persisted renderer state IPC
  ipcMain.handle('store:load', () => appStoreService?.load() || { ok: false, state: null });
  ipcMain.handle('store:save', (_, p) => appStoreService?.save(p?.value) || { ok: false });
  ipcMain.handle('store:clear', () => appStoreService?.clear() || { ok: false });

  // Audio
  ipcMain.handle('audio:getInputDevices', () => []);

  // Keep the monitor picker in step with the hardware — projectors get plugged in
  // mid-service, and a stale list is worse than none.
  screen.on('display-added', () => broadcastDisplayList());
  screen.on('display-removed', (_e, removed) => {
    // If the output screen was unplugged, tear the window down rather than leaving it
    // stranded on coordinates that no longer exist.
    if (activeDisplayId && String(removed?.id) === activeDisplayId) {
      if (displayWindow && !displayWindow.isDestroyed()) displayWindow.close();
      displayWindow = null;
      activeDisplayId = null;
    }
    broadcastDisplayList();
  });
  screen.on('display-metrics-changed', () => broadcastDisplayList());

  /* ── Bring-up ───────────────────────────────────────────────────────────
     Last, so that every handler above is in place before a renderer can call
     one. The splash holds the screen for its own animation; the operator
     window is only built once that wait is over. */
  let splash = createSplashWindow();
  await new Promise((r) => setTimeout(r, 3500));
  mainWindow = createMainWindow();

  mainWindow.webContents.on('did-finish-load', () => { if (splash && !splash.isDestroyed()) { splash.close(); splash = null; } });
  mainWindow.webContents.on('did-fail-load', (e, c, d) => console.error('Load fail:', c, d));
  setTimeout(() => { if (splash && !splash.isDestroyed()) splash.close(); }, 5000);

  mainWindow.on('closed', () => { mainWindow = null; ndiService?.stop(); if (displayWindow && !displayWindow.isDestroyed()) displayWindow.close(); });

  // Fullscreen events
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('fullscreen:changed', true));
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('fullscreen:changed', false));
});

app.on('web-contents-created', (_evt, contents) => {
  try {
    contents.setVisualZoomLevelLimits(1, 1);
  } catch (err) { }
  contents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && (input.key === '=' || input.key === '+' || input.key === '-' || input.key === '_' || input.key === '0')) {
      event.preventDefault();
    }
  });
});

app.on('window-all-closed', () => { appStoreService?.flush(); deepgramService?.destroy(); ndiService?.destroy(); sessionHistory?.endSession(); if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { appStoreService?.flush(); deepgramService?.destroy(); globalShortcut.unregisterAll(); ndiService?.destroy(); sessionHistory?.endSession(); });
app.on('activate', () => { if (!mainWindow) mainWindow = createMainWindow(); });
