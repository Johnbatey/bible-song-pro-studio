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
/* This used to read `displayPort = startHttpServer()`, from when the server
   bound one port synchronously and handed it back. Since ec6a5f3 it walks a
   range instead, so the port is not known until the listen callback fires and
   there is nothing for the call to return. The two things worth pinning are
   the ones that would silently cost the phone remote its origin: that startup
   still starts the server at all, and that displayPort is taken from the port
   actually bound rather than assumed to be the base of the range.

   The stepping behaviour itself is verify:port-fallback's job, not this one's. */
assert.match(main, /^\s*startHttpServer\(\);/m, 'app startup must still start the local HTTP server');
assert.match(
  main,
  /onListening:\s*\(port\)\s*=>\s*\{[\s\S]*?displayPort\s*=\s*port/,
  'displayPort must come from the port the server actually bound, not the base of the range',
);

assert.match(remote, /new WebSocket\(/, 'remote.html must keep its WebSocket connection');
assert.match(remote, /fetch\(API_BASE \+ path/, 'remote.html must call REST API through the local HTTP origin');
assert.match(remote, /\/api\/verse\/search/, 'remote.html must use verse search API');
assert.match(remote, /\/api\/display\/project/, 'remote.html must use project API');
assert.match(remote, /\/api\/display\/clear/, 'remote.html must use clear API');
assert.match(remote, /\/api\/display\/blackout/, 'remote.html must use blackout API');

assert.match(viteConfig, /const files = \['splash\.html', 'display\.html', 'remote\.html'\]/, 'renderer build must continue copying remote.html to dist');

console.log('Remote architecture verified: remote.html, REST API, WebSocket, and media-serving routes remain wired.');
