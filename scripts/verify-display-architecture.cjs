const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const main = read('src/electron/main.cjs');
const preload = read('src/electron/preload.cjs');
const audienceHtml = read('audience-display.html');
const audienceEntry = read('src/display/main.tsx');
const legacyDisplay = read('display.html');
const createDisplayWindowBody = main.match(/function createDisplayWindow\([^)]*\) \{[\s\S]*?\n\}/)?.[0] || '';

assert.match(main, /loadURL\(isDev \? 'http:\/\/localhost:5173\/audience-display\.html'/, 'createDisplayWindow must load the bundled audience display in development');
assert.match(main, /dist\/audience-display\.html/, 'createDisplayWindow must load dist/audience-display.html in production');
assert.doesNotMatch(createDisplayWindowBody, /localhost:5173\/display\.html|dist\/display\.html|['"`]display\.html['"`]/, 'internal createDisplayWindow must not load legacy display.html');

assert.match(preload, /onMessage:\s*\(cb\)\s*=>\s*{[\s\S]*ipcRenderer\.on\('display:message'/, 'preload must expose display.onMessage over display:message IPC');
assert.match(preload, /return\s+\(\)\s*=>\s*ipcRenderer\.removeListener\('display:message'/, 'display.onMessage must return a cleanup function');
assert.match(preload, /getState:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('display:getState'\)/, 'preload must expose display.getState');

assert.match(audienceHtml, /src="\/src\/display\/main\.tsx"/, 'audience-display.html must load the bundled React display entry');
assert.match(audienceEntry, /displayApi\?\.onMessage\?\.\(/, 'audience display entry must listen for IPC display updates');
assert.match(audienceEntry, /displayApi\?\.getState\?\.\(/, 'audience display entry must request initial display state');
assert.match(audienceEntry, /<ProgramSurface/, 'audience display entry must render ProgramSurface');
assert.doesNotMatch(audienceEntry, /new\s+WebSocket|WebSocket\(/, 'audience display entry must not use WebSocket');

assert.match(legacyDisplay, /new\s+WebSocket|WebSocket\(/, 'legacy display.html remains available at /legacy-display.html');

const browserHtml = read('browser-display.html');
const browserEntry = read('src/display/browser-main.tsx');
assert.match(browserHtml, /src="\/src\/display\/browser-main\.tsx"/, 'browser-display.html must load the browser ProgramSurface entry');
assert.match(browserEntry, /<ProgramSurface/, 'browser display must render ProgramSurface so slides paint like Program');
assert.match(browserEntry, /WebSocket|\/api\/display\/state/, 'browser display must take state over the HTTP/WS path OBS uses');
assert.match(main, /browser-display\.html/, 'HTTP /display.html must serve the ProgramSurface browser build');
assert.match(main, /legacy-display\.html/, 'legacy flat display must remain reachable for debugging');

/* Matched against the handler body rather than the whole file, so this keeps
   asserting the intent — the legacy browser URL is reported separately from
   the internal IPC display — without breaking every time the expression around
   it changes shape. It reads displayPort, not a literal, because the port moves
   when one is taken. */
const statusBody = main.match(/ipcMain\.handle\('display:getStatus'[\s\S]*?\}\)\);/)?.[0] || '';
assert.match(statusBody, /browserUrl:/, 'display status should expose legacy browserUrl separately from internal IPC display');
assert.match(statusBody, /display\.html/, 'browserUrl must point at /display.html on the bound port');
assert.match(statusBody, /serverError/, 'display status should report why the local server is unavailable when it did not bind');

console.log('Display architecture verified: internal audience = IPC ProgramSurface; browser /display.html = WS/poll ProgramSurface; legacy flat page at /legacy-display.html.');
