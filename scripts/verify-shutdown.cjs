/* ── Closing the app really closes it (#24) ────────────────────────────────
 *
 * The reported symptom was a process left in Task Manager after every window
 * was closed on Windows, and a relaunch that exited silently because the single
 * instance lock was still held. Three things caused it: an unguarded teardown
 * that could skip app.quit(), child windows that answered close() with hide()
 * because app.isQuitting was still false, and a prewarmed stage-designer window
 * that was hidden and in no list, so nothing ever closed it.
 *
 * This boots the real main process with `electron` stubbed — no window, no
 * display — and drives the same IPC the UI uses: open the stage designer, close
 * it (which hides it and keeps it as the prewarmed window), then close the main
 * window. It then asks whether the flag was set, quit was called, that hidden
 * window was closed, and whether anything survived.
 *
 * The Windows path is the one that used to leak, so the harness presents as
 * win32 wherever it runs; macOS keeps its hide-to-reopen behaviour deliberately.
 * ────────────────────────────────────────────────────────────────────────── */
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const assert = require('node:assert/strict');

Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-shutdown-'));
process.on('exit', () => {
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch (_) {}
});

const noop = () => {};
const ipcHandlers = new Map();
const windows = [];
const logged = [];

const app = {
  name: 'Bible Song Pro Studio',
  isPackaged: false,
  commandLine: { appendSwitch: noop, appendArgument: noop },
  requestSingleInstanceLock: () => true,
  whenReady: () => Promise.resolve(),
  on: noop,
  once: noop,
  off: noop,
  exit: noop,
  getVersion: () => '0.0.0-test',
  getPath: () => userData,
  getAppPath: () => process.cwd(),
  getName: () => 'Bible Song Pro Studio',
  setName: noop,
  setLoginItemSettings: noop,
  setAppUserModelId: noop,
  disableHardwareAcceleration: noop,
  isReady: () => true,
  dock: { hide: noop, show: noop, setBadge: noop },
  quitCalls: 0,
  /* Electron's quit() closes every remaining window; the stub has to do the
     same or a splash still in hand-over would look like a leak. */
  quit() {
    app.quitCalls += 1;
    windows.filter((win) => !win.isDestroyed()).forEach((win) => win.close());
  },
};

function webContentsStub(id) {
  return new Proxy({ id, session: {} }, {
    get(target, prop) { return prop in target ? target[prop] : noop; },
  });
}

/* A window that models what main.cjs actually uses: close() asks the window's
   own handlers first, and only destroys it when none of them call
   preventDefault(). That is the behaviour the bug was about. */
class BrowserWindow {
  constructor(options = {}) {
    this.id = ++BrowserWindow.next;
    this.handlers = {};
    this.destroyed = false;
    this.visible = Boolean(options.show);
    this.url = '';
    this.webContents = webContentsStub(this.id);
    windows.push(this);
  }
  on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); }
  once(event, fn) { this.on(event, fn); }
  removeListener() {}
  emit(event, ...args) {
    let prevented = false;
    const eventObject = { preventDefault() { prevented = true; } };
    (this.handlers[event] || []).slice().forEach((fn) => fn(eventObject, ...args));
    return prevented;
  }
  loadURL(url) { this.url = url; return Promise.resolve(); }
  loadFile(file) { this.url = file; return Promise.resolve(); }
  show() { this.visible = true; }
  hide() { this.visible = false; }
  isVisible() { return this.visible; }
  isMinimized() { return false; }
  isMaximized() { return false; }
  isFullScreen() { return false; }
  isDestroyed() { return this.destroyed; }
  close() {
    const prevented = this.emit('close');
    if (!prevented) {
      this.destroyed = true;
      this.emit('closed');
    }
    return !prevented;
  }
  destroy() { this.destroyed = true; }
  center() {} focus() {} maximize() {} unmaximize() {} restore() {} minimize() {}
  moveTop() {} setMenu() {} removeMenu() {} setMenuBarVisibility() {} setTitle() {}
  setBounds() {} setResizable() {} setMinimumSize() {} setContentBounds() {}
  setAspectRatio() {} setAlwaysOnTop() {} setFullScreen() {}
  getBounds() { return { x: 0, y: 0, width: 1440, height: 900 }; }
  static getAllWindows() { return windows.filter((win) => !win.isDestroyed()); }
  static fromWebContents() { return null; }
  static getFocusedWindow() { return null; }
}
BrowserWindow.next = 0;

const electronStub = {
  app,
  BrowserWindow,
  ipcMain: {
    handle: (channel, fn) => ipcHandlers.set(channel, fn),
    on: noop,
    once: noop,
    removeHandler: noop,
    removeAllListeners: noop,
  },
  screen: {
    getPrimaryDisplay: () => ({ id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 }, workAreaSize: { width: 1440, height: 860 } }),
    getAllDisplays: () => [{ id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 }, workAreaSize: { width: 1440, height: 860 } }],
    on: noop,
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  },
  globalShortcut: { register: () => true, unregisterAll: noop, isRegistered: () => true },
  desktopCapturer: { getSources: async () => [] },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true }),
    showMessageBox: async () => ({ response: 0 }),
  },
  systemPreferences: { askForMediaAccess: async () => true },
  session: {
    defaultSession: {
      setPermissionRequestHandler: noop,
      setPermissionCheckHandler: noop,
      webRequest: { onHeadersReceived: noop },
    },
  },
  Menu: class { static buildFromTemplate() { return {}; } static setApplicationMenu() {} static getApplicationMenu() { return null; } },
  MenuItem: class {},
  nativeTheme: { shouldUseDarkColors: false, on: noop, themeSource: 'system' },
  shell: { openExternal: async () => {}, openPath: async () => '' },
  Tray: class { setToolTip() {} setContextMenu() {} on() {} destroy() {} },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true, resize: () => ({}) }) },
  Notification: class { static isSupported() { return false; } show() {} },
  powerSaveBlocker: { start: () => 1, stop: noop, isStarted: () => false },
  clipboard: { readText: () => '', writeText: noop, writeImage: noop, readImage: () => ({ isEmpty: () => true }) },
};

/* Anything else main.cjs reaches for (Tray variants, newer APIs) answers with a
   no-op instead of failing the boot for a reason unrelated to this check. */
const electron = new Proxy(electronStub, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const generic = new Proxy(function () {}, { get: () => () => ({}), apply: () => ({}), construct: () => ({}) });
    target[prop] = generic;
    return generic;
  },
});

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electron;
  return realLoad.call(this, request, parent, isMain);
};

/* main.cjs logs teardown failures rather than throwing them, so the check reads
   the log as well as the window state. */
const realError = console.error;
console.error = (...args) => { logged.push(args.join(' ')); };
process.on('uncaughtException', (err) => logged.push('uncaught: ' + (err && err.message)));
process.on('unhandledRejection', (err) => logged.push('unhandled: ' + (err && err.message)));

require('../src/electron/main.cjs');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, { timeout = 12000, step = 150 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (predicate()) return true;
    await wait(step);
  }
  return false;
}

async function run() {
  console.log('Testing that closing the main window closes every window and quits...');

  /* Bring-up creates its windows on either side of an await, so the list is
     polled rather than read once. The console also has two shapes: a built tree
     opens dist/index.html, while a clone without a build still opens the Vite
     dev URL (http://localhost:5173). Both are the main window; the splash and
     the stage designer are not. */
  const isConsole = (win) => {
    const url = String(win.url);
    if (!url || url.includes('splash.html')) return false;
    return /index\.html/.test(url) || !/\.html(?:[?#]|$)/.test(url);
  };
  const consoleWindow = () => windows.find((win) => !win.isDestroyed() && isConsole(win));
  await waitFor(() => Boolean(consoleWindow()));

  /* Hand-over destroys the splash after its floor; waiting for that rather than
     a fixed sleep keeps the check quick and stops the splash looking like a
     survivor. */
  const handedOver = await waitFor(() => !windows.some((win) => String(win.url).includes('splash.html') && !win.isDestroyed()));
  assert.ok(handedOver, 'the splash never handed over to the main window');

  const main = consoleWindow();
  assert.ok(main, 'main window was not created');

  const openDesigner = ipcHandlers.get('stage-designer:open');
  assert.equal(typeof openDesigner, 'function', 'stage-designer:open is not registered');
  await openDesigner(null);

  const designer = windows.find((win) => String(win.url).includes('stage-designer.html'));
  assert.ok(designer, 'stage designer window was not created');
  assert.equal(designer.isVisible(), true, 'stage designer should be visible after opening');

  /* The designer hides rather than closing, and stays as the prewarmed window —
     the window that used to survive shutdown. */
  designer.close();
  assert.equal(designer.isDestroyed(), false, 'closing the designer should hide it, not destroy it');
  assert.equal(designer.isVisible(), false, 'the designer should be hidden after closing');

  main.close();
  await waitFor(() => app.quitCalls > 0, { timeout: 2000 });
  await wait(150);

  assert.equal(app.isQuitting, true, 'app.isQuitting must be set before the teardown chain');
  assert.ok(app.quitCalls > 0, 'app.quit() was never called');
  assert.equal(designer.isDestroyed(), true, 'the hidden prewarmed designer was left open');
  const survivors = windows.filter((win) => !win.isDestroyed());
  assert.equal(survivors.length, 0, 'windows survived shutdown: ' + survivors.map((win) => win.url).join(', '));
  assert.ok(!logged.some((line) => line.includes('[Shutdown]')), 'teardown logged an error: ' + logged.join(' | '));

  realError('✓ Closing the main window closes every window, including the hidden prewarmed designer, and quits 100%.');
}

run().then(
  () => process.exit(0),
  (err) => {
    realError('Shutdown verification failed:', err && err.message);
    realError('windows: ' + windows.map((win) => `${win.url}${win.isDestroyed() ? ' (closed)' : ' (open)'}`).join(', '));
    process.exit(1);
  },
);
