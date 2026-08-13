#!/usr/bin/env electron
/* =========================================================================
   verify-fonts-render — the declared faces actually load, in a real window
   -------------------------------------------------------------------------
   verify-fonts.cjs reads the four bytes at the front of every bundled file, so
   an HTML error page can never again be shipped as a .ttf. That is necessary
   and not sufficient: a perfectly good font still renders as nothing if the
   url is wrong, or if format("truetype") is claimed for a woff2.

   Nothing about that is visible in the console — these are the faces the
   *audience* sees. So this loads the real display entry and asks the engine.

   The width comparison is the part that matters. document.fonts.check can
   return true for a family the engine resolved to something else, so each face
   is measured against the width of an unknown family: same width means the
   fallback drew it, which is exactly the failure that hid sixteen broken
   files for as long as it did.

   Run: npm run verify:fonts-render   (needs a build in dist/)
   ========================================================================= */
const path = require('path');
const assert = require('node:assert/strict');
const { app, BrowserWindow } = require('electron');

const ROOT = path.resolve(__dirname, '..');

/** Every family the operator can pick, plus the brand face display.html sets
    scripture in. Kept in step with display.html by verify-fonts.cjs. */
const FAMILIES = [
  'Poppins', 'Bebas Neue', 'Inter', 'Montserrat', 'Roboto',
  'Oswald', 'Crimson Pro', 'Playfair Display', 'Lora', 'Cinzel',
  'Source Serif 4',
];

const SPECIMEN = 'Amazing grace how sweet';

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ width: 1280, height: 720, show: false });

  await win.loadURL(`file://${path.resolve(ROOT, 'dist/display.html')}`);
  await new Promise((r) => setTimeout(r, 1500));

  const { loaded, widths } = await win.webContents.executeJavaScript(`(async () => {
    const families = ${JSON.stringify(FAMILIES)};
    const loaded = {};
    for (const family of families) {
      for (const weight of [400, 700]) {
        try { await document.fonts.load(weight + ' 24px "' + family + '"'); } catch (e) { /* checked below */ }
      }
      loaded[family] = {
        w400: document.fonts.check('400 24px "' + family + '"'),
        w700: document.fonts.check('700 24px "' + family + '"'),
      };
    }
    const ctx = document.createElement('canvas').getContext('2d');
    const widths = {};
    for (const family of families) {
      ctx.font = '400 40px "' + family + '"';
      widths[family] = Math.round(ctx.measureText(${JSON.stringify(SPECIMEN)}).width);
    }
    ctx.font = '400 40px "__no_such_family__"';
    widths.__fallback__ = Math.round(ctx.measureText(${JSON.stringify(SPECIMEN)}).width);
    return { loaded, widths };
  })()`);

  const failures = [];
  for (const family of FAMILIES) {
    const state = loaded[family];
    const width = widths[family];
    if (!state.w400) failures.push(`${family}: regular did not load`);
    if (!state.w700) failures.push(`${family}: bold did not load`);
    if (width === widths.__fallback__) {
      failures.push(`${family}: drew at the fallback width (${width}px) — the engine substituted another face`);
    }
    console.log(
      `  ${failures.length === 0 || !failures[failures.length - 1].startsWith(family) ? 'ok  ' : 'FAIL'}`
      + ` ${family.padEnd(18)} 400=${state.w400 ? 'y' : 'n'} 700=${state.w700 ? 'y' : 'n'} ${String(width).padStart(4)}px`,
    );
  }

  assert.deepEqual(failures, [], `\n  ${failures.join('\n  ')}\n`);

  console.log(
    `\nFont rendering verified: ${FAMILIES.length} faces loaded at both weights in the real display `
    + `entry, each drawing at its own width (fallback would be ${widths.__fallback__}px).`,
  );
  app.exit(0);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  app.exit(1);
});
