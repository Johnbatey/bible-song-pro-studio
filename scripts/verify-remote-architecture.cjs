const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const main = read('src/electron/main.cjs');
const remote = read('public/remote.html');
const display = read('display.html');
const viteConfig = read('vite.config.ts');

assert.match(main, /function startHttpServer\(\)/, 'main process must keep the local HTTP server');
assert.match(main, /const page = pn === '\/remote\.html'[\s\S]*?serveHtmlFile\(page/, 'HTTP server must serve remote.html');

/* ── The network surfaces are gated ──────────────────────────────────────
   Everything the port exposes can drive or paint the projector, so the port
   is not the credential. These pin the four places that decide who gets in:
   the per-launch token, the projector pages, the REST API, and the WebSocket
   handshake — a socket that opens first and is refused afterwards has already
   been sent the current display state. */
assert.match(main, /const remoteToken = crypto\.randomBytes\(/, 'the network surfaces must be gated by a per-launch token');
assert.match(main, /if \(!isAuthorized\(req, url\)\) \{\s*sendAuthRequired/, 'projector pages must refuse a request without the token');
assert.match(main, /if \(!isAuthorized\(req, url\)\) \{\s*res\.writeHead\(401/, 'REST API must refuse a request without the token');
assert.match(main, /verifyClient: \(info, done\)/, 'WebSocket handshake must be authorized before the socket opens');
assert.match(main, /if \(isAuthorized\(info\.req, reqUrl\)\) \{ done\(true\); return; \}/, 'WebSocket must accept only an authorized handshake');
assert.match(main, /crypto\.timingSafeEqual/, 'token comparison must be constant-time');
assert.doesNotMatch(
  main,
  /'Content-Type': 'application\/json',\s*'Cache-Control': 'no-store, no-cache, must-revalidate',\s*'Access-Control-Allow-Origin'/,
  'REST responses must not carry wildcard CORS now that they are token-gated',
);
assert.match(main, /'GET \/api\/status'\s*:\s*\(\)\s*=>/, 'HTTP server must expose GET /api/status');
assert.match(main, /'POST \/api\/verse\/search'\s*:/, 'HTTP server must expose verse search for mobile remote');
assert.match(main, /'POST \/api\/display\/project'\s*:/, 'HTTP server must expose project endpoint for mobile remote');
assert.match(main, /'POST \/api\/display\/clear'\s*:/, 'HTTP server must expose clear endpoint for mobile remote');
assert.match(main, /'POST \/api\/display\/blackout'\s*:/, 'HTTP server must expose blackout endpoint for mobile remote');
assert.match(main, /'POST \/api\/display\/mode'\s*:/, 'HTTP server must expose the audience screen mode so the phone can switch FS/LT');
assert.match(main, /'display:set-output-mode'/, 'the phone\'s FS/LT must reach the renderer that owns the screen mode, not write the main process copy');
assert.match(main, /'GET \/api\/stage\/state'\s*:/, 'HTTP server must expose a stage summary so the remote can show that screen');
assert.match(main, /'POST \/api\/stage\/timer'\s*:/, 'HTTP server must expose the stage timer so the phone can start, pause and reset it');
assert.match(main, /'POST \/api\/display\/step'\s*:/, 'HTTP server must expose a verse-step endpoint for the phone\'s Previous/Next');
assert.match(main, /'GET \/api\/bible\/versions'\s*:/, 'HTTP server must expose the installed translations so the phone can pick one');
assert.match(main, /focus: focused\.reference/, 'a reference search must answer with its whole chapter and name the verse that was asked for');
assert.match(main, /'GET \/api\/bible\/books'\s*:/, 'HTTP server must expose the book shelf for the phone navigator');
assert.match(main, /'POST \/api\/verse\/strongs'\s*:/, 'HTTP server must expose Strong\'s annotation for the phone');
assert.match(main, /'POST \/api\/display\/wordstudy'\s*:/, 'a Strong\'s number on the phone must be able to open the desk\'s word study');
assert.match(main, /function wordStudyScene\(/, 'a word study must be projected as the same scene the desk builds, not a phone-only shape');
assert.match(main, /lexicon:remote-request/, 'the phone\'s Strong\'s numbers must be tagged by the renderer that owns the word table');
assert.match(main, /'POST \/api\/fx'\s*:/, 'HTTP server must expose the app FX settings so the phone can change them');
assert.match(main, /'display:set-fx-settings'/, 'a duration chosen on the phone must reach the renderer store that owns fxSettings');
assert.match(main, /function remoteProjection\(verse, body\)/, 'dual readings must be resolved in the main process');
assert.match(main, /pn\.startsWith\('\/media\/'\)/, 'HTTP server must keep /media/* serving for imported media');
assert.match(main, /new WebSocketServer\(\{[\s\S]*?\n\s*server,/, 'HTTP server must keep WebSocket support for remote/browser clients');
assert.match(display, /new WebSocket\(/, 'display.html must keep a WebSocket client');
assert.match(display, /\/api\/display\/state/, 'display.html must poll /api/display/state so OBS Browser Source still updates when WebSockets fail');
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

assert.match(main, /type: 'stage:update'/, 'the socket must carry stage updates to remote clients, not only display state');

assert.match(remote, /new WebSocket\(/, 'remote.html must keep its WebSocket connection');
assert.match(remote, /fetch\(API_BASE \+ path/, 'remote.html must call REST API through the local HTTP origin');
assert.match(remote, /x-bsp-token/, 'remote.html must present the session token on REST calls');
assert.match(remote, /token=/, 'remote.html must present the session token on its WebSocket handshake');
assert.match(remote, /\/api\/verse\/search/, 'remote.html must use verse search API');
assert.match(remote, /\/api\/display\/project/, 'remote.html must use project API');
assert.match(remote, /\/api\/display\/clear/, 'remote.html must use clear API');
assert.match(remote, /\/api\/display\/blackout/, 'remote.html must use blackout API');
assert.match(remote, /\/api\/display\/mode/, 'remote.html must switch the audience screen between full screen and lower third');
assert.match(remote, /\/api\/display\/step/, 'remote.html must step verses through the API rather than walking a list of its own');
assert.match(remote, /\/api\/stage\/timer/, 'remote.html must drive the stage timer');
assert.match(remote, /\/api\/bible\/versions/, 'remote.html must fill its translation picker from the app rather than a hardcoded list');
assert.match(remote, /\/api\/bible\/books/, 'remote.html must browse the book shelf through the API');
assert.match(remote, /\/api\/verse\/strongs/, 'remote.html must annotate with the app\'s own lexicon');
assert.match(remote, /versionId: currentVersion\(\)/, 'search and Prev/Next must both use the translation the phone picked');
/* A tap on a verse is the go. Keeping a Project button next to a cue-free list
   would be a second step with nothing to confirm. */
assert.doesNotMatch(remote, /id="project"/, 'remote.html must not keep a Project button once a tap goes straight to air');

assert.match(viteConfig, /const files = \['splash\.html', 'display\.html', 'remote\.html'\]/, 'renderer build must continue copying remote.html to dist');

console.log('Remote architecture verified: remote.html, REST API, WebSocket, and media-serving routes remain wired, and all three are token-gated.');
