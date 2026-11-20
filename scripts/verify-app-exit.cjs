/* ── The real app must end its process when the main window closes (#24) ───
 *
 * verify:shutdown stubs electron, so it proves the teardown logic but not that a
 * real Electron process on a real desktop actually goes away. This launches the
 * built app the way a user does, so the window, the servers, the NDI service and
 * the single-instance lock are all real.
 *
 * main.cjs carries the matching probe behind BSP_CI_SHUTDOWN_PROBE, armed only
 * for this script: it opens a stage designer, hides it (leaving the prewarmed
 * window that used to survive), closes the main window, and then does nothing —
 * the app has to exit by itself. The script fails if the process is still alive
 * at the timeout, and insists the probe's own log lines appeared so a crash
 * during startup cannot be mistaken for a clean shutdown.
 *
 * Windows is where this went wrong, but the mechanism is the same everywhere:
 * run it locally with BSP_CI_SHUTDOWN_EXPECT_QUIT=1 to exercise the pass path on
 * macOS, which keeps the app alive by design when its last window closes.
 * ────────────────────────────────────────────────────────────────────────── */
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const electronBinary = require('electron'); // a path to the binary under plain Node
const projectRoot = path.join(__dirname, '..');
/* The app writes settings and session history under userData; a launch from
   this script must not land in the operator's real profile. */
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-app-exit-'));
process.on('exit', () => {
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch (_) {}
});
const timeoutMs = Number(process.env.BSP_CI_SHUTDOWN_TIMEOUT_MS) || 90000;
const probeDelayMs = Number(process.env.BSP_CI_SHUTDOWN_DELAY_MS) || 4000;

const EXPECTED_LINES = [
  '[CI] shutdown probe armed',
  '[CI] stage designer opened and hidden (prewarmed)',
  '[CI] closing main window',
];

function fail(message, output) {
  console.error('✗ ' + message);
  if (output) console.error('--- app output ---\n' + output.trim().slice(-4000));
  process.exit(1);
}

(async () => {
  console.log('Launching the app and closing its main window; the process must exit on its own...');

  const child = spawn(electronBinary, ['--disable-gpu', `--user-data-dir=${userData}`, '.'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BSP_CI_SHUTDOWN_PROBE: '1',
      BSP_CI_SHUTDOWN_DELAY_MS: String(probeDelayMs),
      ELECTRON_ENABLE_LOGGING: '1',
      /* Never inherit a harness value from the shell: CI must test the app's own
         quit, not a forced one. */
      BSP_CI_SHUTDOWN_EXPECT_QUIT: process.env.BSP_CI_SHUTDOWN_EXPECT_QUIT === '1' ? '1' : '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  const exit = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut: false });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ error: err, timedOut: false });
    });
  });

  if (exit.timedOut) {
    try { child.kill('SIGKILL'); } catch (_) {}
    fail(`the process was still running ${Math.round(timeoutMs / 1000)}s after the main window closed`, output);
  }
  if (exit.error) fail('could not launch the app: ' + exit.error.message, output);

  const missing = EXPECTED_LINES.filter((line) => !output.includes(line));
  if (missing.length) fail('the app never reached: ' + missing.join(' | '), output);

  if (output.includes('[CI] shutdown probe failed')) fail('the probe itself failed', output);
  if (output.includes('[Shutdown] Window teardown failed')) fail('window teardown logged an error', output);
  if (exit.code !== 0) fail(`the app exited with code ${exit.code} (signal ${exit.signal || 'none'})`, output);

  console.log('✓ The app closed every window and the process exited 0 after the main window closed.');
})();
