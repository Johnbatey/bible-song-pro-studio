/* Checks that a port conflict costs a port number rather than the app.
 *
 * Exercises the shipped listenWithFallback from src/electron — plain node, no
 * Electron needed, against really occupied ports rather than a mock.
 *
 * Usage: node scripts/verify-port-fallback.cjs
 */
const http = require('node:http');
const net = require('node:net');
const { listenWithFallback } = require('../src/electron/listen-with-fallback.cjs');

const BASE = 18942; // out of the app's own range, so a running app cannot skew this
const ATTEMPTS = 4;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Hold `count` consecutive ports from BASE. */
function occupy(count) {
  return Promise.all(
    Array.from({ length: count }, (_, i) => new Promise((resolve, reject) => {
      const s = net.createServer();
      s.on('error', reject);
      s.listen(BASE + i, '0.0.0.0', () => resolve(s));
    })),
  );
}

function bind() {
  return new Promise((resolve) => {
    const server = http.createServer((_, res) => res.end('ok'));
    listenWithFallback(server, {
      basePort: BASE,
      attempts: ATTEMPTS,
      onListening: (port) => resolve({ port, server }),
      onError: (message) => resolve({ error: message, server }),
    });
  });
}

async function main() {
  // 1. Nothing in the way: takes the base port.
  const clean = await bind();
  assert(clean.port === BASE, `Expected to bind ${BASE}, got ${clean.port || clean.error}`);
  clean.server.close();

  // 2. Base port held: walks up to the next free one.
  const held1 = await occupy(1);
  const stepped = await bind();
  assert(stepped.port === BASE + 1, `Expected fallback to ${BASE + 1}, got ${stepped.port || stepped.error}`);
  stepped.server.close();
  held1.forEach((s) => s.close());

  // 3. Several held: keeps walking.
  const held3 = await occupy(3);
  const walked = await bind();
  assert(walked.port === BASE + 3, `Expected fallback to ${BASE + 3}, got ${walked.port || walked.error}`);
  walked.server.close();
  held3.forEach((s) => s.close());

  // 4. Whole range held: reports instead of throwing. This is the case that
  //    used to be an uncaught exception in the main process.
  const heldAll = await occupy(ATTEMPTS);
  const exhausted = await bind();
  assert(!exhausted.port, `Expected no bind with the range full, got port ${exhausted.port}`);
  assert(/all in use/.test(exhausted.error || ''), `Expected an "all in use" report, got: ${exhausted.error}`);
  heldAll.forEach((s) => s.close());

  console.log(`Port fallback verified: binds ${BASE}, steps to ${BASE + 1} and ${BASE + 3} around conflicts, and reports cleanly when ${BASE}-${BASE + ATTEMPTS - 1} are all taken.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
