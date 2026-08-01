const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const main = read('src/electron/main.cjs');
const remote = read('public/remote.html');
const viteConfig = read('vite.config.ts');

assert.match(main, /function startHttpServer\(\)/, 'main process must keep the local HTTP server');
assert.match(main, /pn === '\/remote\.html'[\s\S]*serveHtmlFile\('remote\.html'\)/, 'HTTP server must serve remote.html');
assert.match(main, /'GET \/api\/status'\s*:\s*\(\)\s*=>/, 'HTTP server must expose GET /api/status');
assert.match(main, /'POST \/api\/verse\/search'\s*:/, 'HTTP server must expose verse search for mobile remote');
assert.match(main, /'POST \/api\/display\/project'\s*:/, 'HTTP server must expose project endpoint for mobile remote');
assert.match(main, /'POST \/api\/display\/clear'\s*:/, 'HTTP server must expose clear endpoint for mobile remote');
assert.match(main, /'POST \/api\/display\/blackout'\s*:/, 'HTTP server must expose blackout endpoint for mobile remote');
assert.match(main, /pn\.startsWith\('\/media\/'\)/, 'HTTP server must keep /media/* serving for imported media');
assert.match(main, /new WebSocketServer\(\{ server \}\)/, 'HTTP server must keep WebSocket support for remote/browser clients');
assert.match(main, /displayPort\s*=\s*startHttpServer\(\)/, 'app startup must still start the local HTTP server');

assert.match(remote, /new WebSocket\(/, 'remote.html must keep its WebSocket connection');
assert.match(remote, /fetch\(API_BASE \+ path/, 'remote.html must call REST API through the local HTTP origin');
assert.match(remote, /\/api\/verse\/search/, 'remote.html must use verse search API');
assert.match(remote, /\/api\/display\/project/, 'remote.html must use project API');
assert.match(remote, /\/api\/display\/clear/, 'remote.html must use clear API');
assert.match(remote, /\/api\/display\/blackout/, 'remote.html must use blackout API');

assert.match(viteConfig, /const files = \['splash\.html', 'display\.html', 'remote\.html'\]/, 'renderer build must continue copying remote.html to dist');

console.log('Remote architecture verified: remote.html, REST API, WebSocket, and media-serving routes remain wired.');
