#!/usr/bin/env electron
/* =========================================================================
   verify-song-arrange-ui — the Arrangement panel, driven in a real window
   -------------------------------------------------------------------------
   verify-song-arrange.cjs proves the detector, the orchestrator and the
   expansion. None of that touches a button. This boots the real renderer with
   the real preload, clicks through Songs → Arrangement → Auto-arrange → Apply,
   and then projects a repeated chorus.

   The last step is the point. The scene-id collision this feature was built
   around is invisible to every other check: three chorus entries under one id
   compile perfectly, pass the unit assertions if you only look at data, and
   fail as three cards lighting up LIVE at once in front of an operator. The
   only way to see it is to click a repeat and count the tallies.

   Run: npm run verify:song-arrange-ui   (needs a build in dist/)
   ========================================================================= */
const path = require('path');
const assert = require('node:assert/strict');
const { app, BrowserWindow, ipcMain } = require('electron');

const { createSongImportService } = require('../src/electron/song-import-service.cjs');

const ROOT = path.resolve(__dirname, '..');
const importer = createSongImportService();

/* One slide holding an unsectioned sheet whose chorus is typed twice — the
   shape a pasted lyric sheet actually arrives in. The label is `v1` because
   that is what the old importer produced, and what is still sitting in
   libraries saved before this feature. */
const SEED_SONG = {
  id: 'seed-song',
  title: 'Seeded Sheet',
  slides: [{
    id: 'slab',
    label: 'v1',
    text: [
      'A one', 'A two', '',
      'CH one', 'CH two', '',
      'B one', 'B two', '',
      'CH one', 'CH two',
    ].join('\n'),
  }],
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Poll rather than sleep. The panel mounts on demand, the store hydrates over
   IPC, and React renders on its own schedule — a fixed delay that passes on
   this machine is a flake waiting for a slower one. */
async function waitFor(win, expression, what, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await win.webContents.executeJavaScript(expression).catch((e) => `threw: ${e.message}`);
    if (last && last !== 'threw: undefined' && !String(last).startsWith('threw:')) return last;
    await wait(150);
  }
  throw new Error(`timed out waiting for ${what} (last saw ${JSON.stringify(last)})`);
}

/* Clicks land through React's root listener, so a real bubbling MouseEvent is
   all that is needed — but the state it sets renders on the next frame. */
const PAGE_HELPERS = `
  window.__byText = (sel, text) =>
    [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim() === text);
  window.__clickText = (sel, text) => {
    const el = window.__byText(sel, text);
    if (!el) return false;
    el.click();
    return true;
  };
  /* A disclosure header carries its own summary — "Arrangement" plus the play
     order plus the caret — so it is never an exact text match. */
  window.__clickStartsWith = (sel, text) => {
    const el = [...document.querySelectorAll(sel)]
      .find((e) => (e.textContent || '').trim().startsWith(text));
    if (!el) return false;
    el.click();
    return true;
  };
  window.__cards = () => [...document.querySelectorAll('.row-hover')]
    .filter((el) => el.querySelector('span'))
    .map((el) => ({
      label: (el.querySelector('span') || {}).textContent || '',
      live: [...el.querySelectorAll('span')].some((s) => s.textContent.trim() === 'LIVE'),
      preview: [...el.querySelectorAll('span')].some((s) => s.textContent.trim() === 'PREVIEW'),
    }));
  true;
`;

let n = 0;
const check = (label, condition, detail) => {
  assert.ok(condition, `${label}${detail ? ` — ${detail}` : ''}`);
  n += 1;
  console.log(`${String(n).padStart(2)} ✓ ${label}`);
};

async function main() {
  await app.whenReady();

  // Enough of main to let the store settle; the song arrives pre-persisted.
  ipcMain.handle('store:load', () => ({
    ok: true,
    state: JSON.stringify({ state: { songs: [SEED_SONG] }, version: 1 }),
  }));
  ipcMain.handle('store:save', () => ({ ok: true }));
  ipcMain.handle('store:clear', () => ({ ok: true }));
  ipcMain.handle('display:getState', () => ({}));
  ipcMain.handle('display:update', () => ({ ok: true }));
  ipcMain.handle('media:baseUrl', () => 'http://localhost:8942');
  ipcMain.handle('media:list', () => ({ ok: true, items: [] }));
  ipcMain.handle('settings:get', () => ({ ok: true, settings: {} }));
  ipcMain.handle('get:platform', () => process.platform);
  ipcMain.handle('get:version', () => '0.0.0-test');
  ipcMain.handle('window:isFullScreen', () => false);

  /* The app shell polls a good deal of main on mount — NDI, displays, the
     Bible service, session history. None of it bears on the Arrangement panel,
     but an unhandled channel rejects and buries the real output in stack
     traces, so each one gets a benign answer. */
  const QUIET = {
    'ai:status': { ok: true, enabled: false },
    'bible:getBooks': { ok: true, books: [] },
    'bible:getChapter': { ok: true, verses: [] },
    'bible:getVersions': { ok: true, versions: [] },
    'display:getDisplays': { ok: true, displays: [] },
    'display:getStatus': { ok: true },
    'display:sendState': { ok: true },
    'ndi:status': { ok: true, running: false },
    'session:list': { ok: true, sessions: [] },
    'session:status': { ok: true },
    'stage:getState': {},
    'stage:sendState': { ok: true },
    'stage-layouts:list': { ok: true, layouts: [], activeId: null },
  };
  Object.entries(QUIET).forEach(([channel, reply]) => ipcMain.handle(channel, () => reply));

  // The channel under test, answered by the real service.
  ipcMain.handle('song:arrangeText', (_e, p) => importer.arrangeText(p?.text));

  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
    webPreferences: {
      preload: path.resolve(ROOT, 'src/electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  const violations = [];
  win.webContents.on('did-start-loading', () => {
    win.webContents.executeJavaScript(`
      document.addEventListener('securitypolicyviolation',
        (e) => (window.__csp = window.__csp || []).push(e.violatedDirective));
    `).catch(() => {});
  });

  await win.loadURL(`file://${path.resolve(ROOT, 'dist/index.html')}`);
  await wait(2500);
  await win.webContents.executeJavaScript(PAGE_HELPERS);

  const run = (js) => win.webContents.executeJavaScript(js);

  /* 1. The seeded library actually reached the panel.
        The nav click and the store's IPC hydration race each other, so this
        keeps asking for the Songs panel until the library is in it rather than
        clicking once and hoping the order came out right. */
  const listed = await waitFor(win, `(() => {
    if (document.body.innerText.includes('Seeded Sheet')) return true;
    window.__clickText('button', 'Songs');
    return false;
  })()`, 'the seeded song to appear in the Songs list');
  check('the seeded song reaches the Songs panel', listed);

  // 2. One slide, because nothing has sectioned it yet.
  await waitFor(win, `(() => {
    const row = [...document.querySelectorAll('div')]
      .filter((e) => (e.textContent || '').includes('Seeded Sheet') && e.children.length <= 3)
      .pop();
    if (!row) return false;
    row.click();
    return true;
  })()`, 'the song row to be selectable');
  await waitFor(win, `window.__cards().length > 0`, 'the lyric deck to draw');
  const before = await run(`window.__cards().map((c) => c.label)`);
  check('an unsectioned sheet starts as a single slide', before.length === 1, `saw ${JSON.stringify(before)}`);

  // 3. The disclosure opens and offers Auto-arrange.
  await waitFor(win, `window.__clickStartsWith('button', 'Arrangement')`, 'the Arrangement disclosure');
  const hasButton = await waitFor(
    win, `!!window.__byText('button', 'Auto-arrange')`, 'the Auto-arrange button',
  );
  check('the Arrangement disclosure offers Auto-arrange', hasButton);

  // 4. Auto-arrange proposes, and changes nothing until told to.
  await run(`window.__clickText('button', 'Auto-arrange')`);
  await waitFor(win, `!!window.__byText('button', 'Apply')`, 'the proposal to appear');
  const proposed = await run(`(() => ({
    hasApply: !!window.__byText('button', 'Apply'),
    hasCancel: !!window.__byText('button', 'Cancel'),
    cards: window.__cards().length,
    text: document.body.innerText,
  }))()`);
  check('Auto-arrange shows a proposal with Apply and Cancel', proposed.hasApply && proposed.hasCancel);
  check('the song is untouched until Apply', proposed.cards === 1, `deck already showed ${proposed.cards} cards`);
  check(
    'the proposal names the sections it found',
    /Verse 1 · Chorus · Verse 2/.test(proposed.text),
    'proposal did not list Verse 1 · Chorus · Verse 2',
  );

  // 5. Apply restructures the song and the deck follows.
  await run(`window.__clickText('button', 'Apply')`);
  await waitFor(win, `window.__cards().length === 4`, 'the deck to redraw with the arrangement');
  const after = await run(`window.__cards().map((c) => c.label)`);
  check(
    'Apply expands the arrangement into a four-slide deck',
    after.length === 4,
    `saw ${JSON.stringify(after)}`,
  );
  check(
    'the repeated chorus is labelled as a repeat, not duplicated silently',
    after[3].includes('·'),
    `fourth card read "${after[3]}"`,
  );

  // 6. The whole reason the id scheme changed.
  await run(`(() => {
    const card = [...document.querySelectorAll('.row-hover')][3];
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return true;
  })()`);
  await waitFor(win, `window.__cards().some((c) => c.live)`, 'a card to go live');
  const tallies = await run(`window.__cards()`);
  const live = tallies.filter((c) => c.live);
  check(
    'projecting a repeated chorus lights exactly one card',
    live.length === 1,
    `${live.length} cards read LIVE: ${JSON.stringify(tallies.map((c) => [c.label, c.live]))}`,
  );
  check(
    'and it is the repeat that was clicked, not the first occurrence',
    live[0] && live[0].label.includes('·'),
    `LIVE card was "${live[0] && live[0].label}"`,
  );

  // 7. Clearing puts it back without touching the sections.
  await run(`window.__clickText('button', 'Clear order')`);
  await waitFor(win, `window.__cards().length === 3`, 'the deck to return to list order');
  const cleared = await run(`window.__cards().map((c) => c.label)`);
  check(
    'Clear order returns to list order, keeping the sections',
    cleared.length === 3,
    `saw ${JSON.stringify(cleared)}`,
  );

  const csp = await run(`window.__csp || []`);
  check('no CSP violations along the way', csp.length === 0, JSON.stringify(csp));

  console.log(`\nArrangement UI verified: ${n} checks passed in a real renderer.`);
  app.exit(0);
}

main().catch(async (err) => {
  console.error('\nFAILED:', err.message);
  // What the window actually showed, so a failure here is diagnosable without
  // re-running it by hand with a debugger attached.
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    const seen = await win.webContents
      .executeJavaScript(`({
        buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).slice(0, 40),
        body: document.body.innerText.slice(0, 600),
      })`)
      .catch(() => null);
    if (seen) {
      console.error('\nBUTTONS:', JSON.stringify(seen.buttons));
      console.error('\nBODY:\n' + seen.body);
    }
  }
  app.exit(1);
});
