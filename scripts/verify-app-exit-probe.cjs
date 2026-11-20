/* ── The launch partner for verify-app-exit.cjs (#24) ──────────────────────
 *
 * An Electron entry of its own, the way scripts/verify-deck-ipc.cjs is: it
 * boots the real main process and then does what an operator does — opens the
 * stage designer through the panel's own bridge, closes it (which hides it and
 * leaves it as the prewarmed window), and finally closes the main window.
 *
 * Nothing in src/electron knows this file exists, and `scripts/` is not in the
 * packaged `files` list, so neither a normal launch nor a shipped build carries
 * any test code. The app has to end its own process here: nothing on Windows or
 * Linux calls app.quit(), because that call is exactly what a broken teardown
 * used to skip.
 * ────────────────────────────────────────────────────────────────────────── */
'use strict';

const { app, BrowserWindow, screen } = require('electron');

/* ── The race, held open ────────────────────────────────────────────────
 * #24's second designer came from the prewarm timer firing while a designer was
 * already open: it read the old single slot, found it empty, and built another
 * window behind the visible one. Nothing makes that ordering happen in a given
 * run — a fast machine can get from the open to the close before the 1500 ms
 * timer lands, and a check that waits for it then passes without ever visiting
 * the bug. So the timer is not left to timing. This wrapper catches the prewarm
 * callback as main.cjs schedules it and hands it to the run below, which fires
 * it at the one moment the race needs it: with a designer open. Every other
 * timer passes through untouched. */
/* A failure of this harness's own arrangement — the prewarm it meant to hold
   never arrived, or a designer was already there — is not evidence about the
   app. It is reported on its own line with its own exit code, so a rename
   inside main.cjs cannot read as the shutdown leak #24 reported. */
class ProbeSetupError extends Error {}

const realSetTimeout = global.setTimeout;
let firePrewarm = null;
global.setTimeout = function (fn, delay, ...args) {
  if (typeof fn === 'function' && fn.name === 'prewarmStageDesignerWindow') {
    firePrewarm = () => {
      /* The hold ends with the one call it was holding: from here the process
         runs on the timers it started with, for the shutdown under test. */
      global.setTimeout = realSetTimeout;
      fn(...args);
    };
    console.log('[CI] prewarm timer held until a designer is already open');
    return 0;
  }
  return realSetTimeout(fn, delay, ...args);
};

/* Required once this module is loaded, so the windows main.cjs opens arrive as
   ordinary events rather than needing a hook inside it. */
require('../src/electron/main.cjs');

const delayMs = Number(process.env.BSP_CI_SHUTDOWN_DELAY_MS) || 4000;
/* macOS deliberately keeps the app alive with no windows, so a local run asks
   for the quit the Windows handler sends itself. CI never sets this. */
const expectQuit = process.env.BSP_CI_SHUTDOWN_EXPECT_QUIT === '1';
/* The Windows branch of the teardown is the one #24 broke, and a local machine
   is usually not Windows. BSP_CI_SIMULATE_WIN32=1 takes that branch here; the
   flip happens just before the close, after main.cjs has loaded its modules. */
const simulateWindows = process.env.BSP_CI_SIMULATE_WIN32 === '1';

/* The leak #24 reported is not "the process outlived its window" — a stranded
   window keeps window-all-closed from firing, and the app then only leaves
   because something quit for it. Assert the real invariant: when the quit
   starts, every window is already gone. Checked only where the app's own
   Windows teardown runs; macOS keeps its windows on close by design. */
app.on('before-quit', () => {
  if (!(simulateWindows || process.platform === 'win32')) return;
  const open = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  if (!open.length) return;
  const described = open
    .map((win) => `${urlOf(win).replace(/^.*\//, '') || '(no url)'} [${win.isVisible() ? 'visible' : 'hidden'}]`)
    .join(', ');
  console.error(`[CI] shutdown probe failed: quit started with ${open.length} window(s) still open: ${described}`);
  process.exit(2);
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function urlOf(win) {
  try { return win.webContents.getURL(); } catch (_) { return ''; }
}

function findWindow(needle) {
  return BrowserWindow.getAllWindows().find((win) => !win.isDestroyed() && urlOf(win).includes(needle)) || null;
}

function designerWindows() {
  return BrowserWindow.getAllWindows()
    .filter((win) => !win.isDestroyed() && urlOf(win).includes('stage-designer.html'));
}

async function waitForWindow(needle, timeout = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const win = findWindow(needle);
    if (win) return win;
    await wait(150);
  }
  return null;
}

/* A machine with no desktop cannot show a window, and that is the one failure
   this check must not let anyone mistake for a shutdown bug. Record what the
   display and the session actually were, so the harness can tell them apart. */
function reportMachine() {
  try {
    const { size } = screen.getPrimaryDisplay();
    console.log(`[CI] display: ${size.width}x${size.height}`);
  } catch (err) {
    console.log('[CI] display: unavailable (' + (err && err.message) + ')');
  }
  if (process.platform === 'win32') console.log(`[CI] session: ${process.env.SESSIONNAME || 'none'}`);
}

async function run() {
  await app.whenReady();
  reportMachine();

  const mainWindow = await waitForWindow('index.html');
  if (!mainWindow) throw new Error('the main window never opened');
  console.log('[CI] shutdown probe armed');

  /* Let startup settle: the splash hand-over and the first display-state push
     both land in this window. The prewarm does not, by design — it is held. */
  await wait(delayMs);

  /* Prove the ordering before relying on it. With the timer held, main.cjs
     cannot have built a designer, so an empty list here says the open below
     really does come first; a designer already present means the hold missed
     and the run would not be testing the race at all. */
  if (designerWindows().length) {
    throw new ProbeSetupError('a designer window existed before the probe opened one, so the prewarm was not held and the race never happened; the hold matches the callback by name (prewarmStageDesignerWindow), has it been renamed?');
  }

  /* The panel's own path, so the window that ends up prewarmed is the one the
     UI would have made. A missing bridge shows up below, on visibility. */
  await mainWindow.webContents
    .executeJavaScript('window.BSP && window.BSP.openStageDesigner ? window.BSP.openStageDesigner() : "no bridge"', true)
    .catch(() => {});

  const designer = await waitForWindow('stage-designer.html', 20000);
  if (!designer) throw new Error('the stage designer never opened');
  await wait(1000);
  if (!designer.isVisible()) throw new Error('the stage designer did not become visible');

  /* The ordering #24 broke, on demand: a designer is open and the prewarm
     fires. It used to build a second, hidden window here, and the open one's
     close then took the prewarmed slot and left the other with no name. */
  const armedAt = Date.now();
  while (!firePrewarm) {
    if (Date.now() - armedAt > 30000) {
      throw new ProbeSetupError('main.cjs never scheduled a prewarm the probe could hold; the hold matches the callback by name (prewarmStageDesignerWindow), so it may have been renamed');
    }
    await wait(100);
  }
  firePrewarm();
  if (global.setTimeout !== realSetTimeout) {
    throw new ProbeSetupError('the setTimeout hold was not restored after firing the prewarm');
  }
  await wait(500);
  const afterPrewarm = designerWindows();
  if (afterPrewarm.length !== 1) {
    throw new Error(`the prewarm added a designer window while one was open: ${afterPrewarm.length} designer windows now`);
  }
  console.log('[CI] prewarm fired with a designer open, and only that designer exists');

  /* Closing it hides it and leaves it as the prewarmed window — the one that
     used to survive shutdown, because no list held it. */
  designer.close();
  await wait(500);
  if (designer.isDestroyed()) throw new Error('closing the designer should hide it, not destroy it');
  if (designer.isVisible()) throw new Error('the designer is still visible after closing it');
  if (designerWindows().length !== 1) {
    throw new Error(`the hidden designer is not the only one: ${designerWindows().length} designer windows`);
  }
  console.log('[CI] stage designer opened and hidden (prewarmed)');

  if (simulateWindows) {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    console.log('[CI] reporting as win32 for the main window close');
  }

  console.log('[CI] closing main window');
  mainWindow.close();

  /* If the process is still here a few seconds later, name what is holding it
     open. This check is about which window survived, not just that something
     did — a leak reads as "stage-designer.html [hidden]" below. A run where the
     teardown works has already exited before this fires. */
  setTimeout(() => {
    const survivors = BrowserWindow.getAllWindows()
      .filter((win) => !win.isDestroyed())
      .map((win) => `${urlOf(win).replace(/^.*\//, '') || '(no url)'} [${win.isVisible() ? 'visible' : 'hidden'}]`);
    console.log('[CI] still running after the main window closed; open windows: ' + (survivors.length ? survivors.join(', ') : 'none'));
  }, 3000);

  if (expectQuit) setTimeout(() => app.quit(), 500);
}

run().catch((err) => {
  const message = err && err.message ? err.message : err;
  /* A distinct line and exit code: verify-app-exit.cjs reports a setup failure
     as a broken check, not as the shutdown leak this check exists to catch.
     app.exit() rather than process.exit(): in the main process the latter can
     return and let this function carry on to the line below, which would print
     the setup error a second time as an app failure and undo the distinction. */
  const setup = err instanceof ProbeSetupError;
  console.error(`[CI] shutdown probe ${setup ? 'setup failed' : 'failed'}:`, message);
  app.exit(setup ? 3 : 2);
});
