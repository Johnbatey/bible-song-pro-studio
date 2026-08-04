#!/usr/bin/env node
/* =========================================================================
   verify-deck-read — the presentation package reader and its IPC wiring
   -------------------------------------------------------------------------
   deck-service.readDeck is the boundary where a renderer-supplied path meets
   the filesystem. This checks both halves of that:

     1. the guards actually hold (extension, regular file, size cap), and
     2. the channel is wired end to end — every window.BSP.deck.* the renderer
        calls has a preload binding and a main-process handler.

   The second check is the one that catches a rename: TypeScript cannot see
   across the contextBridge, so a channel typo compiles cleanly and only fails
   at runtime, in Electron, where it is expensive to notice.
   ========================================================================= */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const deckService = require('../src/electron/deck-service.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-deck-'));
const cleanup = [];
const write = (name, bytes) => {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, bytes);
  cleanup.push(p);
  return p;
};

(async () => {
  /* ---- guards ---- */

  const notPptx = write('notes.txt', 'secrets');
  assert.deepStrictEqual(
    await deckService.readDeck(notPptx),
    { ok: false, error: 'not-a-pptx' },
    'A non-.pptx path must be refused before anything is read',
  );

  assert.strictEqual((await deckService.readDeck('')).error, 'not-a-pptx', 'Empty path refused');
  assert.strictEqual((await deckService.readDeck(null)).error, 'not-a-pptx', 'Null path refused');
  assert.strictEqual(
    (await deckService.readDeck('/etc/passwd')).error,
    'not-a-pptx',
    'A path outside the allowed extension is refused whatever it points at',
  );

  const missing = path.join(tmp, 'gone.pptx');
  assert.strictEqual(
    (await deckService.readDeck(missing)).error,
    'ENOENT',
    'A missing file reports ENOENT, which the renderer words as moved-or-deleted',
  );

  const dir = path.join(tmp, 'deck.pptx');
  fs.mkdirSync(dir);
  cleanup.push(dir);
  assert.strictEqual(
    (await deckService.readDeck(dir)).error,
    'not-a-file',
    'A directory named like a deck is not a deck',
  );

  /* ---- happy path, on a real package ---- */

  const real = path.join(__dirname, '..', 'public', '__parity', 'feature-test.pptx');
  if (fs.existsSync(real)) {
    const result = await deckService.readDeck(real);
    assert(result.ok, `Expected to read ${real}, got ${result.error}`);
    assert(Buffer.isBuffer(result.data), 'Returns a Buffer the renderer can hand to JSZip');
    assert.strictEqual(result.name, 'feature-test.pptx', 'Reports the basename');
    assert.strictEqual(result.size, result.data.length, 'Reported size matches the bytes');
    // Every .pptx is a ZIP, so the first two bytes are "PK".
    assert.strictEqual(result.data.slice(0, 2).toString(), 'PK', 'Bytes come back intact');
  } else {
    console.log('  (skipped real-package read — public/__parity/feature-test.pptx not staged)');
  }

  // Not "DECK.PPTX": macOS is case-insensitive, so that name would resolve
  // to the directory created above and the fixture write itself would fail.
  const uppercase = write('UPPER.PPTX', Buffer.from('PK\x03\x04stub'));
  assert((await deckService.readDeck(uppercase)).ok, 'Extension check is case-insensitive');

  /* ---- size cap ---- */

  assert.strictEqual(deckService.MAX_DECK_BYTES, 200 * 1024 * 1024, 'Cap is 200MB');
  const capped = write('big.pptx', Buffer.alloc(64));
  const realStat = fs.promises.stat;
  fs.promises.stat = async (p) => {
    const s = await realStat(p);
    return Object.assign(Object.create(Object.getPrototypeOf(s)), s, {
      size: deckService.MAX_DECK_BYTES + 1,
      isFile: () => true,
    });
  };
  try {
    assert.strictEqual(
      (await deckService.readDeck(capped)).error,
      'too-large',
      'A file over the cap is refused without being read into memory',
    );
  } finally {
    fs.promises.stat = realStat;
  }

  /* ---- IPC wiring ---- */

  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const preload = read('src/electron/preload.cjs');
  const main = read('src/electron/main.cjs');
  const types = read('src/renderer/types/index.ts');

  const channels = [...preload.matchAll(/ipcRenderer\.invoke\('(deck:[^']+)'/g)].map((m) => m[1]);
  assert(channels.length >= 2, `Expected the deck channels in the preload, found ${channels.length}`);

  for (const channel of channels) {
    assert(
      main.includes(`ipcMain.handle('${channel}'`),
      `Preload invokes "${channel}" but no main-process handler answers it`,
    );
  }

  assert(preload.includes('webUtils.getPathForFile'), 'pathForFile must go through webUtils — Electron 32+ removed File.path');
  assert(/deck:\s*\{/.test(types), 'window.BSP.deck must be declared for the renderer');
  for (const member of ['read:', 'pick:', 'pathForFile:']) {
    assert(types.includes(member), `window.BSP.deck is missing ${member} in its type`);
  }

  console.log(`deck-read: all checks passed (${channels.length} channels wired: ${channels.join(', ')})`);
})()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
