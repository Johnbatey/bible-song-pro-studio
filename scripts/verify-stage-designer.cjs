/* Runtime check for the Stage Layout Designer window.
 *
 * Loads the built designer entry the way the app loads it — file://, the real
 * preload, webSecurity on — stands in for the main process's IPC, and then
 * drives the canvas with real pointer events.
 *
 * What this exists to catch, in order of how expensive each is to find on a
 * Sunday morning:
 *
 *   - The canvas draws the *real* <StageSurface>. The whole premise of the
 *     tool is that what you lay out is what the stage renders; a preview built
 *     out of sample <span>s can drift from the renderer and never say so.
 *   - The designer opens onto the layout that is already live. The editor this
 *     replaces always opened on a fresh default, so the first Save wiped
 *     whatever the operator had on the stage.
 *   - Drag, snap and undo actually work, including the snap landing a zone's
 *     centre exactly on the stage's centre rather than near it.
 *   - A marquee selects, and a group move shifts every selected zone by the
 *     same amount — a layout that was aligned must survive being dragged.
 *   - Saving round-trips through the layout store, and the real stage window
 *     then draws what the designer sent it.
 *   - Nothing the page loads is blocked by its own CSP.
 *
 * Usage: electron scripts/verify-stage-designer.cjs   (after `vite build`)
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');

const distEntry = path.resolve(__dirname, '../dist/stage-designer.html');
const outDir = path.join(process.cwd(), 'artifacts', 'stage-designer');

/** A custom layout already on the stage when the designer opens. */
const LIVE_LAYOUT = {
  id: 'layout-live-test',
  name: 'Sunday Confidence',
  bgColor: '#05070d',
  zones: [
    { id: 'z-a', type: 'current-text', x: 4, y: 10, w: 92, h: 60, fontSize: 48, fontWeight: 600, color: 'text', textAlign: 'center' },
    { id: 'z-b', type: 'next-item', x: 4, y: 78, w: 50, h: 10, fontSize: 20, fontWeight: 500, color: 'muted', textAlign: 'left' },
    { id: 'z-c', type: 'timer', x: 70, y: 78, w: 26, h: 10, fontSize: 28, fontWeight: 800, color: 'accent', textAlign: 'right' },
  ],
};

const SNAPSHOT = {
  customLayout: LIVE_LAYOUT,
  current: { title: 'Psalm 23:1', body: 'The LORD is my shepherd; I shall not want.' },
  next: { title: 'Psalm 23:2', body: 'He maketh me to lie down in green pastures.' },
  songTitle: 'Amazing Grace',
  songSubtitle: 'Verse 2',
};

function averageLuma(buffer) {
  let total = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    total += (buffer[i] * 0.2126) + (buffer[i + 1] * 0.7152) + (buffer[i + 2] * 0.0722);
  }
  return total / Math.max(1, buffer.length / 4);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/* Helpers injected into the page: synthetic pointer gestures in stage percent,
   and a settle that waits two frames so React has committed before anything is
   read back. Reading straight after a dispatch reads the previous render. */
const HARNESS = `
  window.__dz = (() => {
    const overlay = () => document.querySelector('.dz-overlay');
    const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const at = (px, py) => {
      const r = overlay().getBoundingClientRect();
      return { x: r.left + (r.width * px) / 100, y: r.top + (r.height * py) / 100 };
    };
    const ev = (type, p, buttons) => new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: p.x, clientY: p.y, pointerId: 11, isPrimary: true,
      button: 0, buttons, pointerType: 'mouse',
    });
    const zone = (tag) => [...document.querySelectorAll('.dz-zone')]
      .find((z) => (z.querySelector('.dz-zone-tag')?.textContent || '').startsWith(tag));
    const status = () => document.querySelector('.dz-statusbar .dz-status')?.textContent || '';
    return { overlay, settle, at, ev, zone, status };
  })();
  /* executeJavaScript structured-clones the completion value back to the main
     process, and the object above is all functions. Without a serialisable
     last expression the injection fails with "An object could not be cloned"
     before a single assertion has run. */
  'harness ready';
`;

async function main() {
  assert(fs.existsSync(distEntry), `Missing ${distEntry} — run \`npm run build:renderer\` first`);
  await app.whenReady();
  fs.mkdirSync(outDir, { recursive: true });

  // Stand in for the handlers the real main process registers.
  const store = { layouts: [], activeId: null };
  const sent = [];
  ipcMain.handle('stage:getState', () => SNAPSHOT);
  ipcMain.handle('stage:sendState', (_event, message) => { sent.push(message); return message; });
  ipcMain.handle('display:getState', () => ({}));
  ipcMain.handle('media:baseUrl', () => 'http://localhost:8942');
  ipcMain.handle('stage-layouts:list', () => ({ ok: true, layouts: store.layouts, activeId: store.activeId }));
  ipcMain.handle('stage-layouts:save', (_event, layout) => {
    const index = store.layouts.findIndex((item) => item.id === layout.id);
    if (index === -1) store.layouts.push(layout); else store.layouts[index] = layout;
    return { ok: true, layout };
  });
  ipcMain.handle('stage-layouts:delete', (_event, id) => {
    store.layouts = store.layouts.filter((item) => item.id !== id);
    return { ok: true };
  });
  ipcMain.handle('stage-layouts:setActive', (_event, id) => { store.activeId = id; return { ok: true, activeId: id }; });

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, '../src/electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  win.webContents.on('did-start-loading', () => {
    win.webContents.executeJavaScript(`
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push(e.violatedDirective + ' <- ' + e.blockedURI);
      });
    `).catch(() => {});
  });

  await win.loadURL(`file://${distEntry}`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  await win.webContents.executeJavaScript(HARNESS);

  // 1. It opened onto the layout that is live, not onto a default that the
  //    first Save would push over the top of it.
  const opened = await win.webContents.executeJavaScript(`(() => ({
    name: document.querySelector('.dz-name').value,
    zones: [...document.querySelectorAll('.dz-zone-tag')].map((e) => e.textContent.trim()),
  }))()`);
  assert(
    opened.name === LIVE_LAYOUT.name,
    `Designer opened on "${opened.name}" rather than the live layout "${LIVE_LAYOUT.name}"`,
  );
  assert(opened.zones.length === LIVE_LAYOUT.zones.length, `Expected ${LIVE_LAYOUT.zones.length} zones, drew ${opened.zones.length}`);

  // 2. The canvas is the real renderer, not a drawing of it.
  const shape = await win.webContents.executeJavaScript(`(() => {
    const surface = document.querySelector('.dz-stage .stage-display');
    const program = document.querySelector('.dz-stage .stage-display .stage-program > *');
    return {
      iframes: document.querySelectorAll('iframe').length,
      surfaceMounted: !!surface,
      programMounted: !!program && program.className.includes('program-surface'),
      zonesRendered: document.querySelectorAll('.dz-stage .stage-zones .zone').length,
      liveText: (document.querySelector('.dz-stage .stage-display')?.innerText || ''),
    };
  })()`);
  assert(shape.iframes === 0, `Designer rendered ${shape.iframes} iframe(s)`);
  assert(shape.surfaceMounted, 'StageSurface is not mounted inside the designer canvas');
  assert(shape.programMounted, 'ProgramSurface is not mounted inside the designer canvas');
  assert(shape.zonesRendered === LIVE_LAYOUT.zones.length, `Renderer drew ${shape.zonesRendered} zones, layout has ${LIVE_LAYOUT.zones.length}`);
  assert(
    shape.liveText.includes('The LORD is my shepherd'),
    'The canvas is not showing the live stage content from the retained snapshot',
  );

  /* 2b. Opening the designer changed nothing on the stage. Live is on by
     default, and a naive implementation pushes its opening draft on mount —
     which replaces a layout the operator is currently using with the
     designer's guess at one. Nothing may go out until something is edited. */
  assert(
    sent.length === 0,
    `Opening the designer sent ${sent.length} message(s) to the stage; it must not change what is live until something is edited`,
  );

  // 3. Drag with snapping. The next-item zone is 50 wide, so a snap to the
  //    stage's centre line has to land it at exactly x=25 — near enough is a
  //    failure, because "near enough" is how a layout ends up half a percent
  //    off centre on a 4K screen.
  const drag = await win.webContents.executeJavaScript(`(async () => {
    const { at, ev, zone, settle } = window.__dz;
    /* Geometry is read off the element's own inline style rather than the
       status bar: the bar doubles as a message area, and an assertion that
       depends on which of the two it happens to be showing tests the wrong
       thing. */
    const geom = () => {
      const el = document.querySelector('.dz-zone[data-selected]');
      return el ? { left: el.style.left, width: el.style.width } : null;
    };
    const target = zone('Next item');
    target.dispatchEvent(ev('pointerdown', at(20, 83), 1));
    window.dispatchEvent(ev('pointerup', at(20, 83), 0));
    await settle();
    const before = geom();
    /* The zone is 50 wide at x=4, so its centre sits at 29. Dragging it 20.7
       to the right puts the centre at 49.7 — deliberately short of 50, so the
       assertion below is testing the snap rather than the arithmetic. */
    target.dispatchEvent(ev('pointerdown', at(20, 83), 1));
    for (const t of [0.4, 0.8, 1]) {
      window.dispatchEvent(ev('pointermove', at(20 + 20.7 * t, 83), 1));
      await settle();
    }
    const guides = document.querySelectorAll('.dz-guide').length;
    window.dispatchEvent(ev('pointerup', at(40.7, 83), 0));
    await settle();
    return { before, guides, after: geom(), guidesAfter: document.querySelectorAll('.dz-guide').length };
  })()`);
  assert(drag.before && drag.before.left === '4%', `Zone did not select on the canvas; got ${JSON.stringify(drag.before)}`);
  assert(drag.guides > 0, 'No alignment guide appeared while dragging into the stage centre');
  assert(drag.guidesAfter === 0, 'Alignment guides survived the end of the drag');
  assert(
    drag.after && drag.after.left === '25%' && drag.after.width === '50%',
    `Snap did not land the zone centre on the stage centre; got ${JSON.stringify(drag.after)}`,
  );

  /* 3b. …but an edit does go out, because Live is on. The pair of this and 2b
     is the whole contract: opening is silent, editing is not. */
  await new Promise((resolve) => setTimeout(resolve, 300));
  const afterEdit = sent.filter((message) => message && message.customLayout);
  assert(afterEdit.length > 0, 'Live is on but dragging a zone never reached the stage');
  assert(
    afterEdit[afterEdit.length - 1].customLayout.zones.some((zone) => zone.x === 25),
    'The layout pushed to the stage does not carry the edit that was just made',
  );

  // 4. Undo puts it back.
  const undone = await win.webContents.executeJavaScript(`(async () => {
    const { settle } = window.__dz;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    await settle();
    const el = document.querySelector('.dz-zone[data-selected]');
    return el ? el.style.left : null;
  })()`);
  assert(undone === '4%', `Undo did not restore the zone; left is now ${undone}`);

  /* 4b. Marquee across the bottom of the stage, then move the pair together.
     Group move is not "move each of them": the whole selection snaps as one
     box, so both zones must shift by exactly the same amount or a layout the
     operator had aligned comes apart the first time they drag it. */
  const group = await win.webContents.executeJavaScript(`(async () => {
    const { at, ev, settle } = window.__dz;
    const overlay = document.querySelector('.dz-overlay');
    overlay.dispatchEvent(ev('pointerdown', at(0.5, 70), 1));
    for (const t of [0.5, 1]) {
      window.dispatchEvent(ev('pointermove', at(0.5 + 99 * t, 70 + 29 * t), 1));
      await settle();
    }
    const drawn = !!document.querySelector('.dz-marquee');
    window.dispatchEvent(ev('pointerup', at(99.5, 99), 0));
    await settle();
    const picked = [...document.querySelectorAll('.dz-zone[data-selected]')];
    const before = picked.map((z) => z.style.left + ',' + z.style.top);
    if (picked.length < 2) return { drawn, count: picked.length, before, after: [] };
    picked[0].dispatchEvent(ev('pointerdown', at(20, 82), 1));
    window.dispatchEvent(ev('pointermove', at(27, 82), 1));
    await settle();
    window.dispatchEvent(ev('pointerup', at(27, 82), 0));
    await settle();
    const after = [...document.querySelectorAll('.dz-zone[data-selected]')].map((z) => z.style.left + ',' + z.style.top);
    const cleared = !document.querySelector('.dz-marquee');
    return { drawn, cleared, count: picked.length, before, after };
  })()`);
  assert(group.drawn, 'No marquee rectangle appeared while dragging on empty stage');
  assert(group.cleared, 'The marquee rectangle survived the end of the drag');
  assert(group.count >= 2, `Marquee selected ${group.count} zones; expected at least 2`);
  const deltas = group.before.map((from, i) => {
    const [x0, y0] = from.split(',').map(parseFloat);
    const [x1, y1] = group.after[i].split(',').map(parseFloat);
    return `${(x1 - x0).toFixed(2)},${(y1 - y0).toFixed(2)}`;
  });
  assert(new Set(deltas).size === 1, `A group move shifted its zones by different amounts: ${deltas.join(' | ')}`);
  assert(deltas[0] !== '0.00,0.00', 'A group move did not move anything');

  // Undo the group move, so what gets saved below is the layout as designed.
  await win.webContents.executeJavaScript(`(async () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    await window.__dz.settle();
    return 'restored';
  })()`);

  // 5. Save round-trips through the store and reaches the stage.
  const saved = await win.webContents.executeJavaScript(`(async () => {
    const { settle, status } = window.__dz;
    document.querySelector('.dz-primary').click();
    await new Promise((r) => setTimeout(r, 250));
    await settle();
    return { status: status(), dirty: document.querySelector('.dz-dirty').textContent.trim() };
  })()`);
  assert(store.layouts.length === 1, `Expected 1 layout in the store after Save, found ${store.layouts.length}`);
  assert(store.layouts[0].name === LIVE_LAYOUT.name, `Saved layout is named "${store.layouts[0].name}"`);
  assert(store.activeId === store.layouts[0].id, 'Saving did not record the layout as active');
  assert(saved.dirty === 'Saved', `Designer still reads "${saved.dirty}" after a successful save`);
  const pushed = sent.filter((message) => message && message.customLayout);
  assert(pushed.length > 0, 'Saving never pushed the layout to the stage');
  assert(
    pushed[pushed.length - 1].customLayout.zones.length === LIVE_LAYOUT.zones.length,
    'The layout pushed to the stage does not match the one on the canvas',
  );

  /* 5b. The round trip. The message the designer put on the wire is handed to
     the real stage window, and the stage has to draw that layout — same zone
     count, same geometry. Everything above this point tests the designer
     against its own idea of a stage; this is the only step that tests the
     designer against the thing it is a designer for. */
  const stageWin = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, '../src/electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  await stageWin.loadURL(`file://${path.resolve(__dirname, '../dist/stage-display.html')}`);
  await new Promise((resolve) => setTimeout(resolve, 600));
  stageWin.webContents.send('stage:message', pushed[pushed.length - 1]);
  await new Promise((resolve) => setTimeout(resolve, 400));

  const onStage = await stageWin.webContents.executeJavaScript(`(() => {
    const zones = [...document.querySelectorAll('.stage-display .stage-zones .zone')];
    return {
      count: zones.length,
      geometry: zones.map((z) => z.style.left + ' ' + z.style.top + ' ' + z.style.width + ' ' + z.style.height),
      background: document.querySelector('.stage-display .stage-bg')?.style.background || '',
    };
  })()`);
  const expected = pushed[pushed.length - 1].customLayout;
  assert(
    onStage.count === expected.zones.length,
    `The stage drew ${onStage.count} zones for a layout with ${expected.zones.length}`,
  );
  for (const zone of expected.zones) {
    const want = `${zone.x}% ${zone.y}% ${zone.w}% ${zone.h}%`;
    assert(onStage.geometry.includes(want), `The stage did not place a zone at ${want}; drew ${onStage.geometry.join(' | ')}`);
  }
  // The browser reports inline colours back as rgb(), so compare like for like.
  const rgb = expected.bgColor.replace(
    /^#(\w\w)(\w\w)(\w\w)$/,
    (_m, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`,
  );
  assert(
    onStage.background.includes(rgb),
    `The stage background is "${onStage.background}", not the layout's ${expected.bgColor} (${rgb})`,
  );
  stageWin.destroy();

  // 6. Nothing the page asked for was refused by its own policy.
  const violations = await win.webContents.executeJavaScript('window.__cspViolations || []');
  assert(violations.length === 0, `CSP blocked ${violations.length}: ${violations.join(', ')}`);

  // 7. It is not a black rectangle.
  const image = await win.webContents.capturePage();
  const pngPath = path.join(outDir, 'designer.png');
  fs.writeFileSync(pngPath, image.toPNG());
  const luma = averageLuma(nativeImage.createFromBuffer(image.toPNG()).resize({ width: 64, height: 64 }).toBitmap());
  assert(Number.isFinite(luma) && luma > 1, `Designer appears blank; average luma=${luma}`);

  console.log(
    'Stage designer verified: opened on the live layout without changing it, real StageSurface on the canvas, '
    + 'drag snapped to centre and went live, undo restored, save reached the store, the real stage window drew the '
    + `result, no CSP violations, luma ${luma.toFixed(2)}, screenshot ${pngPath}`,
  );
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
