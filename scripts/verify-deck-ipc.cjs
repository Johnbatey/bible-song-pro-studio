#!/usr/bin/env electron
/* =========================================================================
   verify-deck-ipc — the deck:read channel, end to end in a real Electron app
   -------------------------------------------------------------------------
   verify-deck-read.cjs proves the reader's logic and that the channel names
   line up. This proves the seam between them: it boots the actual main
   process, waits for the actual window with the actual preload, and calls
   window.BSP.deck.read(...) from renderer JavaScript — the same call the
   editor makes when reopening a deck.

   Run: npm run verify:deck-ipc   (needs a build in dist/)
   ========================================================================= */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

// Booting the real main process registers the real handlers.
require('../src/electron/main.cjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* The app shows a splash first, and that window has no preload — grabbing the
   first window that appears would test the wrong one. Wait for the window
   actually running the app, and for its bridge to be installed. */
async function windowReady(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let seen = [];
  while (Date.now() < deadline) {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    seen = wins.map((w) => w.webContents.getURL());
    for (const win of wins) {
      if (win.webContents.isLoading()) continue;
      if (/splash/i.test(win.webContents.getURL())) continue;
      const hasBridge = await win.webContents
        .executeJavaScript('!!(window.BSP && window.BSP.deck)')
        .catch(() => false);
      if (hasBridge) return win;
    }
    await wait(300);
  }
  throw new Error(`No window exposed the BSP bridge. Windows seen: ${seen.join(', ') || 'none'}`);
}

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures.push(name); }
};

async function main() {
  await app.whenReady();
  const win = await windowReady();
  await wait(1200);

  const deck = path.join(__dirname, '..', 'public', '__parity', 'feature-test.pptx');
  const hasFixture = fs.existsSync(deck);
  const expectedSize = hasFixture ? fs.statSync(deck).size : 0;

  const result = await win.webContents.executeJavaScript(`(async () => {
    if (!window.BSP) return { error: 'no BSP bridge on window' };
    if (!window.BSP.deck) return { error: 'no BSP.deck on the bridge' };

    const out = { api: Object.keys(window.BSP.deck).sort() };

    ${hasFixture ? `
    const real = await window.BSP.deck.read(${JSON.stringify(deck)});
    out.read = {
      ok: real.ok,
      name: real.name,
      size: real.size,
      byteLength: real.data ? real.data.byteLength : null,
      // The renderer hands these bytes to JSZip; every .pptx starts "PK".
      magic: real.data ? String.fromCharCode(real.data[0], real.data[1]) : null,
      isView: real.data ? ArrayBuffer.isView(real.data) : null,
      error: real.error,
    };
    ` : 'out.read = null;'}

    out.refused = await window.BSP.deck.read('/etc/passwd');
    out.missing = await window.BSP.deck.read('/nope/nothing-here.pptx');
    return out;
  })()`);

  if (result.error) {
    check('bridge present', false, result.error);
  } else {
    check('window.BSP.deck exposes read/pick/pathForFile',
      ['pathForFile', 'pick', 'read'].every((k) => result.api.includes(k)),
      `got ${result.api.join(', ')}`);

    if (result.read) {
      check('deck:read returns the package', result.read.ok === true, result.read.error);
      check('bytes survive the IPC boundary intact',
        result.read.byteLength === expectedSize && result.read.magic === 'PK',
        `byteLength=${result.read.byteLength} expected=${expectedSize} magic=${result.read.magic}`);
      check('data arrives as a typed array the renderer can slice', result.read.isView === true);
      check('reported name is the basename', result.read.name === 'feature-test.pptx', result.read.name);
    } else {
      console.log('  (skipped package read — public/__parity/feature-test.pptx not staged)');
    }

    check('a non-.pptx path is refused across the bridge',
      result.refused && result.refused.ok === false && result.refused.error === 'not-a-pptx',
      JSON.stringify(result.refused));
    check('a missing package reports ENOENT',
      result.missing && result.missing.ok === false && result.missing.error === 'ENOENT',
      JSON.stringify(result.missing));
  }

  console.log(failures.length === 0
    ? 'deck-ipc: all checks passed'
    : `deck-ipc: ${failures.length} failed`);
  process.exitCode = failures.length === 0 ? 0 : 1;
  app.exit(process.exitCode);
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
  app.exit(1);
});
