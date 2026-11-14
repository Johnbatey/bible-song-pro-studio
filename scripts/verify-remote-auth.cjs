/* ── The network surfaces are gated, checked against the running server ────
 *
 * verify:remote-architecture greps main.cjs for the shape of the auth gate.
 * This one boots the real main process — with `electron` stubbed, so no window
 * and no display is involved — and asks the actual server: does it refuse the
 * API, the projector pages and the WebSocket handshake from a client that was
 * never handed the token, and allow a client that was?
 *
 * The token is generated with crypto.randomBytes at startup, so the harness
 * pins that call before requiring main.cjs. Nothing else in the process needs
 * randomness for this to work, and the real generator is restored immediately.
 * ────────────────────────────────────────────────────────────────────────── */
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');

const TOKEN = '61'.repeat(18); // 18 bytes of 0x61, hex-encoded
const realRandomBytes = crypto.randomBytes;
crypto.randomBytes = (size, cb) => {
  if (size === 18) {
    const buf = Buffer.from('a'.repeat(18), 'utf8');
    return cb ? cb(null, buf) : buf;
  }
  return realRandomBytes(size, cb);
};

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-auth-'));

function fakeContents() {
  return {
    id: 1,
    send() {}, on() {}, once() {}, removeListener() {},
    openDevTools() {}, setAudioMuted() {}, setVisualZoomLevelLimits() {},
    setWindowOpenHandler() {}, reload() {},
    getURL: () => '',
    session: {},
  };
}

function fakeWin() {
  const win = {
    webContents: fakeContents(),
    __isFrameless: true,
    isDestroyed: () => false,
    isVisible: () => true,
    isMinimized: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 1400, height: 900 }),
  };
  const noops = [
    'loadURL', 'once', 'on', 'setResizable', 'setMinimumSize', 'setBounds',
    'setContentBounds', 'setAspectRatio', 'setMenuBarVisibility', 'setAudioMuted',
    'center', 'setAlwaysOnTop', 'destroy', 'show', 'hide', 'focus', 'maximize',
    'unmaximize', 'restore', 'close', 'setFullScreen', 'openDevTools',
  ];
  for (const name of noops) win[name] = () => {};
  return win;
}

const mainWin = fakeWin();

const electronStub = {
  app: {
    name: 'Bible Song Pro Studio',
    isPackaged: false,
    commandLine: { appendSwitch() {} },
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    quit() {},
    on() {},
    getVersion: () => '3.4.0-test',
    getPath: () => userData,
    getAppPath: () => process.cwd(),
  },
  BrowserWindow: Object.assign(function BrowserWindow() { return fakeWin(); }, {
    getAllWindows: () => [mainWin],
    fromWebContents: () => mainWin,
  }),
  ipcMain: { handle() {}, on() {}, removeHandler() {}, removeListener() {} },
  screen: {
    getAllDisplays: () => [{
      id: 1, internal: true, scaleFactor: 2, label: 'Built-in',
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
    }],
    getPrimaryDisplay: () => ({ id: 1, internal: true, bounds: { x: 0, y: 0, width: 1440, height: 900 } }),
    on() {},
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler() {},
      setPermissionCheckHandler() {},
      webRequest: { onHeadersReceived() {} },
    },
  },
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
  MenuItem: function MenuItem() {},
  shell: { openExternal: async () => {}, showItemInFolder() {}, openPath() {} },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true, filePath: '' }),
    showMessageBox: async () => ({ response: 0 }),
  },
  systemPreferences: { askForMediaAccess: async () => true },
  desktopCapturer: { getSources: async () => [] },
  nativeTheme: { themeSource: '' },
  globalShortcut: { register() {}, unregisterAll() {} },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
  return originalLoad.apply(this, arguments);
};

require('../src/electron/main.cjs');

function request(port, pathname, headers = {}) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: pathname, method: 'GET', headers },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body.slice(0, 400),
        }));
      },
    );
    req.on('error', () => resolve({ status: 0, headers: {}, body: '' }));
    req.end();
  });
}

/*
 * Find the port this process's server actually bound. It is not necessarily
 * 8942: the installed app — or an earlier BSP instance — may already hold it,
 * and the server walks up the range in that case. Anything listening on 8942
 * would answer an unauthenticated probe with 401, so "the first port that
 * replies" is the wrong question. Only our own server accepts our own token,
 * which makes the token the identity check as well as the credential.
 */
async function findPort() {
  for (let attempt = 0; attempt < 60; attempt++) {
    for (let port = 8942; port < 8950; port++) {
      const probe = await request(port, `/api/status?token=${TOKEN}`);
      if (probe.status === 200) return port;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** 200 for a built dist, 302 when the server is in vite-dev mode. */
const served = (status) => status === 200 || status === 302;

(async () => {
  const port = await findPort();
  if (!port) {
    console.error(
      'Remote auth FAILED: no server on 8942-8949 accepted this process\'s token. '
      + 'Another Bible Song Pro instance may hold the whole range.',
    );
    process.exit(1);
  }

  const unauthorizedBody = await request(port, '/api/status');
  assert.equal(unauthorizedBody.status, 401, 'GET /api/status must refuse a client with no token');

  assert.equal(
    (await request(port, '/api/status', { 'x-bsp-token': TOKEN })).status, 200,
    'GET /api/status must accept the token as a header',
  );
  assert.equal(
    (await request(port, `/api/status?token=${TOKEN}`)).status, 200,
    'GET /api/status must accept the token in the query string',
  );
  assert.equal(
    (await request(port, '/api/status', { 'x-bsp-token': 'b'.repeat(36) })).status, 401,
    'a wrong token must be refused',
  );

  const authorizedStatus = await request(port, `/api/status?token=${TOKEN}`);
  assert.equal(
    authorizedStatus.headers['access-control-allow-origin'], undefined,
    'REST responses must not carry wildcard CORS now that they are token-gated',
  );

  assert.equal((await request(port, '/display.html')).status, 403, 'the projector page must refuse a tokenless load');
  assert.equal((await request(port, '/remote.html')).status, 403, 'the phone remote must refuse a tokenless load');

  const page = await request(port, `/display.html?token=${TOKEN}`);
  assert.ok(served(page.status), `an authorized page load must be served, got ${page.status}`);
  assert.match(
    String(page.headers['set-cookie']),
    /bsp_token=.+HttpOnly/,
    'an authorized page load must hand the page an HttpOnly cookie so its fetches and socket work',
  );

  assert.equal(
    (await request(port, '/api/status', { cookie: `bsp_token=${TOKEN}` })).status, 200,
    'the cookie must be enough for the API — that is what the page itself uses',
  );

  const WebSocket = require('ws');
  const wsAttempt = (url) => new Promise((resolve) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      try { socket.terminate(); } catch { /* already gone */ }
      resolve('timeout');
    }, 2500);
    socket.on('open', () => { clearTimeout(timer); socket.close(); resolve('open'); });
    socket.on('error', (err) => { clearTimeout(timer); resolve(err.message.includes('401') ? '401' : err.message.slice(0, 40)); });
  });

  assert.equal(
    await wsAttempt(`ws://127.0.0.1:${port}/`), '401',
    'the WebSocket handshake must be refused before the socket opens without a token',
  );
  assert.equal(
    await wsAttempt(`ws://127.0.0.1:${port}/?token=${TOKEN}`), 'open',
    'the WebSocket handshake must open for an authorized client',
  );

  fs.rmSync(userData, { recursive: true, force: true });
  console.log(`Remote auth verified against the running server (port ${port}): API, projector pages and WebSocket all refuse a tokenless client and accept the session token.`);
  process.exit(0);
})().catch((err) => {
  console.error('Remote auth FAILED:', err?.message || err);
  process.exit(1);
});
