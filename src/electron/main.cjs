const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, dialog } = require('electron');
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
const { createMediaService } = require('./media-service.cjs');
const { createSettingsService } = require('./settings-service.cjs');
const { createDeepgramService } = require('./deepgram-service.cjs');
const { createObsService } = require('./obs-service.cjs');

const isDev = !app.isPackaged && !fs.existsSync(path.join(__dirname, '../../dist/index.html'));
let mainWindow = null;
let displayWindow = null;
let wss = null;
let displayPort = 8942;
let ndiService = null;
let sessionHistory = null;
let songImportService = null;
let appStoreService = null;
let mediaService = null;
let settingsService = null;
let deepgramService = null;
let obsService = null;
let displayState = { type: null, outputMode: 'fullscreen', scene: null, activeAlert: null, transcription: null, theme: null };
let transcriptionService = null;
let verseDetectionService = null;

function broadcastDisplayState() {
  const msg = JSON.stringify({ type: 'display:update', state: displayState });
  if (wss) wss.clients.forEach((c) => { if (c.readyState === 1) c.send(msg); });
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.webContents.send('display:message', { type: 'display:update', state: displayState });
}

function setDisplayState(next) {
  displayState = { ...displayState, ...(next || {}), updatedAt: Date.now() };
  broadcastDisplayState();
  return displayState;
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
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=31536000' });
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
    const results = bibleService.search(body?.versionId || 'KJV', body?.query || '', body?.limit || 20);
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
    const result = ndiService?.start('Bible Song Pro Max');
    if (result?.ok && displayWindow && !displayWindow.isDestroyed()) {
      ndiService.setDisplayWindow(displayWindow);
      ndiService.startCapture(15, { width: 1280, height: 720 });
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

  server.listen(displayPort, '0.0.0.0', () => console.log(`BSP Server: http://0.0.0.0:${displayPort}/display.html | Remote: http://0.0.0.0:${displayPort}/remote.html`));

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

  return displayPort;
}

function createSplashWindow() {
  const s = new BrowserWindow({ width: 560, height: 420, frame: false, transparent: true, resizable: false, alwaysOnTop: true, backgroundColor: '#03040a', webPreferences: { nodeIntegration: false, contextIsolation: true } });
  s.loadURL(isDev ? 'http://localhost:5173/splash.html' : `file://${path.join(__dirname, '../../dist/splash.html')}`);
  s.center();
  return s;
}

function createMainWindow() {
  const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 1100, minHeight: 700, frame: false, titleBarStyle: 'hidden', backgroundColor: '#0c0e14', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true } });
  win.loadURL(isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../../dist/index.html')}`);
  if (isDev) win.webContents.openDevTools();
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  return win;
}

function createDisplayWindow(bounds) {
  if (displayWindow && !displayWindow.isDestroyed()) displayWindow.close();
  const d = bounds || screen.getPrimaryDisplay().bounds;
  displayWindow = new BrowserWindow({ x: d.x, y: d.y, width: d.width, height: d.height, fullscreen: true, frame: false, alwaysOnTop: true, backgroundColor: '#000000', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true } });
  displayWindow.loadURL(`http://localhost:${displayPort}/display.html`);
  displayWindow.setMenuBarVisibility(false);
  displayWindow.webContents.once('did-finish-load', () => broadcastDisplayState());
  return displayWindow;
}

function createStageDisplayWindow() {
  const win = new BrowserWindow({ width: 1600, height: 1000, minWidth: 1200, minHeight: 800, backgroundColor: '#000000', title: 'BSP Stage Display', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: false } });
  win.loadURL(isDev ? 'http://localhost:5173/stage-display/index.html' : `file://${path.join(__dirname, '../../dist/stage-display/index.html')}`);
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

function createSlideEditorWindow() {
  const win = new BrowserWindow({ width: 1600, height: 1000, minWidth: 1200, minHeight: 800, backgroundColor: '#0b0d12', title: 'BSP Slide Editor', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: false } });
  win.loadURL(isDev ? 'http://localhost:5173/slide-editor/index.html' : `file://${path.join(__dirname, '../../dist/slide-editor/index.html')}`);
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

app.whenReady().then(async () => {
  transcriptionService = createTranscriptionService({ app });
  verseDetectionService = createVerseDetectionService();
  ndiService = createNdiService();
  sessionHistory = createSessionHistoryService({ app });
  songImportService = createSongImportService();
  appStoreService = createAppStoreService({ app });
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
  displayPort = startHttpServer();
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

  let splash = createSplashWindow();
  await new Promise((r) => setTimeout(r, 3500));
  mainWindow = createMainWindow();

  mainWindow.webContents.on('did-finish-load', () => { if (splash && !splash.isDestroyed()) { splash.close(); splash = null; } });
  mainWindow.webContents.on('did-fail-load', (e, c, d) => console.error('Load fail:', c, d));
  setTimeout(() => { if (splash && !splash.isDestroyed()) splash.close(); }, 5000);

  mainWindow.on('closed', () => { mainWindow = null; ndiService?.stop(); if (displayWindow && !displayWindow.isDestroyed()) displayWindow.close(); });

  // ── Keyboard Shortcuts ──
  globalShortcut.register('CommandOrControl+Shift+F', () => { mainWindow?.webContents.send('shortcut:fullscreen'); });
  globalShortcut.register('CommandOrControl+Shift+B', () => { setDisplayState({ blackout: !displayState.blackout }); });
  globalShortcut.register('CommandOrControl+Shift+N', () => { ndiService?.start('Bible Song Pro Max'); });
  globalShortcut.register('CommandOrControl+Shift+E', () => sessionHistory?.endSession());
  globalShortcut.register('CommandOrControl+Shift+P', () => { sessionHistory?.startSession('Session ' + new Date().toLocaleString()); });
  globalShortcut.register('F5', () => { if (displayWindow && !displayWindow.isDestroyed()) displayWindow.reload(); });

  // ── IPC ──
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());
  ipcMain.handle('window:isFullScreen', () => mainWindow?.isFullScreen());

  ipcMain.handle('display:open', (_, i) => { const displays = screen.getAllDisplays(); createDisplayWindow((displays[i] || displays[0] || screen.getPrimaryDisplay()).bounds); return true; });
  ipcMain.handle('display:close', () => { if (displayWindow && !displayWindow.isDestroyed()) { displayWindow.close(); displayWindow = null; } return true; });
  ipcMain.handle('display:getDisplays', () => screen.getAllDisplays().map((d, i) => ({ index: i, name: 'Display ' + (i + 1), bounds: d.bounds, isPrimary: d.id === screen.getPrimaryDisplay().id })));
  ipcMain.handle('display:sendState', (_, s) => setDisplayState(s));
  ipcMain.handle('display:getState', () => displayState);
  ipcMain.handle('display:isOpen', () => !!(displayWindow && !displayWindow.isDestroyed()));
  ipcMain.handle('display:getStatus', () => ({ isOpen: !!(displayWindow && !displayWindow.isDestroyed()), url: `http://localhost:${displayPort}/display.html`, clients: wss ? wss.clients.size : 0, updatedAt: displayState.updatedAt || 0, remoteUrl: `http://localhost:${displayPort}/remote.html` }));
  ipcMain.on('display:message', (_, msg) => { if (msg && msg.type === 'display:update') setDisplayState(msg.state || msg); });

  ipcMain.handle('slide-editor:open', () => { createSlideEditorWindow(); return true; });
  ipcMain.handle('stage-display:open', () => { createStageDisplayWindow(); return true; });

  ipcMain.handle('get:platform', () => process.platform);
  ipcMain.handle('get:userDataPath', () => app.getPath('userData'));
  ipcMain.handle('get:displayUrl', () => `http://localhost:${displayPort}/display.html`);

  ipcMain.handle('bible:getVersions', () => bibleService.getVersions());
  ipcMain.handle('bible:getBooks', (_, v) => bibleService.getBooks(v));
  ipcMain.handle('bible:getChapter', (_, p) => bibleService.getChapter(p?.versionId, p?.book, p?.chapter));
  ipcMain.handle('bible:search', (_, p) => bibleService.search(p?.versionId, p?.query, p?.limit));

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
    const r = ndiService?.start(p?.name || 'Bible Song Pro Max');
    if (r?.ok) {
      // Capture the display output if it's open; otherwise the source is created and
      // starts publishing as soon as one is.
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

  // Persisted renderer state IPC
  ipcMain.handle('store:load', () => appStoreService?.load() || { ok: false, state: null });
  ipcMain.handle('store:save', (_, p) => appStoreService?.save(p?.value) || { ok: false });
  ipcMain.handle('store:clear', () => appStoreService?.clear() || { ok: false });

  // Audio
  ipcMain.handle('audio:getInputDevices', () => []);

  // Fullscreen events
  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('fullscreen:changed', true));
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('fullscreen:changed', false));
});

app.on('window-all-closed', () => { appStoreService?.flush(); deepgramService?.destroy(); ndiService?.destroy(); sessionHistory?.endSession(); if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { appStoreService?.flush(); deepgramService?.destroy(); globalShortcut.unregisterAll(); ndiService?.destroy(); sessionHistory?.endSession(); });
app.on('activate', () => { if (!mainWindow) mainWindow = createMainWindow(); });
