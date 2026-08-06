/* Stage layout designer — the parts that live outside a window.
 *
 * Two halves, both of which the runtime check in verify-stage-designer.cjs
 * cannot cover because it stands in for the main process rather than using it:
 *
 *   1. The layout store. It is the only copy of an operator's work, so it has
 *      to survive a corrupt file, a half-written file, and a delete of the
 *      layout that happens to be active.
 *   2. The wiring in main.cjs and preload.cjs that makes a second window a
 *      legitimate author of stage state — including the rule that a publisher
 *      never receives its own message back.
 *
 * Usage: node scripts/verify-stage-layouts.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ── 1. The store ─────────────────────────────────────────────────────────── */
const { createStageLayoutsService } = require(path.join(root, 'src/electron/stage-layouts-service.cjs'));

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-layouts-'));
const service = createStageLayoutsService({ app: { getPath: () => userData } });
const filePath = path.join(userData, 'stage-layouts.json');

const layoutA = { id: 'l-a', name: 'Sunday Confidence', bgColor: '#05070d', zones: [{ id: 'z1', type: 'current-text', x: 0, y: 0, w: 100, h: 100 }] };
const layoutB = { id: 'l-b', name: 'Band', bgColor: '#000000', zones: [] };

// A library nobody has written to yet reads as empty, not as an error.
assert.deepEqual(service.list(), { ok: true, layouts: [], activeId: null }, 'a missing file must read as an empty library');

assert.ok(service.save(layoutA).ok, 'save must accept a well-formed layout');
assert.ok(service.save(layoutB).ok);
assert.equal(service.list().layouts.length, 2, 'both layouts must be stored');

// Saving the same id updates in place rather than appending a second copy —
// otherwise every Save during a design session leaves another orphan behind.
assert.ok(service.save({ ...layoutA, name: 'Sunday Confidence v2' }).ok);
const afterUpdate = service.list().layouts;
assert.equal(afterUpdate.length, 2, 'saving an existing id must replace, not append');
assert.equal(afterUpdate.find((l) => l.id === 'l-a').name, 'Sunday Confidence v2', 'the update must win');

// A layout without an id has nothing to key on and must be refused rather
// than stored under undefined, where the next idless save would overwrite it.
assert.equal(service.save({ name: 'no id' }).ok, false, 'a layout with no id must be refused');
assert.equal(service.save(null).ok, false, 'a null layout must be refused');

assert.ok(service.setActive('l-a').ok);
assert.equal(service.list().activeId, 'l-a', 'the active layout must persist');

// Deleting the active layout must clear the pointer, or the next launch tries
// to restore a layout that is no longer anywhere.
assert.ok(service.remove('l-a').ok);
assert.equal(service.list().activeId, null, 'deleting the active layout must clear activeId');
assert.equal(service.list().layouts.length, 1, 'delete must remove exactly one layout');

// A file truncated by a power cut reads as an empty library rather than
// throwing on the Sunday morning it is needed.
fs.writeFileSync(filePath, '{"layouts":[{"id":"x"', 'utf8');
assert.deepEqual(service.list(), { ok: true, layouts: [], activeId: null }, 'a corrupt file must read as an empty library');
assert.ok(service.save(layoutB).ok, 'the store must be writable again after a corrupt read');
assert.equal(service.list().layouts.length, 1, 'a corrupt file must be replaced, not appended to');

// Writes land atomically, so nothing ever observes a partial file.
assert.ok(!fs.existsSync(`${filePath}.tmp`), 'the temp file must be renamed away, never left behind');
assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, 'utf8')), 'the stored file must always be valid JSON');

fs.rmSync(userData, { recursive: true, force: true });

/* ── 2. The wiring ────────────────────────────────────────────────────────── */
const main = stripComments(read('src/electron/main.cjs'));
const preload = read('src/electron/preload.cjs');
const viteConfig = read('vite.config.ts');
const tsconfig = read('tsconfig.json');
const designerHtml = read('stage-designer.html');
const canvas = stripComments(read('src/stage-designer/DesignerCanvas.tsx'));

// The designer is a real, bundled, typechecked entry — not a page outside
// every check, which is exactly what the stage used to be.
assert.match(viteConfig, /stageDesigner:\s*path\.resolve\(__dirname,\s*'stage-designer\.html'\)/, 'stage-designer.html must be a Vite input');
assert.match(tsconfig, /"src\/stage-designer\/\*\*\/\*"/, 'src/stage-designer must be inside tsconfig include');
assert.match(designerHtml, /src="\/src\/stage-designer\/main\.tsx"/, 'stage-designer.html must load the bundled entry');
assert.match(designerHtml, /frame-src 'none'/, "the designer's CSP must set frame-src 'none'");

// The canvas draws the real renderer. A preview assembled here out of its own
// markup could disagree with the stage, which is the one thing this tool must
// never do.
assert.match(canvas, /<StageSurface/, 'the designer canvas must render StageSurface, not a facsimile of it');
assert.doesNotMatch(canvas, /<iframe|createElement\(['"`]iframe/i, 'the designer must not embed anything');

// The window.
const designerWindow = main.match(/function createStageDesignerWindow\(\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(designerWindow, 'createStageDesignerWindow must exist in main.cjs');
assert.match(designerWindow, /webSecurity:\s*true/, 'the designer window must run with webSecurity on');
assert.match(designerWindow, /contextIsolation:\s*true/, 'the designer window must run with context isolation');
assert.doesNotMatch(designerWindow, /nodeIntegration:\s*true/, 'the designer window must not have node integration');
assert.match(designerWindow, /stage-designer\.html/, 'createStageDesignerWindow must load the designer entry');
assert.match(designerWindow, /existing\.focus\(\)/, 'a second open must focus the existing designer, not open a rival editor on the same layouts');
assert.match(designerWindow, /dirtyDesigners/, 'closing a designer with unsaved work must be guarded');
assert.match(main, /ipcMain\.handle\('stage-designer:close'/, 'the designer needs a way back to the app');

/* Two ways the close path can take the whole app down with it, both found the
   hard way. `win.webContents` is gone by the time `closed` fires, so reaching
   through it there throws — and an uncaught throw in the main process puts up
   Electron's own modal error box, which blocks the projector and the stage
   along with everything else. And showMessageBoxSync blocks the main process
   by design, which is the same freeze arrived at deliberately. */
assert.match(designerWindow, /const contentsId = win\.webContents\.id;/, 'the designer window must capture its webContents id while it still has one');
assert.doesNotMatch(
  designerWindow.replace(/const contentsId = win\.webContents\.id;/, ''),
  /win\.webContents\.id/,
  'the designer close path must use the captured id, never reach through a destroyed webContents',
);
assert.doesNotMatch(main, /showMessageBoxSync/, 'a modal that blocks the main process also blocks the projector and the stage — ask asynchronously');

// The feed is a bus: everyone who renders stage state receives it, and the
// sender never receives its own message back.
assert.match(main, /function stageAudience\(\)/, 'main must have one place that answers "who renders stage state"');
assert.match(main, /stageAudience\(\)[\s\S]{0,200}senderId/, 'the broadcast must be able to skip the sender');
assert.match(main, /ipcMain\.handle\('stage:sendState',\s*\(event, message\) => setStageState\(message, event\.sender\.id\)\)/, 'stage:sendState must pass the sender on so it is not echoed to');

// A snapshot must never carry both a preset and a custom layout — a window
// catching up would apply one and then draw the other over the top.
assert.match(main, /delete stageState\.customLayout/, 'setting a preset must drop the retained custom layout');
assert.match(main, /delete stageState\.layout/, 'setting a custom layout must drop the retained preset');

// The library IPC.
for (const channel of ['stage-layouts:list', 'stage-layouts:save', 'stage-layouts:delete', 'stage-layouts:setActive']) {
  assert.ok(main.includes(`'${channel}'`), `main must handle ${channel}`);
  assert.ok(preload.includes(`'${channel}'`), `preload must expose ${channel}`);
}
assert.match(main, /broadcastStageLayouts/, 'saving or deleting must tell every window the library changed');
assert.match(preload, /ipcRenderer\.on\('stage-layouts:changed'/, 'preload must expose the library-changed broadcast');

/* ── 3. The operator's end ────────────────────────────────────────────────── */
const panel = stripComments(read('src/renderer/components/StagePanel.tsx'));
const bus = stripComments(read('src/renderer/services/stage-bus.ts'));

// The picker offers both kinds. A designer that can save a layout the operator
// cannot then choose is a designer that produces nothing.
assert.match(panel, /useLayoutLibrary\(\)/, 'the operator panel must read the saved-layout library');
assert.match(panel, /\.\.\.PRESET_OPTIONS,[\s\S]{0,200}library\.layouts\.map/, 'the layout picker must list presets and saved layouts together');
assert.match(panel, /openStageDesigner/, 'the operator panel must be able to open the designer');

// A preset travels as an id the stage can look up; an operator's layout has to
// travel whole, because nothing on the stage side has heard of it.
assert.match(panel, /isPresetId\(id\)[\s\S]{0,120}publishStage\(\{ layout: id \}\)/, 'a preset must be applied by id');
assert.match(panel, /publishStage\(\{[\s\S]{0,120}customLayout:/, 'a saved layout must be published in full');
assert.match(panel, /library\.setActive\(id\)/, 'choosing a layout must record it so the next launch comes back to it');

// The bus receives as well as publishes, or a change made in the designer
// never reaches the operator's own preview.
assert.match(bus, /window\.BSP\?\.stage\?\.onMessage\?\.\(/, 'the operator bus must subscribe to the stage feed, not only publish to it');
assert.match(bus, /getState\(\)/, 'the operator bus must catch up from the retained snapshot on load');
assert.match(bus, /snapshot\.layout \|\| snapshot\.customLayout/, 'restoring the saved layout must not override a choice already made this session');

console.log(
  'Stage layouts verified: store survives corruption, truncation and a delete of the active layout; '
  + 'designer is a bundled typechecked entry rendering the real StageSurface; stage feed is a bus that never echoes '
  + 'to its sender; the operator picker lists and applies both presets and saved layouts.',
);
