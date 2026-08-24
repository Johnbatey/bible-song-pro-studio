/* Static guard for the stage display's architecture.
 *
 * The stage used to be 1,112 lines of vanilla JS in public/, outside tsconfig,
 * outside the Vite inputs and outside every check — and its program pane was an
 * <iframe> onto the legacy WebSocket page on the local HTTP server. That made
 * the musicians' confidence monitor a second renderer on a second transport,
 * free to disagree with the projector with nobody watching.
 *
 * This asserts the properties that stopped that being possible. The runtime
 * half lives in verify-stage-display.cjs, which drives the built window.
 *
 * Usage: node scripts/verify-stage-architecture.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const main = read('src/electron/main.cjs');
const preload = read('src/electron/preload.cjs');
const stageHtml = read('stage-display.html');
const stageEntry = read('src/stage/main.tsx');
const stageSurface = read('src/stage/StageSurface.tsx');
const viteConfig = read('vite.config.ts');
const tsconfig = read('tsconfig.json');

/* Comments in these files discuss the iframe that was removed and why, so
   assertions about code look at the code. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const stageEntryCode = stripComments(stageEntry);
const stageSurfaceCode = stripComments(stageSurface);

// ── The old page is gone, and cannot come back by being copied ──
assert.ok(!exists('public/stage-display'), 'public/stage-display/ must stay deleted — it was a second renderer');
assert.doesNotMatch(viteConfig, /public\/stage-display/, 'vite must not copy a stage-display directory into dist');

// ── It is a real, checked entry ──
assert.match(viteConfig, /stageDisplay:\s*path\.resolve\(__dirname,\s*'stage-display\.html'\)/, 'stage-display.html must be a Vite input, or it is never bundled or checked');
assert.match(tsconfig, /"src\/stage\/\*\*\/\*"/, 'src/stage must be inside tsconfig include, or none of it is typechecked');
assert.match(stageHtml, /src="\/src\/stage\/main\.tsx"/, 'stage-display.html must load the bundled React stage entry');

// ── One renderer, not two ──
assert.match(stageSurfaceCode, /<ProgramSurface/, 'the stage program pane must render ProgramSurface, the same component the projector uses');
assert.doesNotMatch(stageSurfaceCode, /<iframe|createElement\(['"`]iframe/i, 'the stage must not embed anything — an iframe here is a second renderer');
assert.doesNotMatch(stageEntryCode, /<iframe|createElement\(['"`]iframe/i, 'the stage entry must not embed anything');
assert.match(stageHtml, /frame-src 'none'/, "stage CSP must set frame-src 'none' so an iframe cannot return by accident");

// ── One transport, and not the legacy one ──
assert.doesNotMatch(stageEntryCode, /new\s+WebSocket|WebSocket\(/, 'stage entry must not use WebSocket — state arrives over IPC');
assert.doesNotMatch(stageSurfaceCode, /new\s+WebSocket|WebSocket\(/, 'stage surface must not use WebSocket');
assert.doesNotMatch(stageEntryCode + stageSurfaceCode, /display\.html/, 'the stage must not load the legacy display page for its program output');
assert.match(stageEntryCode, /window\.BSP\?\.stage/, 'stage entry must read its own state over the stage IPC bridge');
assert.match(stageEntryCode, /window\.BSP\?\.display/, 'stage entry must read program state over the same display IPC the projector uses');
assert.match(preload, /stage:\s*\{[\s\S]*?ipcRenderer\.on\('stage:message'/, 'preload must expose stage.onMessage over stage:message IPC');
assert.match(preload, /getState:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('stage:getState'\)/, 'preload must expose stage.getState so a window opened mid-service can catch up');

// ── The window itself ──
const stageWindowBody = main.match(/function createStageDisplayWindow\([^)]*\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(stageWindowBody, 'createStageDisplayWindow must exist in main.cjs');
assert.match(stageWindowBody, /webSecurity:\s*true/, 'the stage window must run with webSecurity on — it was only ever off to allow the cross-origin iframe');
assert.match(stageWindowBody, /stage-display\.html/, 'createStageDisplayWindow must load the bundled stage entry');
assert.doesNotMatch(stageWindowBody, /stage-display\/index\.html/, 'createStageDisplayWindow must not load the retired vanilla page');

// ── Any hardcoded server origin must be for assets, never transport ──
const originHits = (stageEntryCode.match(/localhost:8942/g) || []).length;
assert.ok(originHits <= 1, `stage entry should reference the asset origin at most once as a fallback; found ${originHits}`);
assert.doesNotMatch(stageEntryCode, /localhost:8942\/(display|stage-display)/, 'the asset origin must not be used to load a page');

console.log('Stage architecture verified: bundled typechecked entry, ProgramSurface in-process, IPC transport, webSecurity on, no iframe and no legacy page.');
